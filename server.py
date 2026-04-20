import os, json, re
from datetime import date, timedelta
from urllib.parse import unquote
import pandas as pd
from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
import plotly.graph_objects as go

from data_layer import (
    load_partners_excel, load_sot_data, PIPELINE_STAGES, PIPELINE_DEALS,
    REVSHARE_BY_PARTNER, REVSHARE_MONTHLY, MERCHANTS, CONTACTS,
    REGION_STATS, COUNTRIES, find_partners, get_sot_countries, get_sot_providers,
    _ISO_TO_COUNTRY, _VERTICAL_COLS, load_sales_contacts, load_technical_contact,
    load_partner_countries, load_partner_coverage
)

BASE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.environ.get("SECRET_KEY", "yuno-portal-secret-2026"))

# -- Google OAuth setup --------------------------------------------------------

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

ALLOWED_DOMAIN = "y.uno"

# ------------------------------------------------------------------------------

app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE, "templates"))

# -- Auth helpers --------------------------------------------------------------

def get_role(request: Request):
    return request.session.get("role")

def require_auth(request: Request):
    role = get_role(request)
    if not role:
        return None
    return role

NAV = {
    "internal": [
        ("", [("home","Home")]),
        ("PARTNERS & CONNECTORS", [("partners","Partner Portfolio"),("mission","Partners In Flight")]),
        ("PERFORMANCE",           [("performance","Partner Health"),("benchmarks","Partner Rev Share"),("pipeline","Partner Leads"),("introduction","Partner - Merchant Intros")]),
        ("INTELLIGENCE & TOOLS",  [("insights","Market Analysis"),("merch_sim","Merchant Simulator"),("intake","Intake and Outreach Form")]),
    ],
    "partner": [
        ("", [("home","Home")]),
        ("PARTNERS & CONNECTORS", [("partners","Partner Portfolio")]),
        ("PERFORMANCE",           [("performance","Partner Health"),("benchmarks","Partner Rev Share"),("pipeline","Partner Leads")]),
        ("INTELLIGENCE & TOOLS",  [("insights","Market Analysis")]),
    ],
}

BADGES = {}

def ctx(request: Request, page: str, **kwargs):
    role = get_role(request)
    return {
        "role": role,
        "page": page,
        "nav": NAV.get(role, []),
        "badges": BADGES,
        "user_name": request.session.get("user_name", ""),
        "user_picture": request.session.get("user_picture", ""),
        "user_email": request.session.get("user_email", ""),
        **kwargs
    }

def tr(request: Request, name: str, context: dict):
    return templates.TemplateResponse(request=request, name=name, context=context)

# -- Routes --------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "version": "2026-04-16-v3", "routes": ["partners_detail"]}

@app.get("/api/refresh-cache")
def refresh_cache():
    from data_layer import _PARTNERS_CACHE, _CONTACTS_CACHE, _TECH_CACHE, _SOT_CACHE, _PARTNERS_SOT_CACHE
    for c in [_PARTNERS_CACHE, _CONTACTS_CACHE, _TECH_CACHE, _SOT_CACHE, _PARTNERS_SOT_CACHE]:
        c["ts"] = 0
    return {"status": "ok", "message": "Cache cleared. Next request will fetch fresh data."}

@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    if get_role(request):
        return RedirectResponse("/home")
    return RedirectResponse("/login")

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if get_role(request):
        return RedirectResponse("/home")
    error = request.query_params.get("error", "")
    return tr(request, "login.html", {"error": error})

# -- Google OAuth routes -------------------------------------------------------

@app.get("/auth/google")
async def auth_google(request: Request):
    redirect_uri = request.url_for("auth_callback")
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        return RedirectResponse("/login?error=Authentication+failed.+Please+try+again.")
    user_info = token.get("userinfo")
    if not user_info:
        return RedirectResponse("/login?error=Could+not+retrieve+account+information.")
    email = user_info.get("email", "")
    domain = email.split("@")[-1].lower() if "@" in email else ""
    if domain != ALLOWED_DOMAIN:
        return tr(request, "access_denied.html", {"request": request, "email": email})
    request.session["role"] = "internal"
    request.session["user_email"] = email
    request.session["user_name"] = user_info.get("name", email)
    request.session["user_picture"] = user_info.get("picture", "")
    return HTMLResponse("<!DOCTYPE html><html><head></head><body>"
        "<script>sessionStorage.setItem('yuno_auth','1');window.location='/home';</script>"
        "</body></html>")

# ------------------------------------------------------------------------------

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return HTMLResponse("<!DOCTYPE html><html><head></head><body>"
        "<script>sessionStorage.removeItem('yuno_auth');window.location='/login';</script>"
        "</body></html>")

@app.get("/home", response_class=HTMLResponse)
def home(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    return tr(request, "home.html", ctx(request, "home"))

@app.get("/partners", response_class=HTMLResponse)
def partners(request: Request, q: str = "", cat: str = "all", status: str = "all", region: str = "all", tier: str = "all"):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    all_partners = load_partners_excel()
    filtered = all_partners
    if q:
        ql = q.lower()
        filtered = [p for p in filtered if ql in p["name"].lower() or ql in p.get("type","").lower() or ql in p.get("region","").lower() or ql in p.get("country","").lower()]
    if cat != "all":
        filtered = [p for p in filtered if p["type"] == cat]
    if status != "all":
        filtered = [p for p in filtered if p["status"] == status]
    if region != "all":
        filtered = [p for p in filtered if p["region"] == region]
    if tier != "all":
        filtered = [p for p in filtered if p.get("tier") == tier]
    cats = sorted(set(p["type"] for p in all_partners if p["type"]))
    statuses = sorted(set(p["status"] for p in all_partners if p["status"]))
    regions = sorted(set(p["region"] for p in all_partners if p["region"]))
    tiers = sorted(set(p["tier"] for p in all_partners if p.get("tier")))
    countries = sorted(set(p["country"] for p in all_partners if p.get("country")))
    managers = sorted(set(p["manager"] for p in all_partners if p.get("manager")))
    integration_stages = sorted(set(p["integration_stage"] for p in all_partners if p.get("integration_stage")))
    _CONNECTED_STAGES = {"Agreement Review", "Agreement Signed", "Initial Negotiation", "Live Partner", "Only to be integrated"}
    total_db = len(all_partners)
    total_connected = sum(1 for p in all_partners if p["status"] in _CONNECTED_STAGES)
    total_signed = sum(1 for p in all_partners if p["status"] == "Agreement Signed")
    live_count = sum(1 for p in all_partners if p.get("integration_stage", "").lower() == "live")
    total = total_db
    strategic_count = sum(1 for p in all_partners if p.get("tier") == "Strategic Partner")
    tier1_count = sum(1 for p in all_partners if p.get("tier") == "Tier 1")
    tier2_count = sum(1 for p in all_partners if p.get("tier") == "Tier 2")
    tier3_count = sum(1 for p in all_partners if p.get("tier") == "Tier 3")
    countries_count = len(countries)
    return tr(request, "partners.html", ctx(
        request, "partners",
        partners=filtered, total=total,
        live_count=live_count, countries_count=countries_count,
        total_db=total_db, total_connected=total_connected, total_signed=total_signed,
        strategic_count=strategic_count, tier1_count=tier1_count,
        tier2_count=tier2_count, tier3_count=tier3_count,
        cats=cats, statuses=statuses, regions=regions, tiers=tiers,
        countries=countries, managers=managers, integration_stages=integration_stages,
        q=q, cat=cat, status=status, region=region, tier=tier
    ))

@app.get("/partners/{name:path}", response_class=HTMLResponse)
def partner_detail(request: Request, name: str, ref: str = "", country: str = ""):
    name = unquote(name)
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    all_partners = load_partners_excel()
    partner = next((p for p in all_partners if p["name"].lower() == name.lower()), None)
    if not partner:
        return RedirectResponse("/partners")
    try:
        sot_df = load_sot_data()
    except Exception:
        sot_df = pd.DataFrame()
    coverage = []
    if len(sot_df) > 0:
        try:
            pdf = sot_df[sot_df["PROVIDER_NAME"].str.lower() == name.lower()]
            for _, row in pdf.iterrows():
                coverage.append({
                    "country_iso": str(row.get("COUNTRY_ISO", "")),
                    "country": _ISO_TO_COUNTRY.get(str(row.get("COUNTRY_ISO", "")), str(row.get("COUNTRY_ISO", ""))),
                    "method": str(row.get("PAYMENT_METHOD_TYPE", "")),
                    "processing": str(row.get("PROCESSING_TYPE", "")),
                    "status": str(row.get("Live/NonLive Partner/Contract signed", "")),
                    "category": str(row.get("PROVIDER_CATEGORY", "")),
                })
        except Exception:
            coverage = []
    countries = sorted(set(c["country"] for c in coverage if c["country"]))
    methods = sorted(set(c["method"] for c in coverage if c["method"] and c["method"] != "nan"))
    processing = sorted(set(c["processing"] for c in coverage if c["processing"] and c["processing"] != "nan"))
    try:
        sales_contacts = load_sales_contacts(partner["name"])
    except Exception:
        sales_contacts = []
    try:
        technical_contact = load_technical_contact(partner["name"])
    except Exception:
        technical_contact = {"contact": "N/A", "contact_p1": "N/A", "sla": "N/A",
                             "escalation": "N/A", "slack": "N/A", "status_page": "N/A"}
    try:
        cov = load_partner_coverage(partner["name"])
    except Exception:
        cov = {}
    return tr(request, "partner_detail.html", ctx(
        request, "partners",
        partner=partner,
        coverage=coverage,
        countries=countries,
        methods=methods,
        processing=processing,
        sales_contacts=sales_contacts,
        technical_contact=technical_contact,
        partner_countries=cov.get("countries", []),
        partner_regions=cov.get("regions", {}),
        partner_methods=cov.get("methods", []),
        method_categories=cov.get("categories", {}),
        region_methods=cov.get("region_methods", {}),
        category_countries=cov.get("category_countries", {}),
        country_methods=cov.get("country_methods", {}),
        method_countries=cov.get("method_countries", {}),
        processing_label=cov.get("processing_label", "N/A"),
        characteristics=cov.get("characteristics", []),
        back_ref=ref,
        back_country=country,
    ))

@app.get("/pipeline", response_class=HTMLResponse)
def pipeline(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    return tr(request, "pipeline.html", ctx(
        request, "pipeline",
        stages=PIPELINE_STAGES, deals=PIPELINE_DEALS
    ))

@app.get("/mission", response_class=HTMLResponse)
def mission(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if role != "internal":
        return RedirectResponse("/home")
    all_partners = load_partners_excel()
    board = {
        "Prospect": [],
        "Initial Negotiation": [],
        "Agreement Review": [],
        "Agreement Signed but Not Integrated": [],
        "Agreement Signed and Integrated": [],
        "Integrated without Agreement": [],
    }
    for p in all_partners:
        deal = (p.get("stage_raw") or "").strip()
        integ = (p.get("integration_stage") or "").strip().lower()
        if deal == "Opportunity Identification":
            board["Prospect"].append(p)
        elif deal == "Initial Negotiation":
            board["Initial Negotiation"].append(p)
        elif deal == "Agreement Review":
            board["Agreement Review"].append(p)
        elif deal == "Agreement Signed" and integ == "live":
            board["Agreement Signed and Integrated"].append(p)
        elif deal == "Agreement Signed":
            board["Agreement Signed but Not Integrated"].append(p)
        elif integ == "live" and deal != "Agreement Signed" and deal != "Live Partner":
            board["Integrated without Agreement"].append(p)
    total_in_flight = sum(len(v) for v in board.values())
    all_in_flight = [p for col in board.values() for p in col]
    types = sorted(set(p["type"] for p in all_in_flight if p.get("type")))
    regions = sorted(set(p["region"] for p in all_in_flight if p.get("region")))
    countries = sorted(set(p["country"] for p in all_in_flight if p.get("country")))
    managers = sorted(set(p["manager"] for p in all_in_flight if p.get("manager")))
    return tr(request, "mission.html", ctx(
        request, "mission", board=board, total_in_flight=total_in_flight,
        types=types, regions=regions, countries=countries, managers=managers,
    ))

@app.get("/introduction", response_class=HTMLResponse)
def introduction(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if role != "internal":
        return RedirectResponse("/home")
    return tr(request, "introduction.html", ctx(request, "introduction"))

@app.get("/intake", response_class=HTMLResponse)
def intake(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if role != "internal":
        return RedirectResponse("/home")
    return tr(request, "intake.html", ctx(request, "intake"))

@app.get("/performance", response_class=HTMLResponse)
def performance(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    merchants = MERCHANTS
    avg_ar = sum(m["ar"] for m in merchants) / len(merchants)
    total_tpv = sum(m["tpv"] for m in merchants)

    bar_fig = go.Figure(go.Bar(
        x=[m["name"] for m in merchants],
        y=[m["ar"] for m in merchants],
        marker_color=[m["color"] for m in merchants],
        text=[f'{m["ar"]}%' for m in merchants],
        textposition="outside",
    ))
    bar_fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0,r=0,t=10,b=40), height=280,
        yaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)", ticksuffix="%", range=[70,100]),
        xaxis=dict(showgrid=False),
        font=dict(family="Titillium Web", size=11, color="#6e6e73"),
        showlegend=False,
    )

    return tr(request, "performance.html", ctx(
        request, "performance",
        merchants=merchants, avg_ar=round(avg_ar, 1), total_tpv=round(total_tpv, 1),
        bar_chart=bar_fig.to_json()
    ))

@app.get("/benchmarks", response_class=HTMLResponse)
def benchmarks(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    total = sum(REVSHARE_BY_PARTNER.values())

    pie_fig = go.Figure(go.Pie(
        labels=list(REVSHARE_BY_PARTNER.keys()),
        values=list(REVSHARE_BY_PARTNER.values()),
        hole=0.6,
        marker_colors=["#4F46E5","#7C3AED","#2563EB","#0D9488","#D97706",
                       "#DC2626","#059669","#9333EA","#0EA5E9","#F97316"],
    ))
    pie_fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0,r=0,t=0,b=0), height=260,
        showlegend=True,
        legend=dict(font=dict(size=11, family="Titillium Web"), orientation="v"),
        font=dict(family="Titillium Web"),
    )

    months = [m for m,_ in REVSHARE_MONTHLY]
    values = [v for _,v in REVSHARE_MONTHLY]
    line_fig = go.Figure(go.Scatter(
        x=months, y=values, mode="lines+markers",
        line=dict(color="#4F46E5", width=2),
        marker=dict(size=5, color="#4F46E5"),
        fill="tozeroy", fillcolor="rgba(79,70,229,0.06)",
    ))
    line_fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0,r=0,t=10,b=40), height=220,
        yaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)", tickprefix="$", tickformat=".0s"),
        xaxis=dict(showgrid=False, tickangle=-45),
        font=dict(family="Titillium Web", size=11, color="#6e6e73"),
        showlegend=False,
    )

    return tr(request, "benchmarks.html", ctx(
        request, "benchmarks",
        revshare=REVSHARE_BY_PARTNER, total=total,
        pie_chart=pie_fig.to_json(),
        line_chart=line_fig.to_json(),
    ))

COUNTRY_TO_REGION = {
    # Anchors with rich data
    "Brazil": "LATAM",
    "Mexico": "LATAM", "Colombia": "LATAM", "Argentina": "LATAM", "Chile": "LATAM", "Peru": "LATAM",
    "UAE": "Middle East", "Saudi Arabia": "Middle East",
    "India": "APAC", "Singapore": "APAC",
}

COUNTRY_ISO = {
    "Brazil": "br", "Mexico": "mx", "Colombia": "co", "Argentina": "ar", "Chile": "cl", "Peru": "pe",
    "UAE": "ae", "Saudi Arabia": "sa",
    "India": "in", "Singapore": "sg",
}

# Pull in extended catalogue from COUNTRIES dict (which was extended in data_layer.py)
for _c, _meta in COUNTRIES.items():
    if _c not in COUNTRY_TO_REGION and _meta.get("region"):
        COUNTRY_TO_REGION[_c] = _meta["region"]
    if _c not in COUNTRY_ISO and _meta.get("iso"):
        COUNTRY_ISO[_c] = _meta["iso"]

INSIGHTS_HIDDEN_REGIONS = {"global", "emea", "regional", "brazil", "brasil"}
INSIGHTS_EXTRA_REGIONS  = {"Europe", "Middle East"}

# Ecommerce development index (0-100), composite of online penetration,
# digital-payments adoption, logistics maturity and consumer trust.
# Used for the world heatmap when "All regions" is selected.
ECOMMERCE_DEVELOPMENT_INDEX = {
    "South Korea": 95, "United Kingdom": 94, "China": 93, "United States": 92,
    "Singapore": 92, "Netherlands": 91, "Denmark": 91, "Switzerland": 90,
    "Germany": 89, "Hong Kong": 89, "Sweden": 89, "Norway": 88, "Japan": 88,
    "Finland": 87, "Australia": 87, "Ireland": 86, "Canada": 86, "France": 85,
    "Austria": 85, "Belgium": 84, "New Zealand": 84, "Estonia": 83, "Luxembourg": 83,
    "Taiwan": 82, "Spain": 80, "Israel": 80, "Italy": 78, "UAE": 78, "Portugal": 76,
    "Czech Republic": 74, "Slovenia": 73, "Poland": 72, "Malaysia": 70,
    "Saudi Arabia": 69, "Lithuania": 69, "Latvia": 68, "Hungary": 67, "Slovakia": 67,
    "Qatar": 66, "Greece": 65, "Cyprus": 65, "Malta": 64, "Bahrain": 64, "Chile": 63,
    "Croatia": 62, "Thailand": 60, "Bulgaria": 59, "Romania": 58, "Kuwait": 58,
    "Turkey": 57, "Russia": 56, "Oman": 55, "Brazil": 55, "Argentina": 53,
    "Mexico": 52, "Uruguay": 52, "Colombia": 50, "Serbia": 50, "Costa Rica": 49,
    "Vietnam": 49, "South Africa": 48, "India": 47, "Panama": 47, "Indonesia": 46,
    "Philippines": 45, "Peru": 44, "Ukraine": 43, "Morocco": 40, "Jordan": 40,
    "Egypt": 38, "Sri Lanka": 37, "Kenya": 36, "Nigeria": 34, "Ghana": 33,
    "Bangladesh": 33, "Pakistan": 32, "Algeria": 31, "Tunisia": 31, "Bolivia": 30,
    "Paraguay": 30, "Ecuador": 32, "Dominican Republic": 35, "Guatemala": 30,
    "Honduras": 26, "Nicaragua": 25, "Venezuela": 24, "Iraq": 22, "Cambodia": 28,
    "Myanmar": 22, "Nepal": 26, "Tanzania": 24, "Uganda": 22, "Ethiopia": 20,
    "Senegal": 25, "Côte d'Ivoire": 26, "Cameroon": 22, "Angola": 22,
    "Mozambique": 20, "Zimbabwe": 19, "Mauritius": 45, "Rwanda": 28, "Zambia": 22,
    "Botswana": 32, "Lebanon": 38, "Iceland": 85,
}

COUNTRY_DETAIL_RICH = {
    "India": {
        "overview": {
            "Population (2024)":                 "1.43B",
            "GDP nominal (2024)":                "$3.7T",
            "Ecommerce market (2026e)":          "$112B (CAGR 18%)",
            "Online users (2024)":               "880M",
            "Internet penetration (2024)":       "52%",
            "Smartphone penetration (2024)":     "76%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "RuPay",
            "a2a":     "UPI",
            "apms":    [
                {"name": "UPI",      "type": "A2A"},
                {"name": "PhonePe",  "type": "Wallet / UPI"},
                {"name": "Paytm",    "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "A2A",     "detail": "UPI",                       "share": 65, "growth": "+18% YoY"},
            {"name": "Wallets", "detail": "Paytm, PhonePe, MobiKwik", "share": 9,  "growth": "-2% YoY"},
            {"name": "Credit Cards",     "share": 8,  "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",          "share": 4.0, "type": "international"},
                    {"name": "Mastercard",    "share": 2.8, "type": "international"},
                    {"name": "RuPay",         "share": 0.8, "type": "local"},
                    {"name": "Amex / Diners", "share": 0.4, "type": "international"},
                ]},
            {"name": "Debit Cards / Prepaid Cards", "share": 4, "growth": "flat",
                "schemes": [
                    {"name": "RuPay",      "share": 2.0, "type": "local"},
                    {"name": "Visa",       "share": 1.2, "type": "international"},
                    {"name": "Mastercard", "share": 0.8, "type": "international"},
                ]},
            {"name": "Net Banking",      "share": 7,  "growth": "flat"},
            {"name": "Cash on Delivery", "share": 7,  "growth": "-12% YoY"},
        ],
        "partners_landscape": [
            {"name": "Razorpay",  "type": "PSP"},
            {"name": "PayU",      "type": "PSP"},
            {"name": "BillDesk",  "type": "Gateway"},
            {"name": "CCAvenue",  "type": "Gateway"},
            {"name": "Pine Labs", "type": "Acquirer"},
        ],
        "regulation": [
            "The Reserve Bank of India (RBI) is the central bank and regulates all payments. To collect money on behalf of merchants you need a Payment Aggregator (PA) license. Orchestration platforms like Yuno don't hold funds, so they don't need a PA — but they can only route transactions through PSPs and acquirers that DO hold one.",
            "All payment data (card numbers, transaction details, customer info) must be stored on servers physically located in India. No copies outside the country, even for backup. Your PSP partners need an India region in their cloud.",
            "Merchant of Record (MoR) — meaning a foreign company sells to Indian customers in its own name and handles tax/refunds — is allowed but needs a special cross-border PA (PA-CB) license, OR a partnership with a licensed Indian PA. Without one of these, you can't legally settle INR to merchants.",
            "Since 2022, raw card numbers can't be stored anywhere in the payment chain. Instead, the card networks (Visa, Mastercard, RuPay) issue 'tokens' — fake numbers that work only at one merchant. This is RBI's response to large-scale card data leaks.",
            "Taxes: GST (India's VAT, 18%) applies to all payment service fees. On top of that, ecommerce platforms must withhold 1% TDS (income tax) on payouts to sellers under Section 194-O.",
            "For recurring charges (subscriptions, EMI), the customer signs an e-mandate. Below ₹15,000 (~$180) it auto-charges; above that, the bank texts the customer to re-authenticate every single time. This kills high-ticket subscriptions if not architected around it.",
        ],
        "digital_trends": [
            "India is mobile-first to an extreme: cheap data (post-Jio in 2016) put smartphones in 800M+ hands, so over 70% of ecommerce happens on phones — and almost always inside apps, not browsers. Web checkout flows underperform here.",
            "UPI is a free, instant bank-to-bank transfer rail run by NPCI (a non-profit owned by Indian banks). It works by scanning a QR or sending to a virtual ID — no card needed. It now drives ~65% of online payments and is still growing 18% per year, making it the default way Indians pay online and offline.",
            "Quick commerce — 10 to 30 minute grocery and essentials delivery via apps like Blinkit (Zomato), Zepto, Swiggy Instamart and BigBasket Now — is exploding (+50% YoY). Dense cities + cheap labor + dark stores make it economically viable here in a way it isn't in most markets.",
            "ONDC (Open Network for Digital Commerce) is a government-backed open protocol — think 'email but for ecommerce'. Any buyer app can discover any seller on the network, breaking Amazon and Flipkart's stranglehold. It's still early but small sellers and food delivery are adopting fast.",
            "India is segmented into Metro / Tier 1 / Tier 2 / Tier 3 cities by population and income. Most new buyer growth now comes from Tier 2 and Tier 3, where customers shop in their regional language (Hindi, Tamil, Telugu, etc.) and prefer Cash on Delivery and UPI over cards.",
            "WhatsApp has 500M+ Indian users — the dominant messaging app. Through Meta's partnership with JioMart and the WhatsApp Business API, brands can let customers browse a catalog, chat with support and pay (via UPI) without ever leaving the chat. This is becoming a serious sales channel.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
}

COUNTRY_PARTNERS = {
    # ---- LATAM ----
    "Brazil":              [{"name":"PagBank","type":"PSP"},{"name":"Cielo","type":"Acquirer"},{"name":"Stone","type":"Acquirer"},{"name":"Pagar.me","type":"PSP"},{"name":"Mercado Pago","type":"PSP"}],
    "Mexico":              [{"name":"Conekta","type":"PSP"},{"name":"OpenPay","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Clip","type":"Acquirer"},{"name":"BBVA","type":"Acquirer"}],
    "Argentina":           [{"name":"Mercado Pago","type":"PSP"},{"name":"Prisma","type":"Acquirer"},{"name":"Payway","type":"Gateway"},{"name":"Fiserv","type":"Acquirer"},{"name":"dLocal","type":"PSP"}],
    "Colombia":            [{"name":"PayU","type":"PSP"},{"name":"Wompi","type":"PSP"},{"name":"Place to Pay","type":"Gateway"},{"name":"Credibanco","type":"Acquirer"},{"name":"Redeban","type":"Acquirer"}],
    "Chile":               [{"name":"Transbank","type":"Acquirer"},{"name":"Khipu","type":"Gateway"},{"name":"Flow","type":"PSP"},{"name":"Kushki","type":"PSP"},{"name":"Getnet","type":"Acquirer"}],
    "Peru":                [{"name":"Niubiz","type":"Acquirer"},{"name":"Culqi","type":"PSP"},{"name":"Izipay","type":"Acquirer"},{"name":"Mercado Pago","type":"PSP"},{"name":"PayU","type":"PSP"}],
    "Uruguay":             [{"name":"PayTrue","type":"PSP"},{"name":"Plexo","type":"PSP"},{"name":"Resonance","type":"Gateway"},{"name":"Geocom","type":"Acquirer"},{"name":"Scanntech","type":"Acquirer"}],
    "Ecuador":             [{"name":"Datafast","type":"Acquirer"},{"name":"Medianet","type":"Acquirer"},{"name":"Place to Pay","type":"Gateway"},{"name":"PayPhone","type":"PSP"},{"name":"Kushki","type":"PSP"}],
    "Bolivia":             [{"name":"Linkser","type":"Acquirer"},{"name":"ATC","type":"Acquirer"},{"name":"Visanet Bolivia","type":"Acquirer"},{"name":"Pagosnet","type":"PSP"},{"name":"Tuyo","type":"Gateway"}],
    "Paraguay":            [{"name":"Bancard","type":"Acquirer"},{"name":"Procard","type":"Acquirer"},{"name":"Pagopar","type":"PSP"},{"name":"Practipago","type":"PSP"},{"name":"Vendetuapp","type":"Gateway"}],
    "Venezuela":           [{"name":"Banesco","type":"Acquirer"},{"name":"Mercantil","type":"Acquirer"},{"name":"Cantv Pago","type":"Gateway"},{"name":"Bigpay","type":"PSP"},{"name":"Mobilpay","type":"PSP"}],
    "Costa Rica":          [{"name":"BAC Credomatic","type":"Acquirer"},{"name":"BCR","type":"Acquirer"},{"name":"Banco Nacional","type":"Acquirer"},{"name":"Tilopay","type":"PSP"},{"name":"Pago Tic","type":"PSP"}],
    "Dominican Republic":  [{"name":"AZUL","type":"Acquirer"},{"name":"Cardnet","type":"Acquirer"},{"name":"Banreservas","type":"Acquirer"},{"name":"Pagora","type":"PSP"},{"name":"Plataforma","type":"Gateway"}],
    "Panama":              [{"name":"Credicorp Bank","type":"Acquirer"},{"name":"Banistmo","type":"Acquirer"},{"name":"Banco General","type":"Acquirer"},{"name":"Pagatodo","type":"PSP"},{"name":"MultiPagos","type":"Gateway"}],
    "Guatemala":           [{"name":"Visanet Guatemala","type":"Acquirer"},{"name":"Credomatic","type":"Acquirer"},{"name":"Banco Industrial","type":"Acquirer"},{"name":"Recargapay","type":"PSP"},{"name":"Dialecta","type":"PSP"}],
    "El Salvador":         [{"name":"Bancoagrícola","type":"Acquirer"},{"name":"Banco Cuscatlán","type":"Acquirer"},{"name":"Visanet El Salvador","type":"Acquirer"},{"name":"N1co","type":"PSP"},{"name":"Pagadito","type":"PSP"}],
    "Honduras":            [{"name":"BAC Credomatic","type":"Acquirer"},{"name":"Ficohsa","type":"Acquirer"},{"name":"Banco Atlántida","type":"Acquirer"},{"name":"Tengo","type":"PSP"},{"name":"Pagatodo","type":"PSP"}],
    "Nicaragua":           [{"name":"BAC Nicaragua","type":"Acquirer"},{"name":"Lafise","type":"Acquirer"},{"name":"Banpro","type":"Acquirer"},{"name":"Tica Pay","type":"PSP"},{"name":"Pagasolo","type":"PSP"}],
    "Puerto Rico":         [{"name":"Banco Popular","type":"Acquirer"},{"name":"Evertec","type":"Acquirer"},{"name":"Athenas","type":"Gateway"},{"name":"Stripe","type":"PSP"},{"name":"Square","type":"PSP"}],
    "Jamaica":             [{"name":"NCB","type":"Acquirer"},{"name":"Scotia Jamaica","type":"Acquirer"},{"name":"JN Bank","type":"Acquirer"},{"name":"WiPay","type":"PSP"},{"name":"TransJamaican","type":"Gateway"}],
    "Trinidad and Tobago": [{"name":"Republic Bank","type":"Acquirer"},{"name":"FCB","type":"Acquirer"},{"name":"Scotia T&T","type":"Acquirer"},{"name":"WiPay","type":"PSP"},{"name":"TT Pay","type":"Gateway"}],
    # ---- North America ----
    "United States":       [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Worldpay","type":"Acquirer"},{"name":"Chase Merchant Services","type":"Acquirer"},{"name":"Braintree","type":"PSP"}],
    "Canada":              [{"name":"Moneris","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Global Payments","type":"Acquirer"},{"name":"Bambora","type":"PSP"}],
    # ---- Europe ----
    "United Kingdom":      [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Worldpay","type":"Acquirer"},{"name":"Barclaycard","type":"Acquirer"},{"name":"Checkout.com","type":"PSP"}],
    "Germany":             [{"name":"Adyen","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Computop","type":"Gateway"},{"name":"Nexi","type":"Acquirer"},{"name":"Worldline","type":"Acquirer"}],
    "France":              [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Worldline","type":"Acquirer"},{"name":"Lyra","type":"Gateway"},{"name":"BNP Paribas","type":"Acquirer"}],
    "Spain":               [{"name":"Redsys","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"BBVA","type":"Acquirer"},{"name":"CaixaBank","type":"Acquirer"}],
    "Italy":               [{"name":"Nexi","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"SIA","type":"Acquirer"},{"name":"Worldline","type":"Acquirer"}],
    "Portugal":            [{"name":"SIBS","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Easypay","type":"PSP"},{"name":"Eupago","type":"PSP"}],
    "Netherlands":         [{"name":"Adyen","type":"PSP"},{"name":"Mollie","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Worldline","type":"Acquirer"},{"name":"ING","type":"Acquirer"}],
    "Belgium":             [{"name":"Adyen","type":"PSP"},{"name":"Worldline","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Mollie","type":"PSP"},{"name":"Hipay","type":"PSP"}],
    "Switzerland":         [{"name":"Worldline","type":"Acquirer"},{"name":"Adyen","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Datatrans","type":"Gateway"},{"name":"PostFinance","type":"Acquirer"}],
    "Sweden":              [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Bambora","type":"Acquirer"},{"name":"Nets","type":"Acquirer"},{"name":"DIBS","type":"Gateway"}],
    "Norway":              [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Nets","type":"Acquirer"},{"name":"DIBS","type":"Gateway"},{"name":"DNB","type":"Acquirer"}],
    "Denmark":             [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Nets","type":"Acquirer"},{"name":"QuickPay","type":"Gateway"},{"name":"Reepay","type":"PSP"}],
    "Finland":             [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Nets","type":"Acquirer"},{"name":"Paytrail","type":"PSP"},{"name":"OP Verkkomaksu","type":"Gateway"}],
    "Ireland":             [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"AIB Merchant Services","type":"Acquirer"},{"name":"Worldpay","type":"Acquirer"},{"name":"BOI Payment Acceptance","type":"Acquirer"}],
    "Austria":             [{"name":"Adyen","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Concardis","type":"Acquirer"},{"name":"Worldline","type":"Acquirer"},{"name":"Hobex","type":"PSP"}],
    "Poland":              [{"name":"Przelewy24","type":"PSP"},{"name":"PayU","type":"PSP"},{"name":"Tpay","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Polcard","type":"Acquirer"}],
    "Czech Republic":      [{"name":"ČSOB","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"GoPay","type":"PSP"},{"name":"ComGate","type":"Gateway"}],
    "Hungary":             [{"name":"Stripe","type":"PSP"},{"name":"Barion","type":"PSP"},{"name":"OTP","type":"Acquirer"},{"name":"B-Payment","type":"Gateway"},{"name":"Borgun","type":"PSP"}],
    "Romania":             [{"name":"NETOPIA Payments","type":"PSP"},{"name":"EuPlatesc","type":"PSP"},{"name":"PayU","type":"PSP"},{"name":"MobilPay","type":"PSP"},{"name":"Stripe","type":"PSP"}],
    "Greece":              [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Viva Wallet","type":"PSP"},{"name":"Cardlink","type":"Acquirer"},{"name":"Alpha Bank","type":"Acquirer"}],
    "Ukraine":             [{"name":"LiqPay","type":"PSP"},{"name":"Fondy","type":"PSP"},{"name":"Portmone","type":"PSP"},{"name":"iPay.ua","type":"PSP"},{"name":"Privat24","type":"Gateway"}],
    "Bulgaria":            [{"name":"ePay","type":"PSP"},{"name":"MyPOS","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Borica","type":"Acquirer"},{"name":"Bcap","type":"Gateway"}],
    "Croatia":             [{"name":"WSPay","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"CorvusPay","type":"PSP"},{"name":"PBZ Card","type":"Acquirer"},{"name":"Erste Card","type":"Acquirer"}],
    "Slovakia":            [{"name":"Tatra banka","type":"Acquirer"},{"name":"VÚB","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"GP webpay","type":"Gateway"},{"name":"24-pay","type":"PSP"}],
    "Slovenia":            [{"name":"Bankart","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Nexi","type":"Acquirer"},{"name":"Hal E-Bank","type":"Gateway"},{"name":"Activa Pay","type":"PSP"}],
    "Estonia":             [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Maksekeskus","type":"PSP"},{"name":"SEB Pank","type":"Acquirer"},{"name":"Swedbank","type":"Acquirer"}],
    "Latvia":              [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Maksekeskus","type":"PSP"},{"name":"Citadele","type":"Acquirer"},{"name":"Swedbank","type":"Acquirer"}],
    "Lithuania":           [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Paysera","type":"PSP"},{"name":"SEB Lietuva","type":"Acquirer"},{"name":"Swedbank","type":"Acquirer"}],
    "Luxembourg":          [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Worldline","type":"Acquirer"},{"name":"Saferpay","type":"Gateway"},{"name":"POST Luxembourg","type":"Acquirer"}],
    "Iceland":             [{"name":"Borgun","type":"Acquirer"},{"name":"Valitor","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Korta","type":"Acquirer"},{"name":"Saltpay","type":"Acquirer"}],
    "Cyprus":              [{"name":"JCC","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"Pay24-7","type":"PSP"},{"name":"Bank of Cyprus","type":"Acquirer"},{"name":"Hellenic Bank","type":"Acquirer"}],
    "Malta":               [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"APCO Pay","type":"PSP"},{"name":"Truevo","type":"Acquirer"},{"name":"BOV","type":"Acquirer"}],
    "Serbia":              [{"name":"Banca Intesa","type":"Acquirer"},{"name":"Komercijalna Banka","type":"Acquirer"},{"name":"AllSecure","type":"PSP"},{"name":"Monri","type":"PSP"},{"name":"Stripe","type":"PSP"}],
    # ---- Middle East ----
    "UAE":                 [{"name":"Network International","type":"Acquirer"},{"name":"PayTabs","type":"PSP"},{"name":"Telr","type":"PSP"},{"name":"Checkout.com","type":"PSP"},{"name":"Stripe","type":"PSP"}],
    "Saudi Arabia":        [{"name":"HyperPay","type":"PSP"},{"name":"PayTabs","type":"PSP"},{"name":"Moyasar","type":"PSP"},{"name":"Geidea","type":"Acquirer"},{"name":"Network International","type":"Acquirer"}],
    "Israel":              [{"name":"Tranzila","type":"PSP"},{"name":"Cardcom","type":"PSP"},{"name":"PayPlus","type":"PSP"},{"name":"Isracard","type":"Acquirer"},{"name":"Bank Hapoalim","type":"Acquirer"}],
    "Turkey":              [{"name":"iyzico","type":"PSP"},{"name":"PayTR","type":"PSP"},{"name":"BKM","type":"Gateway"},{"name":"İşbank","type":"Acquirer"},{"name":"Garanti","type":"Acquirer"}],
    "Qatar":               [{"name":"QPay","type":"PSP"},{"name":"CWallet","type":"PSP"},{"name":"Network International","type":"Acquirer"},{"name":"QIB","type":"Acquirer"},{"name":"QNB","type":"Acquirer"}],
    "Kuwait":              [{"name":"KNet","type":"Acquirer"},{"name":"Hesabe","type":"PSP"},{"name":"Tap Payments","type":"PSP"},{"name":"MyFatoorah","type":"PSP"},{"name":"Burgan Bank","type":"Acquirer"}],
    "Bahrain":             [{"name":"BENEFIT","type":"Acquirer"},{"name":"Tap Payments","type":"PSP"},{"name":"Network International","type":"Acquirer"},{"name":"Eazy Pay","type":"Gateway"},{"name":"NBB","type":"Acquirer"}],
    "Oman":                [{"name":"OmanNet","type":"Acquirer"},{"name":"Thawani","type":"PSP"},{"name":"Bank Muscat","type":"Acquirer"},{"name":"HSBC Oman","type":"Acquirer"},{"name":"NBO","type":"Acquirer"}],
    "Jordan":              [{"name":"HyperPay","type":"PSP"},{"name":"MadfoatCom","type":"PSP"},{"name":"JoMoPay","type":"Gateway"},{"name":"CAB","type":"Acquirer"},{"name":"Arab Bank","type":"Acquirer"}],
    "Lebanon":             [{"name":"Areeba","type":"Acquirer"},{"name":"Bank Audi","type":"Acquirer"},{"name":"BLF","type":"Acquirer"},{"name":"Cliq Pay","type":"PSP"},{"name":"NeoBank","type":"PSP"}],
    "Iraq":                [{"name":"Switch","type":"Acquirer"},{"name":"Qi Card","type":"Acquirer"},{"name":"KI Card","type":"Acquirer"},{"name":"TBI Pay","type":"PSP"},{"name":"NameCard","type":"PSP"}],
    "Egypt":               [{"name":"Fawry","type":"PSP"},{"name":"Paymob","type":"PSP"},{"name":"HyperPay","type":"PSP"},{"name":"CIB","type":"Acquirer"},{"name":"NBE","type":"Acquirer"}],
    # ---- APAC ----
    "Singapore":           [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"2C2P","type":"PSP"},{"name":"DBS","type":"Acquirer"},{"name":"NETS","type":"Acquirer"}],
    "Japan":               [{"name":"GMO Payment Gateway","type":"Gateway"},{"name":"SBI Payment Services","type":"PSP"},{"name":"Sony Payment Services","type":"PSP"},{"name":"Komoju","type":"Gateway"},{"name":"JCB","type":"Acquirer"}],
    "South Korea":         [{"name":"KG Inicis","type":"PSP"},{"name":"NHN KCP","type":"PSP"},{"name":"Toss Payments","type":"PSP"},{"name":"Settlebank","type":"Gateway"},{"name":"KICC","type":"Acquirer"}],
    "Hong Kong":           [{"name":"AsiaPay","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"HSBC Merchant Services","type":"Acquirer"},{"name":"NETS","type":"Acquirer"}],
    "China":               [{"name":"China UnionPay","type":"Acquirer"},{"name":"AsiaPay","type":"PSP"},{"name":"TenPay","type":"Gateway"},{"name":"ICBC","type":"Acquirer"},{"name":"Bank of China","type":"Acquirer"}],
    "Taiwan":              [{"name":"ECPay","type":"PSP"},{"name":"NewebPay","type":"PSP"},{"name":"Allpay","type":"PSP"},{"name":"CTBC Bank","type":"Acquirer"},{"name":"Citi Taiwan","type":"Acquirer"}],
    "Indonesia":           [{"name":"Xendit","type":"PSP"},{"name":"Midtrans","type":"PSP"},{"name":"DOKU","type":"PSP"},{"name":"Faspay","type":"Gateway"},{"name":"BCA","type":"Acquirer"}],
    "Thailand":            [{"name":"2C2P","type":"PSP"},{"name":"Omise","type":"PSP"},{"name":"Pay Solutions","type":"PSP"},{"name":"KBank","type":"Acquirer"},{"name":"SCB","type":"Acquirer"}],
    "Philippines":         [{"name":"PayMongo","type":"PSP"},{"name":"Maya Business","type":"PSP"},{"name":"DragonPay","type":"PSP"},{"name":"AsiaPay","type":"PSP"},{"name":"BDO","type":"Acquirer"}],
    "Vietnam":             [{"name":"VNPay","type":"PSP"},{"name":"OnePay","type":"Gateway"},{"name":"Bao Kim","type":"PSP"},{"name":"Napas","type":"Gateway"},{"name":"Vietcombank","type":"Acquirer"}],
    "Malaysia":            [{"name":"iPay88","type":"PSP"},{"name":"Razer Merchant Services","type":"PSP"},{"name":"Stripe","type":"PSP"},{"name":"Maybank","type":"Acquirer"},{"name":"CIMB","type":"Acquirer"}],
    "Australia":           [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"eWay","type":"PSP"},{"name":"Commonwealth Bank","type":"Acquirer"},{"name":"Tyro","type":"Acquirer"}],
    "New Zealand":         [{"name":"Stripe","type":"PSP"},{"name":"Adyen","type":"PSP"},{"name":"Windcave","type":"PSP"},{"name":"Worldline NZ","type":"Acquirer"},{"name":"ANZ Merchant Services","type":"Acquirer"}],
    "Bangladesh":          [{"name":"SSL Wireless","type":"PSP"},{"name":"aamarPay","type":"PSP"},{"name":"Surjopay","type":"PSP"},{"name":"DBBL","type":"Acquirer"},{"name":"BRAC Bank","type":"Acquirer"}],
    "Pakistan":            [{"name":"1Link","type":"Acquirer"},{"name":"HBL Konnect","type":"Acquirer"},{"name":"Bank Alfalah","type":"Acquirer"},{"name":"PayFast PK","type":"PSP"},{"name":"Jingle Pay","type":"PSP"}],
    "Sri Lanka":           [{"name":"DirectPay","type":"PSP"},{"name":"Frimi","type":"PSP"},{"name":"PayHere","type":"PSP"},{"name":"Commercial Bank","type":"Acquirer"},{"name":"HNB","type":"Acquirer"}],
    "Nepal":               [{"name":"Khalti","type":"PSP"},{"name":"FonePay","type":"Gateway"},{"name":"IME Pay","type":"PSP"},{"name":"NIBL","type":"Acquirer"},{"name":"Sanima Bank","type":"Acquirer"}],
    "Cambodia":            [{"name":"Bakong","type":"Gateway"},{"name":"ABA Bank","type":"Acquirer"},{"name":"Acleda Bank","type":"Acquirer"},{"name":"Wing","type":"PSP"},{"name":"Pi Pay","type":"PSP"}],
    "Myanmar":             [{"name":"MPU","type":"Acquirer"},{"name":"2C2P","type":"PSP"},{"name":"OnePay Myanmar","type":"PSP"},{"name":"Wave Money","type":"PSP"},{"name":"KBZ Bank","type":"Acquirer"}],
    # ---- Africa ----
    "South Africa":        [{"name":"PayFast","type":"PSP"},{"name":"Yoco","type":"Acquirer"},{"name":"Adumo","type":"PSP"},{"name":"Standard Bank","type":"Acquirer"},{"name":"FNB Merchant Services","type":"Acquirer"}],
    "Nigeria":             [{"name":"Paystack","type":"PSP"},{"name":"Flutterwave","type":"PSP"},{"name":"Interswitch","type":"PSP"},{"name":"Remita","type":"Gateway"},{"name":"GTBank","type":"Acquirer"}],
    "Kenya":               [{"name":"Pesapal","type":"PSP"},{"name":"DPO Group","type":"PSP"},{"name":"Cellulant","type":"Gateway"},{"name":"KCB Bank","type":"Acquirer"},{"name":"Equity Bank","type":"Acquirer"}],
    "Morocco":             [{"name":"CMI","type":"Acquirer"},{"name":"Maroc Telecommerce","type":"Gateway"},{"name":"HPS","type":"PSP"},{"name":"AmanePay","type":"PSP"},{"name":"Cash Plus","type":"PSP"}],
    "Ghana":               [{"name":"Hubtel","type":"PSP"},{"name":"ExpressPay","type":"PSP"},{"name":"Paystack","type":"PSP"},{"name":"Flutterwave","type":"PSP"},{"name":"GCB Bank","type":"Acquirer"}],
    "Ethiopia":            [{"name":"ChaPa","type":"PSP"},{"name":"Cooperative Bank","type":"Acquirer"},{"name":"CBE","type":"Acquirer"},{"name":"Awash Bank","type":"Acquirer"},{"name":"Dashen Bank","type":"Acquirer"}],
    "Tanzania":            [{"name":"Selcom","type":"PSP"},{"name":"Pesapal","type":"PSP"},{"name":"DPO Group","type":"PSP"},{"name":"CRDB Bank","type":"Acquirer"},{"name":"NMB","type":"Acquirer"}],
    "Uganda":              [{"name":"Pesapal","type":"PSP"},{"name":"Flutterwave","type":"PSP"},{"name":"DPO Group","type":"PSP"},{"name":"Stanbic","type":"Acquirer"},{"name":"Centenary Bank","type":"Acquirer"}],
    "Algeria":             [{"name":"SATIM","type":"Acquirer"},{"name":"CIB Algeria","type":"Acquirer"},{"name":"Algerie Poste","type":"Acquirer"},{"name":"BEA","type":"Acquirer"},{"name":"BNA","type":"Acquirer"}],
    "Tunisia":             [{"name":"Click to Pay","type":"PSP"},{"name":"Konnect","type":"PSP"},{"name":"Flouci","type":"PSP"},{"name":"STB","type":"Acquirer"},{"name":"BIAT","type":"Acquirer"}],
    "Senegal":             [{"name":"PayDunya","type":"PSP"},{"name":"CinetPay","type":"PSP"},{"name":"InTouch","type":"PSP"},{"name":"CBAO","type":"Acquirer"},{"name":"SGBS","type":"Acquirer"}],
    "Côte d'Ivoire":       [{"name":"PayDunya","type":"PSP"},{"name":"CinetPay","type":"PSP"},{"name":"Wave Business","type":"PSP"},{"name":"SGCI","type":"Acquirer"},{"name":"BICICI","type":"Acquirer"}],
    "Cameroon":            [{"name":"PayDunya","type":"PSP"},{"name":"CinetPay","type":"PSP"},{"name":"MFS Africa","type":"PSP"},{"name":"Afriland First Bank","type":"Acquirer"},{"name":"SGC","type":"Acquirer"}],
    "Angola":              [{"name":"Multicaixa Express","type":"Acquirer"},{"name":"EMIS","type":"Acquirer"},{"name":"BAI","type":"Acquirer"},{"name":"BFA","type":"Acquirer"},{"name":"BPC","type":"Acquirer"}],
    "Mozambique":          [{"name":"MozaPag","type":"PSP"},{"name":"Conecta","type":"PSP"},{"name":"Standard Bank","type":"Acquirer"},{"name":"BCI","type":"Acquirer"},{"name":"Millennium BIM","type":"Acquirer"}],
    "Zimbabwe":            [{"name":"Paynow","type":"PSP"},{"name":"CBZ","type":"Acquirer"},{"name":"Stanbic Zim","type":"Acquirer"},{"name":"ZimSwitch","type":"Acquirer"},{"name":"FBC","type":"Acquirer"}],
    "Botswana":            [{"name":"BancABC","type":"Acquirer"},{"name":"Stanbic","type":"Acquirer"},{"name":"FNB Botswana","type":"Acquirer"},{"name":"Smart Switch","type":"Gateway"},{"name":"Standard Chartered","type":"Acquirer"}],
    "Mauritius":           [{"name":"MIPS","type":"PSP"},{"name":"Mauritius Commercial Bank","type":"Acquirer"},{"name":"Stripe","type":"PSP"},{"name":"MauBank","type":"Acquirer"},{"name":"SBM","type":"Acquirer"}],
    "Rwanda":              [{"name":"Pesapal","type":"PSP"},{"name":"Flutterwave","type":"PSP"},{"name":"BPR","type":"Acquirer"},{"name":"Bank of Kigali","type":"Acquirer"},{"name":"I&M Bank","type":"Acquirer"}],
    "Zambia":              [{"name":"Tingg","type":"PSP"},{"name":"Pesapal","type":"PSP"},{"name":"Standard Chartered","type":"Acquirer"},{"name":"Stanbic","type":"Acquirer"},{"name":"Zanaco","type":"Acquirer"}],
}

def default_country_detail():
    """Generic rich-detail template used when a country has no curated entry yet."""
    return {
        "overview": {
            "Population (2024)":                 "N/A",
            "GDP nominal (2024)":                "N/A",
            "Ecommerce market (2026e)":          "N/A",
            "Online users (2024)":               "N/A",
            "Internet penetration (2024)":       "N/A",
            "Smartphone penetration (2024)":     "N/A",
            "In-Store : Ecommerce ratio (2024)": "N/A",
        },
        "local_payments": {
            "scheme": "N/A",
            "a2a":    "N/A",
            "apms":   [],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards",                "share": 50, "growth": "N/A"},
            {"name": "Debit Cards / Prepaid Cards", "share": 25, "growth": "N/A"},
            {"name": "A2A",                         "share": 15, "growth": "N/A"},
            {"name": "Cash on Delivery",            "share": 10, "growth": "N/A"},
        ],
        "partners_landscape": [],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
        "digital_trends": [
            "Digital trends for this market are not yet available — data coming soon.",
        ],
        "regulation": [
            "Regulation overview for this market is not yet available — data coming soon.",
        ],
    }


_MONTH_ABBR = {m: i for i, m in enumerate(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], start=1)}

def _parse_news_date(s: str):
    """Parse digest-style dates: 'Mar 2026', 'Apr 1, 2026', '2025'."""
    s = (s or "").strip()
    m = re.match(r"^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$", s)
    if m:
        return date(int(m.group(3)), _MONTH_ABBR[m.group(1).title()], int(m.group(2)))
    m = re.match(r"^([A-Za-z]{3})\s+(\d{4})$", s)
    if m:
        return date(int(m.group(2)), _MONTH_ABBR[m.group(1).title()], 1)
    m = re.match(r"^(\d{4})$", s)
    if m:
        return date(int(m.group(1)), 1, 1)
    return None

REGION_NEWS = {
    "Africa": [
        {"category":"PARTNERSHIP","date":"Jan 2026","title":"Flutterwave acquires Nigerian open banking startup Mono","summary":"All-stock deal valued at $25–40M. Africa's largest fintech consolidating open banking capabilities — push toward full-stack payment infrastructure dominance.","url":"https://techcrunch.com/2026/01/05/flutterwave-buys-nigerias-mono-in-rare-african-fintech-exit/"},
        {"category":"MARKET","date":"Mar 2026","title":"PayPal targets Africa with new cross-border digital wallet in 2026","summary":"PayPal entering African market with a dedicated cross-border wallet. Watch for impact on existing APM and remittance partner relationships.","url":"https://thepaypers.com/payments/news/paypal-sets-sights-on-africa-with-2026-wallet-launch"},
        {"category":"REGULATION","date":"Mar 2026","title":"EU-Africa PSP regulatory pilot frameworks expected by late 2026","summary":"Regulators moving toward geo-fenced PSP authorizations. EU-Africa pilot collaboration could unlock new cross-border licensing paths for PSP partners.","url":"https://fintechnews.africa/44236/fintech-south-africa/top-fintech-startups-in-south-africa/"},
        {"category":"PRODUCT","date":"Feb 2026","title":"Ozow integrates crypto as a primary payment method for merchants","summary":"South African PSP Ozow now enables merchants to accept crypto via Bitcoin-centric providers. Growing APM ecosystem in Africa creating new integration opportunities.","url":"https://fintechnews.africa/44236/fintech-south-africa/top-fintech-startups-in-south-africa/"},
    ],
    "APAC": [
        {"category":"MARKET","date":"Mar 2026","title":"India UPI hits record 20.7 billion transactions in a single month","summary":"UPI processed 20.7B transactions in October 2025 — the global benchmark for real-time payment scale. Major implications for cross-border corridors.","url":"https://fintechnews.sg/123084/payments/asia-pacific-digital-payments/"},
        {"category":"REGULATION","date":"Mar 2026","title":"Thailand approves first 3 virtual banks — go-live expected mid-2026","summary":"New digital-native banks entering the Thai market will need payment infrastructure partners. Window to establish relationships before they launch.","url":"https://fintechnews.sg/123084/payments/asia-pacific-digital-payments/"},
        {"category":"REGULATION","date":"Mar 2026","title":"Singapore, HK and Japan advance stablecoin frameworks — institutional adoption rising","summary":"New regulatory frameworks for stablecoins and tokenized assets in three major APAC hubs. PSP and scheme partners need to prepare for digital asset payment flows.","url":"https://panafricanvisions.com/2026/03/money20-20-asia-report-apac-fintech-ecosystem-shifts-from-experimentation-to-scale-as-ai-and-digital-assets-drive-regional-leadership/"},
        {"category":"MARKET","date":"Mar 2026","title":"Southeast Asia is APAC's #1 growth target — SME fintech solutions in focus","summary":"22.9% of APAC fintechs cite SEA as primary growth target. 72.9% see SME-tailored solutions as key driver. Strong demand for embedded payment infrastructure.","url":"https://www.blockhead.co/2026/03/04/southeast-asia-leads-expansion-as-apac-fintech-prioritizes-ai-inclusion-and-fraud-resilience/"},
    ],
    "Europe": [
        {"category":"REGULATION","date":"Mar 2026","title":"PSD3 / PSR — fraud rules and liability changes apply EU-wide simultaneously","summary":"Key provisions on fraud info-sharing, liability, and customer rights will apply at the same time across all EU countries. All PSP and acquirer partners must comply.","url":"https://www.flagright.com/post/impact-of-payment-services-directive-3-psr-on-payment-processors"},
        {"category":"REGULATION","date":"Mar 2026","title":"ECB opens call for PSPs to join Digital Euro pilot (H2 2027)","summary":"12-month Digital Euro pilot launching second half of 2027. PSP partners that get in early will have first-mover advantage in the European CBDC ecosystem.","url":"https://www.ecb.europa.eu/press/intro/news/html/ecb.mipnews260305.en.html"},
        {"category":"MARKET","date":"Feb 2026","title":"Acquirer M&A accelerating — Global Payments buys takepayments, TokenEx merges with IXOPAY","summary":"Fewer acquirers = more single-point-of-failure risk for merchants. Demand for orchestration and fallback routing is surging across Europe.","url":"https://businessofpayments.substack.com/p/business-of-payments-january-2026"},
        {"category":"PRODUCT","date":"Mar 2026","title":"Wero wallet expands to Netherlands and Luxembourg — Airwallex, Unzer, PPRO join","summary":"European wallet broadening reach. New integrations include Airwallex, Unzer, PPRO, and Raiffeisen (Austria). Merchant acceptance growing rapidly.","url":"https://www.euroshop-tradefair.com/en/media-news/euroshopmag/retail-technology/wero-in-retail-what-merchants-need-to-know-now-about-europes-new-wallet"},
    ],
    "LATAM": [
        {"category":"REGULATION","date":"Oct 2026","title":"Mexico Fintech Law 2.0 update — PSPs and wallets impacted","summary":"Major regulatory refresh due October 2026. Partners operating in Mexico must prepare for new compliance requirements around wallets and payment initiators.","url":"https://eduardomoore.substack.com/p/latam-fintech-trends-for-2026"},
        {"category":"REGULATION","date":"Jan 2026","title":"Brazil BCB raises PSP licensing thresholds — consolidation ahead","summary":"PSPs must now reach BRL 200M in transactions or BRL 20M in prepaid accounts to maintain authorization. Smaller players may exit or merge.","url":"https://www.bcb.gov.br/en"},
        {"category":"MARKET","date":"Mar 2026","title":"Brazil PIX and Open Finance converging — banks and fintechs building shared infra","summary":"Open Finance is enabling credit scoring for underserved segments. The line between fintechs and legacy banks is rapidly blurring.","url":"https://www.galileo-ft.com/blog/latam-banking-2026-digital-payments-inclusion-convergence/"},
        {"category":"REGULATION","date":"Mar 2026","title":"Peru formally includes fintechs and wallets in national payment system","summary":"Peru's updated framework now incorporates fintechs, wallets, and payment initiators — new licensing path and partnership angle in the market.","url":"https://eduardomoore.substack.com/p/latam-fintech-trends-for-2026"},
        {"category":"MARKET","date":"Mar 2026","title":"Colombia and Peru building interoperable real-time payment frameworks","summary":"Both countries developing instant payment networks expected to formally include fintechs. New payment rails = new routing opportunities for Yuno partners.","url":"https://www.pymnts.com/news/international/latin-america/2026/latin-america-fintechs-digital-shift-endures-despite-regional-volatility"},
        {"category":"PARTNERSHIP","date":"Dec 2024","title":"PagBrasil becomes a licensed payment institution","summary":"PagBrasil received BCB authorization as an electronic money issuer — new capabilities for cross-border merchants entering Brazil.","url":"https://www.pagbrasil.com/blog/news/pagbrasil-is-now-a-payment-institution-what-changes-for-you/"},
        {"category":"FUNDING","date":"Jan 2026","title":"LatAm fintech VC rebounds — B2B infra and cross-border payments lead","summary":"Fintech led 61% of LatAm VC in 2025. 2026 focus shifts to later-stage, profitable B2B payment infrastructure and cross-border companies.","url":"https://www.crowdfundinsider.com/2026/01/257085-latam-startups-gear-up-for-a-2026-investment-revival-with-fintech-being-key-focus-area-analysis/"},
    ],
    "Middle East": [
        {"category":"REGULATION","date":"Sep 2025","title":"UAE CBUAE new Central Bank Law — PSPs must comply by September 2026","summary":"Federal Decree No. 6 of 2025 consolidated regulation of banks, PSPs, and insurers. All entities newly in scope must regularize licensing by September 16, 2026.","url":"https://www.whitecase.com/insight-alert/uae-enacts-new-cbuae-law-which-repeals-and-replaces-2018-law"},
        {"category":"ENFORCEMENT","date":"Mar 2026","title":"VARA orders KuCoin to halt crypto services in Dubai","summary":"Dubai's VARA confirmed KuCoin holds no authorization to provide digital asset services in or from Dubai. Multiple entities operating under the KuCoin brand were identified.","url":"https://coin360.com/news/dubai-vara-orders-kucoin-halt-unlicensed-crypto-services"},
        {"category":"ENFORCEMENT","date":"2025","title":"VARA sanctions 19 crypto firms — fines up to $163K, 2 exchanges suspended","summary":"Dubai's VARA fined 19 companies for operating without approval and suspended 2 exchanges for failing to maintain customer fund segregation. Enforcement is intensifying.","url":"https://finance.yahoo.com/news/dubai-regulator-vara-sanctions-19-144833305.html"},
        {"category":"REGULATION","date":"Mar 2026","title":"GCC and Egypt CBDC pilots modernizing payment rails","summary":"Regulatory sandboxes in KSA, UAE, and Jordan shortening product launch cycles. Saudi Vision 2030 driving massive financial services investment.","url":"https://thefintechtimes.com/mena-region-reaches-digital-economy-inflection-point-as-instant-payments-drive-growth/"},
        {"category":"MARKET","date":"Mar 2026","title":"MENA fintech hits $6.35B — North Africa fastest growing at 17% CAGR","summary":"Market projected to reach $11.46B by 2031. GCC holds 62% share but North Africa is the fastest growing segment — high-potential underserved territory.","url":"https://www.mordorintelligence.com/industry-reports/mena-fintech-market"},
        {"category":"FUNDING","date":"Jan 2026","title":"Abu Dhabi fintech Mal raises $230M seed — record for MENA region","summary":"Largest seed round ever recorded in MENA. Signals strong investor confidence in regional payment infrastructure. New well-funded players entering the space.","url":"https://fintechnews.ae/"},
    ],
    "North America": [
        {"category":"REGULATION","date":"Apr 1, 2026","title":"VAMP threshold drops to 1.5% on April 1 — acquirers must act now","summary":"Visa Acquirer Monitoring Program tightens fraud thresholds for US, Canada, and EU. Acquirer partners that miss this risk losing Visa privileges — urgent compliance deadline.","url":"https://optimizedpayments.com/insights/card-fees/visa-acquirer-monitoring-program-vamp-updated-2025-guide/"},
        {"category":"REGULATION","date":"Mar 2026","title":"Visa/Mastercard interchange fee settlement pending court approval","summary":"Settlement would cut interchange rates ~10bps on average, capped for 5 years. Major cost impact for acquirers and merchants. Could reshape partner pricing conversations.","url":"https://optimizedpayments.com/insights/industry-news/what-merchants-need-to-know-about-the-new-visa-mastercard-interchange-settlement/"},
        {"category":"SCHEME","date":"Mar 2026","title":"Visa and Mastercard racing to set agentic AI payment standards","summary":"Both schemes partnering with Stripe, Google, Adyen, Worldpay, Fiserv, and Checkout.com to define standards for AI-driven commerce. First movers will shape the next payment stack.","url":"https://www.paymentsdive.com/news/visa-mastercard-jockey-to-set-agentic-standards/813910/"},
        {"category":"PARTNERSHIP","date":"Mar 2026","title":"PayPal CEO exits — Stripe reportedly exploring acquisition","summary":"Alex Chriss out; Enrique Lores steps in March 1. Bloomberg reports Stripe exploring a PayPal acquisition. Major partnership uncertainty — monitor closely.","url":"https://www.bankingdive.com/news/who-could-swallow-paypal-stripe-apple-visa-mastercard-google-musk-adyen/813103/"},
        {"category":"MARKET","date":"Mar 2026","title":"LatAm VC rebound — payments and remittances lead in Central America","summary":"Fintech leading LatAm investment recovery. Central American corridors increasingly attractive for cross-border payments, remittances, and digital wallets for underserved populations.","url":"https://www.latintimes.com/fintech-set-lead-startup-investment-activity-latin-america-2026-report-592862"},
        {"category":"PARTNERSHIP","date":"Mar 2026","title":"Mastercard holds first Fintech Summit in the Caribbean","summary":"Event hosted in The Bahamas exploring financial inclusion across Caribbean economies. Mastercard pushing digital payment adoption in island markets with government backing.","url":"https://www.mastercard.com/news/latin-america/en"},
        {"category":"MARKET","date":"Mar 2026","title":"CoDi real-time payments gaining traction as mobile internet expands","summary":"Mexico's CoDi QR-based system growing adoption across Central America. A2A transfers and digital wallets scaling rapidly along key corridors.","url":"https://www.pymnts.com/news/international/latin-america/2026/latin-america-fintechs-digital-shift-endures-despite-regional-volatility"},
    ],
}

@app.get("/insights", response_class=HTMLResponse)
def insights(request: Request, country: str = "", region: str = "all", view: str = "country"):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if view not in ("country", "news", "regions"):
        view = "country"
    all_partners = load_partners_excel()
    raw_regions = set(p["region"] for p in all_partners if p.get("region"))
    regions = sorted(
        r for r in (raw_regions | INSIGHTS_EXTRA_REGIONS)
        if r and r.strip().lower() not in INSIGHTS_HIDDEN_REGIONS
    )
    all_countries = sorted(COUNTRIES.keys())
    if region != "all":
        visible_countries = sorted(c for c in all_countries if COUNTRY_TO_REGION.get(c) == region)
        if country and country not in visible_countries:
            country = ""
    else:
        visible_countries = all_countries
    has_market_data = bool(country) and country in COUNTRIES
    show_heatmap = (view == "country") and not country
    data = COUNTRIES.get(country) if has_market_data else None
    region_stats = {
        r: REGION_STATS.get(r, {"total":0,"live":0,"strategic":0,"tier1":0,"revshare":"-"})
        for r in regions
    }
    # Regions Decks always includes Global as its own card, even though
    # Global is hidden from the filter dropdown.
    deck_order = ["LATAM", "North America", "Europe", "Middle East", "Africa", "APAC", "Global"]
    deck_regions = [r for r in deck_order if r in regions or r == "Global"]
    deck_stats = {
        r: REGION_STATS.get(r, {"total":0,"live":0,"strategic":0,"tier1":0,"revshare":"-"})
        for r in deck_regions
    }
    heatmap_json = None
    if show_heatmap:
        if region == "all":
            items = sorted(ECOMMERCE_DEVELOPMENT_INDEX.items(), key=lambda kv: kv[0])
        else:
            items = sorted(
                ((c, v) for c, v in ECOMMERCE_DEVELOPMENT_INDEX.items()
                 if COUNTRY_TO_REGION.get(c) == region),
                key=lambda kv: kv[0],
            )
        locs = [c for c, _ in items]
        vals = [v for _, v in items]
        fig = go.Figure(go.Choropleth(
            locations=locs,
            z=vals,
            locationmode="country names",
            colorscale=[[0, "#eef2ff"], [0.5, "#818cf8"], [1, "#1e1b4b"]],
            zmin=0, zmax=100,
            marker_line_color="#ffffff", marker_line_width=0.4,
            colorbar=dict(title="Index", thickness=10, len=0.7),
            hovertemplate="<b>%{location}</b><br>Ecommerce development: %{z}/100<br><i>Click for market detail</i><extra></extra>",
        ))
        geo_kwargs = dict(
            showframe=False, showcoastlines=False, projection_type="natural earth",
            bgcolor="rgba(0,0,0,0)",
        )
        if region != "all" and locs:
            geo_kwargs["fitbounds"] = "locations"
            geo_kwargs["visible"] = True
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=0, r=0, t=0, b=0), height=520,
            geo=geo_kwargs,
            font=dict(family="Titillium Web", size=12, color="#0f172a"),
        )
        heatmap_json = fig.to_json()
    if has_market_data:
        override = COUNTRY_DETAIL_RICH.get(country, {})
        rich_country = {**default_country_detail(), **override}
        # Pull market players from COUNTRY_PARTNERS unless the country's override already provides them
        if "partners_landscape" not in override and country in COUNTRY_PARTNERS:
            rich_country["partners_landscape"] = COUNTRY_PARTNERS[country]
    else:
        rich_country = None
    if rich_country and rich_country.get("partners_landscape"):
        partners_lookup = {p.get("name", "").lower(): p for p in all_partners}
        signed_statuses = {"agreement signed", "live partner"}
        enriched = []
        for entry in rich_country["partners_landscape"]:
            p = partners_lookup.get(entry["name"].lower())
            enriched.append({
                "name":         entry["name"],
                "portfolio_name": p["name"] if p else None,
                "type":         entry["type"],
                "in_portfolio": p is not None,
                "signed":       bool(p and (p.get("status", "") or "").strip().lower() in signed_statuses),
                "live":         bool(p and (p.get("integration_stage", "") or "").strip().lower() == "live"),
            })
        live_partners_raw = (rich_country.get("yuno_coverage") or {}).get("Live partners", [])
        live_partners_enriched = []
        for name in live_partners_raw:
            p = partners_lookup.get(name.lower())
            live_partners_enriched.append({
                "name":           name,
                "portfolio_name": p["name"] if p else None,
                "in_portfolio":   p is not None,
            })
        new_yuno_coverage = {**(rich_country.get("yuno_coverage") or {}), "Live partners": live_partners_enriched}
        rich_country = {**rich_country, "partners_landscape": enriched, "yuno_coverage": new_yuno_coverage}
    # Build news sections: only regions currently visible in the filter,
    # limited to items from the last ~3 months, with external search URLs.
    if region != "all":
        target_news_regions = [region]
    else:
        target_news_regions = regions
    today = date.today()
    cutoff_year, cutoff_month = today.year, today.month - 3
    while cutoff_month <= 0:
        cutoff_month += 12
        cutoff_year -= 1
    news_sections = []
    for r in target_news_regions:
        items = []
        for it in REGION_NEWS.get(r, []):
            d = _parse_news_date(it["date"])
            if d is None:
                continue
            ym = (d.year, d.month)
            if ym < (cutoff_year, cutoff_month) or ym > (today.year, today.month):
                continue
            items.append(it)
        if items:
            news_sections.append((r, items))
    return tr(request, "insights.html", ctx(
        request, "insights",
        countries=visible_countries,
        all_countries=all_countries,
        regions=regions,
        region_stats=region_stats,
        deck_stats=deck_stats,
        country_to_region=COUNTRY_TO_REGION,
        country_iso=COUNTRY_ISO,
        selected=country,
        selected_region=region,
        view=view,
        data=data,
        rich=rich_country,
        show_heatmap=show_heatmap,
        heatmap_chart=heatmap_json,
        has_market_data=has_market_data,
        news_sections=news_sections,
    ))

@app.get("/merch_sim", response_class=HTMLResponse)
def merch_sim(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if role != "internal":
        return RedirectResponse("/home")
    sot_countries = get_sot_countries()
    sot_providers = get_sot_providers()
    return tr(request, "merch_sim.html", ctx(
        request, "merch_sim",
        merchants=MERCHANTS,
        sot_countries=sot_countries,
        sot_providers=sot_providers,
        verticals=list(_VERTICAL_COLS.keys()),
    ))

# -- AI Search ----------------------------------------------------------------

@app.post("/api/ai_search")
async def ai_search(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse({"filters": {}, "explanation": ""})

    all_partners = load_partners_excel()
    cats     = sorted(set(p["type"]    for p in all_partners if p["type"]))
    regions  = sorted(set(p["region"]  for p in all_partners if p["region"]))
    countries= sorted(set(p["country"] for p in all_partners if p.get("country")))
    statuses = sorted(set(p["status"]  for p in all_partners if p["status"]))
    tiers    = sorted(set(p["tier"]    for p in all_partners if p.get("tier")))
    managers = sorted(set(p["manager"] for p in all_partners if p.get("manager")))
    names    = sorted(set(p["name"]    for p in all_partners))

    import anthropic, json as _json
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    system = f"""You are a filter assistant for Yuno's payment partner portal.
Given a natural language query, extract filter criteria and return ONLY valid JSON.

Available values:
- types: {cats}
- regions: {regions}
- countries: {countries}
- statuses: {statuses}
- tiers: {tiers}
- managers: {managers}
- connector names: {names}

Return ONLY a JSON object (no markdown, no explanation outside JSON):
{{
  "connector": [],   // exact names from connector names list
  "cat": [],         // from types list
  "region": [],      // from regions list
  "country": [],     // from countries list
  "status": [],      // from statuses list
  "tier": [],        // from tiers list
  "manager": [],     // from managers list (lowercase)
  "explanation": ""  // 1 sentence: what you found/applied
}}
If a filter has no match, return empty array. Match loosely (e.g. "china" -> "China")."""

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": query}]
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        filters = _json.loads(raw.strip())
        if filters.get("manager"):
            filters["manager"] = [m.lower() for m in filters["manager"]]
        return JSONResponse({"filters": filters, "explanation": filters.pop("explanation", "")})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# -- API endpoints -------------------------------------------------------------

@app.get("/api/partners")
def api_partners(request: Request, q: str = "", cat: str = "all", status: str = "all", region: str = "all"):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    all_partners = load_partners_excel()
    filtered = all_partners
    if q:
        ql = q.lower()
        filtered = [p for p in filtered if ql in p["name"].lower()]
    if cat != "all":
        filtered = [p for p in filtered if p["type"] == cat]
    if status != "all":
        filtered = [p for p in filtered if p["status"] == status]
    if region != "all":
        filtered = [p for p in filtered if p["region"] == region]
    return JSONResponse({"partners": filtered, "total": len(filtered)})

@app.post("/api/merch_sim")
async def api_merch_sim(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    merchant_name = body.get("merchant")
    country_name = body.get("country")
    add_partner = body.get("partner")
    merchant = next((m for m in MERCHANTS if m["name"] == merchant_name), None)
    if not merchant:
        return JSONResponse({"error": "merchant not found"}, status_code=404)
    country_iso = next((k for k,v in _ISO_TO_COUNTRY.items() if v == country_name), None)
    partner_matches = find_partners(country_iso=country_iso, live_only=True) if country_iso else []
    partner_match = next((p for p in partner_matches if p["name"] == add_partner), None)
    ar_boost = 2.8 if partner_match else 1.5
    new_ar = min(merchant["ar"] + ar_boost, 99.5)
    failed_txn = int(merchant["txn_mo"] * (1 - merchant["ar"] / 100))
    recovered = int(failed_txn * (ar_boost / 100) * 0.65)
    revenue = recovered * merchant["aov"] * 0.012
    return JSONResponse({
        "new_ar": round(new_ar, 1),
        "ar_boost": round(ar_boost, 1),
        "recovered_txn": recovered,
        "revenue_gain": round(revenue),
        "total_providers": len(merchant["providers"]) + 1,
        "partner_found": bool(partner_match),
    })

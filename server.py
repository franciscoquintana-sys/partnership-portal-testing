import os, json
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
def partner_detail(request: Request, name: str, ref: str = ""):
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
    "Brazil": "Brazil",
    "Mexico": "LATAM", "Colombia": "LATAM", "Argentina": "LATAM", "Chile": "LATAM", "Peru": "LATAM",
    "UAE": "EMEA", "Saudi Arabia": "EMEA",
    "India": "APAC", "Singapore": "APAC",
}

LATEST_NEWS = {
    "Brazil":       [{"date":"2026-04-15","title":"BACEN expands PIX limits for businesses","src":"Reuters"},{"date":"2026-04-08","title":"Pagar.me launches new acquiring API","src":"Valor"}],
    "Mexico":       [{"date":"2026-04-12","title":"CoDi reform pushed to Q3 2026","src":"El Economista"},{"date":"2026-03-30","title":"Conekta partners with Banorte","src":"Expansión"}],
    "Colombia":     [{"date":"2026-04-10","title":"Bre-B instant payments rail goes live","src":"La República"}],
    "Argentina":    [{"date":"2026-04-05","title":"BCRA eases FX for digital exporters","src":"Ámbito"}],
    "Chile":        [{"date":"2026-04-02","title":"CMF opens fintech licensing window","src":"Diario Financiero"}],
    "Peru":         [{"date":"2026-03-28","title":"Yape and Plin reach interoperability","src":"Gestión"}],
    "UAE":          [{"date":"2026-04-14","title":"CBUAE issues stablecoin framework","src":"The National"}],
    "Saudi Arabia": [{"date":"2026-04-11","title":"SAMA approves three new fintech licenses","src":"Arab News"}],
    "India":        [{"date":"2026-04-16","title":"RBI raises UPI per-merchant limits","src":"Mint"}],
    "Singapore":    [{"date":"2026-04-09","title":"MAS finalises e-money ringfencing rules","src":"Straits Times"}],
}

@app.get("/insights", response_class=HTMLResponse)
def insights(request: Request, country: str = "Brazil", region: str = "all"):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    all_countries = list(COUNTRIES.keys())
    if region != "all":
        visible_countries = [c for c in all_countries if COUNTRY_TO_REGION.get(c) == region]
        if country not in visible_countries and visible_countries:
            country = visible_countries[0]
    else:
        visible_countries = all_countries
    data = COUNTRIES.get(country, COUNTRIES["Brazil"])
    regions = sorted(set(COUNTRY_TO_REGION.values()))
    return tr(request, "insights.html", ctx(
        request, "insights",
        countries=visible_countries,
        all_countries=all_countries,
        regions=regions,
        region_stats=REGION_STATS,
        country_to_region=COUNTRY_TO_REGION,
        selected=country,
        selected_region=region,
        data=data,
        news=LATEST_NEWS.get(country, []),
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

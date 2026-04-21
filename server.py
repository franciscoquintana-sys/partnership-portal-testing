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
    # Behind Railway's proxy, request.url_for may generate the internal host.
    # Allow an env-var override so the redirect URI matches what's registered
    # in Google Cloud Console exactly.
    redirect_uri = os.environ.get("OAUTH_REDIRECT_URI") or str(request.url_for("auth_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)

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
    columns = [
        {"key": k, "title": t, "color": c,
         "cards": [l for l in LEADS if l.get("column") == k]}
        for k, t, c in LEAD_COLUMNS
    ]
    board_partners = sorted({(l.get("partner") or "").strip() for l in LEADS if (l.get("partner") or "").strip()})
    try:
        all_partners_rows = load_partners_excel()
        partner_catalog = sorted({p["name"] for p in all_partners_rows if p.get("name")})
    except Exception:
        partner_catalog = []
    return tr(request, "pipeline.html", ctx(
        request, "pipeline",
        columns=columns,
        all_leads=LEADS,
        board_partners=board_partners,
        partner_catalog=partner_catalog,
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

INTRO_COLUMNS = [
    ("request-pricing",      "Request Pricing",          "#6b7280"),
    ("in-negotiations",      "In Negotiations",          "#3b82f6"),
    ("sign-agreement",       "Signed an Agreement",      "#8b5cf6"),
    ("live",                 "Live",                     "#10b981"),
    ("on-hold",              "On Hold",                  "#0891b2"),
    ("merchant-didnt",       "Merchant didn't Continue", "#f59e0b"),
    ("partner-declined",     "Declined by Partner",      "#ef4444"),
]
_VALID_COLUMNS = {c[0] for c in INTRO_COLUMNS}
_INTRO_FIELDS = {
    "merchant", "partner", "partnership_manager", "vertical",
    "legal_entity_countries", "operation_countries",
    "requesting_countries", "transaction_type", "payment_flow",
    "payment_methods", "avg_ticket", "monthly_tpv", "comments",
}

# Persist intros to Postgres when DATABASE_URL is set (Railway auto-injects this
# when a Postgres service is linked). Otherwise fall back to a JSON file — on the
# mounted /data volume if available, else repo root (fine for local dev).
DATA_DIR = os.environ.get("DATA_DIR") or ("/data" if os.path.isdir("/data") else BASE)
os.makedirs(DATA_DIR, exist_ok=True)
INTROS_STORAGE = os.path.join(DATA_DIR, "intros.json")

def _default_intros():
    return []

def _db_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    try:
        import psycopg2
        return psycopg2.connect(url)
    except Exception as e:
        print(f"[intros] Postgres connect failed: {e}")
        return None

def _db_init():
    conn = _db_conn()
    if not conn:
        return False
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS intros (
                    id TEXT PRIMARY KEY,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        return True
    except Exception as e:
        print(f"[intros] Postgres init failed: {e}")
        return False
    finally:
        conn.close()

def _load_intros():
    conn = _db_conn()
    if conn:
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT data FROM intros ORDER BY updated_at ASC")
                rows = cur.fetchall()
                return [r[0] for r in rows]
        except Exception as e:
            print(f"[intros] Postgres load failed: {e}")
        finally:
            conn.close()
    # JSON fallback
    try:
        with open(INTROS_STORAGE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return _default_intros()

def _save_intros(data):
    conn = _db_conn()
    if conn:
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT id FROM intros")
                existing = {r[0] for r in cur.fetchall()}
                current = {i["id"] for i in data}
                for removed_id in existing - current:
                    cur.execute("DELETE FROM intros WHERE id = %s", (removed_id,))
                for intro in data:
                    cur.execute("""
                        INSERT INTO intros (id, data, updated_at)
                        VALUES (%s, %s::jsonb, NOW())
                        ON CONFLICT (id) DO UPDATE
                          SET data = EXCLUDED.data, updated_at = NOW()
                    """, (intro["id"], json.dumps(intro, ensure_ascii=False)))
            return
        except Exception as e:
            print(f"[intros] Postgres save failed: {e}")
        finally:
            conn.close()
    # JSON fallback
    try:
        with open(INTROS_STORAGE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[intros] JSON save failed: {e}")

_db_init()
INTROS = _load_intros()

@app.get("/introduction", response_class=HTMLResponse)
def introduction(request: Request):
    role = require_auth(request)
    if not role:
        return RedirectResponse("/login")
    if role != "internal":
        return RedirectResponse("/home")
    columns = [
        {"key": k, "title": t, "color": c,
         "cards": [i for i in INTROS if i.get("column") == k]}
        for k, t, c in INTRO_COLUMNS
    ]
    # Partners currently on the board (deduped, sorted) for the filter
    board_partners = sorted({(i.get("partner") or "").strip() for i in INTROS if (i.get("partner") or "").strip()})
    # Full partner catalog so the modal's dropdown can offer any partner
    try:
        all_partners_rows = load_partners_excel()
        partner_catalog = sorted({p["name"] for p in all_partners_rows if p.get("name")})
    except Exception:
        partner_catalog = []
    return tr(request, "introduction.html", ctx(
        request, "introduction",
        columns=columns,
        all_intros=INTROS,
        board_partners=board_partners,
        partner_catalog=partner_catalog,
    ))

@app.post("/api/intros/move")
async def api_intros_move(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    intro_id = body.get("id")
    new_column = body.get("column")
    if new_column not in _VALID_COLUMNS:
        return JSONResponse({"error": "invalid column"}, status_code=400)
    for i in INTROS:
        if i["id"] == intro_id:
            i["column"] = new_column
            _save_intros(INTROS)
            return {"ok": True}
    return JSONResponse({"error": "not found"}, status_code=404)

@app.post("/api/intros/update")
async def api_intros_update(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    intro_id = body.get("id")
    fields = body.get("fields", {})
    for i in INTROS:
        if i["id"] == intro_id:
            for k, v in fields.items():
                if k in _INTRO_FIELDS:
                    i[k] = v
            _save_intros(INTROS)
            return {"ok": True, "intro": i}
    return JSONResponse({"error": "not found"}, status_code=404)

@app.post("/api/intros/create")
async def api_intros_create(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    fields = body.get("fields") or {}
    # Legacy: allow body.merchant for backward compat
    merchant = (fields.get("merchant") or body.get("merchant") or "").strip()
    partner = (fields.get("partner") or "").strip()
    if not merchant:
        return JSONResponse({"error": "merchant required"}, status_code=400)
    if not partner:
        return JSONResponse({"error": "partner required"}, status_code=400)
    import uuid
    new_intro = {
        "id": uuid.uuid4().hex[:10],
        "merchant": merchant,
        "partner": partner,
        "partnership_manager": "",
        "column": "request-pricing",
        "vertical": "", "legal_entity_countries": "", "operation_countries": "",
        "requesting_countries": "", "transaction_type": "", "payment_flow": "",
        "payment_methods": "", "avg_ticket": "", "monthly_tpv": "", "comments": "",
    }
    # Copy any optional fields from request
    for k, v in fields.items():
        if k in _INTRO_FIELDS and k not in ("merchant", "partner"):
            new_intro[k] = (v or "").strip()
    INTROS.append(new_intro)
    _save_intros(INTROS)
    return {"ok": True, "intro": new_intro}

@app.post("/api/intros/delete")
async def api_intros_delete(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    intro_id = body.get("id")
    global INTROS
    before = len(INTROS)
    INTROS = [i for i in INTROS if i["id"] != intro_id]
    if len(INTROS) == before:
        return JSONResponse({"error": "not found"}, status_code=404)
    _save_intros(INTROS)
    return {"ok": True}

# ── Partner Leads board ──────────────────────────────────────────────────────
LEAD_COLUMNS = [
    ("extra-introductions",   "Extra Introductions",   "#a78bfa"),
    ("introduced-by-partner", "Introduced by Partner", "#60a5fa"),
    ("in-negotiation",        "In Negotiation",        "#fbbf24"),
    ("signed-merchant",       "Signed Merchant",       "#c084fc"),
    ("live-merchant",         "Live Merchant",         "#22c55e"),
    ("didnt-qualify",         "Didn't Qualify",        "#86868b"),
    ("lost",                  "Lost",                  "#ef4444"),
]
_VALID_LEAD_COLUMNS = {c[0] for c in LEAD_COLUMNS}
_LEAD_FIELDS = {"merchant", "partner", "bdm", "pm", "comments"}

LEADS_STORAGE = os.path.join(DATA_DIR, "leads.json")

def _seed_leads():
    import uuid
    seed_map = {
        "extra-introductions":   [],
        "introduced-by-partner": [
            ("Rappi",        "dLocal",       "Johanderson", "Talita"),
            ("Cabify",       "Kushki",       "Talita",      "Alessandra"),
            ("Totalplay",    "Conekta",      "Alex",        "Talita"),
            ("Linio",        "PayU",         "Johanderson", "Talita"),
        ],
        "in-negotiation": [
            ("Despegar",     "Bamboo",       "Alessandra",  "Talita"),
            ("Falabella",    "Kushki",       "Talita",      "Alessandra"),
            ("PedidosYa",    "dLocal",       "Johanderson", "Talita"),
        ],
        "signed-merchant": [
            ("Cinépolis",    "Stripe",       "Alex",        "Alessandra"),
            ("Claro",        "Cielo",        "Sofia",       "Talita"),
            ("Spotify",      "Pagar.me",     "Johanderson", "Talita"),
        ],
        "live-merchant": [
            ("iFood",        "PagBank",      "Johanderson", "Talita"),
            ("Netflix",      "Conekta",      "Alex",        "Alessandra"),
            ("MercadoLibre", "Mercado Pago", "Sofia",       "Talita"),
        ],
        "didnt-qualify": [
            ("LocalStore MX","Clip",         "Alex",        "Alessandra"),
            ("MiniMart CO",  "Wompi",        "Johanderson", "Talita"),
        ],
        "lost": [
            ("Uber",         "Cielo",        "Sofia",       "Talita"),
            ("Avianca",      "PayU",         "Johanderson", "Alessandra"),
        ],
    }
    out = []
    for col, rows in seed_map.items():
        for m, p, b, pm in rows:
            out.append({
                "id": uuid.uuid4().hex[:10],
                "column": col,
                "merchant": m, "partner": p, "bdm": b, "pm": pm, "comments": "",
            })
    return out

def _db_init_leads():
    conn = _db_conn()
    if not conn:
        return False
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id TEXT PRIMARY KEY,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        return True
    except Exception as e:
        print(f"[leads] Postgres init failed: {e}")
        return False
    finally:
        conn.close()

def _load_leads():
    conn = _db_conn()
    if conn:
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT data FROM leads ORDER BY updated_at ASC")
                rows = cur.fetchall()
                if rows:
                    return [r[0] for r in rows]
                # Empty table — seed it
                seed = _seed_leads()
                with conn.cursor() as c2:
                    for lead in seed:
                        c2.execute("""
                            INSERT INTO leads (id, data, updated_at)
                            VALUES (%s, %s::jsonb, NOW())
                            ON CONFLICT (id) DO NOTHING
                        """, (lead["id"], json.dumps(lead, ensure_ascii=False)))
                return seed
        except Exception as e:
            print(f"[leads] Postgres load failed: {e}")
        finally:
            conn.close()
    # JSON fallback
    try:
        with open(LEADS_STORAGE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return _seed_leads()

def _save_leads(data):
    conn = _db_conn()
    if conn:
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT id FROM leads")
                existing = {r[0] for r in cur.fetchall()}
                current = {i["id"] for i in data}
                for removed_id in existing - current:
                    cur.execute("DELETE FROM leads WHERE id = %s", (removed_id,))
                for lead in data:
                    cur.execute("""
                        INSERT INTO leads (id, data, updated_at)
                        VALUES (%s, %s::jsonb, NOW())
                        ON CONFLICT (id) DO UPDATE
                          SET data = EXCLUDED.data, updated_at = NOW()
                    """, (lead["id"], json.dumps(lead, ensure_ascii=False)))
            return
        except Exception as e:
            print(f"[leads] Postgres save failed: {e}")
        finally:
            conn.close()
    try:
        with open(LEADS_STORAGE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[leads] JSON save failed: {e}")

_db_init_leads()
LEADS = _load_leads()

@app.post("/api/leads/move")
async def api_leads_move(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    lead_id = body.get("id")
    new_column = body.get("column")
    if new_column not in _VALID_LEAD_COLUMNS:
        return JSONResponse({"error": "invalid column"}, status_code=400)
    for l in LEADS:
        if l["id"] == lead_id:
            l["column"] = new_column
            _save_leads(LEADS)
            return {"ok": True}
    return JSONResponse({"error": "not found"}, status_code=404)

@app.post("/api/leads/update")
async def api_leads_update(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    lead_id = body.get("id")
    fields = body.get("fields", {})
    for l in LEADS:
        if l["id"] == lead_id:
            for k, v in fields.items():
                if k in _LEAD_FIELDS:
                    l[k] = v
            _save_leads(LEADS)
            return {"ok": True, "lead": l}
    return JSONResponse({"error": "not found"}, status_code=404)

@app.post("/api/leads/create")
async def api_leads_create(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    fields = body.get("fields") or {}
    merchant = (fields.get("merchant") or "").strip()
    partner  = (fields.get("partner")  or "").strip()
    if not merchant:
        return JSONResponse({"error": "merchant required"}, status_code=400)
    if not partner:
        return JSONResponse({"error": "partner required"}, status_code=400)
    import uuid
    new_lead = {
        "id": uuid.uuid4().hex[:10],
        "column": "extra-introductions",
        "merchant": merchant,
        "partner": partner,
        "bdm": (fields.get("bdm") or "").strip(),
        "pm":  (fields.get("pm")  or "").strip(),
        "comments": (fields.get("comments") or "").strip(),
    }
    LEADS.append(new_lead)
    _save_leads(LEADS)
    return {"ok": True, "lead": new_lead}

@app.post("/api/leads/delete")
async def api_leads_delete(request: Request):
    if not get_role(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    lead_id = body.get("id")
    global LEADS
    before = len(LEADS)
    LEADS = [l for l in LEADS if l["id"] != lead_id]
    if len(LEADS) == before:
        return JSONResponse({"error": "not found"}, status_code=404)
    _save_leads(LEADS)
    return {"ok": True}

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
    "Brazil": {
        "overview": {
            "Population (2024)":                 "216M",
            "GDP nominal (2024)":                "$2.2T",
            "Ecommerce market (2026e)":          "$75B (CAGR 11%)",
            "Online users (2024)":               "165M",
            "Internet penetration (2024)":       "81%",
            "Smartphone penetration (2024)":     "80%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "Elo",
            "a2a":     "PIX",
            "apms":    [
                {"name": "PIX",           "type": "A2A"},
                {"name": "Mercado Pago",  "type": "Wallet"},
                {"name": "PicPay",        "type": "Wallet"},
                {"name": "Boleto",        "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 36, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",            "share": 16.0, "type": "international"},
                    {"name": "Mastercard",      "share": 13.0, "type": "international"},
                    {"name": "Elo",             "share":  5.0, "type": "local"},
                    {"name": "Hipercard / Amex","share":  2.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "PIX", "share": 35, "growth": "+40% YoY"},
            {"name": "Boleto Bancário", "share": 10, "growth": "-15% YoY"},
            {"name": "Debit Cards", "share": 8, "growth": "flat",
                "schemes": [
                    {"name": "Visa Electron", "share": 3.5, "type": "international"},
                    {"name": "Maestro",       "share": 2.5, "type": "international"},
                    {"name": "Elo Débito",    "share": 2.0, "type": "local"},
                ]},
            {"name": "Wallets", "detail": "Mercado Pago, PicPay", "share": 7, "growth": "+8% YoY"},
            {"name": "BNPL / Installments on card", "share": 4, "growth": "+6% YoY"},
        ],
        "regulation": [
            "The Banco Central do Brasil (BACEN) regulates all payment institutions. Wallets and acquirers need an IP (Instituição de Pagamento) license — there are specific sub-categories (emissor de moeda eletrônica, credenciador, iniciador, emissor de instrumento pós-pago).",
            "PIX is the real-time payment rail owned and run by BACEN. Every bank with more than 500K active customers must support PIX. It's free for consumers and used in ~35% of ecommerce already.",
            "LGPD (Brazil's GDPR equivalent) applies since 2020. Data processing requires legal basis; payment data is considered sensitive. Enforcement by ANPD is active, with fines up to 2% of Brazilian revenue.",
            "Installment payments (parcelamento sem juros) are a cultural default. Merchants advertise prices in 3–12 interest-free installments; the acquirer advances the full amount and takes the credit risk on the card issuer.",
            "Taxes on digital services are layered: ISS (municipal service tax, 2–5%), PIS/COFINS (federal, ~9.25%), and IOF (tax on foreign-exchange transactions, typically 0.38%). Merchants of Record must navigate all three.",
            "Open Finance (Fase 4) requires banks and fintechs to expose APIs for payment initiation and account aggregation. This is creating new 'initiator' business models that bypass card rails entirely.",
        ],
        "digital_trends": [
            "PIX has reshaped the payment stack in four years — from launch in Nov 2020 to now ~35% of ecommerce and over 40B transactions/year. Growth is still ~40% YoY with recurring PIX (pix automático) rolling out in 2025.",
            "Installment credit is the dominant purchasing habit: ~70% of credit card spend is split into 2+ installments. This supports high-ticket ecommerce (appliances, electronics) that would be impossible elsewhere.",
            "Super-apps dominate the wallet layer: Mercado Pago, Nubank, PicPay, and iFood all bundle payments, credit, investments, and commerce. Merchants integrating a wallet typically pick 2–3 of these plus PIX.",
            "Nubank (150M+ customers across LatAm) is proving that digital-only banks can scale to incumbent size. Their payment rails and credit scoring are being licensed to merchants directly via Nu Business.",
            "Cross-border commerce into Brazil is friction-heavy — BACEN FX licensing, IOF tax, and Boleto/PIX integration requirements. This is why international brands partner with local PSPs (Ebanx, Pagsmile, dLocal) rather than going direct.",
            "Influencer and social commerce via Instagram and TikTok is a major acquisition channel; 'link na bio' checkouts through Mercado Pago, Hotmart, and direct PIX are standard for creators and SMBs.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Mexico": {
        "overview": {
            "Population (2024)":                 "129M",
            "GDP nominal (2024)":                "$1.7T",
            "Ecommerce market (2026e)":          "$50B (CAGR 18%)",
            "Online users (2024)":               "97M",
            "Internet penetration (2024)":       "76%",
            "Smartphone penetration (2024)":     "77%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "Carnet",
            "a2a":     "SPEI / CoDi",
            "apms":    [
                {"name": "OXXO Pay",    "type": "Cash voucher"},
                {"name": "SPEI",        "type": "A2A"},
                {"name": "Mercado Pago","type": "Wallet"},
                {"name": "CoDi",        "type": "A2A (QR)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 26, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Carnet",     "share":  1.0, "type": "local"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Electron", "share": 12.0, "type": "international"},
                    {"name": "Maestro",       "share":  8.0, "type": "international"},
                    {"name": "Carnet Débito", "share":  2.0, "type": "local"},
                ]},
            {"name": "Cash", "detail": "OXXO, 7-Eleven", "share": 19, "growth": "-10% YoY"},
            {"name": "A2A", "detail": "SPEI, CoDi", "share": 18, "growth": "+25% YoY"},
            {"name": "Wallets", "detail": "Mercado Pago, PayPal", "share": 11, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Kueski, Mercado Crédito", "share": 4, "growth": "+35% YoY"},
        ],
        "regulation": [
            "CNBV (banking regulator) and Banxico (central bank) share authority. The 2018 Fintech Law defined two licenses: IFPE (e-money) for wallets and ITF (crowdfunding) for lending platforms. Over 80 IFPEs have been authorized.",
            "Mexico Fintech Law 2.0 is expected October 2026. The refresh is tightening PSP/wallet capital requirements, redefining 'payment initiator' roles, and introducing clearer Open Finance obligations.",
            "Merchants of Record must register for SAT (tax authority) and withhold IVA (VAT 16%) at point of sale. Digital services from foreign providers also trigger a 16% IVA that the PSP often collects on behalf of the SAT.",
            "OXXO Pay (cash voucher accepted at 22K+ OXXO stores) is still the de facto onboarding rail for the ~40% of Mexicans without a card. Settlement is 24–72 hours to merchant; it's a non-negotiable in Mexican checkouts.",
            "CoDi (Banxico's instant QR A2A rail) was launched in 2019 but adoption has been slow — being revamped with CoDi 2.0 pushed to Q3 2026 with merchant incentives and interop with Dimo wallet-to-wallet.",
            "Remittances are ~4% of GDP and mostly via the US corridor. Wallets like Mercado Pago and Bitso are eating into traditional remittance share, including stablecoin-rail USDC settlement.",
        ],
        "digital_trends": [
            "Mexico is a cash-heavy but rapidly digitizing market. OXXO Pay still drives ~19% of online payments but is losing 10% YoY as wallets and SPEI scale.",
            "Nearshoring is driving B2B payment innovation. US companies relocating supply chain to Mexico need cross-border settlement and invoice financing — Kueski, Konfío, and Clara are the main fintech players.",
            "Mercado Pago (Mercado Libre ecosystem) processes over 30% of all Mexican ecommerce payments. They offer embedded credit, installments, wallet, and acquiring — effectively a full-stack PSP.",
            "Spotify, Netflix, Uber, and other subscription brands rely heavily on card-on-file + backup OXXO. Failed recurring charges due to card churn are a major ops cost; smart-retry orchestration is a priority.",
            "Cross-border ecommerce (buying from US/China/EU) is ~30% of total Mexican ecommerce spend. Merchants of Record and local APM integration are essential for Shein, Temu, Amazon, etc.",
            "The BNPL wave (Kueski Pay, Atrato, Mercado Crédito) is concentrated in travel, electronics, and apparel. Credit approval uses alt-data since only ~40% of Mexicans have formal credit history.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Colombia": {
        "overview": {
            "Population (2024)":                 "52M",
            "GDP nominal (2024)":                "$365B",
            "Ecommerce market (2026e)":          "$15B (CAGR 16%)",
            "Online users (2024)":               "39M",
            "Internet penetration (2024)":       "73%",
            "Smartphone penetration (2024)":     "70%",
            "In-Store : Ecommerce ratio (2024)": "87 : 13",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "PSE / Bre-B",
            "apms":    [
                {"name": "PSE",        "type": "A2A"},
                {"name": "Nequi",      "type": "Wallet"},
                {"name": "Daviplata",  "type": "Wallet"},
                {"name": "Efecty",     "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 14.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Nequi, Daviplata", "share": 17, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "PSE, Bre-B", "share": 15, "growth": "+18% YoY"},
            {"name": "Cash", "detail": "Efecty, Baloto", "share": 12, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 6, "growth": "+25% YoY"},
        ],
        "regulation": [
            "Superintendencia Financiera de Colombia (SFC) regulates payment and e-money companies under Decree 1692/2020. A SEDPE license (Sociedad Especializada en Depósitos y Pagos Electrónicos) is needed to hold customer funds.",
            "Bre-B is the new instant-payment rail launched by Banco de la República in 2025, modeled on PIX. Participation is mandatory for banks and SEDPEs above certain volume thresholds, with interop required by 2026.",
            "PSE (Pagos Seguros en Línea), owned by ACH Colombia, is the incumbent A2A rail for ecommerce. Most banks are integrated. Settlement is same-day with tokenized authentication at the issuer bank.",
            "VAT (IVA) at 19% applies to most digital services; foreign providers must register for IVA on services sold to Colombian consumers. Retención en la fuente (withholding tax) applies on payouts to Colombian merchants.",
            "Financial inclusion is a national priority. Daviplata (Banco Davivienda) and Nequi (Grupo Bancolombia) have 20M+ users each; both started as basic wallets and now offer credit, investments, and remittances.",
            "Data protection under Ley 1581/2012 requires explicit consent and SIC (Superintendencia de Industria y Comercio) registration of databases. Cross-border data transfer requires adequacy or contractual safeguards.",
        ],
        "digital_trends": [
            "Colombia is the wallet-adoption leader in the Andean region. Nequi and Daviplata each have 20M+ users and are accepted at most major retailers, supermarkets, and billers.",
            "Bre-B rollout in 2025 is expected to repeat the PIX effect — bringing instant A2A payments to ecommerce and social commerce. Early integrators (Rappi, Mercado Libre) have already added it to checkout.",
            "Cash-based payments (Efecty, Baloto) still matter for unbanked segments but are declining ~8% per year as wallets grow. Merchants that drop cash too fast lose ~15% of checkout conversion.",
            "Rappi (Colombian unicorn) is the dominant super-app in LatAm outside Brazil. RappiPay (their fintech arm) now offers cards, credit, and PSP services bundled with delivery.",
            "Open Finance framework is in regulatory consultation; industry expects mandatory APIs for payment initiation and data aggregation by 2027. Local fintechs (Truora, Finmaq) are already building on top.",
            "Cross-border ecommerce is huge: US and China ship in via Aerovía/Olympic courier networks. Payments usually settle in USD via international cards or CrediBanco acquiring, with FX happening at the PSP level.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Argentina": {
        "overview": {
            "Population (2024)":                 "46M",
            "GDP nominal (2024)":                "$650B",
            "Ecommerce market (2026e)":          "$18B (CAGR 22%)",
            "Online users (2024)":               "40M",
            "Internet penetration (2024)":       "87%",
            "Smartphone penetration (2024)":     "84%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "Cabal",
            "a2a":     "Transferencias 3.0 / DEBIN",
            "apms":    [
                {"name": "Mercado Pago","type": "Wallet"},
                {"name": "Ualá",        "type": "Wallet"},
                {"name": "Rapipago",    "type": "Cash voucher"},
                {"name": "PagoFácil",   "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "detail": "with cuotas", "share": 35, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 17.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                    {"name": "Cabal",      "share":  2.0, "type": "local"},
                ]},
            {"name": "Wallets", "detail": "Mercado Pago, Ualá", "share": 22, "growth": "+35% YoY"},
            {"name": "Debit Cards", "share": 18, "growth": "flat",
                "schemes": [
                    {"name": "Cabal Débito", "share": 2.7, "type": "local"},
                    {"name": "Visa Debit", "share": 8.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.9, "type": "international"},
                ]},
            {"name": "Cash", "detail": "Rapipago, PagoFácil", "share": 10, "growth": "-12% YoY"},
            {"name": "A2A", "detail": "Transferencias 3.0", "share": 10, "growth": "+28% YoY"},
            {"name": "BNPL / cuotas", "share": 5, "growth": "+8% YoY"},
        ],
        "regulation": [
            "BCRA (Banco Central de la República Argentina) regulates payment service providers (PSPCR) — the license needed to hold customer funds as a wallet or aggregator. All PSPCRs must segregate client funds 100% in regulated instruments.",
            "Argentina operates with multiple exchange rates (official, MEP, CCL, blue) and strict capital controls. Cross-border USD settlement for merchants requires BCRA authorization and often routes through Uruguay or Miami.",
            "Transferencias 3.0 is the BCRA-run instant-payment interop rail launched 2021. It connects all banks and wallets with QR interoperability and real-time settlement. It's the backbone of the Mercado Pago/Ualá ecosystem.",
            "AFIP (tax authority) imposes gross-income withholding (IIBB, ~3–5% per province), VAT (21%), and PAIS tax (30% on FX operations for imports). PSPs typically handle withholdings on behalf of merchants.",
            "Cuotas sin interés (interest-free installments, subsidized by banks and merchants) is culturally non-negotiable. Ahora 12, Ahora 24, and promotional plans drive ~70% of ecommerce credit card spend.",
            "Crypto is legal but not tender; adoption is high as a USD-hedge. Argentina has the highest per-capita stablecoin usage in LatAm. Exchanges must register with UIF (AML authority) and report large transactions.",
        ],
        "digital_trends": [
            "Mercado Pago (ML Argentina) is the dominant wallet with ~50% of ecommerce payments flowing through it. Installment and QR at physical retail is cannibalizing debit card rails.",
            "Ualá (3rd largest fintech in LatAm) grew from a prepaid card to a full neobank. 8M+ users, majority under 35. They're aggressive on no-fee instant transfers and crypto trading.",
            "Hyperinflation (>100% annual) is pushing consumers toward stablecoins (USDT, USDC) for savings. Wallets like Lemon and Buenbit are normalizing crypto-to-peso conversion at checkout.",
            "Cross-border and SaaS subscriptions suffer from the PAIS tax (30% on FX). Merchants offering local peso pricing + local acquiring avoid the premium and convert 2–3x better.",
            "Mobile commerce is ~70% of total ecommerce; Android dominates. WhatsApp Business API is a common checkout channel for SMBs, often settling via Mercado Pago link.",
            "Social commerce via Instagram and TikTok is huge given FX constraints pushing consumers to direct-from-brand purchases over marketplaces. Influencer-linked MP checkouts are the default.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Chile": {
        "overview": {
            "Population (2024)":                 "19.5M",
            "GDP nominal (2024)":                "$340B",
            "Ecommerce market (2026e)":          "$14B (CAGR 12%)",
            "Online users (2024)":               "18M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "TEF (Transferencia Electrónica de Fondos)",
            "apms":    [
                {"name": "WebPay Plus","type": "A2A / Card redirect"},
                {"name": "Mach",       "type": "Wallet"},
                {"name": "Khipu",      "type": "A2A"},
                {"name": "Fpay",       "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 34, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 18.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "Redcompra", "share": 30, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 16.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.0, "type": "international"},
                    {"name": "Maestro", "share": 1.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "TEF, WebPay", "share": 18, "growth": "+15% YoY"},
            {"name": "Wallets", "detail": "Mach, Fpay, MercadoPago", "share": 10, "growth": "+24% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+18% YoY"},
            {"name": "Cash", "detail": "Servipag", "share": 4, "growth": "-10% YoY"},
        ],
        "regulation": [
            "CMF (Comisión para el Mercado Financiero) regulates banks, PSPs, and fintechs. The 2023 Fintech Law (Ley 21.521 / LMSF) created six new license types including payment initiators, wallet issuers, and crowdfunding platforms.",
            "Open Finance is being implemented in phases under the LMSF. By mid-2026, banks and wallets must expose APIs for account aggregation and payment initiation with customer consent.",
            "Transbank (owned by Chilean banks) historically monopolized card acquiring. New acquirers (Getnet, Kushki, Flow) now compete, but Transbank still processes ~70% of physical-world card volume.",
            "VAT (IVA) at 19% applies; foreign digital service providers must register under Ley 21.210 and collect IVA on B2C sales. Over 500 international platforms (Netflix, Spotify, etc.) are registered.",
            "Data protection under Ley 19.628 is being replaced by a GDPR-aligned law (Ley 21.719) coming into force Dec 2026. It will require DPOs, impact assessments, and tighter cross-border transfer rules.",
            "Crypto is legal and CMF has granted licenses under LMSF. Chilean exchanges (Buda, CryptoMarket) are consolidated; stablecoin payments are permitted but not common at merchant checkout yet.",
        ],
        "digital_trends": [
            "Chile has the highest internet penetration (92%) and card-ownership rate in LatAm. Card-not-present fraud is also higher — 3DS is universally required and Tokens on file are standard.",
            "WebPay Plus is the incumbent ecommerce gateway; more than 80% of Chilean merchants use it. Challenger gateways (Flow, Khipu, Fintoc) are growing in the SMB and subscription segments.",
            "Mach (Bci-owned wallet) reached 3M+ users by offering instant A2A, QR payments, and Visa prepaid. Fpay (Falabella ecosystem) and Copec Pay are the retail-backed alternatives.",
            "Chilean consumers are frequent cross-border shoppers — Aliexpress, Amazon, and US retailers represent 20%+ of total ecommerce. Dollar settlement and low-FX cards (Global66, Tenpo) are popular.",
            "Retail super-apps (Falabella, Cencosud, Ripley) dominate large-ticket ecommerce and offer private-label credit cards with aggressive installment plans (3-sin-interés) funded by the retailer.",
            "The 2023 Fintech Law has triggered a wave of new entrants — 200+ fintechs now regulated under CMF. Expect consolidation and M&A as smaller payment initiators look for scale.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Peru": {
        "overview": {
            "Population (2024)":                 "34M",
            "GDP nominal (2024)":                "$265B",
            "Ecommerce market (2026e)":          "$10B (CAGR 20%)",
            "Online users (2024)":               "24M",
            "Internet penetration (2024)":       "74%",
            "Smartphone penetration (2024)":     "66%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Yape / Plin (interop)",
            "apms":    [
                {"name": "Yape",          "type": "Wallet / QR"},
                {"name": "Plin",          "type": "Wallet / QR"},
                {"name": "PagoEfectivo", "type": "Cash voucher"},
                {"name": "BCP",           "type": "A2A"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 25, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share":  9.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Yape, Plin", "share": 22, "growth": "+38% YoY"},
            {"name": "Debit Cards", "share": 21, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.4, "type": "international"},
                    {"name": "Maestro", "share": 1.0, "type": "international"},
                ]},
            {"name": "Cash", "detail": "PagoEfectivo, KasNet", "share": 15, "growth": "-6% YoY"},
            {"name": "A2A", "detail": "Transfer BCP, BBVA", "share": 12, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+40% YoY"},
        ],
        "regulation": [
            "SBS (Superintendencia de Banca, Seguros y AFP) and BCRP (Banco Central de Reserva del Perú) co-regulate the payment ecosystem. E-money issuers need an EEDE license (Empresa Emisora de Dinero Electrónico).",
            "Decreto Legislativo 1478 (2020) modernized the fintech framework. The 2022 BCRP mandate required interoperability between wallets — this is what made Yape and Plin work together at checkout.",
            "Yape (BCP ecosystem) has 15M+ users — nearly half of Peru's adult population. Plin (Interbank/BBVA/Scotiabank) has ~11M. Since interop, any QR generated in one wallet is payable from the other.",
            "VAT (IGV) at 18% applies to all digital services. Foreign providers must register with SUNAT (tax authority) and collect IGV on B2C transactions — enforcement tightened significantly in 2025.",
            "Peru's Open Banking framework (consultation draft 2025) is expected to take effect in 2026. It targets payment initiation and account data sharing with consumer consent — similar to Colombia's Bre-B model.",
            "Cash payments via PagoEfectivo and KasNet are still ~15% of ecommerce, driven by the unbanked segment (~30% of adults). Most merchants offer cash as a mandatory fallback alongside cards and wallets.",
        ],
        "digital_trends": [
            "Yape and Plin interoperability has driven Peru from cash-heavy to wallet-first at SMB retail. QR payments are now common at street markets, taxis, and small restaurants.",
            "BCP (Peru's largest bank) uses Yape as a customer acquisition and cross-sell engine — credit, savings, and insurance are all pitched inside the wallet. This is a defensive moat against fintech entrants.",
            "Remittances to Peru are ~$4B/year, mostly from US (Peruvians in Florida, NY). Wallets are eating into Western Union and MoneyGram share via stablecoin on/off-ramps (Bitso, Lemon).",
            "Large-ticket ecommerce (electronics, travel) runs on credit cards with installment plans from Niubiz-enabled acquirers. Lower-ticket ecommerce (food delivery, subscriptions) runs on wallets + cash.",
            "Mobile internet penetration is skewed — 4G coverage is strong in Lima/Arequipa but thin in Andes/Amazon regions. This is why super-apps (Rappi, PedidosYa) focus mainly on coastal cities.",
            "The BNPL sector is young but growing ~40% YoY. Kushki and Niubiz both launched installment flows through acquirer rails; standalone BNPLs are less developed than in Mexico or Brazil.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Ecuador": {
        "overview": {
            "Population (2024)":                 "18M",
            "GDP nominal (2024)":                "$120B",
            "Ecommerce market (2026e)":          "$4B (CAGR 15%)",
            "Online users (2024)":               "14M",
            "Internet penetration (2024)":       "75%",
            "Smartphone penetration (2024)":     "72%",
            "In-Store : Ecommerce ratio (2024)": "89 : 11",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Transferencias interbancarias (BCE)",
            "apms":    [
                {"name": "PayPhone",      "type": "Wallet"},
                {"name": "De Una",        "type": "Wallet"},
                {"name": "Place to Pay",  "type": "A2A / Gateway"},
                {"name": "Efectivo",      "type": "Cash at counter"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 30, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 14.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Diners",     "share":  3.0, "type": "international"},
                    {"name": "Discover",   "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Cash", "share": 18, "growth": "-8% YoY"},
            {"name": "Wallets", "detail": "PayPhone, De Una", "share": 15, "growth": "+22% YoY"},
            {"name": "A2A", "detail": "Transfer BCE", "share": 8, "growth": "+14% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+18% YoY"},
        ],
        "regulation": [
            "Ecuador is fully dollarized — USD is legal tender since 2000. This removes FX risk for merchants but makes the country unusually sensitive to US monetary policy.",
            "SB (Superintendencia de Bancos) regulates traditional banking. JPRMF (Junta de Política y Regulación Monetaria y Financiera) oversees e-money and payment services.",
            "The draft Ley Fintech (under congressional review in 2025) would create dedicated licenses for PSPs, wallets, and crowdfunding — expected effective 2026/27.",
            "VAT (IVA) at 15% applies; foreign digital service providers must register with SRI and collect IVA. Resolution NAC-DGERCGC20 governs cross-border digital services.",
            "BCE (Banco Central) runs the SPI (Sistema de Pagos Interbancario) for A2A and SINCE for check clearing. There is no real-time 24/7 rail yet — most transfers are T+0 batch-settled.",
            "Data protection under LOPDP (Ley Orgánica de Protección de Datos Personales, 2021) aligns with GDPR principles; the authority is SPDP.",
        ],
        "digital_trends": [
            "PayPhone is the clear wallet leader with 4M+ users and merchant acceptance at supermarkets, pharmacies, and SMBs. They recently launched crypto on/off-ramps via Panda.",
            "Ecommerce is concentrated in Quito and Guayaquil; the rest of the country skews cash-on-delivery. Last-mile logistics is a frequent blocker for merchant expansion.",
            "Remittances are ~5% of GDP (mostly from US and Spain). Wallets and fintechs (PayPhone, Kushki) are growing share vs traditional operators.",
            "Dollarization means fewer FX and stablecoin use cases than neighbors — crypto adoption exists but at much smaller scale than Argentina or Venezuela.",
            "Super-apps are underdeveloped; Rappi and Uber Eats dominate delivery but don't yet operate broader commerce or fintech services locally.",
            "Banks are moving aggressively into QR and instant transfers (Produbanco's Billetera Móvil, Pichincha's Deuna app) to pre-empt fintech entrants.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Bolivia": {
        "overview": {
            "Population (2024)":                 "12M",
            "GDP nominal (2024)":                "$45B",
            "Ecommerce market (2026e)":          "$1B (CAGR 20%)",
            "Online users (2024)":               "7.5M",
            "Internet penetration (2024)":       "58%",
            "Smartphone penetration (2024)":     "55%",
            "In-Store : Ecommerce ratio (2024)": "93 : 7",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SIPAV / ACCL",
            "apms":    [
                {"name": "Tigo Money",   "type": "Mobile wallet"},
                {"name": "Tuyo",         "type": "Wallet"},
                {"name": "Pagosnet",     "type": "Gateway"},
                {"name": "QR Simple",    "type": "A2A (QR)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 30, "growth": "-5% YoY"},
            {"name": "Credit Cards", "share": 22, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 12.0, "type": "international"},
                    {"name": "Mastercard", "share":  9.0, "type": "international"},
                    {"name": "Amex",       "share":  1.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Tigo Money, Tuyo", "share": 18, "growth": "+28% YoY"},
            {"name": "Debit Cards", "share": 18, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 7.2, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SIPAV / QR Simple", "share": 10, "growth": "+22% YoY"},
            {"name": "BNPL / Other", "share": 2, "growth": "+10% YoY"},
        ],
        "regulation": [
            "ASFI (Autoridad de Supervisión del Sistema Financiero) is the primary regulator. BCB (Banco Central de Bolivia) runs payment rails and FX policy.",
            "Ley 393 de Servicios Financieros (2013) is the foundational framework. EEDE (Empresas Especializadas en Dinero Electrónico) is the license for e-money wallets.",
            "Multiple exchange rate system and USD shortage make cross-border settlement slow; merchants often use informal 'bolsín' FX or stablecoin workarounds.",
            "VAT (IVA) at 13% applies; digital services from abroad are subject to IT withholding under Resolución Normativa 102200000024.",
            "Tigo Money has >2M users and is the dominant mobile-wallet rail, leveraging Millicom's telco footprint. Acceptance is strongest in Santa Cruz and La Paz.",
            "BCB is piloting QR interoperability between banks and EEDEs with mandated enrollment by 2026, similar to Peru's Yape/Plin model.",
        ],
        "digital_trends": [
            "Bolivia is cash-first but digitizing fast in urban centers. QR Simple (BCB's interop initiative) is poised to be the main inflection point for digital payments.",
            "Stablecoin usage (mostly USDT) is growing as a USD-access workaround given BCB's FX restrictions. Binance P2P is widely used despite no formal exchange licensing.",
            "Social commerce via WhatsApp and Facebook is very common — SMBs often use Tigo Money QR or Tuyo for payment, not formal ecommerce platforms.",
            "Cross-border merchants struggle with Bolivian settlement — most partner with Uruguay or Peru-based regional PSPs to reach Bolivian consumers.",
            "Banco BISA, Banco Mercantil, and Banco Unión have the largest acquiring footprint. PSPs (Kushki, Pagosnet) are starting to build alternatives for online-only merchants.",
            "Low card penetration (~20% adults) means any merchant that doesn't offer Tigo Money or QR is locking out most of the digital-active population.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Paraguay": {
        "overview": {
            "Population (2024)":                 "7M",
            "GDP nominal (2024)":                "$45B",
            "Ecommerce market (2026e)":          "$1.2B (CAGR 18%)",
            "Online users (2024)":               "5.5M",
            "Internet penetration (2024)":       "78%",
            "Smartphone penetration (2024)":     "74%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SIPAP",
            "apms":    [
                {"name": "Pagopar",           "type": "Gateway / wallet"},
                {"name": "Billetera Personal","type": "Mobile wallet"},
                {"name": "Tigo Money",        "type": "Mobile wallet"},
                {"name": "Practipago",        "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Cabal",      "share":  3.0, "type": "local"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Cabal Débito", "share": 2.2, "type": "local"},
                    {"name": "Visa Debit", "share": 10.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.9, "type": "international"},
                ]},
            {"name": "Cash", "detail": "Practipago, Pago Express", "share": 17, "growth": "-6% YoY"},
            {"name": "Wallets", "detail": "Personal, Tigo Money", "share": 15, "growth": "+25% YoY"},
            {"name": "A2A", "detail": "SIPAP", "share": 14, "growth": "+18% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+20% YoY"},
        ],
        "regulation": [
            "BCP (Banco Central del Paraguay) regulates banking, PSPs, and electronic money. EMPE (Entidades de Medios de Pago Electrónico) is the license for wallets and aggregators.",
            "Ley de Servicios de Pago Móvil (2014) was one of the earliest mobile-money frameworks in LatAm — it opened the door for Tigo Money and Billetera Personal.",
            "VAT (IVA) at 10% applies; most digital services provided by foreign companies are subject to a simplified withholding regime introduced in 2020.",
            "SIPAP (Sistema de Pagos Paraguay) runs RTGS and same-day ACH. BCP is piloting SIPAP instant (real-time) with mandated participation by 2026.",
            "Paraguay hosts Ciudad del Este (triple-frontier with Brazil/Argentina) — a major cross-border retail hub where US-dollar pricing and crypto (USDT) are increasingly common.",
            "Free-trade zones (Fenix, Cateriac) attract fintech and PSP back-office ops thanks to low tax rates and flexible labor law.",
        ],
        "digital_trends": [
            "Mobile wallets (Billetera Personal, Tigo Money, Claro Pay) account for ~40% of digital transactions in rural areas where banking is thin.",
            "Paraguay has the cheapest electricity in LatAm (Itaipú hydro) which has attracted large-scale crypto mining. This has also driven stablecoin availability and P2P exchange activity.",
            "Cross-border purchasing in Ciudad del Este is a major economic engine; PSPs that handle multi-currency settlement (PYG, BRL, ARS, USD) are preferred by retailers.",
            "Pagopar is the dominant domestic ecommerce gateway, integrated with most Paraguayan acquirers and SIPAP. Social commerce via WhatsApp often settles via Pagopar link.",
            "Youth-skewed demographics (median age ~27) drive rapid adoption of ride-hailing, delivery, and streaming. MUV and Bolt compete with Uber in Asunción.",
            "Paraguayan banks (Itaú, Banco Nacional de Fomento, Ueno) are investing in digital; neobanks (Ueno, Zeta) are gaining share in SMB and youth segments.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Venezuela": {
        "overview": {
            "Population (2024)":                 "28M",
            "GDP nominal (2024)":                "$90B",
            "Ecommerce market (2026e)":          "$2B (CAGR 30%)",
            "Online users (2024)":               "16M",
            "Internet penetration (2024)":       "58%",
            "Smartphone penetration (2024)":     "54%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Pago Móvil BCV",
            "apms":    [
                {"name": "Pago Móvil",  "type": "A2A (phone-based)"},
                {"name": "Zinli",       "type": "Multi-currency wallet"},
                {"name": "Reserve",     "type": "USD stablecoin wallet"},
                {"name": "Bigpay",      "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash USD", "share": 25, "growth": "+8% YoY"},
            {"name": "Debit Cards", "detail": "mostly VES", "share": 20, "growth": "flat",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.0, "type": "international"},
                    {"name": "Maestro", "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Pago Móvil", "share": 18, "growth": "+18% YoY"},
            {"name": "Wallets", "detail": "Zinli, Reserve", "share": 18, "growth": "+35% YoY"},
            {"name": "Credit Cards", "share": 15, "growth": "-5% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  8.0, "type": "international"},
                    {"name": "Mastercard", "share":  6.0, "type": "international"},
                    {"name": "Amex",       "share":  1.0, "type": "international"},
                ]},
            {"name": "Crypto / Stablecoin", "share": 4, "growth": "+50% YoY"},
        ],
        "regulation": [
            "SUDEBAN (Superintendencia de Bancos) and BCV (Banco Central de Venezuela) co-regulate. Hyperinflation has driven a de facto dual-currency economy (VES + USD) despite official VES-only tender.",
            "US and EU sanctions restrict international card rails; Visa and Mastercard process Venezuelan transactions through limited corridors. Many international merchants don't accept VES-issued cards.",
            "SUNACRIP was the crypto regulator (dissolved 2023 in corruption scandal). Crypto and stablecoins are legal de facto but operate with minimal oversight. USDT is widely used for savings and remittances.",
            "Pago Móvil is the BCV-run instant A2A rail — phone-number based, free, and present on every Venezuelan bank. It dominates domestic digital payments at ~18% share.",
            "Remittances are >$4B/year (mostly from Colombia, US, Spain). Wallets (Zinli, Reserve) and crypto rails have replaced banks as the main remittance channel.",
            "Tax policy is erratic — ISLR (income tax) and IVA (VAT 16%) exist but enforcement is patchy. Foreign ecommerce merchants often bypass local tax registration entirely.",
        ],
        "digital_trends": [
            "Venezuela has the highest per-capita stablecoin (USDT) adoption in LatAm — a direct response to hyperinflation. Reserve, Zinli, and Binance P2P are the dominant rails.",
            "Ecommerce is unusually high as a % of total retail because in-person USD acceptance is complicated — online checkouts handle dual-currency pricing and stablecoin settlement cleaner.",
            "Pago Móvil is ubiquitous for small transactions; QR + phone-number transfer replaces cash in most urban areas.",
            "International subscriptions (Netflix, Spotify, Microsoft 365) are paid via overseas family members' cards, third-party gift-card sites, or crypto on-ramps — direct Venezuelan card rails often fail.",
            "Mercado Libre withdrew from Venezuela in 2017. Amazon and other global marketplaces don't officially ship; consumers use courier-forwarders (Tealca, Liberty Express) with US addresses.",
            "Local super-apps are underdeveloped; Pedidos Ya and Yummy dominate delivery but operate narrowly in Caracas, Valencia, and Maracaibo.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Costa Rica": {
        "overview": {
            "Population (2024)":                 "5.2M",
            "GDP nominal (2024)":                "$80B",
            "Ecommerce market (2026e)":          "$2B (CAGR 14%)",
            "Online users (2024)":               "4.5M",
            "Internet penetration (2024)":       "86%",
            "Smartphone penetration (2024)":     "82%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SINPE Móvil",
            "apms":    [
                {"name": "SINPE Móvil","type": "A2A (phone-based)"},
                {"name": "Kash",       "type": "Wallet"},
                {"name": "Tilopay",    "type": "Gateway"},
                {"name": "Pago Tic",   "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 35, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 18.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 28, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 15.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 11.2, "type": "international"},
                    {"name": "Maestro", "share": 1.4, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SINPE Móvil", "share": 20, "growth": "+30% YoY"},
            {"name": "Wallets", "share": 8, "growth": "+20% YoY"},
            {"name": "Cash", "share": 5, "growth": "-15% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+22% YoY"},
        ],
        "regulation": [
            "SUGEF (Superintendencia General de Entidades Financieras) regulates banks; CONASSIF (Consejo Nacional de Supervisión) oversees payments and insurance.",
            "BCCR (Banco Central de Costa Rica) operates SINPE — the RTGS and instant-payment rail. SINPE Móvil (phone-number A2A) has reached ~70% adult adoption since 2015.",
            "Ley del Sistema Financiero Nacional para la Vivienda and Ley de Servicios de Pago (in draft) are modernizing the PSP framework. A formal PSP license is expected by 2027.",
            "VAT (IVA) at 13% applies to all digital services; foreign B2C providers must register under Ley 9635 and collect/remit via SENDA.",
            "Strong tech-services economy (nearshoring for US): US card acceptance and USD settlement are common for B2B invoicing.",
            "LGPD-style data protection (Ley 8968) predates GDPR but is aligned in spirit. PRODHAB is the enforcement authority.",
        ],
        "digital_trends": [
            "SINPE Móvil is the clear differentiator — instant phone-to-phone A2A free for consumers, accepted at most retailers, taxis, and restaurants. It drives ~20% of ecommerce already.",
            "Costa Rica has the highest banking penetration in Central America (~80% adults) — cash is already a minority payment method and declining 15% YoY.",
            "BAC Credomatic is the regional payment giant (operates across Central America under the same brand). Their acquiring rails dominate physical and online.",
            "Nearshoring has brought Amazon, Microsoft, Intel, HP, and many US SaaS companies to Costa Rica — driving B2B payment sophistication and USD corridor volume.",
            "Kash and other wallet entrants are positioning for SME merchant acquiring and BNPL — still early but growth rates are high.",
            "Cross-border ecommerce from the US is strong; consumers frequently use courier-forwarders or direct Amazon shipping, paying via Visa/Mastercard credit cards.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Dominican Republic": {
        "overview": {
            "Population (2024)":                 "11M",
            "GDP nominal (2024)":                "$115B",
            "Ecommerce market (2026e)":          "$3B (CAGR 16%)",
            "Online users (2024)":               "8.5M",
            "Internet penetration (2024)":       "77%",
            "Smartphone penetration (2024)":     "70%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "LBTR / tPago",
            "apms":    [
                {"name": "tPago",       "type": "Wallet"},
                {"name": "Azul",        "type": "Gateway"},
                {"name": "Pagora",      "type": "PSP"},
                {"name": "Banreservas", "type": "Bank transfer"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 32, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 16.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 24, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.6, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "tPago, Mi Dinero", "share": 15, "growth": "+30% YoY"},
            {"name": "Cash", "share": 12, "growth": "-8% YoY"},
            {"name": "A2A", "detail": "LBTR, transfer", "share": 12, "growth": "+20% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+25% YoY"},
        ],
        "regulation": [
            "SIB (Superintendencia de Bancos) and BCRD (Banco Central) co-regulate. Ley Monetaria y Financiera (Ley 183-02) is the foundational framework.",
            "Reglamento sobre Servicios de Pago (2024) formalized e-money and payment service provider licenses. PSPs now need explicit BCRD authorization.",
            "tPago (Banreservas) has 3M+ users and is accepted by most retailers and utility billers — comparable to SINPE Móvil's role in Costa Rica.",
            "VAT (ITBIS) at 18% applies; foreign digital services registered through DGII. Tax enforcement tightened significantly post-2022 with ITBIS on streaming services.",
            "Remittances >$10B/year (largest in Central America-Caribbean), mostly from US corridors. Multiple wallets and stablecoin rails compete with traditional MTOs.",
            "Tourism-driven economy means POS acquiring is sophisticated; Visa and Mastercard acceptance at hotels and restaurants is near-universal.",
        ],
        "digital_trends": [
            "tPago is the dominant wallet, leveraging Banreservas' footprint. Accepted at grocery chains (La Sirena, Jumbo), pharmacies, and most utility billers.",
            "AZUL and Cardnet are the main card acquirers. Their ecommerce gateways handle most online card volume in the country.",
            "Remittance corridors (US, Spain) are being disrupted by fintechs — Remitly, Wise, and Lemon/Bitso-style stablecoin rails are growing fast.",
            "Tourism drives USD-denominated revenue for hotels, resorts, and vacation rentals; multi-currency settlement is a differentiator for PSPs.",
            "Banreservas (state bank) also runs digital products beyond tPago — Subagente Banreservas enables corner stores to act as banking agents.",
            "BNPL entrants (Kueski launched DR operations, Cashea) are targeting mid-income segments; credit card penetration is moderate (~35% adults).",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Panama": {
        "overview": {
            "Population (2024)":                 "4.5M",
            "GDP nominal (2024)":                "$85B",
            "Ecommerce market (2026e)":          "$1.6B (CAGR 13%)",
            "Online users (2024)":               "4M",
            "Internet penetration (2024)":       "80%",
            "Smartphone penetration (2024)":     "76%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "Clave",
            "a2a":     "Yappy / ACH-Panamá",
            "apms":    [
                {"name": "Yappy",        "type": "A2A / wallet"},
                {"name": "Nequi Panama", "type": "Wallet"},
                {"name": "Pagatodo",     "type": "Aggregator"},
                {"name": "MultiPagos",   "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 38, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 14.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "Clave", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Clave", "share": 8.8, "type": "local"},
                    {"name": "Visa Debit", "share": 7.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.9, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Yappy, Nequi PA", "share": 15, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "ACH-Panamá", "share": 10, "growth": "+18% YoY"},
            {"name": "Cash", "share": 10, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+22% YoY"},
        ],
        "regulation": [
            "SBP (Superintendencia de Bancos de Panamá) regulates the banking and payments sector. Panama's currency is the Balboa (PAB) pegged 1:1 to USD; USD is legal tender alongside PAB.",
            "Ley 35 of 2024 created a modern fintech framework — PSP, e-money, and payment-initiator licenses issued by SBP. Capital requirements are meaningful (~$500K minimum).",
            "Panama is on the FATF grey list for AML; enhanced KYC and source-of-funds requirements apply to PSPs. Getting off the list is a political priority — expect tighter controls, not looser.",
            "Yappy (Banco General) is the dominant A2A wallet with 2M+ users — similar role to Costa Rica's SINPE Móvil. Interop with other banks is being mandated.",
            "Tax regime is territorial — only Panama-sourced income is taxed. This is favorable for PSPs with cross-border revenue structures but under pressure from OECD.",
            "Zona Libre de Colón is one of the world's largest free zones; many regional distribution and payment operations HQ there.",
        ],
        "digital_trends": [
            "Panama is dollarized and has the highest credit card penetration in Central America — urban segments behave more like Puerto Rico than Nicaragua.",
            "Yappy drives most instant A2A — accepted at most retailers, taxis, and smaller merchants. Banking apps (Banistmo, Credicorp Bank) have their own QR and transfer features.",
            "Crypto ecosystem is relatively active — Panama passed a crypto framework in 2023 (though partially vetoed). OTC desks and stablecoin rails are common.",
            "Regional shopping and logistics hub: Panama residents and foreign buyers use Miami-forwarder addresses for US ecommerce, settling via international cards.",
            "Nequi launched Panama operations in 2024 (first international expansion from Colombia) — positioning for youth and digital-native segments.",
            "Cross-border B2B payments are a core use case given Panama's role as a regional HQ hub and free-zone trade center.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Guatemala": {
        "overview": {
            "Population (2024)":                 "18M",
            "GDP nominal (2024)":                "$100B",
            "Ecommerce market (2026e)":          "$2B (CAGR 17%)",
            "Online users (2024)":               "9M",
            "Internet penetration (2024)":       "50%",
            "Smartphone penetration (2024)":     "48%",
            "In-Store : Ecommerce ratio (2024)": "91 : 9",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "BI-Transferencias",
            "apms":    [
                {"name": "Tigo Money",   "type": "Mobile wallet"},
                {"name": "Recargapay",   "type": "Wallet / bill pay"},
                {"name": "Dialecta",     "type": "PSP"},
                {"name": "Prospera",     "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 25, "growth": "-8% YoY"},
            {"name": "Credit Cards", "share": 25, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Tigo Money, Recargapay", "share": 15, "growth": "+25% YoY"},
            {"name": "A2A", "share": 8, "growth": "+15% YoY"},
            {"name": "BNPL / Other", "share": 5, "growth": "+20% YoY"},
        ],
        "regulation": [
            "SIB (Superintendencia de Bancos) and Banguat (Banco de Guatemala) co-regulate. A fintech-specific law is still in draft — most PSPs operate under banking agent or e-money sub-regulations.",
            "Remittances are ~20% of GDP — the largest in Central America as % of GDP. Wallets and fintechs are increasingly competing with Western Union, MoneyGram, and bank rails.",
            "Tigo Money (Millicom) has the broadest mobile-money footprint; regulated as an emisor de dinero electrónico under banking supervision.",
            "VAT (IVA) at 12% applies; foreign digital service providers must register with SAT. Enforcement has been loose historically but tightened in 2024.",
            "Guatemala has the largest cash economy in Central America — ~35% of transactions are still cash, and >50% of adults are unbanked or underbanked.",
            "Ley Bitcoin pending in congress — would follow El Salvador's model, though unlikely to make BTC legal tender. Stablecoin frameworks are more likely.",
        ],
        "digital_trends": [
            "Remittances drive the digital wallet market — families receiving US dollars are the main user base for Tigo Money and competitors.",
            "Ecommerce is concentrated in Guatemala City and Antigua; rural markets remain heavily cash-based due to banking infrastructure gaps.",
            "Banco Industrial (Guatemala's largest bank) dominates acquiring via Visanet Guatemala. Their ecommerce gateway handles most card-not-present volume.",
            "Social commerce via WhatsApp Business and Facebook Marketplace is huge for SMBs — often settling via Tigo Money or bank transfer outside formal payment rails.",
            "Digital banking entrants (Banco G&T Continental, Banco Industrial's Zigi) are building app-first offerings to compete for youth segments.",
            "Stablecoin corridors (Bitso, Lemon, El Dorado) are gaining share on remittances, especially among younger remitters in US cities.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "El Salvador": {
        "overview": {
            "Population (2024)":                 "6.3M",
            "GDP nominal (2024)":                "$34B",
            "Ecommerce market (2026e)":          "$0.8B (CAGR 14%)",
            "Online users (2024)":               "4.2M",
            "Internet penetration (2024)":       "67%",
            "Smartphone penetration (2024)":     "62%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Transfer365",
            "apms":    [
                {"name": "Chivo Wallet","type": "Bitcoin / USD wallet"},
                {"name": "N1co",        "type": "Wallet"},
                {"name": "Pagadito",    "type": "Gateway"},
                {"name": "Puntoxpress", "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 15.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Cash", "share": 22, "growth": "-5% YoY"},
            {"name": "Wallets", "detail": "Chivo, N1co", "share": 15, "growth": "+18% YoY"},
            {"name": "A2A", "detail": "Transfer365", "share": 8, "growth": "+20% YoY"},
            {"name": "Bitcoin / Stablecoin", "share": 5, "growth": "+30% YoY"},
        ],
        "regulation": [
            "SSF (Superintendencia del Sistema Financiero) regulates banks and PSPs. El Salvador is fully dollarized (since 2001) and Bitcoin has been legal tender since September 2021.",
            "Ley Bitcoin (2021) made BTC legal tender alongside USD. Every business must accept BTC if technically capable. Chivo Wallet (government-issued) was the rollout mechanism.",
            "Ley de Emisión de Activos Digitales (2023) created a framework for digital-asset services providers (PSAV). El Salvador is courting Bitcoin-native businesses (Bitcoin Freedom Visa).",
            "BCR (Banco Central de Reserva) runs Transfer365 — the instant A2A rail between banks. Interop with Chivo Wallet is mandated.",
            "Remittances are ~24% of GDP (mostly US). Bitcoin/stablecoin rails have captured 3–5% of remittance volume; traditional MTOs still dominate.",
            "Tax regime: IVA (VAT) at 13%, income tax up to 30%. Bitcoin transactions are exempt from capital gains tax per Ley Bitcoin.",
        ],
        "digital_trends": [
            "El Salvador is the global test-bed for Bitcoin at the retail level. Adoption was heavy in 2021–22 but has plateaued — usage is concentrated in tourism corridors and remittances.",
            "Chivo Wallet (state-issued) was the initial distribution mechanism. Adoption has since shifted to private wallets like Strike, Muun, and Blink.",
            "Nearshoring + Bitcoin-friendly branding is attracting B2B tech investment. Tether announced HQ move to El Salvador in 2025.",
            "N1co is the leading private fintech — wallet, Visa card, and merchant acquiring. It's positioned as the domestic alternative to Chivo.",
            "Small ecommerce market but high growth rate — driven by cross-border shopping from US (courier forwarders) and growing domestic online retail.",
            "Dollarization removes FX risk but ties El Salvador to US rates; local financing remains expensive despite Bitcoin narrative.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Honduras": {
        "overview": {
            "Population (2024)":                 "10M",
            "GDP nominal (2024)":                "$31B",
            "Ecommerce market (2026e)":          "$0.7B (CAGR 15%)",
            "Online users (2024)":               "5M",
            "Internet penetration (2024)":       "50%",
            "Smartphone penetration (2024)":     "45%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "ACH Honduras",
            "apms":    [
                {"name": "Tigo Money", "type": "Mobile wallet"},
                {"name": "Tengo",      "type": "Wallet / prepaid"},
                {"name": "Pagatodo",   "type": "Aggregator"},
                {"name": "Banet",      "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 32, "growth": "-6% YoY"},
            {"name": "Credit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 11.0, "type": "international"},
                    {"name": "Mastercard", "share":  9.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 18, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 7.2, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Tigo Money, Tengo", "share": 14, "growth": "+22% YoY"},
            {"name": "A2A", "detail": "ACH", "share": 10, "growth": "+15% YoY"},
            {"name": "BNPL / Other", "share": 4, "growth": "+18% YoY"},
        ],
        "regulation": [
            "CNBS (Comisión Nacional de Bancos y Seguros) regulates the financial sector. BCH (Banco Central de Honduras) operates monetary and payment rails.",
            "Circular CNBS 003/2013 established the e-money framework. Tigo Money operates under this regime as an Emisor de Dinero Electrónico.",
            "Cash is still dominant (~32%) — banking penetration is ~35% of adults. Wallets are growing fastest in urban San Pedro Sula and Tegucigalpa.",
            "Remittances are ~27% of GDP (mostly from US). BAC Credomatic and Ficohsa dominate the traditional remittance-payout infrastructure.",
            "VAT (ISV) at 15% applies to most goods and services. Foreign digital providers' tax compliance is less rigorously enforced than in Mexico or Costa Rica.",
            "Crypto is legal but not widely regulated. Ley de Activos Virtuales pending in congress since 2023.",
        ],
        "digital_trends": [
            "Mobile penetration outpaces fixed internet — digital payments are mobile-first, mostly via wallets and USSD.",
            "Remittance-tied wallets drive most digital growth; Tigo Money is the volume leader.",
            "Ecommerce is nascent — Amazon and Shein capture the aspirational segment via US-forwarded delivery and card checkout.",
            "BNPL is early-stage; some regional entrants (Kueski) have explored Honduran expansion but none dominate yet.",
            "Banks are digitizing (Ficohsa app, BAC Digital) but fintech competition is limited — no homegrown neobank has scaled above 500K users.",
            "Social commerce via WhatsApp Business is huge among SMBs; most settle via bank transfer or Tigo Money.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Nicaragua": {
        "overview": {
            "Population (2024)":                 "7M",
            "GDP nominal (2024)":                "$17B",
            "Ecommerce market (2026e)":          "$0.4B (CAGR 13%)",
            "Online users (2024)":               "3M",
            "Internet penetration (2024)":       "40%",
            "Smartphone penetration (2024)":     "38%",
            "In-Store : Ecommerce ratio (2024)": "95 : 5",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SIP (Sistema Interbancario)",
            "apms":    [
                {"name": "Tica Pay",  "type": "Wallet"},
                {"name": "Pagasolo",  "type": "Cash voucher"},
                {"name": "Banpro",    "type": "Bank transfer"},
                {"name": "Pagalo.ni", "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 38, "growth": "-5% YoY"},
            {"name": "Credit Cards", "share": 18, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  9.0, "type": "international"},
                    {"name": "Mastercard", "share":  7.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 15, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 8.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.0, "type": "international"},
                    {"name": "Maestro", "share": 0.8, "type": "international"},
                ]},
            {"name": "Wallets", "share": 12, "growth": "+18% YoY"},
            {"name": "A2A", "detail": "SIP / transfer", "share": 10, "growth": "+14% YoY"},
            {"name": "Other", "share": 7, "growth": "+8% YoY"},
        ],
        "regulation": [
            "SIBOIF (Superintendencia de Bancos y Otras Instituciones Financieras) regulates banks and payment institutions. BCN (Banco Central) runs monetary policy and rails.",
            "Political and macroeconomic volatility (US sanctions since 2018) limits international card processing. Some US/EU-issued cards are declined for Nicaraguan merchants.",
            "Remittances are ~16% of GDP. Banpro and BAC Nicaragua dominate the payout infrastructure; fintechs are mostly absent.",
            "Cash dominates (~38% of digital-adjacent transactions; majority of overall retail is cash). Banking penetration is low (~30% adults).",
            "VAT (IVA) at 15% applies. Digital services tax enforcement is minimal on foreign providers.",
            "Crypto is unregulated; exchanges operate informally. Binance P2P is the dominant channel.",
        ],
        "digital_trends": [
            "Nicaragua has the lowest ecommerce penetration in Central America; growth is concentrated in Managua and Granada.",
            "International acceptance issues (sanctions-linked banking restrictions) complicate cross-border merchants — some global APMs skip Nicaragua entirely.",
            "Wallets (Tica Pay, Banpro Móvil) are growing from a low base, mostly in urban and utility-payment use cases.",
            "Diaspora-driven remittance inflows keep wallet and card volumes alive even as the formal economy struggles.",
            "Social commerce via Facebook and WhatsApp is common; many transactions never touch formal digital rails.",
            "Expect slow digital growth until political-economic conditions stabilize; most fintech investment bypasses Nicaragua for Costa Rica or Panama.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Cuba": {
        "overview": {
            "Population (2024)":                 "11M",
            "GDP nominal (2024)":                "$107B",
            "Ecommerce market (2026e)":          "$0.3B (CAGR 10%)",
            "Online users (2024)":               "7.6M",
            "Internet penetration (2024)":       "69%",
            "Smartphone penetration (2024)":     "63%",
            "In-Store : Ecommerce ratio (2024)": "97 : 3",
        },
        "local_payments": {
            "scheme":  "RED",
            "a2a":     "Transfermóvil",
            "apms":    [
                {"name": "Transfermóvil","type": "Mobile A2A / bill pay"},
                {"name": "Enzona",      "type": "Wallet"},
                {"name": "Multicaja",   "type": "Cash voucher"},
                {"name": "BPA Virtual", "type": "Online banking"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 55, "growth": "-3% YoY"},
            {"name": "A2A", "detail": "Transfermóvil", "share": 20, "growth": "+18% YoY"},
            {"name": "Credit Cards", "share": 3.8, "growth": "flat",
                "schemes": [
                    {"name": "Visa", "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 1.3, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 11.2, "growth": "flat",
                "schemes": [
                    {"name": "RED", "share": 7.8, "type": "local"},
                    {"name": "Visa Debit", "share": 1.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 1.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Enzona", "share": 8, "growth": "+12% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "BCC (Banco Central de Cuba) and MFP (Ministerio de Finanzas y Precios) regulate the financial system. Cuba operates on a state-bank model — very limited private-sector PSPs.",
            "US embargo blocks most Visa/Mastercard issuance and acquiring. AIS/OFAC restrictions complicate international-card acceptance at Cuban merchants.",
            "The 2021 monetary unification eliminated the dual-currency system (CUC + CUP); now only CUP (Cuban Peso) and USD are used (USD in MLC stores / tourist zones).",
            "Transfermóvil (run by ETECSA, the state telco) is the dominant digital-payment rail — used for bills, mobile top-ups, and increasingly P2P.",
            "Crypto was officially recognized in 2022 (Resolution 215); BCC licenses crypto service providers. Adoption is limited but growing as a sanctions workaround.",
            "Taxes: IVA is absent; instead, ONAT administers transaction taxes on formal payments. The parallel/informal economy is huge.",
        ],
        "digital_trends": [
            "Cuba is the most cash-dominant market in LatAm — ~55% of digital-related transactions still settle in cash.",
            "Transfermóvil has grown rapidly since 2018 — it works on feature phones via USSD, which matters given smartphone affordability.",
            "Remittances via Miami-corridor (Western Union halted in 2020; Fincimex and Western Union partially restored 2023) are politically sensitive and volatile.",
            "Stablecoin (USDT, USDC) usage is rising as a USD-access workaround — mostly through informal OTC rather than licensed exchanges.",
            "Tourism is the main FX source; hotels and MLC stores accept international cards, but most of Cuba is off-grid for foreign card acceptance.",
            "Ecommerce is tiny and concentrated in Havana; self-employed cuentapropistas use WhatsApp-based checkout with Transfermóvil as payment rail.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Puerto Rico": {
        "overview": {
            "Population (2024)":                 "3.2M",
            "GDP nominal (2024)":                "$115B",
            "Ecommerce market (2026e)":          "$4B (CAGR 10%)",
            "Online users (2024)":               "2.8M",
            "Internet penetration (2024)":       "88%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "ATH",
            "a2a":     "ATH Móvil",
            "apms":    [
                {"name": "ATH Móvil",   "type": "A2A / wallet"},
                {"name": "Venmo",       "type": "Wallet"},
                {"name": "Square Cash", "type": "Wallet"},
                {"name": "PayPal",      "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 40, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 15.0, "type": "international"},
                    {"name": "Amex",       "share":  4.0, "type": "international"},
                    {"name": "Discover",   "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 30, "growth": "+2% YoY",
                "schemes": [
                    {"name": "ATH Debit", "share": 9.0, "type": "local"},
                    {"name": "Visa Debit", "share": 11.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.4, "type": "international"},
                ]},
            {"name": "A2A", "detail": "ATH Móvil", "share": 15, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "Venmo, PayPal", "share": 10, "growth": "+18% YoY"},
            {"name": "Cash", "share": 3, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 2, "growth": "+30% YoY"},
        ],
        "regulation": [
            "Puerto Rico is a US territory; US federal regulators (OCC, FDIC, CFPB) apply. OCIF (Oficina del Comisionado de Instituciones Financieras) is the local regulator.",
            "Act 60 (formerly Acts 20/22) offers tax incentives for fintechs and crypto/digital-asset companies; many US crypto firms have domiciled here.",
            "US banking and card rails apply — Visa, Mastercard, Discover, and Amex are treated identically to US mainland. No cross-border friction with the US.",
            "ATH Móvil (Evertec-run) is the dominant A2A wallet — 1.5M+ users, accepted at most SMBs and many chains. It's the Puerto Rican answer to Venmo/Zelle.",
            "Evertec (NYSE:EVTC) is the dominant acquirer and processor for Puerto Rico and much of the Caribbean. They handle most card volume.",
            "USD is the only currency; no FX risk for US-based merchants selling to PR consumers.",
        ],
        "digital_trends": [
            "Puerto Rico behaves as a US payments market — credit/debit cards dominate, consumer behavior is closer to Miami than to San Juan of 20 years ago.",
            "ATH Móvil is the differentiator vs mainland US: it preceded Zelle and has deeper merchant acceptance than Venmo does on the mainland.",
            "Hurricanes and infrastructure resilience are ongoing concerns — payments systems need offline/degraded-mode capability.",
            "Crypto/fintech residency incentives (Act 60) have brought many US entrepreneurs; local ecommerce and payment innovation is a by-product.",
            "Cross-border ecommerce from mainland US (Amazon Prime, Target, Walmart) is the default — local retailers compete primarily on fresh/grocery and large-ticket items.",
            "Banks (Banco Popular, FirstBank, Oriental) are digitizing aggressively, and both Stripe and Square are fully active in the territory.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Jamaica": {
        "overview": {
            "Population (2024)":                 "2.8M",
            "GDP nominal (2024)":                "$17B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 13%)",
            "Online users (2024)":               "2.1M",
            "Internet penetration (2024)":       "75%",
            "Smartphone penetration (2024)":     "72%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "JamClear (RTGS)",
            "apms":    [
                {"name": "Lynk",          "type": "Wallet (JAM-DEX)"},
                {"name": "WiPay",         "type": "PSP"},
                {"name": "Paymaster",     "type": "Bill pay"},
                {"name": "TransJamaican", "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 15.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Cash", "share": 22, "growth": "-6% YoY"},
            {"name": "Wallets", "detail": "Lynk, Paymaster", "share": 12, "growth": "+28% YoY"},
            {"name": "A2A", "share": 10, "growth": "+18% YoY"},
            {"name": "BNPL / Other", "share": 6, "growth": "+20% YoY"},
        ],
        "regulation": [
            "BOJ (Bank of Jamaica) regulates banks, e-money issuers, and payment service providers. Its Electronic Retail Payment Services Regulations (2023) govern the PSP space.",
            "Jamaica launched JAM-DEX in 2022 — a retail CBDC issued by BOJ. Lynk (NCB) is the main consumer wallet for JAM-DEX. Adoption has been slower than hoped.",
            "Remittances are ~23% of GDP — mostly from US, UK, and Canada. Wallets and traditional MTOs compete; BOJ has been pushing low-cost digital corridors.",
            "Data Protection Act (2020, effective 2023) aligns with GDPR — registration with the Information Commissioner and DPO requirements apply.",
            "GCT (General Consumption Tax) at 15% applies. Jamaica is actively pursuing digital-service tax collection from foreign providers.",
            "Jamaican dollar (JMD) is floating but volatile — merchants often price in USD for tourism and B2B segments.",
        ],
        "digital_trends": [
            "JAM-DEX (CBDC) rollout is a flagship project but adoption has lagged expectations — consumers still prefer traditional wallets and cards.",
            "Lynk (NCB Financial Group) is the most active wallet — QR payments at supermarkets, pharmacies, and transport.",
            "Tourism drives a substantial share of payment volume — resort zones accept USD, cards, and increasingly mobile wallets like Apple Pay.",
            "Remittance corridors are a focal point for fintech innovation — Wise, Remitly, and regional players like Paymaster compete on FX.",
            "Ecommerce is small but growing fast; cross-border shopping from US is the default for apparel, electronics, and consumer goods.",
            "Credit card penetration is ~30% adults — cash and debit still dominate outside Kingston and tourist zones.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Trinidad and Tobago": {
        "overview": {
            "Population (2024)":                 "1.4M",
            "GDP nominal (2024)":                "$28B",
            "Ecommerce market (2026e)":          "$0.6B (CAGR 12%)",
            "Online users (2024)":               "1.2M",
            "Internet penetration (2024)":       "85%",
            "Smartphone penetration (2024)":     "80%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "LINX",
            "a2a":     "TTIPS",
            "apms":    [
                {"name": "WiPay",     "type": "PSP"},
                {"name": "TT Pay",    "type": "Gateway"},
                {"name": "Endcash",   "type": "Wallet"},
                {"name": "LINX Mobile","type": "A2A / QR"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 34, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 18.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "LINX", "share": 30, "growth": "+2% YoY",
                "schemes": [
                    {"name": "LINX", "share": 18.0, "type": "local"},
                    {"name": "Visa Debit", "share": 6.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.4, "type": "international"},
                ]},
            {"name": "A2A", "detail": "LINX / TTIPS", "share": 15, "growth": "+18% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+22% YoY"},
            {"name": "Cash", "share": 8, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+25% YoY"},
        ],
        "regulation": [
            "CBTT (Central Bank of Trinidad and Tobago) regulates banking and payments. Its Payment Service Providers regulations (2020) govern PSP licensing.",
            "FSA (Financial Services Act) and E-Money Issuer Order (2020) define the regulatory regime for wallets and stored-value instruments.",
            "LINX (owned by Infolink — a consortium of major banks) dominates domestic debit and ATM rails. International cards (Visa, Mastercard) run in parallel.",
            "VAT at 12.5% applies; foreign digital service providers must register with BIR (Board of Inland Revenue) under the e-services amendment.",
            "Data Protection Act (2011) is partially proclaimed; full enforcement has been delayed multiple times but a broader update is expected by 2026.",
            "TT is an energy-exporting economy (oil, gas, petrochemicals); B2B USD flows are large, and many merchants price in USD for international segments.",
        ],
        "digital_trends": [
            "LINX is culturally entrenched — most Trinidadians carry a LINX debit card and expect it at checkout. International cards are a premium/travel tier.",
            "WiPay is the leading domestic PSP — operates across several Caribbean markets (Jamaica, Barbados, Guyana) with a single integration.",
            "Ecommerce growth is strongest in specialty retail and tourism; grocery and essentials remain mostly in-store.",
            "Remittance corridors to TT are smaller than neighbours but still meaningful for Guyanese and Venezuelan communities.",
            "Digital banking entrants are limited — CBTT has been cautious on fintech licensing compared to BOJ (Jamaica) or CBB (Bahamas).",
            "Cross-border ecommerce from US via courier-forwarders (Swift, Carib Express) is a major consumption channel for imported goods.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "United States": {
        "overview": {
            "Population (2024)":                 "335M",
            "GDP nominal (2024)":                "$27T",
            "Ecommerce market (2026e)":          "$1.25T (CAGR 8%)",
            "Online users (2024)":               "305M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "ACH / FedNow / RTP",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Venmo",      "type": "Wallet / P2P"},
                {"name": "Cash App",   "type": "Wallet"},
                {"name": "Zelle",      "type": "A2A"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 38, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 15.0, "type": "international"},
                    {"name": "Mastercard", "share": 12.0, "type": "international"},
                    {"name": "Amex",       "share":  7.0, "type": "international"},
                    {"name": "Discover",   "share":  4.0, "type": "local"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Google Pay, PayPal", "share": 15, "growth": "+18% YoY"},
            {"name": "A2A", "detail": "ACH, Zelle, RTP, FedNow", "share": 10, "growth": "+30% YoY"},
            {"name": "BNPL", "detail": "Klarna, Affirm, Afterpay", "share": 7, "growth": "+22% YoY"},
            {"name": "Cash", "share": 5, "growth": "-6% YoY"},
        ],
        "regulation": [
            "Federal banking is regulated by OCC, FDIC, and the Federal Reserve. CFPB oversees consumer payments. State money-transmitter licenses (MTLs) are required in 49 states for non-bank PSPs.",
            "FedNow launched in July 2023 as the Fed's 24/7 instant-payment rail. Adoption by smaller banks is accelerating; TCH's RTP has been live since 2017 with broader coverage.",
            "The Durbin Amendment caps debit interchange for banks >$10B in assets. A pending Durbin 2.0 (routing-choice for credit) has been on-and-off in Congress.",
            "PCI-DSS v4.0 is the mandatory card-data security standard. 3DS2 is strongly encouraged but not mandated (unlike PSD2 SCA in EU). Fraud liability shifts apply from EMV.",
            "BNPL regulation tightened in 2024 — CFPB now treats BNPL as credit card-equivalent (Regulation Z applies). Disclosure, dispute, and refund rules are stricter.",
            "Stablecoin legislation (GENIUS Act variants) is working through Congress. If enacted, it would create a federal framework separate from state money-transmitter laws.",
        ],
        "digital_trends": [
            "US ecommerce is a mature ~$1.25T market growing ~8% annually. Amazon alone captures ~40% of online retail; Walmart and Target are the fastest-growing challengers.",
            "Credit card rewards culture keeps card share disproportionately high (~38%). Interchange subsidizes points and cash-back programs.",
            "Zelle (bank-owned consortium) has displaced Venmo for many P2P flows because it settles bank-to-bank with no wallet float. FedNow is expected to accelerate this further.",
            "BNPL is mainstreaming — Klarna, Affirm, Afterpay, and PayPal Pay Later are at checkout for most major retailers. Klarna IPO'd in 2025.",
            "Apple Pay and Google Pay drive the majority of NFC tap-to-pay; contactless POS coverage is now >90% of new terminals.",
            "Open Banking under CFPB's Section 1033 Rule (finalized Oct 2024) mandates consumer-authorized data sharing across banks — expect major changes by 2026–27.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Canada": {
        "overview": {
            "Population (2024)":                 "40M",
            "GDP nominal (2024)":                "$2.1T",
            "Ecommerce market (2026e)":          "$100B (CAGR 7%)",
            "Online users (2024)":               "37M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "Interac",
            "a2a":     "Interac e-Transfer / RTR (upcoming)",
            "apms":    [
                {"name": "Interac",    "type": "Debit / A2A"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Shop Pay",   "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 50, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 23.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "Amex",       "share":  7.0, "type": "international"},
                    {"name": "Discover",   "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "Interac", "share": 25, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Interac", "share": 20.0, "type": "local"},
                    {"name": "Visa Debit", "share": 2.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.2, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Interac e-Transfer", "share": 10, "growth": "+12% YoY"},
            {"name": "Wallets", "detail": "Apple, Google, PayPal", "share": 10, "growth": "+18% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+25% YoY"},
            {"name": "Cash", "share": 2, "growth": "-10% YoY"},
        ],
        "regulation": [
            "OSFI regulates banks at the federal level. FCAC oversees consumer protection. FINTRAC (AML) enforces PCMLTFA compliance for MSBs and PSPs.",
            "The Retail Payment Activities Act (RPAA, 2023) requires PSPs to register with Bank of Canada by Sep 2024 and meet risk-management standards.",
            "Interac is jointly owned by major Canadian banks and dominates both debit (in-person + online) and instant P2P via e-Transfer. It's the default Canadian payment behavior.",
            "Real-Time Rail (RTR) is being built by Payments Canada — repeatedly delayed, now expected H2 2026. It will eventually replace or augment Interac e-Transfer for RTGS.",
            "Open Banking legislation (Consumer-Driven Banking Act) was introduced in 2024 Budget; implementation is phased through 2026–27.",
            "GST/HST at 5–15% (federal + provincial) applies to digital services. Foreign providers must register under the simplified GST/HST regime if annual CAD sales exceed $30K.",
        ],
        "digital_trends": [
            "Canada has one of the highest credit card usage rates globally (~50% of payments) — driven by strong rewards and travel points culture.",
            "Interac e-Transfer is the domestic P2P standard — virtually every Canadian bank account supports it. Acceptance at merchants for bill-pay is universal.",
            "Shopify is headquartered in Ottawa; Shop Pay is particularly strong in Canadian ecommerce checkout flows and one-click purchase.",
            "Cross-border ecommerce to US is significant — Canadian consumers frequently buy from Amazon.com, Etsy, and eBay in USD with FX-friendly cards (Wealthsimple, RBC Avion).",
            "Cash has collapsed to ~2% of payments — one of the lowest in the developed world. COVID-era contactless adoption never reversed.",
            "Rogers Bank, Tangerine, and Simplii Financial are the main digital challenger banks. Wealthsimple is the largest neobank with 2M+ users.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "UAE": {
        "overview": {
            "Population (2024)":                 "10M",
            "GDP nominal (2024)":                "$515B",
            "Ecommerce market (2026e)":          "$17B (CAGR 14%)",
            "Online users (2024)":               "10M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "Jaywan",
            "a2a":     "UAE FTS / Aani (instant)",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Samsung Pay","type": "Wallet"},
                {"name": "PayBy",      "type": "Wallet"},
                {"name": "Tabby",      "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 36, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 19.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Google Pay, PayBy", "share": 15, "growth": "+28% YoY"},
            {"name": "BNPL", "detail": "Tabby, Cashew, Postpay", "share": 10, "growth": "+35% YoY"},
            {"name": "Cash", "share": 8, "growth": "-12% YoY"},
            {"name": "A2A", "detail": "Aani", "share": 6, "growth": "+40% YoY"},
        ],
        "regulation": [
            "CBUAE (Central Bank of the UAE) is the primary regulator. Federal Decree No. 6 of 2025 consolidated regulation of banks, PSPs, and insurers; compliance deadline is September 16, 2026.",
            "ADGM (Abu Dhabi Global Market) and DIFC (Dubai International Financial Centre) are common-law free zones with separate fintech and crypto regulatory frameworks.",
            "VARA (Virtual Assets Regulatory Authority) oversees crypto and digital assets in Dubai. Enforcement has been active — KuCoin halted 2026, 19 firms sanctioned 2025.",
            "Aani (instant payment rail launched 2023) is mandatory for banks — moving to real-time retail transfers, QR interop, and request-to-pay.",
            "VAT at 5% (lowest in the OECD); Excise Tax on tobacco, sugary drinks, etc. No personal income tax. Corporate tax at 9% introduced 2023 on profits above AED 375K.",
            "Data protection under Federal Decree-Law 45/2021 (PDPL) aligns with GDPR. Free zones (DIFC, ADGM) maintain their own data laws.",
        ],
        "digital_trends": [
            "UAE has the world's highest smartphone penetration and near-universal internet. Card and wallet acceptance is ubiquitous in Dubai and Abu Dhabi.",
            "Tabby (now unicorn) and Cashew lead BNPL; usage is common across fashion, electronics, and travel. Tamara (Saudi-HQ) also operates in UAE.",
            "UAE is a major cross-border shopping corridor — Arab, Indian, and Asian consumers buy from the UAE; UAE residents buy from US, China, and UK.",
            "Apple Pay adoption is the highest in MENA — Dubai Metro, retail chains, and SMBs universally accept it.",
            "Dubai is a global crypto hub despite VARA enforcement — licensed exchanges (Binance MENA, Bybit, BitOasis) are concentrated here.",
            "Saudi Vision 2030 and UAE's fintech strategy are driving aggressive B2B innovation — embedded finance, SME lending, and treasury tools are all well-funded sectors.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Saudi Arabia": {
        "overview": {
            "Population (2024)":                 "36M",
            "GDP nominal (2024)":                "$1.07T",
            "Ecommerce market (2026e)":          "$20B (CAGR 16%)",
            "Online users (2024)":               "35M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "97%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "mada",
            "a2a":     "sarie (instant) / SADAD",
            "apms":    [
                {"name": "mada Pay",   "type": "Debit / A2A"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "STC Pay",    "type": "Wallet"},
                {"name": "Tamara",     "type": "BNPL"},
                {"name": "urpay",      "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "detail": "mada", "share": 30, "growth": "+4% YoY",
                "schemes": [
                    {"name": "mada", "share": 28.5, "type": "local"},
                    {"name": "Visa Debit", "share": 0.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 0.7, "type": "international"},
                ]},
            {"name": "Credit Cards", "share": 22, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 11.0, "type": "international"},
                    {"name": "Mastercard", "share":  9.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, STC Pay, urpay", "share": 18, "growth": "+30% YoY"},
            {"name": "BNPL", "detail": "Tamara, Tabby", "share": 12, "growth": "+40% YoY"},
            {"name": "A2A", "detail": "sarie, SADAD", "share": 10, "growth": "+25% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
        ],
        "regulation": [
            "SAMA (Saudi Central Bank) regulates banks, PSPs, and insurance. The Fintech Saudi initiative and Vision 2030 drive sector investment.",
            "mada is SAMA's mandatory domestic scheme — every Saudi-issued debit card is mada-branded and must support the local switch. International co-badging with Visa/MC is standard.",
            "Saudi Open Banking Program launched 2022; Phase 2 (payment initiation) went live 2024. SAMA is driving fintech access to bank APIs on a phased mandate.",
            "VAT at 15% applies universally. Corporate tax for foreign investors is 20%. Zakat applies to Saudi/GCC-owned businesses instead of corporate tax.",
            "PDPL (Personal Data Protection Law) became fully enforceable in September 2024; SDAIA is the authority. Data localization applies to sensitive personal data.",
            "sarie is SAMA's 24/7 instant payment rail (launched 2021) — free for P2P, real-time settlement, and mandatory bank participation.",
        ],
        "digital_trends": [
            "Saudi Arabia is transitioning from cash-heavy to digital-first at pace. Cash share has dropped from ~40% pre-COVID to <10% in urban centers.",
            "Tamara (Saudi unicorn) is the largest BNPL in the region — $800M+ revenue in 2025. Tabby (UAE) is the #2 competitor.",
            "STC Pay (owned by STC, Saudi Telecom) is the largest wallet with 15M+ users. urpay (Tawuniya) is growing. Apple Pay has over 15M regular users.",
            "Vision 2030 has funneled ~$20B into fintech, with NEOM, tourism, and entertainment creating new payment corridors (Riyadh Season, Expo 2030).",
            "Cross-border ecommerce is huge — Saudis are among the top per-capita spenders on Shein, Amazon.com, and Aliexpress. Multi-currency acquiring is essential.",
            "Open Banking is ahead of most emerging markets; expect payment initiation and subscription VRPs to dominate the next growth cycle.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Israel": {
        "overview": {
            "Population (2024)":                 "9.7M",
            "GDP nominal (2024)":                "$530B",
            "Ecommerce market (2026e)":          "$12B (CAGR 9%)",
            "Online users (2024)":               "9M",
            "Internet penetration (2024)":       "93%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "Isracard",
            "a2a":     "Zahav / Bit",
            "apms":    [
                {"name": "Bit",        "type": "Wallet / P2P"},
                {"name": "PayBox",     "type": "Wallet"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 55, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 25.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "Isracard",   "share":  8.0, "type": "local"},
                    {"name": "Amex",       "share":  4.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Bit, PayBox, Apple Pay", "share": 20, "growth": "+25% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "flat",
                "schemes": [
                    {"name": "Visa Debit", "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro", "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "share": 8, "growth": "+18% YoY"},
            {"name": "Cash", "share": 5, "growth": "-15% YoY"},
            {"name": "BNPL", "share": 2, "growth": "+30% YoY"},
        ],
        "regulation": [
            "Bank of Israel regulates banking and payment services. CMISA (Capital Markets, Insurance and Savings Authority) regulates non-bank PSPs and wallets.",
            "The Payment Services Law (2019, effective 2020) harmonized PSP licensing and aligned Israel with PSD2-like standards. Open Banking rollout is phased through 2026.",
            "Isracard, CAL, and Max are the dominant domestic card processors/networks; international cards co-exist, but Isracard-issued cards are everywhere in Israel.",
            "Credit card use is unusually high (~55%) — Israelis heavily use installment payments (tashlumim), comparable to Brazil's parcelamento culture.",
            "VAT at 17% applies; foreign digital service providers must register under Sec 33A of the VAT Law. Enforcement is active.",
            "Israel's AML regime is robust (FATF-compliant); financial technology oversight includes crypto, with the ISA licensing exchanges.",
        ],
        "digital_trends": [
            "Bit (Poalim) and PayBox (Discount Bank) are wallet leaders — P2P transfers, QR at POS, and split-bill features drive daily use.",
            "Installment culture keeps credit cards dominant; merchants commonly offer 3–12 interest-free installments as a checkout incentive.",
            "Israel's tech scene means fintech adoption is early-majority for most new products — Apple Pay, Google Pay, and wallet-to-card linking spread fast.",
            "Cross-border ecommerce is significant — Amazon, Aliexpress, and SHEIN are major; USD and EUR acquiring is common.",
            "Real-time payments (instant RTGS) are moving forward under Bank of Israel's Zahav upgrade; consumer-facing rails are still banking-app based.",
            "Crypto regulation is stricter than UAE but exchanges operate openly under ISA supervision; stablecoins are used for B2B and cross-border.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Turkey": {
        "overview": {
            "Population (2024)":                 "85M",
            "GDP nominal (2024)":                "$1.1T",
            "Ecommerce market (2026e)":          "$50B (CAGR 20%)",
            "Online users (2024)":               "71M",
            "Internet penetration (2024)":       "84%",
            "Smartphone penetration (2024)":     "80%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "Troy",
            "a2a":     "FAST (instant)",
            "apms":    [
                {"name": "Papara",      "type": "Wallet"},
                {"name": "BKM Express", "type": "Wallet"},
                {"name": "iyzico",      "type": "PSP"},
                {"name": "Ininal",      "type": "Prepaid wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "detail": "with taksit (installments)", "share": 48, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 22.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "Troy",       "share":  6.0, "type": "local"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "FAST", "share": 15, "growth": "+35% YoY"},
            {"name": "Debit Cards", "share": 15, "growth": "flat",
                "schemes": [
                    {"name": "Visa Debit", "share": 8.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.0, "type": "international"},
                    {"name": "Maestro", "share": 0.8, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Papara, BKM Express", "share": 12, "growth": "+28% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+30% YoY"},
            {"name": "Cash", "share": 5, "growth": "-10% YoY"},
        ],
        "regulation": [
            "CBRT (Central Bank) and BDDK (Banking Regulation and Supervision Agency) co-regulate. PSPs and e-money institutions operate under Law 6493 (2013).",
            "BKM (Bankalararası Kart Merkezi) is the bank-owned interbank card center and runs Troy, BKM Express, and the TROY domestic scheme.",
            "High inflation (>60% recent years) drives unusual payment behavior — Turks heavily use credit-card taksit (installments), typically 3–12 months interest-free.",
            "FAST (Fon Aktarım Sistemi, 2021) is CBRT's instant payment rail — operates 24/7, has overtaken traditional EFT for retail transfers.",
            "Crypto was banned as a payment method in 2021 but remains legal for investing; Turkey is a top-5 global crypto-active market by volume. Stablecoin USDT is widely used.",
            "Data protection under KVKK (Law 6698) predates GDPR. Cross-border transfers require Data Protection Authority approval absent adequacy.",
        ],
        "digital_trends": [
            "Turkey has one of the highest credit-card penetration rates in emerging markets (~2 cards per adult). Taksit culture shapes consumer behavior.",
            "iyzico (Turkish unicorn, acquired by PayU then relaunched) is the dominant ecommerce gateway. Papara is the leading fintech wallet with 20M+ users.",
            "Trendyol (Alibaba-backed) and Hepsiburada dominate marketplace ecommerce. Both have proprietary wallets and installment products.",
            "BNPL usage is growing fast on top of the existing taksit infrastructure — products like Tikla Al, Lydians, and Enpara's BNPL are expanding.",
            "Cross-border ecommerce from Turkey into MENA and EU is a major B2B flow — Turkish manufacturers selling to Gulf/Europe via B2B platforms.",
            "Inflation and FX volatility have driven stablecoin adoption — CBDC (Digital Lira) pilots are in advanced stages at CBRT.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Qatar": {
        "overview": {
            "Population (2024)":                 "3M",
            "GDP nominal (2024)":                "$220B",
            "Ecommerce market (2026e)":          "$6B (CAGR 15%)",
            "Online users (2024)":               "2.9M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "97%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Fawran (instant)",
            "apms":    [
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "QPay",      "type": "Wallet"},
                {"name": "CWallet",   "type": "Wallet"},
                {"name": "Ooredoo Money","type": "Mobile money"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 40, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 16.0, "type": "international"},
                    {"name": "Amex",       "share":  4.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, QPay", "share": 15, "growth": "+26% YoY"},
            {"name": "A2A", "detail": "Fawran", "share": 10, "growth": "+30% YoY"},
            {"name": "Cash", "share": 7, "growth": "-12% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+35% YoY"},
        ],
        "regulation": [
            "QCB (Qatar Central Bank) regulates banks, payment services, and insurance. Its 2022 strategic plan modernized PSP licensing and introduced the Digital Payments Sandbox.",
            "NAPS is the QCB-owned domestic network mandated on Qatari-issued cards; co-badging with Visa/Mastercard is standard.",
            "Fawran (launched 2023) is Qatar's real-time payments rail — free P2P, QR, and request-to-pay. Adoption grew rapidly post World Cup 2022.",
            "VAT has been legislatively ready since 2018 but not yet implemented; excise tax at 50–100% applies to tobacco, sugary drinks, etc.",
            "Data protection under Law No. 13 of 2016 predates GDPR but has been reinforced via Qatar National Cyber Security Strategy.",
            "Qatar Financial Centre (QFC) is a separate common-law jurisdiction with its own fintech licensing (QFCRA) similar to DIFC or ADGM.",
        ],
        "digital_trends": [
            "World Cup 2022 accelerated Qatar's digital payment infrastructure — contactless, Apple Pay, and QR penetration jumped dramatically.",
            "Qatar has the highest per-capita ecommerce spend in MENA (small population + high income). Luxury retail, travel, and electronics dominate.",
            "QPay and CWallet drive most wallet usage; expatriate workforce relies heavily on Ooredoo Money and Vodafone Cash for remittance-receipt.",
            "Cross-border ecommerce is huge — Qataris buy from UAE/US/UK at high per-transaction value. Multi-currency acquiring is important.",
            "BNPL is early but growing fast — Tabby and Tamara both operate in Qatar. Regulation under QCB's consumer-credit framework is expected 2026.",
            "Crypto is legal but limited — QFCRA licenses digital-asset platforms under a narrow framework; retail crypto trading is not encouraged.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Kuwait": {
        "overview": {
            "Population (2024)":                 "4.3M",
            "GDP nominal (2024)":                "$165B",
            "Ecommerce market (2026e)":          "$5B (CAGR 14%)",
            "Online users (2024)":               "4.1M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "96%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "KNET",
            "a2a":     "KNET-IPP (instant)",
            "apms":    [
                {"name": "KNET",         "type": "Debit / A2A"},
                {"name": "Apple Pay",    "type": "Wallet"},
                {"name": "Hesabe",       "type": "Wallet / PSP"},
                {"name": "Tap Payments", "type": "PSP"},
                {"name": "MyFatoorah",   "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "detail": "KNET", "share": 40, "growth": "+4% YoY",
                "schemes": [
                    {"name": "KNET", "share": 34.0, "type": "local"},
                    {"name": "Visa Debit", "share": 3.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.7, "type": "international"},
                ]},
            {"name": "Credit Cards", "share": 25, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Hesabe", "share": 15, "growth": "+22% YoY"},
            {"name": "A2A", "share": 10, "growth": "+20% YoY"},
            {"name": "Cash", "share": 6, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+30% YoY"},
        ],
        "regulation": [
            "CBK (Central Bank of Kuwait) regulates banks and PSPs. Instructions on Electronic Payments (2018, updated 2023) define PSP and e-money licensing.",
            "KNET is a bank consortium running the dominant domestic card scheme — nearly 100% of Kuwaiti debit cards are KNET-branded.",
            "No VAT implemented yet (politically delayed since 2018 GCC agreement); corporate tax applies only to foreign businesses.",
            "Kuwait Vision 2035 drives fintech investment; Regulatory Sandbox at CBK has licensed many entrants including Tap Payments and Myzoi.",
            "Data protection under Law No. 20 of 2014 (IT-focused) rather than a comprehensive PDPL — broader GDPR-aligned law in draft.",
            "AML/CFT framework (Law 106 of 2013) is FATF-compliant. Financial Intelligence Unit (KFIU) oversees compliance.",
        ],
        "digital_trends": [
            "KNET is culturally entrenched — ecommerce checkouts always include a KNET 'direct debit' redirect option; international cards are secondary.",
            "Tap Payments (Kuwait origin, now regional) serves as the primary gateway for SMBs and mid-market ecommerce.",
            "MyFatoorah and Hesabe drive subscription billing and recurring payment use cases — especially for education and SaaS.",
            "Cross-border shopping to UAE and Saudi is common; Kuwaiti cards work seamlessly across GCC.",
            "BNPL (Tabby, Tamara) is scaling quickly though from a smaller base than UAE/Saudi.",
            "CBDC research is ongoing at CBK but no retail pilot has been announced.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Bahrain": {
        "overview": {
            "Population (2024)":                 "1.5M",
            "GDP nominal (2024)":                "$47B",
            "Ecommerce market (2026e)":          "$2B (CAGR 15%)",
            "Online users (2024)":               "1.45M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "96%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "BenefitPay / Fawri+",
            "apms":    [
                {"name": "BenefitPay",   "type": "Wallet / QR"},
                {"name": "Apple Pay",    "type": "Wallet"},
                {"name": "Tap Payments", "type": "PSP"},
                {"name": "Eazy Pay",     "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 32, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 17.0, "type": "international"},
                    {"name": "Mastercard", "share": 12.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "BENEFIT", "share": 30, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 16.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.0, "type": "international"},
                    {"name": "Maestro", "share": 1.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "BenefitPay, Apple Pay", "share": 18, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "Fawri+, EFTS", "share": 10, "growth": "+22% YoY"},
            {"name": "Cash", "share": 6, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+35% YoY"},
        ],
        "regulation": [
            "CBB (Central Bank of Bahrain) is the primary regulator; Bahrain has one of the most progressive GCC fintech frameworks with the Regulatory Sandbox launched 2017.",
            "Open Banking (PSD2-style) was mandated by CBB in 2018 — Bahrain was the first GCC country to do so. Full API access is live across all banks.",
            "VAT at 10% (increased from 5% in 2022). Foreign digital service providers must register via a simplified online regime.",
            "BENEFIT (bank consortium) runs the domestic payment switch — BenefitPay, Fawri, and Fawri+ cover POS, A2A, and QR.",
            "Crypto is licensed through CBB's Digital Assets framework (2019); Bahrain hosts several regional crypto exchanges (Rain, CoinMENA).",
            "Data protection under PDPL (2018) is GDPR-aligned; the Personal Data Protection Authority enforces.",
        ],
        "digital_trends": [
            "Bahrain punches above its weight in fintech — home of Bahrain Fintech Bay and progressive sandbox programs. Many regional fintechs test here first.",
            "BenefitPay has 60%+ adult adoption — QR and P2P payments are everyday behavior at most retailers and SMBs.",
            "Cross-border with Saudi Arabia (causeway access) creates a dual-market dynamic — many Saudis shop/work in Bahrain.",
            "Cash has collapsed to <10% of payments — one of the fastest digital transitions in MENA.",
            "Fintech licensing and Open Banking have attracted regional PSPs (Tap, PayTabs) to headquarter operations in Bahrain.",
            "Tourism (Formula 1, GCC visitors) supports strong POS acquiring infrastructure and multi-currency acceptance.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Oman": {
        "overview": {
            "Population (2024)":                 "5M",
            "GDP nominal (2024)":                "$110B",
            "Ecommerce market (2026e)":          "$3B (CAGR 14%)",
            "Online users (2024)":               "4.8M",
            "Internet penetration (2024)":       "96%",
            "Smartphone penetration (2024)":     "92%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "OmanNet",
            "a2a":     "Mobile Payment Clearing and Settlement System (MPCSS)",
            "apms":    [
                {"name": "Thawani",   "type": "Wallet / PSP"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "ONEPAY",    "type": "Wallet"},
                {"name": "BankDhofar Mobile","type": "Bank app"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 14.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "OmanNet", "share": 30, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 16.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.0, "type": "international"},
                    {"name": "Maestro", "share": 1.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Thawani, Apple Pay", "share": 16, "growth": "+26% YoY"},
            {"name": "A2A", "share": 10, "growth": "+22% YoY"},
            {"name": "Cash", "share": 12, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+32% YoY"},
        ],
        "regulation": [
            "CBO (Central Bank of Oman) regulates banks and PSPs. PSP Regulatory Framework (2020) defines licensing for e-money and payment services.",
            "VAT at 5% (introduced 2021). Excise tax on tobacco, sugary drinks applies. No personal income tax (planned but postponed).",
            "Thawani is the Oman Fintech Sandbox's flagship graduate — now a major wallet and merchant acquirer licensed by CBO.",
            "Open Banking framework was issued by CBO in 2023; phased rollout with APIs mandated through 2026.",
            "Oman Vision 2040 drives diversification away from oil; fintech is a priority sector with tax breaks in Duqm Free Zone.",
            "Data protection under Royal Decree 6/2022 (PDPL) aligns with GDPR; Ministry of Transport, Communications and IT is the authority.",
        ],
        "digital_trends": [
            "Oman's digital transformation is steady but slightly behind UAE/Saudi. Cash is still ~12% of transactions but dropping.",
            "Thawani dominates wallet activity with broad SMB acceptance — government pushed it as part of digital government services.",
            "OmanNet debit cards are ubiquitous; most domestic ecommerce supports the OmanNet redirect option alongside Visa/Mastercard.",
            "Cross-border shopping skews UAE (via Dubai) and India (remittances). Multi-currency acquiring valuable for retailers.",
            "Apple Pay adoption is rising; deal between CBO and Apple in 2024 expanded issuing bank support.",
            "Remittance corridors (India, Pakistan, Bangladesh) are large given expat workforce; fintechs are entering traditional MTO territory.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Jordan": {
        "overview": {
            "Population (2024)":                 "11M",
            "GDP nominal (2024)":                "$50B",
            "Ecommerce market (2026e)":          "$1.5B (CAGR 17%)",
            "Online users (2024)":               "9.5M",
            "Internet penetration (2024)":       "88%",
            "Smartphone penetration (2024)":     "80%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "JoMoPay / CliQ",
            "apms":    [
                {"name": "CliQ",         "type": "A2A / instant transfer"},
                {"name": "eFAWATEERcom", "type": "Bill pay"},
                {"name": "HyperPay",     "type": "PSP"},
                {"name": "MadfoatCom",   "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 30, "growth": "-8% YoY"},
            {"name": "Credit Cards", "share": 22, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 11.0, "type": "international"},
                    {"name": "Mastercard", "share":  9.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 18, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 7.2, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "A2A", "detail": "CliQ, JoMoPay", "share": 15, "growth": "+35% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+25% YoY"},
            {"name": "BNPL / Other", "share": 5, "growth": "+28% YoY"},
        ],
        "regulation": [
            "CBJ (Central Bank of Jordan) regulates banks and PSPs. Electronic Transactions and Electronic Money regulations define licensing.",
            "JoPACC (Jordan Payments and Clearing Company) runs the domestic rails — CliQ (instant transfer), JoMoPay (mobile money), and eFAWATEERcom (bill pay).",
            "CliQ launched 2020 as the instant-transfer rail; free for consumers and mandatory for banks. Adoption growing rapidly.",
            "VAT (GST) at 16% applies; enforcement on foreign digital service providers is moderate.",
            "Fintech regulatory sandbox (FRS) at CBJ has licensed multiple entrants; supportive stance on fintech innovation.",
            "Data protection law (2023) aligns broadly with GDPR; implementation ongoing.",
        ],
        "digital_trends": [
            "Jordan is a digital-fintech laboratory for the Levant — JoPACC's rails are increasingly adopted by smaller markets like Iraq and Lebanon.",
            "Remittances are ~10% of GDP; Saudi and UAE corridors dominate. Fintechs and stablecoin rails competing with traditional MTOs.",
            "Cash is still ~30% of transactions — banking inclusion is ~50% of adults. CliQ is the main lever for digitization.",
            "Ecommerce is young but growing fast — Amazon (via UAE), Jumia, and local players like Mumzworld serve the market.",
            "Cross-border with Gulf is significant — Jordanians working in Saudi/UAE drive major inflows.",
            "Fintech ecosystem has strong regulatory support but limited domestic capital; most successful startups expand regionally or relocate.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Lebanon": {
        "overview": {
            "Population (2024)":                 "5.3M",
            "GDP nominal (2024)":                "$22B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 10%)",
            "Online users (2024)":               "4.7M",
            "Internet penetration (2024)":       "89%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "RTGS (BDL), limited retail instant",
            "apms":    [
                {"name": "OMT",        "type": "Cash / transfer"},
                {"name": "Whish Money","type": "Wallet / transfer"},
                {"name": "BLF Connect","type": "Banking app"},
                {"name": "Cliq Pay",   "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash USD", "share": 50, "growth": "+5% YoY"},
            {"name": "Credit Cards", "share": 18, "growth": "flat",
                "schemes": [
                    {"name": "Visa",       "share": 10.0, "type": "international"},
                    {"name": "Mastercard", "share":  7.0, "type": "international"},
                    {"name": "Amex",       "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 10, "growth": "-4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro", "share": 0.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Whish, OMT", "share": 10, "growth": "+22% YoY"},
            {"name": "A2A", "share": 7, "growth": "+18% YoY"},
            {"name": "Crypto / USDT", "share": 5, "growth": "+50% YoY"},
        ],
        "regulation": [
            "BDL (Banque du Liban) is the central bank — but Lebanon's banking sector has been in systemic crisis since 2019. Most ATMs and card networks are constrained.",
            "De facto dual-currency economy (LBP + USD) with multiple exchange rates. Since 2023, most commerce prices in USD.",
            "Crypto/stablecoin adoption is among the highest globally as a dollarization and capital-controls workaround. USDT on Tron rails is dominant.",
            "VAT at 11% applies (in LBP); USD-denominated transactions are semi-formally taxed. Compliance is loose.",
            "OMT (Online Money Transfer) and Whish Money are the dominant remittance and P2P operators — both operate outside traditional banking rails.",
            "No formal fintech licensing framework; most digital wallets operate under BDL's Basic Circular 69 (e-money).",
        ],
        "digital_trends": [
            "Lebanon is a dollarized cash economy with ~50% of transactions in USD cash. Card usage has collapsed since 2019 banking crisis.",
            "Stablecoins (USDT) are widely used for savings and cross-border — Lebanon has one of the world's highest per-capita USDT wallet counts.",
            "Whish Money and OMT dominate digital transfers. Both accept and dispense cash USD.",
            "Ecommerce is small and tourism-dependent; international acceptance issues mean many cross-border purchases route via family abroad.",
            "Diaspora (estimated 15M+ globally) drives remittance flows 2-3x the domestic economy.",
            "Rebuilding the banking system and payment rails is a medium-term project; fintech innovation is constrained by macro instability.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Iraq": {
        "overview": {
            "Population (2024)":                 "44M",
            "GDP nominal (2024)":                "$270B",
            "Ecommerce market (2026e)":          "$2B (CAGR 22%)",
            "Online users (2024)":               "33M",
            "Internet penetration (2024)":       "75%",
            "Smartphone penetration (2024)":     "70%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "IIPS (Instant Payment System)",
            "apms":    [
                {"name": "Qi Card",  "type": "Prepaid / debit"},
                {"name": "Zain Cash","type": "Mobile money"},
                {"name": "AsiaHawala","type": "Remittance"},
                {"name": "NameCard", "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 55, "growth": "-5% YoY"},
            {"name": "Prepaid / Debit", "detail": "Qi Card, KI Card", "share": 15, "growth": "+10% YoY"},
            {"name": "Wallets", "detail": "Zain Cash, AsiaHawala", "share": 12, "growth": "+30% YoY"},
            {"name": "Credit Cards", "share": 8, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 4.0, "type": "international"},
                    {"name": "Mastercard", "share": 3.0, "type": "international"},
                    {"name": "Amex",       "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "IIPS", "share": 7, "growth": "+25% YoY"},
            {"name": "Crypto / Other", "share": 3, "growth": "+40% YoY"},
        ],
        "regulation": [
            "CBI (Central Bank of Iraq) regulates banks and payment services. Banking Law 94/2004 is the primary framework; PSP regulation modernized in 2020s.",
            "Qi Card (International Smart Card — ISC) and KI Card (Kurdistan) are the dominant payroll/prepaid cards — government salaries load there.",
            "Banking penetration is ~20% of adults; cash remains dominant for ~55% of all transactions.",
            "VAT is not yet implemented (politically delayed). Customs duties and excise taxes apply.",
            "Iraq's banking is split by region — Erbil (Kurdistan) operates semi-autonomously with different payment rails and banking sector dynamics.",
            "USD is widely used alongside IQD; most large transactions settle in USD cash.",
        ],
        "digital_trends": [
            "Cash remains king — one of the most cash-intensive economies in the region. Government payroll digitization via Qi Card has pushed ~10M people into digital.",
            "Zain Cash is the largest mobile money operator — 10M+ users, backed by telco Zain. Accepted for bill pay and P2P transfers nationwide.",
            "Ecommerce growth is rapid from a tiny base — Miswag, Talabat, and Uber Eats dominate urban delivery.",
            "Cross-border remittances are large (from Gulf, Turkey, Jordan); both traditional MTOs and crypto rails (USDT P2P) are heavily used.",
            "Security and political instability remain headwinds for payment infrastructure; Erbil has better banking access than Baghdad.",
            "CBI and government are pushing digitization through Qi Card's broader acceptance and agent-banking networks.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Iran": {
        "overview": {
            "Population (2024)":                 "89M",
            "GDP nominal (2024)":                "$400B",
            "Ecommerce market (2026e)":          "$12B (CAGR 15%)",
            "Online users (2024)":               "75M",
            "Internet penetration (2024)":       "84%",
            "Smartphone penetration (2024)":     "78%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Paya / Satna",
            "apms":    [
                {"name": "Shaparak",   "type": "Domestic card network"},
                {"name": "Pasargad",   "type": "Bank"},
                {"name": "Zarinpal",   "type": "PSP"},
                {"name": "IDPay",      "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "detail": "Shetab domestic", "share": 60, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Shetab debit", "share": 57.0, "type": "local"},
                    {"name": "Visa Debit", "share": 1.7, "type": "international"},
                    {"name": "Mastercard Debit", "share": 1.3, "type": "international"},
                ]},
            {"name": "Cash", "share": 15, "growth": "-5% YoY"},
            {"name": "A2A", "detail": "Paya / Satna", "share": 12, "growth": "+18% YoY"},
            {"name": "Wallets", "share": 7, "growth": "+25% YoY"},
            {"name": "Crypto", "share": 5, "growth": "+40% YoY"},
            {"name": "Credit / Other", "share": 1, "growth": "flat"},
        ],
        "regulation": [
            "CBI (Central Bank of Iran) regulates all banking and payments. Shaparak is the national payment switch — all POS and ecommerce card transactions route through it.",
            "US and EU sanctions isolate Iran from Visa, Mastercard, and international card networks. Iranian-issued cards work domestically but not abroad.",
            "Fintech sector has grown despite sanctions — Zarinpal, IDPay, and IranKish PSPs dominate domestic ecommerce.",
            "Crypto is widely used as a sanctions and inflation hedge; CBI has historically fluctuated between banning and permitting crypto mining/trading.",
            "VAT at 9% applies. Digital service tax and e-invoice requirements are increasingly enforced.",
            "Data protection is loosely defined; most internet infrastructure is filtered, affecting how fintechs deploy services.",
        ],
        "digital_trends": [
            "Iran has the highest ecommerce market in MENA by volume (population-driven) despite sanctions — Digikala is the Amazon equivalent with massive share.",
            "Shaparak handles nearly 100% of card transactions — efficient and ubiquitous within the country but disconnected from global networks.",
            "Crypto adoption is very high; USDT on Tron is the most common stablecoin used for cross-border.",
            "Cross-border payments are bottlenecked — international merchants cannot accept Iranian cards; consumers route via friends/family abroad or crypto.",
            "Domestic fintech is vibrant — Digikala Pay, Snapp, Tapsi, and major banking apps serve a mobile-first population.",
            "Sanctions relief (if ever) would unlock massive ecommerce growth; current state is a bubble world of ~$12B disconnected from global rails.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Uruguay": {
        "overview": {
            "Population (2024)":                 "3.4M",
            "GDP nominal (2024)":                "$75B",
            "Ecommerce market (2026e)":          "$3B (CAGR 14%)",
            "Online users (2024)":               "2.9M",
            "Internet penetration (2024)":       "88%",
            "Smartphone penetration (2024)":     "82%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Transferencias instantáneas (BCU)",
            "apms":    [
                {"name": "Redpagos",  "type": "Cash voucher"},
                {"name": "Abitab",    "type": "Cash voucher"},
                {"name": "Peso",      "type": "Wallet"},
                {"name": "Mi Dinero", "type": "Prepaid wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 32, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 15.0, "type": "international"},
                    {"name": "Mastercard", "share": 12.0, "type": "international"},
                    {"name": "OCA",        "share":  4.0, "type": "local"},
                    {"name": "Amex",       "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 30, "growth": "+6% YoY",
                "schemes": [
                    {"name": "OCA Débito", "share": 3.6, "type": "local"},
                    {"name": "Visa Debit", "share": 14.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 11.9, "type": "international"},
                ]},
            {"name": "Cash", "detail": "Redpagos, Abitab", "share": 14, "growth": "-5% YoY"},
            {"name": "A2A", "detail": "BCU instant", "share": 12, "growth": "+20% YoY"},
            {"name": "Wallets", "detail": "Peso, Mi Dinero", "share": 8, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+15% YoY"},
        ],
        "regulation": [
            "BCU (Banco Central del Uruguay) regulates all payment institutions. Wallets and e-money issuers require an IEDE (Institución Emisora de Dinero Electrónico) license with segregated client funds.",
            "Uruguay's financial inclusion law (Ley 19.210, 2014) mandated electronic payments for salary, pensions, and tax. This drove one of the fastest cash-to-card transitions in LatAm.",
            "Tax compliance is tight: IVA at 22%, IRPF (personal income tax) and IRAE (corporate tax) apply. Foreign digital service providers register through a simplified e-commerce regime.",
            "Free Trade Zones (Zonamerica, WTC) host many regional HQs — Uruguay is often used as a LatAm hub by global fintechs and PSPs because of stable currency and legal environment.",
            "Data protection (Ley 18.331) aligns with GDPR; Uruguay is on the EU adequacy list, which makes it a preferred LatAm location for data processing and cross-border data flows.",
            "BCU is piloting a Digital Peso (e-Peso) with select banks; formal launch expected 2027. This would be one of the first LatAm retail CBDCs in production.",
        ],
        "digital_trends": [
            "Uruguay is the most banked LatAm country (95%+ adult bank account ownership). This makes card and bank-transfer rails dominant over cash vouchers.",
            "Mercado Pago and dLocal are both Uruguayan unicorns. dLocal IPO'd on NASDAQ in 2021; their cross-border rails are used by Amazon, Microsoft, Google, and Shopify for LatAm+EMEA settlement.",
            "Retail super-apps are less developed than Brazil/Argentina — Uruguayan consumers favor cards and bank apps. Prex (prepaid Visa) and Peso (QR wallet) are the main fintech entrants.",
            "Cross-border ecommerce is relatively small (~$400M) due to high import duties and courier costs. Most digital spend is domestic subscriptions, travel, and marketplaces.",
            "Free-zone PSP operations allow regional HQ structures — Yuno, dLocal, EBANX, and PagSeguro all have teams in Uruguay leveraging the legal and tax stability.",
            "BCU e-Peso pilots and Open Banking consultation are running in parallel; Uruguay is a test-bed for LatAm regulators and often ships reforms before Argentina or Brazil.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Singapore": {
        "overview": {
            "Population (2024)":                 "5.9M",
            "GDP nominal (2024)":                "$500B",
            "Ecommerce market (2026e)":          "$18B (CAGR 9%)",
            "Online users (2024)":               "5.7M",
            "Internet penetration (2024)":       "96%",
            "Smartphone penetration (2024)":     "94%",
            "In-Store : Ecommerce ratio (2024)": "78 : 22",
        },
        "local_payments": {
            "scheme":  "NETS",
            "a2a":     "PayNow / FAST",
            "apms":    [
                {"name": "PayNow",     "type": "A2A"},
                {"name": "GrabPay",    "type": "Wallet"},
                {"name": "DBS PayLah", "type": "Wallet"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 50, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 22.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "Amex",       "share":  7.0, "type": "international"},
                    {"name": "Diners",     "share":  3.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "PayNow, FAST", "share": 18, "growth": "+22% YoY"},
            {"name": "Debit Cards", "detail": "NETS", "share": 15, "growth": "+2% YoY",
                "schemes": [
                    {"name": "NETS", "share": 9.0, "type": "local"},
                    {"name": "Visa Debit", "share": 3.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.7, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "GrabPay, PayLah, Apple Pay", "share": 12, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Atome, ShopBack Pay", "share": 4, "growth": "+28% YoY"},
            {"name": "Cash", "share": 1, "growth": "-15% YoY"},
        ],
        "regulation": [
            "MAS (Monetary Authority of Singapore) is the unified financial regulator. The Payment Services Act 2019 (amended 2021) covers account issuance, domestic transfers, cross-border, merchant acquisition, e-money, and digital payment tokens.",
            "MPI (Major Payment Institution) license is required for PSPs above thresholds — most international PSPs (Stripe, Adyen, Checkout.com, Worldpay) hold MPI licenses.",
            "PayNow is the instant-payment interoperability layer linking all Singapore banks, major wallets, and non-bank FIs — phone-number and NRIC-based transfers.",
            "GST at 9% applies; overseas vendor registration applies to digital services. Singapore signed API-based cross-border transfer corridors with India (UPI-PayNow), Thailand (PromptPay), and Malaysia (DuitNow).",
            "Stablecoin regulation (2023) requires 100% backing in HQLA and same-day redemption — one of the most stringent frameworks globally. Licensed issuers include StraitsX (XSGD).",
            "MAS's Project Orchid CBDC pilot and Project Guardian tokenization trials are positioning Singapore as a global digital-asset hub.",
        ],
        "digital_trends": [
            "Singapore is one of the world's most mature digital payment markets — credit cards dominate (~50%) due to rewards culture, with PayNow leading A2A growth.",
            "PayNow is the everyday P2P rail — bank accounts linked to phone numbers settle in seconds. Cross-border PayNow-UPI and PayNow-PromptPay corridors launched 2023/24.",
            "Grab (Singapore-HQ unicorn) dominates ride-hailing, food, and payments across SEA. GrabPay is accepted nationwide; GrabFin offers credit and insurance.",
            "MAS-licensed digital banks (Trust Bank, GXS, Maribank, ANEXT) launched 2022 — targeting SMEs and youth segments.",
            "Singapore is a global PSP hub — Stripe, Checkout.com, Airwallex, and Rapyd all have significant operations here.",
            "Cross-border subscription commerce is large — Singaporeans buy from US, Japan, and Europe at high per-transaction value; multi-currency acquiring is standard.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "China": {
        "overview": {
            "Population (2024)":                 "1.41B",
            "GDP nominal (2024)":                "$18T",
            "Ecommerce market (2026e)":          "$1.8T (CAGR 6%)",
            "Online users (2024)":               "1.09B",
            "Internet penetration (2024)":       "77%",
            "Smartphone penetration (2024)":     "75%",
            "In-Store : Ecommerce ratio (2024)": "72 : 28",
        },
        "local_payments": {
            "scheme":  "UnionPay",
            "a2a":     "IBPS / CIPS",
            "apms":    [
                {"name": "Alipay",       "type": "Wallet (Ant Group)"},
                {"name": "WeChat Pay",   "type": "Wallet (Tencent)"},
                {"name": "UnionPay",     "type": "Card / QR"},
                {"name": "Digital Yuan", "type": "CBDC (e-CNY)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "Alipay, WeChat Pay", "share": 68, "growth": "+6% YoY"},
            {"name": "Debit Cards", "detail": "UnionPay", "share": 18, "growth": "flat",
                "schemes": [
                    {"name": "UnionPay", "share": 18.0, "type": "local"},
                ]},
            {"name": "Credit Cards", "share": 8, "growth": "+4% YoY",
                "schemes": [
                    {"name": "UnionPay", "share": 5.0, "type": "local"},
                    {"name": "Visa",     "share": 2.0, "type": "international"},
                    {"name": "Mastercard","share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "IBPS, Digital Yuan", "share": 3, "growth": "+35% YoY"},
            {"name": "Cash", "share": 2, "growth": "-8% YoY"},
            {"name": "Other / BNPL", "share": 1, "growth": "+12% YoY"},
        ],
        "regulation": [
            "PBOC (People's Bank of China) regulates banking and payments. SAFE (State Administration of Foreign Exchange) controls cross-border FX. CAC (Cyberspace Administration) oversees data.",
            "The Non-Bank Payment Service Regulations (2024) tightened oversight of Alipay, WeChat Pay, and other PSPs — especially around merchant categorization and interest on prepaid balances.",
            "International card acceptance (Visa, Mastercard) is legal but limited — most merchants default to UnionPay or QR wallets. VisaPay-style cross-border gateways (WeChat Pay HK) are emerging.",
            "PIPL (Personal Information Protection Law, 2021) is GDPR-like with strict cross-border transfer rules. Data localization requirements apply to financial data.",
            "e-CNY (Digital Yuan) pilots span 20+ cities with 260M+ users. Formal rollout continues; commercial banks serve as distributors.",
            "Cross-border ecommerce into China runs on specific rails: Bonded Warehouse (BBC) or Direct Mail (BC). Only registered cross-border ecommerce platforms can integrate directly.",
        ],
        "digital_trends": [
            "China is the world's largest and most digital payment market — Alipay (1B+ users) and WeChat Pay (1B+ users) dominate with ~68% combined share.",
            "Cross-border merchants entering China almost always partner with Alipay Global, WeChat Pay HK, or UnionPay-linked gateways; direct Visa/Mastercard acceptance is edge-case.",
            "Super-app commerce (Taobao, Douyin/TikTok, Meituan, Pinduoduo) integrates checkout inside content — users rarely leave the app. Payments are wallet-native.",
            "Livestream commerce (via Taobao Live, Douyin) is >$700B annually — a payment flow dominated by Alipay and WeChat Pay.",
            "e-CNY adoption is growing but slowly at consumer level; major use cases remain B2B, government payments, and cross-border pilots.",
            "Hong Kong and Macau are separate payment jurisdictions despite China sovereignty — Alipay HK, WeChat Pay HK, and FPS operate under HKMA rules.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Japan": {
        "overview": {
            "Population (2024)":                 "124M",
            "GDP nominal (2024)":                "$4.2T",
            "Ecommerce market (2026e)":          "$200B (CAGR 7%)",
            "Online users (2024)":               "117M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "87%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "JCB",
            "a2a":     "Zengin (banking rail)",
            "apms":    [
                {"name": "PayPay",     "type": "Wallet (QR)"},
                {"name": "LINE Pay",   "type": "Wallet"},
                {"name": "Rakuten Pay","type": "Wallet"},
                {"name": "Apple Pay",  "type": "Wallet (Suica/iD/QUICPay)"},
                {"name": "Konbini",    "type": "Cash at convenience store"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 55, "growth": "+3% YoY",
                "schemes": [
                    {"name": "JCB",        "share": 24.0, "type": "local"},
                    {"name": "Visa",       "share": 18.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.0, "type": "international"},
                    {"name": "Amex / Diners","share":  3.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "PayPay, LINE Pay, Rakuten Pay", "share": 20, "growth": "+25% YoY"},
            {"name": "Konbini", "detail": "7-Eleven, Lawson, FamilyMart", "share": 10, "growth": "-3% YoY"},
            {"name": "A2A", "detail": "Zengin, Pay-easy", "share": 6, "growth": "+10% YoY"},
            {"name": "Debit Cards", "share": 5, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 2.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.0, "type": "international"},
                    {"name": "Maestro", "share": 0.2, "type": "international"},
                ]},
            {"name": "BNPL", "detail": "Paidy, NP Atobarai", "share": 4, "growth": "+18% YoY"},
        ],
        "regulation": [
            "FSA (Financial Services Agency) regulates banks, PSPs, and crypto. Payment Services Act and Funds Settlement Act govern e-money and prepaid instruments.",
            "Japan has one of the most fragmented wallet markets — PayPay (SoftBank/Yahoo) is now clearly largest but LINE Pay, Rakuten Pay, d-barai, au PAY, and Merpay all have meaningful share.",
            "JCB is Japan's international scheme — issued worldwide but most concentrated domestically. JCB-Visa-Mastercard co-badging is rare.",
            "Consumption tax at 10% applies; reduced rate (8%) for food and some essentials. Invoice-based e-receipts mandatory from 2023.",
            "Apple Pay integrates with local schemes: Suica (transit), iD (docomo), QUICPay (contactless). This is uniquely complex vs Western markets.",
            "Personal Information Protection Act (APPI, amended 2022) aligns closely with GDPR; cross-border transfers require adequacy or specific consent.",
        ],
        "digital_trends": [
            "Japan is a credit-card-heavy market (~55%) — highest in Asia. Rewards, points (dポイント, PayPay points, 楽天ポイント) drive heavy usage.",
            "Konbini cash payment (10% of ecommerce) remains culturally entrenched — customers print a slip, pay cash at 7-Eleven. Declining but slowly.",
            "QR code payments exploded post-2018 — PayPay went from zero to 55M+ users via aggressive cashback campaigns.",
            "Rakuten ecosystem is a super-app without the name — Rakuten Card, Rakuten Pay, Rakuten Bank, Rakuten Ichiba all interlock with points.",
            "Cross-border ecommerce into Japan has payment-method expectations (Konbini, JCB) that Western PSPs often underestimate.",
            "Digital yen (CBDC) pilots are ongoing but BOJ remains cautious; no commercial launch announced.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "South Korea": {
        "overview": {
            "Population (2024)":                 "52M",
            "GDP nominal (2024)":                "$1.7T",
            "Ecommerce market (2026e)":          "$170B (CAGR 8%)",
            "Online users (2024)":               "50M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "70 : 30",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Zeniths 24/7",
            "apms":    [
                {"name": "KakaoPay",   "type": "Wallet"},
                {"name": "Naver Pay",  "type": "Wallet"},
                {"name": "Samsung Pay","type": "Wallet"},
                {"name": "Toss",       "type": "Wallet / bank"},
                {"name": "Payco",      "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 60, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 25.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "BC Card",    "share": 10.0, "type": "local"},
                    {"name": "Amex / JCB", "share":  7.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "KakaoPay, Naver Pay, Samsung Pay", "share": 22, "growth": "+20% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "flat",
                "schemes": [
                    {"name": "Visa Debit", "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro", "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "share": 5, "growth": "+15% YoY"},
            {"name": "BNPL", "share": 2, "growth": "+30% YoY"},
            {"name": "Cash", "share": 1, "growth": "-20% YoY"},
        ],
        "regulation": [
            "FSC (Financial Services Commission) and FSS (Financial Supervisory Service) regulate banks, PSPs, and fintech. Electronic Financial Transactions Act governs PSP licensing.",
            "KakaoPay and Naver Pay are super-app wallets — Kakao and Naver dominate Korean internet and extend that into payments, loans, insurance.",
            "Samsung Pay (integrated in Samsung phones) is the NFC standard domestically; works both with magnetic-stripe emulation (MST) and EMV contactless.",
            "Personal Information Protection Act (PIPA) aligns with GDPR. Cross-border transfers strictly controlled.",
            "South Korea has strict KYC — 본인인증 (identity verification) via mobile carrier or government ID is mandatory for most online payments.",
            "Crypto is highly regulated under the Special Reporting Act (VASPs must register); only won-denominated fiat on-ramps are allowed.",
        ],
        "digital_trends": [
            "South Korea has one of the highest ecommerce penetration rates globally (30% of retail). Coupang is the dominant local player.",
            "Credit card usage is extraordinarily high (~60%) — tax incentives for card payments (year-end tax credit) drive behavior.",
            "KakaoBank (fintech neobank) has >23M users and offers loans, investments, and cards inside Kakao's messaging app.",
            "Cross-border into Korea has strict payment preferences — KakaoPay, Naver Pay, and local-brand card preferences matter. International PSPs often struggle.",
            "Toss has become a dominant super-app, offering banking, stock trading, insurance, and payments under one roof.",
            "Real-time payments (Zeniths 24/7) already deliver instant bank transfer; consumer-facing rails use wallet UX on top.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Hong Kong": {
        "overview": {
            "Population (2024)":                 "7.5M",
            "GDP nominal (2024)":                "$400B",
            "Ecommerce market (2026e)":          "$28B (CAGR 8%)",
            "Online users (2024)":               "7M",
            "Internet penetration (2024)":       "95%",
            "Smartphone penetration (2024)":     "91%",
            "In-Store : Ecommerce ratio (2024)": "78 : 22",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "FPS (Faster Payment System)",
            "apms":    [
                {"name": "Octopus",      "type": "Stored-value card / wallet"},
                {"name": "PayMe",        "type": "Wallet (HSBC)"},
                {"name": "AlipayHK",     "type": "Wallet"},
                {"name": "WeChat Pay HK","type": "Wallet"},
                {"name": "Apple Pay",    "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 45, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 15.0, "type": "international"},
                    {"name": "UnionPay",   "share":  5.0, "type": "local"},
                    {"name": "Amex",       "share":  5.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Octopus, PayMe, AlipayHK", "share": 20, "growth": "+22% YoY"},
            {"name": "Debit Cards", "share": 15, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 8.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.0, "type": "international"},
                    {"name": "Maestro", "share": 0.8, "type": "international"},
                ]},
            {"name": "A2A", "detail": "FPS", "share": 12, "growth": "+28% YoY"},
            {"name": "Cash", "share": 6, "growth": "-12% YoY"},
            {"name": "BNPL", "share": 2, "growth": "+30% YoY"},
        ],
        "regulation": [
            "HKMA (Hong Kong Monetary Authority) regulates banks and payment services. SVF (Stored Value Facility) licenses cover wallets and prepaid cards.",
            "FPS (Faster Payment System, 2018) is the instant-payment rail linking all banks and major SVFs — free for consumers, phone-number addressable.",
            "Mainland cross-border services (AlipayHK, WeChat Pay HK) enable HK residents to pay at merchants in mainland China — a major corridor.",
            "Virtual Banks (8 licensed since 2020) include ZA Bank, Mox, livi, WeLab Bank — mobile-only, deposit-competitive.",
            "HKMA's Project mBridge multi-CBDC platform (HK/China/Thailand/UAE) is one of the world's most advanced cross-border CBDC pilots.",
            "No sales tax or VAT; data protection under PDPO aligns partially with GDPR but not as strict.",
        ],
        "digital_trends": [
            "Octopus (transit + retail stored value) is culturally entrenched — nearly every HK resident uses it daily. Now accepts NFC via smartphone apps.",
            "PayMe (HSBC) and AlipayHK drive most wallet usage — FPS interop means cross-wallet transfers are instant.",
            "Hong Kong is a global retail hub for luxury and electronics — tourism payment flows (Alipay, WeChat Pay, UnionPay) are critical for large retailers.",
            "Cross-border with mainland China is a core PSP use case; multi-currency settlement (HKD/RMB/USD) is standard.",
            "Virtual banks compete aggressively on deposit rates and lending — Mox grew to 500K+ customers in under 4 years.",
            "Crypto is being positioned (since 2023) as a regulated hub — HK has explicit retail crypto licenses and is attracting firms moving from US/EU.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Taiwan": {
        "overview": {
            "Population (2024)":                 "24M",
            "GDP nominal (2024)":                "$790B",
            "Ecommerce market (2026e)":          "$40B (CAGR 7%)",
            "Online users (2024)":               "22M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "FISC (Financial Information Service)",
            "apms":    [
                {"name": "LINE Pay",  "type": "Wallet"},
                {"name": "JKO Pay",   "type": "Wallet"},
                {"name": "Taiwan Pay","type": "A2A / QR"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Konbini",   "type": "Cash at 7-Eleven / FamilyMart"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 50, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 22.0, "type": "international"},
                    {"name": "Mastercard", "share": 18.0, "type": "international"},
                    {"name": "JCB",        "share":  8.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 15, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 8.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.0, "type": "international"},
                    {"name": "Maestro", "share": 0.8, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "LINE Pay, JKO Pay, Apple Pay", "share": 15, "growth": "+20% YoY"},
            {"name": "Convenience Store", "detail": "7-Eleven, FamilyMart", "share": 12, "growth": "-3% YoY"},
            {"name": "A2A", "detail": "Taiwan Pay, FISC", "share": 5, "growth": "+16% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+28% YoY"},
        ],
        "regulation": [
            "FSC (Financial Supervisory Commission) regulates financial services. Electronic Payment Act and Electronic Stored Value Card Act cover PSPs and wallets.",
            "LINE Pay is the dominant wallet — LINE (messaging app) is nearly universal in Taiwan and extends into payments, shopping, and insurance.",
            "Taiwan Pay is the bank-consortium QR rail (launched 2017) — interop across 38 member banks and growing retail acceptance.",
            "Personal Data Protection Act aligns broadly with GDPR; cross-border transfer requires safeguards.",
            "Business tax (5% VAT-equivalent) applies; e-invoice requirements are strict and digitized.",
            "Cross-border with mainland China is sensitive politically — Alipay/WeChat Pay presence is more limited than in HK or Macau.",
        ],
        "digital_trends": [
            "Credit card dominance (~50%) reflects rewards and cashback culture; 7-Eleven / FamilyMart cash payments (~12%) remain as a long tail.",
            "LINE Pay's integration with LINE messaging makes P2P transfer and split-bill culturally default.",
            "Taiwan has the world's densest convenience store network (>13K stores in 24M population) — convenience-store cash and pickup remain strong.",
            "Large cross-border shopping into Japan and US — Taiwanese consumers buy from Amazon, Rakuten, and Shopee at high volume.",
            "Fintech regulatory sandbox has licensed digital banks (Line Bank Taiwan, Next Bank, Rakuten Bank).",
            "Crypto is regulated (FSC oversight); Taiwan has a strong local exchange (MaiCoin, BitoPro) ecosystem and several stablecoin use cases in B2B.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Malaysia": {
        "overview": {
            "Population (2024)":                 "34M",
            "GDP nominal (2024)":                "$420B",
            "Ecommerce market (2026e)":          "$16B (CAGR 12%)",
            "Online users (2024)":               "33M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "92%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "MyDebit",
            "a2a":     "DuitNow",
            "apms":    [
                {"name": "Touch 'n Go", "type": "Wallet"},
                {"name": "GrabPay",     "type": "Wallet"},
                {"name": "Boost",       "type": "Wallet"},
                {"name": "DuitNow QR",  "type": "A2A (QR)"},
                {"name": "MAE",         "type": "Bank wallet (Maybank)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 14.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                    {"name": "JCB",        "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "MyDebit", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "MyDebit", "share": 11.0, "type": "local"},
                    {"name": "Visa Debit", "share": 6.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.9, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "TNG, GrabPay, Boost", "share": 22, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "DuitNow", "share": 15, "growth": "+32% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+35% YoY"},
        ],
        "regulation": [
            "BNM (Bank Negara Malaysia) regulates banks, PSPs, and e-money issuers. The Financial Services Act (FSA) and Islamic Financial Services Act (IFSA) are the foundational frameworks.",
            "e-Money Issuer license is required for wallets. TNG, GrabPay, Boost are all large-scale e-money issuers under BNM supervision.",
            "DuitNow (PayNet-run) provides instant interbank A2A including QR; cross-border DuitNow-PayNow (Singapore) and DuitNow-PromptPay (Thailand) corridors are live.",
            "SST (Sales and Service Tax) at 6%; no full VAT regime. Digital service tax at 6% applies to foreign digital service providers.",
            "PDPA (Personal Data Protection Act) aligns with GDPR principles; cross-border transfer requires adequate safeguards.",
            "Islamic finance is a significant sub-sector (~40% of banking); Islamic-compliant payment products (Shariah-compliant wallets) are available.",
        ],
        "digital_trends": [
            "Touch 'n Go is the dominant wallet — >25M users — leveraging its transit-card legacy (toll, MRT) and now accepting A2A and QR.",
            "DuitNow QR has unified the previously fragmented QR market (each wallet had its own); now any wallet can scan any DuitNow QR.",
            "Grab is headquartered in Singapore but Malaysia is its origin market; GrabPay has deep penetration alongside TNG.",
            "Malaysia is a major cross-border corridor — ASEAN, China, and India all flow through. Multi-currency acquiring is essential.",
            "BNPL (Atome, SPayLater, Grab PayLater) has grown from zero to ~5% in 3 years; BNM regulatory framework now applies.",
            "Islamic ecommerce (halal marketplaces, Ramadan shopping cycles) creates unique payment timing patterns.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Thailand": {
        "overview": {
            "Population (2024)":                 "72M",
            "GDP nominal (2024)":                "$530B",
            "Ecommerce market (2026e)":          "$24B (CAGR 13%)",
            "Online users (2024)":               "62M",
            "Internet penetration (2024)":       "86%",
            "Smartphone penetration (2024)":     "84%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "PromptPay",
            "apms":    [
                {"name": "TrueMoney",        "type": "Wallet"},
                {"name": "Rabbit LINE Pay",  "type": "Wallet"},
                {"name": "ShopeePay",        "type": "Wallet"},
                {"name": "K PLUS",           "type": "Bank wallet (Kasikorn)"},
                {"name": "SCB Easy",         "type": "Bank wallet (SCB)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "A2A", "detail": "PromptPay, bank transfer", "share": 40, "growth": "+35% YoY"},
            {"name": "Wallets", "detail": "TrueMoney, LINE Pay, ShopeePay", "share": 20, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 20, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 10.0, "type": "international"},
                    {"name": "Mastercard", "share":  7.0, "type": "international"},
                    {"name": "JCB",        "share":  2.0, "type": "international"},
                    {"name": "Amex",       "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 10, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro", "share": 0.5, "type": "international"},
                ]},
            {"name": "Cash", "share": 8, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 2, "growth": "+40% YoY"},
        ],
        "regulation": [
            "BOT (Bank of Thailand) regulates banks and payment services. Payment Systems Act 2017 covers PSP licensing and e-money.",
            "PromptPay (ITMX-run) is one of SEA's most successful instant payment rails — free for consumers, phone/ID-number addressable, 7B+ transactions/year.",
            "Cross-border PromptPay-PayNow (Singapore) and PromptPay-DuitNow (Malaysia) enable low-cost retail cross-border transfers.",
            "BOT approved 3 virtual banks in 2026 (go-live mid-2026) — SCB-KakaoBank, Krungthai-Gulf, and ACM Consortium.",
            "VAT at 7% applies. E-Tax and e-Withholding integration via Revenue Department is mandatory for PSPs above thresholds.",
            "PDPA (2022 full enforcement) aligns with GDPR; local appointed representatives required for foreign data controllers.",
        ],
        "digital_trends": [
            "PromptPay usage is culturally default — QR at street vendors, restaurants, taxis. A2A is 40% of payments, one of the highest globally.",
            "TrueMoney (CP Group) is the largest wallet — 30M+ users — leveraging 7-Eleven (CP subsidiary) as cash-in/out network.",
            "LINE Pay (via LINE messenger) and ShopeePay (via Shopee marketplace) are the super-app wallet entrants.",
            "Cross-border ecommerce from Thailand into SEA is significant — Thai consumers shop on Taobao/Alibaba as well as regional marketplaces.",
            "Tourism (second-largest sector post-pandemic) drives USD/EUR/CNY card acceptance at hotels and malls.",
            "Crypto is regulated (SEC licenses); Bitkub is the largest local exchange. Stablecoin payments for e-commerce are still niche.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Indonesia": {
        "overview": {
            "Population (2024)":                 "280M",
            "GDP nominal (2024)":                "$1.4T",
            "Ecommerce market (2026e)":          "$65B (CAGR 15%)",
            "Online users (2024)":               "215M",
            "Internet penetration (2024)":       "77%",
            "Smartphone penetration (2024)":     "73%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "GPN",
            "a2a":     "BI-FAST",
            "apms":    [
                {"name": "OVO",       "type": "Wallet"},
                {"name": "GoPay",     "type": "Wallet (Gojek)"},
                {"name": "DANA",      "type": "Wallet"},
                {"name": "ShopeePay", "type": "Wallet"},
                {"name": "LinkAja",   "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "OVO, GoPay, DANA", "share": 35, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "BI-FAST, bank transfer", "share": 25, "growth": "+30% YoY"},
            {"name": "Credit Cards", "share": 12, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  6.0, "type": "international"},
                    {"name": "Mastercard", "share":  5.0, "type": "international"},
                    {"name": "JCB",        "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "GPN", "share": 10, "growth": "+4% YoY",
                "schemes": [
                    {"name": "GPN", "share": 4.5, "type": "local"},
                    {"name": "Visa Debit", "share": 3.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.5, "type": "international"},
                ]},
            {"name": "Cash", "detail": "COD, Indomaret, Alfamart", "share": 12, "growth": "-8% YoY"},
            {"name": "BNPL", "detail": "Kredivo, Akulaku", "share": 6, "growth": "+40% YoY"},
        ],
        "regulation": [
            "BI (Bank Indonesia) and OJK (Financial Services Authority) co-regulate. BI oversees payment systems; OJK regulates non-bank financial services and fintech lending.",
            "PJP (Penyedia Jasa Pembayaran) license issued by BI is the main PSP authorization. PTP (Penyelenggara Transfer Dana) covers remittance.",
            "BI-FAST (launched 2021) is the real-time payment rail — 24/7, low-cost (~IDR 2.5K / transfer), supports QR-Cross Border.",
            "QRIS (QR Indonesian Standard, BI-run) unified all wallet QR codes; every merchant QR can be scanned by any wallet. Mandatory since 2020.",
            "VAT at 11% (rose from 10% in 2022); foreign digital service providers must register via OSS system.",
            "PDP Law (2022, enforcement 2024) aligns with GDPR; cross-border data transfer requires consent or contractual safeguards.",
        ],
        "digital_trends": [
            "Wallets dominate (~35%) — OVO (Grab), GoPay (Gojek/GoTo), DANA (Emtek/Ant Group), ShopeePay (Sea Group) each have 50M+ users.",
            "QRIS is the unifying rail — a single QR code on the merchant is payable from any licensed wallet. Game-changer for SMB acceptance.",
            "BI-FAST instant transfers are challenging wallet dominance — consumers increasingly use bank apps for transfer at near-zero fee.",
            "COD (Cash on Delivery) still matters for lower-income and rural segments — Shopee, Tokopedia, Lazada all support COD.",
            "Gojek/GoTo ecosystem integrates ride, food, grocery, and payments — GoPay is the default for hundreds of millions of transactions monthly.",
            "Cross-border flows to/from China are huge — TikTok Shop, Shopee, Lazada all have Chinese-origin inventory; USDT and UnionPay rails matter for merchants.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Philippines": {
        "overview": {
            "Population (2024)":                 "115M",
            "GDP nominal (2024)":                "$450B",
            "Ecommerce market (2026e)":          "$18B (CAGR 16%)",
            "Online users (2024)":               "88M",
            "Internet penetration (2024)":       "77%",
            "Smartphone penetration (2024)":     "72%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "BancNet",
            "a2a":     "InstaPay / PESONet",
            "apms":    [
                {"name": "GCash",    "type": "Wallet"},
                {"name": "Maya",     "type": "Wallet (formerly PayMaya)"},
                {"name": "Coins.ph", "type": "Wallet / crypto"},
                {"name": "GrabPay",  "type": "Wallet"},
                {"name": "7-Eleven Cliqq","type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "GCash, Maya", "share": 32, "growth": "+30% YoY"},
            {"name": "Cash on Delivery", "share": 20, "growth": "-6% YoY"},
            {"name": "Credit Cards", "share": 15, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  8.0, "type": "international"},
                    {"name": "Mastercard", "share":  6.0, "type": "international"},
                    {"name": "JCB",        "share":  1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "InstaPay, PESONet", "share": 14, "growth": "+28% YoY"},
            {"name": "Debit Cards", "detail": "BancNet", "share": 12, "growth": "+3% YoY",
                "schemes": [
                    {"name": "BancNet", "share": 6.0, "type": "local"},
                    {"name": "Visa Debit", "share": 3.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.7, "type": "international"},
                ]},
            {"name": "BNPL", "share": 7, "growth": "+45% YoY"},
        ],
        "regulation": [
            "BSP (Bangko Sentral ng Pilipinas) regulates banks and non-bank PSPs. EMI (Electronic Money Issuer) license is required for wallets.",
            "InstaPay (real-time, lower-value) and PESONet (batch, higher-value) are the domestic A2A rails. QR Ph (2021) unifies QR across wallets and banks.",
            "GCash (Globe Telecom/Ant/Bow Wave) has 80M+ users — the dominant wallet. Maya (PLDT/Voyager) is #2 with ~50M users.",
            "VAT at 12% applies; digital service tax of 12% on foreign non-resident providers effective 2024.",
            "Data Privacy Act (2012, updated IRRs) aligns with GDPR principles; NPC is the authority.",
            "Remittances are ~10% of GDP (OFW corridors — Gulf, US, HK, Singapore). Fintech corridors (Remitly, Instarem, GCash) competing with banks.",
        ],
        "digital_trends": [
            "GCash is the dominant digital payment — QR at retail, P2P, bills, loans, insurance. Accepted at virtually every SMB in Metro Manila.",
            "COD remains ~20% because of low card penetration and trust gaps; Shopee, Lazada, TikTok Shop all support COD.",
            "BNPL (GCash PayLater, Maya Credit, Akulaku, BillEase) is among the fastest-growing in SEA.",
            "Digital banks (Tonik, GoTyme, Maya Bank, Union Digital, UnoBank) launched 2022 — targeting unbanked and SME segments.",
            "Remittance corridors drive fintech volume — USD/AED/HKD inflows to PHP via wallets like GCash have largely replaced Western Union for younger senders.",
            "Crypto (licensed under BSP VASP rules) is large — Coins.ph is the native leader; play-to-earn gaming (Axie) was a major on-ramp.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Vietnam": {
        "overview": {
            "Population (2024)":                 "100M",
            "GDP nominal (2024)":                "$430B",
            "Ecommerce market (2026e)":          "$22B (CAGR 18%)",
            "Online users (2024)":               "78M",
            "Internet penetration (2024)":       "78%",
            "Smartphone penetration (2024)":     "75%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "Napas",
            "a2a":     "Napas 247 (instant)",
            "apms":    [
                {"name": "MoMo",    "type": "Wallet"},
                {"name": "ZaloPay", "type": "Wallet (VNG)"},
                {"name": "VNPay",   "type": "Wallet / PSP"},
                {"name": "ShopeePay","type": "Wallet"},
                {"name": "ViettelPay","type": "Mobile money"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MoMo, ZaloPay, VNPay", "share": 32, "growth": "+30% YoY"},
            {"name": "A2A", "detail": "Napas 247", "share": 22, "growth": "+35% YoY"},
            {"name": "Cash / COD", "share": 18, "growth": "-10% YoY"},
            {"name": "Credit Cards", "share": 12, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  6.0, "type": "international"},
                    {"name": "Mastercard", "share":  5.0, "type": "international"},
                    {"name": "JCB",        "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "Napas", "share": 12, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Napas Debit", "share": 6.6, "type": "local"},
                    {"name": "Visa Debit", "share": 3.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.4, "type": "international"},
                ]},
            {"name": "BNPL", "share": 4, "growth": "+45% YoY"},
        ],
        "regulation": [
            "SBV (State Bank of Vietnam) regulates banks and payment services. IPSP (Intermediary Payment Service Provider) license is required for PSPs and wallets.",
            "Napas (National Payment Corporation of Vietnam) operates the interbank switch and Napas 247 real-time rail. Growing rapidly post-2020.",
            "VAT at 10% applies; digital service tax of 5% on foreign providers effective 2022.",
            "Personal Data Protection Decree (2023) aligns with GDPR; cross-border transfer requires impact assessment and regulator approval.",
            "MoMo is the dominant wallet with 30M+ users — unicorn status and expanding into credit, insurance, investment.",
            "COD was historically 60%+ of ecommerce in Vietnam but has dropped to ~18% as wallets and A2A have scaled.",
        ],
        "digital_trends": [
            "Vietnam's ecommerce is growing 18% annually — among the fastest in SEA. Shopee, Lazada, Tiki, and TikTok Shop are the main marketplaces.",
            "Wallets are dominant (~32%) — MoMo, ZaloPay (VNG), and VNPay together handle most ecommerce checkout.",
            "Napas 247 instant transfer is eating into wallet share — banks increasingly offer free real-time transfers via mobile apps.",
            "Cross-border with China is massive — Alibaba, Pinduoduo, and Aliexpress ship extensively to Vietnamese consumers; USD/CNY pricing + wallet-based checkout.",
            "VND is relatively stable (managed float); crypto is legally restricted but P2P trading via Binance and stablecoin use is common.",
            "Digital banking entrants (Timo, Cake, TNEX) are gaining traction but remain smaller than wallet incumbents.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Australia": {
        "overview": {
            "Population (2024)":                 "26.5M",
            "GDP nominal (2024)":                "$1.7T",
            "Ecommerce market (2026e)":          "$55B (CAGR 9%)",
            "Online users (2024)":               "24M",
            "Internet penetration (2024)":       "91%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "eftpos",
            "a2a":     "NPP / PayTo / Osko",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Afterpay",   "type": "BNPL"},
                {"name": "Zip",        "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 40, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 15.0, "type": "international"},
                    {"name": "Amex",       "share":  4.0, "type": "international"},
                    {"name": "Diners",     "share":  1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "detail": "eftpos", "share": 28, "growth": "+2% YoY",
                "schemes": [
                    {"name": "eftpos", "share": 15.4, "type": "local"},
                    {"name": "Visa Debit", "share": 6.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.7, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Google Pay, PayPal", "share": 12, "growth": "+22% YoY"},
            {"name": "A2A", "detail": "NPP, PayTo", "share": 10, "growth": "+30% YoY"},
            {"name": "BNPL", "detail": "Afterpay, Zip, Klarna", "share": 8, "growth": "+15% YoY"},
            {"name": "Cash", "share": 2, "growth": "-18% YoY"},
        ],
        "regulation": [
            "RBA (Reserve Bank of Australia) oversees payment systems. ASIC regulates financial services. APRA supervises banks; AUSTRAC enforces AML.",
            "NPP (New Payments Platform) is the real-time rail launched 2018 — PayTo (merchant-initiated) extends it with standing-authority payments.",
            "eftpos is the domestic debit scheme; 2022 merger with BPAY/NPP created Australian Payments Plus (AP+) consolidating rails.",
            "GST at 10% applies; digital goods and services from overseas are within scope (netflix tax).",
            "Consumer Data Right (CDR) is Australia's open banking/open data framework — mandating data portability.",
            "Payment Licensing Reform (introduced 2024) will replace the purchased-payment facility regime with a modern PSP license regime.",
        ],
        "digital_trends": [
            "Australia led the world on BNPL adoption — Afterpay (Square/Block), Zip, and Klarna are culturally mainstream.",
            "Contactless payment adoption is >95% of card transactions; tap-to-pay is default.",
            "NPP and PayTo are rapidly replacing direct debit for subscriptions and recurring — higher customer control, fewer failed payments.",
            "eftpos is the cheapest debit option for merchants; ongoing 'least-cost routing' mandates force acquirers to offer it.",
            "Cross-border ecommerce is significant — Australians buy extensively from US, UK, China; AUD is widely supported internationally.",
            "Digital banks (Judo, Up, Volt, 86 400 — later acquired by NAB) have consolidated; the 'neobank' wave has matured into traditional banks adopting digital-first UX.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "New Zealand": {
        "overview": {
            "Population (2024)":                 "5.2M",
            "GDP nominal (2024)":                "$260B",
            "Ecommerce market (2026e)":          "$12B (CAGR 9%)",
            "Online users (2024)":               "4.9M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "Eftpos NZ",
            "a2a":     "Payments NZ (SBI, BECS)",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Laybuy",     "type": "BNPL"},
                {"name": "Afterpay",   "type": "BNPL"},
                {"name": "POLi",       "type": "A2A (being deprecated)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "detail": "Eftpos NZ", "share": 35, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Eftpos NZ", "share": 22.8, "type": "local"},
                    {"name": "Visa Debit", "share": 6.7, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.5, "type": "international"},
                ]},
            {"name": "Credit Cards", "share": 32, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 17.0, "type": "international"},
                    {"name": "Mastercard", "share": 12.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "A2A", "share": 12, "growth": "+12% YoY"},
            {"name": "Wallets", "detail": "Apple, Google, PayPal", "share": 12, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "Afterpay, Laybuy, Zip", "share": 7, "growth": "+10% YoY"},
            {"name": "Cash", "share": 2, "growth": "-18% YoY"},
        ],
        "regulation": [
            "RBNZ (Reserve Bank of New Zealand) regulates banks; FMA supervises conduct; Commerce Commission oversees competition in retail payments.",
            "The Retail Payment System Act 2022 gave the Commerce Commission authority to set interchange caps and merchant service fee rules.",
            "Open banking is being built via API Centre (Payments NZ) — Phase 1 (payment initiation) launched 2024 for major banks.",
            "GST at 15% applies; foreign digital service providers must register through the GST online regime.",
            "Eftpos NZ cards typically have no interchange (flat fee for merchant), historically making card costs very low.",
            "Privacy Act 2020 aligns broadly with GDPR but has fewer enforcement teeth; Privacy Commissioner is the authority.",
        ],
        "digital_trends": [
            "Eftpos NZ is unique — unlike Australia's eftpos, NZ's is largely free for merchants, which historically suppressed contactless adoption (extra fees on contactless).",
            "Contactless adoption has accelerated post-COVID; interchange caps introduced in 2022 reduced the cost gap.",
            "Cross-border ecommerce from Australia, US, and China is substantial — per-capita spending on international ecommerce is high.",
            "BNPL (Afterpay, Laybuy, Zip) is widespread; Afterpay originated across the Tasman and dominates.",
            "Major banks (ANZ, ASB, BNZ, Westpac) collectively control most retail banking — fintech disruption is slow.",
            "Cryptoasset Disclosures framework proposed 2024; regulated environment for digital-asset service providers.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Bangladesh": {
        "overview": {
            "Population (2024)":                 "170M",
            "GDP nominal (2024)":                "$460B",
            "Ecommerce market (2026e)":          "$7B (CAGR 22%)",
            "Online users (2024)":               "85M",
            "Internet penetration (2024)":       "50%",
            "Smartphone penetration (2024)":     "45%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "NPSB",
            "a2a":     "BACH",
            "apms":    [
                {"name": "bKash",   "type": "Mobile money"},
                {"name": "Nagad",   "type": "Mobile money"},
                {"name": "Rocket",  "type": "Mobile money (DBBL)"},
                {"name": "Upay",    "type": "Wallet"},
                {"name": "SSL Wireless","type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "bKash, Nagad, Rocket", "share": 40, "growth": "+28% YoY"},
            {"name": "Cash / COD", "share": 25, "growth": "-5% YoY"},
            {"name": "A2A", "detail": "BACH, NPSB", "share": 12, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 7, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share":  4.0, "type": "international"},
                    {"name": "Mastercard", "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 8, "growth": "+4% YoY",
                "schemes": [
                    {"name": "NPSB", "share": 4.4, "type": "local"},
                    {"name": "Visa Debit", "share": 2.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 1.6, "type": "international"},
                ]},
            {"name": "BNPL / Other", "share": 8, "growth": "+25% YoY"},
        ],
        "regulation": [
            "Bangladesh Bank is the central bank and primary regulator. PSO (Payment System Operator) and PSP (Payment Service Provider) licenses cover wallets and gateways.",
            "bKash (BRAC Bank/Ant Group/IFC) is the dominant mobile money with 70M+ registered users — regulated as a PSP.",
            "Nagad (Bangladesh Post Office joint venture) is the #2 competitor; growing rapidly with aggressive rates.",
            "VAT at 15% applies; digital service VAT for foreign providers enforced since 2022.",
            "Data Protection Act is in draft; Digital Security Act regulates some online activity.",
            "Remittances are ~7% of GDP — primarily from Gulf countries. Fintech remittance (through bKash, Nagad) competing with traditional MTOs and banks.",
        ],
        "digital_trends": [
            "Mobile financial services (MFS) dominate — bKash alone has >70M users. Even pure-cash users receive payments through these rails.",
            "Cash on delivery remains ~25% of ecommerce due to trust and banking gaps; declining as wallet-based checkout grows.",
            "Cross-border ecommerce is heavily India/China; Daraz (Alibaba), Evaly, and local retailers compete.",
            "Remittance inflows drive wallet adoption — OFW salary is often routed directly to bKash/Nagad accounts in Bangladesh.",
            "Bangladesh has been one of the fastest-growing ecommerce markets globally from a low base (~22% CAGR).",
            "Digital banking license framework introduced 2023 — three licenses granted in 2024.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Pakistan": {
        "overview": {
            "Population (2024)":                 "240M",
            "GDP nominal (2024)":                "$340B",
            "Ecommerce market (2026e)":          "$8B (CAGR 20%)",
            "Online users (2024)":               "111M",
            "Internet penetration (2024)":       "46%",
            "Smartphone penetration (2024)":     "44%",
            "In-Store : Ecommerce ratio (2024)": "93 : 7",
        },
        "local_payments": {
            "scheme":  "PayPak",
            "a2a":     "Raast (instant)",
            "apms":    [
                {"name": "Easypaisa","type": "Mobile money"},
                {"name": "JazzCash", "type": "Mobile money"},
                {"name": "SadaPay",  "type": "Wallet"},
                {"name": "NayaPay",  "type": "Wallet"},
                {"name": "HBL Konnect","type": "Bank wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "Easypaisa, JazzCash", "share": 30, "growth": "+32% YoY"},
            {"name": "Cash / COD", "share": 28, "growth": "-5% YoY"},
            {"name": "A2A", "detail": "Raast, 1Link", "share": 15, "growth": "+40% YoY"},
            {"name": "Credit Cards", "share": 6.8, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa", "share": 3.7, "type": "international"},
                    {"name": "Mastercard", "share": 3.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 8.2, "growth": "+6% YoY",
                "schemes": [
                    {"name": "PayPak", "share": 5.7, "type": "local"},
                    {"name": "Visa Debit", "share": 1.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 1.1, "type": "international"},
                ]},
            {"name": "BNPL", "share": 5, "growth": "+45% YoY"},
            {"name": "Other", "share": 7, "growth": "+20% YoY"},
        ],
        "regulation": [
            "SBP (State Bank of Pakistan) regulates banks and payment services. EMI (Electronic Money Institution) license is the main fintech authorization.",
            "Raast (launched 2021) is the SBP-run instant payment rail — free for consumers; Phase 2 (merchant payments) rolled out 2022.",
            "PayPak is the domestic card scheme launched 2016 — all Pakistani-issued debit cards co-badge PayPak + Visa/Mastercard.",
            "GST at 18% applies; digital services tax on foreign providers applied since 2022.",
            "Personal Data Protection Bill in draft (expected 2026); currently data protection is patchwork.",
            "Remittances are ~10% of GDP (Gulf, US, UK). Wallets and banks compete; stablecoin rails (Binance P2P) are common in informal sector.",
        ],
        "digital_trends": [
            "Easypaisa (Telenor) and JazzCash (Mobilink/VEON) dominate mobile money — collectively 80M+ users.",
            "Raast rollout is driving A2A adoption rapidly — merchants accept QR Raast with minimal fees compared to card rails.",
            "COD is still significant (~28%) due to low card penetration (~15% adults) and banking gaps.",
            "Ecommerce is growing ~20% YoY from a small base — Daraz (Alibaba), Foodpanda, Bykea, and local retailers compete.",
            "Cross-border from China is large — Shein, Temu, and Aliexpress ship extensively; UnionPay accepted at limited merchants.",
            "FX and capital controls complicate international payments; many freelance/tech workers use USDT to receive foreign earnings.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Sri Lanka": {
        "overview": {
            "Population (2024)":                 "22M",
            "GDP nominal (2024)":                "$90B",
            "Ecommerce market (2026e)":          "$1.5B (CAGR 18%)",
            "Online users (2024)":               "12M",
            "Internet penetration (2024)":       "56%",
            "Smartphone penetration (2024)":     "52%",
            "In-Store : Ecommerce ratio (2024)": "91 : 9",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "LankaPay CEFTS / LankaPay Online Payment Platform",
            "apms":    [
                {"name": "FriMi",    "type": "Wallet"},
                {"name": "Genie",    "type": "Wallet (Dialog)"},
                {"name": "PayHere",  "type": "Gateway"},
                {"name": "Sampath Vishwa","type": "Bank app"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 35, "growth": "-6% YoY"},
            {"name": "Credit Cards", "share": 11.2, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 5.8, "type": "international"},
                    {"name": "Mastercard", "share": 4.5, "type": "international"},
                    {"name": "Amex", "share": 0.9, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 13.8, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 7.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.5, "type": "international"},
                    {"name": "Maestro", "share": 0.7, "type": "international"},
                ]},
            {"name": "A2A", "detail": "LankaPay / CEFTS", "share": 18, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "FriMi, Genie", "share": 12, "growth": "+25% YoY"},
            {"name": "COD", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL / Other", "share": 2, "growth": "+25% YoY"},
        ],
        "regulation": [
            "CBSL (Central Bank of Sri Lanka) regulates banks and payment services. Payment and Settlement Systems Act 2005 covers PSPs.",
            "LankaPay (private sector, majority-owned by banks) runs CEFTS (instant) and LPOPP (online) rails.",
            "VAT at 15% applies; withholding tax on foreign digital services introduced in 2023 reforms.",
            "Data Protection Act (2022) aligns with GDPR; Data Protection Authority established.",
            "Economic crisis (2022) impacted banking system; recovery ongoing with IMF-backed stabilization program.",
            "FX restrictions limit international transfers; merchants often face delays on USD settlement.",
        ],
        "digital_trends": [
            "Sri Lanka is recovering from severe 2022 economic crisis — digital payment growth accelerated during the crisis as cash alternatives.",
            "LankaPay rails drive most domestic ecommerce and bill payment. CEFTS instant transfers are free to consumers.",
            "Wallets (FriMi — Nations Trust; Genie — Dialog Finance) are growing in urban Colombo and Kandy.",
            "Remittances (~7% of GDP, mostly Gulf) support wallet usage; banks dominate formal corridors.",
            "Cross-border ecommerce is constrained by FX controls; US/India are main corridors for imports.",
            "Crypto is banned as payment but peer-to-peer trading via Binance and LocalBitcoins is common informally.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Nepal": {
        "overview": {
            "Population (2024)":                 "30M",
            "GDP nominal (2024)":                "$45B",
            "Ecommerce market (2026e)":          "$0.6B (CAGR 20%)",
            "Online users (2024)":               "16M",
            "Internet penetration (2024)":       "55%",
            "Smartphone penetration (2024)":     "50%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Connect IPS / FonePay",
            "apms":    [
                {"name": "eSewa",   "type": "Wallet"},
                {"name": "Khalti",  "type": "Wallet"},
                {"name": "IME Pay", "type": "Wallet"},
                {"name": "FonePay", "type": "A2A (QR)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 35, "growth": "-6% YoY"},
            {"name": "Wallets", "detail": "eSewa, Khalti, IME Pay", "share": 25, "growth": "+30% YoY"},
            {"name": "A2A", "detail": "Connect IPS, FonePay", "share": 18, "growth": "+35% YoY"},
            {"name": "Credit Cards", "share": 5.4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa", "share": 2.9, "type": "international"},
                    {"name": "Mastercard", "share": 2.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 6.6, "growth": "+5% YoY",
                "schemes": [
                    {"name": "SCT Debit", "share": 4.6, "type": "local"},
                    {"name": "Visa Debit", "share": 1.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 0.9, "type": "international"},
                ]},
            {"name": "COD", "share": 6, "growth": "-15% YoY"},
            {"name": "Other", "share": 4, "growth": "+18% YoY"},
        ],
        "regulation": [
            "NRB (Nepal Rastra Bank) regulates banks and payment services. Payment and Settlement Act 2019 covers PSPs and PSOs.",
            "NCHL (Nepal Clearing House) operates the interbank clearing; FonePay and Connect IPS are the dominant A2A rails.",
            "eSewa (first Nepali wallet, now IME Group) and Khalti are the #1 and #2 wallets. Both integrated with FonePay QR.",
            "VAT at 13% applies; digital service tax enforced since 2023 on foreign providers.",
            "Data protection is governed by Individual Privacy Act 2018 — comprehensive but enforcement is light.",
            "Remittances are ~25% of GDP — one of the highest in the world. Saudi, Qatar, UAE, Malaysia are main corridors.",
        ],
        "digital_trends": [
            "Nepal has leapfrogged cards — wallets and QR dominate urban digital payments. eSewa and Khalti are part of daily life in Kathmandu.",
            "FonePay QR is the interop standard; any wallet can scan any FonePay QR at merchant.",
            "Remittance corridors drive huge digital volume — Saudi Arabia and Qatar inflows route directly to wallets.",
            "Cross-border with India dominates (open border); Indian UPI-Nepal interop was piloted 2024.",
            "Banks are digitizing fast — Nabil Bank, NIC Asia, Global IME have modern mobile apps.",
            "Crypto is banned, but VPN-based Binance P2P access is common.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Cambodia": {
        "overview": {
            "Population (2024)":                 "17M",
            "GDP nominal (2024)":                "$32B",
            "Ecommerce market (2026e)":          "$0.8B (CAGR 22%)",
            "Online users (2024)":               "11M",
            "Internet penetration (2024)":       "64%",
            "Smartphone penetration (2024)":     "60%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Bakong",
            "apms":    [
                {"name": "Bakong",    "type": "CBDC-hybrid / A2A"},
                {"name": "ABA Pay",   "type": "Wallet"},
                {"name": "Wing Money","type": "Mobile money"},
                {"name": "TrueMoney", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "detail": "USD + KHR", "share": 30, "growth": "-6% YoY"},
            {"name": "Wallets", "detail": "ABA Pay, Wing", "share": 22, "growth": "+30% YoY"},
            {"name": "A2A", "detail": "Bakong", "share": 18, "growth": "+45% YoY"},
            {"name": "Credit Cards", "share": 5.4, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa", "share": 2.7, "type": "international"},
                    {"name": "Mastercard", "share": 1.8, "type": "international"},
                    {"name": "UnionPay", "share": 0.9, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 6.6, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 3.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.6, "type": "international"},
                    {"name": "Maestro", "share": 0.4, "type": "international"},
                ]},
            {"name": "COD", "share": 10, "growth": "-10% YoY"},
            {"name": "USD / Other", "share": 8, "growth": "-4% YoY"},
        ],
        "regulation": [
            "NBC (National Bank of Cambodia) regulates banks and payment services. PSI and PSO licenses govern fintech and payment operators.",
            "Bakong (launched 2020) is one of the world's first hybrid retail CBDCs — blockchain-based interbank rail + consumer wallet. ~10M+ users.",
            "Cambodia is a dollarized economy — ~80% of transactions are USD rather than KHR. NBC has been pushing de-dollarization via Bakong.",
            "VAT at 10% applies; digital service tax on foreign providers applied 2023.",
            "Personal Data Protection Law in draft; currently protected under general consumer law.",
            "Cross-border Bakong-PromptPay (Thailand) corridor launched 2024 — early ASEAN retail CBDC bridge.",
        ],
        "digital_trends": [
            "Bakong adoption has grown rapidly — interoperability across all Cambodian banks and wallets drives QR usage.",
            "ABA Pay (dominant commercial wallet, ABA Bank) has 3M+ users — competing with Wing for merchant acceptance.",
            "USD cash is still ~30% of payments — especially in tourism and higher-value retail.",
            "Chinese cross-border ecommerce (Shein, Temu) reaches Cambodia heavily; UnionPay acceptance is reasonable at major retailers.",
            "Remittances from Thailand (Cambodian migrant workers) flow through Bakong-PromptPay; fast and cheap.",
            "Crypto is unregulated but growing; Cambodia hosts some crypto-friendly banking relationships.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "United Kingdom": {
        "overview": {
            "Population (2024)":                 "68M",
            "GDP nominal (2024)":                "$3.5T",
            "Ecommerce market (2026e)":          "$210B (CAGR 8%)",
            "Online users (2024)":               "66M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "93%",
            "In-Store : Ecommerce ratio (2024)": "72 : 28",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Faster Payments / Pay.UK",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Klarna",     "type": "BNPL"},
                {"name": "Clearpay",   "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 38, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 20.0, "type": "international"},
                    {"name": "Mastercard", "share": 15.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 30, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 16.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.0, "type": "international"},
                    {"name": "Maestro", "share": 1.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Google Pay, PayPal", "share": 15, "growth": "+20% YoY"},
            {"name": "A2A", "detail": "Faster Payments, Open Banking", "share": 8, "growth": "+35% YoY"},
            {"name": "BNPL", "detail": "Klarna, Clearpay", "share": 6, "growth": "+18% YoY"},
            {"name": "Cash", "share": 3, "growth": "-15% YoY"},
        ],
        "regulation": [
            "FCA (Financial Conduct Authority) supervises conduct; BoE / PRA supervises prudential. PSR (Payment Systems Regulator) oversees payment schemes.",
            "The UK's Open Banking regime (CMA 9 order) mandated APIs for 9 largest banks — expanded via the SS&I Data Bill to Open Finance.",
            "Confirmation of Payee (CoP) is mandatory for interbank transfers — reduces APP fraud. FCA-imposed APP fraud reimbursement came in Oct 2024.",
            "VAT at 20% applies; low-value consignment relief ended post-Brexit. EU OSS replaced by domestic VAT for imports.",
            "PSD2 transposed as domestic law post-Brexit; divergence is expected as the UK pursues its own fintech agenda via the Data (Use and Access) Bill.",
            "Faster Payments (near-RT) will be modernised via the New Payments Architecture (NPA) — indefinitely delayed but targeting late 2020s.",
        ],
        "digital_trends": [
            "UK is one of the most card-heavy markets in Europe (~68% card share combined). Contactless tap-to-pay is universal in retail.",
            "Open Banking APIs are mature — over 13M active users; payment initiation (PIS) is growing in bill pay, charity, gov payments.",
            "BNPL (Klarna, Clearpay, PayPal Pay in 3) are mainstream; FCA regulation expected 2026.",
            "Revolut (UK-HQ, now banking license) is the largest European neobank with 50M+ users globally.",
            "Cross-border with EU has Brexit-induced friction — VAT, customs, and data-flow contracts add complexity for both directions.",
            "CBDC (Digital Pound) is in design phase at BoE/HMT; no firm launch date, but consultation is advanced.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Germany": {
        "overview": {
            "Population (2024)":                 "84M",
            "GDP nominal (2024)":                "$4.5T",
            "Ecommerce market (2026e)":          "$140B (CAGR 6%)",
            "Online users (2024)":               "79M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "girocard",
            "a2a":     "SEPA Instant / giropay (being phased out)",
            "apms":    [
                {"name": "PayPal",         "type": "Wallet"},
                {"name": "Klarna",         "type": "BNPL / invoice"},
                {"name": "Apple Pay",      "type": "Wallet"},
                {"name": "Sofort / Klarna","type": "A2A"},
                {"name": "Rechnung",       "type": "Invoice / open invoice"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 9, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 4.7, "type": "international"},
                    {"name": "Mastercard", "share": 3.9, "type": "international"},
                    {"name": "Amex", "share": 0.4, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 21, "growth": "+3% YoY",
                "schemes": [
                    {"name": "girocard", "share": 14.7, "type": "local"},
                    {"name": "Visa Debit", "share": 3.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.8, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "PayPal (dominant)", "share": 28, "growth": "+6% YoY"},
            {"name": "A2A", "detail": "SEPA / Sofort", "share": 22, "growth": "+18% YoY"},
            {"name": "Invoice", "detail": "Kauf auf Rechnung", "share": 10, "growth": "-2% YoY"},
            {"name": "BNPL", "detail": "Klarna", "share": 6, "growth": "+15% YoY"},
            {"name": "Cash", "share": 4, "growth": "-8% YoY"},
        ],
        "regulation": [
            "BaFin regulates banks, PSPs, and crypto asset service providers. Bundesbank handles payment rails and monetary policy.",
            "PayPal is unusually dominant in Germany (~28% share) — a legacy of slow card/wallet adoption and strong trust in the brand.",
            "Invoice-based post-delivery payment (Kauf auf Rechnung) is culturally entrenched; ~10% of ecommerce still settles this way.",
            "SEPA Instant is mandatory for banks (2024+). giropay was phased out in favor of SEPA Instant + request-to-pay flows.",
            "VAT at 19% (reduced 7% for some goods). EU OSS applies for cross-border B2C. Invoice format is strictly regulated (e-Invoice mandates from 2025).",
            "German data protection (BDSG) is one of the strictest in EU; GDPR interpretation by BfDI is notably rigorous.",
        ],
        "digital_trends": [
            "PayPal is the most dominant wallet in any major European market — trusted, accepted everywhere, and the default consumer preference.",
            "Klarna 'Pay Later' and Kauf auf Rechnung culture intersect — BNPL was essentially pre-invented in Germany via invoice-based payments.",
            "SEPA Instant adoption is growing fast in B2B and subscriptions; consumer-facing A2A still requires merchant education.",
            "Germany has the highest cash share among major EU economies (~4%) but trending down rapidly.",
            "Sparkasse (savings banks) and Volksbanken (cooperative banks) together serve majority of consumers — their apps increasingly support instant transfers and wallets.",
            "Cross-border within EU is frictionless via SEPA; cross-border outside EU requires currency-aware PSPs.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "France": {
        "overview": {
            "Population (2024)":                 "68M",
            "GDP nominal (2024)":                "$3.1T",
            "Ecommerce market (2026e)":          "$90B (CAGR 7%)",
            "Online users (2024)":               "62M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "87%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "Cartes Bancaires (CB)",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "PayPal",    "type": "Wallet"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Google Pay","type": "Wallet"},
                {"name": "Paylib",    "type": "A2A"},
                {"name": "Lydia",     "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 33, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 17.6, "type": "international"},
                    {"name": "Mastercard", "share": 14.0, "type": "international"},
                    {"name": "Amex", "share": 1.4, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "CB Débit", "share": 15.4, "type": "local"},
                    {"name": "Visa Debit", "share": 3.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "PayPal, Apple Pay", "share": 15, "growth": "+18% YoY"},
            {"name": "A2A", "detail": "SEPA Instant, Paylib", "share": 12, "growth": "+25% YoY"},
            {"name": "BNPL", "detail": "Klarna, Alma, Oney", "share": 8, "growth": "+28% YoY"},
            {"name": "Direct Debit", "detail": "Prélèvement", "share": 8, "growth": "+2% YoY"},
            {"name": "Cash", "share": 2, "growth": "-12% YoY"},
        ],
        "regulation": [
            "ACPR (Autorité de contrôle prudentiel et de résolution) under Banque de France regulates banks and PSPs; AMF oversees markets.",
            "CB (Cartes Bancaires) is France's domestic scheme — almost all French-issued cards co-badge CB + Visa or Mastercard. Merchants routinely route via CB for cheaper interchange.",
            "PSD2 SCA enforcement is strong — 3DS2 required for most consumer ecommerce transactions.",
            "VAT at 20% applies; reduced rates 5.5% and 10% for food, hospitality. Payment terms law (LME) limits B2B invoice terms.",
            "Data protection via CNIL is rigorous; GDPR fines and monitoring are high-profile.",
            "Alma, Oney, and Floa Pay compete in French BNPL; FCA-like regulation under PSD3 expected from 2026.",
        ],
        "digital_trends": [
            "Cards dominate (~55%) with strong CB co-badging; Visa/Mastercard rails carry the volume but CB processes domestic.",
            "PayPal is the leading wallet but smaller share than Germany; Apple Pay is growing fast, especially among younger consumers.",
            "Alma (French BNPL unicorn) is the local leader; Oney (Auchan) and Floa Pay (BNP) compete.",
            "B2B payments rely heavily on SEPA direct debit (prélèvement) and invoicing — slow to embrace card.",
            "Cross-border with EU is frictionless via SEPA; international with US/UK requires currency-aware gateways.",
            "Lydia (French fintech) has pivoted from P2P to super-app with payments, crypto, and banking.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Spain": {
        "overview": {
            "Population (2024)":                 "48M",
            "GDP nominal (2024)":                "$1.6T",
            "Ecommerce market (2026e)":          "$52B (CAGR 9%)",
            "Online users (2024)":               "44M",
            "Internet penetration (2024)":       "93%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Bizum",
            "apms":    [
                {"name": "Bizum",      "type": "A2A (bank-led)"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Klarna",     "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 26.4, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.8, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex", "share": 1.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 21.6, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.6, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Bizum", "share": 20, "growth": "+32% YoY"},
            {"name": "Wallets", "detail": "PayPal, Apple Pay", "share": 17, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Klarna, SeQura", "share": 7, "growth": "+30% YoY"},
            {"name": "Direct Debit", "detail": "Recibo / SEPA DD", "share": 5, "growth": "+2% YoY"},
            {"name": "Cash", "share": 3, "growth": "-10% YoY"},
        ],
        "regulation": [
            "Banco de España (BdE) supervises banks and PSPs. CNMV regulates markets. AEPD enforces data protection.",
            "Bizum is a wildly successful bank-led A2A wallet — 28M+ users, phone-number based, interbank instant; usage is everyday.",
            "VAT (IVA) at 21%; reduced 10%/4% for essentials. EU OSS for B2C cross-border.",
            "Spanish Fintech Sandbox (active since 2020) has accelerated PSP and InsurTech innovation.",
            "PSD2 SCA is enforced; 3DS2 coverage is extensive.",
            "Crypto MiCA (EU regulation) applies from 2024; Spain's CNMV and BdE joint oversight of CASPs.",
        ],
        "digital_trends": [
            "Bizum is a uniquely successful European A2A wallet — comparable to PIX (Brazil) or PayNow (Singapore) in adoption.",
            "Cards dominate ecommerce (~48%) but Bizum is rapidly eating into both wallet and small-ticket card share.",
            "SeQura and Klarna compete in Iberia BNPL; SeQura is the local origin brand.",
            "Cross-border tourism drives acquirers to support multiple currencies and DCC at POS.",
            "Revolut Spain and N26 have meaningful share; CaixaBank and BBVA lead digital banking among incumbents.",
            "Open Banking adoption is growing under PSD2; Spanish banks have strong API quality.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Italy": {
        "overview": {
            "Population (2024)":                 "59M",
            "GDP nominal (2024)":                "$2.3T",
            "Ecommerce market (2026e)":          "$58B (CAGR 8%)",
            "Online users (2024)":               "53M",
            "Internet penetration (2024)":       "90%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "Bancomat",
            "a2a":     "SEPA Instant / BancomatPay",
            "apms":    [
                {"name": "PayPal",      "type": "Wallet"},
                {"name": "Satispay",    "type": "Wallet"},
                {"name": "BancomatPay", "type": "A2A / P2P"},
                {"name": "Apple Pay",   "type": "Wallet"},
                {"name": "Postepay",    "type": "Prepaid card / wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 24, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 12.6, "type": "international"},
                    {"name": "Mastercard", "share": 10.3, "type": "international"},
                    {"name": "Amex", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 24, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Bancomat", "share": 16.8, "type": "local"},
                    {"name": "Visa Debit", "share": 4.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.2, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "PayPal, Satispay, Apple Pay", "share": 15, "growth": "+22% YoY"},
            {"name": "Postepay", "detail": "Prepaid card (Poste Italiane)", "share": 14, "growth": "+5% YoY"},
            {"name": "A2A", "detail": "SEPA, BancomatPay", "share": 12, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Klarna, Scalapay", "share": 6, "growth": "+28% YoY"},
            {"name": "Cash", "share": 5, "growth": "-10% YoY"},
        ],
        "regulation": [
            "Banca d'Italia regulates banks and PSPs. CONSOB oversees markets. IVASS covers insurance.",
            "Satispay (Italian fintech, now European) is a major wallet — phone-based, low-fee, widely accepted.",
            "Poste Italiane (post office) issues Postepay prepaid cards which are culturally entrenched — treat them as a payment method in their own right.",
            "VAT (IVA) at 22%; reduced rates for essentials. E-invoicing is mandatory since 2019 for B2B and B2C.",
            "Italian anti-money laundering is rigorous; KYC requirements for PSPs are among Europe's strictest.",
            "Crypto MiCA applies from 2024; Italian CONSOB and OAM maintain a national registry of CASPs.",
        ],
        "digital_trends": [
            "Italy has unusually strong non-bank payment brands — Satispay, Postepay, and Bancomat each have distinct consumer use cases.",
            "PayPal is the leading checkout wallet; Satispay is the fastest-growing native.",
            "Scalapay (Italian BNPL unicorn) is the local leader in installment payments.",
            "Cash is still ~5% of payments — higher than northern Europe but declining. Pushed down by government incentives (lottery-for-receipts).",
            "Cross-border within EU is frictionless; US/UK cross-border is common for luxury, fashion.",
            "Open Banking adoption is growing but slower than France/Spain; incumbents have fragmented API quality.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Netherlands": {
        "overview": {
            "Population (2024)":                 "18M",
            "GDP nominal (2024)":                "$1.1T",
            "Ecommerce market (2026e)":          "$42B (CAGR 8%)",
            "Online users (2024)":               "17.5M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "93%",
            "In-Store : Ecommerce ratio (2024)": "78 : 22",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "iDEAL (dominant)",
            "apms":    [
                {"name": "iDEAL",     "type": "A2A (dominant)"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "PayPal",    "type": "Wallet"},
                {"name": "Klarna",    "type": "BNPL"},
                {"name": "Tikkie",    "type": "A2A / P2P"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "A2A", "detail": "iDEAL", "share": 68, "growth": "+6% YoY"},
            {"name": "Credit Cards", "share": 2.4, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa", "share": 1.2, "type": "international"},
                    {"name": "Mastercard", "share": 1.0, "type": "international"},
                    {"name": "Amex", "share": 0.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 9.6, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 5.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.8, "type": "international"},
                    {"name": "Maestro", "share": 0.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, PayPal", "share": 8, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "Klarna, Riverty", "share": 7, "growth": "+18% YoY"},
            {"name": "Other", "detail": "Invoice, gift cards", "share": 3, "growth": "flat"},
            {"name": "Cash", "share": 2, "growth": "-15% YoY"},
        ],
        "regulation": [
            "DNB (De Nederlandsche Bank) regulates banks and PSPs; AFM oversees markets; ACM handles competition.",
            "iDEAL (collectively owned by Dutch banks, now part of EPI) is the dominant ecommerce rail — ~68% of online payments. Moving to iDEAL 2.0 (2024+) with enhanced UX.",
            "EPI (European Payments Initiative) is building Wero — pan-European wallet — with iDEAL as a foundation. Rollout phased through 2025-26.",
            "VAT at 21%; reduced 9% for essentials. E-invoicing rules apply for B2B.",
            "PSD2 SCA enforcement is strong; iDEAL itself was a native A2A so payments UX was already secure.",
            "Crypto regulation via DNB's AMLD5 registration; MiCA applies as of 2024.",
        ],
        "digital_trends": [
            "Netherlands is the most A2A-native European market — iDEAL dominates at 68% share, eating into what would be card volume elsewhere.",
            "Tikkie (ABN AMRO's P2P app) is ubiquitous for splitting bills and small payments.",
            "Klarna and Riverty (AfterPay's European arm) dominate BNPL/invoice-based checkout.",
            "Cross-border ecommerce from/to Germany, Belgium is frictionless via SEPA + iDEAL/Bancontact interop.",
            "Cash has collapsed to <3% — one of the lowest in Europe.",
            "Wero (EPI wallet) positioning NL as anchor market is strategically important for European sovereignty in payments.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Belgium": {
        "overview": {
            "Population (2024)":                 "11.8M",
            "GDP nominal (2024)":                "$600B",
            "Ecommerce market (2026e)":          "$20B (CAGR 8%)",
            "Online users (2024)":               "11.2M",
            "Internet penetration (2024)":       "95%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "Bancontact",
            "a2a":     "Payconiq by Bancontact / SEPA Instant",
            "apms":    [
                {"name": "Bancontact",            "type": "Debit / QR"},
                {"name": "Payconiq by Bancontact","type": "A2A wallet"},
                {"name": "Apple Pay",             "type": "Wallet"},
                {"name": "PayPal",                "type": "Wallet"},
                {"name": "Klarna",                "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 13.8, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 7.8, "type": "international"},
                    {"name": "Mastercard", "share": 4.8, "type": "international"},
                    {"name": "Amex", "share": 1.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 41.2, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Bancontact", "share": 28.8, "type": "local"},
                    {"name": "Visa Debit", "share": 6.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.6, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Payconiq", "share": 18, "growth": "+25% YoY"},
            {"name": "Wallets", "detail": "Apple Pay, PayPal", "share": 12, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Klarna, Alma", "share": 7, "growth": "+28% YoY"},
            {"name": "Cash", "share": 5, "growth": "-10% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "NBB (National Bank of Belgium) regulates banks and payment services; FSMA oversees markets.",
            "Bancontact is the domestic scheme — virtually every Belgian debit card is Bancontact-branded with QR and contactless capability.",
            "Payconiq by Bancontact merged Payconiq and Bancontact Mobile in 2018 — now a unified A2A/QR wallet used by ~3M.",
            "VAT at 21%; reduced 12%/6% for essentials.",
            "Cross-border within EU is frictionless via SEPA + Bancontact-iDEAL interop for Dutch shoppers.",
            "Data protection via APD (Belgian DPA) is rigorous; GDPR enforcement is active.",
        ],
        "digital_trends": [
            "Bancontact is culturally default — Belgians expect it at POS and online. International cards are secondary preference.",
            "Payconiq QR and A2A grew rapidly post-2020 as contactless and QR became familiar.",
            "Belgium is bilingual Flemish/French payment UX — merchants must localize both.",
            "Cross-border with NL, FR, DE is common; ecommerce often routes via Benelux PSPs.",
            "PayPal remains meaningful for cross-border and subscriptions; Bancontact for domestic high-volume.",
            "Wero (EPI wallet) rollout includes Belgium; long-term aim is pan-European bank-led wallet.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Portugal": {
        "overview": {
            "Population (2024)":                 "10M",
            "GDP nominal (2024)":                "$280B",
            "Ecommerce market (2026e)":          "$9B (CAGR 9%)",
            "Online users (2024)":               "8.9M",
            "Internet penetration (2024)":       "89%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "87 : 13",
        },
        "local_payments": {
            "scheme":  "Multibanco",
            "a2a":     "SIBS / MB WAY",
            "apms":    [
                {"name": "MB WAY",     "type": "Wallet / A2A"},
                {"name": "Multibanco", "type": "A2A / Cash voucher"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Easypay",    "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 14, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 7.2, "type": "international"},
                    {"name": "Mastercard", "share": 5.6, "type": "international"},
                    {"name": "Amex", "share": 1.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 21, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Multibanco", "share": 14.7, "type": "local"},
                    {"name": "Visa Debit", "share": 3.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.8, "type": "international"},
                ]},
            {"name": "A2A", "detail": "MB WAY, Multibanco", "share": 30, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "PayPal, Apple Pay", "share": 15, "growth": "+20% YoY"},
            {"name": "Cash Voucher", "detail": "Multibanco Reference", "share": 10, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 7, "growth": "+28% YoY"},
            {"name": "Cash", "share": 3, "growth": "-12% YoY"},
        ],
        "regulation": [
            "Banco de Portugal (BdP) regulates banks and payment services. CMVM oversees markets.",
            "SIBS operates Multibanco — the domestic ATM/card network — covering nearly 100% of POS and online card payments.",
            "MB WAY (SIBS-run mobile wallet) has 4M+ users — everyday use for P2P, QR, and bill pay.",
            "VAT (IVA) at 23%; reduced 13%/6% for essentials. E-invoice mandatory for B2G.",
            "Portugal was an early EU adopter of crypto tax rules; MiCA applies from 2024.",
            "Data protection under CNPD is GDPR-aligned; cross-border within EU is fluid.",
        ],
        "digital_trends": [
            "Multibanco Reference (a 9-digit code paid at ATM or online banking) is a uniquely Portuguese payment method — culturally entrenched.",
            "MB WAY dominates wallet usage; it's the national A2A/QR default.",
            "SIBS is a rare example of a country-owned payment network that crowds out international schemes in consumer mindshare.",
            "Portugal's fintech sandbox is active; Revolut and N26 have significant share.",
            "Cross-border from Brazil is meaningful — Portuguese-speaking cross-border ecommerce.",
            "EU citizens increasingly retire / relocate to Portugal; this changes payment preferences towards pan-EU wallets.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Ireland": {
        "overview": {
            "Population (2024)":                 "5.2M",
            "GDP nominal (2024)":                "$560B",
            "Ecommerce market (2026e)":          "$10B (CAGR 10%)",
            "Online users (2024)":               "5M",
            "Internet penetration (2024)":       "96%",
            "Smartphone penetration (2024)":     "93%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Google Pay","type": "Wallet"},
                {"name": "Revolut",   "type": "Wallet / neobank"},
                {"name": "PayPal",    "type": "Wallet"},
                {"name": "Klarna",    "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 31.2, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 16.9, "type": "international"},
                    {"name": "Mastercard", "share": 11.7, "type": "international"},
                    {"name": "Amex", "share": 2.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 16.8, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.7, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, Revolut, PayPal", "share": 22, "growth": "+24% YoY"},
            {"name": "A2A", "detail": "SEPA Instant", "share": 12, "growth": "+30% YoY"},
            {"name": "BNPL", "detail": "Klarna, Clearpay", "share": 8, "growth": "+22% YoY"},
            {"name": "Direct Debit", "share": 6, "growth": "+2% YoY"},
            {"name": "Cash", "share": 4, "growth": "-12% YoY"},
        ],
        "regulation": [
            "Central Bank of Ireland regulates banks and PSPs. Many global fintechs (Stripe, Revolut pre-relocation, Adyen for EU) operate via Irish licenses post-Brexit.",
            "Ireland is the EU passporting hub for many non-EU PSPs — English-speaking, common law-adjacent, GDPR-aligned.",
            "VAT at 23%; reduced rates 13.5%/9%/0% for specific categories. EU OSS for B2C cross-border.",
            "PSD2 SCA is fully enforced; Irish banks have mature Open Banking APIs.",
            "Revolut is Irish-licensed for its EU business; significant impact on consumer behaviour.",
            "Irish Data Protection Commission (DPC) is the EU-lead regulator for many US Big Tech via main-establishment rules.",
        ],
        "digital_trends": [
            "Ireland is a cards-dominant market (~48%) with strong Apple Pay adoption — per-capita contactless volume is among the highest in Europe.",
            "Revolut has extraordinary penetration in Ireland — reportedly 2M+ Irish users out of 5.2M population.",
            "Stripe originated from an Irish founding team and maintains its EU HQ here — fintech talent density is high.",
            "Cross-border with UK is major but Brexit-complicated; Ireland remains the EU's English-speaking financial hub.",
            "A2A via SEPA Instant is rising; banks are offering free instant transfers to compete with Revolut.",
            "Digital banks dominate among under-35 segments; pillar banks (AIB, Bank of Ireland) are digitizing aggressively.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Austria": {
        "overview": {
            "Population (2024)":                 "9M",
            "GDP nominal (2024)":                "$520B",
            "Ecommerce market (2026e)":          "$12B (CAGR 7%)",
            "Online users (2024)":               "8.5M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "89%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "Bankomat",
            "a2a":     "eps Überweisung / SEPA Instant",
            "apms":    [
                {"name": "eps Überweisung","type": "A2A"},
                {"name": "Bankomat",       "type": "Debit"},
                {"name": "Klarna",         "type": "BNPL / invoice"},
                {"name": "Apple Pay",      "type": "Wallet"},
                {"name": "Bluecode",       "type": "QR wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 14, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 7.9, "type": "international"},
                    {"name": "Mastercard", "share": 5.7, "type": "international"},
                    {"name": "Amex", "share": 0.4, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 26, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Bankomat", "share": 18.2, "type": "local"},
                    {"name": "Visa Debit", "share": 4.3, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "eps", "share": 20, "growth": "+18% YoY"},
            {"name": "Invoice", "detail": "Kauf auf Rechnung", "share": 15, "growth": "-2% YoY"},
            {"name": "Wallets", "detail": "PayPal, Apple Pay", "share": 10, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "Klarna", "share": 10, "growth": "+20% YoY"},
            {"name": "Cash", "share": 5, "growth": "-8% YoY"},
        ],
        "regulation": [
            "FMA (Financial Market Authority) regulates banks and PSPs. OeNB handles monetary and payment rails.",
            "Bankomat is the domestic debit scheme — every Austrian debit card co-badges Bankomat and Maestro/V Pay.",
            "eps Überweisung (owned by Austrian banks) is the online banking A2A rail — similar role to iDEAL / Sofort.",
            "VAT at 20%; reduced 13%/10% for specific. EU OSS for cross-border B2C.",
            "Invoice-based payment (Kauf auf Rechnung) remains culturally common for larger ticket ecommerce.",
            "Data protection under DSB (Austrian DPA) is GDPR-aligned and strict.",
        ],
        "digital_trends": [
            "Austria's payment mix resembles Germany more than the Nordics — invoice + PayPal + Klarna all significant.",
            "Bluecode is a Austrian/Swiss QR wallet focused on discount and loyalty at retail.",
            "Bankomat cards are dominant in-store; contactless adoption is very high.",
            "N26 is Austrian-German founded and has notable domestic share.",
            "Cross-border with Germany is frictionless; shared language and aligned payment preferences.",
            "Wero (EPI wallet) expansion into Austria via Raiffeisen and Erste Bank is underway.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Switzerland": {
        "overview": {
            "Population (2024)":                 "8.7M",
            "GDP nominal (2024)":                "$900B",
            "Ecommerce market (2026e)":          "$25B (CAGR 7%)",
            "Online users (2024)":               "8.4M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "94%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SIC (interbank) / TWINT",
            "apms":    [
                {"name": "TWINT",     "type": "Wallet / A2A"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "PayPal",    "type": "Wallet"},
                {"name": "Klarna",    "type": "BNPL / invoice"},
                {"name": "Google Pay","type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 20, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 10.0, "type": "international"},
                    {"name": "Mastercard", "share": 8.0, "type": "international"},
                    {"name": "Amex", "share": 1.5, "type": "international"},
                    {"name": "Diners", "share": 0.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 20, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.0, "type": "international"},
                    {"name": "Maestro", "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "TWINT", "share": 25, "growth": "+30% YoY"},
            {"name": "Wallets", "detail": "Apple Pay, PayPal", "share": 15, "growth": "+22% YoY"},
            {"name": "Invoice", "detail": "Rechnung / Klarna", "share": 10, "growth": "-4% YoY"},
            {"name": "BNPL", "share": 6, "growth": "+20% YoY"},
            {"name": "Cash", "share": 4, "growth": "-10% YoY"},
        ],
        "regulation": [
            "FINMA is the unified financial markets regulator. SNB handles monetary policy and the SIC settlement system.",
            "Switzerland is not in EU/EEA — PSD2 does not apply directly; Swiss FinSA/FinIA are domestic frameworks.",
            "TWINT (owned by Swiss banks) has 5M+ users and is accepted at most retailers — clear domestic A2A leader.",
            "VAT at 8.1% (lowest in Europe); e-invoicing not mandated but widely used.",
            "Strong banking secrecy heritage complicates data-sharing frameworks (though largely normalized post-2010).",
            "Crypto is well-regulated via FINMA; 'Crypto Valley' (Zug) hosts major blockchain firms.",
        ],
        "digital_trends": [
            "TWINT is Switzerland's answer to the Nordic A2A wallets — universal among Swiss banks, accepted at most retailers.",
            "Cards are high but not dominant (~40%) given TWINT's success.",
            "Cross-border with EU (especially Germany and France) is common; Swiss residents heavily use EU retailers.",
            "Invoice-based ecommerce (traditional Rechnung) remains meaningful but slowly declining.",
            "Cash has fallen below 5% — surprising for a historically cash-comfortable society.",
            "Crypto and tokenization are mature; Sygnum Bank and SEBA Bank offer regulated crypto banking.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Sweden": {
        "overview": {
            "Population (2024)":                 "10.5M",
            "GDP nominal (2024)":                "$600B",
            "Ecommerce market (2026e)":          "$22B (CAGR 6%)",
            "Online users (2024)":               "10.2M",
            "Internet penetration (2024)":       "97%",
            "Smartphone penetration (2024)":     "93%",
            "In-Store : Ecommerce ratio (2024)": "76 : 24",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Swish (dominant)",
            "apms":    [
                {"name": "Swish",     "type": "A2A wallet (dominant)"},
                {"name": "Klarna",    "type": "BNPL / invoice"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Google Pay","type": "Wallet"},
                {"name": "Trustly",   "type": "A2A"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 22, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa", "share": 12.1, "type": "international"},
                    {"name": "Mastercard", "share": 8.8, "type": "international"},
                    {"name": "Amex", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 18, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 7.2, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Swish, Trustly", "share": 25, "growth": "+18% YoY"},
            {"name": "BNPL", "detail": "Klarna (native)", "share": 18, "growth": "+12% YoY"},
            {"name": "Wallets", "detail": "Apple, Google", "share": 12, "growth": "+22% YoY"},
            {"name": "Invoice", "detail": "Klarna Invoice", "share": 4, "growth": "-5% YoY"},
            {"name": "Cash", "share": 1, "growth": "-25% YoY"},
        ],
        "regulation": [
            "FI (Finansinspektionen) regulates banks and PSPs. Riksbank runs RIX interbank rail and is building e-Krona.",
            "Swish (owned by major Swedish banks) is the everyday P2P rail — >8M users, phone-number addressable, Bankid-authenticated.",
            "Sweden is the world's most cashless society — physical cash is almost obsolete.",
            "Klarna originates from Sweden — IPO'd 2025 in NYSE. BNPL mainstream since 2000s.",
            "VAT at 25%; reduced 12%/6%. Online marketplaces responsible for collecting VAT since 2021.",
            "e-Krona (CBDC) pilots are advanced; no firm retail launch date.",
        ],
        "digital_trends": [
            "Sweden has the world's lowest cash usage (~1%) and the most advanced A2A culture.",
            "Swish is synonymous with payment — verbs like 'swisha' are used generically.",
            "Klarna Invoice and Klarna Pay Later are default checkout options at most Swedish ecommerce.",
            "Ecommerce penetration (~24%) is among the highest in Europe.",
            "Cross-border within Nordic markets (with NO/DK/FI) is seamless and heavily used.",
            "Digital banks (Lunar, Northmill) have modest share given incumbents' high digital quality.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Norway": {
        "overview": {
            "Population (2024)":                 "5.5M",
            "GDP nominal (2024)":                "$500B",
            "Ecommerce market (2026e)":          "$14B (CAGR 6%)",
            "Online users (2024)":               "5.4M",
            "Internet penetration (2024)":       "98%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "79 : 21",
        },
        "local_payments": {
            "scheme":  "BankAxept",
            "a2a":     "Vipps (dominant)",
            "apms":    [
                {"name": "Vipps",      "type": "A2A wallet (dominant)"},
                {"name": "Klarna",     "type": "BNPL / invoice"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Trustly",    "type": "A2A"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 18, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa", "share": 9.7, "type": "international"},
                    {"name": "Mastercard", "share": 7.3, "type": "international"},
                    {"name": "Amex", "share": 1.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 27, "growth": "+2% YoY",
                "schemes": [
                    {"name": "BankAxept", "share": 18.9, "type": "local"},
                    {"name": "Visa Debit", "share": 4.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.6, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Vipps", "share": 25, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "Klarna", "share": 15, "growth": "+14% YoY"},
            {"name": "Wallets", "detail": "Apple, Google", "share": 10, "growth": "+22% YoY"},
            {"name": "Invoice", "share": 4, "growth": "-6% YoY"},
            {"name": "Cash", "share": 1, "growth": "-25% YoY"},
        ],
        "regulation": [
            "Finanstilsynet regulates banks and PSPs. Norges Bank runs the NBO settlement system.",
            "Norway is not in EU but in EEA — PSD2 and GDPR apply via EEA agreement.",
            "Vipps (merged with MobilePay in 2022) operates across Norway, Denmark, and Finland — pan-Nordic ambition.",
            "BankAxept is the domestic debit; every Norwegian debit card co-badges BankAxept + Visa/Mastercard.",
            "VAT (MVA) at 25%; reduced 15%/12%. E-invoice mandated B2G.",
            "Crypto regulated via Finanstilsynet; MiCA applies via EEA.",
        ],
        "digital_trends": [
            "Norway is near-cashless; Vipps is the default consumer payment for P2P and increasingly in-store.",
            "Vipps + MobilePay merger creates a potential Nordic standard wallet; integration work through 2025.",
            "Klarna is deeply embedded in ecommerce checkout — Norwegians are heavy BNPL users.",
            "Fish and petroleum B2B sectors drive large cross-border USD/EUR flows; card rails are less central there.",
            "Consumer banking is dominated by DNB — single-provider concentration affects API ecosystem.",
            "Cross-border with SE/DK is seamless under Nordic payment harmonization.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Denmark": {
        "overview": {
            "Population (2024)":                 "5.9M",
            "GDP nominal (2024)":                "$420B",
            "Ecommerce market (2026e)":          "$16B (CAGR 7%)",
            "Online users (2024)":               "5.8M",
            "Internet penetration (2024)":       "98%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "78 : 22",
        },
        "local_payments": {
            "scheme":  "Dankort",
            "a2a":     "MobilePay (dominant)",
            "apms":    [
                {"name": "MobilePay",  "type": "Wallet / A2A"},
                {"name": "Dankort",    "type": "Debit"},
                {"name": "Klarna",     "type": "BNPL / invoice"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 18, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Visa", "share": 10.7, "type": "international"},
                    {"name": "Mastercard", "share": 6.8, "type": "international"},
                    {"name": "Amex", "share": 0.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 27, "growth": "+2% YoY",
                "schemes": [
                    {"name": "Dankort", "share": 18.9, "type": "local"},
                    {"name": "Visa Debit", "share": 4.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.6, "type": "international"},
                ]},
            {"name": "A2A", "detail": "MobilePay", "share": 25, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "Klarna", "share": 12, "growth": "+14% YoY"},
            {"name": "Wallets", "detail": "Apple, Google", "share": 10, "growth": "+22% YoY"},
            {"name": "Invoice", "share": 5, "growth": "-5% YoY"},
            {"name": "Cash", "share": 3, "growth": "-15% YoY"},
        ],
        "regulation": [
            "Finanstilsynet regulates banks and PSPs. Danmarks Nationalbank handles rails and monetary policy.",
            "MobilePay (Danske Bank origin, merged with Vipps 2022) is culturally default for P2P and merchant payment.",
            "Dankort is the domestic debit scheme — virtually all Danish debit cards co-badge Dankort + Visa.",
            "Denmark is in EU but retains the DKK; EUR is not legal tender.",
            "VAT (MOMS) at 25%; no reduced rates (flat). E-invoicing mandatory B2G.",
            "PSD2 SCA enforced; consumer protection standards are strict.",
        ],
        "digital_trends": [
            "Denmark is one of the least cash-using societies — even market vendors accept MobilePay.",
            "MobilePay's Vipps merger positions it as a pan-Nordic wallet — expect converged UX and rails.",
            "Klarna invoice-based checkout is common; similar role to other Nordic markets.",
            "Danish banks (Danske, Nordea, Jyske) have mature APIs; Open Banking via PSD2 is high-quality.",
            "Cross-border within Nordic is frictionless; SEK/NOK/DKK conversions are a PSP feature.",
            "Digital banks (Lunar, Sbanken) have some share but incumbents lead.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Finland": {
        "overview": {
            "Population (2024)":                 "5.5M",
            "GDP nominal (2024)":                "$300B",
            "Ecommerce market (2026e)":          "$12B (CAGR 7%)",
            "Online users (2024)":               "5.4M",
            "Internet penetration (2024)":       "98%",
            "Smartphone penetration (2024)":     "94%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Siirto / SEPA Instant",
            "apms":    [
                {"name": "Klarna",     "type": "BNPL / invoice"},
                {"name": "MobilePay",  "type": "Wallet"},
                {"name": "Pivo",       "type": "Wallet"},
                {"name": "Siirto",     "type": "A2A"},
                {"name": "Apple Pay",  "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 24.8, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 12.7, "type": "international"},
                    {"name": "Mastercard", "share": 9.9, "type": "international"},
                    {"name": "Amex", "share": 2.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 20.2, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.1, "type": "international"},
                    {"name": "Maestro", "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "Siirto, SEPA Instant", "share": 20, "growth": "+24% YoY"},
            {"name": "BNPL", "detail": "Klarna", "share": 15, "growth": "+12% YoY"},
            {"name": "Wallets", "detail": "MobilePay, Pivo, Apple", "share": 12, "growth": "+20% YoY"},
            {"name": "Invoice", "share": 6, "growth": "-8% YoY"},
            {"name": "Cash", "share": 2, "growth": "-20% YoY"},
        ],
        "regulation": [
            "FIN-FSA (Finanssivalvonta) regulates banks and PSPs. Bank of Finland handles monetary policy.",
            "Siirto is Finland's instant A2A rail — owned by Automatia (bank consortium).",
            "Pivo (OP) and MobilePay are the main wallets; both growing but smaller than Nordic peers' market share.",
            "Finland uses EUR; VAT at 25.5% (highest in Nordics); reduced 14%/10%.",
            "PSD2 SCA fully enforced; Open Banking APIs are high-quality.",
            "Crypto under MiCA framework via EU; Bank of Finland takes cautious stance on CBDC.",
        ],
        "digital_trends": [
            "Finland's payment mix is closer to Sweden than Germany — high cards, Klarna BNPL, Siirto A2A.",
            "MobilePay expansion into Finland (post-Vipps merger) is strengthening pan-Nordic positioning.",
            "Klarna is deeply entrenched; invoice-based checkout is a cultural norm.",
            "Finnish banks (OP Ryhmä, Nordea Finland) have strong digital products.",
            "Cross-border within Nordic is frictionless; USD/EUR B2B flows are standard.",
            "Cash usage is very low (~2%); card + mobile dominate.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Poland": {
        "overview": {
            "Population (2024)":                 "38M",
            "GDP nominal (2024)":                "$800B",
            "Ecommerce market (2026e)":          "$28B (CAGR 10%)",
            "Online users (2024)":               "33M",
            "Internet penetration (2024)":       "87%",
            "Smartphone penetration (2024)":     "82%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "BLIK",
            "apms":    [
                {"name": "BLIK",       "type": "A2A (dominant)"},
                {"name": "Przelewy24", "type": "PSP"},
                {"name": "PayU",       "type": "PSP"},
                {"name": "PayPo",      "type": "BNPL"},
                {"name": "Apple Pay",  "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "A2A", "detail": "BLIK", "share": 48, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 15.4, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 7.7, "type": "international"},
                    {"name": "Mastercard", "share": 6.6, "type": "international"},
                    {"name": "Amex", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 12.6, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 6.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.0, "type": "international"},
                    {"name": "Maestro", "share": 0.7, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Apple Pay, PayPal", "share": 10, "growth": "+20% YoY"},
            {"name": "BNPL", "detail": "PayPo, Klarna", "share": 8, "growth": "+30% YoY"},
            {"name": "Cash", "share": 4, "growth": "-10% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "KNF (Polish Financial Supervision Authority) regulates banks and PSPs. NBP (National Bank of Poland) runs rails.",
            "BLIK is Poland's breakout payment success — ~14M active users, bank-consortium owned, used online and in-store via 6-digit code.",
            "Przelewy24 and PayU dominate PSP market; both processing significant ecommerce volume.",
            "VAT at 23%; reduced 8%/5%. Digital services VAT applies to foreign providers.",
            "Polish Data Protection Office (UODO) is active in GDPR enforcement.",
            "Crypto regulated via KNF/MiCA; Polish cryptofintech ecosystem is meaningful (InPay, Coinfirm).",
        ],
        "digital_trends": [
            "BLIK is the single most successful European domestic A2A payment — simpler than iDEAL, with pan-Polish bank support.",
            "Cards are secondary (~28%) because BLIK handles the fast-growing online segment.",
            "PayPo (Poland's BNPL unicorn) and Klarna compete on installment payments.",
            "Cross-border ecommerce from Germany, Czech Republic is common.",
            "Polish banks are heavily digital; mBank, Revolut, and ING Bank Śląski lead in app UX.",
            "Cash has dropped fast; contactless and BLIK together make Poland nearly cashless in urban centers.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Czech Republic": {
        "overview": {
            "Population (2024)":                 "10.7M",
            "GDP nominal (2024)":                "$330B",
            "Ecommerce market (2026e)":          "$8B (CAGR 8%)",
            "Online users (2024)":               "10M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "CERTIS / SEPA Instant",
            "apms":    [
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Twisto",     "type": "BNPL"},
                {"name": "GoPay",      "type": "PSP"},
                {"name": "ComGate",    "type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 27.5, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.2, "type": "international"},
                    {"name": "Mastercard", "share": 12.1, "type": "international"},
                    {"name": "Amex", "share": 2.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22.5, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.0, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "detail": "CERTIS, SEPA Instant", "share": 18, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "Apple Pay, Google Pay", "share": 12, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "Twisto", "share": 10, "growth": "+25% YoY"},
            {"name": "Cash", "share": 7, "growth": "-8% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "ČNB (Czech National Bank) regulates banks and PSPs. Supports active regulatory sandbox for fintech.",
            "Czech Republic uses koruna (CZK) but is moving closer to EUR adoption politically.",
            "VAT at 21%; reduced 15%/10% for essentials.",
            "PSD2 SCA fully enforced; Czech banks have mature APIs.",
            "Crypto under EU MiCA framework; ČNB has been cautious but permissive.",
            "ComGate and GoPay are the leading domestic PSPs; Stripe/Adyen serve larger merchants.",
        ],
        "digital_trends": [
            "Cards dominate (~50%); Czech consumers are comfortable with Visa/Mastercard.",
            "Twisto (Czech BNPL, acquired by Zip) is the local BNPL leader.",
            "ČSOB, Komerční banka, and Česká spořitelna are the pillar banks with strong digital.",
            "Cross-border with Slovakia and Germany is common; cards work seamlessly.",
            "Revolut and mBank (subsidiary of Polish mBank) have meaningful youth share.",
            "Contactless adoption is very high; Apple Pay and Google Pay both widely used.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Hungary": {
        "overview": {
            "Population (2024)":                 "9.6M",
            "GDP nominal (2024)":                "$230B",
            "Ecommerce market (2026e)":          "$6B (CAGR 10%)",
            "Online users (2024)":               "8.7M",
            "Internet penetration (2024)":       "91%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "GIRO Instant",
            "apms":    [
                {"name": "OTP SimplePay","type": "PSP"},
                {"name": "Barion",       "type": "PSP"},
                {"name": "Revolut",      "type": "Wallet"},
                {"name": "Apple Pay",    "type": "Wallet"},
                {"name": "K&H Mobilbank","type": "Bank app"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 24.8, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 12.1, "type": "international"},
                    {"name": "Mastercard", "share": 9.9, "type": "international"},
                    {"name": "Amex", "share": 1.7, "type": "international"},
                    {"name": "JCB", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 20.2, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.1, "type": "international"},
                    {"name": "Maestro", "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "GIRO Instant", "share": 22, "growth": "+25% YoY"},
            {"name": "Wallets", "detail": "Revolut, Apple Pay", "share": 12, "growth": "+25% YoY"},
            {"name": "Cash", "share": 10, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 8, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "MNB (Magyar Nemzeti Bank) is the central bank and regulator. It operates GIRO Instant — the mandatory instant payment rail launched 2020.",
            "Hungary uses forint (HUF) and has no firm EUR adoption timeline.",
            "VAT at 27% (highest in EU); reduced rates 18%/5%.",
            "OTP Bank (largest Hungarian bank, also CE Europe regional) leads via SimplePay gateway.",
            "Crypto regulated via MiCA / EU framework.",
            "Data protection via NAIH is active in GDPR enforcement.",
        ],
        "digital_trends": [
            "GIRO Instant (mandatory Nov 2020) has been a major success — banks compete on instant transfer UX.",
            "Revolut has strong adoption among younger urban consumers.",
            "Barion is a Hungarian PSP unicorn competitor to OTP SimplePay.",
            "BNPL is growing; Enpara, Paygo, and Klarna compete.",
            "Cross-border within CEE is common; cards and A2A both work cross-border via SEPA-like rails.",
            "Cash is still ~10% but declining; rural/older segments retain it longer.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Romania": {
        "overview": {
            "Population (2024)":                 "19M",
            "GDP nominal (2024)":                "$345B",
            "Ecommerce market (2026e)":          "$6B (CAGR 15%)",
            "Online users (2024)":               "16M",
            "Internet penetration (2024)":       "84%",
            "Smartphone penetration (2024)":     "80%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "TransFond / SENT",
            "apms":    [
                {"name": "NETOPIA Payments","type": "PSP"},
                {"name": "EuPlatesc",       "type": "PSP"},
                {"name": "PayU",            "type": "PSP"},
                {"name": "Revolut",         "type": "Wallet"},
                {"name": "Apple Pay",       "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 20.9, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa", "share": 10.5, "type": "international"},
                    {"name": "Mastercard", "share": 8.8, "type": "international"},
                    {"name": "Amex", "share": 1.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 17.1, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 9.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 6.8, "type": "international"},
                    {"name": "Maestro", "share": 0.9, "type": "international"},
                ]},
            {"name": "A2A", "share": 20, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "Revolut, Apple Pay", "share": 15, "growth": "+28% YoY"},
            {"name": "Cash", "share": 15, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 8, "growth": "+35% YoY"},
            {"name": "Other", "share": 4, "growth": "flat"},
        ],
        "regulation": [
            "BNR (Banca Națională a României) regulates banks; ASF regulates non-bank PSPs.",
            "Romania uses leu (RON); EUR adoption target 2029.",
            "VAT at 19%; reduced 9%/5%.",
            "Revolut has extraordinary adoption in Romania — ~4M+ Romanian users.",
            "Cash on delivery still meaningful (~15%) driven by trust gaps and rural segments.",
            "PSD2 SCA fully enforced; Romanian banks have decent APIs.",
        ],
        "digital_trends": [
            "Romania has one of the fastest-growing ecommerce markets in Europe (~15% CAGR).",
            "Revolut dominance is a standout European phenomenon — significantly higher share than neighbors.",
            "NETOPIA and EuPlatesc are the leading domestic PSPs; both service emarket and eMag.",
            "BNPL (TBI Bank Pay, Klarna, Tinka) is growing fast from a small base.",
            "Cross-border with Moldova, Bulgaria, Hungary is common; RON/EUR conversion is a key PSP feature.",
            "Rural areas still heavily use cash and COD; urban centers are card-dominant.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Greece": {
        "overview": {
            "Population (2024)":                 "10.4M",
            "GDP nominal (2024)":                "$250B",
            "Ecommerce market (2026e)":          "$8B (CAGR 10%)",
            "Online users (2024)":               "8.5M",
            "Internet penetration (2024)":       "82%",
            "Smartphone penetration (2024)":     "78%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "IRIS Online Payments",
            "apms":    [
                {"name": "IRIS",       "type": "A2A"},
                {"name": "Viva Wallet","type": "Wallet / PSP"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Google Pay", "type": "Wallet"},
                {"name": "Cardlink",   "type": "Acquirer"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 33, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 16.8, "type": "international"},
                    {"name": "Mastercard", "share": 13.2, "type": "international"},
                    {"name": "Amex", "share": 2.4, "type": "international"},
                    {"name": "Diners", "share": 0.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "detail": "IRIS", "share": 15, "growth": "+30% YoY"},
            {"name": "Wallets", "detail": "Viva, Apple Pay", "share": 12, "growth": "+22% YoY"},
            {"name": "Cash", "share": 8, "growth": "-12% YoY"},
            {"name": "BNPL", "share": 7, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "Bank of Greece regulates banks; Hellenic Capital Market Commission oversees markets.",
            "IRIS Online Payments (bank consortium) is the domestic A2A rail — launched 2021, gaining traction.",
            "Viva Wallet (JPMorgan-owned since 2022) is a Greek PSP unicorn operating across Europe.",
            "VAT at 24%; reduced 13%/6%. Islands have reduced VAT in some categories.",
            "Crypto under EU MiCA.",
            "Data protection via HDPA is active in GDPR enforcement.",
        ],
        "digital_trends": [
            "Cards dominate (~55%) — Greeks caught up to European card norms post-COVID.",
            "IRIS is gaining traction as tax authorities push merchants to accept it to reduce cash economy.",
            "Viva Wallet transformation into a mainstream European PSP is a notable success story.",
            "Cross-border tourism drives substantial USD/EUR/GBP card acceptance at hotels and islands.",
            "BNPL (Klarna, Viva Pay Later) is growing but smaller than Western Europe.",
            "Cash persists (~8%) due to cultural and tax-related preferences; slowly declining.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Ukraine": {
        "overview": {
            "Population (2024)":                 "37M",
            "GDP nominal (2024)":                "$180B",
            "Ecommerce market (2026e)":          "$5B (CAGR 10%)",
            "Online users (2024)":               "29M",
            "Internet penetration (2024)":       "78%",
            "Smartphone penetration (2024)":     "72%",
            "In-Store : Ecommerce ratio (2024)": "87 : 13",
        },
        "local_payments": {
            "scheme":  "PROSTIR",
            "a2a":     "SEP (System of Electronic Payments)",
            "apms":    [
                {"name": "Monobank",  "type": "Neobank / wallet"},
                {"name": "Privat24",  "type": "Bank app / wallet"},
                {"name": "LiqPay",    "type": "PSP"},
                {"name": "Portmone",  "type": "PSP"},
                {"name": "Apple Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 27.5, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 15.4, "type": "international"},
                    {"name": "Mastercard", "share": 12.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 27.5, "growth": "+4% YoY",
                "schemes": [
                    {"name": "PROSTIR Debit", "share": 19.2, "type": "local"},
                    {"name": "Visa Debit", "share": 4.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.7, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Monobank, Privat24", "share": 20, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "SEP / instant", "share": 12, "growth": "+22% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL / Other", "share": 5, "growth": "+30% YoY"},
        ],
        "regulation": [
            "NBU (National Bank of Ukraine) regulates banks, PSPs, and payment systems. Wartime rules shape FX, capital controls, and fintech.",
            "Monobank (~8M users) and Privat24 (PrivatBank, state-owned) are the dominant digital banks.",
            "LiqPay (part of PrivatBank) and Fondy are leading domestic PSPs.",
            "Ukraine has EU candidate status; payments framework aligning with PSD2 standards.",
            "VAT at 20%.",
            "Crypto: Ukraine legalized crypto in 2022 (Law 'On Virtual Assets') but operational framework still being developed.",
        ],
        "digital_trends": [
            "Despite war, Ukrainian fintech remains resilient — Monobank has added millions of users during the war.",
            "Diia (government app) integrates digital ID, vaccine passports, business permits, and some payment flows.",
            "Crypto donations and stablecoin rails are meaningful for cross-border aid.",
            "Cross-border ecommerce is constrained by war; Rozetka is the dominant domestic marketplace.",
            "FX and capital controls under wartime rules complicate international settlement.",
            "Reconstruction and EU integration will drive long-term payment infrastructure modernization.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Bulgaria": {
        "overview": {
            "Population (2024)":                 "6.6M",
            "GDP nominal (2024)":                "$100B",
            "Ecommerce market (2026e)":          "$2.5B (CAGR 13%)",
            "Online users (2024)":               "5.5M",
            "Internet penetration (2024)":       "83%",
            "Smartphone penetration (2024)":     "78%",
            "In-Store : Ecommerce ratio (2024)": "87 : 13",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "BISERA / RINGS",
            "apms":    [
                {"name": "ePay",      "type": "PSP"},
                {"name": "MyPOS",     "type": "PSP"},
                {"name": "Borica",    "type": "Acquirer"},
                {"name": "Apple Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 22.5, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 11.8, "type": "international"},
                    {"name": "Mastercard", "share": 9.6, "type": "international"},
                    {"name": "Amex", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22.5, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Borica Debit", "share": 15.7, "type": "local"},
                    {"name": "Visa Debit", "share": 3.7, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.1, "type": "international"},
                ]},
            {"name": "Cash", "share": 20, "growth": "-8% YoY"},
            {"name": "A2A", "share": 18, "growth": "+22% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+24% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+30% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "BNB (Bulgarian National Bank) regulates banks and PSPs. Bulgaria is working toward Eurozone entry (target 2026).",
            "Borica is the domestic scheme and interbank network.",
            "VAT at 20%.",
            "Cash payments still ~20% due to rural segments and tax-evasion incentives.",
            "Crypto under MiCA; Bulgaria has meaningful crypto miner presence.",
            "Cross-border within EU is frictionless via SEPA.",
        ],
        "digital_trends": [
            "Bulgaria's ecommerce is growing 13% — among the fastest in EU.",
            "MyPOS is a Bulgarian payments unicorn with international reach.",
            "Cash persistence is unusual for EU — driven by rural, older demographics and informal economy.",
            "Cross-border with Romania and Greece is common; multi-currency EUR/BGN pricing standard.",
            "Revolut has strong youth adoption.",
            "Eurozone entry (2026 target) will simplify payment flows.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Croatia": {
        "overview": {
            "Population (2024)":                 "3.9M",
            "GDP nominal (2024)":                "$80B",
            "Ecommerce market (2026e)":          "$2B (CAGR 10%)",
            "Online users (2024)":               "3.5M",
            "Internet penetration (2024)":       "89%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "NKSInst / SEPA Instant",
            "apms":    [
                {"name": "WSPay",     "type": "Gateway"},
                {"name": "CorvusPay", "type": "PSP"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Keks Pay",  "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 30.3, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 15.4, "type": "international"},
                    {"name": "Mastercard", "share": 12.1, "type": "international"},
                    {"name": "Amex", "share": 2.8, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 24.7, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.6, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.9, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SEPA Instant", "share": 18, "growth": "+25% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+22% YoY"},
            {"name": "Cash", "share": 10, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+30% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "HNB (Croatian National Bank) regulates banks. Croatia joined Eurozone and Schengen in 2023.",
            "Uses EUR since 2023; previously Kuna.",
            "VAT (PDV) at 25%; reduced 13%/5% for essentials.",
            "PSD2 SCA fully enforced.",
            "WSPay is the leading domestic gateway across the Adriatic region.",
            "Cross-border tourism creates strong seasonal USD/EUR/GBP acquiring volume.",
        ],
        "digital_trends": [
            "Euro adoption (2023) simplified cross-border flows dramatically.",
            "Tourism (Dalmatian coast) drives heavy card acceptance seasonally.",
            "WSPay expanded regionally post-EUR adoption.",
            "Revolut and N26 have strong youth adoption.",
            "Keks Pay (Erste Bank) is the main mobile wallet.",
            "Cash still present but declining as tourism push cards/wallets.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Slovakia": {
        "overview": {
            "Population (2024)":                 "5.4M",
            "GDP nominal (2024)":                "$130B",
            "Ecommerce market (2026e)":          "$3B (CAGR 9%)",
            "Online users (2024)":               "4.8M",
            "Internet penetration (2024)":       "90%",
            "Smartphone penetration (2024)":     "85%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Tatra Pay",  "type": "A2A"},
                {"name": "24-pay",     "type": "PSP"},
                {"name": "GP webpay",  "type": "Gateway"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Klarna",     "type": "BNPL"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28.6, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 14.3, "type": "international"},
                    {"name": "Mastercard", "share": 12.1, "type": "international"},
                    {"name": "Amex", "share": 2.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 23.4, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.4, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "share": 18, "growth": "+22% YoY"},
            {"name": "Cash", "share": 12, "growth": "-8% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "NBS (National Bank of Slovakia) regulates banks and PSPs. Part of Eurozone since 2009.",
            "Uses EUR; SEPA Instant mandatory.",
            "VAT at 20%; reduced 10%/5%.",
            "PSD2 SCA fully enforced.",
            "Cross-border with Czech Republic, Austria, Hungary is very common.",
            "Crypto under EU MiCA.",
        ],
        "digital_trends": [
            "Similar payment mix to Czech Republic — cards-dominated, SEPA Instant growing.",
            "Tatra banka and Slovenská sporiteľňa (Erste) lead digital banking.",
            "Cross-border within CEE is frictionless.",
            "Revolut has strong youth adoption.",
            "Cash has declined steadily; contactless adoption very high.",
            "BNPL (Klarna, Twisto) is early stage.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Slovenia": {
        "overview": {
            "Population (2024)":                 "2.1M",
            "GDP nominal (2024)":                "$68B",
            "Ecommerce market (2026e)":          "$1.2B (CAGR 8%)",
            "Online users (2024)":               "1.95M",
            "Internet penetration (2024)":       "93%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "86 : 14",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "UPN / SEPA Instant",
            "apms":    [
                {"name": "Bankart",    "type": "Acquirer"},
                {"name": "Activa Pay", "type": "Wallet"},
                {"name": "Hal E-Bank", "type": "A2A"},
                {"name": "Apple Pay",  "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 27.5, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.8, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex", "share": 1.6, "type": "international"},
                    {"name": "Diners", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22.5, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.4, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.0, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "share": 20, "growth": "+22% YoY"},
            {"name": "Cash", "share": 12, "growth": "-8% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "Banka Slovenije regulates banks; part of Eurozone since 2007.",
            "Uses EUR.",
            "VAT at 22%.",
            "PSD2 SCA fully enforced.",
            "Cross-border with Italy, Austria, Croatia common.",
            "Bankart is the main domestic acquirer.",
        ],
        "digital_trends": [
            "Cards dominate; SEPA Instant is growing rapidly.",
            "NKBM and NLB are the largest banks.",
            "Revolut has strong youth adoption.",
            "Cross-border tourism supports card acquiring.",
            "Cash is ~12%, declining.",
            "E-commerce is growing 8% CAGR.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Estonia": {
        "overview": {
            "Population (2024)":                 "1.3M",
            "GDP nominal (2024)":                "$42B",
            "Ecommerce market (2026e)":          "$0.6B (CAGR 9%)",
            "Online users (2024)":               "1.25M",
            "Internet penetration (2024)":       "94%",
            "Smartphone penetration (2024)":     "89%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Maksekeskus","type": "PSP"},
                {"name": "Montonio",   "type": "PSP"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "LHV Pank",   "type": "Bank app"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.5, "type": "international"},
                    {"name": "Amex", "share": 1.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SEPA Instant", "share": 30, "growth": "+22% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
            {"name": "Cash", "share": 2, "growth": "-20% YoY"},
        ],
        "regulation": [
            "Finantsinspektsioon (EFSA) regulates banks and PSPs; part of Eurozone since 2011.",
            "Estonia is a highly digital society — e-Residency, digital ID, and online voting are native.",
            "Uses EUR.",
            "VAT at 22%.",
            "PSD2 SCA fully enforced.",
            "Crypto under MiCA; Estonian crypto license regime tightened significantly post-2020.",
        ],
        "digital_trends": [
            "Estonia leads Europe on digital government and payments — e-Residency has attracted 100K+ global entrepreneurs.",
            "LHV Pank is a digital-native domestic bank.",
            "Wise (formerly TransferWise) has Estonian roots.",
            "SEPA Instant adoption is very high; consumers expect instant.",
            "Cash usage is minimal (~2%).",
            "Cross-border with Latvia, Lithuania, Finland is seamless.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Latvia": {
        "overview": {
            "Population (2024)":                 "1.9M",
            "GDP nominal (2024)":                "$43B",
            "Ecommerce market (2026e)":          "$0.8B (CAGR 9%)",
            "Online users (2024)":               "1.75M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "87%",
            "In-Store : Ecommerce ratio (2024)": "85 : 15",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Maksekeskus","type": "PSP"},
                {"name": "Klarna",     "type": "BNPL"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "Citadele",   "type": "Bank app"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.0, "type": "international"},
                    {"name": "Mastercard", "share": 10.5, "type": "international"},
                    {"name": "Amex", "share": 1.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 25, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 10.0, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SEPA Instant", "share": 25, "growth": "+22% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+20% YoY"},
            {"name": "Cash", "share": 8, "growth": "-12% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "Latvijas Banka regulates banks and PSPs (integrated with former FKTK 2023); Eurozone member since 2014.",
            "Uses EUR.",
            "VAT at 21%; reduced rates for specific categories.",
            "PSD2 SCA fully enforced.",
            "Cross-border with Lithuania, Estonia, and Nordic markets common.",
            "Crypto under MiCA.",
        ],
        "digital_trends": [
            "Similar to Estonia/Lithuania — cards + SEPA Instant dominant.",
            "Citadele and Swedbank Latvia are the largest banks.",
            "Revolut and Wise have strong youth share.",
            "Cross-border with Nordic and Baltic partners is common.",
            "Cash usage declining; card/A2A dominate.",
            "Fintech ecosystem smaller than Lithuania's but growing.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Lithuania": {
        "overview": {
            "Population (2024)":                 "2.8M",
            "GDP nominal (2024)":                "$78B",
            "Ecommerce market (2026e)":          "$1.2B (CAGR 9%)",
            "Online users (2024)":               "2.7M",
            "Internet penetration (2024)":       "95%",
            "Smartphone penetration (2024)":     "90%",
            "In-Store : Ecommerce ratio (2024)": "83 : 17",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Paysera",   "type": "Wallet / PSP"},
                {"name": "Revolut",   "type": "Wallet"},
                {"name": "Klarna",    "type": "BNPL"},
                {"name": "Apple Pay", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 26.4, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 13.3, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex", "share": 1.6, "type": "international"},
                    {"name": "Diners", "share": 0.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 21.6, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 11.9, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.6, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SEPA Instant", "share": 25, "growth": "+22% YoY"},
            {"name": "Wallets", "detail": "Paysera, Revolut", "share": 12, "growth": "+24% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+28% YoY"},
            {"name": "Other", "share": 3, "growth": "flat"},
        ],
        "regulation": [
            "Lietuvos bankas regulates banks and PSPs; Eurozone member since 2015.",
            "Lithuania is the largest fintech licensing hub in Europe — hundreds of EMI and PI licenses issued.",
            "Revolut's banking license is Lithuanian.",
            "VAT at 21%; reduced 9%/5%.",
            "PSD2 SCA fully enforced; Lithuanian banks have high-quality APIs.",
            "Crypto under MiCA; Lithuanian crypto regime is well-developed.",
        ],
        "digital_trends": [
            "Lithuania's fintech licensing success has created disproportionate payments infrastructure sophistication.",
            "Revolut, Wise, Paysera, and many others hold Lithuanian EMI licenses.",
            "Paysera is a homegrown fintech unicorn with EU-wide reach.",
            "Cross-border within Baltic and Nordic is seamless.",
            "Cash usage is low and declining.",
            "Open Banking APIs very high quality.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Luxembourg": {
        "overview": {
            "Population (2024)":                 "0.66M",
            "GDP nominal (2024)":                "$86B",
            "Ecommerce market (2026e)":          "$1.2B (CAGR 7%)",
            "Online users (2024)":               "0.64M",
            "Internet penetration (2024)":       "98%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "80 : 20",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant / Payconiq",
            "apms":    [
                {"name": "Payconiq",   "type": "Wallet / A2A"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "LUXHUB",     "type": "Open Banking API hub"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 33, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 16.8, "type": "international"},
                    {"name": "Mastercard", "share": 13.2, "type": "international"},
                    {"name": "Amex", "share": 3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 22, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 8.8, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Payconiq, Apple Pay, PayPal", "share": 18, "growth": "+22% YoY"},
            {"name": "A2A", "detail": "SEPA Instant", "share": 15, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+26% YoY"},
            {"name": "Cash", "share": 5, "growth": "-10% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "CSSF (Commission de Surveillance du Secteur Financier) regulates banks, PSPs, and funds.",
            "Luxembourg is a major EU financial center — PSP, fund administration, and private banking hub.",
            "Uses EUR.",
            "VAT at 17% (lowest in EU); Luxembourg historically benefited from EU VAT arbitrage (pre-2015).",
            "Cross-border with France, Belgium, Germany is daily reality (commuters).",
            "Many global payment firms (Amazon Payments EU, PayPal EU, Rakuten Europe Bank) are Luxembourg-licensed.",
        ],
        "digital_trends": [
            "Luxembourg hosts many payment giants' EU HQs — PayPal Europe, Amazon Payments, Rakuten Europe.",
            "Payconiq originated as a Luxembourg-Netherlands-Belgium alliance.",
            "Retail payment mix is mostly cards; wallets growing.",
            "Multilingual/multi-currency acquiring is a native requirement.",
            "LUXHUB is one of Europe's most established Open Banking API aggregators.",
            "Crypto under MiCA; Luxembourg has many crypto fund structures.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Iceland": {
        "overview": {
            "Population (2024)":                 "0.4M",
            "GDP nominal (2024)":                "$28B",
            "Ecommerce market (2026e)":          "$0.8B (CAGR 8%)",
            "Online users (2024)":               "0.39M",
            "Internet penetration (2024)":       "99%",
            "Smartphone penetration (2024)":     "95%",
            "In-Store : Ecommerce ratio (2024)": "75 : 25",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "RB1 (instant)",
            "apms":    [
                {"name": "Aur",       "type": "Wallet"},
                {"name": "Kass",      "type": "Wallet"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "Saltpay",   "type": "Acquirer"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 35.8, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 18.7, "type": "international"},
                    {"name": "Mastercard", "share": 14.3, "type": "international"},
                    {"name": "Amex", "share": 2.8, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 29.2, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 16.1, "type": "international"},
                    {"name": "Mastercard Debit", "share": 11.7, "type": "international"},
                    {"name": "Maestro", "share": 1.4, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Aur, Kass, Apple Pay", "share": 18, "growth": "+22% YoY"},
            {"name": "A2A", "detail": "RB1", "share": 10, "growth": "+20% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+28% YoY"},
            {"name": "Cash", "share": 2, "growth": "-25% YoY"},
            {"name": "Other", "share": 1, "growth": "flat"},
        ],
        "regulation": [
            "Fjármálaeftirlitið (FME, integrated into Central Bank of Iceland) regulates banks and PSPs.",
            "Iceland is in EEA (not EU) — PSD2 and GDPR apply.",
            "Uses ISK (Icelandic króna).",
            "VAT at 24%; reduced 11%.",
            "Cashless society (~2% cash); one of the world's lowest.",
            "Crypto under MiCA via EEA; Iceland has cheap geothermal-powered Bitcoin mining.",
        ],
        "digital_trends": [
            "Iceland has the highest card share in Europe (~65%) — cards are culturally default.",
            "Aur and Kass are the native mobile wallets for P2P.",
            "Tourism is a huge economy driver — card acceptance at every merchant.",
            "Cross-border with Nordic and US/UK is common.",
            "Cash is nearly gone.",
            "Banking is concentrated in 3 banks (Landsbanki, Arion, Íslandsbanki).",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Cyprus": {
        "overview": {
            "Population (2024)":                 "1.3M",
            "GDP nominal (2024)":                "$32B",
            "Ecommerce market (2026e)":          "$1B (CAGR 11%)",
            "Online users (2024)":               "1.2M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "84 : 16",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "JCC transfer / SEPA Instant",
            "apms":    [
                {"name": "JCC Payment","type": "Acquirer"},
                {"name": "Apple Pay",  "type": "Wallet"},
                {"name": "PayPal",     "type": "Wallet"},
                {"name": "Revolut",    "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 34.8, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa", "share": 18.0, "type": "international"},
                    {"name": "Mastercard", "share": 13.8, "type": "international"},
                    {"name": "Amex", "share": 2.4, "type": "international"},
                    {"name": "Diners", "share": 0.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 23.2, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 12.8, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.3, "type": "international"},
                    {"name": "Maestro", "share": 1.1, "type": "international"},
                ]},
            {"name": "Wallets", "share": 15, "growth": "+22% YoY"},
            {"name": "Cash", "share": 10, "growth": "-10% YoY"},
            {"name": "A2A", "share": 10, "growth": "+20% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+28% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "Central Bank of Cyprus regulates banks and PSPs; Eurozone member since 2008.",
            "Uses EUR.",
            "VAT at 19%; reduced 9%/5%.",
            "Cyprus is a regional financial center — many Russian/CIS origin funds pre-2022.",
            "JCC is the main domestic acquirer.",
            "Crypto under MiCA.",
        ],
        "digital_trends": [
            "Card-heavy payment mix; tourism drives heavy acceptance.",
            "JCC dominates acquiring.",
            "Russian/CIS-linked banking reduced significantly post-2022 sanctions.",
            "Revolut has strong share.",
            "Cross-border with Greece, UK common.",
            "Cash still meaningful (~10%) but declining.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Malta": {
        "overview": {
            "Population (2024)":                 "0.54M",
            "GDP nominal (2024)":                "$18B",
            "Ecommerce market (2026e)":          "$0.4B (CAGR 10%)",
            "Online users (2024)":               "0.5M",
            "Internet penetration (2024)":       "92%",
            "Smartphone penetration (2024)":     "88%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SEPA Instant",
            "apms":    [
                {"name": "Truevo",    "type": "Acquirer"},
                {"name": "APCO Pay",  "type": "PSP"},
                {"name": "Apple Pay", "type": "Wallet"},
                {"name": "BOV Pay",   "type": "Bank wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 36, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa", "share": 18.6, "type": "international"},
                    {"name": "Mastercard", "share": 13.8, "type": "international"},
                    {"name": "Amex", "share": 2.4, "type": "international"},
                    {"name": "Diners", "share": 1.2, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 24, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit", "share": 13.2, "type": "international"},
                    {"name": "Mastercard Debit", "share": 9.6, "type": "international"},
                    {"name": "Maestro", "share": 1.2, "type": "international"},
                ]},
            {"name": "Wallets", "share": 15, "growth": "+22% YoY"},
            {"name": "A2A", "share": 10, "growth": "+22% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+28% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "MFSA (Malta Financial Services Authority) regulates banks, PSPs, and iGaming.",
            "Malta is an iGaming licensing hub and has significant crypto licensing (though reduced post-2020).",
            "Uses EUR.",
            "VAT at 18%; reduced 12%/7%/5%.",
            "iGaming drives unique payment flows — many PSPs specialize in Malta-licensed operators.",
            "Crypto under MiCA; Malta's early Virtual Financial Assets Act (2018) superseded.",
        ],
        "digital_trends": [
            "Malta's payment mix is card-dominated with meaningful iGaming-driven specialty flows.",
            "Bank of Valletta and HSBC Malta are the pillars.",
            "Truevo is a Malta-based acquirer with European reach.",
            "Tourism creates heavy card acceptance seasonally.",
            "Cash still ~8% — declining.",
            "Cross-border within EU is frictionless.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Russia": {
        "overview": {
            "Population (2024)":                 "143M",
            "GDP nominal (2024)":                "$2.1T",
            "Ecommerce market (2026e)":          "$60B (CAGR 14%)",
            "Online users (2024)":               "126M",
            "Internet penetration (2024)":       "88%",
            "Smartphone penetration (2024)":     "82%",
            "In-Store : Ecommerce ratio (2024)": "78 : 22",
        },
        "local_payments": {
            "scheme":  "Mir",
            "a2a":     "SBP (System of Fast Payments)",
            "apms":    [
                {"name": "SBP",         "type": "A2A (instant)"},
                {"name": "SberPay",     "type": "Wallet (Sber)"},
                {"name": "YooMoney",    "type": "Wallet"},
                {"name": "Tinkoff Pay", "type": "Wallet"},
                {"name": "Mir Pay",     "type": "Wallet (NSPK)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "share": 35, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Mir",              "share": 22.0, "type": "local"},
                    {"name": "Visa Debit",       "share":  6.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  4.0, "type": "international"},
                    {"name": "UnionPay",         "share":  3.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SBP", "share": 22, "growth": "+35% YoY"},
            {"name": "Wallets", "detail": "SberPay, YooMoney, Tinkoff Pay", "share": 15, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 15, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Mir",        "share": 7.0, "type": "local"},
                    {"name": "Visa",       "share": 3.0, "type": "international"},
                    {"name": "Mastercard", "share": 3.0, "type": "international"},
                    {"name": "UnionPay",   "share": 2.0, "type": "international"},
                ]},
            {"name": "Cash", "share": 10, "growth": "-8% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+30% YoY"},
        ],
        "regulation": [
            "CBR (Central Bank of Russia) regulates banks, PSPs, and payment systems. NSPK operates Mir and SBP.",
            "Mir is the national card scheme (launched 2015 after Crimea sanctions); mandatory for government salaries, pensions, and state welfare.",
            "Post-2022 sanctions: Visa and Mastercard suspended operations in Russia — pre-issued domestic cards still work locally but can't be used abroad. New international issuance runs via UnionPay or Mir-UnionPay co-badge.",
            "SBP (Sistema Bystrykh Platezhey) launched 2019 — free for consumer P2P up to RUB 100K/month; merchant QR acceptance growing fast.",
            "VAT at 20%; digital services tax for foreign providers complex post-2022 as many left the market.",
            "Digital ruble (CBDC) pilots live since 2023; consumer rollout targeted for 2026-27. Crypto regulated via Digital Financial Assets Law (2021).",
        ],
        "digital_trends": [
            "Mir now holds >60% of card issuing in Russia. Every state-linked salary is paid to a Mir card by law.",
            "SBP usage surged post-2022 — with international cards blocked for cross-border, SBP handles most domestic instant transfers.",
            "Sber ecosystem (Sber, SberPay, SberMarket, Okko) is Russia's closest super-app analogue; 100M+ users.",
            "Yandex (Yandex Pay, YooMoney) remains dominant tech ecosystem; Yandex Go covers delivery, taxi, grocery.",
            "Cross-border commerce heavily reshaped — Aliexpress and Wildberries dominate; payments route through UnionPay, Mir-UnionPay co-badge, or stablecoin P2P.",
            "Stablecoin (USDT) is commonly used as a sanctions/capital-controls workaround; Binance P2P activity remains very high despite exchange exits.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Serbia": {
        "overview": {
            "Population (2024)":                 "6.6M",
            "GDP nominal (2024)":                "$80B",
            "Ecommerce market (2026e)":          "$1.5B (CAGR 14%)",
            "Online users (2024)":               "5.8M",
            "Internet penetration (2024)":       "83%",
            "Smartphone penetration (2024)":     "78%",
            "In-Store : Ecommerce ratio (2024)": "87 : 13",
        },
        "local_payments": {
            "scheme":  "DinaCard",
            "a2a":     "IPS NBS (instant)",
            "apms":    [
                {"name": "AllSecure",        "type": "PSP"},
                {"name": "Monri",            "type": "PSP"},
                {"name": "Banca Intesa",     "type": "Acquirer"},
                {"name": "Komercijalna Banka","type": "Acquirer"},
                {"name": "Apple Pay",        "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 21, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa", "share": 11.1, "type": "international"},
                    {"name": "Mastercard", "share": 8.8, "type": "international"},
                    {"name": "Amex", "share": 1.1, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 21, "growth": "+5% YoY",
                "schemes": [
                    {"name": "DinaCard Debit", "share": 14.7, "type": "local"},
                    {"name": "Visa Debit", "share": 3.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 2.8, "type": "international"},
                ]},
            {"name": "Cash", "share": 25, "growth": "-8% YoY"},
            {"name": "A2A", "detail": "IPS NBS", "share": 18, "growth": "+28% YoY"},
            {"name": "Wallets", "share": 10, "growth": "+25% YoY"},
            {"name": "BNPL", "share": 3, "growth": "+30% YoY"},
            {"name": "Other", "share": 2, "growth": "flat"},
        ],
        "regulation": [
            "NBS (National Bank of Serbia) regulates banks and PSPs.",
            "Serbia uses dinar (RSD); not yet EU but an EU candidate.",
            "VAT at 20%; reduced 10%.",
            "IPS NBS (instant payment system) operates 24/7 — mandatory for banks.",
            "Cash is still 25% — highest share among European ecommerce markets.",
            "Cross-border with Balkans and EU growing.",
        ],
        "digital_trends": [
            "Serbia is among the fastest-growing ecommerce markets in Europe (~14% CAGR).",
            "DinaCard is used alongside international schemes.",
            "Cash remains unusually high due to rural segments and tax-related informal economy.",
            "Digital banking adoption growing; Banca Intesa, Raiffeisen, and UniCredit dominate.",
            "Cross-border tourism from Bulgaria, Romania, Hungary supports card acceptance.",
            "Crypto is being regulated (Serbian framework 2021, aligning with MiCA).",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Myanmar": {
        "overview": {
            "Population (2024)":                 "55M",
            "GDP nominal (2024)":                "$65B",
            "Ecommerce market (2026e)":          "$0.8B (CAGR 15%)",
            "Online users (2024)":               "24M",
            "Internet penetration (2024)":       "44%",
            "Smartphone penetration (2024)":     "40%",
            "In-Store : Ecommerce ratio (2024)": "95 : 5",
        },
        "local_payments": {
            "scheme":  "MPU",
            "a2a":     "CBM-NET",
            "apms":    [
                {"name": "Wave Money", "type": "Mobile money"},
                {"name": "KBZPay",     "type": "Wallet (KBZ Bank)"},
                {"name": "OnePay",     "type": "Wallet"},
                {"name": "AYA Pay",    "type": "Bank wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 40, "growth": "-4% YoY"},
            {"name": "Wallets", "detail": "Wave Money, KBZPay", "share": 25, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa", "share": 2.4, "type": "international"},
                    {"name": "Mastercard", "share": 1.6, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 6, "growth": "+5% YoY",
                "schemes": [
                    {"name": "MPU", "share": 4.2, "type": "local"},
                    {"name": "Visa Debit", "share": 1.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 0.8, "type": "international"},
                ]},
            {"name": "A2A", "detail": "CBM-NET", "share": 10, "growth": "+18% YoY"},
            {"name": "COD", "share": 10, "growth": "-12% YoY"},
            {"name": "Other / USD", "share": 5, "growth": "flat"},
        ],
        "regulation": [
            "Central Bank of Myanmar (CBM) regulates banks and payment services. Political situation (post-2021) has complicated regulatory environment.",
            "US and EU sanctions restrict international banking; Visa, Mastercard, and SWIFT access for Myanmar-issued instruments is limited.",
            "Wave Money (Yoma Bank/Telenor — now Norwegian stake sold) and KBZPay are the dominant wallets; KBZ Bank is largest private bank.",
            "VAT/commercial tax at 5%; enforcement tightened since 2022 reforms.",
            "Data protection law is in draft; cyber security law applies.",
            "Remittances primarily via informal hundi corridors and growing stablecoin P2P due to banking restrictions.",
        ],
        "digital_trends": [
            "Myanmar's digital payment infrastructure was built during 2015–2020 boom but political crisis since 2021 has stalled progress.",
            "Wave Money and KBZPay collectively serve ~25M users; they're the primary digital rails given banking disruption.",
            "International ecommerce is constrained by sanctions; most cross-border flows route through Singapore or Thailand PSPs.",
            "Cash remains dominant (~40%); banking penetration is limited outside Yangon and Mandalay.",
            "Crypto (primarily USDT) is used informally for cross-border and as store-of-value amid kyat volatility.",
            "Future digital growth depends heavily on political stabilization; risks remain high for PSPs serving Myanmar.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "South Africa": {
        "overview": {
            "Population (2024)":                 "61M",
            "GDP nominal (2024)":                "$380B",
            "Ecommerce market (2026e)":          "$12B (CAGR 10%)",
            "Online users (2024)":               "44M",
            "Internet penetration (2024)":       "72%",
            "Smartphone penetration (2024)":     "68%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "PayShap / RTC (BankservAfrica)",
            "apms":    [
                {"name": "PayShap",  "type": "A2A (instant)"},
                {"name": "SnapScan", "type": "Wallet / QR"},
                {"name": "Zapper",   "type": "Wallet / QR"},
                {"name": "Ozow",     "type": "A2A / EFT"},
                {"name": "1Voucher", "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 28, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 15.0, "type": "international"},
                    {"name": "Mastercard", "share": 11.0, "type": "international"},
                    {"name": "Amex",       "share":  2.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 30, "growth": "+3% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 16.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.0, "type": "international"},
                    {"name": "Maestro",          "share":  2.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "PayShap, EFT", "share": 14, "growth": "+35% YoY"},
            {"name": "Cash", "share": 12, "growth": "-8% YoY"},
            {"name": "Wallets", "detail": "SnapScan, Zapper, Ozow", "share": 11, "growth": "+22% YoY"},
            {"name": "BNPL", "detail": "PayJustNow, Mobicred, Payflex", "share": 5, "growth": "+35% YoY"},
        ],
        "regulation": [
            "SARB (South African Reserve Bank) runs the NPSD. FSCA supervises market conduct.",
            "PayShap (BankservAfrica) is SARB's instant-payment rail launched 2023.",
            "POPIA applies since 2021 — GDPR-aligned.",
            "VAT at 15%; foreign digital service providers must register under VAT Act since 2014.",
            "National Payment System Act amendments in draft.",
            "Crypto regulated under FAIS; FSCA licensed VASPs since 2023.",
        ],
        "digital_trends": [
            "South Africa has the most developed African payment market — cards dominate urban retail and ecommerce.",
            "PayShap adoption accelerating post-launch; expected to follow PIX trajectory.",
            "Ozow and Yoco lead SMB acceptance; Stitch is a rising Open Banking PSP.",
            "BNPL grew >40% in 2024 — primarily apparel and electronics.",
            "Cross-border remittances to SADC markets significant; stablecoin rails growing.",
            "Digital banks (Discovery Bank, TymeBank, Bank Zero) have 8M+ combined customers.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Nigeria": {
        "overview": {
            "Population (2024)":                 "225M",
            "GDP nominal (2024)":                "$400B",
            "Ecommerce market (2026e)":          "$14B (CAGR 18%)",
            "Online users (2024)":               "122M",
            "Internet penetration (2024)":       "55%",
            "Smartphone penetration (2024)":     "50%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "Verve",
            "a2a":     "NIBSS Instant Payment (NIP)",
            "apms":    [
                {"name": "OPay",        "type": "Wallet"},
                {"name": "Moniepoint",  "type": "Agent banking / wallet"},
                {"name": "Kuda",        "type": "Digital bank"},
                {"name": "Paga",        "type": "Wallet"},
                {"name": "Paystack",    "type": "PSP"},
                {"name": "Flutterwave", "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 6, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 3.0, "type": "international"},
                    {"name": "Mastercard", "share": 2.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 28, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Verve",            "share": 14.0, "type": "local"},
                    {"name": "Visa Debit",       "share":  8.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  6.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "NIBSS NIP, Transfer", "share": 28, "growth": "+32% YoY"},
            {"name": "Wallets", "detail": "OPay, Moniepoint, Paga", "share": 22, "growth": "+35% YoY"},
            {"name": "Cash", "share": 12, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+40% YoY"},
        ],
        "regulation": [
            "CBN regulates banks and PSPs. NIBSS operates the NIP rail.",
            "PSPs need SVB, MMO, or PSB licenses.",
            "NIP is one of the world's largest instant-payment rails.",
            "NDPR aligns with GDPR principles; NDPC enforces.",
            "Verve (Interswitch) is the domestic card scheme; Discover partnership enables some international acceptance.",
            "Crypto regulation tightened then partially reopened 2023 with VASP licensing.",
        ],
        "digital_trends": [
            "Nigeria has one of the most vibrant fintech ecosystems — OPay, Moniepoint, Kuda, Paystack all leading.",
            "NIP instant transfers dominate ecommerce checkouts.",
            "Cash scarcity (2023 naira redesign) accelerated digital adoption.",
            "Cross-border remittances ~$20B+/year; stablecoin rails competing with MTOs.",
            "POS agent banking (Moniepoint, OPay) reaches millions of unbanked consumers.",
            "Flutterwave and Paystack are pan-African PSP leaders.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Kenya": {
        "overview": {
            "Population (2024)":                 "55M",
            "GDP nominal (2024)":                "$115B",
            "Ecommerce market (2026e)":          "$3.5B (CAGR 15%)",
            "Online users (2024)":               "23M",
            "Internet penetration (2024)":       "42%",
            "Smartphone penetration (2024)":     "45%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "PesaLink",
            "apms":    [
                {"name": "M-PESA",       "type": "Mobile money (dominant)"},
                {"name": "Airtel Money", "type": "Mobile money"},
                {"name": "Pesapal",      "type": "PSP"},
                {"name": "T-Kash",       "type": "Wallet (Telkom)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "M-PESA (dominant), Airtel Money", "share": 62, "growth": "+14% YoY"},
            {"name": "Cash", "share": 12, "growth": "-10% YoY"},
            {"name": "Debit Cards", "share": 12, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 7.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.5, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "PesaLink, EFT", "share": 6, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.2, "type": "international"},
                    {"name": "Mastercard", "share": 1.5, "type": "international"},
                    {"name": "Amex",       "share": 0.3, "type": "international"},
                ]},
            {"name": "BNPL", "share": 4, "growth": "+35% YoY"},
        ],
        "regulation": [
            "CBK regulates banks and PSPs. CA oversees telecom-linked payment services.",
            "M-PESA (Safaricom) — 35M+ users, processes ~50% of Kenyan GDP annually.",
            "National Payment System Act and Regulations 2014 govern PSP and PSO licensing.",
            "Data Protection Act (2019) aligns with GDPR.",
            "Digital Service Tax (1.5%) applies to foreign digital providers.",
            "Crypto not legal tender; VASP framework under development.",
        ],
        "digital_trends": [
            "M-PESA is culturally default — taxi fares, bills, ecommerce checkouts.",
            "Stanbic-M-PESA and KCB-M-PESA bundle savings/loans with the wallet.",
            "Cross-border M-PESA corridors drive regional payments.",
            "Chipper Cash and Flutterwave have strong Kenya presence.",
            "BNPL (Lipa Later, M-KOPA Pay) growing for durables.",
            "Hustler Fund and eCitizen drive government digital flows.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Egypt": {
        "overview": {
            "Population (2024)":                 "110M",
            "GDP nominal (2024)":                "$360B",
            "Ecommerce market (2026e)":          "$10B (CAGR 18%)",
            "Online users (2024)":               "82M",
            "Internet penetration (2024)":       "75%",
            "Smartphone penetration (2024)":     "72%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "Meeza",
            "a2a":     "InstaPay (CBE)",
            "apms":    [
                {"name": "Fawry",         "type": "Cash voucher / wallet"},
                {"name": "Paymob",        "type": "PSP"},
                {"name": "Vodafone Cash", "type": "Mobile money"},
                {"name": "InstaPay",      "type": "A2A"},
                {"name": "Meeza Digital", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "detail": "Fawry, COD", "share": 25, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 22, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Meeza",            "share": 10.0, "type": "local"},
                    {"name": "Visa Debit",       "share":  7.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  5.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Vodafone Cash, Paymob Shop", "share": 18, "growth": "+30% YoY"},
            {"name": "A2A", "detail": "InstaPay, IPN", "share": 15, "growth": "+32% YoY"},
            {"name": "Credit Cards", "share": 10, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 5.0, "type": "international"},
                    {"name": "Mastercard", "share": 4.0, "type": "international"},
                    {"name": "Amex",       "share": 1.0, "type": "international"},
                ]},
            {"name": "BNPL", "detail": "Sympl, Contact Pay Later", "share": 10, "growth": "+40% YoY"},
        ],
        "regulation": [
            "CBE regulates banks and PSPs. FRA oversees non-bank financial services.",
            "Meeza is the Egyptian domestic debit scheme operated by EBC.",
            "InstaPay (launched 2022) is the instant rail; interoperable across banks and wallets.",
            "VAT at 14%; digital services tax via simplified regime.",
            "Data Protection Law 151/2020 aligns broadly with GDPR.",
            "Crypto banned as a payment instrument per CBE directive.",
        ],
        "digital_trends": [
            "Fawry is one of MENA's largest payment networks — 50M+ users.",
            "InstaPay adoption accelerating; CBE pushing banks to integrate.",
            "Paymob (Egyptian unicorn) dominates SMB acceptance.",
            "BNPL (Sympl, valU, Aman, Contact Pay Later) is among MENA's fastest-growing.",
            "Cross-border ecommerce from Turkey, China, UAE is significant.",
            "Egypt is the largest Arabic-speaking ecommerce market.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Morocco": {
        "overview": {
            "Population (2024)":                 "37M",
            "GDP nominal (2024)":                "$155B",
            "Ecommerce market (2026e)":          "$4B (CAGR 16%)",
            "Online users (2024)":               "30M",
            "Internet penetration (2024)":       "81%",
            "Smartphone penetration (2024)":     "75%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "CMI transfer",
            "apms":    [
                {"name": "CMI",              "type": "Acquirer"},
                {"name": "Maroc Telecommerce","type": "Gateway"},
                {"name": "AmanePay",         "type": "Wallet"},
                {"name": "Cash Plus",        "type": "Cash voucher"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 28, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 22, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 13.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  8.0, "type": "international"},
                    {"name": "Maestro",          "share":  1.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "AmanePay, Barid Pay", "share": 18, "growth": "+28% YoY"},
            {"name": "A2A", "share": 14, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 5.0, "type": "international"},
                    {"name": "Mastercard", "share": 4.0, "type": "international"},
                    {"name": "Amex",       "share": 1.0, "type": "international"},
                ]},
            {"name": "BNPL", "share": 8, "growth": "+35% YoY"},
        ],
        "regulation": [
            "Bank Al-Maghrib is the central bank and primary regulator.",
            "CMI (Centre Monétique Interbancaire) operates domestic card processing and acquiring.",
            "VAT (TVA) at 20%; digital service tax on foreign providers.",
            "Moroccan Data Protection Law 09-08 is GDPR-adjacent; CNDP enforces.",
            "Strict FX controls — cross-border USD settlement requires Bank Al-Maghrib authorization.",
            "Crypto banned for transactional use per 2017 communique.",
        ],
        "digital_trends": [
            "Morocco has the Maghreb's most developed banking sector; ecommerce growing ~16% CAGR.",
            "CMI dominates card acquiring; Naps and M2T compete.",
            "AmanePay and Barid Pay (Al Barid Bank) lead mobile wallets.",
            "Cross-border ecommerce from France and Spain significant (diaspora).",
            "Tourism drives EUR/USD card acceptance seasonally.",
            "Crypto adoption exists P2P despite ban; Bank Al-Maghrib working on CBDC framework.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Ghana": {
        "overview": {
            "Population (2024)":                 "34M",
            "GDP nominal (2024)":                "$75B",
            "Ecommerce market (2026e)":          "$1.5B (CAGR 18%)",
            "Online users (2024)":               "23M",
            "Internet penetration (2024)":       "68%",
            "Smartphone penetration (2024)":     "60%",
            "In-Store : Ecommerce ratio (2024)": "90 : 10",
        },
        "local_payments": {
            "scheme":  "gh-link",
            "a2a":     "GhIPSS Instant Pay (GIP)",
            "apms":    [
                {"name": "MTN MoMo",       "type": "Mobile money (dominant)"},
                {"name": "Vodafone Cash",  "type": "Mobile money"},
                {"name": "AirtelTigo Money","type": "Mobile money"},
                {"name": "Hubtel",         "type": "PSP"},
                {"name": "ExpressPay",     "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MTN MoMo, Vodafone Cash", "share": 42, "growth": "+25% YoY"},
            {"name": "Cash", "share": 18, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 14, "growth": "+5% YoY",
                "schemes": [
                    {"name": "gh-link",          "share": 5.0, "type": "local"},
                    {"name": "Visa Debit",       "share": 5.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                ]},
            {"name": "A2A", "detail": "GIP, GhIPSS", "share": 12, "growth": "+30% YoY"},
            {"name": "BNPL", "share": 8, "growth": "+40% YoY"},
            {"name": "Credit Cards", "share": 6, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 3.0, "type": "international"},
                    {"name": "Mastercard", "share": 2.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BOG regulates banks and PSPs. NCA oversees telecom aspects of mobile money.",
            "GhIPSS runs the national switch and gh-link domestic debit scheme.",
            "Mobile Money Interoperability (2018) made MTN MoMo, Vodafone Cash and AirtelTigo Money cross-platform.",
            "VAT at 15%; digital transactions subject to E-Levy (1.5%) for some.",
            "Data Protection Act 843 aligns with GDPR principles.",
            "Crypto regulated via Bank of Ghana VASP guidelines (2024).",
        ],
        "digital_trends": [
            "MTN MoMo has ~20M users — wallet is everyday default at retailers, utilities, schools.",
            "GhIPSS Instant Pay + mobile-money interop make Ghana among most digitized SSA economies.",
            "E-Levy (1.5% tax) slowed wallet growth temporarily 2022-23.",
            "Hubtel and ExpressPay are leading domestic PSPs.",
            "Cross-border with Nigeria (ECOWAS corridor) is substantial.",
            "Startup ecosystem (Fido, Bezo Money, Oze) is strong on SME fintech.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Ethiopia": {
        "overview": {
            "Population (2024)":                 "125M",
            "GDP nominal (2024)":                "$160B",
            "Ecommerce market (2026e)":          "$0.6B (CAGR 20%)",
            "Online users (2024)":               "32M",
            "Internet penetration (2024)":       "26%",
            "Smartphone penetration (2024)":     "22%",
            "In-Store : Ecommerce ratio (2024)": "96 : 4",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "EthSwitch",
            "apms":    [
                {"name": "telebirr",       "type": "Mobile money (Ethio Telecom)"},
                {"name": "M-Pesa Ethiopia","type": "Mobile money"},
                {"name": "CBE Birr",       "type": "Bank wallet"},
                {"name": "HelloCash",      "type": "Wallet"},
                {"name": "Amole",          "type": "Wallet (Dashen)"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 42, "growth": "-5% YoY"},
            {"name": "Wallets", "detail": "telebirr (dominant), M-Pesa", "share": 28, "growth": "+45% YoY"},
            {"name": "A2A", "detail": "EthSwitch", "share": 10, "growth": "+25% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+8% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.5, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "Credit Cards", "share": 4, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.0, "type": "international"},
                    {"name": "Mastercard", "share": 1.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "Other / BNPL", "share": 6, "growth": "+30% YoY"},
        ],
        "regulation": [
            "NBE regulates banks and PSPs. ECA oversees communications.",
            "telebirr (Ethio Telecom) launched 2021 — 45M+ users; government-backed.",
            "Banking sector liberalization (2024) opened door to foreign banks; Safaricom M-PESA launched 2023.",
            "VAT at 15%; digital service tax on foreign providers.",
            "Data protection framework in draft.",
            "Crypto not legal tender; informal P2P exists.",
        ],
        "digital_trends": [
            "One of the fastest-growing fintech markets — telebirr launched with aggressive government backing.",
            "Safaricom M-PESA entry 2023 is reshaping competition.",
            "Banking penetration remains low (~35%); wallets drive digitization.",
            "Cross-border with Djibouti, Kenya, Gulf remittance corridors via fintechs.",
            "FX shortages complicate international card acceptance.",
            "Ecommerce is nascent but growing; Zmall and Qefira lead local marketplaces.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Tanzania": {
        "overview": {
            "Population (2024)":                 "65M",
            "GDP nominal (2024)":                "$80B",
            "Ecommerce market (2026e)":          "$1.2B (CAGR 17%)",
            "Online users (2024)":               "25M",
            "Internet penetration (2024)":       "38%",
            "Smartphone penetration (2024)":     "35%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "TIPS (Tanzania Instant Payment System)",
            "apms":    [
                {"name": "M-Pesa",       "type": "Mobile money (Vodacom)"},
                {"name": "Tigo Pesa",    "type": "Mobile money"},
                {"name": "Airtel Money", "type": "Mobile money"},
                {"name": "NMB Mkononi",  "type": "Bank wallet"},
                {"name": "Halopesa",     "type": "Mobile money"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "M-Pesa, Tigo Pesa, Airtel Money", "share": 50, "growth": "+18% YoY"},
            {"name": "Cash", "share": 20, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "TIPS", "share": 10, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "BNPL", "share": 5, "growth": "+35% YoY"},
        ],
        "regulation": [
            "BoT regulates banks and PSPs. TCRA oversees telecom.",
            "TIPS launched 2023 to drive mobile-money and banking interop.",
            "Mobile money interoperability mandated since 2014 — Tanzania was a pioneer.",
            "VAT at 18%; digital service tax 2% on foreign providers.",
            "Personal Data Protection Act (2022) aligns with GDPR.",
            "Crypto not legal tender; no formal VASP regime yet.",
        ],
        "digital_trends": [
            "One of Africa's most competitive mobile-money markets — 4 major MNOs offer comparable wallets.",
            "M-Pesa Tanzania is volume leader; Tigo Pesa has strong SMB traction.",
            "Selcom is the largest domestic PSP; Pesapal, DPO expand regionally.",
            "Cross-border with Kenya, Uganda, Rwanda via EAC corridors.",
            "Tourism drives USD/EUR card acceptance at hotels.",
            "Ecommerce is early-stage but growing; Jumia and Kilimall lead.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Uganda": {
        "overview": {
            "Population (2024)":                 "48M",
            "GDP nominal (2024)":                "$50B",
            "Ecommerce market (2026e)":          "$0.7B (CAGR 17%)",
            "Online users (2024)":               "14M",
            "Internet penetration (2024)":       "29%",
            "Smartphone penetration (2024)":     "26%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "EFT Uganda (Integrated Payment Gateway)",
            "apms":    [
                {"name": "MTN MoMo",     "type": "Mobile money (dominant)"},
                {"name": "Airtel Money", "type": "Mobile money"},
                {"name": "Pesapal",      "type": "PSP"},
                {"name": "Chipper Cash", "type": "Wallet"},
                {"name": "Flutterwave",  "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MTN MoMo, Airtel Money", "share": 52, "growth": "+20% YoY"},
            {"name": "Cash", "share": 18, "growth": "-8% YoY"},
            {"name": "A2A", "share": 10, "growth": "+25% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "BNPL", "share": 5, "growth": "+35% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BoU regulates banks and PSPs. UCC oversees telecom.",
            "MTN MoMo has ~15M users — largest mobile-money operator.",
            "Interoperability pilots between MNO wallets are maturing.",
            "VAT at 18%; digital service tax enforced since 2023.",
            "Data Protection and Privacy Act (2019) aligns with GDPR.",
            "Crypto unregulated; BoU has warned but no ban.",
        ],
        "digital_trends": [
            "Uganda's mobile-money penetration is among Africa's highest.",
            "Pesapal has strong presence; Chipper Cash and Flutterwave handle cross-border.",
            "Cross-border with Kenya, Tanzania, Rwanda, DRC via EAC corridors.",
            "Agent banking networks reach rural areas.",
            "BNPL (SafeBoda Pay, Rocket Health) growing in specific verticals.",
            "Ecommerce is small but growing; Jumia Uganda and Kikuu lead.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Algeria": {
        "overview": {
            "Population (2024)":                 "46M",
            "GDP nominal (2024)":                "$200B",
            "Ecommerce market (2026e)":          "$1.5B (CAGR 14%)",
            "Online users (2024)":               "35M",
            "Internet penetration (2024)":       "76%",
            "Smartphone penetration (2024)":     "70%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "CIB",
            "a2a":     "SATIM / RTGS",
            "apms":    [
                {"name": "Baridi Mob", "type": "Wallet (Algerie Poste)"},
                {"name": "CIB",        "type": "Local debit scheme"},
                {"name": "Edahabia",   "type": "Post prepaid card"},
                {"name": "BaridiPay",  "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 50, "growth": "-6% YoY"},
            {"name": "Debit Cards", "share": 18, "growth": "+6% YoY",
                "schemes": [
                    {"name": "CIB",              "share": 9.0, "type": "local"},
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 3.5, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "Baridi Mob, BaridiPay", "share": 12, "growth": "+30% YoY"},
            {"name": "A2A", "detail": "SATIM", "share": 10, "growth": "+20% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "Other / BNPL", "share": 5, "growth": "+25% YoY"},
        ],
        "regulation": [
            "Bank of Algeria regulates banks and payment services. ARPCE oversees communications.",
            "CIB (Carte Interbancaire) is the domestic debit scheme run by SATIM.",
            "Edahabia (Algerie Poste prepaid card) has 10M+ users — government-backed.",
            "VAT (TVA) at 19%; foreign digital service providers taxable.",
            "Strict FX controls; cross-border USD settlement requires Bank of Algeria approval.",
            "Crypto is prohibited by law.",
        ],
        "digital_trends": [
            "Algeria is one of the most cash-heavy MENA markets (~50%).",
            "Edahabia and CIB are the main cards for ecommerce.",
            "FX controls complicate international merchants; local acquiring essential.",
            "Baridi Mob (Algerie Poste) leads mobile payment.",
            "Cross-border ecommerce limited by FX and courier constraints.",
            "Crypto ban limits stablecoin workarounds; USD cash remains the informal hedge.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Tunisia": {
        "overview": {
            "Population (2024)":                 "12M",
            "GDP nominal (2024)":                "$52B",
            "Ecommerce market (2026e)":          "$1B (CAGR 15%)",
            "Online users (2024)":               "9M",
            "Internet penetration (2024)":       "75%",
            "Smartphone penetration (2024)":     "68%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SGMT (interbank)",
            "apms":    [
                {"name": "Flouci",      "type": "Wallet / PSP"},
                {"name": "Konnect",     "type": "PSP"},
                {"name": "Click to Pay","type": "PSP"},
                {"name": "D17",         "type": "Mobile money (La Poste)"},
                {"name": "DigiPay",     "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Cash", "share": 38, "growth": "-6% YoY"},
            {"name": "Debit Cards", "share": 22, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 12.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  9.0, "type": "international"},
                    {"name": "Maestro",          "share":  1.0, "type": "international"},
                ]},
            {"name": "Wallets", "detail": "D17, Flouci", "share": 15, "growth": "+28% YoY"},
            {"name": "A2A", "detail": "SGMT, transfer", "share": 10, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 8, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 4.0, "type": "international"},
                    {"name": "Mastercard", "share": 3.0, "type": "international"},
                    {"name": "Amex",       "share": 1.0, "type": "international"},
                ]},
            {"name": "BNPL", "share": 7, "growth": "+35% YoY"},
        ],
        "regulation": [
            "BCT regulates banks and PSPs. INTT oversees telecom.",
            "Tunisie Monétique runs domestic card processing; no exclusive local card scheme.",
            "VAT (TVA) at 19%; digital services tax for foreign providers.",
            "Data protection under Law 2004-63; INPDP enforces.",
            "FX restrictions complicate cross-border USD settlement.",
            "Crypto is banned as payment under 2018 central bank directive.",
        ],
        "digital_trends": [
            "Tunisia's fintech scene (Flouci, Konnect, DigiPay) is growing despite FX constraints.",
            "D17 (La Poste) is the largest mobile money operator with rural reach.",
            "Cross-border with France is meaningful — diaspora drives remittance and ecommerce.",
            "Ecommerce is small but growing; Jumia Tunisia and Mytek lead.",
            "Tourism drives seasonal EUR/USD card acceptance.",
            "Political and macro volatility remains a headwind.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Senegal": {
        "overview": {
            "Population (2024)":                 "18M",
            "GDP nominal (2024)":                "$30B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 20%)",
            "Online users (2024)":               "10M",
            "Internet penetration (2024)":       "57%",
            "Smartphone penetration (2024)":     "52%",
            "In-Store : Ecommerce ratio (2024)": "93 : 7",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "GIM-UEMOA",
            "apms":    [
                {"name": "Wave",         "type": "Wallet (dominant)"},
                {"name": "Orange Money", "type": "Mobile money"},
                {"name": "Free Money",   "type": "Mobile money"},
                {"name": "InTouch",      "type": "PSP"},
                {"name": "PayDunya",     "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "Wave, Orange Money", "share": 55, "growth": "+25% YoY"},
            {"name": "Cash", "share": 20, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "GIM-UEMOA", "share": 6, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+30% YoY"},
            {"name": "Credit Cards", "share": 4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.0, "type": "international"},
                    {"name": "Mastercard", "share": 1.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BCEAO is the monetary authority for 8 UEMOA countries; Senegal uses West African CFA franc (XOF) pegged to EUR.",
            "Wave Mobile Money disrupted the market with a 1% flat fee vs traditional MNO rates.",
            "GIM-UEMOA is the regional interbank switch.",
            "VAT at 18%; CDP enforces data protection aligned with GDPR.",
            "Crypto permitted informally; no specific framework yet.",
            "Strong fintech inclusion agenda via Startup Senegal.",
        ],
        "digital_trends": [
            "Wave revolutionized West African mobile money — low fees drove massive user growth.",
            "Senegal is UEMOA's leading fintech market.",
            "Cross-border within UEMOA (Côte d'Ivoire, Mali, Burkina Faso) via GIM-UEMOA.",
            "Diaspora remittances from France, US, Spain significant.",
            "Cash still ~20% but digital adoption is among the fastest in West Africa.",
            "Orange Money remains meaningful alongside Wave.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Côte d'Ivoire": {
        "overview": {
            "Population (2024)":                 "29M",
            "GDP nominal (2024)":                "$80B",
            "Ecommerce market (2026e)":          "$1B (CAGR 17%)",
            "Online users (2024)":               "15M",
            "Internet penetration (2024)":       "52%",
            "Smartphone penetration (2024)":     "48%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "GIM-UEMOA",
            "apms":    [
                {"name": "Orange Money","type": "Mobile money (dominant)"},
                {"name": "MTN MoMo",    "type": "Mobile money"},
                {"name": "Moov Money",  "type": "Mobile money"},
                {"name": "Wave",        "type": "Wallet"},
                {"name": "PayDunya",    "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "Orange Money, MTN MoMo, Wave", "share": 52, "growth": "+22% YoY"},
            {"name": "Cash", "share": 20, "growth": "-7% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "GIM-UEMOA", "share": 8, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 6, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.0, "type": "international"},
                    {"name": "Mastercard", "share": 1.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BCEAO regulates banking across UEMOA; Côte d'Ivoire is the largest UEMOA economy.",
            "Uses CFA franc (XOF) pegged to EUR.",
            "Orange Money has ~15M users domestically.",
            "VAT at 18%; ARTCI regulates telecom and digital service rules.",
            "Data protection under Law 2013-450; ARTCI enforces.",
            "Crypto unregulated; informal adoption exists.",
        ],
        "digital_trends": [
            "Francophone Africa's leading fintech hub — Abidjan concentrates most activity.",
            "Orange Money and MTN MoMo dominate mobile money; Wave is the disruptor.",
            "Cross-border within UEMOA is seamless via GIM-UEMOA.",
            "Diaspora remittances from France and West Africa meaningful.",
            "Cocoa and agriculture exports drive B2B USD/EUR flows.",
            "Expect 2025 fintech law to formalize PSP licensing.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Cameroon": {
        "overview": {
            "Population (2024)":                 "28M",
            "GDP nominal (2024)":                "$47B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 16%)",
            "Online users (2024)":               "12M",
            "Internet penetration (2024)":       "43%",
            "Smartphone penetration (2024)":     "40%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "GIMAC",
            "apms":    [
                {"name": "Orange Money","type": "Mobile money"},
                {"name": "MTN MoMo",    "type": "Mobile money"},
                {"name": "YUP",         "type": "Wallet (Société Générale)"},
                {"name": "PayDunya",    "type": "PSP"},
                {"name": "CinetPay",    "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MTN MoMo, Orange Money", "share": 45, "growth": "+22% YoY"},
            {"name": "Cash", "share": 25, "growth": "-6% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "GIMAC", "share": 10, "growth": "+20% YoY"},
            {"name": "BNPL / Other", "share": 5, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BEAC is the monetary authority for 6 CEMAC countries.",
            "COBAC supervises banking across CEMAC.",
            "Uses Central African CFA franc (XAF) pegged to EUR.",
            "Cameroon is CEMAC's largest economy and financial center.",
            "VAT at 19.25%; foreign digital service providers subject to tax.",
            "Crypto is not regulated formally; informal P2P exists.",
        ],
        "digital_trends": [
            "Bilingual market (French + English) complicates payment UX.",
            "MTN MoMo and Orange Money dominate mobile money (~10M+ users combined).",
            "Cross-border within CEMAC via GIMAC.",
            "PayDunya, CinetPay handle domestic ecommerce.",
            "Remittances from France, US meaningful.",
            "Oil and commodities drive B2B flows; agriculture drives informal sector.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Angola": {
        "overview": {
            "Population (2024)":                 "36M",
            "GDP nominal (2024)":                "$85B",
            "Ecommerce market (2026e)":          "$1B (CAGR 15%)",
            "Online users (2024)":               "14M",
            "Internet penetration (2024)":       "38%",
            "Smartphone penetration (2024)":     "35%",
            "In-Store : Ecommerce ratio (2024)": "92 : 8",
        },
        "local_payments": {
            "scheme":  "Multicaixa",
            "a2a":     "SPTR / Multicaixa Express",
            "apms":    [
                {"name": "Multicaixa Express","type": "Wallet / A2A"},
                {"name": "BAI Direto",        "type": "Bank app"},
                {"name": "Unitel Money",      "type": "Mobile money"},
                {"name": "EMIS",              "type": "Acquirer"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "share": 42, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Multicaixa",       "share": 28.0, "type": "local"},
                    {"name": "Visa Debit",       "share":  8.0, "type": "international"},
                    {"name": "Mastercard Debit", "share":  6.0, "type": "international"},
                ]},
            {"name": "Cash", "share": 28, "growth": "-6% YoY"},
            {"name": "Wallets", "detail": "Multicaixa Express, Unitel Money", "share": 12, "growth": "+25% YoY"},
            {"name": "A2A", "detail": "SPTR, Multicaixa Express", "share": 10, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "BNPL / Other", "share": 3, "growth": "+22% YoY"},
        ],
        "regulation": [
            "BNA is the central bank and regulator.",
            "EMIS runs Multicaixa — Angola's domestic debit scheme; nearly universal on Angolan-issued cards.",
            "FX shortage 2014-2023; situation improving post-oil recovery.",
            "VAT at 14%; digital service tax enforcement inconsistent.",
            "Portuguese is the official language; payment UX typically Portuguese.",
            "Crypto unregulated; informal trading present.",
        ],
        "digital_trends": [
            "Multicaixa cards are ubiquitous; Angola has high debit-card penetration for SSA.",
            "Multicaixa Express is the leading mobile wallet — QR and P2P at most retailers.",
            "Oil sector drives USD B2B flows; consumer FX access remains constrained.",
            "Cross-border ecommerce from Portugal is common (language, ex-colony ties).",
            "Banking penetration growing; BAI, Millennium Atlantico, BIC are the largest banks.",
            "Remittances from Portugal meaningful; fintech corridors emerging.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Mozambique": {
        "overview": {
            "Population (2024)":                 "33M",
            "GDP nominal (2024)":                "$20B",
            "Ecommerce market (2026e)":          "$0.4B (CAGR 16%)",
            "Online users (2024)":               "7M",
            "Internet penetration (2024)":       "22%",
            "Smartphone penetration (2024)":     "20%",
            "In-Store : Ecommerce ratio (2024)": "96 : 4",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "SIMO (Sociedade Interbancária de Moçambique)",
            "apms":    [
                {"name": "M-Pesa",  "type": "Mobile money (Vodacom)"},
                {"name": "e-Mola",  "type": "Mobile money (Movitel)"},
                {"name": "Mkesh",   "type": "Mobile money (mCel)"},
                {"name": "MozaPag", "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "M-Pesa, e-Mola, Mkesh", "share": 45, "growth": "+25% YoY"},
            {"name": "Cash", "share": 28, "growth": "-7% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "SIMO", "share": 8, "growth": "+22% YoY"},
            {"name": "BNPL / Other", "share": 6, "growth": "+25% YoY"},
            {"name": "Credit Cards", "share": 3, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 1.5, "type": "international"},
                    {"name": "Mastercard", "share": 1.2, "type": "international"},
                    {"name": "Amex",       "share": 0.3, "type": "international"},
                ]},
        ],
        "regulation": [
            "BM regulates banks and PSPs. INCM oversees telecom.",
            "SIMO runs the interbank switch and integrates mobile money interop.",
            "VAT (IVA) at 17%; digital service tax framework emerging.",
            "Portuguese is the official language.",
            "Data protection via Law 3/2017 — not yet GDPR-aligned in enforcement.",
            "Crypto unregulated.",
        ],
        "digital_trends": [
            "M-Pesa Mozambique is the leading mobile money operator.",
            "e-Mola and Mkesh have smaller but growing share.",
            "Cash remains dominant (~28%) due to low banking penetration (~25%).",
            "Cross-border with South Africa via SADC payment corridors.",
            "Extractive industries (coal, gas) drive B2B USD flows.",
            "Remittances from South Africa and Portugal are significant.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Zimbabwe": {
        "overview": {
            "Population (2024)":                 "16M",
            "GDP nominal (2024)":                "$30B",
            "Ecommerce market (2026e)":          "$0.4B (CAGR 12%)",
            "Online users (2024)":               "9M",
            "Internet penetration (2024)":       "57%",
            "Smartphone penetration (2024)":     "53%",
            "In-Store : Ecommerce ratio (2024)": "93 : 7",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "ZimSwitch ZIPIT",
            "apms":    [
                {"name": "EcoCash",  "type": "Mobile money (Econet)"},
                {"name": "OneMoney", "type": "Mobile money (NetOne)"},
                {"name": "Paynow",   "type": "PSP"},
                {"name": "InnBucks", "type": "Wallet"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "EcoCash, OneMoney", "share": 40, "growth": "+15% YoY"},
            {"name": "Cash", "detail": "USD-dominant", "share": 28, "growth": "-5% YoY"},
            {"name": "Debit Cards", "share": 12, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 6.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "ZIPIT", "share": 10, "growth": "+22% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
            {"name": "Other / BNPL", "share": 5, "growth": "+20% YoY"},
        ],
        "regulation": [
            "RBZ regulates banks and PSPs. POTRAZ oversees telecom.",
            "Multi-currency regime (USD, ZWL) — USD dominates high-value transactions.",
            "EcoCash (Econet Wireless) has ~80% of mobile money share.",
            "VAT at 15%; digital services tax on foreign providers.",
            "Data Protection Act (2021) aligns with GDPR principles.",
            "Crypto limitations; RBZ cautious but no outright ban.",
        ],
        "digital_trends": [
            "EcoCash dominates mobile money — culturally default for P2P, bills, merchant payment.",
            "USD cash resurgence post-hyperinflation; ZWL used for small transactions.",
            "Paynow handles most Zimbabwean ecommerce.",
            "Cross-border with South Africa and Mozambique via SADC corridors.",
            "Remittances from South Africa, UK, US are a large share of GDP.",
            "Stablecoin adoption informal; P2P via Binance common.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Botswana": {
        "overview": {
            "Population (2024)":                 "2.6M",
            "GDP nominal (2024)":                "$20B",
            "Ecommerce market (2026e)":          "$0.4B (CAGR 14%)",
            "Online users (2024)":               "1.9M",
            "Internet penetration (2024)":       "73%",
            "Smartphone penetration (2024)":     "68%",
            "In-Store : Ecommerce ratio (2024)": "88 : 12",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "Bank of Botswana RTGS",
            "apms":    [
                {"name": "Orange Money","type": "Mobile money"},
                {"name": "Myzaka",      "type": "Mobile money (Mascom)"},
                {"name": "FNB eWallet", "type": "Bank wallet"},
                {"name": "Smart Switch","type": "Gateway"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Debit Cards", "share": 32, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 17.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 13.0, "type": "international"},
                    {"name": "Maestro",          "share":  2.0, "type": "international"},
                ]},
            {"name": "Cash", "share": 22, "growth": "-8% YoY"},
            {"name": "Wallets", "detail": "Orange Money, Myzaka, FNB eWallet", "share": 18, "growth": "+25% YoY"},
            {"name": "Credit Cards", "share": 12, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 6.0, "type": "international"},
                    {"name": "Mastercard", "share": 5.0, "type": "international"},
                    {"name": "Amex",       "share": 1.0, "type": "international"},
                ]},
            {"name": "A2A", "share": 12, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+30% YoY"},
        ],
        "regulation": [
            "BoB regulates banks and PSPs. BOCRA oversees telecom and broadcasting.",
            "Botswana has one of SSA's highest banking penetration rates (~50% adults).",
            "VAT at 14%; digital service tax framework emerging.",
            "Data Protection Act (2018) aligns with GDPR principles.",
            "Stable macroeconomic environment supports card-heavy payment mix.",
            "Crypto is regulated via Virtual Asset Act (2022).",
        ],
        "digital_trends": [
            "One of SSA's most banked markets — cards dominate retail payments.",
            "Diamond and mineral exports drive B2B USD flows.",
            "Cross-border with South Africa via SADC corridors.",
            "Mobile money has lower share than SSA average due to card dominance.",
            "Stable Pula currency supports cross-border ecommerce.",
            "Small market size limits domestic fintech scaling.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Mauritius": {
        "overview": {
            "Population (2024)":                 "1.3M",
            "GDP nominal (2024)":                "$15B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 12%)",
            "Online users (2024)":               "1.15M",
            "Internet penetration (2024)":       "88%",
            "Smartphone penetration (2024)":     "82%",
            "In-Store : Ecommerce ratio (2024)": "82 : 18",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "MIPS (Mauritius Instant Payment System)",
            "apms":    [
                {"name": "MIPS",        "type": "A2A (instant)"},
                {"name": "my.t money",  "type": "Wallet (Mauritius Telecom)"},
                {"name": "Juice by MCB","type": "Bank wallet"},
                {"name": "MauPay",      "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Credit Cards", "share": 32, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 17.0, "type": "international"},
                    {"name": "Mastercard", "share": 12.0, "type": "international"},
                    {"name": "Amex",       "share":  3.0, "type": "international"},
                ]},
            {"name": "Debit Cards", "share": 30, "growth": "+4% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 16.0, "type": "international"},
                    {"name": "Mastercard Debit", "share": 12.5, "type": "international"},
                    {"name": "Maestro",          "share":  1.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "MIPS", "share": 14, "growth": "+30% YoY"},
            {"name": "Wallets", "detail": "my.t money, Juice", "share": 12, "growth": "+22% YoY"},
            {"name": "Cash", "share": 8, "growth": "-10% YoY"},
            {"name": "BNPL", "share": 4, "growth": "+30% YoY"},
        ],
        "regulation": [
            "BoM regulates banks and PSPs. FSC oversees non-bank financial services.",
            "Mauritius is a major financial services hub for Africa and Asia.",
            "MIPS launched 2022; adoption growing.",
            "VAT at 15%; digital service tax on foreign providers.",
            "Strong regulatory framework — GDPR-aligned via Data Protection Act 2017.",
            "Crypto regulated via Virtual Asset and Initial Token Offering Services Act (2021).",
        ],
        "digital_trends": [
            "Mauritius has the highest banking penetration in SSA (~90% of adults).",
            "Card usage is near-European levels — cards dominate ecommerce.",
            "Tourism drives heavy multi-currency card acceptance.",
            "Cross-border with South Africa, India, France, UK is common.",
            "Financial services (offshore banking, funds) drive B2B sophistication.",
            "MCB is the largest and most digital-forward bank.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Rwanda": {
        "overview": {
            "Population (2024)":                 "14M",
            "GDP nominal (2024)":                "$14B",
            "Ecommerce market (2026e)":          "$0.3B (CAGR 22%)",
            "Online users (2024)":               "4M",
            "Internet penetration (2024)":       "30%",
            "Smartphone penetration (2024)":     "28%",
            "In-Store : Ecommerce ratio (2024)": "94 : 6",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "RSwitch / Smart Cash",
            "apms":    [
                {"name": "MTN MoMo",     "type": "Mobile money (dominant)"},
                {"name": "Airtel Money", "type": "Mobile money"},
                {"name": "Tigo Cash",    "type": "Mobile money"},
                {"name": "Irembo Pay",   "type": "Government payments"},
                {"name": "Flutterwave",  "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MTN MoMo, Airtel Money", "share": 52, "growth": "+25% YoY"},
            {"name": "Cash", "share": 20, "growth": "-10% YoY"},
            {"name": "Debit Cards", "share": 10, "growth": "+6% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 5.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 4.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "share": 8, "growth": "+22% YoY"},
            {"name": "BNPL", "share": 5, "growth": "+35% YoY"},
            {"name": "Credit Cards", "share": 5, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.5, "type": "international"},
                    {"name": "Mastercard", "share": 2.0, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BNR regulates banks and PSPs. RURA oversees utilities and communications.",
            "Rwanda's cashless strategy targets 80% digital transactions by 2025.",
            "MTN MoMo has ~5M users; mobile money interop mandated since 2022.",
            "Irembo Pay integrates with wallets for government services.",
            "VAT at 18%; digital service tax on foreign providers.",
            "Data protection via Law 058/2021; similar to GDPR.",
        ],
        "digital_trends": [
            "Rwanda is Africa's fastest-digitizing economy — cashless initiatives are government-driven.",
            "MTN MoMo and Airtel Money dominate mobile money.",
            "Kigali International Financial Centre ambitions attracting fintechs.",
            "Cross-border with EAC partners via regional corridors.",
            "Irembo Pay is the government-services payment rail.",
            "Small market but high CAGR (~22%) makes Rwanda a fintech pilot destination.",
        ],
        "yuno_coverage": {
            "Merchants processing": "N/A",
            "Monthly volume":       "N/A",
            "Live partners":        [],
            "Payment methods":      [],
        },
    },
    "Zambia": {
        "overview": {
            "Population (2024)":                 "21M",
            "GDP nominal (2024)":                "$30B",
            "Ecommerce market (2026e)":          "$0.5B (CAGR 17%)",
            "Online users (2024)":               "5M",
            "Internet penetration (2024)":       "24%",
            "Smartphone penetration (2024)":     "22%",
            "In-Store : Ecommerce ratio (2024)": "93 : 7",
        },
        "local_payments": {
            "scheme":  "N/A",
            "a2a":     "ZIPSS (Zambia Instant Payment Switching Service)",
            "apms":    [
                {"name": "MTN MoMo",      "type": "Mobile money"},
                {"name": "Airtel Money",  "type": "Mobile money"},
                {"name": "Zamtel Kwacha", "type": "Mobile money"},
                {"name": "Tingg",         "type": "PSP"},
                {"name": "Pesapal",       "type": "PSP"},
            ],
        },
        "payment_methods_breakdown": [
            {"name": "Wallets", "detail": "MTN MoMo, Airtel Money, Zamtel Kwacha", "share": 48, "growth": "+22% YoY"},
            {"name": "Cash", "share": 20, "growth": "-8% YoY"},
            {"name": "Debit Cards", "share": 12, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa Debit",       "share": 6.5, "type": "international"},
                    {"name": "Mastercard Debit", "share": 5.0, "type": "international"},
                    {"name": "Maestro",          "share": 0.5, "type": "international"},
                ]},
            {"name": "A2A", "detail": "ZIPSS", "share": 10, "growth": "+25% YoY"},
            {"name": "BNPL / Other", "share": 6, "growth": "+28% YoY"},
            {"name": "Credit Cards", "share": 4, "growth": "+5% YoY",
                "schemes": [
                    {"name": "Visa",       "share": 2.0, "type": "international"},
                    {"name": "Mastercard", "share": 1.5, "type": "international"},
                    {"name": "Amex",       "share": 0.5, "type": "international"},
                ]},
        ],
        "regulation": [
            "BoZ regulates banks and PSPs. ZICTA oversees communications.",
            "ZIPSS is the domestic instant payment switch launched 2023.",
            "Mobile money interop mandated; users can transfer across MTN, Airtel, Zamtel.",
            "VAT at 16%; digital service tax framework emerging.",
            "Data protection via Data Protection Act (2021).",
            "Crypto not legal tender; BoZ cautions but no ban.",
        ],
        "digital_trends": [
            "Mobile money dominant digital payment — 70% of adults have a wallet.",
            "Copper exports drive USD B2B flows.",
            "Cross-border with DRC, Zimbabwe, Tanzania via SADC corridors.",
            "Tingg (pan-African PSP) serves Zambian merchants alongside Pesapal.",
            "Remittances from South Africa, UK meaningful.",
            "Ecommerce is small but growing; Kikuu, Shoprite Online lead.",
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
    "Russia":              [{"name":"Sberbank","type":"Acquirer"},{"name":"Tinkoff","type":"Acquirer"},{"name":"NSPK","type":"Scheme / processor"},{"name":"YooKassa","type":"Gateway"},{"name":"CloudPayments","type":"PSP"}],
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

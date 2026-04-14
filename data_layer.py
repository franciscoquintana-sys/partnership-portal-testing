import os, sys, time, json, threading, io
import pandas as pd
import requests

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_BASE, "data"))

_TYPE_COLOR = {
    "Acquirer": "#3b82f6", "PSP/Aggregator": "#8b5cf6", "APM": "#14b8a6",
    "Fraud Provider": "#ef4444", "BaaS": "#f59e0b", "Other": "#64748b", "Plug-In": "#06b6d4"
}
_TYPE_SHORT = {
    "Acquirer": "Acquirer", "PSP/Aggregator": "PSP", "APM": "APM",
    "Fraud Provider": "Fraud", "BaaS": "BaaS", "Other": "Other", "Plug-In": "Plug-In"
}
_TIER_MAP = {
    "Strategic Partners: Very Important": "Strategic Partner",
    "Tier 1 Partners": "Tier 1",
    "Tier 1 Partners ": "Tier 1",
    "Tier 2 Partners": "Tier 2",
    "Tier 3 Partners": "Tier 3",
    "Product Partners": "Product Partner",
    "Product Partners (3Ds, Plugins)": "Product Partner",
    "Product Partners (3Ds, Plugins))": "Product Partner",
    "Non Managed Partners": "Non-Managed",
    "Non-Managed Partners": "Non-Managed",
    "Non-managed Partners": "Non-Managed",
}

_STAGE_MAP = {
    "Live Partner": "Live", "Agreement Signed": "Agreement Signed",
    "Agreement Review": "Agreement Review", "Initial Negotiation": "Negotiation",
    "Opportunity Identification": "Prospect", "Lost": "Lost",
    "Only to be integrated": "Integration Only",
    "Agreement Signed - Only referrals": "Referral Only",
    "Non-qualified Partner": "Non-Qualified"
}

_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "12lOJ_1wrAbzKZB_EBF_meWygAE3Ieo20kKM6HtuqXaw"
    "/export?format=csv&gid=1597186279"
)
_CONTACTS_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1DHSU-1zHksVJaI059ChEBeGqZCOc7tAehHknL1a1mRI"
    "/export?format=csv&gid=695009227"
)
_TECH_CONTACTS_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1DHSU-1zHksVJaI059ChEBeGqZCOc7tAehHknL1a1mRI"
    "/export?format=csv&gid=1537055418"
)
_PARTNERS_SOT_SHEET_ID = "11kdtbqu9alq3B90CYw2Uk5oxi-MHYbYW2tceHY4r_Y4"
_PARTNERS_SOT_CACHE = {"data": None, "ts": 0}
# ── Google OAuth token management ─────────────────────────────────────────────
_GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
_GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
_GOOGLE_REFRESH_TOKEN = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
_ACCESS_TOKEN = {"token": None, "expires": 0}

def _get_access_token():
    now = time.time()
    if _ACCESS_TOKEN["token"] and now < _ACCESS_TOKEN["expires"]:
        return _ACCESS_TOKEN["token"]
    if not _GOOGLE_REFRESH_TOKEN:
        return None
    try:
        resp = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": _GOOGLE_CLIENT_ID,
            "client_secret": _GOOGLE_CLIENT_SECRET,
            "refresh_token": _GOOGLE_REFRESH_TOKEN,
            "grant_type": "refresh_token",
        })
        data = resp.json()
        _ACCESS_TOKEN["token"] = data.get("access_token")
        _ACCESS_TOKEN["expires"] = now + data.get("expires_in", 3500) - 60
        return _ACCESS_TOKEN["token"]
    except Exception:
        return None

def _parse_sheets_api_url(export_url):
    """Extract spreadsheet ID and gid from an export URL."""
    import re
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', export_url)
    sheet_id = m.group(1) if m else None
    m2 = re.search(r'gid=(\d+)', export_url)
    gid = m2.group(1) if m2 else "0"
    return sheet_id, gid

def _fetch_via_sheets_api(spreadsheet_id, gid, token):
    """Fetch sheet data via Google Sheets API, returns a DataFrame."""
    # First get sheet name from gid
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}?fields=sheets.properties"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(meta_url, headers=headers)
    resp.raise_for_status()
    sheets = resp.json().get("sheets", [])
    sheet_name = None
    for s in sheets:
        if str(s["properties"].get("sheetId")) == str(gid):
            sheet_name = s["properties"]["title"]
            break
    if not sheet_name:
        sheet_name = sheets[0]["properties"]["title"] if sheets else "Sheet1"

    # Fetch all values
    data_url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{requests.utils.quote(sheet_name)}"
    resp = requests.get(data_url, headers=headers)
    resp.raise_for_status()
    values = resp.json().get("values", [])
    if len(values) < 2:
        return pd.DataFrame()
    headers_row = values[0]
    data_rows = values[1:]
    # Pad rows to match header length
    for i, row in enumerate(data_rows):
        if len(row) < len(headers_row):
            data_rows[i] = row + [""] * (len(headers_row) - len(row))
        elif len(row) > len(headers_row):
            data_rows[i] = row[:len(headers_row)]
    return pd.DataFrame(data_rows, columns=headers_row)

def _fetch_csv(url, **kwargs):
    """Fetch sheet data via Sheets API if authenticated, fallback to public CSV."""
    token = _get_access_token()
    if token:
        try:
            sheet_id, gid = _parse_sheets_api_url(url)
            if sheet_id:
                skiprows = kwargs.pop("skiprows", 0)
                kwargs.pop("header", None)
                df = _fetch_via_sheets_api(sheet_id, gid, token)
                if skiprows and len(df) > 0:
                    # Re-parse: treat row at skiprows as header
                    values = [df.columns.tolist()] + df.values.tolist()
                    values = values[skiprows:]
                    if len(values) < 2:
                        return pd.DataFrame()
                    new_headers = [str(v) for v in values[0]]
                    data_rows = values[1:]
                    df = pd.DataFrame(data_rows, columns=new_headers)
                return df
        except Exception:
            pass
    return pd.read_csv(url, **kwargs)

# ── Caches ────────────────────────────────────────────────────────────────────
_PARTNERS_CACHE = {"data": None, "ts": 0}
_CONTACTS_CACHE = {"data": None, "ts": 0}
_TECH_CACHE = {"data": None, "ts": 0}
_CACHE_TTL = 3600  # refresh every 1 hour

def _fetch_sheet_df():
    try:
        df = _fetch_csv(_SHEET_CSV_URL)
        if len(df) > 0:
            return df
    except Exception:
        pass
    # fallback to local file if sheet unreachable
    try:
        path = os.path.join(_BASE, "data", "strategic_accounts.xlsx")
        return pd.read_excel(path, sheet_name="All partners")
    except Exception:
        return pd.DataFrame()

def _parse_partners_df(df):
    seen, partners = set(), []
    for _, row in df.iterrows():
        name = str(row.get("Provider", "")).strip()
        if not name or name in seen or name == "nan":
            continue
        seen.add(name)
        offering = str(row.get("Type", "Other")).strip()
        stage_raw = str(row.get("Deal Stage", "")).strip()
        integration_stage = str(row.get("Integration Stage", "")).strip()
        region = str(row.get("Region", "")).strip()
        country = str(row.get("Country", "")).strip()
        tier = str(row.get("Tier", "")).strip()
        manager = str(row.get("Partner Manager", "")).strip()
        strategic = bool(row.get("Strategic?", False))
        mgmt_type = str(row.get("Type of Management", "")).strip()
        initials = "".join(w[0] for w in name.replace("/", " ").replace("(", " ").split() if w)[:2].upper()
        partners.append({
            "name": name,
            "type": offering if offering and offering != "nan" else "Other",
            "offering_raw": offering,
            "region": region if region != "nan" else "",
            "country": country if country != "nan" else "",
            "status": {"Opportunity Identification": "Prospect"}.get(stage_raw, stage_raw) if stage_raw and stage_raw != "nan" else "",
            "stage_raw": stage_raw,
            "tier": _TIER_MAP.get(tier, tier) if tier and tier != "nan" else "",
            "manager": manager if manager != "nan" else "",
            "strategic": strategic,
            "mgmt_type": mgmt_type if mgmt_type != "nan" else "",
            "logo": initials,
            "color": _TYPE_COLOR.get(offering, "#64748b"),
            "cat": offering if offering and offering != "nan" else "Other",
            "nda": bool(row.get("NDA Signed and in drive", False)),
            "revshare": bool(row.get("Revshare Contract", False)),
            "revshare_active": bool(row.get("Revshare active", False)),
            "integration_stage": integration_stage if integration_stage and integration_stage != "nan" else "",
            "integration_ready": bool(row.get("Integration Ready by Yuno", False)),
            "integration_used": bool(row.get("Integration Used by Merchants", False)),
            "comments": str(row.get("Comments", "")).strip() if str(row.get("Comments", "")).strip() != "nan" else "",
        })
    return sorted(partners, key=lambda x: x["name"].lower())

def load_partners_excel():
    now = time.time()
    if _PARTNERS_CACHE["data"] is not None and now - _PARTNERS_CACHE["ts"] < _CACHE_TTL:
        return _PARTNERS_CACHE["data"]
    df = _fetch_sheet_df()
    result = _parse_partners_df(df) if len(df) > 0 else (_PARTNERS_CACHE["data"] or [])
    _PARTNERS_CACHE["data"] = result
    _PARTNERS_CACHE["ts"] = now
    return result

def load_technical_contact(provider_name: str) -> dict:
    """Return technical contact info from the Technical Contacts sheet."""
    now = time.time()
    if _TECH_CACHE["data"] is None or now - _TECH_CACHE["ts"] > _CACHE_TTL:
        try:
            df = _fetch_csv(_TECH_CONTACTS_CSV_URL, header=None, skiprows=5)
            df.columns = [
                "Rank", "Provider", "Provider2", "Total Transactions",
                "Approved Transactions", "Approval Rate", "Status",
                "Partnership Manager", "Technical Contact (Day to Day)",
                "Technical Contact P1", "SLA", "Escalation Path",
                "Slack Channel", "Status Page",
            ] + [f"extra_{i}" for i in range(max(0, len(df.columns) - 14))]
            _TECH_CACHE["data"] = df
        except Exception:
            _TECH_CACHE["data"] = pd.DataFrame()
        _TECH_CACHE["ts"] = now

    df = _TECH_CACHE["data"]
    na = {"contact": "N/A", "contact_p1": "N/A", "sla": "N/A",
          "escalation": "N/A", "slack": "N/A", "status_page": "N/A"}
    if df is None or len(df) == 0:
        return na

    pname = str(provider_name).strip().lower()
    mask = (df["Provider"].astype(str).str.strip().str.lower() == pname) | \
           (df["Provider2"].astype(str).str.strip().str.lower() == pname)
    matches = df[mask]
    if matches.empty:
        return na

    row = matches.iloc[0]
    def val(col):
        v = str(row.get(col, "")).strip()
        return v if v and v != "nan" else "N/A"

    return {
        "contact": val("Technical Contact (Day to Day)"),
        "contact_p1": val("Technical Contact P1"),
        "sla": val("SLA"),
        "escalation": val("Escalation Path"),
        "slack": val("Slack Channel"),
        "status_page": val("Status Page"),
    }

def _load_partners_sot():
    """Load the Partners SOT sheet (countries, payment methods, etc.)."""
    now = time.time()
    if _PARTNERS_SOT_CACHE["data"] is not None and now - _PARTNERS_SOT_CACHE["ts"] < _CACHE_TTL:
        return _PARTNERS_SOT_CACHE["data"]
    token = _get_access_token()
    if not token:
        return pd.DataFrame()
    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{_PARTNERS_SOT_SHEET_ID}/values/Partners"
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        values = resp.json().get("values", [])
        if len(values) < 2:
            return pd.DataFrame()
        hdr = values[0]
        rows = values[1:]
        for i, row in enumerate(rows):
            if len(row) < len(hdr):
                rows[i] = row + [""] * (len(hdr) - len(row))
            elif len(row) > len(hdr):
                rows[i] = row[:len(hdr)]
        df = pd.DataFrame(rows, columns=hdr)
        _PARTNERS_SOT_CACHE["data"] = df
        _PARTNERS_SOT_CACHE["ts"] = now
        return df
    except Exception:
        return _PARTNERS_SOT_CACHE["data"] or pd.DataFrame()

def load_partner_countries(provider_name: str) -> dict:
    """Return unique countries grouped by region for a provider from the Partners SOT sheet."""
    df = _load_partners_sot()
    if df is None or len(df) == 0:
        return {"countries": [], "regions": {}}
    pname = str(provider_name).strip().upper()
    mask = df["PROVIDER_NAME"].astype(str).str.strip().str.upper() == pname
    matches = df[mask]
    if matches.empty:
        return {"countries": [], "regions": {}}
    # Build region -> countries mapping
    region_map = {}
    all_countries = set()
    for _, row in matches.iterrows():
        country = str(row.get("COUNTRY", "")).strip()
        region = str(row.get("REGION", "")).strip()
        if country and country != "nan":
            all_countries.add(country)
            if region and region != "nan":
                if region not in region_map:
                    region_map[region] = set()
                region_map[region].add(country)
    # Sort everything
    regions = {r: sorted(cs) for r, cs in sorted(region_map.items())}
    return {"countries": sorted(all_countries), "regions": regions}

def load_sales_contacts(provider_name: str) -> list:
    """Return all Partnerships AM + email for a provider where Contact for AI is TRUE."""
    now = time.time()
    if _CONTACTS_CACHE["data"] is None or now - _CONTACTS_CACHE["ts"] > _CACHE_TTL:
        try:
            df = _fetch_csv(_CONTACTS_CSV_URL)
            _CONTACTS_CACHE["data"] = df
        except Exception:
            _CONTACTS_CACHE["data"] = pd.DataFrame()
        _CONTACTS_CACHE["ts"] = now

    df = _CONTACTS_CACHE["data"]
    if df is None or len(df) == 0:
        return []

    pname = str(provider_name).strip().lower()
    mask = (
        df["Parent Partner"].str.strip().str.lower() == pname
    ) & (
        df["Contact for AI"].astype(str).str.strip().str.upper() == "TRUE"
    )
    matches = df[mask]
    if matches.empty:
        return []

    contacts = []
    seen = set()
    for _, row in matches.iterrows():
        am_name = str(row.get("Partnerships AM", "")).strip()
        am_email = str(row.get("AM Email", "")).strip()
        am_role = str(row.get("AM Role", "")).strip()
        territory = str(row.get("Territory Scope", "")).strip()
        key = (am_name.lower(), am_email.lower())
        if key in seen:
            continue
        seen.add(key)
        contacts.append({
            "am_name": am_name if am_name and am_name != "nan" else "N/A",
            "am_email": am_email if am_email and am_email != "nan" else "N/A",
            "am_role": am_role if am_role and am_role != "nan" else "N/A",
            "territory": territory if territory and territory != "nan" else "N/A",
        })
    return contacts

_SOT_CACHE = {"data": None, "ts": 0}

def load_sot_data():
    now = time.time()
    if _SOT_CACHE["data"] is not None and now - _SOT_CACHE["ts"] < _CACHE_TTL:
        return _SOT_CACHE["data"]
    path = os.path.join(_BASE, "data", "source_of_truth.xlsx")
    try:
        df = pd.read_excel(path, sheet_name="Partners")
        df = df[df["PROVIDER_CATEGORY"].isin(
            ["ACQUIRER","GATEWAY","AGREGATOR","AGREGATOR / GATEWAY","PAYMENT_METHOD"]
        )].copy()
        _SOT_CACHE["data"] = df
        _SOT_CACHE["ts"] = now
        return df
    except Exception:
        return _SOT_CACHE["data"] or pd.DataFrame()

_ISO_TO_COUNTRY = {}
try:
    import pycountry as _pyc
    for c in _pyc.countries:
        _ISO_TO_COUNTRY[c.alpha_2] = c.name
except Exception:
    pass

def get_sot_countries():
    df = load_sot_data()
    if len(df) == 0:
        return []
    return sorted(set(_ISO_TO_COUNTRY.get(c, c) for c in df["COUNTRY_ISO"].dropna().unique() if _ISO_TO_COUNTRY.get(c, c) != c))

def get_sot_providers():
    df = load_sot_data()
    if len(df) == 0:
        return []
    return sorted(df["PROVIDER_NAME"].dropna().unique().tolist())

_VERTICAL_COLS = {
    "High Risk": "ACCEPTS_HIGH_RISK", "Gambling": "ACCEPTS_GAMBLING",
    "Gaming": "ACCEPTS_GAMING", "Forex": "ACCEPTS_FOREX",
    "Crypto": "ACCEPTS_CRYPTO", "Adult": "ACCEPTS_ADULT",
    "MLM": "ACCEPTS_MULTI_LEVEL_MARKETING", "Airlines": "ACCEPTS_AIRLINES",
}

def find_partners(country_iso=None, verticals=None, live_only=True, processing_type=None):
    df = load_sot_data().copy()
    if len(df) == 0:
        return []
    if live_only:
        df = df[df["Live/NonLive Partner/Contract signed"] == "Live"]
    if country_iso:
        df = df[df["COUNTRY_ISO"] == country_iso]
    if processing_type:
        df = df[df["PROCESSING_TYPE"] == processing_type]
    if verticals:
        for v in verticals:
            col = _VERTICAL_COLS.get(v)
            if col and col in df.columns:
                df = df[(df[col] == True) | (df[col] == 1) | (df[col] == 1.0)]
    results = []
    for provider, grp in df.groupby("PROVIDER_NAME"):
        cats = grp["PROVIDER_CATEGORY"].unique().tolist()
        countries = sorted(grp["COUNTRY_ISO"].dropna().unique().tolist())
        pm_types = sorted(grp["PAYMENT_METHOD_TYPE"].dropna().unique().tolist())
        proc_types = grp["PROCESSING_TYPE"].dropna().unique().tolist()
        status = "Live" if "Live" in grp["Live/NonLive Partner/Contract signed"].values else "Non Live"
        supports = {}
        for feat in ["SUPPORTS_TOKENIZATION","SUPPORTS_RECURRING_PAYMENTS","SUPPORTS_PAYOUTS",
                     "SUPPORTS_INSTALLMENTS","SUPPORTS_PAYFAC","SUPPORTS_SPLIT_PAYMENTS","3DS"]:
            vals = grp[feat].dropna().unique() if feat in grp.columns else []
            supports[feat] = any(v == True or v == 1 or v == 1.0 for v in vals)
        results.append({
            "name": provider, "categories": cats,
            "countries_iso": countries, "countries_count": len(countries),
            "payment_methods": pm_types[:8], "processing_types": proc_types,
            "status": status, "supports": supports,
        })
    results.sort(key=lambda x: (-x["countries_count"], x["name"]))
    return results

# ── Static data ──────────────────────────────────────────────────────────────

PIPELINE_STAGES = {
    "Prospect":    {"color": "#86868b", "count": 3},
    "Qualified":   {"color": "#60a5fa", "count": 3},
    "Evaluation":  {"color": "#c084fc", "count": 4},
    "Negotiation": {"color": "#fbbf24", "count": 2},
    "Won":         {"color": "#4ade80", "count": 2},
}

PIPELINE_DEALS = {
    "Prospect":    [
        {"name":"Rapyd","region":"EMEA","type":"PSP","owner":"Alex","days":8},
        {"name":"Flutterwave","region":"Africa","type":"APM","owner":"Sofia","days":15},
        {"name":"Pagsmile","region":"Brazil","type":"APM","owner":"Johanderson","days":22},
    ],
    "Qualified":   [
        {"name":"Airwallex","region":"APAC","type":"PSP","owner":"Lily","days":12},
        {"name":"Xendit","region":"APAC","type":"Acquirer","owner":"Lily","days":19},
        {"name":"Conekta","region":"LATAM","type":"Acquirer","owner":"Talita","days":31},
    ],
    "Evaluation":  [
        {"name":"PayRetailers","region":"LATAM","type":"APM","owner":"Talita","days":14},
        {"name":"Kushki","region":"LATAM","type":"Acquirer","owner":"Johanderson","days":28},
        {"name":"Safaricom","region":"Africa","type":"APM","owner":"Alex","days":45},
        {"name":"Truevo","region":"EMEA","type":"Acquirer","owner":"Alessandra","days":9},
    ],
    "Negotiation": [
        {"name":"Ebanx","region":"Brazil","type":"APM","owner":"Johanderson","days":37},
        {"name":"PayU","region":"LATAM","type":"PSP","owner":"Talita","days":52},
    ],
    "Won":         [
        {"name":"Adyen","region":"Global","type":"PSP","owner":"Alex","days":61},
        {"name":"dLocal","region":"LATAM","type":"PSP","owner":"Johanderson","days":74},
    ],
}

REVSHARE_BY_PARTNER = {
    "DLocal": 25338, "Stripe": 21705, "Cielo": 17635, "Bamboo": 9491,
    "Mercado Pago": 7365, "Unlimint": 5949, "PagBank": 4516,
    "Nuvei/Paymentez": 3772, "Pagar.me": 3441, "PicPay": 3180
}
REVSHARE_MONTHLY = [
    ("Nov 24",61000),("Dec 24",61000),("Jan 25",122000),("Feb 25",122000),
    ("Mar 25",183000),("Apr 25",183000),("May 25",144000),("Jun 25",145000),
    ("Jul 25",166000),("Aug 25",219000),("Sep 25",245000),("Oct 25",245000),
    ("Nov 25",178000),("Dec 25",161000),("Jan 26",123000),("Feb 26",123000),
]

MERCHANTS = [
    {"name":"Rappi","country":"Colombia","region":"LATAM","tpv":8.2,"aov":34,"txn_mo":241000,"ar":91.2,"providers":["dLocal","Kushki"],"color":"#f97316"},
    {"name":"MercadoLibre","country":"Argentina","region":"LATAM","tpv":14.7,"aov":62,"txn_mo":237000,"ar":88.6,"providers":["Mercado Pago","Stripe"],"color":"#f59e0b"},
    {"name":"Uber","country":"Brazil","region":"Brazil","tpv":11.3,"aov":18,"txn_mo":628000,"ar":94.1,"providers":["PagBank","Cielo","Stripe"],"color":"#0f172a"},
    {"name":"Netflix","country":"Mexico","region":"LATAM","tpv":3.1,"aov":12,"txn_mo":258000,"ar":96.3,"providers":["Stripe","Conekta"],"color":"#dc2626"},
    {"name":"Spotify","country":"Brazil","region":"Brazil","tpv":2.4,"aov":8,"txn_mo":300000,"ar":95.7,"providers":["PagBank","Pagar.me"],"color":"#22c55e"},
    {"name":"Despegar","country":"Argentina","region":"LATAM","tpv":6.8,"aov":412,"txn_mo":16500,"ar":82.4,"providers":["Bamboo","dLocal"],"color":"#3b82f6"},
    {"name":"Falabella","country":"Chile","region":"LATAM","tpv":5.2,"aov":88,"txn_mo":59100,"ar":89.9,"providers":["Kushki","dLocal"],"color":"#6d28d9"},
    {"name":"iFood","country":"Brazil","region":"Brazil","tpv":9.6,"aov":22,"txn_mo":436000,"ar":93.2,"providers":["PagBank","Pagar.me","PicPay"],"color":"#ef4444"},
    {"name":"Cinépolis","country":"Mexico","region":"LATAM","tpv":1.8,"aov":28,"txn_mo":64300,"ar":87.1,"providers":["Conekta","Stripe"],"color":"#8b5cf6"},
    {"name":"PedidosYa","country":"Uruguay","region":"LATAM","tpv":2.7,"aov":19,"txn_mo":142000,"ar":90.5,"providers":["dLocal","Unlimint"],"color":"#ec4899"},
    {"name":"Claro","country":"Brazil","region":"Brazil","tpv":4.1,"aov":45,"txn_mo":91100,"ar":85.6,"providers":["Cielo","PagBank"],"color":"#dc2626"},
    {"name":"Linio","country":"Colombia","region":"LATAM","tpv":1.3,"aov":71,"txn_mo":18300,"ar":84.2,"providers":["dLocal","PayU"],"color":"#0ea5e9"},
]

CONTACTS = [
    {"init":"TK","bg":"rgba(59,130,246,.15)","color":"#60a5fa","name":"Tom Kuehn","role":"Head of LATAM Partnerships","company":"Adyen · PSP","badge":"Champion","badge_color":"#22c55e","last":"2d ago","rel":5,"deals":"3 active"},
    {"init":"RV","bg":"rgba(168,85,247,.15)","color":"#c084fc","name":"Ricardo Vega","role":"VP Business Development","company":"Nuvei · PSP","badge":"Warm","badge_color":"#f59e0b","last":"5h ago","rel":4,"deals":"1 active"},
    {"init":"AP","bg":"rgba(20,184,166,.15)","color":"#2dd4bf","name":"Ana Pacheco","role":"Strategic Partnerships Director","company":"Kushki · Acquirer","badge":"Active","badge_color":"#3b82f6","last":"1w ago","rel":4,"deals":"2 active"},
    {"init":"FM","bg":"rgba(245,158,11,.15)","color":"#fbbf24","name":"Felipe Morales","role":"Head of Digital Products","company":"Getnet · Acquirer","badge":"Executive Sponsor","badge_color":"#22c55e","last":"Today","rel":5,"deals":"1 at Negotiation"},
    {"init":"DH","bg":"rgba(239,68,68,.15)","color":"#fca5a5","name":"Diana Herrera","role":"Fraud Partnerships Lead","company":"SEON · Fraud","badge":"Live Partner","badge_color":"#22c55e","last":"3d ago","rel":4,"deals":"Integration live"},
    {"init":"MC","bg":"rgba(245,158,11,.15)","color":"#fde68a","name":"Martín Castillo","role":"CEO & Co-Founder","company":"Pomelo · BaaS","badge":"New Vertical","badge_color":"#f59e0b","last":"Yesterday","rel":3,"deals":"1 at Evaluation"},
]

REGION_STATS = {
    "Brazil":        {"total":73,"live":32,"strategic":9,"tier1":4,"revshare":"$32.9K/mo"},
    "LATAM":         {"total":105,"live":15,"strategic":2,"tier1":31,"revshare":"$47.6K/mo"},
    "EMEA":          {"total":81,"live":2,"strategic":3,"tier1":21,"revshare":"-"},
    "Global":        {"total":107,"live":18,"strategic":13,"tier1":12,"revshare":"$28.3K/mo"},
    "APAC":          {"total":53,"live":6,"strategic":4,"tier1":10,"revshare":"$32.9K/mo"},
    "North America": {"total":37,"live":3,"strategic":5,"tier1":4,"revshare":"$0.4K/mo"},
    "Africa":        {"total":5,"live":0,"strategic":0,"tier1":2,"revshare":"-"},
}

COUNTRIES = {
    "Brazil": {"flag":"🇧🇷","currency":"BRL","methods":["Credit Card","Boleto","PIX","Pagar.me","PicPay"],"settlement":"D+1 (PIX), D+30 (cards)","fx":"Controlled. USD settlement requires BACEN authorization.","regulation":"Central Bank of Brazil (BACEN) regulates. EMI license required for most operations.","top_providers":["PagBank","Cielo","Pagar.me","PicPay","Mercado Pago"]},
    "Mexico": {"flag":"🇲🇽","currency":"MXN","methods":["Credit Card","OXXO Pay","SPEI","Conekta","Clip"],"settlement":"D+1 to D+3","fx":"Relatively open. MXN/USD conversion is straightforward.","regulation":"CNBV & Banxico. SOFOM license for lending; IFPE for e-money.","top_providers":["Conekta","OpenPay","Clip","Stripe MX","BBVA"]},
    "Colombia": {"flag":"🇨🇴","currency":"COP","methods":["Credit Card","PSE","Nequi","Daviplata","Efecty"],"settlement":"D+1 to D+2","fx":"Open market. COP volatile vs USD.","regulation":"Superintendencia Financiera. Payment companies need authorization.","top_providers":["PayU","Kushki","dLocal","Wompi","Place to Pay"]},
    "Argentina": {"flag":"🇦🇷","currency":"ARS","methods":["Credit Card","Mercado Pago","Rapipago","PagoFácil","Debit"],"settlement":"Complex due to FX controls","fx":"Strict capital controls. Multiple exchange rates (official, MEP, CCL).","regulation":"BCRA regulates. Complex compliance requirements.","top_providers":["Mercado Pago","Prisma","Fiserv","dLocal","Bamboo"]},
    "Chile": {"flag":"🇨🇱","currency":"CLP","methods":["Credit Card","WebPay","Khipu","Mach","Fpay"],"settlement":"D+1 to D+2","fx":"Open market. Stable CLP.","regulation":"CMF regulates. Fintech law passed 2023.","top_providers":["Transbank","Kushki","Getnet","Flow","Khipu"]},
    "Peru": {"flag":"🇵🇪","currency":"PEN","methods":["Credit Card","PagoEfectivo","Yape","Plin","BCP"],"settlement":"D+1 to D+3","fx":"Open. SBS controls FX operations.","regulation":"SBS & BCR. Growing fintech regulation framework.","top_providers":["Niubiz","Culqi","Izipay","PagoEfectivo","dLocal"]},
    "UAE": {"flag":"🇦🇪","currency":"AED","methods":["Credit Card","Apple Pay","Network International","PayBy","Tabby"],"settlement":"D+1 to D+2","fx":"Pegged to USD. No FX risk.","regulation":"CBUAE & ADGM/DIFC for fintech. Strong AML requirements.","top_providers":["Network International","PayTabs","Telr","Checkout.com","Stripe"]},
    "Saudi Arabia": {"flag":"🇸🇦","currency":"SAR","methods":["Credit Card","mada","Apple Pay","STC Pay","Tamara"],"settlement":"D+1","fx":"Pegged to USD.","regulation":"SAMA regulates. Fintech Saudi initiative active.","top_providers":["HyperPay","PayTabs","Moyasar","Geidea","STC Pay"]},
    "India": {"flag":"🇮🇳","currency":"INR","methods":["UPI","Credit Card","NetBanking","Paytm","PhonePe"],"settlement":"D+1 (UPI), D+2 (cards)","fx":"RBI controls. Repatriation requires documentation.","regulation":"RBI regulates. Payment Aggregator license required since 2021.","top_providers":["Razorpay","PayU","Cashfree","Instamojo","CCAvenue"]},
    "Singapore": {"flag":"🇸🇬","currency":"SGD","methods":["Credit Card","PayNow","FAST","GrabPay","DBS PayLah"],"settlement":"D+1","fx":"Open market. SGD stable.","regulation":"MAS regulates. MPI license required.","top_providers":["Stripe","Adyen","2C2P","Asiapay","PayNow"]},
}

# Preload all sheet caches in background at startup
def _preload_caches():
    try:
        load_partners_excel()
    except Exception:
        pass
    try:
        load_sot_data()
    except Exception:
        pass
    try:
        load_technical_contact("")
    except Exception:
        pass
    try:
        load_sales_contacts("")
    except Exception:
        pass
    try:
        _load_partners_sot()
    except Exception:
        pass

threading.Thread(target=_preload_caches, daemon=True).start()

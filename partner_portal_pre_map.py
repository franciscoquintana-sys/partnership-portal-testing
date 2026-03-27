import streamlit as st
import plotly.graph_objects as go
import numpy as np
import pandas as pd
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Yuno | Partner Portal",
    layout="wide",
    initial_sidebar_state="expanded",
)

if "show_filters" not in st.session_state:
    st.session_state.show_filters = False
if "ins_show_filters" not in st.session_state:
    st.session_state.ins_show_filters = False
if "bm_show_filters" not in st.session_state:
    st.session_state.bm_show_filters = False
if "rv_show_filters" not in st.session_state:
    st.session_state.rv_show_filters = False

PARTNER    = "NEXAPAY"
TODAY      = datetime.now()
DAY_NAME   = TODAY.strftime("%A")
MONTH_DAY  = TODAY.strftime("%B %-d")

# ── Merchants data ─────────────────────────────────────────────────────────────
MERCHANTS = [
    {"name": "Rappi",        "sector": "Delivery",       "country": "Colombia",  "start": "Mar 2022", "color": "#FF5722", "init": "R",  "tc": "#fff"},
    {"name": "MercadoLibre", "sector": "E-commerce",     "country": "Argentina", "start": "Aug 2021", "color": "#FFE600", "init": "ML", "tc": "#333"},
    {"name": "Uber",         "sector": "Transportation", "country": "Mexico",    "start": "Jan 2022", "color": "#1A1A1A", "init": "Ub", "tc": "#fff"},
    {"name": "Netflix",      "sector": "Entertainment",  "country": "USA",       "start": "May 2023", "color": "#E50914", "init": "N",  "tc": "#fff"},
    {"name": "Spotify",      "sector": "Entertainment",  "country": "Brazil",    "start": "Nov 2022", "color": "#1DB954", "init": "S",  "tc": "#fff"},
    {"name": "Despegar",     "sector": "Travel",         "country": "Argentina", "start": "Dec 2021", "color": "#0066CC", "init": "D",  "tc": "#fff"},
    {"name": "Falabella",    "sector": "Retail",         "country": "Chile",     "start": "Jun 2022", "color": "#009900", "init": "F",  "tc": "#fff"},
    {"name": "iFood",        "sector": "Delivery",       "country": "Brazil",    "start": "Jan 2023", "color": "#EA1D2C", "init": "iF", "tc": "#fff"},
    {"name": "PedidosYa",    "sector": "Delivery",       "country": "Uruguay",   "start": "Sep 2022", "color": "#FF7A00", "init": "PY", "tc": "#fff"},
    {"name": "Linio",        "sector": "E-commerce",     "country": "Mexico",    "start": "Nov 2021", "color": "#F57C00", "init": "Li", "tc": "#fff"},
    {"name": "Cinépolis",    "sector": "Entertainment",  "country": "Mexico",    "start": "Mar 2023", "color": "#6D0020", "init": "Ci", "tc": "#fff"},
    {"name": "Claro",        "sector": "Telecom",        "country": "Brazil",    "start": "Apr 2022", "color": "#E53935", "init": "Cl", "tc": "#fff"},
]
COUNTRIES = sorted(set(m["country"] for m in MERCHANTS))
SECTORS   = sorted(set(m["sector"]  for m in MERCHANTS))

# Rich merchant metrics (monthly)
MERCHANT_METRICS = [
    {"name": "Rappi",        "country": "Colombia",  "region": "LATAM",     "tpv": 8.42,  "aov": 32.5,  "txns": 259077, "ar": 0.912},
    {"name": "MercadoLibre", "country": "Argentina", "region": "LATAM",     "tpv": 7.31,  "aov": 118.4, "txns": 61739,  "ar": 0.887},
    {"name": "Uber",         "country": "Mexico",    "region": "LATAM",     "tpv": 5.89,  "aov": 18.2,  "txns": 323626, "ar": 0.934},
    {"name": "Netflix",      "country": "USA",       "region": "N. America","tpv": 4.75,  "aov": 15.5,  "txns": 306452, "ar": 0.956},
    {"name": "Spotify",      "country": "Brazil",    "region": "LATAM",     "tpv": 4.21,  "aov": 9.99,  "txns": 421421, "ar": 0.948},
    {"name": "Despegar",     "country": "Argentina", "region": "LATAM",     "tpv": 3.84,  "aov": 312.5, "txns": 12288,  "ar": 0.823},
    {"name": "Falabella",    "country": "Chile",     "region": "LATAM",     "tpv": 3.12,  "aov": 87.3,  "txns": 35739,  "ar": 0.871},
    {"name": "iFood",        "country": "Brazil",    "region": "LATAM",     "tpv": 2.93,  "aov": 28.4,  "txns": 103169, "ar": 0.918},
    {"name": "PedidosYa",    "country": "Uruguay",   "region": "LATAM",     "tpv": 2.24,  "aov": 35.8,  "txns": 62570,  "ar": 0.901},
    {"name": "Linio",        "country": "Mexico",    "region": "LATAM",     "tpv": 1.87,  "aov": 72.1,  "txns": 25936,  "ar": 0.856},
    {"name": "Cinépolis",    "country": "Mexico",    "region": "LATAM",     "tpv": 1.54,  "aov": 24.5,  "txns": 62857,  "ar": 0.924},
    {"name": "Claro",        "country": "Brazil",    "region": "LATAM",     "tpv": 1.12,  "aov": 22.8,  "txns": 49123,  "ar": 0.897},
]
REGIONS = sorted(set(m["region"] for m in MERCHANT_METRICS))

# ── Connections data ────────────────────────────────────────────────────────────
CONNECTIONS = [
    # Acquirers
    {"name": "Cielo",        "category": "Acquirers", "country": "Brazil",      "region": "LATAM",         "status": "Live",                                     "color": "#1DB954", "init": "Ci", "tc": "#fff"},
    {"name": "Redecard",     "category": "Acquirers", "country": "Brazil",      "region": "LATAM",         "status": "Live",                                     "color": "#E53935", "init": "Re", "tc": "#fff"},
    {"name": "Getnet",       "category": "Acquirers", "country": "Brazil",      "region": "LATAM",         "status": "Development Complete - Awaiting Merchant",  "color": "#1565C0", "init": "Ge", "tc": "#fff"},
    {"name": "Bancolombia",  "category": "Acquirers", "country": "Colombia",    "region": "LATAM",         "status": "In Development",                           "color": "#FFD600", "init": "BC", "tc": "#333"},
    {"name": "Banorte",      "category": "Acquirers", "country": "Mexico",      "region": "LATAM",         "status": "Live",                                     "color": "#C62828", "init": "BN", "tc": "#fff"},
    {"name": "BBVA",         "category": "Acquirers", "country": "Spain",       "region": "Europe",        "status": "Contract Signed",                          "color": "#004481", "init": "BB", "tc": "#fff"},
    {"name": "Santander",    "category": "Acquirers", "country": "Spain",       "region": "Europe",        "status": "Screening",                                "color": "#EC0000", "init": "Sa", "tc": "#fff"},
    {"name": "Promerica",    "category": "Acquirers", "country": "Guatemala",   "region": "LATAM",         "status": "KYP",                                      "color": "#006B3F", "init": "Pr", "tc": "#fff"},
    # PSPs
    {"name": "Adyen",        "category": "PSPs",      "country": "Netherlands", "region": "Europe",        "status": "Live",                                     "color": "#0ABF53", "init": "Ad", "tc": "#fff"},
    {"name": "Stripe",       "category": "PSPs",      "country": "USA",         "region": "North America", "status": "Live",                                     "color": "#635BFF", "init": "St", "tc": "#fff"},
    {"name": "PayU",         "category": "PSPs",      "country": "Colombia",    "region": "LATAM",         "status": "Live",                                     "color": "#FF6B00", "init": "PU", "tc": "#fff"},
    {"name": "Kushki",       "category": "PSPs",      "country": "Ecuador",     "region": "LATAM",         "status": "Live",                                     "color": "#6C3691", "init": "Ku", "tc": "#fff"},
    {"name": "dLocal",       "category": "PSPs",      "country": "Uruguay",     "region": "LATAM",         "status": "Development Complete - Awaiting Merchant",  "color": "#00B4D8", "init": "dL", "tc": "#fff"},
    {"name": "Conekta",      "category": "PSPs",      "country": "Mexico",      "region": "LATAM",         "status": "In Development",                           "color": "#5B21B6", "init": "Co", "tc": "#fff"},
    {"name": "Evertec",      "category": "PSPs",      "country": "Colombia",    "region": "LATAM",         "status": "Contract Signed",                          "color": "#1E3A5F", "init": "Ev", "tc": "#fff"},
    {"name": "OpenPay",      "category": "PSPs",      "country": "Mexico",      "region": "LATAM",         "status": "KYP",                                      "color": "#059669", "init": "OP", "tc": "#fff"},
    {"name": "Worldpay",     "category": "PSPs",      "country": "USA",         "region": "North America", "status": "Screening",                                "color": "#0077C8", "init": "Wp", "tc": "#fff"},
    # APMs
    {"name": "PIX",          "category": "APMs",      "country": "Brazil",      "region": "LATAM",         "status": "Live",                                     "color": "#00BDAE", "init": "PX", "tc": "#fff"},
    {"name": "OXXO",         "category": "APMs",      "country": "Mexico",      "region": "LATAM",         "status": "Live",                                     "color": "#D4001A", "init": "OX", "tc": "#fff"},
    {"name": "PSE",          "category": "APMs",      "country": "Colombia",    "region": "LATAM",         "status": "Live",                                     "color": "#0051A5", "init": "PS", "tc": "#fff"},
    {"name": "Boleto",       "category": "APMs",      "country": "Brazil",      "region": "LATAM",         "status": "Live",                                     "color": "#1565C0", "init": "Bo", "tc": "#fff"},
    {"name": "WebPay",       "category": "APMs",      "country": "Chile",       "region": "LATAM",         "status": "Development Complete - Awaiting Merchant",  "color": "#1A1A8C", "init": "WP", "tc": "#fff"},
    {"name": "PagoFácil",    "category": "APMs",      "country": "Argentina",   "region": "LATAM",         "status": "In Development",                           "color": "#00873E", "init": "PF", "tc": "#fff"},
    {"name": "Rapipago",     "category": "APMs",      "country": "Argentina",   "region": "LATAM",         "status": "Screening",                                "color": "#004B87", "init": "RP", "tc": "#fff"},
    {"name": "SEPA",         "category": "APMs",      "country": "Germany",     "region": "Europe",        "status": "Live",                                     "color": "#003399", "init": "SE", "tc": "#fff"},
    {"name": "iDEAL",        "category": "APMs",      "country": "Netherlands", "region": "Europe",        "status": "Contract Signed",                          "color": "#CC0066", "init": "iD", "tc": "#fff"},
    {"name": "Klarna",       "category": "APMs",      "country": "Sweden",      "region": "Europe",        "status": "Screening",                                "color": "#FFB3C7", "init": "Kl", "tc": "#333"},
]
CONN_COUNTRIES = sorted(set(c["country"] for c in CONNECTIONS))
CONN_REGIONS   = sorted(set(c["region"]  for c in CONNECTIONS))

# ── Home mock data ─────────────────────────────────────────────────────────────
np.random.seed(42)
_hour  = min(TODAY.hour, 23)
_hours = list(range(_hour + 1))
METHODS  = ["Card Visa", "Card Mastercard", "PIX", "OXXO"]
_COLORS  = ["#5B5BD6", "#A5A5E8", "#10B981", "#F59E0B"]
_BASE    = {"Card Visa": 22, "Card Mastercard": 17, "PIX": 28, "OXXO": 10}

_tpv = {}
for _m in METHODS:
    _b, _v = _BASE[_m], []
    for _h in _hours:
        if   _h < 6:  _f = 0.15
        elif _h < 10: _f = 0.45 + (_h - 6) * 0.12
        elif _h < 14: _f = 0.92
        elif _h < 18: _f = 0.82
        else:         _f = 0.68
        _v.append(_b * _f * np.random.uniform(0.88, 1.12))
    _tpv[_m] = _v

_total_today     = sum(sum(v) for v in _tpv.values())
_total_yesterday = _total_today / 0.42
_delta           = (_total_today - _total_yesterday) / _total_yesterday * 100

CURRENCIES = ["USD", "MXN", "BRL", "ARS", "COP"]
FX         = {"USD": 1, "MXN": 17.5, "BRL": 5.1, "ARS": 900, "COP": 4100}
SYMBOLS    = {"USD": "$", "MXN": "$", "BRL": "R$", "ARS": "$", "COP": "$"}

# ── Insights mock data ────────────────────────────────────────────────────────
_INS_MONTHS  = pd.date_range("2024-03-01", periods=12, freq="MS")
_INS_TOTALS  = [2.7, 8.3, 13.8, 20.9, 19.5, 24.0, 25.1, 41.0, 60.2, 62.4, 40.6, 40.5]
_INS_CARD    = [0.65, 0.64, 0.63, 0.61, 0.60, 0.59, 0.58, 0.57, 0.56, 0.55, 0.56, 0.57]
_INS_PIX     = [0.28, 0.28, 0.29, 0.30, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.35, 0.34]
_INS_GPAY    = [0.07, 0.08, 0.08, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09]
_COUNTRY_PCT = {
    "Mexico": 0.25, "Brazil": 0.25, "Colombia": 0.20,
    "Argentina": 0.15, "Chile": 0.05, "Uruguay": 0.05, "USA": 0.05,
}

# ── Benchmark mock data ───────────────────────────────────────────────────────
_BM_MONTHS      = pd.date_range("2024-08-01", periods=6, freq="MS")
_BM_NEXAPAY     = [0.68, 0.66, 0.64, 0.62, 0.59, 0.55]
_BM_PROV2       = [0.96, 0.97, 0.97, 0.97, 0.97, 0.98]
_BM_PROV3       = [0.83, 0.83, 0.82, 0.82, 0.81, 0.80]
_BM_REC_NP      = [0.009, 0.008, 0.008, 0.007, 0.005, 0.004]
_BM_REC_P2      = [0.048, 0.051, 0.050, 0.053, 0.027, 0.039]
_BM_REC_P3      = [0.038, 0.039, 0.041, 0.042, 0.053, 0.027]
_PM_ADJ         = {"CARD": 0.94, "PIX": 1.06, "GOOGLE_PAY": 1.02, "OXXO": 0.88}

# ── Revshare mock data ────────────────────────────────────────────────────────
_RV_MONTHS      = pd.date_range("2024-08-01", periods=6, freq="MS")
_RV_EARNED      = [21.6, 66.4, 110.4, 167.2, 156.0, 192.0]   # K USD per month
_RV_PM_EARNED   = {"CARD": 195.4, "PIX": 126.8, "GOOGLE_PAY": 54.3, "OXXO": 22.1}  # K USD total
_RV_MERCHANTS   = {                                             # K USD total
    "Rappi": 88.2, "MercadoLibre": 76.5, "Uber": 63.1,
    "Netflix": 51.0, "iFood": 48.2, "Spotify": 42.5,
}
_RV_RATES       = {                                             # applied rate per type
    "Card Visa": 0.0095, "Card Mastercard": 0.0090,
    "GOOGLE_PAY": 0.0085, "PIX": 0.0075, "SEPA": 0.0070, "OXXO": 0.0065,
}
_RV_PENDING     = 87.3   # K USD — current pending payout

# ── CSS ────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
}
#MainMenu, footer, header { visibility: hidden; }

/* Apple-style page background */
.main, [data-testid="stAppViewContainer"] > section:nth-child(2) {
    background-color: #F5F5F7 !important;
}
.block-container {
    padding-top: 0 !important;
    padding-left: 2.5rem !important;
    padding-right: 2.5rem !important;
    max-width: 100% !important;
    background-color: #F5F5F7;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: #ffffff !important;
    border-right: none !important;
    box-shadow: 1px 0 0 rgba(0,0,0,0.06);
}
[data-testid="stSidebar"] > div:first-child { padding: 2rem 1.25rem 1.5rem 1.25rem; }
.nav-logo {
    font-size: 1.5rem; font-weight: 800; color: #4F46E5;
    margin-bottom: 2rem; letter-spacing: -0.04em;
}

/* Radio → nav items */
[data-testid="stSidebar"] [data-testid="stRadio"] > div:first-child { display: none; }
[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] {
    display: flex; flex-direction: column; gap: 1px;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] {
    padding: 0.6rem 0.85rem !important; border-radius: 10px; cursor: pointer;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] > div:first-child { display: none !important; }
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] > div:last-child p {
    font-size: 0.875rem !important; font-weight: 500 !important;
    color: #6E6E73 !important; margin: 0 !important; letter-spacing: -0.01em;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:has(input:checked) {
    background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%) !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:has(input:checked) > div:last-child p {
    color: #4F46E5 !important; font-weight: 700 !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:not(:has(input:checked)):hover {
    background: #F5F5F7 !important;
}

.nav-divider { border: none; border-top: 1px solid #F2F2F7; margin: 1.25rem 0; }
.feedback-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: #F5F5F7; border: none; border-radius: 10px;
    padding: 0.5rem 1rem; font-size: 0.8rem; color: #6E6E73; font-weight: 500;
}

/* ── Top bar ── */
.topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 0 1.25rem 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    margin-bottom: 2rem; color: #6E6E73; font-size: 0.875rem;
}
.topbar-right { display: flex; align-items: center; gap: 1.1rem; }
.toggle-pill {
    display: inline-flex; align-items: center; gap: 0.4rem;
    background: #F5F5F7; border: none; border-radius: 20px;
    padding: 0.35rem 0.9rem; font-size: 0.78rem; color: #6E6E73; font-weight: 500;
}
.avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
    color: white; display: inline-flex; align-items: center;
    justify-content: center; font-size: 0.75rem; font-weight: 700;
    box-shadow: 0 2px 8px rgba(99,102,241,0.4);
}

/* ── Home ── */
.greeting {
    font-size: 2.25rem; font-weight: 800; color: #1D1D1F;
    letter-spacing: -0.03em; line-height: 1.15;
}
.active-badge {
    display: inline-flex; align-items: center; gap: 0.4rem;
    background: rgba(34,197,94,0.1); border: none; color: #16A34A;
    border-radius: 20px; padding: 0.35rem 0.9rem; font-size: 0.8rem;
    font-weight: 600; white-space: nowrap;
}
.dot-green {
    width: 7px; height: 7px; border-radius: 50%; background: #22C55E;
    display: inline-block; box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
}
.subtitle { color: #6E6E73; font-size: 0.9rem; margin-bottom: 2rem; letter-spacing: -0.01em; }
.section-title {
    font-size: 0.72rem; font-weight: 600; color: #8E8E93;
    letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.9rem;
}
.shortcut-card {
    background: white; border: none; border-radius: 20px;
    padding: 2rem 1rem; text-align: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    cursor: pointer;
}
.shortcut-card:hover {
    box-shadow: 0 10px 30px rgba(0,0,0,0.11);
    transform: translateY(-2px);
}
.shortcut-icon-wrap {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
    border-radius: 14px;
    margin: 0 auto 1rem auto;
    display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
}
.shortcut-label { font-size: 0.9rem; color: #1D1D1F; font-weight: 600; letter-spacing: -0.01em; }
.section-divider { border: none; border-top: 1px solid rgba(0,0,0,0.06); margin: 2rem 0 1.5rem 0; }
.perf-title { font-size: 1.05rem; font-weight: 700; color: #1D1D1F; letter-spacing: -0.02em; }
.info-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #C7C7CC;
    color: #8E8E93; font-size: 0.65rem; font-weight: 600;
    margin-left: 0.35rem; vertical-align: middle;
}
.chart-card {
    background: white; border: none; border-radius: 20px;
    padding: 1.5rem 1.5rem 0.75rem 1.5rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03);
}
.chart-card-title {
    font-size: 0.875rem; font-weight: 600; color: #1D1D1F;
    margin-bottom: 0.5rem; letter-spacing: -0.01em;
}
.kpi-card {
    background: linear-gradient(140deg, #4F46E5 0%, #7C3AED 100%);
    border-radius: 20px; padding: 2rem 1.75rem;
    color: white; min-height: 220px;
    display: flex; flex-direction: column; justify-content: center;
    box-shadow: 0 8px 30px rgba(79,70,229,0.4);
}
.kpi-label {
    font-size: 0.72rem; opacity: 0.75; margin-bottom: 0.75rem;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
}
.kpi-value {
    font-size: 2rem; font-weight: 800; margin-bottom: 0.65rem;
    line-height: 1.1; letter-spacing: -0.03em;
}
.kpi-delta { font-size: 0.8rem; opacity: 0.8; }

/* ── Merchants ── */
.page-heading {
    font-size: 2.25rem; font-weight: 800; color: #1D1D1F;
    margin-bottom: 1.5rem; letter-spacing: -0.03em;
}
.tab-bar { display: flex; border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 1.5rem; }
.tab-item {
    font-size: 0.875rem; font-weight: 500; color: #8E8E93;
    padding: 0.7rem 0.25rem; margin-right: 1.75rem; cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -1px; letter-spacing: -0.01em;
}
.tab-item.active { color: #4F46E5; border-bottom-color: #4F46E5; font-weight: 700; }
.merchant-card {
    background: white; border: none; border-radius: 20px;
    padding: 1.4rem; margin-bottom: 0.85rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03);
    transition: box-shadow 0.2s ease, transform 0.2s ease; cursor: pointer;
}
.merchant-card:hover {
    box-shadow: 0 10px 30px rgba(0,0,0,0.11);
    transform: translateY(-2px);
}
.merchant-logo {
    width: 52px; height: 52px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.merchant-name { font-size: 0.95rem; font-weight: 700; color: #1D1D1F; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
.sector-tag {
    display: inline-block; background: #F5F5F7; border: none;
    border-radius: 20px; padding: 0.25rem 0.75rem;
    font-size: 0.72rem; color: #6E6E73; font-weight: 600; letter-spacing: 0.01em;
}
.no-results { color: #8E8E93; text-align: center; padding: 3rem 0; font-size: 0.95rem; }

/* ── Inputs ── */
[data-testid="stTextInput"] > div > div > input {
    border-radius: 10px !important; border: none !important;
    background: white !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06) !important;
    font-size: 0.875rem !important; padding: 0.55rem 0.85rem !important;
}
[data-testid="stSelectbox"] > div > div {
    background: white; border: none; border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06);
    font-size: 0.8rem; color: #1D1D1F; padding: 0.15rem 0.5rem;
}

/* ── Buttons ── */
.stButton > button {
    border-radius: 10px !important; font-weight: 500 !important;
    border: none !important;
    background: white !important; color: #1D1D1F !important;
    font-size: 0.83rem !important; letter-spacing: -0.01em !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06) !important;
}
.stButton > button:hover {
    box-shadow: 0 4px 14px rgba(0,0,0,0.12) !important;
    transform: translateY(-1px);
}
</style>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
NAV_MAP  = {
    "🏠  Home":        "Home",
    "🔗  Connections": "Connections",
    "⚙️  Merchants":   "Merchants",
    "📊  Insights":    "Insights",
    "📋  Benchmarks":  "Benchmarks",
    "↔️  Revshare":    "Revshare",
}

with st.sidebar:
    st.markdown('<div class="nav-logo">yuno</div>', unsafe_allow_html=True)
    selected = st.radio("nav", list(NAV_MAP.keys()), key="nav_radio", label_visibility="collapsed")
    page = NAV_MAP[selected]
    st.markdown("<br>" * 8, unsafe_allow_html=True)
    st.markdown('<hr class="nav-divider">', unsafe_allow_html=True)
    st.markdown('<div class="feedback-btn">💬&nbsp; Feedback</div>', unsafe_allow_html=True)

# ── Top bar ────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="topbar">
    <span>{page}</span>
    <div class="topbar-right">
        <span class="toggle-pill">⚙️&nbsp; Test mode &nbsp;·&nbsp; Off</span>
        <span style="font-size:1.1rem; color:#9CA3AF;">🔔</span>
        <span class="avatar">N</span>
    </div>
</div>
""", unsafe_allow_html=True)


# ── Page: Home ────────────────────────────────────────────────────────────────
def show_home():
    col_greet, col_badge = st.columns([6, 1])
    with col_greet:
        st.markdown(
            f'<div class="greeting">Good morning,&nbsp; <span style="font-weight:800;">{PARTNER}</span></div>',
            unsafe_allow_html=True,
        )
    with col_badge:
        st.markdown(
            '<div style="display:flex;justify-content:flex-end;padding-top:0.3rem;">'
            '<span class="active-badge"><span class="dot-green"></span>Active</span></div>',
            unsafe_allow_html=True,
        )

    st.markdown(f'<div class="subtitle">Today is {DAY_NAME}, {MONTH_DAY}.</div>', unsafe_allow_html=True)
    st.markdown('<div class="section-title">Shortcuts</div>', unsafe_allow_html=True)

    sc1, sc2, sc3 = st.columns(3)
    for col, (icon, label) in zip([sc1, sc2, sc3], [("💳", "Merchants"), ("📊", "Insights"), ("📋", "Benchmarks")]):
        with col:
            st.markdown(f"""
            <div class="shortcut-card">
                <div class="shortcut-icon-wrap">{icon}</div>
                <div class="shortcut-label">{label}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    perf_col, cur_col = st.columns([5, 1])
    with perf_col:
        st.markdown('<div class="perf-title">Today\'s performance <span class="info-icon">i</span></div>', unsafe_allow_html=True)
    with cur_col:
        currency = st.selectbox("", CURRENCIES, index=0, key="currency", label_visibility="collapsed")

    st.markdown("<div style='margin-top:0.75rem;'></div>", unsafe_allow_html=True)

    chart_col, kpi_col = st.columns([2.5, 1])
    with chart_col:
        st.markdown('<div class="chart-card"><div class="chart-card-title">TPV per Payment Method</div>', unsafe_allow_html=True)
        fig = go.Figure()
        for method, color in zip(METHODS, _COLORS):
            fig.add_trace(go.Scatter(
                x=_hours, y=[v * FX[currency] for v in _tpv[method]],
                name=method, line=dict(color=color, width=2), mode="lines",
                hovertemplate=f"<b>{method}</b><br>%{{y:.1f}}M {currency}<extra></extra>",
            ))
        fig.update_layout(
            height=230, margin=dict(l=0, r=10, t=10, b=0),
            paper_bgcolor="white", plot_bgcolor="white",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0, font=dict(size=11, color="#6B7280")),
            xaxis=dict(tickmode="linear", tick0=0, dtick=4, gridcolor="#F8F8FB", showgrid=True, tickfont=dict(size=10, color="#9CA3AF"), title=None),
            yaxis=dict(gridcolor="#F8F8FB", showgrid=True, tickfont=dict(size=10, color="#9CA3AF"), ticksuffix="M", title=None),
            hovermode="x unified",
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with kpi_col:
        fx, sym = FX[currency], SYMBOLS[currency]
        val = _total_today * fx
        fmt = f"{sym}{val/1000:.2f}B {currency}" if val >= 1000 else f"{sym}{val:.2f}M {currency}"
        arrow = "↗" if _delta >= 0 else "↘"
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-label">Total TPV</div>
            <div class="kpi-value">{fmt}</div>
            <div class="kpi-delta">{arrow} {abs(_delta):.0f}% compared to yesterday</div>
        </div>""", unsafe_allow_html=True)


# ── Page: Merchants ───────────────────────────────────────────────────────────
def show_merchants():
    st.markdown('<div class="page-heading">Merchants</div>', unsafe_allow_html=True)
    st.markdown("""
    <div class="tab-bar">
        <div class="tab-item active">Your Merchants</div>
    </div>""", unsafe_allow_html=True)

    # Inline filters
    s_col, r_col, c_col, req_col = st.columns([3, 1.5, 1.5, 1.5])
    with s_col:
        search = st.text_input("", placeholder="🔍  Search merchants", key="merch_search", label_visibility="collapsed")
    with r_col:
        sel_regions = st.multiselect("", REGIONS, key="merch_region", placeholder="All regions", label_visibility="collapsed")
    with c_col:
        sel_countries = st.multiselect("", COUNTRIES, key="merch_country", placeholder="All countries", label_visibility="collapsed")
    with req_col:
        st.button("⊕  Request integration", key="req_int")

    # Filter data
    filtered = [
        m for m in MERCHANT_METRICS
        if (not search        or search.lower() in m["name"].lower())
        and (not sel_regions   or m["region"]  in sel_regions)
        and (not sel_countries or m["country"] in sel_countries)
    ]

    if not filtered:
        st.markdown('<div class="no-results">No merchants found.</div>', unsafe_allow_html=True)
        return

    st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

    # ── KPI Cards ──────────────────────────────────────────────────────────────
    total_tpv  = sum(m["tpv"] for m in filtered)
    avg_aov    = sum(m["aov"] for m in filtered) / len(filtered)
    avg_ar     = sum(m["ar"]  for m in filtered) / len(filtered)
    total_txns = sum(m["txns"] for m in filtered)

    k1, k2, k3, k4 = st.columns(4)
    for col, (label, value, sub, sub_color) in zip(
        [k1, k2, k3, k4],
        [
            ("Merchants Live",    str(len(filtered)),       "Active & connected",    "#6E6E73"),
            ("Total TPV",         f"${total_tpv:.2f}M",     "This month · USD",      "#6E6E73"),
            ("Avg AOV",           f"${avg_aov:.1f}",        "Across all merchants",  "#6E6E73"),
            ("Avg Approval Rate", f"{avg_ar:.1%}",          "↗ +1.2pp vs last mo.",  "#10B981"),
        ],
    ):
        with col:
            st.markdown(f"""
            <div style="background:white;border-radius:16px;padding:1.25rem 1.5rem;
                        box-shadow:0 2px 12px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.03);">
                <div style="font-size:0.72rem;font-weight:600;color:#8E8E93;text-transform:uppercase;
                            letter-spacing:0.07em;margin-bottom:0.5rem;">{label}</div>
                <div style="font-size:1.6rem;font-weight:800;color:#1D1D1F;line-height:1.1;
                            margin-bottom:0.35rem;letter-spacing:-0.03em;">{value}</div>
                <div style="font-size:0.78rem;color:{sub_color};">{sub}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1.25rem;'></div>", unsafe_allow_html=True)

    # ── Helpers ────────────────────────────────────────────────────────────────
    def ar_color(r):
        return "#22C55E" if r >= 0.92 else ("#F59E0B" if r >= 0.87 else "#EF4444")

    def horiz_layout(title):
        return dict(
            title=dict(text=title, font=dict(size=12, color="#1D1D1F", family="Inter"), x=0),
            height=390,
            margin=dict(l=10, r=85, t=45, b=30),
            paper_bgcolor="white", plot_bgcolor="white",
            showlegend=False, bargap=0.28,
            xaxis=dict(tickfont=dict(size=9, color="#9CA3AF"), gridcolor="#F8F8FB"),
            yaxis=dict(tickfont=dict(size=10, color="#374151"), gridcolor="rgba(0,0,0,0)",
                       autorange="reversed"),
            font=dict(family="Inter"),
        )

    by_tpv  = sorted(filtered, key=lambda x: x["tpv"],  reverse=True)
    by_ar   = sorted(filtered, key=lambda x: x["ar"],   reverse=True)
    by_aov  = sorted(filtered, key=lambda x: x["aov"],  reverse=True)
    by_txns = sorted(filtered, key=lambda x: x["txns"], reverse=True)

    # ── Row 1: TPV + Approval Rate ─────────────────────────────────────────────
    r1c1, r1c2 = st.columns(2)

    with r1c1:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig1 = go.Figure(go.Bar(
            y=[m["name"] for m in by_tpv], x=[m["tpv"] for m in by_tpv],
            orientation="h", marker_color="#9999E8",
            text=[f"${m['tpv']:.2f}M" for m in by_tpv],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"), cliponaxis=False,
        ))
        l1 = horiz_layout("TPV by Merchant")
        l1["xaxis"].update(tickprefix="$", ticksuffix="M")
        fig1.update_layout(**l1)
        fig1.update_xaxes(range=[0, max(m["tpv"] for m in by_tpv) * 1.32])
        st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with r1c2:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig2 = go.Figure(go.Bar(
            y=[m["name"] for m in by_ar], x=[m["ar"] for m in by_ar],
            orientation="h", marker_color=[ar_color(m["ar"]) for m in by_ar],
            text=[f"{m['ar']:.1%}" for m in by_ar],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"), cliponaxis=False,
        ))
        l2 = horiz_layout("Approval Rate by Merchant")
        l2["xaxis"].update(tickformat=".0%")
        fig2.update_layout(**l2)
        fig2.update_xaxes(range=[0, 1.12])
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

    # ── Row 2: AOV + Transactions ──────────────────────────────────────────────
    r2c1, r2c2 = st.columns(2)

    with r2c1:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig3 = go.Figure(go.Bar(
            y=[m["name"] for m in by_aov], x=[m["aov"] for m in by_aov],
            orientation="h", marker_color="#93C5FD",
            text=[f"${m['aov']:.1f}" for m in by_aov],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"), cliponaxis=False,
        ))
        l3 = horiz_layout("Average Order Value (AOV)")
        l3["xaxis"].update(tickprefix="$")
        fig3.update_layout(**l3)
        fig3.update_xaxes(range=[0, max(m["aov"] for m in by_aov) * 1.32])
        st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with r2c2:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig4 = go.Figure(go.Bar(
            y=[m["name"] for m in by_txns], x=[m["txns"] for m in by_txns],
            orientation="h", marker_color="#5B5BD6",
            text=[f"{m['txns']:,}" for m in by_txns],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"), cliponaxis=False,
        ))
        fig4.update_layout(**horiz_layout("Total Transactions"))
        fig4.update_xaxes(range=[0, max(m["txns"] for m in by_txns) * 1.32])
        st.plotly_chart(fig4, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

    # ── Summary Table ──────────────────────────────────────────────────────────
    st.markdown('<div class="chart-card">', unsafe_allow_html=True)
    st.markdown('<div class="chart-card-title">Merchant Summary</div>', unsafe_allow_html=True)
    df_table = pd.DataFrame([{
        "Merchant":      m["name"],
        "Country":       m["country"],
        "Region":        m["region"],
        "TPV (M USD)":   m["tpv"],
        "AOV (USD)":     m["aov"],
        "Transactions":  m["txns"],
        "Approval Rate": m["ar"],
    } for m in filtered]).sort_values("TPV (M USD)", ascending=False)

    st.dataframe(
        df_table, use_container_width=True, hide_index=True,
        column_config={
            "TPV (M USD)":   st.column_config.NumberColumn("TPV (M USD)",   format="$%.2fM"),
            "AOV (USD)":     st.column_config.NumberColumn("AOV (USD)",     format="$%.1f"),
            "Transactions":  st.column_config.NumberColumn("Transactions",  format="%d"),
            "Approval Rate": st.column_config.ProgressColumn(
                "Approval Rate", min_value=0.0, max_value=1.0, format="%.1f%%",
            ),
        },
    )
    st.markdown("</div>", unsafe_allow_html=True)


# ── Page: Connections ────────────────────────────────────────────────────────
def show_connections():
    st.markdown('<div class="page-heading">Connections</div>', unsafe_allow_html=True)
    st.markdown("""
    <div class="tab-bar">
        <div class="tab-item active">Overview</div>
    </div>""", unsafe_allow_html=True)

    STATUS_DOT = {
        "Live":                                    "#22C55E",
        "Development Complete - Awaiting Merchant": "#3B82F6",
        "In Development":                           "#F59E0B",
        "Contract Signed":                          "#8B5CF6",
        "Screening":                                "#9CA3AF",
        "KYP":                                      "#EF4444",
    }
    CATEGORIES   = ["Acquirers", "PSPs", "APMs"]
    ALL_STATUSES = list(STATUS_DOT.keys())

    # ── Filters ──────────────────────────────────────────────────────────────
    f1, f2, f3, f4 = st.columns([2, 2, 2, 2])
    with f1:
        sel_cats      = st.multiselect("", CATEGORIES,     placeholder="All types",     label_visibility="collapsed", key="conn_cat")
    with f2:
        sel_regions   = st.multiselect("", CONN_REGIONS,   placeholder="All regions",   label_visibility="collapsed", key="conn_region")
    with f3:
        sel_countries = st.multiselect("", CONN_COUNTRIES, placeholder="All countries", label_visibility="collapsed", key="conn_country")
    with f4:
        sel_statuses  = st.multiselect("", ALL_STATUSES,   placeholder="All statuses",  label_visibility="collapsed", key="conn_status")

    # ── Filter data ───────────────────────────────────────────────────────────
    filtered = [
        c for c in CONNECTIONS
        if (not sel_cats      or c["category"] in sel_cats)
        and (not sel_regions   or c["region"]   in sel_regions)
        and (not sel_countries or c["country"]  in sel_countries)
        and (not sel_statuses  or c["status"]   in sel_statuses)
    ]

    st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

    # ── KPI cards ─────────────────────────────────────────────────────────────
    by_st       = {s: sum(1 for c in filtered if c["status"] == s) for s in ALL_STATUSES}
    in_progress = by_st["In Development"] + by_st["Development Complete - Awaiting Merchant"] + by_st["Contract Signed"]
    pipeline    = by_st["Screening"] + by_st["KYP"]

    k1, k2, k3, k4 = st.columns(4)
    for col, (label, value, sub, sub_c) in zip(
        [k1, k2, k3, k4],
        [
            ("Total Connections", str(len(filtered)), "Across all regions",  "#6E6E73"),
            ("Live",              str(by_st["Live"]), "Fully operational",   "#10B981"),
            ("In Progress",       str(in_progress),  "Active integrations", "#6E6E73"),
            ("Pipeline",          str(pipeline),     "Under evaluation",    "#6E6E73"),
        ],
    ):
        with col:
            st.markdown(f"""
            <div style="background:white;border-radius:16px;padding:1.25rem 1.5rem;
                        box-shadow:0 2px 12px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.03);">
                <div style="font-size:0.72rem;font-weight:600;color:#8E8E93;text-transform:uppercase;
                            letter-spacing:0.07em;margin-bottom:0.5rem;">{label}</div>
                <div style="font-size:1.6rem;font-weight:800;color:#1D1D1F;line-height:1.1;
                            margin-bottom:0.35rem;letter-spacing:-0.03em;">{value}</div>
                <div style="font-size:0.78rem;color:{sub_c};">{sub}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1.75rem;'></div>", unsafe_allow_html=True)

    # ── Status legend ─────────────────────────────────────────────────────────
    legend_html = '<div style="display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">'
    for label, dot_color in STATUS_DOT.items():
        legend_html += (
            f'<div style="display:flex;align-items:center;gap:0.35rem;">'
            f'<div style="width:8px;height:8px;border-radius:50%;background:{dot_color};flex-shrink:0;"></div>'
            f'<span style="font-size:0.72rem;color:#6E6E73;">{label}</span></div>'
        )
    legend_html += "</div>"
    st.markdown(legend_html, unsafe_allow_html=True)

    # ── Cards grouped by region (alphabetical) ────────────────────────────────
    regions_present = sorted(set(c["region"] for c in filtered))
    COLS_PER_ROW = 6

    for region in regions_present:
        items = sorted(
            [c for c in filtered if c["region"] == region],
            key=lambda x: x["name"].lower(),
        )
        if not items:
            continue

        st.markdown(
            f'<div style="font-size:0.75rem;font-weight:700;color:#8E8E93;text-transform:uppercase;'
            f'letter-spacing:0.1em;margin-bottom:0.75rem;">{region} '
            f'<span style="font-weight:500;color:#C7C7CC;font-size:0.72rem;">{len(items)}</span></div>',
            unsafe_allow_html=True,
        )

        # Build all cards as one HTML block per region for density
        cards_html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;margin-bottom:1.75rem;">'
        for conn in items:
            dot = STATUS_DOT[conn["status"]]
            cards_html += f"""
            <div style="background:white;border-radius:10px;padding:0.55rem 0.65rem;
                        box-shadow:0 1px 5px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);
                        display:flex;align-items:center;gap:0.45rem;min-width:0;">
                <div style="width:26px;height:26px;border-radius:7px;background:{conn['color']};
                            display:flex;align-items:center;justify-content:center;
                            font-size:0.6rem;font-weight:700;color:{conn['tc']};flex-shrink:0;">{conn['init']}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.76rem;font-weight:600;color:#1D1D1F;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{conn['name']}</div>
                    <div style="font-size:0.65rem;color:#9CA3AF;white-space:nowrap;
                                overflow:hidden;text-overflow:ellipsis;">{conn['country']}</div>
                </div>
                <div style="width:7px;height:7px;border-radius:50%;background:{dot};flex-shrink:0;"></div>
            </div>"""
        cards_html += "</div>"
        st.markdown(cards_html, unsafe_allow_html=True)


# ── Page: Insights ───────────────────────────────────────────────────────────
def show_insights():
    st.markdown('<div class="page-heading">Insights</div>', unsafe_allow_html=True)

    # Filter row
    f_col, gap_col, dl_col = st.columns([2, 6, 1.5])
    with f_col:
        if st.button("≡  Add filters  ▾", key="ins_filter_btn"):
            st.session_state.ins_show_filters = not st.session_state.ins_show_filters
    with gap_col:
        if not st.session_state.ins_show_filters:
            st.markdown(
                '<div style="color:#9CA3AF;font-size:0.8rem;padding-top:0.55rem;">No filters applied — always shown in USD</div>',
                unsafe_allow_html=True,
            )

    # Filter panel
    sel_countries, start_idx, end_idx, interval = [], 0, 11, "Monthly"
    month_labels = [d.strftime("%b %Y") for d in _INS_MONTHS]

    if st.session_state.ins_show_filters:
        fc1, fc2, fc3, fc4 = st.columns([2.5, 1.5, 1.5, 2])
        with fc1:
            sel_countries = st.multiselect("Country", COUNTRIES, key="ins_country", placeholder="All countries")
        with fc2:
            start_idx = st.selectbox("From", range(len(month_labels)), format_func=lambda i: month_labels[i], index=0, key="ins_start")
        with fc3:
            end_idx = st.selectbox("To", range(len(month_labels)), format_func=lambda i: month_labels[i], index=11, key="ins_end")
        with fc4:
            interval = st.radio("Interval", ["Monthly", "Quarterly", "Yearly"], horizontal=True, key="ins_interval")
        if start_idx > end_idx:
            start_idx, end_idx = end_idx, start_idx

    st.markdown("<div style='margin-top:0.5rem;'></div>", unsafe_allow_html=True)

    # Build dataframe
    df = pd.DataFrame({
        "date":       _INS_MONTHS,
        "total":      _INS_TOTALS,
        "CARD":       [t * c for t, c in zip(_INS_TOTALS, _INS_CARD)],
        "PIX":        [t * p for t, p in zip(_INS_TOTALS, _INS_PIX)],
        "GOOGLE_PAY": [t * g for t, g in zip(_INS_TOTALS, _INS_GPAY)],
    })

    # Apply country scale
    if sel_countries:
        scale = sum(_COUNTRY_PCT.get(c, 0) for c in sel_countries)
        for col in ["total", "CARD", "PIX", "GOOGLE_PAY"]:
            df[col] = df[col] * scale

    # Apply date range
    df = df.iloc[start_idx : end_idx + 1].reset_index(drop=True)

    # Apply interval aggregation
    if interval == "Quarterly":
        df["period"] = df["date"].dt.to_period("Q").astype(str)
        df = df.groupby("period")[["total", "CARD", "PIX", "GOOGLE_PAY"]].sum().reset_index()
        x_vals = df["period"].tolist()
    elif interval == "Yearly":
        df["period"] = df["date"].dt.year.astype(str)
        df = df.groupby("period")[["total", "CARD", "PIX", "GOOGLE_PAY"]].sum().reset_index()
        x_vals = df["period"].tolist()
    else:
        x_vals = [d.strftime("%Y-%m") for d in df["date"]]

    # Download button (data ready now)
    csv_data = df.drop(columns=["date"], errors="ignore").to_csv(index=False)
    with dl_col:
        st.download_button(
            "⬇  Download", data=csv_data,
            file_name="nexapay_insights.csv", mime="text/csv", key="ins_dl",
        )

    # ── Charts ──
    chart1_col, chart2_col = st.columns(2)

    def chart_layout(title, height=400):
        return dict(
            title=dict(text=title, font=dict(size=13, color="#1D1D1F", family="Inter"), x=0),
            height=height,
            margin=dict(l=45, r=20, t=50, b=75),
            paper_bgcolor="white", plot_bgcolor="white",
            xaxis=dict(
                title="Date", tickfont=dict(size=10, color="#9CA3AF"),
                gridcolor="#F8F8FB", title_font=dict(color="#9CA3AF", size=11),
            ),
            yaxis=dict(
                title="TPV", tickfont=dict(size=10, color="#9CA3AF"),
                gridcolor="#F5F5F8", tickprefix="$", ticksuffix="M",
                title_font=dict(color="#9CA3AF", size=11),
            ),
            bargap=0.3,
            font=dict(family="Inter"),
        )

    with chart1_col:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig1 = go.Figure(go.Bar(
            x=x_vals,
            y=df["total"],
            marker_color="#9999E8",
            text=[f"${v:.1f}M" for v in df["total"]],
            textposition="outside",
            textfont=dict(size=9, color="#6E6E73"),
            cliponaxis=False,
        ))
        fig1.update_layout(**chart_layout("Total TPV"), showlegend=False)
        fig1.update_yaxes(range=[0, max(df["total"]) * 1.25])
        st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with chart2_col:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        METHOD_COLORS = {"CARD": "#5B5BD6", "PIX": "#9999E8", "GOOGLE_PAY": "#93C5FD"}
        fig2 = go.Figure()
        for method in ["CARD", "PIX", "GOOGLE_PAY"]:
            fig2.add_trace(go.Bar(
                x=x_vals, y=df[method],
                name=method, marker_color=METHOD_COLORS[method],
                hovertemplate=f"<b>{method}</b>: $%{{y:.1f}}M<extra></extra>",
            ))
        # Use annotations for total labels (avoids stacking bug with invisible bar)
        total_annotations = [
            dict(x=x, y=total, text=f"${total:.1f}M",
                 xanchor="center", yanchor="bottom", showarrow=False,
                 font=dict(size=9, color="#6E6E73", family="Inter"), yshift=4)
            for x, total in zip(x_vals, df["total"])
        ]
        layout2 = chart_layout("Total TVP by Payment Method")
        layout2.update(
            barmode="stack",
            legend=dict(orientation="h", yanchor="top", y=-0.18, xanchor="left", x=0,
                        font=dict(size=11, color="#6E6E73")),
            annotations=total_annotations,
        )
        fig2.update_layout(**layout2)
        fig2.update_yaxes(range=[0, max(df["total"]) * 1.25])
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)


# ── Page: Benchmarks ─────────────────────────────────────────────────────────
def show_benchmarks():
    st.markdown('<div class="page-heading">Benchmark</div>', unsafe_allow_html=True)

    # Filter row
    f_col, gap_col, dl_col = st.columns([2, 6, 1.5])
    with f_col:
        if st.button("≡  Add filters  ▾", key="bm_filter_btn"):
            st.session_state.bm_show_filters = not st.session_state.bm_show_filters
    with gap_col:
        if not st.session_state.bm_show_filters:
            st.markdown(
                '<div style="color:#9CA3AF;font-size:0.8rem;padding-top:0.55rem;">No filters applied</div>',
                unsafe_allow_html=True,
            )

    # Filter panel
    sel_countries, sel_methods, start_idx, end_idx, interval = [], [], 0, 5, "Monthly"
    month_labels = [d.strftime("%b %Y") for d in _BM_MONTHS]

    if st.session_state.bm_show_filters:
        fc1, fc2, fc3, fc4, fc5 = st.columns([2, 2, 1.5, 1.5, 2])
        with fc1:
            sel_countries = st.multiselect("Country", COUNTRIES, key="bm_country", placeholder="All countries")
        with fc2:
            sel_methods = st.multiselect("Payment Method", ["CARD", "PIX", "GOOGLE_PAY", "OXXO"], key="bm_method", placeholder="All methods")
        with fc3:
            start_idx = st.selectbox("From", range(len(month_labels)), format_func=lambda i: month_labels[i], index=0, key="bm_start")
        with fc4:
            end_idx = st.selectbox("To", range(len(month_labels)), format_func=lambda i: month_labels[i], index=5, key="bm_end")
        with fc5:
            interval = st.radio("Interval", ["Monthly", "Quarterly", "Yearly"], horizontal=True, key="bm_interval")
        if start_idx > end_idx:
            start_idx, end_idx = end_idx, start_idx

    st.markdown("<div style='margin-top:0.5rem;'></div>", unsafe_allow_html=True)

    # Build dataframe
    df = pd.DataFrame({
        "date":    _BM_MONTHS,
        "nexapay": _BM_NEXAPAY,
        "prov2":   _BM_PROV2,
        "prov3":   _BM_PROV3,
        "rec_np":  _BM_REC_NP,
        "rec_p2":  _BM_REC_P2,
        "rec_p3":  _BM_REC_P3,
    })

    # Apply date range
    df = df.iloc[start_idx : end_idx + 1].reset_index(drop=True)

    # Apply payment method adjustment to NEXAPAY only
    if sel_methods:
        pm_mult = float(np.mean([_PM_ADJ.get(m, 1.0) for m in sel_methods]))
        df["nexapay"] = (df["nexapay"] * pm_mult).clip(upper=0.999)
        df["rec_np"]  = (df["rec_np"]  * pm_mult)

    # Aggregate by interval (mean for rates, not sum)
    rate_cols = ["nexapay", "prov2", "prov3", "rec_np", "rec_p2", "rec_p3"]
    if interval == "Quarterly":
        df["period"] = df["date"].dt.to_period("Q").astype(str)
        df = df.groupby("period")[rate_cols].mean().reset_index()
        x_vals = df["period"].tolist()
    elif interval == "Yearly":
        df["period"] = df["date"].dt.year.astype(str)
        df = df.groupby("period")[rate_cols].mean().reset_index()
        x_vals = df["period"].tolist()
    else:
        x_vals = [d.strftime("%b/%y") for d in df["date"]]

    # Download button (data ready)
    csv_data = df.drop(columns=["date"], errors="ignore").to_csv(index=False)
    with dl_col:
        st.download_button("⬇  Download", data=csv_data, file_name="nexapay_benchmark.csv", mime="text/csv", key="bm_dl")

    PROV_COLORS = {PARTNER: "#86EFAC", "Provider 2": "#93C5FD", "Provider 3": "#C4B5FD"}

    def bm_layout(title):
        return dict(
            title=dict(text=title, font=dict(size=13, color="#1D1D1F", family="Inter"), x=0),
            height=430,
            margin=dict(l=50, r=20, t=50, b=90),
            paper_bgcolor="white", plot_bgcolor="white",
            barmode="group",
            bargap=0.25, bargroupgap=0.08,
            legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="left", x=0,
                        font=dict(size=11, color="#6E6E73")),
            xaxis=dict(tickfont=dict(size=10, color="#9CA3AF"), gridcolor="#F8F8FB"),
            yaxis=dict(tickfont=dict(size=10, color="#9CA3AF"), gridcolor="#F5F5F8", tickformat=".2%"),
            font=dict(family="Inter"),
        )

    chart1_col, chart2_col = st.columns(2)

    with chart1_col:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig1 = go.Figure()
        for name, col, color in [(PARTNER, "nexapay", "#86EFAC"), ("Provider 2", "prov2", "#93C5FD"), ("Provider 3", "prov3", "#C4B5FD")]:
            fig1.add_trace(go.Bar(
                x=x_vals, y=df[col].tolist(), name=name, marker_color=color,
                hovertemplate=f"<b>{name}</b>: %{{y:.2%}}<extra></extra>",
            ))
        fig1.update_layout(**bm_layout("Approval Rate Benchmark"))
        fig1.update_yaxes(range=[0, 1.1], dtick=0.25)
        st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with chart2_col:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig2 = go.Figure()
        for name, col, color in [(PARTNER, "rec_np", "#86EFAC"), ("Provider 2", "rec_p2", "#93C5FD"), ("Provider 3", "rec_p3", "#C4B5FD")]:
            fig2.add_trace(go.Bar(
                x=x_vals, y=df[col].tolist(), name=name, marker_color=color,
                hovertemplate=f"<b>{name}</b>: %{{y:.2%}}<extra></extra>",
            ))
        max_rec = max(df[["rec_np", "rec_p2", "rec_p3"]].max())
        fig2.update_layout(**bm_layout("Recovery rate by others of rejected transactions - Benchmark"))
        fig2.update_yaxes(range=[0, max_rec * 1.35])
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)


# ── Page: Revshare ───────────────────────────────────────────────────────────
def show_revshare():
    st.markdown('<div class="page-heading">Revshare</div>', unsafe_allow_html=True)

    # Filter row
    f_col, gap_col, dl_col = st.columns([2, 6, 1.5])
    with f_col:
        if st.button("≡  Add filters  ▾", key="rv_filter_btn"):
            st.session_state.rv_show_filters = not st.session_state.rv_show_filters
    with gap_col:
        if not st.session_state.rv_show_filters:
            st.markdown(
                '<div style="color:#9CA3AF;font-size:0.8rem;padding-top:0.55rem;">No filters applied — shown in USD</div>',
                unsafe_allow_html=True,
            )

    # Filter panel
    sel_countries, start_idx, end_idx, interval = [], 0, 5, "Monthly"
    month_labels = [d.strftime("%b %Y") for d in _RV_MONTHS]

    if st.session_state.rv_show_filters:
        fc1, fc2, fc3, fc4 = st.columns([2.5, 1.5, 1.5, 2])
        with fc1:
            sel_countries = st.multiselect("Country", COUNTRIES, key="rv_country", placeholder="All countries")
        with fc2:
            start_idx = st.selectbox("From", range(len(month_labels)), format_func=lambda i: month_labels[i], index=0, key="rv_start")
        with fc3:
            end_idx = st.selectbox("To", range(len(month_labels)), format_func=lambda i: month_labels[i], index=5, key="rv_end")
        with fc4:
            interval = st.radio("Interval", ["Monthly", "Quarterly", "Yearly"], horizontal=True, key="rv_interval")
        if start_idx > end_idx:
            start_idx, end_idx = end_idx, start_idx

    st.markdown("<div style='margin-top:0.5rem;'></div>", unsafe_allow_html=True)

    # Build + filter dataframe
    df = pd.DataFrame({"date": _RV_MONTHS, "earned": _RV_EARNED})
    country_scale = sum(_COUNTRY_PCT.get(c, 0) for c in sel_countries) if sel_countries else 1.0
    df["earned"] = df["earned"] * country_scale
    df = df.iloc[start_idx : end_idx + 1].reset_index(drop=True)

    # Aggregate
    if interval == "Quarterly":
        df["period"] = df["date"].dt.to_period("Q").astype(str)
        df = df.groupby("period")[["earned"]].sum().reset_index()
        x_vals = df["period"].tolist()
    elif interval == "Yearly":
        df["period"] = df["date"].dt.year.astype(str)
        df = df.groupby("period")[["earned"]].sum().reset_index()
        x_vals = df["period"].tolist()
    else:
        x_vals = [d.strftime("%b/%y") for d in df["date"]]

    # Download
    csv_data = df.drop(columns=["date"], errors="ignore").to_csv(index=False)
    with dl_col:
        st.download_button("⬇  Download", data=csv_data, file_name="nexapay_revshare.csv", mime="text/csv", key="rv_dl")

    total_earned = df["earned"].sum()
    pending      = _RV_PENDING * country_scale

    # ── KPI Cards ──────────────────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4)
    kpi_data = [
        ("Total Earned",     f"${total_earned:.1f}K",  "↗ +18% vs last period", "#10B981"),
        ("Pending Payout",   f"${pending:.1f}K",       "Next: Apr 1, 2025",     "#9CA3AF"),
        ("Avg Rate",         "0.82%",                  "Across all methods",    "#9CA3AF"),
        ("Active Merchants", "12",                     "All connected",         "#9CA3AF"),
    ]
    for col, (label, value, sub, sub_color) in zip([k1, k2, k3, k4], kpi_data):
        with col:
            st.markdown(f"""
            <div style="background:white;border:1px solid #EBEBF5;border-radius:14px;padding:1.25rem 1.5rem;">
                <div style="font-size:0.75rem;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">{label}</div>
                <div style="font-size:1.6rem;font-weight:700;color:#111827;line-height:1.1;margin-bottom:0.4rem;">{value}</div>
                <div style="font-size:0.78rem;color:{sub_color};">{sub}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1.25rem;'></div>", unsafe_allow_html=True)

    def small_layout(title, x_suffix="", x_prefix="", y_suffix="", y_prefix=""):
        return dict(
            height=260,
            margin=dict(l=45, r=20, t=40, b=35),
            paper_bgcolor="white", plot_bgcolor="white",
            showlegend=False, bargap=0.3,
            title=dict(text=title, font=dict(size=12, color="#374151", family="Inter"), x=0),
            xaxis=dict(tickfont=dict(size=10, color="#9CA3AF"), gridcolor="#F8F8FB",
                       tickprefix=x_prefix, ticksuffix=x_suffix),
            yaxis=dict(tickfont=dict(size=10, color="#9CA3AF"), gridcolor="#F5F5F8",
                       tickprefix=y_prefix, ticksuffix=y_suffix),
            font=dict(family="Inter"),
        )

    # ── Row 1: Monthly earnings + Payment method donut ──────────────────────
    r1c1, r1c2 = st.columns(2)

    with r1c1:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        fig1 = go.Figure(go.Bar(
            x=x_vals, y=df["earned"].tolist(),
            marker_color="#5B5BD6",
            text=[f"${v:.1f}K" for v in df["earned"]],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"),
            cliponaxis=False,
        ))
        fig1.update_layout(**small_layout("Monthly Revshare Earnings", y_prefix="$", y_suffix="K"))
        fig1.update_yaxes(range=[0, max(df["earned"]) * 1.28])
        st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with r1c2:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        pm_vals = {k: v * country_scale for k, v in _RV_PM_EARNED.items()}
        fig2 = go.Figure(go.Pie(
            labels=list(pm_vals.keys()),
            values=list(pm_vals.values()),
            hole=0.55,
            marker_colors=["#5B5BD6", "#9999E8", "#93C5FD", "#FCD34D"],
            textinfo="percent",
            textposition="inside",
            textfont=dict(size=10, family="Inter", color="white"),
            hovertemplate="<b>%{label}</b><br>$%{value:.1f}K · %{percent}<extra></extra>",
        ))
        fig2.update_layout(
            height=260, margin=dict(l=0, r=0, t=40, b=40),
            paper_bgcolor="white", showlegend=True, font=dict(family="Inter"),
            title=dict(text="Earnings by Payment Method", font=dict(size=12, color="#1D1D1F"), x=0),
            legend=dict(orientation="h", yanchor="top", y=-0.1, xanchor="center", x=0.5,
                        font=dict(size=10, color="#6E6E73")),
        )
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

    # ── Row 2: Top merchants + Rate by transaction type ─────────────────────
    r2c1, r2c2 = st.columns(2)

    with r2c1:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        merch_vals  = [v * country_scale for v in _RV_MERCHANTS.values()]
        merch_names = list(_RV_MERCHANTS.keys())
        fig3 = go.Figure(go.Bar(
            y=merch_names[::-1], x=merch_vals[::-1],
            orientation="h", marker_color="#9999E8",
            text=[f"${v:.1f}K" for v in merch_vals[::-1]],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"),
            cliponaxis=False,
        ))
        layout3 = small_layout("Top Merchants by Earnings", x_prefix="$", x_suffix="K")
        layout3["margin"] = dict(l=10, r=85, t=40, b=30)
        layout3["yaxis"]["gridcolor"] = "rgba(0,0,0,0)"
        fig3.update_layout(**layout3)
        fig3.update_xaxes(range=[0, max(merch_vals) * 1.28])
        st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)

    with r2c2:
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        rate_keys = list(_RV_RATES.keys())
        rate_vals = list(_RV_RATES.values())
        fig4 = go.Figure(go.Bar(
            y=rate_keys[::-1], x=rate_vals[::-1],
            orientation="h", marker_color="#86EFAC",
            text=[f"{v:.2%}" for v in rate_vals[::-1]],
            textposition="outside", textfont=dict(size=9, color="#6E6E73"),
            cliponaxis=False,
        ))
        layout4 = small_layout("Rate by Transaction Type", x_suffix="%")
        layout4["margin"] = dict(l=10, r=60, t=40, b=30)
        layout4["yaxis"]["gridcolor"] = "rgba(0,0,0,0)"
        layout4["xaxis"]["tickformat"] = ".2%"
        fig4.update_layout(**layout4)
        fig4.update_xaxes(range=[0, max(rate_vals) * 1.35])
        st.plotly_chart(fig4, use_container_width=True, config={"displayModeBar": False})
        st.markdown("</div>", unsafe_allow_html=True)


# ── Placeholder for unbuilt pages ─────────────────────────────────────────────
def show_placeholder(name):
    st.markdown(f'<div class="page-heading">{name}</div>', unsafe_allow_html=True)
    st.markdown(
        f'<div style="color:#9CA3AF;font-size:0.95rem;">The {name} section is coming soon.</div>',
        unsafe_allow_html=True,
    )


# ── Router ─────────────────────────────────────────────────────────────────────
if page == "Home":
    show_home()
elif page == "Connections":
    show_connections()
elif page == "Merchants":
    show_merchants()
elif page == "Insights":
    show_insights()
elif page == "Benchmarks":
    show_benchmarks()
elif page == "Revshare":
    show_revshare()
else:
    show_placeholder(page)

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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
#MainMenu, footer, header   { visibility: hidden; }
.block-container {
    padding-top: 0 !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
    max-width: 100% !important;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] { background: #ffffff !important; border-right: 1px solid #F0F0F5; }
[data-testid="stSidebar"] > div:first-child { padding: 1.5rem 1rem 1rem 1rem; }
.nav-logo { font-size: 1.4rem; font-weight: 700; color: #5B5BD6; margin-bottom: 1.5rem; letter-spacing: -0.03em; }

/* Radio → nav items */
[data-testid="stSidebar"] [data-testid="stRadio"] > div:first-child { display: none; }
[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] {
    display: flex; flex-direction: column; gap: 2px;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] {
    padding: 0.5rem 0.75rem !important; border-radius: 8px; cursor: pointer;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] > div:first-child { display: none !important; }
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"] > div:last-child p {
    font-size: 0.875rem !important; font-weight: 500 !important; color: #6B7280 !important; margin: 0 !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:has(input:checked) { background: #EDEDFC !important; }
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:has(input:checked) > div:last-child p {
    color: #5B5BD6 !important; font-weight: 600 !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [data-baseweb="radio"]:not(:has(input:checked)):hover { background: #F5F5F8 !important; }

.nav-divider { border: none; border-top: 1px solid #F0F0F5; margin: 1rem 0; }
.feedback-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: #F5F5F8; border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 0.45rem 0.85rem; font-size: 0.8rem; color: #6B7280;
}

/* ── Top bar ── */
.topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.9rem 0 1.1rem 0; border-bottom: 1px solid #F0F0F5;
    margin-bottom: 1.75rem; color: #6B7280; font-size: 0.875rem;
}
.topbar-right { display: flex; align-items: center; gap: 1rem; }
.toggle-pill {
    display: inline-flex; align-items: center; gap: 0.4rem;
    background: #F5F5F8; border: 1px solid #E5E7EB; border-radius: 20px;
    padding: 0.3rem 0.85rem; font-size: 0.78rem; color: #6B7280;
}
.avatar {
    width: 30px; height: 30px; border-radius: 50%; background: #5B5BD6;
    color: white; display: inline-flex; align-items: center;
    justify-content: center; font-size: 0.75rem; font-weight: 600;
}

/* ── Home ── */
.greeting { font-size: 1.85rem; font-weight: 700; color: #111827; }
.active-badge {
    display: inline-flex; align-items: center; gap: 0.4rem;
    background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D;
    border-radius: 20px; padding: 0.3rem 0.85rem; font-size: 0.8rem; font-weight: 500; white-space: nowrap;
}
.dot-green { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; display: inline-block; }
.subtitle { color: #9CA3AF; font-size: 0.875rem; margin-bottom: 1.75rem; }
.section-title {
    font-size: 0.82rem; font-weight: 500; color: #9CA3AF;
    letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.75rem;
}
.shortcut-card {
    background: #F8F8FB; border: 1px solid #EBEBF5; border-radius: 14px; padding: 1.75rem 1rem; text-align: center;
}
.shortcut-icon-wrap {
    width: 48px; height: 48px; background: #DDDDF7; border-radius: 50%;
    margin: 0 auto 0.85rem auto; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
}
.shortcut-label { font-size: 0.875rem; color: #374151; font-weight: 500; }
.section-divider { border: none; border-top: 1px solid #F0F0F5; margin: 1.5rem 0 1.25rem 0; }
.perf-title { font-size: 1rem; font-weight: 600; color: #111827; }
.info-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; border: 1px solid #D1D5DB;
    color: #9CA3AF; font-size: 0.65rem; font-weight: 600; margin-left: 0.35rem; vertical-align: middle;
}
.chart-card { background: white; border: 1px solid #F0F0F5; border-radius: 14px; padding: 1.25rem 1.25rem 0.5rem 1.25rem; }
.chart-card-title { font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem; }
.kpi-card {
    background: #5B5BD6; border-radius: 14px; padding: 1.75rem 1.5rem;
    color: white; min-height: 220px; display: flex; flex-direction: column; justify-content: center;
}
.kpi-label { font-size: 0.78rem; opacity: 0.8; margin-bottom: 0.65rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-value { font-size: 1.9rem; font-weight: 700; margin-bottom: 0.65rem; line-height: 1.1; }
.kpi-delta { font-size: 0.8rem; opacity: 0.8; }

/* ── Merchants ── */
.page-heading { font-size: 1.85rem; font-weight: 700; color: #111827; margin-bottom: 1.25rem; }
.tab-bar { display: flex; border-bottom: 1px solid #F0F0F5; margin-bottom: 1.25rem; }
.tab-item {
    font-size: 0.875rem; font-weight: 500; color: #9CA3AF;
    padding: 0.6rem 0.25rem; margin-right: 1.5rem; cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab-item.active { color: #5B5BD6; border-bottom-color: #5B5BD6; font-weight: 600; }
.merchant-card {
    background: white; border: 1px solid #EBEBF5; border-radius: 14px;
    padding: 1.25rem; margin-bottom: 0.75rem; min-height: 135px;
}
.merchant-logo {
    width: 52px; height: 52px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700; flex-shrink: 0;
}
.merchant-name { font-size: 0.95rem; font-weight: 600; color: #111827; margin-bottom: 0.5rem; }
.sector-tag {
    display: inline-block; background: #F5F5F8; border: 1px solid #EBEBF5;
    border-radius: 20px; padding: 0.2rem 0.65rem; font-size: 0.75rem; color: #6B7280; font-weight: 500;
}
.no-results { color: #9CA3AF; text-align: center; padding: 3rem 0; font-size: 0.95rem; }

/* ── Inputs ── */
[data-testid="stTextInput"] > div > div > input {
    border-radius: 8px !important; border: 1px solid #E5E7EB !important;
    font-size: 0.875rem !important; padding: 0.5rem 0.75rem !important;
}
[data-testid="stSelectbox"] > div > div {
    background: white; border: 1px solid #E5E7EB; border-radius: 8px;
    font-size: 0.8rem; color: #374151; padding: 0.15rem 0.5rem;
}
</style>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
NAV_MAP  = {
    "🏠  Home":       "Home",
    "⚙️  Merchants":  "Merchants",
    "📊  Insights":   "Insights",
    "📋  Benchmarks": "Benchmarks",
    "↔️  Revshare":   "Revshare",
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

    # Search
    search = st.text_input("", placeholder="🔍  Search merchants", key="merch_search", label_visibility="collapsed")

    # Filter row
    f_col, gap_col, req_col = st.columns([2, 5, 2])
    with f_col:
        if st.button("≡  Add filters  ▾", key="toggle_filters"):
            st.session_state.show_filters = not st.session_state.show_filters
    with gap_col:
        if not st.session_state.show_filters:
            st.markdown(
                '<div style="color:#9CA3AF;font-size:0.8rem;padding-top:0.55rem;">No filters applied</div>',
                unsafe_allow_html=True,
            )
    with req_col:
        st.button("⊕  Request integration", key="req_int")

    # Filter panel
    sel_countries, sel_sectors = [], []
    if st.session_state.show_filters:
        fc1, fc2, _ = st.columns([2, 2, 4])
        with fc1:
            sel_countries = st.multiselect("Country", COUNTRIES, key="f_country", placeholder="All countries")
        with fc2:
            sel_sectors = st.multiselect("Sector", SECTORS, key="f_sector", placeholder="All sectors")

    st.markdown("<div style='margin-top:0.75rem;'></div>", unsafe_allow_html=True)

    # Filter logic
    filtered = [
        m for m in MERCHANTS
        if (not search        or search.lower() in m["name"].lower())
        and (not sel_countries or m["country"] in sel_countries)
        and (not sel_sectors   or m["sector"]  in sel_sectors)
    ]

    if not filtered:
        st.markdown('<div class="no-results">No merchants found.</div>', unsafe_allow_html=True)
        return

    # 3-column card grid
    for i in range(0, len(filtered), 3):
        row  = filtered[i:i + 3]
        cols = st.columns(3)
        for col, m in zip(cols, row):
            with col:
                st.markdown(f"""
                <div class="merchant-card">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.85rem;">
                        <div class="merchant-logo" style="background:{m['color']};color:{m['tc']};">
                            {m['init']}
                        </div>
                        <span style="color:#D1D5DB;font-size:0.9rem;cursor:pointer;margin-top:2px;">ⓘ</span>
                    </div>
                    <div class="merchant-name">{m['name']}</div>
                    <div class="sector-tag">{m['sector']}</div>
                </div>""", unsafe_allow_html=True)


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

    def chart_layout(title, height=380):
        return dict(
            title=dict(text=title, font=dict(size=13, color="#374151", family="Inter"), x=0),
            height=height,
            margin=dict(l=45, r=20, t=55, b=45),
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
            textfont=dict(size=9, color="#374151"),
            cliponaxis=False,
        ))
        fig1.update_layout(**chart_layout("Total TPV"), showlegend=False)
        fig1.update_yaxes(range=[0, max(df["total"]) * 1.22])
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
        # Invisible bar to show total labels on top
        fig2.add_trace(go.Bar(
            x=x_vals, y=df["total"],
            marker_color="rgba(0,0,0,0)",
            text=[f"${v:.1f}M" for v in df["total"]],
            textposition="outside",
            textfont=dict(size=9, color="#374151"),
            showlegend=False, hoverinfo="skip",
            cliponaxis=False,
        ))
        layout2 = chart_layout("Total TVP by Payment Method")
        layout2.update(
            barmode="stack",
            legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="left", x=0, font=dict(size=11)),
        )
        fig2.update_layout(**layout2)
        fig2.update_yaxes(range=[0, max(df["total"]) * 1.22])
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
            title=dict(text=title, font=dict(size=13, color="#374151", family="Inter"), x=0),
            height=400,
            margin=dict(l=50, r=20, t=65, b=45),
            paper_bgcolor="white", plot_bgcolor="white",
            barmode="group",
            bargap=0.25, bargroupgap=0.05,
            legend=dict(orientation="h", yanchor="bottom", y=1.06, xanchor="left", x=0, font=dict(size=11)),
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
            textposition="outside", textfont=dict(size=9, color="#374151"),
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
            textinfo="label+percent",
            textfont=dict(size=11, family="Inter"),
            hovertemplate="<b>%{label}</b><br>$%{value:.1f}K<br>%{percent}<extra></extra>",
        ))
        fig2.update_layout(
            height=260, margin=dict(l=0, r=0, t=40, b=0),
            paper_bgcolor="white", showlegend=False, font=dict(family="Inter"),
            title=dict(text="Earnings by Payment Method", font=dict(size=12, color="#374151"), x=0),
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
            textposition="outside", textfont=dict(size=9, color="#374151"),
            cliponaxis=False,
        ))
        layout3 = small_layout("Top Merchants by Earnings", x_prefix="$", x_suffix="K")
        layout3["margin"] = dict(l=10, r=60, t=40, b=30)
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
            textposition="outside", textfont=dict(size=9, color="#374151"),
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

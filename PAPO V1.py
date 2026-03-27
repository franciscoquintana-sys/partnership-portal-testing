import streamlit as st
import streamlit.components.v1 as components
import plotly.graph_objects as go
import pandas as pd
import base64 as _b64

try:
    _LOGO_B64 = _b64.b64encode(open("/Users/danielareyes/Desktop/Assignment-claude/Yuno logo.png","rb").read()).decode()
except:
    _LOGO_B64 = ""

try:
    _DANIELA_B64 = _b64.b64encode(open("/Users/danielareyes/Desktop/Assignment-claude/daniela.png","rb").read()).decode()
except:
    _DANIELA_B64 = ""

# ── Page Config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="PAPO · Yuno Partner Portal",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Session State ──────────────────────────────────────────────────────────────
for k, v in [("role", None), ("page", "Pipeline"), ("cat_filter", "all"), ("insight_tab", "market")]:
    if k not in st.session_state:
        st.session_state[k] = v

# Sync page from URL query params on first load
_qp = st.query_params
if "role" in _qp and st.session_state.role is None:
    if _qp["role"] in ("internal", "partner"):
        st.session_state.role = _qp["role"]
if "page" in _qp:
    valid_pages = {"Pipeline","Partners","Contacts","Performance","Insights"}
    if _qp["page"] in valid_pages:
        st.session_state.page = _qp["page"]

# ── Data ───────────────────────────────────────────────────────────────────────
PARTNERS_DATA = [
    {"name":"Adyen",            "type":"PSP",        "region":"Global · LATAM",      "status":"Live",        "tpv":"$890M", "auth":"92.4%","logo":"AD","color":"#3b82f6","cat":"PSP"},
    {"name":"Nuvei",            "type":"PSP",        "region":"BR · MX · COL",        "status":"Live",        "tpv":"$310M", "auth":"87.1%","logo":"NV","color":"#a855f7","cat":"PSP"},
    {"name":"Stripe",           "type":"PSP",        "region":"MX · CO",              "status":"Live",        "tpv":"$120M", "auth":"91.8%","logo":"ST","color":"#a855f7","cat":"PSP"},
    {"name":"Getnet (Santander)","type":"Acquirer",  "region":"Brazil",               "status":"Live",        "tpv":"$440M", "auth":"89.6%","logo":"GN","color":"#3b82f6","cat":"Acquirer"},
    {"name":"Kushki",           "type":"Acquirer",   "region":"COL · MX · EC · PE",   "status":"Live",        "tpv":"$280M", "auth":"88.2%","logo":"KU","color":"#3b82f6","cat":"Acquirer"},
    {"name":"Cielo",            "type":"Acquirer",   "region":"Brazil",               "status":"Live",        "tpv":"$520M", "auth":"86.9%","logo":"CI","color":"#3b82f6","cat":"Acquirer"},
    {"name":"Conekta",          "type":"Acquirer",   "region":"Mexico",               "status":"Integration", "tpv":"—",     "auth":"—",    "logo":"CN","color":"#3b82f6","cat":"Acquirer"},
    {"name":"Prosa",            "type":"Acquirer",   "region":"Mexico",               "status":"Live",        "tpv":"$190M", "auth":"90.1%","logo":"PR","color":"#3b82f6","cat":"Acquirer"},
    {"name":"OpenPix",          "type":"APM",        "region":"Brazil (PIX)",         "status":"Live",        "tpv":"$210M", "auth":"99.1%","logo":"OP","color":"#14b8a6","cat":"APM"},
    {"name":"MercadoPago",      "type":"APM",        "region":"MX · AR · BR · COL",   "status":"Live",        "tpv":"$380M", "auth":"97.4%","logo":"MP","color":"#14b8a6","cat":"APM"},
    {"name":"Rappi Pay",        "type":"APM",        "region":"COL · MX · BR",        "status":"Integration", "tpv":"—",     "auth":"—",    "logo":"RP","color":"#14b8a6","cat":"APM"},
    {"name":"Khipu",            "type":"APM",        "region":"Chile",                "status":"Live",        "tpv":"$45M",  "auth":"98.2%","logo":"KH","color":"#14b8a6","cat":"APM"},
    {"name":"Yape",             "type":"APM",        "region":"Peru",                 "status":"Live",        "tpv":"$38M",  "auth":"97.8%","logo":"YP","color":"#14b8a6","cat":"APM"},
    {"name":"OXXO Pay",         "type":"APM",        "region":"Mexico (Cash)",        "status":"Live",        "tpv":"$72M",  "auth":"99.5%","logo":"OX","color":"#14b8a6","cat":"APM"},
    {"name":"SEON",             "type":"Fraud",      "region":"Global",               "status":"Live",        "tpv":"N/A",   "auth":"N/A",  "logo":"SN","color":"#ef4444","cat":"Fraud"},
    {"name":"Truora",           "type":"Fraud / KYC","region":"COL · MX · BR",        "status":"Integration", "tpv":"N/A",   "auth":"N/A",  "logo":"TR","color":"#ef4444","cat":"Fraud"},
    {"name":"Kount (Equifax)",  "type":"Fraud",      "region":"Global",               "status":"Prospect",    "tpv":"N/A",   "auth":"N/A",  "logo":"KT","color":"#ef4444","cat":"Fraud"},
    {"name":"Pomelo",           "type":"BaaS",       "region":"AR · MX · COL",        "status":"Prospect",    "tpv":"—",     "auth":"—",    "logo":"PM","color":"#f59e0b","cat":"BaaS"},
    {"name":"Stori",            "type":"BaaS",       "region":"Mexico",               "status":"Prospect",    "tpv":"—",     "auth":"—",    "logo":"SO","color":"#f59e0b","cat":"BaaS"},
    {"name":"Bnext",            "type":"BaaS",       "region":"MX · COL",             "status":"Prospect",    "tpv":"—",     "auth":"—",    "logo":"BN","color":"#f59e0b","cat":"BaaS"},
    {"name":"Minka",            "type":"BaaS",       "region":"Colombia",             "status":"Integration", "tpv":"—",     "auth":"—",    "logo":"MK","color":"#f59e0b","cat":"BaaS"},
]

CAT_CLASS   = {"PSP":"cat-psp","Acquirer":"cat-acquirer","APM":"cat-apm","Fraud":"cat-fraud","Fraud / KYC":"cat-fraud","BaaS":"cat-baas"}
STATUS_CLASS = {"Live":"p-green","Integration":"p-blue","Prospect":"p-amber","In Dev":"p-purple"}

PIPELINE_STAGES = {
    "Prospect":    {"color":"#8a8a99","count":3},
    "Qualified":   {"color":"#60a5fa","count":3},
    "Evaluation":  {"color":"#c084fc","count":4},
    "Negotiation": {"color":"#fbbf24","count":2},
    "Won":         {"color":"#4ade80","count":2},
}

CONTACTS = [
    {"init":"TK","bg":"rgba(59,130,246,.2)","color":"#60a5fa","name":"Tom Kuehn","role":"Head of LATAM Partnerships","company":"Adyen · PSP","badge":"Champion","badge_class":"p-green","last":"2d ago","rel":"★★★★★","deals":"3 active"},
    {"init":"RV","bg":"rgba(168,85,247,.2)","color":"#c084fc","name":"Ricardo Vega","role":"VP Business Development","company":"Nuvei · PSP","badge":"Warm","badge_class":"p-amber","last":"5h ago","rel":"★★★★☆","deals":"1 active"},
    {"init":"AP","bg":"rgba(20,184,166,.2)","color":"#2dd4bf","name":"Ana Pacheco","role":"Strategic Partnerships Director","company":"Kushki · Acquirer","badge":"Active","badge_class":"p-blue","last":"1w ago","rel":"★★★★☆","deals":"2 active"},
    {"init":"FM","bg":"rgba(245,158,11,.2)","color":"#fbbf24","name":"Felipe Morales","role":"Head of Digital Products","company":"Getnet · Acquirer (Santander)","badge":"Executive Sponsor","badge_class":"p-green","last":"Today","rel":"★★★★★","deals":"1 at Negotiation"},
    {"init":"DH","bg":"rgba(239,68,68,.2)","color":"#fca5a5","name":"Diana Herrera","role":"Fraud Partnerships Lead","company":"SEON · Fraud & Risk","badge":"Live Partner","badge_class":"p-green","last":"3d ago","rel":"★★★★☆","deals":"Integration live"},
    {"init":"MC","bg":"rgba(245,158,11,.2)","color":"#fde68a","name":"Martín Castillo","role":"CEO & Co-Founder","company":"Pomelo · BaaS","badge":"New Vertical","badge_class":"p-amber","last":"Yesterday","rel":"★★★☆☆","deals":"1 at Evaluation"},
]

# ── CSS ─────────────────────────────────────────────────────────────────────────
_STATIC_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
:root {
  --bg:#09090b; --bg2:#111114; --bg3:#18181c; --bg4:#1f1f25; --bg5:#27272f;
  --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.13);
  --text:#f0f0f4; --text2:#8a8a99; --text3:#4a4a5a;
  --yuno:#ff5c1a; --yuno2:#d44410;
  --blue:#3b82f6; --green:#22c55e; --red:#ef4444; --amber:#f59e0b;
  --purple:#a855f7; --teal:#14b8a6;
  --font:'Plus Jakarta Sans',sans-serif; --mono:'Geist Mono',monospace;
}
html,body,[class*="css"] {
  font-family:var(--font) !important;
  background-color:var(--bg) !important;
  color:var(--text) !important;
}
#MainMenu,footer,header { visibility:hidden; }
.block-container { padding-top:2rem !important; padding-bottom:2rem !important; padding-left:2rem !important; padding-right:2rem !important; max-width:100% !important; background:var(--bg) !important; }
[data-testid="stAppViewContainer"] > section:nth-child(2) { background:var(--bg) !important; }
[data-testid="stSidebar"] { background:var(--bg2) !important; border-right:1px solid var(--border) !important; }
[data-testid="stSidebar"] > div:first-child { padding:0 !important; }
/* Role toggle buttons (inside columns in sidebar) */
[data-testid="stSidebar"] [data-testid="column"] [data-testid="stButton"] > button {
  border-radius:20px !important; border:none !important; font-size:11.5px !important; font-weight:600 !important; padding:7px 12px !important;
}
[data-testid="stSidebar"] [data-testid="column"] [data-testid="stButton"] > button[data-testid="baseButton-primary"] {
  background:#ff5c1a !important; color:#fff !important;
}
[data-testid="stSidebar"] [data-testid="column"] [data-testid="stButton"] > button[data-testid="baseButton-secondary"] {
  background:transparent !important; color:#6b7280 !important;
}
/* Nav buttons (sidebar buttons NOT in columns) */
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] > div > [data-testid="stButton"] > button {
  background:transparent !important; border:none !important; color:#8a8a99 !important;
  text-align:left !important; justify-content:flex-start !important; border-radius:6px !important;
  font-size:12.5px !important; font-weight:500 !important; padding:9px 12px !important;
  display:flex !important; align-items:center !important; width:100% !important;
}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] > div > [data-testid="stButton"] > button:hover {
  background:#18181c !important; color:#f0f0f4 !important;
}
[data-testid="stSidebar"] button[data-nav-active="true"] {
  background:rgba(255,92,26,0.08) !important; border-left:3px solid #ff5c1a !important;
  border-radius:0 6px 6px 0 !important; color:#f0f0f4 !important; font-weight:600 !important; padding-left:9px !important;
}
[data-testid="stSidebar"] button[data-badge]::after {
  content:attr(data-badge); margin-left:auto; font-size:10px; font-family:monospace;
  background:#1f1f25; color:#8a8a99; padding:2px 7px; border-radius:10px; flex-shrink:0;
}
[data-testid="stSidebar"] button[data-nav-active="true"][data-badge]::after {
  background:rgba(255,92,26,0.2); color:#ff5c1a;
}
[data-testid="stTextInput"] input { background:var(--bg3) !important; border:1px solid var(--border) !important; color:var(--text) !important; border-radius:7px !important; font-family:var(--font) !important; font-size:12px !important; }
[data-testid="stTextInput"] input::placeholder { color:var(--text3) !important; }
[data-testid="stTextInput"] input:focus { border-color:var(--border2) !important; }
.stButton > button { background:var(--bg3) !important; color:var(--text2) !important; border:1px solid var(--border) !important; border-radius:7px !important; font-family:var(--font) !important; font-weight:500 !important; font-size:11.5px !important; }
.stButton > button:hover { border-color:var(--border2) !important; color:var(--text) !important; }
.pill{display:inline-flex;align-items:center;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;letter-spacing:.2px;white-space:nowrap;}
.p-green{background:rgba(34,197,94,.14);color:#4ade80;}
.p-blue{background:rgba(59,130,246,.14);color:#60a5fa;}
.p-amber{background:rgba(245,158,11,.14);color:#fbbf24;}
.p-red{background:rgba(239,68,68,.14);color:#f87171;}
.p-purple{background:rgba(168,85,247,.14);color:#c084fc;}
.p-teal{background:rgba(20,184,166,.14);color:#2dd4bf;}
.p-grey{background:rgba(107,114,128,.13);color:#9ca3af;}
.cat-acquirer{background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.2);}
.cat-psp{background:rgba(168,85,247,.12);color:#d8b4fe;border:1px solid rgba(168,85,247,.2);}
.cat-apm{background:rgba(20,184,166,.12);color:#5eead4;border:1px solid rgba(20,184,166,.2);}
.cat-fraud{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.2);}
.cat-baas{background:rgba(245,158,11,.12);color:#fde68a;border:1px solid rgba(245,158,11,.2);}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#27272f;border-radius:3px;}
.pipeline-wrap{overflow-x:auto;margin-bottom:20px;padding-bottom:8px;}
.pipeline-board{display:flex;gap:10px;min-width:1000px;align-items:flex-start;}
.stage-col{background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;width:198px;flex-shrink:0;overflow:hidden;}
.stage-head{padding:9px 12px;background:#18181c;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;}
.stage-name{font-size:9.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;}
.stage-num{font-size:10px;font-family:monospace;background:#1f1f25;color:#8a8a99;padding:2px 7px;border-radius:10px;}
.pcard{margin:7px;padding:10px 11px;background:#18181c;border:1px solid rgba(255,255,255,0.07);border-radius:8px;cursor:pointer;transition:border-color .12s;}
.pcard:hover{border-color:rgba(255,255,255,0.13);}
.pcard-name{font-size:12px;font-weight:600;margin-bottom:4px;color:#f0f0f4;}
.pcard-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:5px;}
.pcard-val{font-family:monospace;font-size:10.5px;color:#8a8a99;}
.pcard-owner{display:flex;align-items:center;gap:5px;font-size:10px;color:#4a4a5a;margin-top:6px;}
.mini-av{width:15px;height:15px;border-radius:50%;font-size:7px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
.ma-y{background:rgba(255,92,26,0.25);color:#ff5c1a;}
.ma-e{background:rgba(59,130,246,0.25);color:#3b82f6;}
.pbar{height:3px;background:#1f1f25;border-radius:2px;margin-top:8px;overflow:hidden;}
.pfill{height:100%;border-radius:2px;}
"""

_LANDING_CSS = """
[data-testid="stSidebar"] { display: none !important; }
[data-testid="collapsedControl"] { display: none !important; }
.stApp, section[data-testid="stMain"], .main, .block-container { background: #09090b !important; }
.main .block-container { max-width: 100% !important; padding: 0 !important; }
div[data-testid="column"] { padding: 0 6px !important; }
div[data-testid="stVerticalBlock"] { gap: 0 !important; }
div[data-testid="stVerticalBlockBorderWrapper"] { gap: 0 !important; }
div[data-testid="stButton"] { margin-top: -1px !important; }
div[data-testid="stButton"] button {
  border-radius: 0 0 12px 12px !important; border: none !important;
  font-size: 11px !important; font-weight: 600 !important;
  padding: 10px 16px !important; width: 100% !important;
  background: #4F46E5 !important; color: #fff !important;
}
div[data-testid="stButton"] button:hover { opacity: 0.88 !important; }
"""

def inject_css(role):
    css = _STATIC_CSS + ("" if role else _LANDING_CSS)
    escaped = css.replace('\\', '\\\\').replace('`', '\\`')
    if not role:
        btn_js = """
setTimeout(function(){
  var b=window.parent.document.querySelectorAll('button[data-testid="baseButton-secondary"]');
  if(b[0]){b[0].style.cssText+='background:rgba(255,255,255,.2)!important;color:#fff!important;';}
  if(b[1]){b[1].style.cssText+='background:#4F46E5!important;color:#fff!important;';}
},300);"""
    else:
        current_page = st.session_state.get('page', 'Pipeline')
        btn_js = f"""
setTimeout(function(){{
  var pageToLabel={{'Pipeline':'Pipeline','Partners':'Partner Directory','Contacts':'Key Contacts','Performance':'Performance','Insights':'Insights'}};
  var labelBadge={{'Pipeline':'24','Partner Directory':'47','Key Contacts':'86','Performance':'','Insights':''}};
  var activeLabel=pageToLabel['{current_page}']||'Pipeline';
  var sidebar=window.parent.document.querySelector('[data-testid="stSidebar"]');
  if(!sidebar)return;
  sidebar.querySelectorAll('button').forEach(function(btn){{
    var text=btn.textContent.trim();
    var found=Object.keys(labelBadge).find(function(k){{return text.includes(k);}});
    if(!found)return;
    var badge=labelBadge[found];
    var isActive=found===activeLabel;
    if(badge)btn.setAttribute('data-badge',badge);
    btn.setAttribute('data-nav-active',isActive?'true':'false');
  }});
}},400);"""
    components.html(
        f"<script>var old=window.parent.document.getElementById('papo-css');if(old)old.remove();var s=window.parent.document.createElement('style');s.id='papo-css';s.textContent=`{escaped}`;window.parent.document.head.appendChild(s);{btn_js}</script>",
        height=0,
    )

# ── Landing Page ───────────────────────────────────────────────────────────────
def show_landing():
    LOGO = _LOGO_B64
    st.markdown(f"""
<div style="text-align:center;padding:36px 24px 20px;position:relative;overflow:hidden;">
  <div style="position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(79,70,229,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(79,70,229,.04) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%);z-index:0;"></div>
  <div style="position:fixed;top:0;left:50%;transform:translateX(-50%);width:700px;height:500px;pointer-events:none;background:radial-gradient(ellipse,rgba(79,70,229,.12) 0%,transparent 70%);z-index:0;"></div>
  <div style="position:relative;z-index:1;">
    <img src="data:image/png;base64,{LOGO}" style="height:200px;object-fit:contain;margin-bottom:16px;">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.8px;line-height:1.2;margin-bottom:8px;color:#f0f0f4;">Welcome to the<br><span style="color:#4F46E5;">Partner Portal</span></div>
    <p style="font-size:12.5px;color:#8a8a99;line-height:1.6;max-width:400px;margin:0 auto 28px;">Your unified workspace for managing the Yuno partner ecosystem.</p>
  </div>
</div>
""", unsafe_allow_html=True)

    _, col1, col2, _ = st.columns([1.5, 2, 2, 1.5])

    with col1:
        st.markdown("""
<div style="background:#4F46E5;border:1.5px solid #4F46E5;border-radius:14px 14px 0 0;padding:20px 20px 14px;text-align:left;">
  <div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:12px;">⚡</div>
  <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:5px;">Yuno A-Team</div>
  <div style="font-size:11px;color:rgba(255,255,255,.75);line-height:1.55;margin-bottom:12px;">Internal BD, partnerships &amp; strategy. Full access including confidential intel and internal pipeline notes.</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;font-family:monospace;">Full pipeline</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;font-family:monospace;">Internal notes</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;font-family:monospace;">Revenue intel</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;font-family:monospace;">Strategy</span>
  </div>
</div>
""", unsafe_allow_html=True)
        if st.button("Enter as Yuno A-Team  →", key="btn_internal", use_container_width=True):
            st.session_state.role = "internal"
            st.query_params["role"] = "internal"
            st.query_params["page"] = st.session_state.page
            st.rerun()

    with col2:
        st.markdown("""
<div style="background:#fff;border:1.5px solid rgba(79,70,229,.25);border-radius:14px 14px 0 0;padding:20px 20px 14px;text-align:left;">
  <div style="width:38px;height:38px;border-radius:10px;background:rgba(79,70,229,.1);display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:12px;">◈</div>
  <div style="font-size:14px;font-weight:700;color:#09090b;margin-bottom:5px;">Partner BD</div>
  <div style="font-size:11px;color:#555;line-height:1.55;margin-bottom:12px;">External partner team — acquirers, PSPs, APMs, fraud or BaaS providers. View pipeline &amp; performance metrics.</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(79,70,229,.12);color:#4F46E5;font-family:monospace;">Shared pipeline</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(79,70,229,.12);color:#4F46E5;font-family:monospace;">Performance</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(79,70,229,.12);color:#4F46E5;font-family:monospace;">Your contacts</span>
    <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(79,70,229,.12);color:#4F46E5;font-family:monospace;">Insights</span>
  </div>
</div>
""", unsafe_allow_html=True)
        if st.button("Enter as Partner BD  →", key="btn_partner", use_container_width=True):
            st.session_state.role = "partner"
            st.query_params["role"] = "partner"
            st.query_params["page"] = st.session_state.page
            st.rerun()


# ── Sidebar ────────────────────────────────────────────────────────────────────
def show_sidebar():
    is_internal = st.session_state.role == "internal"
    role_label = "INTERNAL" if is_internal else "PARTNER"
    role_bg = "rgba(79,70,229,0.18)" if is_internal else "rgba(255,92,26,0.18)"
    role_color = "#4F46E5" if is_internal else "#ff5c1a"

    with st.sidebar:
        # Logo header — actual Yuno logo, purple "yuno" text, role badge
        st.markdown(f"""
<div style="padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:10px;">
  <img src="data:image/png;base64,{_LOGO_B64}" style="height:34px;object-fit:contain;flex-shrink:0;">
  <div>
    <div style="font-size:17px;font-weight:700;letter-spacing:-0.5px;color:#4F46E5;line-height:1.1;">yuno</div>
    <div style="font-size:9px;font-weight:700;background:{role_bg};color:{role_color};padding:2px 8px;border-radius:20px;letter-spacing:0.6px;text-transform:uppercase;font-family:monospace;display:inline-block;margin-top:2px;">{role_label}</div>
  </div>
</div>
""", unsafe_allow_html=True)

        # WORKSPACE nav
        st.markdown('<div style="padding:20px 4px 4px;font-size:9px;font-weight:700;letter-spacing:1.1px;color:#4a4a5a;text-transform:uppercase;">Workspace</div>', unsafe_allow_html=True)

        NAV = [
            ("Pipeline",    "⟳  Pipeline"),
            ("Partners",    "◈  Partner Directory"),
            ("Contacts",    "◉  Key Contacts"),
            ("Performance", "▲  Performance"),
            ("Insights",    "◎  Insights"),
        ]
        for page_key, label in NAV:
            if st.button(label, key=f"nav_{page_key}", use_container_width=True,
                         type="secondary"):
                st.session_state.page = page_key
                st.query_params["page"] = page_key
                st.query_params["role"] = st.session_state.role
                st.rerun()

        # User footer
        st.markdown("<br>" * 3, unsafe_allow_html=True)
        if is_internal:
            user_html = f"""
<div style="border-top:1px solid rgba(255,255,255,0.07);padding:14px 4px 6px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="data:image/png;base64,{_DANIELA_B64}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">
    <div><div style="font-size:12.5px;font-weight:600;color:#f0f0f4;">Daniela Reyes</div><div style="font-size:10px;color:#4a4a5a;">Head of Partnerships · Yuno</div></div>
  </div>
</div>"""
        else:
            user_html = """
<div style="border-top:1px solid rgba(255,255,255,0.07);padding:14px 4px 6px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,0.2);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">TK</div>
    <div><div style="font-size:12.5px;font-weight:600;color:#f0f0f4;">Tom Kuehn</div><div style="font-size:10px;color:#4a4a5a;">LATAM Partnerships · Adyen</div></div>
  </div>
</div>"""
        st.markdown(user_html, unsafe_allow_html=True)

# ── Stat Row ───────────────────────────────────────────────────────────────────
def stat_row(stats):
    cols = st.columns(len(stats))
    for col, s in zip(cols, stats):
        highlight = "border-color:rgba(255,92,26,0.3);background:rgba(255,92,26,0.05);" if s.get("highlight") else ""
        val_color = f"color:{s.get('val_color','#f0f0f4')};" if s.get("val_color") else ""
        delta_color = {"up":"#22c55e","down":"#ef4444","flat":"#4a4a5a"}.get(s.get("delta_type","flat"), "#4a4a5a")
        col.markdown(f"""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;{highlight}">
  <div style="font-size:9.5px;color:#8a8a99;letter-spacing:0.6px;text-transform:uppercase;font-weight:600;margin-bottom:5px;">{s['label']}</div>
  <div style="font-size:20px;font-weight:700;font-family:monospace;letter-spacing:-1px;line-height:1;{val_color}">{s['value']}</div>
  <div style="font-size:10.5px;margin-top:5px;color:{delta_color};">{s['delta']}</div>
</div>""", unsafe_allow_html=True)

# ── Pipeline View ──────────────────────────────────────────────────────────────
def show_pipeline():
    is_internal = st.session_state.role == "internal"

    st.markdown("""
<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.07);">
  <span style="font-size:20px;font-weight:700;color:#f0f0f4;letter-spacing:-0.5px;">Merchant Pipeline</span>
  <span style="font-size:12px;color:#4a4a5a;">24 active opportunities</span>
</div>
""", unsafe_allow_html=True)

    stat_row([
        {"label":"Pipeline Value","value":"$4.2M","delta":"↑ 18% vs last qtr","delta_type":"up","highlight":True,"val_color":"#ff5c1a"},
        {"label":"Active Deals","value":"24","delta":"↑ 3 this week","delta_type":"up"},
        {"label":"Avg Deal Size","value":"$175K","delta":"→ steady","delta_type":"flat"},
        {"label":"Win Rate","value":"38%","delta":"↑ 4pts QoQ","delta_type":"up"},
    ])

    st.markdown("""
<div style="margin-top:20px;margin-bottom:10px;">
  <span style="font-size:16px;font-weight:700;color:#f0f0f4;letter-spacing:-0.3px;">Deal Board</span>
  <span style="font-size:11px;color:#4a4a5a;margin-left:10px;">Drag to move · Click to open · Internal notes visible to Yuno BD only</span>
</div>
""", unsafe_allow_html=True)

    # Kanban board as HTML (no <style> tag — styles injected via JS already)
    kanban_html = """
<div class="pipeline-wrap">
<div class="pipeline-board">

<!-- Prospect -->
<div class="stage-col">
  <div class="stage-head"><span class="stage-name" style="color:#8a8a99;">Prospect</span><span class="stage-num">6</span></div>
  <div class="pcard"><div class="pcard-name">Mercado Premium</div><div class="pcard-meta"><span class="pill cat-psp">PSP</span><span class="pill p-amber">Warm</span></div><div class="pcard-val">$80K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">SR</span>Sofia R. · via Adyen ref</div><div class="pbar"><div class="pfill" style="width:15%;background:#4a4a5a;"></div></div></div>
  <div class="pcard"><div class="pcard-name">FinPay Colombia</div><div class="pcard-meta"><span class="pill cat-acquirer">Acquirer</span><span class="pill p-blue">Inbound</span></div><div class="pcard-val">$120K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-e">JL</span>Jorge L. · Bancolombia ref</div><div class="pbar"><div class="pfill" style="width:10%;background:#3b82f6;"></div></div></div>
  <div class="pcard"><div class="pcard-name">NeoFin Brazil</div><div class="pcard-meta"><span class="pill cat-baas">BaaS</span><span class="pill p-amber">Pilot</span></div><div class="pcard-val">$200K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">MC</span>Maria C. · Direct</div><div class="pbar"><div class="pfill" style="width:12%;background:#f59e0b;"></div></div></div>
</div>

<!-- Qualified -->
<div class="stage-col">
  <div class="stage-head"><span class="stage-name" style="color:#60a5fa;">Qualified</span><span class="stage-num">5</span></div>
  <div class="pcard"><div class="pcard-name">Rappi Financial</div><div class="pcard-meta"><span class="pill cat-apm">APM</span><span class="pill p-green">Hot</span></div><div class="pcard-val">$350K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">SR</span>Sofia R.</div><div class="pbar"><div class="pfill" style="width:30%;background:#22c55e;"></div></div></div>
  <div class="pcard"><div class="pcard-name">Kushki Integration</div><div class="pcard-meta"><span class="pill cat-acquirer">Acquirer</span><span class="pill p-blue">Active</span></div><div class="pcard-val">$180K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-e">AP</span>Ana P. · Kushki BD</div><div class="pbar"><div class="pfill" style="width:28%;background:#3b82f6;"></div></div></div>
  <div class="pcard"><div class="pcard-name">Truora Risk Suite</div><div class="pcard-meta"><span class="pill cat-fraud">Fraud</span><span class="pill p-purple">Trial</span></div><div class="pcard-val">$95K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">DG</span>Diego G.</div><div class="pbar"><div class="pfill" style="width:25%;background:#a855f7;"></div></div></div>
</div>

<!-- Evaluation -->
<div class="stage-col">
  <div class="stage-head"><span class="stage-name" style="color:#c084fc;">Evaluation</span><span class="stage-num">7</span></div>
  <div class="pcard"><div class="pcard-name">Nuvei LATAM</div><div class="pcard-meta"><span class="pill cat-psp">PSP</span><span class="pill p-green">Hot</span></div><div class="pcard-val">$620K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-e">RV</span>Ricardo V. · Nuvei</div><div class="pbar"><div class="pfill" style="width:55%;background:#a855f7;"></div></div></div>
  <div class="pcard"><div class="pcard-name">OpenPix Brazil</div><div class="pcard-meta"><span class="pill cat-apm">APM</span><span class="pill p-teal">Pix</span></div><div class="pcard-val">$240K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">SR</span>Sofia R.</div><div class="pbar"><div class="pfill" style="width:50%;background:#14b8a6;"></div></div></div>
  <div class="pcard"><div class="pcard-name">Conekta Mexico</div><div class="pcard-meta"><span class="pill cat-acquirer">Acquirer</span><span class="pill p-amber">Stalled</span></div><div class="pcard-val">$310K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-e">LM</span>Luisa M. · Partner</div><div class="pbar"><div class="pfill" style="width:48%;background:#f59e0b;"></div></div></div>
  <div class="pcard"><div class="pcard-name">Pomelo FinTech</div><div class="pcard-meta"><span class="pill cat-baas">BaaS</span><span class="pill p-amber">New</span></div><div class="pcard-val">$440K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">MC</span>Maria C.</div><div class="pbar"><div class="pfill" style="width:42%;background:#f59e0b;"></div></div></div>
</div>

<!-- Negotiation -->
<div class="stage-col">
  <div class="stage-head"><span class="stage-name" style="color:#fbbf24;">Negotiation</span><span class="stage-num">2</span></div>
  <div class="pcard"><div class="pcard-name">Getnet Santander</div><div class="pcard-meta"><span class="pill cat-acquirer">Acquirer</span><span class="pill p-green">High Priority</span></div><div class="pcard-val">$850K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-e">FM</span>Felipe M. · Santander</div><div class="pbar"><div class="pfill" style="width:75%;background:#ff5c1a;"></div></div></div>
  <div class="pcard"><div class="pcard-name">Pagopar Paraguay</div><div class="pcard-meta"><span class="pill cat-apm">APM</span><span class="pill p-blue">Regional</span></div><div class="pcard-val">$110K ARR est.</div><div class="pcard-owner"><span class="mini-av ma-y">DG</span>Diego G.</div><div class="pbar"><div class="pfill" style="width:70%;background:#14b8a6;"></div></div></div>
</div>

<!-- Won -->
<div class="stage-col">
  <div class="stage-head"><span class="stage-name" style="color:#4ade80;">Won</span><span class="stage-num">2</span></div>
  <div class="pcard" style="border-color:rgba(34,197,94,.25);"><div class="pcard-name">Adyen LATAM Ext.</div><div class="pcard-meta"><span class="pill cat-psp">PSP</span><span class="pill p-green">Live</span></div><div class="pcard-val">$1.2M ARR signed</div><div class="pcard-owner"><span class="mini-av ma-e">TK</span>Tom K. · Adyen</div><div class="pbar"><div class="pfill" style="width:100%;background:#22c55e;"></div></div></div>
  <div class="pcard" style="border-color:rgba(34,197,94,.25);"><div class="pcard-name">SEON Fraud Shield</div><div class="pcard-meta"><span class="pill cat-fraud">Fraud</span><span class="pill p-green">Live</span></div><div class="pcard-val">$290K ARR signed</div><div class="pcard-owner"><span class="mini-av ma-y">SR</span>Sofia R.</div><div class="pbar"><div class="pfill" style="width:100%;background:#22c55e;"></div></div></div>
</div>

</div></div>"""
    st.markdown(kanban_html, unsafe_allow_html=True)

    # Bottom row: funnel + activity
    col_funnel, col_activity = st.columns([3, 2])

    with col_funnel:
        st.markdown('<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px;">', unsafe_allow_html=True)
        st.markdown('<div style="font-size:13px;font-weight:700;color:#f0f0f4;margin-bottom:2px;">Pipeline Funnel</div><div style="font-size:11px;color:#4a4a5a;margin-bottom:14px;">Current quarter · all categories</div>', unsafe_allow_html=True)
        funnel_data = [("Prospect",6,100,"#4a4a5a"),("Qualified",5,83,"#374151"),("Evaluation",7,100,"#a855f7"),("Negotiation",4,50,"#f59e0b"),("Won",2,33,"#22c55e")]
        funnel_html = ""
        for label, count, pct, color in funnel_data:
            funnel_html += f"""<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
  <span style="font-size:11px;color:#8a8a99;width:90px;text-align:right;flex-shrink:0;">{label}</span>
  <div style="flex:1;height:24px;background:#18181c;border-radius:4px;overflow:hidden;">
    <div style="width:{pct}%;height:100%;background:{color};display:flex;align-items:center;padding-left:10px;font-size:10px;font-family:monospace;font-weight:600;color:rgba(255,255,255,.85);">{count} deals</div>
  </div>
  <span style="font-size:11px;font-family:monospace;color:#8a8a99;width:20px;">{count}</span>
</div>"""
        st.markdown(funnel_html, unsafe_allow_html=True)

        if is_internal:
            st.markdown("""
<div style="border:1px solid rgba(245,158,11,.22);background:rgba(245,158,11,.04);border-radius:10px;padding:13px 16px;margin-top:16px;">
  <div style="font-size:9.5px;font-weight:700;color:#f59e0b;letter-spacing:.9px;text-transform:uppercase;margin-bottom:10px;">🔒 Internal Yuno Only</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Blended margin (est.)</span><span style="font-family:monospace;color:#f59e0b;">61%</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Committed quota coverage</span><span style="font-family:monospace;color:#f59e0b;">2.4×</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;"><span style="color:#8a8a99;">At-risk deals (&gt;90d stalled)</span><span style="font-family:monospace;color:#f59e0b;">3</span></div>
</div>""", unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col_activity:
        st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px;">
  <div style="font-size:13px;font-weight:700;color:#f0f0f4;margin-bottom:2px;">Recent Activity</div>
  <div style="font-size:11px;color:#4a4a5a;margin-bottom:14px;">Last 48 hours</div>
  <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="width:7px;height:7px;border-radius:50%;background:#22c55e;margin-top:4px;flex-shrink:0;"></div>
    <div><div style="font-size:12px;color:#8a8a99;line-height:1.55;"><strong style="color:#f0f0f4;">Getnet Santander</strong> moved to Negotiation. MSA draft sent.</div><div style="font-size:10px;color:#4a4a5a;font-family:monospace;margin-top:2px;">2h ago · Sofia R.</div></div>
  </div>
  <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="width:7px;height:7px;border-radius:50%;background:#3b82f6;margin-top:4px;flex-shrink:0;"></div>
    <div><div style="font-size:12px;color:#8a8a99;line-height:1.55;"><strong style="color:#f0f0f4;">Nuvei LATAM</strong> technical review call scheduled for Dec 18.</div><div style="font-size:10px;color:#4a4a5a;font-family:monospace;margin-top:2px;">5h ago · Ricardo V.</div></div>
  </div>
  <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="width:7px;height:7px;border-radius:50%;background:#f59e0b;margin-top:4px;flex-shrink:0;"></div>
    <div><div style="font-size:12px;color:#8a8a99;line-height:1.55;"><strong style="color:#f0f0f4;">Pomelo FinTech</strong> added as new BaaS vertical opportunity.</div><div style="font-size:10px;color:#4a4a5a;font-family:monospace;margin-top:2px;">Yesterday · Maria C.</div></div>
  </div>
  <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="width:7px;height:7px;border-radius:50%;background:#ff5c1a;margin-top:4px;flex-shrink:0;"></div>
    <div><div style="font-size:12px;color:#8a8a99;line-height:1.55;"><strong style="color:#f0f0f4;">Adyen LATAM Ext.</strong> integration live. First transaction processed.</div><div style="font-size:10px;color:#4a4a5a;font-family:monospace;margin-top:2px;">Yesterday · Tom K.</div></div>
  </div>
  <div style="display:flex;gap:10px;padding:9px 0;">
    <div style="width:7px;height:7px;border-radius:50%;background:#a855f7;margin-top:4px;flex-shrink:0;"></div>
    <div><div style="font-size:12px;color:#8a8a99;line-height:1.55;"><strong style="color:#f0f0f4;">Truora Risk</strong> trial extended to Jan 15. Positive signal.</div><div style="font-size:10px;color:#4a4a5a;font-family:monospace;margin-top:2px;">2d ago · Diego G.</div></div>
  </div>
</div>""", unsafe_allow_html=True)

# ── Partners View ──────────────────────────────────────────────────────────────
def show_partners():
    st.markdown('<div style="font-size:14px;font-weight:700;color:#f0f0f4;letter-spacing:-0.3px;margin-bottom:4px;">Partner Directory</div>'
                '<div style="font-size:11px;color:#4a4a5a;margin-bottom:16px;">47 partners across 5 categories</div>', unsafe_allow_html=True)

    stat_row([
        {"label":"Total Partners","value":"47","delta":"↑ 6 this quarter","delta_type":"up"},
        {"label":"Live Integrations","value":"31","delta":"→ 66% of total","delta_type":"flat"},
        {"label":"In Development","value":"11","delta":"↑ 3 new","delta_type":"up"},
        {"label":"Avg Integration","value":"42d","delta":"↓ 5d faster","delta_type":"down"},
        {"label":"BaaS Pipeline","value":"4","delta":"★ New vertical","delta_type":"up","highlight":True,"val_color":"#f59e0b"},
    ])

    # Filters
    search = st.text_input("", placeholder="⌕  Search partners...", key="partner_search_input", label_visibility="collapsed")
    cats   = ["All","Acquirers","PSPs","APMs","Fraud & Risk","BaaS","🟢 Live only"]
    cat_cols = st.columns(len(cats))
    for i, (col, cat) in enumerate(zip(cat_cols, cats)):
        if col.button(cat, key=f"cat_{i}", use_container_width=True):
            st.session_state.cat_filter = cat

    # Filter logic
    filt = PARTNERS_DATA.copy()
    if st.session_state.cat_filter not in ["All", ""]:
        cat_map = {"Acquirers":"Acquirer","PSPs":"PSP","APMs":"APM","Fraud & Risk":"Fraud","BaaS":"BaaS"}
        if st.session_state.cat_filter == "🟢 Live only":
            filt = [p for p in filt if p["status"] == "Live"]
        elif st.session_state.cat_filter in cat_map:
            filt = [p for p in filt if p["cat"] == cat_map[st.session_state.cat_filter]]
    if search:
        filt = [p for p in filt if search.lower() in p["name"].lower() or search.lower() in p["type"].lower()]

    # Render grid
    cols_per_row = 3
    for i in range(0, len(filt), cols_per_row):
        row_partners = filt[i:i+cols_per_row]
        cols = st.columns(cols_per_row)
        for col, p in zip(cols, row_partners):
            sc = STATUS_CLASS.get(p["status"], "p-grey")
            cc = CAT_CLASS.get(p["type"], "p-grey")
            col.markdown(f"""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:12px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:38px;height:38px;border-radius:9px;background:{p['color']}22;color:{p['color']};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">{p['logo']}</div>
      <div><div style="font-size:13px;font-weight:700;color:#f0f0f4;">{p['name']}</div><div style="font-size:10px;color:#4a4a5a;">{p['region']}</div></div>
    </div>
    <span class="pill {sc}">{p['status']}</span>
  </div>
  <span class="pill {cc}" style="margin-bottom:10px;display:inline-flex;">{p['type']}</span>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:10px 0;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
    <div style="background:#18181c;border-radius:7px;padding:8px 10px;"><div style="font-size:9.5px;color:#4a4a5a;margin-bottom:2px;">TPV Routed</div><div style="font-size:13px;font-weight:700;font-family:monospace;color:{p['color']};">{p['tpv']}</div></div>
    <div style="background:#18181c;border-radius:7px;padding:8px 10px;"><div style="font-size:9.5px;color:#4a4a5a;margin-bottom:2px;">Auth Rate</div><div style="font-size:13px;font-weight:700;font-family:monospace;color:#f0f0f4;">{p['auth']}</div></div>
  </div>
</div>""", unsafe_allow_html=True)

# ── Contacts View ──────────────────────────────────────────────────────────────
def show_contacts():
    is_internal = st.session_state.role == "internal"
    st.markdown('<div style="font-size:14px;font-weight:700;color:#f0f0f4;letter-spacing:-0.3px;margin-bottom:4px;">Key Contacts</div>'
                '<div style="font-size:11px;color:#4a4a5a;margin-bottom:16px;">BD counterparts, technical leads & executive sponsors across partner organizations</div>', unsafe_allow_html=True)

    cols_per_row = 3
    for i in range(0, len(CONTACTS), cols_per_row):
        row = CONTACTS[i:i+cols_per_row]
        cols = st.columns(cols_per_row)
        for col, c in zip(cols, row):
            col.markdown(f"""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:12px;">
  <div style="display:flex;align-items:flex-start;gap:11px;margin-bottom:12px;">
    <div style="width:36px;height:36px;border-radius:50%;background:{c['bg']};color:{c['color']};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">{c['init']}</div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;color:#f0f0f4;">{c['name']}</div>
      <div style="font-size:11px;color:#8a8a99;margin-top:1px;">{c['role']}</div>
      <div style="font-size:10px;color:#4a4a5a;margin-top:2px;">{c['company']}</div>
    </div>
    <span class="pill {c['badge_class']}">{c['badge']}</span>
  </div>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 10px;">
  <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:10.5px;color:#4a4a5a;">Last contact</span><span style="font-size:10.5px;color:#8a8a99;font-family:monospace;">{c['last']}</span></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:10.5px;color:#4a4a5a;">Relationship</span><span style="font-size:10.5px;color:#8a8a99;font-family:monospace;">{c['rel']}</span></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span style="font-size:10.5px;color:#4a4a5a;">Deals involved</span><span style="font-size:10.5px;color:#8a8a99;font-family:monospace;">{c['deals']}</span></div>
  <div style="display:flex;gap:6px;">
    <button style="flex:1;padding:6px;border-radius:6px;font-size:10px;font-weight:600;background:rgba(255,92,26,0.12);color:#ff5c1a;border:1px solid rgba(255,92,26,0.25);cursor:pointer;font-family:inherit;">📧 Email</button>
    <button style="flex:1;padding:6px;border-radius:6px;font-size:10px;font-weight:600;background:#18181c;color:#8a8a99;border:1px solid rgba(255,255,255,0.07);cursor:pointer;font-family:inherit;">📅 Schedule</button>
    <button style="flex:1;padding:6px;border-radius:6px;font-size:10px;font-weight:600;background:#18181c;color:#8a8a99;border:1px solid rgba(255,255,255,0.07);cursor:pointer;font-family:inherit;">📝 Note</button>
  </div>
</div>""", unsafe_allow_html=True)

    if is_internal:
        st.markdown("""
<div style="border:1px solid rgba(245,158,11,.22);background:rgba(245,158,11,.04);border-radius:10px;padding:13px 16px;margin-top:8px;">
  <div style="font-size:9.5px;font-weight:700;color:#f59e0b;letter-spacing:.9px;text-transform:uppercase;margin-bottom:10px;">🔒 Internal BD Notes — Not Visible to Partners</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Tom Kuehn (Adyen) — negotiating exclusivity window on MX corridor, do not share with other acquirers</span><span style="font-family:monospace;color:#f59e0b;">Confidential</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Felipe Morales (Getnet) — board approval needed above $500K. Target Jan board meeting.</span><span style="font-family:monospace;color:#f59e0b;">Action needed</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;"><span style="color:#8a8a99;">Martín Castillo (Pomelo) — exploring white-label orchestration. High strategic value for BaaS play.</span><span style="font-family:monospace;color:#f59e0b;">Strategic</span></div>
</div>""", unsafe_allow_html=True)

# ── Performance View ───────────────────────────────────────────────────────────
def show_performance():
    is_internal = st.session_state.role == "internal"
    st.markdown('<div style="font-size:14px;font-weight:700;color:#f0f0f4;letter-spacing:-0.3px;margin-bottom:4px;">Performance Dashboard</div>'
                '<div style="font-size:11px;color:#4a4a5a;margin-bottom:16px;">Live partner analytics</div>', unsafe_allow_html=True)

    stat_row([
        {"label":"Total TPV (Live Partners)","value":"$2.4B","delta":"↑ 34% YoY","delta_type":"up","highlight":True,"val_color":"#ff5c1a"},
        {"label":"Transactions/mo","value":"142M","delta":"↑ 22% MoM","delta_type":"up"},
        {"label":"Auth Rate (avg)","value":"89.4%","delta":"↑ 1.2pts","delta_type":"up"},
        {"label":"Partner Revenue","value":"$18.6M","delta":"↑ 28% QoQ","delta_type":"up"},
        {"label":"NPS (Partners)","value":"72","delta":"↑ 8pts","delta_type":"up"},
    ])

    col_tpv, col_mix = st.columns([2.2, 1])

    with col_tpv:
        months = ["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        fig = go.Figure()
        datasets = [
            ("Acquirers",[820,880,910,950,1020,1100,1180,1240],"rgba(59,130,246,.7)"),
            ("PSPs",[420,460,490,530,580,640,700,780],"rgba(168,85,247,.7)"),
            ("APMs",[180,200,230,260,300,340,390,440],"rgba(20,184,166,.7)"),
            ("Fraud",[60,70,80,90,100,115,130,150],"rgba(239,68,68,.6)"),
            ("BaaS",[0,0,0,0,10,25,45,80],"rgba(245,158,11,.7)"),
        ]
        for name, data, color in datasets:
            fig.add_trace(go.Bar(name=name, x=months, y=data, marker_color=color))
        fig.update_layout(
            barmode="stack", paper_bgcolor="#111114", plot_bgcolor="#111114",
            font=dict(color="#8a8a99", size=10),
            margin=dict(l=40,r=10,t=30,b=30),
            legend=dict(orientation="h", y=1.1, font=dict(size=10)),
            height=280,
            title=dict(text="Monthly TPV by Partner Category", font=dict(color="#f0f0f4", size=13), x=0),
            yaxis=dict(gridcolor="rgba(255,255,255,.04)", ticksuffix="M"),
            xaxis=dict(gridcolor="rgba(255,255,255,.04)"),
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    with col_mix:
        fig2 = go.Figure(go.Pie(
            labels=["Acquirers","PSPs","APMs","Fraud","BaaS"],
            values=[38,31,19,8,4],
            hole=0.65,
            marker_colors=["rgba(59,130,246,.8)","rgba(168,85,247,.8)","rgba(20,184,166,.8)","rgba(239,68,68,.75)","rgba(245,158,11,.8)"],
            textinfo="none",
        ))
        fig2.update_layout(
            paper_bgcolor="#111114", plot_bgcolor="#111114",
            font=dict(color="#8a8a99",size=10),
            margin=dict(l=10,r=10,t=50,b=10),
            legend=dict(font=dict(size=10,color="#8a8a99")),
            height=280,
            title=dict(text="TPV Mix by Category", font=dict(color="#f0f0f4",size=13), x=0),
        )
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

    col_auth, col_health = st.columns(2)

    with col_auth:
        partners_list = ["Adyen","Prosa","Getnet","OpenPix","Kushki","Cielo","SEON","Nuvei"]
        rates = [92.4, 90.1, 89.6, 99.1, 88.2, 86.9, 85.0, 84.1]
        colors = ["rgba(34,197,94,.7)" if r>=90 else "rgba(59,130,246,.7)" if r>=87 else "rgba(239,68,68,.7)" for r in rates]
        fig3 = go.Figure(go.Bar(x=rates, y=partners_list, orientation="h", marker_color=colors, marker=dict(cornerradius=3)))
        fig3.update_layout(
            paper_bgcolor="#111114", plot_bgcolor="#111114",
            font=dict(color="#8a8a99",size=10),
            margin=dict(l=10,r=20,t=50,b=30),
            height=260,
            title=dict(text="Auth Rate by Partner (Top 8)", font=dict(color="#f0f0f4",size=13), x=0),
            xaxis=dict(range=[80,100], ticksuffix="%", gridcolor="rgba(255,255,255,.04)"),
            yaxis=dict(gridcolor="rgba(0,0,0,0)"),
        )
        st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})

    with col_health:
        st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px;">
  <div style="font-size:13px;font-weight:700;color:#f0f0f4;margin-bottom:2px;">Partner Health Scorecard</div>
  <div style="font-size:11px;color:#4a4a5a;margin-bottom:14px;">Integration quality · engagement · growth</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#18181c;"><th style="text-align:left;padding:6px 8px;font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#4a4a5a;">Partner</th><th style="padding:6px 8px;font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#4a4a5a;">Health</th><th style="padding:6px 8px;font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#4a4a5a;">TPV Trend</th><th style="padding:6px 8px;font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#4a4a5a;">Issues</th></tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,0.07);"><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">Adyen</td><td style="padding:7px 8px;"><span style="background:rgba(34,197,94,.14);color:#4ade80;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">95</span></td><td style="padding:7px 8px;color:#22c55e;font-family:monospace;">+18%</td><td style="padding:7px 8px;color:#4a4a5a;">0</td></tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,0.07);"><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">Getnet</td><td style="padding:7px 8px;"><span style="background:rgba(34,197,94,.14);color:#4ade80;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">88</span></td><td style="padding:7px 8px;color:#22c55e;font-family:monospace;">+42%</td><td style="padding:7px 8px;color:#4a4a5a;">1</td></tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,0.07);"><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">Kushki</td><td style="padding:7px 8px;"><span style="background:rgba(59,130,246,.14);color:#60a5fa;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">81</span></td><td style="padding:7px 8px;color:#22c55e;font-family:monospace;">+9%</td><td style="padding:7px 8px;color:#4a4a5a;">2</td></tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,0.07);"><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">OpenPix</td><td style="padding:7px 8px;"><span style="background:rgba(59,130,246,.14);color:#60a5fa;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">79</span></td><td style="padding:7px 8px;color:#22c55e;font-family:monospace;">+31%</td><td style="padding:7px 8px;color:#f59e0b;">1</td></tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,0.07);"><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">SEON</td><td style="padding:7px 8px;"><span style="background:rgba(245,158,11,.14);color:#fbbf24;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">71</span></td><td style="padding:7px 8px;color:#22c55e;font-family:monospace;">+6%</td><td style="padding:7px 8px;color:#f59e0b;">3</td></tr>
    <tr><td style="padding:7px 8px;font-weight:600;color:#f0f0f4;">Nuvei</td><td style="padding:7px 8px;"><span style="background:rgba(245,158,11,.14);color:#fbbf24;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:monospace;">68</span></td><td style="padding:7px 8px;color:#ef4444;font-family:monospace;">−4%</td><td style="padding:7px 8px;color:#ef4444;">4</td></tr>
  </table>
</div>""", unsafe_allow_html=True)

    if is_internal:
        st.markdown("""
<div style="border:1px solid rgba(245,158,11,.22);background:rgba(245,158,11,.04);border-radius:10px;padding:13px 16px;margin-top:16px;">
  <div style="font-size:9.5px;font-weight:700;color:#f59e0b;letter-spacing:.9px;text-transform:uppercase;margin-bottom:10px;">🔒 Internal Revenue Intelligence</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Blended take rate (all live partners)</span><span style="font-family:monospace;color:#f59e0b;">0.048%</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Adyen contract renewal date</span><span style="font-family:monospace;color:#f59e0b;">Mar 2025 · auto-renew flag on</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Nuvei performance clause risk</span><span style="font-family:monospace;color:#f59e0b;">⚠ Below SLA — escalate</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;"><span style="color:#8a8a99;">BaaS vertical projected ARR (12mo)</span><span style="font-family:monospace;color:#f59e0b;">$2.1M if 4 deals close</span></div>
</div>""", unsafe_allow_html=True)

# ── Insights View ──────────────────────────────────────────────────────────────
def show_insights():
    is_internal = st.session_state.role == "internal"
    st.markdown('<div style="font-size:14px;font-weight:700;color:#f0f0f4;letter-spacing:-0.3px;margin-bottom:4px;">Intelligence & Insights</div>'
                '<div style="font-size:11px;color:#4a4a5a;margin-bottom:16px;">Market gaps · signals · strategy</div>', unsafe_allow_html=True)

    stat_row([
        {"label":"Market Coverage","value":"73%","delta":"↑ LATAM payment methods","delta_type":"up","highlight":True,"val_color":"#ff5c1a"},
        {"label":"Gaps Identified","value":"8","delta":"→ 3 in BNPL, 2 in crypto","delta_type":"flat"},
        {"label":"Routing Efficiency","value":"94%","delta":"↑ smart routing gains","delta_type":"up"},
        {"label":"Partner Redundancy","value":"2.1×","delta":"↑ per corridor avg","delta_type":"up"},
        {"label":"Time to Integrate","value":"42d","delta":"↓ 12d vs 2023","delta_type":"down"},
    ])

    tab_options = ["Market Gaps","Partner Signals"] + (["Strategic Recs"] if is_internal else [])
    tab = st.radio("insights_tab", tab_options, horizontal=True, key="insight_tab_radio", label_visibility="collapsed")

    if tab == "Market Gaps":
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:14px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">🌎 LATAM Coverage Gaps</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">⬛</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">BNPL — No active partner in MX & COL</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Kueski (MX) and Addi (COL) are the dominant players. Neither currently integrated. Estimated $180M TPV opportunity per year if onboarded.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">⬛</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Open Banking / Pix — Single point of failure in BR</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Only OpenPix covers PIX routing. Adding Celcoin as backup would provide redundancy and competitive take rate negotiation.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">⬛</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Crypto payments — zero coverage</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Bitso and MercadoPago crypto rails gaining share in AR and VE. Not yet on roadmap. Consider as Q2 initiative pending regulatory clarity.</div></div>
  </div>
</div>""", unsafe_allow_html=True)
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">⚡ Fraud & Risk Coverage</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">◆</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">SEON live but coverage limited to card fraud</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Merchants requesting ATO and chargeback dispute management. Evaluate Kount or Signifyd as complementary fraud partners.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">◆</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Truora — KYC/KYB coverage for LATAM</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Strong coverage for identity verification in CO, MX, BR. Adds compliance layer that opens regulated merchant segments.</div></div>
  </div>
</div>""", unsafe_allow_html=True)

        with c2:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:14px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">🏦 BaaS Vertical — New Opportunity</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">★</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Pomelo — White-label orchestration for neobanks</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Pomelo issues cards across LATAM and needs a reliable orchestration layer. Yuno could become embedded infrastructure. Estimated ARR: $440K.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">★</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Bnext / Stori — Card issuers seeking orchestration</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Two card issuers reached out via LinkedIn. Both need multi-acquirer routing for their debit/prepaid portfolios.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">★</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Neobank embedded finance wave</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Nubank, Mercado Pago, and Ualá competing in 3+ countries simultaneously. Winning one creates a network effect across their markets.</div></div>
  </div>
</div>""", unsafe_allow_html=True)
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">📊 Routing Optimization Signals</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">▲</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Getnet outperforming Cielo on BR Visa transactions</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Auth rate delta: +3.1pp. Projected uplift: $4.2M additional authorised TPV per month by shifting routing.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">▲</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">APM share growing 4pp per quarter in Chile & Peru</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Khipu (CL) and Yape (PE) seeing strong adoption. Integrating both adds coverage for ~22M active users in under-served corridors.</div></div>
  </div>
</div>""", unsafe_allow_html=True)

    elif tab == "Partner Signals":
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">🔴 At-Risk Partners</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">⚠</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Nuvei — 4 open SLA incidents</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Auth rate dropped to 84.1% in BR over last 14 days. Merchant escalations received. Schedule urgent technical review with Nuvei engineering.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">⚠</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Conekta MX — stalled commercial negotiations</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Deal stuck at Evaluation for 92 days. Primary contact has gone quiet. Recommend C-level outreach or re-evaluation of strategic fit.</div></div>
  </div>
</div>""", unsafe_allow_html=True)
        with c2:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">🟢 Growth Signals</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
    <span style="font-size:16px;flex-shrink:0;">↑</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Getnet — Rapid TPV ramp post-launch</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">+42% TPV growth in first 60 days live. Santander group exploring Getnet rollout in AR and CL — opportunity to extend contract to new markets.</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;">
    <span style="font-size:16px;flex-shrink:0;">↑</span>
    <div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">OpenPix — Pix adoption surging</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Pix now 31% of all BR transactions through Yuno. OpenPix volume up 31% MoM. Strong case for preferential pricing renegotiation at scale.</div></div>
  </div>
</div>""", unsafe_allow_html=True)

    elif tab == "Strategic Recs" and is_internal:
        st.markdown("""
<div style="border:1px solid rgba(245,158,11,.22);background:rgba(245,158,11,.04);border-radius:10px;padding:13px 16px;margin-bottom:16px;">
  <div style="font-size:9.5px;font-weight:700;color:#f59e0b;letter-spacing:.9px;text-transform:uppercase;margin-bottom:10px;">🔒 Internal — Strategic Recommendations for Q1</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Priority 1: Close Getnet Santander — activates AR + CL expansion</span><span style="font-family:monospace;color:#f59e0b;">Jan deadline</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Priority 2: Sign first BaaS partner (Pomelo) — validates new vertical</span><span style="font-family:monospace;color:#f59e0b;">Q1 OKR</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Priority 3: Add Addi (BNPL COL) to close biggest product gap</span><span style="font-family:monospace;color:#f59e0b;">Assigned: SR</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;"><span style="color:#8a8a99;">Priority 4: Resolve Nuvei SLA before contract renewal review</span><span style="font-family:monospace;color:#f59e0b;">Urgent</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;"><span style="color:#8a8a99;">Priority 5: Evaluate Crypto rails for Q2 pipeline readiness</span><span style="font-family:monospace;color:#f59e0b;">Research phase</span></div>
</div>""", unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">🗺 2025 Partner Expansion Map</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="font-size:16px;flex-shrink:0;">①</span><div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Deepen LATAM acquirer coverage in CL, PE, AR</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Only 1 active acquirer per country. Target: 2 per market minimum by Q3 2025 to enable true redundancy and competitive routing.</div></div></div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="font-size:16px;flex-shrink:0;">②</span><div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Build out BaaS as a formal partner tier</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Create dedicated partner program track — separate commercial terms, embedded orchestration API, dedicated technical success manager.</div></div></div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;"><span style="font-size:16px;flex-shrink:0;">③</span><div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Launch fraud marketplace — 3 partners by EOY</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">SEON + Truora + one chargeback specialist would create a credible fraud marketplace offering.</div></div></div>
</div>""", unsafe_allow_html=True)
        with c2:
            st.markdown("""
<div style="background:#111114;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;">
  <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a4a5a;margin-bottom:10px;">💡 Partner Program Recommendations</div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="font-size:16px;flex-shrink:0;">◈</span><div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Introduce tiered partner program (Silver / Gold / Platinum)</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">High-volume partners (Adyen, Getnet) should get dedicated integration support, co-marketing budget, and quarterly business reviews.</div></div></div>
  <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;"><span style="font-size:16px;flex-shrink:0;">◈</span><div><div style="font-size:12px;font-weight:600;color:#f0f0f4;margin-bottom:2px;">Partner-sourced deals need clearer attribution model</div><div style="font-size:11px;color:#4a4a5a;line-height:1.55;">Kushki and Adyen have referred 3 merchants each this quarter with no formal incentive structure. Implementing a referral bonus increases deal flow.</div></div></div>
</div>""", unsafe_allow_html=True)

# ── Main App ───────────────────────────────────────────────────────────────────
inject_css(st.session_state.role)

if st.session_state.role is None:
    show_landing()
else:
    show_sidebar()
    # Top-right "Landing Page" button
    _top_left, _top_right = st.columns([9, 1])
    with _top_right:
        if st.button("← Landing", key="goto_landing", use_container_width=True):
            st.session_state.role = None
            st.query_params.clear()
            st.rerun()
    page = st.session_state.page
    if page == "Pipeline":
        show_pipeline()
    elif page == "Partners":
        show_partners()
    elif page == "Contacts":
        show_contacts()
    elif page == "Performance":
        show_performance()
    elif page == "Insights":
        show_insights()

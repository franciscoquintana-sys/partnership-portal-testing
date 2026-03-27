import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import json

st.set_page_config(
    page_title="Luna Travel — Payment Dashboard",
    page_icon="✈",
    layout="wide"
)

st.markdown("""
<style>
    /* ── Main background ── */
    .stApp { background-color: #F4F4F8; }

    /* ── Sidebar — Yuno dark navy ── */
    section[data-testid="stSidebar"] {
        background-color: #1C1433 !important;
    }
    section[data-testid="stSidebar"] .stMarkdown,
    section[data-testid="stSidebar"] .stMarkdown p,
    section[data-testid="stSidebar"] .stMarkdown a,
    section[data-testid="stSidebar"] label,
    section[data-testid="stSidebar"] span,
    section[data-testid="stSidebar"] p {
        color: #D8D5E8 !important;
    }
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {
        color: #FFFFFF !important;
    }
    section[data-testid="stSidebar"] hr {
        border-color: #3D3257 !important;
    }

    /* ── Sidebar logo — reduce padding ── */
    section[data-testid="stSidebar"] [data-testid="stImage"] {
        margin-top: -1rem !important;
        margin-bottom: -1rem !important;
    }
    section[data-testid="stSidebar"] [data-testid="stImage"] img {
        max-height: 220px;
        object-fit: contain;
    }

    /* ── Sidebar input widgets — match dark background ── */
    /* Multiselect container */
    section[data-testid="stSidebar"] [data-baseweb="select"] > div,
    section[data-testid="stSidebar"] [data-baseweb="select"] > div:hover {
        background-color: #2D2047 !important;
        border-color: #3D3257 !important;
    }
    /* Multiselect tags (selected items) */
    section[data-testid="stSidebar"] [data-baseweb="tag"] {
        background-color: #3D3257 !important;
    }
    section[data-testid="stSidebar"] [data-baseweb="tag"] span {
        color: #CAFF00 !important;
    }
    /* Multiselect input text */
    section[data-testid="stSidebar"] [data-baseweb="select"] input {
        color: #D8D5E8 !important;
    }
    /* Slider track */
    section[data-testid="stSidebar"] [data-testid="stSlider"] > div > div {
        background-color: #3D3257 !important;
    }
    /* Slider value box */
    section[data-testid="stSidebar"] [data-testid="stSlider"] [data-testid="stTickBarMin"],
    section[data-testid="stSidebar"] [data-testid="stSlider"] [data-testid="stTickBarMax"] {
        color: #D8D5E8 !important;
    }
    /* Slider thumb label */
    section[data-testid="stSidebar"] .stSlider p {
        color: #D8D5E8 !important;
    }

    /* ── Page headings ── */
    h1 {
        color: #1C1433 !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em;
    }
    h2 {
        color: #1C1433 !important;
        font-weight: 700 !important;
    }
    /* Subheader with Yuno lime left-border accent */
    h3 {
        color: #1C1433 !important;
        font-weight: 700 !important;
        border-left: 4px solid #CAFF00;
        padding-left: 10px;
        margin-top: 0.3rem;
    }

    /* ── KPI metric cards ── */
    [data-testid="stMetric"] {
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 12px;
        padding: 1rem 1.2rem;
        box-shadow: 0 2px 8px rgba(28, 20, 51, 0.06);
    }
    [data-testid="stMetricLabel"] p {
        color: #6B7280 !important;
        font-size: 0.72rem !important;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 600 !important;
    }
    [data-testid="stMetricValue"] {
        color: #1C1433 !important;
        font-weight: 700 !important;
    }
    [data-testid="stMetricDelta"] { font-size: 0.82rem !important; }

    /* ── Buttons ── */
    .stButton > button {
        background-color: #CAFF00 !important;
        color: #1C1433 !important;
        border: none !important;
        font-weight: 700 !important;
        border-radius: 8px !important;
    }
    .stButton > button:hover {
        background-color: #B8E600 !important;
        color: #1C1433 !important;
    }

    /* ── Download button ── */
    .stDownloadButton > button {
        background-color: #1C1433 !important;
        color: #CAFF00 !important;
        border: none !important;
        font-weight: 700 !important;
        border-radius: 8px !important;
    }
    .stDownloadButton > button:hover {
        background-color: #2D2047 !important;
    }

    /* ── Alert / insight cards ── */
    .stAlert { border-radius: 10px !important; }

    /* ── Expander ── */
    details summary { font-weight: 600; color: #1C1433; }

    /* ── Dataframe ── */
    [data-testid="stDataFrame"] { border-radius: 8px; overflow: hidden; }

    /* ── Plotly chart container ── */
    [data-testid="stPlotlyChart"] {
        background: #FFFFFF;
        border-radius: 12px;
        padding: 4px;
        box-shadow: 0 1px 4px rgba(28, 20, 51, 0.05);
    }

    /* ── Sidebar expander buttons ── */
    section[data-testid="stSidebar"] details {
        background-color: #2D2047 !important;
        border: 1px solid #3D3257 !important;
        border-radius: 10px !important;
        margin-bottom: 8px !important;
        overflow: hidden !important;
        box-shadow: 0 4px 0 #160B2E !important;
    }
    section[data-testid="stSidebar"] details summary {
        background-color: #2D2047 !important;
        padding: 11px 14px !important;
        font-weight: 700 !important;
        font-size: 0.82rem !important;
        color: #FFFFFF !important;
        border-radius: 10px !important;
        list-style: none !important;
        cursor: pointer !important;
        letter-spacing: 0.02em !important;
        transition: background 0.15s !important;
    }
    section[data-testid="stSidebar"] details summary:hover {
        background-color: #CAFF00 !important;
        color: #1C1433 !important;
    }
    section[data-testid="stSidebar"] details[open] {
        box-shadow: 0 1px 0 #160B2E !important;
    }
    section[data-testid="stSidebar"] details[open] summary {
        border-radius: 10px 10px 0 0 !important;
        border-bottom: 1px solid #3D3257 !important;
        background-color: #CAFF00 !important;
        color: #1C1433 !important;
    }
    section[data-testid="stSidebar"] details > div {
        padding: 12px 10px 6px 10px !important;
        background-color: #1C1433 !important;
    }
    /* Hide default triangle on summary */
    section[data-testid="stSidebar"] details summary::-webkit-details-marker { display: none !important; }
    section[data-testid="stSidebar"] details summary::marker { display: none !important; }

    /* ── Search bar ── */
    [data-testid="stTextInput"] > div > div > input {
        border-radius: 12px !important;
        border: 1.5px solid #3D3257 !important;
        padding: 1.1rem 1.6rem !important;
        font-size: 1.05rem !important;
        font-weight: 700 !important;
        background: #1C1433 !important;
        color: #FFFFFF !important;
        box-shadow: 0 5px 0 #0A0519, 0 2px 10px rgba(0,0,0,0.25) !important;
        transition: border-color 0.15s, box-shadow 0.15s !important;
    }
    [data-testid="stTextInput"] > div > div > input::placeholder {
        color: #FFFFFF !important;
        font-weight: 700 !important;
        opacity: 0.85 !important;
    }
    [data-testid="stTextInput"] > div > div > input:focus {
        border-color: #CAFF00 !important;
        box-shadow: 0 2px 0 #0A0519, 0 0 0 3px rgba(202,255,0,0.2) !important;
        outline: none !important;
    }
    [data-testid="stTextInput"] > label { display: none !important; }
</style>
""", unsafe_allow_html=True)

# ── Session state — init from URL params on first load ────────────────────────
if "_initialized" not in st.session_state:
    st.session_state._initialized = True
    st.session_state.drill_country  = st.query_params.get("drill_country")  or None
    st.session_state.drill_processor = st.query_params.get("drill_processor") or None
    st.session_state.drill_method   = st.query_params.get("drill_method")   or None
    st.session_state.drill_date     = st.query_params.get("drill_date")     or None
else:
    for _key in ["drill_country", "drill_processor", "drill_method", "drill_date"]:
        if _key not in st.session_state:
            st.session_state[_key] = None


@st.cache_data
def load_data():
    with open("payments.json") as f:
        data = json.load(f)
    df = pd.DataFrame(data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    df["day"] = df["timestamp"].dt.day
    df["hour"] = df["timestamp"].dt.hour
    df["approved_int"] = df["approved"].astype(int)
    df["amount_bin"] = pd.cut(
        df["amount"],
        bins=[0, 50, 200, 500, float("inf")],
        labels=["$0–50", "$50–200", "$200–500", "$500+"]
    )
    return df


def top_val(series):
    vc = series.value_counts()
    return vc.idxmax() if len(vc) > 0 else "N/A"


def generate_insights(df):
    insights = []
    if df.empty or len(df) < 20:
        return insights
    overall_rate = df["approved_int"].mean() * 100

    # 1. Processor outage: any processor × day with <30% approval (min 15 txns)
    proc_daily = df.groupby(["processor", "date"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    proc_daily["rate"] = proc_daily["approved_sum"] / proc_daily["total"] * 100
    for _, row in proc_daily.iterrows():
        if row["total"] < 15 or row["rate"] >= 30:
            continue
        sub_dec = df[(df["processor"] == row["processor"]) &
                     (df["date"] == row["date"]) & ~df["approved"]]
        if sub_dec.empty:
            continue
        top_reason = top_val(sub_dec["decline_reason"])
        top_pct = sub_dec["decline_reason"].value_counts().iloc[0] / len(sub_dec) * 100
        insights.append({
            "level": "error",
            "title": f"{row['processor']} outage on {row['date']}",
            "text": (
                f"**{row['processor']}** had only **{row['rate']:.1f}%** approval on **{row['date']}** "
                f"({int(row['total'])} transactions). "
                f"**{top_reason}** made up {top_pct:.0f}% of declines — likely a technical incident."
            )
        })

    # 2. Daily approval rate drops (>15pp below overall, min 20 txns)
    daily_agg = df.groupby("date").agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    daily_agg["rate"] = daily_agg["approved_sum"] / daily_agg["total"] * 100
    for _, row in daily_agg.iterrows():
        drop = overall_rate - row["rate"]
        if row["total"] < 20 or drop <= 15:
            continue
        day_df = df[df["date"] == row["date"]]
        proc_rates = day_df.groupby("processor").agg(
            total=("id", "count"), approved=("approved_int", "sum"))
        proc_rates["rate"] = proc_rates["approved"] / proc_rates["total"] * 100
        worst_proc = proc_rates["rate"].idxmin()
        worst_rate = proc_rates.loc[worst_proc, "rate"]
        day_dec = day_df[~day_df["approved"]]
        top_reason = top_val(day_dec["decline_reason"])
        top_pct = day_dec["decline_reason"].value_counts().iloc[0] / len(day_dec) * 100 if not day_dec.empty else 0
        already = any(str(row["date"]) in i["title"] and "outage" in i["title"] for i in insights)
        if not already:
            insights.append({
                "level": "error",
                "title": f"Approval rate drop on {row['date']}",
                "text": (
                    f"Approval fell to **{row['rate']:.1f}%** on **{row['date']}** "
                    f"({drop:.0f}pp below average of {overall_rate:.1f}%). "
                    f"{worst_proc} was worst at {worst_rate:.1f}%. "
                    f"Top decline: **{top_reason}** ({top_pct:.0f}% of that day's declines)."
                )
            })

    # 3. Country × Method underperformance (>15pp below overall, min 10 txns)
    cm = df.groupby(["country", "payment_method"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    cm["rate"] = cm["approved_sum"] / cm["total"] * 100
    for _, row in cm.iterrows():
        if row["total"] < 10 or (overall_rate - row["rate"]) <= 15:
            continue
        sub_dec = df[(df["country"] == row["country"]) &
                     (df["payment_method"] == row["payment_method"]) & ~df["approved"]]
        if sub_dec.empty:
            continue
        top_reason = top_val(sub_dec["decline_reason"])
        top_pct = sub_dec["decline_reason"].value_counts().iloc[0] / len(sub_dec) * 100
        insights.append({
            "level": "warning",
            "title": f"{row['payment_method']} in {row['country']} underperforming",
            "text": (
                f"**{row['payment_method']}** in **{row['country']}** has only **{row['rate']:.1f}%** approval "
                f"({overall_rate - row['rate']:.0f}pp below average). "
                f"Top decline: **{top_reason}** ({top_pct:.0f}% of declines, {int(row['total'])} txns)."
            )
        })

    # 4. High-value transaction gap (>$400, >10pp gap)
    high_val = df[df["amount"] > 400]
    if len(high_val) >= 10:
        high_rate = high_val["approved_int"].mean() * 100
        gap = overall_rate - high_rate
        if gap > 10:
            hv_dec = high_val[~high_val["approved"]]
            top_reason = top_val(hv_dec["decline_reason"])
            top_pct = hv_dec["decline_reason"].value_counts().iloc[0] / len(hv_dec) * 100 if not hv_dec.empty else 0
            insights.append({
                "level": "warning",
                "title": "High-value transactions (>$400) underperforming",
                "text": (
                    f"Transactions above $400 have **{high_rate:.1f}%** approval — "
                    f"**{gap:.0f}pp lower** than overall ({overall_rate:.1f}%). "
                    f"Primary driver: **{top_reason}** ({top_pct:.0f}% of high-value declines, {len(high_val)} txns)."
                )
            })

    # 5. 3DS spike detection (>35% of card declines in any region)
    card_methods = ["card_visa", "card_mastercard"]
    for label, countries_list in {
        "Europe (Spain + Germany)": ["Spain", "Germany"],
        "Brazil": ["Brazil"], "Mexico": ["Mexico"],
        "Argentina": ["Argentina"], "Colombia": ["Colombia"],
    }.items():
        sub = df[df["country"].isin(countries_list) &
                 df["payment_method"].isin(card_methods) & ~df["approved"]]
        if len(sub) < 10:
            continue
        tds_rate = (sub["decline_reason"] == "3ds_failure").mean() * 100
        if tds_rate <= 35:
            continue
        timing = ""
        h1 = sub[sub["day"] <= 15]
        h2 = sub[sub["day"] > 15]
        if len(h1) >= 5 and len(h2) >= 5:
            r1 = (h1["decline_reason"] == "3ds_failure").mean() * 100
            r2 = (h2["decline_reason"] == "3ds_failure").mean() * 100
            if r2 - r1 > 15:
                timing = " Spike started in the **second half of the month** (Nov 16+)."
        insights.append({
            "level": "warning",
            "title": f"3DS failure spike in {label}",
            "text": (
                f"**{tds_rate:.0f}%** of card declines in **{label}** are **3DS failures** "
                f"({len(sub)} declined card txns).{timing} Investigate 3DS config for this region."
            )
        })

    # 6. Processor × Country underperformance (>20pp below overall, min 10 txns)
    pc = df.groupby(["processor", "country"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    pc["rate"] = pc["approved_sum"] / pc["total"] * 100
    for _, row in pc.iterrows():
        if row["total"] < 10 or (overall_rate - row["rate"]) <= 20:
            continue
        sub_dec = df[(df["processor"] == row["processor"]) &
                     (df["country"] == row["country"]) & ~df["approved"]]
        if sub_dec.empty:
            continue
        top_reason = top_val(sub_dec["decline_reason"])
        top_pct = sub_dec["decline_reason"].value_counts().iloc[0] / len(sub_dec) * 100
        insights.append({
            "level": "warning",
            "title": f"{row['processor']} underperforming in {row['country']}",
            "text": (
                f"**{row['processor']}** in **{row['country']}**: **{row['rate']:.1f}%** approval "
                f"({overall_rate - row['rate']:.0f}pp below average). "
                f"Top decline: **{top_reason}** ({top_pct:.0f}%, {int(row['total'])} txns)."
            )
        })

    seen, unique = set(), []
    for ins in insights:
        if ins["title"] not in seen:
            seen.add(ins["title"])
            unique.append(ins)
    unique.sort(key=lambda x: 0 if x["level"] == "error" else 1)
    return unique


def generate_recommendations(df):
    """Produce specific, actionable recommendations based on data patterns."""
    recs = []
    if df.empty or len(df) < 20:
        return recs

    overall_rate = df["approved_int"].mean() * 100

    # 1. Processor outage → escalate + failover
    proc_daily = df.groupby(["processor", "date"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    proc_daily["rate"] = proc_daily["approved_sum"] / proc_daily["total"] * 100
    for _, row in proc_daily.iterrows():
        if row["total"] < 15 or row["rate"] >= 30:
            continue
        other_procs = [p for p in df["processor"].unique() if p != row["processor"]]
        recs.append({
            "priority": "high",
            "action": f"Escalate {row['processor']} outage on {row['date']}",
            "detail": (
                f"{row['processor']} dropped to {row['rate']:.0f}% approval on {row['date']}. "
                f"Open a P1 ticket with {row['processor']} immediately. "
                f"Enable automatic failover to {' or '.join(other_procs)} for affected segments until resolved."
            )
        })

    # 2. Processor × Country underperformance → re-route
    pc = df.groupby(["processor", "country"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    pc["rate"] = pc["approved_sum"] / pc["total"] * 100
    for _, row in pc.iterrows():
        if row["total"] < 15:
            continue
        drop = overall_rate - row["rate"]
        if drop <= 20:
            continue
        other_procs = [p for p in df["processor"].unique() if p != row["processor"]]
        recs.append({
            "priority": "medium",
            "action": f"Re-route {row['country']} payments away from {row['processor']}",
            "detail": (
                f"{row['processor']} has only {row['rate']:.0f}% approval in {row['country']} "
                f"({drop:.0f}pp below average across {int(row['total'])} transactions). "
                f"Consider routing this market to {' or '.join(other_procs)} as primary processor."
            )
        })

    # 3. 3DS spike → investigate configuration
    card_methods = ["card_visa", "card_mastercard"]
    for label, countries_list in {
        "Europe (Spain + Germany)": ["Spain", "Germany"],
        "Brazil": ["Brazil"], "Mexico": ["Mexico"],
        "Argentina": ["Argentina"], "Colombia": ["Colombia"],
    }.items():
        sub = df[df["country"].isin(countries_list) &
                 df["payment_method"].isin(card_methods) & ~df["approved"]]
        if len(sub) < 10:
            continue
        tds_rate = (sub["decline_reason"] == "3ds_failure").mean() * 100
        if tds_rate <= 35:
            continue
        recs.append({
            "priority": "medium",
            "action": f"Investigate 3DS configuration for {label} card payments",
            "detail": (
                f"{tds_rate:.0f}% of card declines in {label} are 3DS failures. "
                f"Check with your 3DS provider for recent issuer rule changes. "
                f"Consider enabling 3DS exemptions (e.g., low-value or trusted merchant) for low-risk transactions in this region."
            )
        })

    # 4. High-value transactions underperforming → fraud rules or routing
    high_val = df[df["amount"] > 400]
    if len(high_val) >= 10:
        high_rate = high_val["approved_int"].mean() * 100
        gap = overall_rate - high_rate
        if gap > 10:
            hv_dec = high_val[~high_val["approved"]]
            top_reason = top_val(hv_dec["decline_reason"]) if not hv_dec.empty else "unknown"
            if "fraud" in top_reason.lower():
                recs.append({
                    "priority": "medium",
                    "action": "Review fraud rules for high-value transactions (>$400)",
                    "detail": (
                        f"Transactions above $400 have {high_rate:.0f}% approval — {gap:.0f}pp below average, "
                        f"driven by {top_reason}. Audit fraud scoring thresholds for this segment: "
                        f"tighten rules for genuinely risky patterns while reducing false positives on legitimate high-value bookings."
                    )
                })
            else:
                recs.append({
                    "priority": "low",
                    "action": "Offer instalment or split-payment options for high-value bookings (>$400)",
                    "detail": (
                        f"High-value transactions have {gap:.0f}pp lower approval (top decline: {top_reason}). "
                        f"Offering instalment plans or split-payment at checkout can reduce declines caused by card limits or insufficient funds."
                    )
                })

    # 5. Country × Method underperformance → alternative methods or failover
    cm = df.groupby(["country", "payment_method"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    cm["rate"] = cm["approved_sum"] / cm["total"] * 100
    alt_methods = {"Brazil": "PIX", "Mexico": "OXXO", "Colombia": "card_visa",
                   "Argentina": "card_mastercard", "Spain": "SEPA", "Germany": "SEPA"}
    for _, row in cm.iterrows():
        if row["total"] < 10:
            continue
        drop = overall_rate - row["rate"]
        if drop <= 15:
            continue
        sub_dec = df[(df["country"] == row["country"]) &
                     (df["payment_method"] == row["payment_method"]) & ~df["approved"]]
        if sub_dec.empty:
            continue
        top_reason = top_val(sub_dec["decline_reason"])
        alt = alt_methods.get(row["country"], "an alternative local method")
        if top_reason == "technical_error":
            recs.append({
                "priority": "medium",
                "action": f"Enable processor failover for {row['payment_method']} in {row['country']}",
                "detail": (
                    f"{row['payment_method']} in {row['country']} has {row['rate']:.0f}% approval with "
                    f"technical_error as top decline — likely a processor-side issue. "
                    f"Enable automatic retry on a secondary processor for this segment."
                )
            })
        elif top_reason in ("insufficient_funds", "expired_card"):
            if alt != row["payment_method"]:
                recs.append({
                    "priority": "low",
                    "action": f"Surface {alt} as fallback for {row['payment_method']} failures in {row['country']}",
                    "detail": (
                        f"{row['payment_method']} in {row['country']} declines are mainly {top_reason} "
                        f"({int(row['total'])} transactions, {row['rate']:.0f}% approval). "
                        f"Prompt users who fail with {row['payment_method']} to retry with {alt} at checkout."
                    )
                })

    # Deduplicate and sort by priority
    seen, unique = set(), []
    for rec in recs:
        if rec["action"] not in seen:
            seen.add(rec["action"])
            unique.append(rec)
    unique.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x["priority"], 3))
    return unique


# ── Load data ─────────────────────────────────────────────────────────────────
df = load_data()

# ── Global Plotly layout defaults (Yuno brand) ────────────────────────────────
import plotly.io as pio
pio.templates["yuno"] = go.layout.Template(
    layout=go.Layout(
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(family="Inter, -apple-system, sans-serif", color="#1C1433"),
        title=dict(font=dict(size=14, color="#1C1433", family="Inter, sans-serif"), x=0),
        xaxis=dict(showgrid=True, gridcolor="#F0EEF8", linecolor="#E5E7EB", zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="#F0EEF8", linecolor="#E5E7EB", zeroline=False),
        colorway=["#6C5CE7", "#37B679", "#F77F00", "#E74C3C", "#00B4A0", "#CAFF00", "#FD79A8"],
        margin=dict(t=48, b=32, l=32, r=16),
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="rgba(0,0,0,0)"),
    )
)
pio.templates.default = "yuno"

# ── Plotly chart wrapper — disables double-click axis reset ──────────────────
def _plot(fig, **kwargs):
    kwargs["config"] = {"doubleClick": False, "displaylogo": False}
    return st.plotly_chart(fig, **kwargs)


# ── Natural-language query parser ─────────────────────────────────────────────
def parse_query(query, df):
    """Extract filters + intent from free-text / question. Returns dict."""
    import re, difflib

    q = query.lower().strip()

    # ── Dimension extraction ──────────────────────────────────────────────────
    country_aliases = {"brasil": "Brazil", "br": "Brazil", "mex": "Mexico",
                       "arg": "Argentina", "col": "Colombia", "esp": "Spain",
                       "ger": "Germany", "deutschland": "Germany"}
    found_countries = []
    for c in df["country"].unique():
        if c.lower() in q or any(w == c.lower() for w in q.split()):
            found_countries.append(c)
    for alias, real in country_aliases.items():
        if alias in q.split() and real not in found_countries:
            found_countries.append(real)

    found_processors = []
    for p in df["processor"].unique():
        if p.lower() in q or p.lower().replace(" ", "") in q.replace(" ", ""):
            found_processors.append(p)
        elif difflib.SequenceMatcher(None, p.lower(), q).ratio() > 0.72:
            found_processors.append(p)

    method_aliases = {
        "3ds": ["card_visa", "card_mastercard"],
        "card": ["card_visa", "card_mastercard"],
        "visa": ["card_visa"], "mastercard": ["card_mastercard"],
        "pix": ["PIX"], "oxxo": ["OXXO"], "sepa": ["SEPA"],
    }
    found_methods = []
    for alias, actuals in method_aliases.items():
        if alias in q:
            found_methods.extend(actuals)
    for m in df["payment_method"].unique():
        if m.lower() in q and m not in found_methods:
            found_methods.append(m)
    found_methods = list(dict.fromkeys(found_methods))

    reason_aliases = {
        "3ds failure": "3ds_failure", "3ds": "3ds_failure",
        "fraud": "fraud_suspicion", "insufficient": "insufficient_funds",
        "insufficient funds": "insufficient_funds",
        "technical": "technical_error", "technical error": "technical_error",
        "expired": "expired_card", "expired card": "expired_card",
        "outage": "technical_error",
    }
    found_reasons = []
    for alias, actual in reason_aliases.items():
        if alias in q and actual not in found_reasons:
            found_reasons.append(actual)
    for r in df["decline_reason"].dropna().unique():
        if r.lower().replace("_", " ") in q and r not in found_reasons:
            found_reasons.append(r)

    # ── Day / time extraction ─────────────────────────────────────────────────
    day_range = None
    m = re.search(r'last\s+(\d+)\s+day', q)
    if m:
        n = int(m.group(1))
        max_day = int(df["day"].max())
        day_range = (max(1, max_day - n + 1), max_day)
    m = re.search(r'(?:nov(?:ember)?\s+)?day\s+(\d+)(?:\s*(?:to|-)\s*(\d+))?', q)
    if m and not day_range:
        d1 = int(m.group(1))
        d2 = int(m.group(2)) if m.group(2) else d1
        day_range = (d1, d2)
    m = re.search(r'nov(?:ember)?\s+(\d+)(?:\s*(?:to|-)\s*(\d+))?', q)
    if m and not day_range:
        d1 = int(m.group(1))
        d2 = int(m.group(2)) if m.group(2) else d1
        day_range = (d1, d2)
    if re.search(r'first half|early month|nov 1.?15', q):
        day_range = (1, 15)
    elif re.search(r'second half|late month|nov 16.?30', q):
        day_range = (16, 30)

    # ── Amount extraction ─────────────────────────────────────────────────────
    amount_filter = None
    if "high value" in q or "high-value" in q:
        amount_filter = ("gt", 400)
    else:
        m = re.search(r'>\s*\$?(\d+)', q)
        if m:
            amount_filter = ("gt", int(m.group(1)))
        m = re.search(r'<\s*\$?(\d+)', q)
        if m:
            amount_filter = ("lt", int(m.group(1)))

    # ── Approval status ───────────────────────────────────────────────────────
    approved_filter = None
    if re.search(r'\bapproved\b', q) and not re.search(r'\bdeclined?\b', q):
        approved_filter = True
    elif re.search(r'\bdeclined?\b', q) and not re.search(r'\bapproved\b', q):
        approved_filter = False

    # ── Apply filters ─────────────────────────────────────────────────────────
    rdf = df.copy()
    if found_countries:  rdf = rdf[rdf["country"].isin(found_countries)]
    if found_processors: rdf = rdf[rdf["processor"].isin(found_processors)]
    if found_methods:    rdf = rdf[rdf["payment_method"].isin(found_methods)]
    if found_reasons:    rdf = rdf[rdf["decline_reason"].isin(found_reasons)]
    if day_range:        rdf = rdf[rdf["day"].between(day_range[0], day_range[1])]
    if approved_filter is True:  rdf = rdf[rdf["approved"]]
    if approved_filter is False: rdf = rdf[~rdf["approved"]]
    if amount_filter:
        op, val = amount_filter
        rdf = rdf[rdf["amount"] > val] if op == "gt" else rdf[rdf["amount"] < val]

    any_filter = bool(found_countries or found_processors or found_methods or
                      found_reasons or day_range or amount_filter or
                      approved_filter is not None)

    # ── Question answering ────────────────────────────────────────────────────
    answer = None
    n = len(rdf)
    rate = rdf["approved_int"].mean() * 100 if n > 0 else 0
    dec_df = rdf[~rdf["approved"]]

    if re.search(r'how many|count|total', q):
        if re.search(r'\bdeclined?\b', q):
            answer = f"**{len(dec_df):,}** declined transactions"
        elif re.search(r'\bapproved\b', q):
            answer = f"**{int(rdf['approved'].sum()):,}** approved transactions"
        else:
            answer = f"**{n:,}** transactions matched"
    elif re.search(r'approval rate|what.*(rate|percent)', q):
        answer = f"Approval rate: **{rate:.1f}%** across {n:,} transactions"
    elif re.search(r'top decline|main (decline|reason)|why.*declin|most common', q):
        if not dec_df.empty:
            vc = dec_df["decline_reason"].value_counts()
            answer = f"Top decline reason: **{vc.index[0]}** — {vc.iloc[0]:,} times ({vc.iloc[0]/vc.sum()*100:.0f}% of declines)"
    elif re.search(r'average|avg|mean.*amount', q):
        answer = f"Average transaction amount: **${rdf['amount'].mean():.2f}**"
    elif re.search(r'total volume|revenue|total amount', q):
        answer = f"Total volume: **${rdf['amount'].sum():,.0f}**"
    elif re.search(r'best processor|which processor', q):
        if n > 0:
            pg = rdf.groupby("processor")["approved_int"].mean() * 100
            best = pg.idxmax()
            answer = f"Best processor in this view: **{best}** at {pg.max():.1f}% approval"

    return {
        "filtered_df": rdf,
        "answer": answer,
        "any_filter": any_filter,
        "filters": {
            "countries": found_countries, "processors": found_processors,
            "methods": found_methods, "reasons": found_reasons,
            "day_range": day_range, "approved": approved_filter,
            "amount": amount_filter,
        },
    }


def render_data_results(query, parsed):
    rdf  = parsed["filtered_df"]
    n    = len(rdf)
    rate = rdf["approved_int"].mean() * 100 if n > 0 else 0
    dec  = int((~rdf["approved"]).sum()) if n > 0 else 0

    # Answer card (question detected)
    if parsed["answer"]:
        st.markdown(f"""
        <div style="background:#1C1433;border-radius:12px;padding:16px 20px;margin:6px 0 12px;">
          <div style="font-size:0.68rem;color:#CAFF00;font-weight:700;letter-spacing:0.1em;
                      text-transform:uppercase;margin-bottom:6px;">Answer</div>
          <div style="font-size:1.05rem;color:#FFFFFF;">{parsed['answer'].replace("**","<b>").replace("**","</b>")}</div>
          <div style="font-size:0.72rem;color:#9CA3AF;margin-top:6px;">Based on {n:,} matching transactions</div>
        </div>""", unsafe_allow_html=True)

    # Mini KPI row
    if n > 0:
        top_dec = rdf[~rdf["approved"]]["decline_reason"].value_counts()
        top_dec_label = f"{top_dec.index[0].replace('_',' ')} ({top_dec.iloc[0]/top_dec.sum()*100:.0f}%)" if not top_dec.empty else "—"
        st.markdown(f"""
        <div style="display:flex;gap:10px;margin:0 0 12px;">
          <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;
                      padding:12px 14px;box-shadow:0 1px 4px rgba(28,20,51,0.05);">
            <div style="font-size:0.65rem;color:#6B7280;text-transform:uppercase;
                        letter-spacing:0.07em;font-weight:700;">Transactions</div>
            <div style="font-size:1.4rem;font-weight:800;color:#1C1433;">{n:,}</div>
          </div>
          <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;
                      padding:12px 14px;box-shadow:0 1px 4px rgba(28,20,51,0.05);">
            <div style="font-size:0.65rem;color:#6B7280;text-transform:uppercase;
                        letter-spacing:0.07em;font-weight:700;">Approval Rate</div>
            <div style="font-size:1.4rem;font-weight:800;color:#166534;">{rate:.1f}%</div>
          </div>
          <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;
                      padding:12px 14px;box-shadow:0 1px 4px rgba(28,20,51,0.05);">
            <div style="font-size:0.65rem;color:#6B7280;text-transform:uppercase;
                        letter-spacing:0.07em;font-weight:700;">Declined</div>
            <div style="font-size:1.4rem;font-weight:800;color:#991B1B;">{dec:,}</div>
          </div>
          <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;
                      padding:12px 14px;box-shadow:0 1px 4px rgba(28,20,51,0.05);">
            <div style="font-size:0.65rem;color:#6B7280;text-transform:uppercase;
                        letter-spacing:0.07em;font-weight:700;">Top Decline</div>
            <div style="font-size:0.95rem;font-weight:700;color:#1C1433;margin-top:4px;">{top_dec_label}</div>
          </div>
          <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;
                      padding:12px 14px;box-shadow:0 1px 4px rgba(28,20,51,0.05);">
            <div style="font-size:0.65rem;color:#6B7280;text-transform:uppercase;
                        letter-spacing:0.07em;font-weight:700;">Avg Amount</div>
            <div style="font-size:1.4rem;font-weight:800;color:#1C1433;">${rdf['amount'].mean():.0f}</div>
          </div>
        </div>""", unsafe_allow_html=True)

        # Mini transaction table
        st.dataframe(
            rdf.sort_values("timestamp", ascending=False).head(15)[[
                "id", "timestamp", "country", "payment_method",
                "processor", "amount", "approved", "decline_reason"
            ]].reset_index(drop=True),
            use_container_width=True,
            height=280,
        )
    else:
        st.markdown("""
        <div style="padding:14px 18px;background:#FEF9C3;border:1px solid #F59E0B;
                    border-radius:10px;color:#92400E;font-size:0.88rem;">
            No transactions matched those filters. Try broadening your search.
        </div>""", unsafe_allow_html=True)


# ── Smart fuzzy search (section navigation) ───────────────────────────────────
def smart_search(query, df):
    import difflib
    if not query or len(query.strip()) < 2:
        return []
    q = query.lower().strip().replace("_", " ")
    results = []

    # ── 1. Transaction ID match ───────────────────────────────────────────────
    if "txn" in q or q.replace(" ", "").replace("-", "").isdigit():
        matches = df[df["id"].str.lower().str.contains(q.replace(" ", ""), na=False)].head(4)
        for _, row in matches.iterrows():
            status = "✅ Approved" if row["approved"] else f"❌ {row['decline_reason']}"
            results.append({
                "type": "transaction",
                "icon": "🧾",
                "label": row["id"],
                "detail": f"{row['country']} · {row['payment_method']} · ${row['amount']:.2f} · {status}",
                "link": "#transactions",
                "score": 1.0,
            })

    # ── 2. Dimension value fuzzy match ────────────────────────────────────────
    dim_config = [
        ("country",         df["country"].unique(),                  "#geography",  "🌍"),
        ("processor",       df["processor"].unique(),                 "#processors", "⚙️"),
        ("payment_method",  df["payment_method"].unique(),            "#geography",  "💳"),
        ("decline_reason",  df["decline_reason"].dropna().unique(),   "#declines",   "❌"),
    ]
    for dim, values, link, icon in dim_config:
        for val in values:
            val_norm = val.lower().replace("_", " ")
            score = 0.0
            if q in val_norm or val_norm in q:
                score = 0.95
            elif any(w in val_norm for w in q.split() if len(w) > 2):
                score = 0.78
            else:
                score = difflib.SequenceMatcher(None, q, val_norm).ratio()
            if score > 0.45:
                sub   = df[df[dim] == val]
                rate  = sub["approved_int"].mean() * 100
                count = len(sub)
                dec   = int((~sub["approved"]).sum())
                results.append({
                    "type":   "filter",
                    "icon":   icon,
                    "label":  val.replace("_", " ").title(),
                    "detail": f"{rate:.0f}% approval · {count:,} transactions · {dec:,} declined",
                    "link":   link,
                    "score":  score,
                })

    # ── 3. Section / keyword match ────────────────────────────────────────────
    section_keywords = [
        (["what changed", "insight", "anomal", "alert"],         "#what-changed",    "📊", "What Changed",           "Auto-detected anomalies in current view"),
        (["recommend", "action", "next step", "fix"],            "#recommendations", "💡", "Smart Recommendations",  "Actionable steps based on data"),
        (["what if", "simulat", "rout", "redirect"],             "#what-if",         "🔀", "What-If Simulator",      "Estimate impact of routing decisions"),
        (["cohort", "compar", "period", "before", "after"],      "#cohort",          "📅", "Cohort Comparison",      "Compare two time periods side by side"),
        (["time", "trend", "daily", "hourly", "volume"],         "#time-trends",     "📈", "Time Trends",            "Daily volume & approval rate over time"),
        (["geo", "map", "region", "country", "method"],          "#geography",       "🌍", "Geography & Methods",    "Approval rates by country & payment method"),
        (["processor", "process", "acquirer"],                   "#processors",      "⚙️", "Processor Performance",  "Processor comparison & country breakdown"),
        (["amount", "value", "bracket", "high value", "size"],   "#amounts",         "💰", "Amount Analysis",        "Approval by transaction size"),
        (["declin", "reason", "fail", "fraud", "3ds",
          "insufficient", "expired", "technical"],               "#declines",        "❌", "Decline Analysis",       "Decline reason breakdown"),
        (["outage", "nov 18", "processor b", "deep dive"],       "#anomalies",       "🚨", "Anomaly Deep-Dives",     "Processor B outage & 3DS spike"),
        (["transaction", "recent", "table", "list", "txn"],      "#transactions",    "🧾", "Recent Transactions",    "Sortable transaction table & export"),
    ]
    for keywords, link, icon, title, desc in section_keywords:
        best = 0.0
        for kw in keywords:
            if kw in q:
                best = max(best, 0.88)
            else:
                best = max(best, difflib.SequenceMatcher(None, q, kw).ratio() * 0.82)
        if best > 0.42:
            results.append({"type": "section", "icon": icon, "label": title,
                             "detail": desc, "link": link, "score": best})

    # ── 4. Deduplicate & sort ─────────────────────────────────────────────────
    seen, unique = set(), []
    for r in sorted(results, key=lambda x: -x["score"]):
        if r["label"] not in seen:
            seen.add(r["label"])
            unique.append(r)
    return unique[:8]


def render_search_results(query, results):
    if not results:
        st.markdown(f"""
        <div style="margin:6px 0 16px;padding:12px 18px;background:#F9FAFB;border-radius:10px;
                    border:1px solid #E5E7EB;color:#6B7280;font-size:0.85rem;">
            No results for <b>"{query}"</b> — try a country, processor, payment method, or section name.
        </div>""", unsafe_allow_html=True)
        return

    badge_styles = {
        "transaction": ("#E0F2FE", "#0369A1"),
        "filter":      ("#F0FDF4", "#166534"),
        "section":     ("#F3F0FF", "#5B21B6"),
    }
    cards = ""
    for r in results:
        bg, fg = badge_styles.get(r["type"], ("#F9FAFB", "#374151"))
        cards += f"""
        <a href="{r['link']}" style="text-decoration:none;">
          <div style="background:#FFFFFF;border:1.5px solid #E5E7EB;border-radius:10px;
                      padding:11px 14px;display:flex;align-items:center;gap:11px;
                      transition:border-color 0.15s,box-shadow 0.15s;"
               onmouseover="this.style.borderColor='#CAFF00';this.style.boxShadow='0 2px 10px rgba(28,20,51,0.08)'"
               onmouseout="this.style.borderColor='#E5E7EB';this.style.boxShadow='none'">
            <span style="font-size:1.25rem;flex-shrink:0;">{r['icon']}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;color:#1C1433;font-size:0.87rem;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{r['label']}</div>
              <div style="color:#6B7280;font-size:0.74rem;margin-top:2px;">{r['detail']}</div>
            </div>
            <span style="background:{bg};color:{fg};padding:2px 8px;border-radius:20px;
                         font-size:0.63rem;font-weight:700;text-transform:uppercase;
                         letter-spacing:0.05em;white-space:nowrap;flex-shrink:0;">{r['type']}</span>
            <span style="color:#9CA3AF;font-size:0.85rem;flex-shrink:0;">→</span>
          </div>
        </a>"""

    st.markdown(f"""
    <div style="margin:6px 0 16px 0;">
      <div style="font-size:0.68rem;color:#9CA3AF;margin-bottom:8px;font-weight:700;
                  text-transform:uppercase;letter-spacing:0.08em;">
        {len(results)} result{'s' if len(results)!=1 else ''} for "{query}"
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">{cards}</div>
    </div>""", unsafe_allow_html=True)


# ── Live alerts banner (auto-refreshes every 60s) ────────────────────────────
@st.fragment(run_every=60)
def live_alerts_banner():
    import datetime
    now = df["timestamp"].max()
    window_start = now - pd.Timedelta(hours=3)
    prev_start   = window_start - pd.Timedelta(hours=3)

    recent   = df[df["timestamp"] >= window_start]
    previous = df[(df["timestamp"] >= prev_start) & (df["timestamp"] < window_start)]

    alerts = []

    if len(recent) >= 5:
        recent_rate = recent["approved_int"].mean() * 100

        # Processor outage: <30% approval with at least 5 transactions
        proc_rates = recent.groupby("processor").agg(
            total=("id", "count"), approved=("approved_int", "sum")
        ).reset_index()
        proc_rates["rate"] = proc_rates["approved"] / proc_rates["total"] * 100
        for _, row in proc_rates.iterrows():
            if row["total"] >= 5 and row["rate"] < 30:
                dec_sub = recent[(recent["processor"] == row["processor"]) & ~recent["approved"]]
                top_r = dec_sub["decline_reason"].value_counts()
                top_label = f" — {top_r.index[0]} ({top_r.iloc[0]/len(dec_sub)*100:.0f}% of declines)" if not top_r.empty else ""
                alerts.append({"level": "critical",
                    "msg": f"🔴 &nbsp;<b>OUTAGE — {row['processor']}</b>: {row['rate']:.0f}% approval in last 3h ({int(row['total'])} txns){top_label}"})

        # Overall rate drop vs previous 3h window
        if len(previous) >= 5:
            prev_rate = previous["approved_int"].mean() * 100
            drop = prev_rate - recent_rate
            if drop > 15:
                lvl = "critical" if drop > 25 else "warning"
                icon = "🔴" if drop > 25 else "🟡"
                alerts.append({"level": lvl,
                    "msg": f"{icon} &nbsp;<b>Approval rate falling</b>: {recent_rate:.0f}% now vs {prev_rate:.0f}% in prior window (−{drop:.0f}pp)"})

        # Decline reason spike: one reason >55% of all declines
        dec_recent = recent[~recent["approved"]]
        if len(dec_recent) >= 5:
            vc = dec_recent["decline_reason"].value_counts()
            top_pct = vc.iloc[0] / vc.sum() * 100
            if top_pct > 55:
                alerts.append({"level": "warning",
                    "msg": f"🟡 &nbsp;<b>{vc.index[0]} spike</b>: {top_pct:.0f}% of recent declines — possible systemic issue"})

        # High-value drop: >$400 transactions with <40% approval
        hv = recent[recent["amount"] > 400]
        if len(hv) >= 5:
            hv_rate = hv["approved_int"].mean() * 100
            if hv_rate < 40:
                alerts.append({"level": "warning",
                    "msg": f"🟡 &nbsp;<b>High-value transactions struggling</b>: {hv_rate:.0f}% approval on {len(hv)} transactions >$400"})
    else:
        recent_rate = 0

    last_refresh = datetime.datetime.now().strftime("%H:%M:%S")
    n_recent = len(recent)

    if alerts:
        is_critical = any(a["level"] == "critical" for a in alerts)
        bg    = "#FEE2E2" if is_critical else "#FFFBEB"
        border = "#EF4444" if is_critical else "#F59E0B"
        rows  = "".join(f'<div style="margin:3px 0 1px 0;font-size:0.88rem;">{a["msg"]}</div>' for a in alerts)
        st.markdown(f"""
        <div style="background:{bg};border:1.5px solid {border};border-radius:10px;padding:12px 18px;margin-bottom:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:0.7rem;font-weight:700;color:#6B7280;letter-spacing:0.08em;">⚡ LIVE ALERTS — last 3 hours</span>
                <span style="font-size:0.68rem;color:#9CA3AF;">auto-refreshed {last_refresh} · {n_recent} transactions scanned</span>
            </div>
            {rows}
        </div>""", unsafe_allow_html=True)
    else:
        rate_str = f"{recent_rate:.0f}% approval" if n_recent >= 5 else "insufficient data"
        st.markdown(f"""
        <div style="background:#F0FDF4;border:1.5px solid #22C55E;border-radius:10px;padding:10px 18px;margin-bottom:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.88rem;color:#166534;font-weight:600;">✅ &nbsp;All clear — no anomalies in the last 3 hours &nbsp;<span style="font-weight:400;">({n_recent} transactions · {rate_str})</span></span>
                <span style="font-size:0.68rem;color:#9CA3AF;">⚡ auto-refreshed {last_refresh}</span>
            </div>
        </div>""", unsafe_allow_html=True)


# ── URL param helpers (shareable URLs) ────────────────────────────────────────
def _qp_list(key, all_opts):
    raw = st.query_params.get(key, "")
    if not raw:
        return list(all_opts)
    vals = [v.strip() for v in raw.split(",")]
    valid = [v for v in vals if v in all_opts]
    return valid if valid else list(all_opts)

def _qp_range(key):
    raw = st.query_params.get(key, "")
    if raw:
        try:
            a, b = raw.split("-", 1)
            return (max(1, int(a)), min(30, int(b)))
        except (ValueError, AttributeError):
            pass
    return (1, 30)

# ── Sidebar filters ───────────────────────────────────────────────────────────
st.sidebar.image("Yuno logo.png", use_container_width=True)
st.sidebar.markdown(
    '<p style="font-size:0.65rem;color:#6B5F8A;text-transform:uppercase;'
    'letter-spacing:0.1em;font-weight:700;margin:4px 0 10px 2px;">Filters</p>',
    unsafe_allow_html=True
)

_all_countries  = sorted(df["country"].unique())
_all_processors = sorted(df["processor"].unique())
_all_methods    = sorted(df["payment_method"].unique())
_all_amounts    = ["$0–50", "$50–200", "$200–500", "$500+"]
_all_reasons    = sorted(df["decline_reason"].dropna().unique())

with st.sidebar.expander("📅  Date Range"):
    day_range = st.slider("Day of November", 1, 30, _qp_range("days"), label_visibility="collapsed")
    st.caption(f"Nov {day_range[0]} – {day_range[1]}")

with st.sidebar.expander("🌍  Country"):
    countries = st.multiselect("Country", _all_countries,
                               default=_qp_list("countries", _all_countries),
                               label_visibility="collapsed")

with st.sidebar.expander("⚙️  Processor"):
    processors = st.multiselect("Processor", _all_processors,
                                default=_qp_list("processors", _all_processors),
                                label_visibility="collapsed")

with st.sidebar.expander("💳  Payment Method"):
    methods = st.multiselect("Payment Method", _all_methods,
                             default=_qp_list("methods", _all_methods),
                             label_visibility="collapsed")

with st.sidebar.expander("💰  Amount Bracket"):
    amount_bins = st.multiselect("Amount Bracket", _all_amounts,
                                 default=_qp_list("amounts", _all_amounts),
                                 label_visibility="collapsed")

with st.sidebar.expander("❌  Decline Reason"):
    all_reasons     = _all_reasons
    decline_reasons = st.multiselect("Decline Reason", all_reasons,
                                     default=_qp_list("reasons", all_reasons),
                                     label_visibility="collapsed")


# Active click-drill display + clear button
active_drills = {k: v for k, v in {
    "Country": st.session_state.drill_country,
    "Processor": st.session_state.drill_processor,
    "Method": st.session_state.drill_method,
    "Date": str(st.session_state.drill_date) if st.session_state.drill_date else None,
}.items() if v}
if active_drills:
    st.sidebar.divider()
    st.sidebar.markdown("**Click-drill active:**")
    for dim, val in active_drills.items():
        st.sidebar.markdown(f"- {dim}: `{val}`")
    if st.sidebar.button("Clear click filters"):
        st.session_state.drill_country = None
        st.session_state.drill_processor = None
        st.session_state.drill_method = None
        st.session_state.drill_date = None
        st.rerun()

# ── Sync current state back to URL (makes every view shareable) ───────────────
_url_params = {
    "days":       f"{day_range[0]}-{day_range[1]}",
    "countries":  ",".join(countries),
    "processors": ",".join(processors),
    "methods":    ",".join(methods),
    "amounts":    ",".join(amount_bins),
    "reasons":    ",".join(decline_reasons),
}
if st.session_state.drill_country:
    _url_params["drill_country"] = st.session_state.drill_country
if st.session_state.drill_processor:
    _url_params["drill_processor"] = st.session_state.drill_processor
if st.session_state.drill_method:
    _url_params["drill_method"] = st.session_state.drill_method
st.query_params.update(_url_params)
for _dk in ["drill_country", "drill_processor", "drill_method"]:
    if not st.session_state.get(_dk) and _dk in st.query_params:
        del st.query_params[_dk]

st.sidebar.divider()
st.sidebar.markdown("**Share this view**")
st.sidebar.caption("The browser URL updates with every filter change. Copy it to share this exact view.")

# ── Apply sidebar filters ─────────────────────────────────────────────────────
overview_df = df[
    df["day"].between(day_range[0], day_range[1]) &
    df["country"].isin(countries) &
    df["processor"].isin(processors) &
    df["payment_method"].isin(methods) &
    df["amount_bin"].isin(amount_bins)
].copy()
overview_df = overview_df[overview_df["approved"] | overview_df["decline_reason"].isin(decline_reasons)]

# Apply click drill-downs for detail views
fdf = overview_df.copy()
if st.session_state.drill_country:
    fdf = fdf[fdf["country"] == st.session_state.drill_country]
if st.session_state.drill_processor:
    fdf = fdf[fdf["processor"] == st.session_state.drill_processor]
if st.session_state.drill_method:
    fdf = fdf[fdf["payment_method"] == st.session_state.drill_method]

# ── Title & KPIs ──────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="background:linear-gradient(135deg,#1C1433 0%,#2D1F4E 60%,#1C1433 100%);border-radius:16px;padding:0;margin-bottom:4px;border:1px solid #3D3257;box-shadow:0 6px 0 #0A0519,0 8px 32px rgba(0,0,0,0.28);overflow:hidden;">
  <div style="height:4px;background:linear-gradient(90deg,#CAFF00,#8BCC00 60%,transparent);"></div>
  <div style="padding:24px 28px 20px 28px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
      <div style="background:#CAFF00;border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;box-shadow:0 3px 0 #8BCC00;">✈</div>
      <div>
        <div style="font-size:0.62rem;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#CAFF00;margin-bottom:3px;">Luna Travel</div>
        <div style="font-size:1.55rem;font-weight:900;color:#FFFFFF;letter-spacing:-0.02em;line-height:1.1;">Payment Acceptance Dashboard</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <span style="background:rgba(202,255,0,0.12);border:1px solid rgba(202,255,0,0.28);color:#CAFF00;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.04em;">November 2023</span>
      <span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#D8D5E8;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:20px;">Nov {day_range[0]}–{day_range[1]}</span>
      <span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#D8D5E8;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:20px;">6,000 transactions · Mock data</span>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

live_alerts_banner()

# ── Smart search bar ──────────────────────────────────────────────────────────
st.markdown('<div style="margin:16px 0 4px 0;">', unsafe_allow_html=True)
search_query = st.text_input(
    "search",
    placeholder="Ask me anything... just start typing",
    key="global_search",
    label_visibility="collapsed",
)
st.markdown('</div>', unsafe_allow_html=True)

# Inject JS so results update on every keystroke (not just Enter/blur)
components.html("""
<script>
(function() {
    var timer;
    function attach() {
        var inputs = window.parent.document.querySelectorAll('input');
        var box = null;
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].placeholder && inputs[i].placeholder.indexOf('Ask me anything') !== -1) {
                box = inputs[i]; break;
            }
        }
        if (!box) { setTimeout(attach, 300); return; }
        if (box._liveSearch) return;
        box._liveSearch = true;
        box.addEventListener('input', function() {
            clearTimeout(timer);
            timer = setTimeout(function() {
                var sel = box.selectionStart;
                // blur commits the value to Streamlit; refocus keeps UX smooth
                box.blur();
                requestAnimationFrame(function() {
                    box.focus();
                    try { box.setSelectionRange(sel, sel); } catch(e) {}
                });
            }, 300);
        });
    }
    var attempts = 0;
    function tryAttach() {
        attempts++;
        if (attempts > 30) return;
        try { attach(); } catch(e) { setTimeout(tryAttach, 300); }
    }
    setTimeout(tryAttach, 500);
})();
</script>
""", height=1, scrolling=False)

if search_query and len(search_query.strip()) >= 2:
    parsed = parse_query(search_query, df)

    if parsed["any_filter"] or parsed["answer"]:
        # Show live data results first
        st.markdown(
            f'<div style="font-size:0.68rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;'
            f'letter-spacing:0.08em;margin-bottom:8px;">Live results for "{search_query}"</div>',
            unsafe_allow_html=True
        )
        render_data_results(search_query, parsed)

    # Always show section navigation cards below
    nav_results = smart_search(search_query, df)
    nav_results = [r for r in nav_results if r["type"] == "section"]
    if nav_results:
        st.markdown(
            '<div style="font-size:0.68rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;'
            'letter-spacing:0.08em;margin:12px 0 8px;">Jump to section</div>',
            unsafe_allow_html=True
        )
        render_search_results(search_query, nav_results)

    if not parsed["any_filter"] and not parsed["answer"] and not nav_results:
        st.markdown(
            f'<div style="padding:12px 18px;background:#F9FAFB;border-radius:10px;'
            f'border:1px solid #E5E7EB;color:#6B7280;font-size:0.85rem;">'
            f'No results for <b>"{search_query}"</b> — try a country, processor, payment method, or a question.</div>',
            unsafe_allow_html=True
        )

if active_drills:
    drill_str = " · ".join(f"{k}: **{v}**" for k, v in active_drills.items())
    st.info(f"Drill-down active — {drill_str}. Click **Clear click filters** in the sidebar to reset.")

total = len(fdf)
approved_n = int(fdf["approved"].sum())
declined_n = total - approved_n
approval_rate = approved_n / total * 100 if total else 0
total_volume = fdf["amount"].sum()

st.markdown(f"""
<style>
.kpi-grid {{
    display: flex;
    gap: 12px;
    margin: 8px 0 4px 0;
}}
.kpi-card {{
    flex: 1;
    background: #FFFFFF;
    border: 1.5px solid #E5E7EB;
    border-radius: 14px;
    padding: 18px 20px 14px 20px;
    box-shadow: 0 5px 0 #D1D5DB, 0 2px 10px rgba(28,20,51,0.06);
    text-decoration: none !important;
    display: block;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease;
}}
.kpi-card:hover {{
    border-color: #CAFF00;
    box-shadow: 0 5px 0 #B0CC00, 0 4px 18px rgba(28,20,51,0.10);
    transform: translateY(-1px);
    text-decoration: none !important;
}}
.kpi-card:active {{
    transform: translateY(4px);
    box-shadow: 0 1px 0 #D1D5DB, 0 1px 4px rgba(28,20,51,0.05);
}}
.kpi-label {{
    font-size: 0.67rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #6B7280;
    font-weight: 700;
    margin-bottom: 8px;
}}
.kpi-value {{
    font-size: 1.75rem;
    font-weight: 800;
    color: #1C1433;
    line-height: 1.1;
    letter-spacing: -0.02em;
}}
.kpi-sub {{
    font-size: 0.68rem;
    color: #9CA3AF;
    margin-top: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}}
.kpi-card:hover .kpi-sub {{
    color: #1C1433;
}}
</style>
<div class="kpi-grid">
    <a class="kpi-card" href="#time-trends">
        <div class="kpi-label">Total Transactions</div>
        <div class="kpi-value">{total:,}</div>
        <div class="kpi-sub">View time trends →</div>
    </a>
    <a class="kpi-card" href="#time-trends">
        <div class="kpi-label">Approved</div>
        <div class="kpi-value" style="color:#166534;">{approved_n:,}</div>
        <div class="kpi-sub">View time trends →</div>
    </a>
    <a class="kpi-card" href="#declines">
        <div class="kpi-label">Declined</div>
        <div class="kpi-value" style="color:#991B1B;">{declined_n:,}</div>
        <div class="kpi-sub">View decline analysis →</div>
    </a>
    <a class="kpi-card" href="#what-changed">
        <div class="kpi-label">Approval Rate</div>
        <div class="kpi-value">{approval_rate:.1f}%</div>
        <div class="kpi-sub">View insights →</div>
    </a>
    <a class="kpi-card" href="#amounts">
        <div class="kpi-label">Total Volume</div>
        <div class="kpi-value">${total_volume:,.0f}</div>
        <div class="kpi-sub">View amount analysis →</div>
    </a>
</div>
""", unsafe_allow_html=True)

st.divider()

# ── Section navigation ─────────────────────────────────────────────────────────
st.markdown("""
<style>
.nav-pill {
    display: inline-block;
    padding: 7px 16px;
    background-color: #1C1433;
    color: #D8D5E8 !important;
    border-radius: 100px;
    text-decoration: none !important;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    border: 1px solid #3D3257;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.nav-pill:hover {
    background-color: #CAFF00 !important;
    color: #1C1433 !important;
    border-color: #CAFF00 !important;
    text-decoration: none !important;
}
</style>
<div style="display:flex; flex-wrap:wrap; gap:8px; padding:4px 0 20px 0;">
    <a class="nav-pill" href="#what-changed">📊 What Changed</a>
    <a class="nav-pill" href="#recommendations">💡 Recommendations</a>
    <a class="nav-pill" href="#what-if">🔀 What-If Simulator</a>
    <a class="nav-pill" href="#cohort">📅 Cohort Comparison</a>
    <a class="nav-pill" href="#time-trends">📈 Time Trends</a>
    <a class="nav-pill" href="#geography">🌍 Geography & Methods</a>
    <a class="nav-pill" href="#processors">⚙️ Processors</a>
    <a class="nav-pill" href="#amounts">💰 Amount Analysis</a>
    <a class="nav-pill" href="#declines">❌ Decline Analysis</a>
    <a class="nav-pill" href="#anomalies">🔍 Anomaly Deep-Dives</a>
    <a class="nav-pill" href="#transactions">🧾 Recent Transactions</a>
</div>
""", unsafe_allow_html=True)

# ── What Changed? ─────────────────────────────────────────────────────────────
st.markdown('<div id="what-changed"></div>', unsafe_allow_html=True)
insights = generate_insights(fdf)
if insights:
    st.subheader("What Changed? — Auto-detected Insights")
    st.caption(f"{len(insights)} anomaly/insight{'s' if len(insights) != 1 else ''} detected in current view")
    for ins in insights:
        if ins["level"] == "error":
            st.error(f"🔴 **{ins['title']}** — {ins['text']}")
        else:
            st.warning(f"🟡 **{ins['title']}** — {ins['text']}")
else:
    st.success("No anomalies detected in the current view.")
st.divider()

# ── Smart Recommendations ─────────────────────────────────────────────────────
st.markdown('<div id="recommendations"></div>', unsafe_allow_html=True)
recs = generate_recommendations(fdf)
if recs:
    st.subheader("Smart Recommendations")
    st.caption(f"{len(recs)} action{'s' if len(recs) != 1 else ''} suggested based on current data patterns")
    for rec in recs:
        if rec["priority"] == "high":
            st.error(f"🔴 **[HIGH] {rec['action']}** — {rec['detail']}")
        elif rec["priority"] == "medium":
            st.warning(f"🟡 **[MEDIUM] {rec['action']}** — {rec['detail']}")
        else:
            st.info(f"🔵 **[LOW] {rec['action']}** — {rec['detail']}")
    st.divider()

# ── What-If Simulator ─────────────────────────────────────────────────────────
st.markdown('<div id="what-if"></div>', unsafe_allow_html=True)
st.subheader("What-If Simulator")
st.caption("Estimate the impact of routing decisions. Simulated approvals are based on the target processor's observed rates for the same country × method × amount bracket combinations.")

w1, w2, w3 = st.columns(3)
with w1:
    sim_source = st.selectbox("Route away from", _all_processors, key="sim_source")
with w2:
    sim_target_opts = [p for p in _all_processors if p != sim_source]
    sim_target = st.selectbox("Route to", sim_target_opts, key="sim_target")
with w3:
    sim_days = st.slider("During Nov days", 1, 30, (18, 18), key="sim_days")

w4, w5 = st.columns(2)
with w4:
    sim_countries = st.multiselect("Limit to countries (blank = all)", _all_countries, key="sim_countries")
with w5:
    sim_methods = st.multiselect("Limit to methods (blank = all)", _all_methods, key="sim_methods")

# ── Build simulation ──────────────────────────────────────────────────────────
affected = overview_df[
    (overview_df["processor"] == sim_source) &
    (overview_df["day"].between(sim_days[0], sim_days[1]))
].copy()
if sim_countries:
    affected = affected[affected["country"].isin(sim_countries)]
if sim_methods:
    affected = affected[affected["payment_method"].isin(sim_methods)]

target_df = overview_df[overview_df["processor"] == sim_target]
target_overall = target_df["approved_int"].mean() if len(target_df) > 0 else 0.75

# Target rates by country × method × amount_bin
target_rates = (
    target_df.groupby(["country", "payment_method", "amount_bin"], observed=True)
    .agg(approved_sum=("approved_int", "sum"), total=("id", "count"))
    .reset_index()
)
target_rates["rate"] = target_rates["approved_sum"] / target_rates["total"]

# Target rates by country × method (fallback)
target_rates_cm = (
    target_df.groupby(["country", "payment_method"])
    .agg(approved_sum=("approved_int", "sum"), total=("id", "count"))
    .reset_index()
)
target_rates_cm["rate_cm"] = target_rates_cm["approved_sum"] / target_rates_cm["total"]

if len(affected) > 0:
    # Merge granular rates
    sim_df = affected.merge(
        target_rates[["country", "payment_method", "amount_bin", "rate"]],
        on=["country", "payment_method", "amount_bin"], how="left"
    ).merge(
        target_rates_cm[["country", "payment_method", "rate_cm"]],
        on=["country", "payment_method"], how="left"
    )
    sim_df["sim_rate"] = sim_df["rate"].fillna(sim_df["rate_cm"]).fillna(target_overall)

    n_aff        = len(sim_df)
    actual_appr  = int(sim_df["approved"].sum())
    actual_rate  = actual_appr / n_aff * 100
    sim_appr     = sim_df["sim_rate"].sum()           # expected approvals
    sim_rate     = sim_appr / n_aff * 100
    delta_appr   = sim_appr - actual_appr
    avg_amount   = sim_df["amount"].mean()
    recov_rev    = delta_appr * avg_amount

    # KPI cards
    r1, r2, r3, r4, r5 = st.columns(5)
    r1.metric("Transactions affected", f"{n_aff:,}")
    r2.metric("Actual approvals",      f"{actual_appr:,}", f"{actual_rate:.1f}%")
    r3.metric("Simulated approvals",   f"{sim_appr:.0f}",  f"{sim_rate:.1f}%")
    r4.metric("Approval rate delta",   f"{sim_rate - actual_rate:+.1f}pp")
    r5.metric("Est. recovered revenue",f"${recov_rev:,.0f}", f"+{delta_appr:.0f} txns")

    # Breakdown charts
    def _sim_agg(col):
        g = sim_df.groupby(col).agg(
            actual_approved=("approved_int", "sum"),
            sim_approved=("sim_rate", "sum"),
            total=("id", "count")
        ).reset_index()
        g["actual_rate"] = g["actual_approved"] / g["total"] * 100
        g["sim_rate_pct"] = g["sim_approved"]   / g["total"] * 100
        return g

    agg_country = _sim_agg("country")
    agg_method  = _sim_agg("payment_method")

    # Reshape for grouped bar
    def _melt_for_plot(g, col):
        a = g[[col, "actual_rate"]].rename(columns={"actual_rate": "approval_rate"})
        a["scenario"] = f"Actual ({sim_source})"
        b = g[[col, "sim_rate_pct"]].rename(columns={"sim_rate_pct": "approval_rate"})
        b["scenario"] = f"Simulated ({sim_target})"
        return pd.concat([a, b])

    sc1, sc2 = st.columns(2)
    with sc1:
        comp = _melt_for_plot(agg_country, "country")
        fig = px.bar(comp, x="country", y="approval_rate", color="scenario",
                     barmode="group", title="Actual vs Simulated — by Country",
                     color_discrete_map={
                         f"Actual ({sim_source})": "#E74C3C",
                         f"Simulated ({sim_target})": "#37B679"
                     })
        fig.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
        _plot(fig, use_container_width=True)

    with sc2:
        comp = _melt_for_plot(agg_method, "payment_method")
        fig = px.bar(comp, x="payment_method", y="approval_rate", color="scenario",
                     barmode="group", title="Actual vs Simulated — by Method",
                     color_discrete_map={
                         f"Actual ({sim_source})": "#E74C3C",
                         f"Simulated ({sim_target})": "#37B679"
                     })
        fig.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
        _plot(fig, use_container_width=True)

    # Daily impact chart (if date range > 1 day)
    if sim_days[1] > sim_days[0]:
        agg_day = sim_df.groupby("day").agg(
            actual_approved=("approved_int", "sum"),
            sim_approved=("sim_rate", "sum"),
            total=("id", "count")
        ).reset_index()
        agg_day["actual_rate"]  = agg_day["actual_approved"] / agg_day["total"] * 100
        agg_day["sim_rate_pct"] = agg_day["sim_approved"]    / agg_day["total"] * 100
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=agg_day["day"], y=agg_day["actual_rate"],
                                 name=f"Actual ({sim_source})", mode="lines+markers",
                                 line=dict(color="#E74C3C")))
        fig.add_trace(go.Scatter(x=agg_day["day"], y=agg_day["sim_rate_pct"],
                                 name=f"Simulated ({sim_target})", mode="lines+markers",
                                 line=dict(color="#37B679", dash="dash")))
        fig.update_layout(title="Daily Approval Rate: Actual vs Simulated",
                          xaxis_title="Day of November", yaxis_title="Approval Rate (%)",
                          yaxis_range=[0, 100])
        _plot(fig, use_container_width=True)
else:
    st.info(f"No transactions found for {sim_source} during Nov {sim_days[0]}–{sim_days[1]} with the selected filters.")

st.divider()

# ── Cohort Comparison ─────────────────────────────────────────────────────────
st.markdown('<div id="cohort"></div>', unsafe_allow_html=True)
st.subheader("Cohort Comparison")
st.caption("Compare two custom time windows side by side — using current sidebar filters")

co1, co2 = st.columns(2)
with co1:
    period_a = st.slider("Period A (Nov days)", 1, 30, (1, 15),  key="period_a")
with co2:
    period_b = st.slider("Period B (Nov days)", 1, 30, (16, 30), key="period_b")

label_a = f"Period A  (Nov {period_a[0]}–{period_a[1]})"
label_b = f"Period B  (Nov {period_b[0]}–{period_b[1]})"

df_a = overview_df[overview_df["day"].between(period_a[0], period_a[1])].copy()
df_b = overview_df[overview_df["day"].between(period_b[0], period_b[1])].copy()

def _kpis(d):
    t = len(d)
    a = int(d["approved"].sum())
    return {"total": t, "approved": a, "declined": t - a,
            "rate": a / t * 100 if t else 0, "volume": d["amount"].sum()}

ka, kb = _kpis(df_a), _kpis(df_b)

# KPI delta row
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Approval Rate A",  f"{ka['rate']:.1f}%",   delta=f"{ka['rate']  - kb['rate']:+.1f}pp vs B")
c2.metric("Approval Rate B",  f"{kb['rate']:.1f}%")
c3.metric("Transactions A",   f"{ka['total']:,}",      delta=f"{ka['total'] - kb['total']:+,} vs B")
c4.metric("Declined A",       f"{ka['declined']:,}",   delta=f"{ka['declined'] - kb['declined']:+,} vs B", delta_color="inverse")
c5.metric("Volume A",         f"${ka['volume']:,.0f}", delta=f"${ka['volume'] - kb['volume']:+,.0f} vs B")

# Helper: aggregate by dimension for both periods
def _cohort_agg(da, db, col):
    def _agg(d, lbl):
        g = d.groupby(col).agg(total=("id","count"), approved_sum=("approved_int","sum")).reset_index()
        g["approval_rate"] = g["approved_sum"] / g["total"] * 100
        g["period"] = lbl
        return g
    return pd.concat([_agg(da, label_a), _agg(db, label_b)])

period_colors = {label_a: "#6C5CE7", label_b: "#F77F00"}

comp_country  = _cohort_agg(df_a, df_b, "country")
comp_method   = _cohort_agg(df_a, df_b, "payment_method")
comp_proc     = _cohort_agg(df_a, df_b, "processor")

def _dec_counts(d, lbl):
    g = d[~d["approved"]]["decline_reason"].value_counts().reset_index()
    g.columns = ["reason", "count"]
    g["period"] = lbl
    return g
comp_dec = pd.concat([_dec_counts(df_a, label_a), _dec_counts(df_b, label_b)])

# Charts
ch1, ch2 = st.columns(2)
with ch1:
    fig = px.bar(comp_country, x="country", y="approval_rate", color="period",
                 barmode="group", title="Approval Rate by Country: A vs B",
                 color_discrete_map=period_colors)
    fig.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
    _plot(fig, use_container_width=True)

with ch2:
    fig = px.bar(comp_method, x="payment_method", y="approval_rate", color="period",
                 barmode="group", title="Approval Rate by Method: A vs B",
                 color_discrete_map=period_colors)
    fig.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
    _plot(fig, use_container_width=True)

ch3, ch4 = st.columns(2)
with ch3:
    fig = px.bar(comp_proc, x="processor", y="approval_rate", color="period",
                 barmode="group", title="Approval Rate by Processor: A vs B",
                 color_discrete_map=period_colors)
    fig.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
    _plot(fig, use_container_width=True)

with ch4:
    fig = px.bar(comp_dec, x="reason", y="count", color="period",
                 barmode="group", title="Decline Reasons: A vs B",
                 color_discrete_map=period_colors)
    fig.update_layout(xaxis_title="", yaxis_title="Count")
    _plot(fig, use_container_width=True)

st.divider()

# ── Section 1: Time Trends ────────────────────────────────────────────────────
st.markdown('<div id="time-trends"></div>', unsafe_allow_html=True)
st.subheader("Time Trends")

daily = fdf.groupby("date").agg(
    transactions=("id", "count"),
    approved_sum=("approved_int", "sum")
).reset_index()
daily["approved_pct"] = daily["approved_sum"] / daily["transactions"] * 100
daily["declined"] = daily["transactions"] - daily["approved_sum"]
top_dec_day = (
    fdf[~fdf["approved"]].groupby("date")["decline_reason"]
    .agg(lambda x: top_val(x)).reset_index().rename(columns={"decline_reason": "top_decline"})
)
daily = daily.merge(top_dec_day, on="date", how="left")
daily["top_decline"] = daily["top_decline"].fillna("N/A")

hourly = fdf.groupby("hour").agg(
    transactions=("id", "count"),
    approved_sum=("approved_int", "sum")
).reset_index()
hourly["approved_pct"] = hourly["approved_sum"] / hourly["transactions"] * 100

t1, t2 = st.columns(2)

with t1:
    vol_type = st.radio("Volume chart", ["Bar", "Line"], horizontal=True, key="vol_type")
    if vol_type == "Bar":
        fig_vol = go.Figure(go.Bar(
            x=daily["date"], y=daily["transactions"],
            marker_color="#6C5CE7",
            customdata=daily[["approved_sum", "declined", "top_decline"]].values,
            hovertemplate=(
                "<b>%{x}</b><br>"
                "Transactions: %{y:,}<br>"
                "Approved: %{customdata[0]:,}<br>"
                "Declined: %{customdata[1]:,}<br>"
                "Top decline reason: %{customdata[2]}"
                "<extra></extra>"
            )
        ))
    else:
        fig_vol = go.Figure(go.Scatter(
            x=daily["date"], y=daily["transactions"],
            mode="lines+markers", line=dict(color="#6C5CE7"),
            customdata=daily[["approved_sum", "declined", "top_decline"]].values,
            hovertemplate=(
                "<b>%{x}</b><br>"
                "Transactions: %{y:,}<br>"
                "Approved: %{customdata[0]:,}<br>"
                "Declined: %{customdata[1]:,}<br>"
                "Top decline reason: %{customdata[2]}"
                "<extra></extra>"
            )
        ))
    fig_vol.update_layout(title="Daily Transaction Volume — click a bar to drill down", xaxis_title="", yaxis_title="Transactions")
    ev_vol = _plot(fig_vol, on_select="rerun", use_container_width=True)
    try:
        if ev_vol.selection.points:
            clicked_x = ev_vol.selection.points[0].get("x")
            if clicked_x:
                parsed = pd.to_datetime(clicked_x).date()
                new_val = None if parsed == st.session_state.drill_date else parsed
                if new_val != st.session_state.drill_date:
                    st.session_state.drill_date = new_val
                    st.rerun()
    except (AttributeError, KeyError, IndexError):
        pass

with t2:
    rate_type = st.radio("Approval rate chart", ["Line", "Bar"], horizontal=True, key="rate_type")
    hover_rate = (
        "<b>%{x}</b><br>"
        "Approval rate: %{y:.1f}%<br>"
        "Transactions: %{customdata[0]:,}<br>"
        "Top decline: %{customdata[1]}"
        "<extra></extra>"
    )
    cd_rate = daily[["transactions", "top_decline"]].values
    if rate_type == "Line":
        fig_rate = go.Figure(go.Scatter(
            x=daily["date"], y=daily["approved_pct"],
            mode="lines+markers", line=dict(color="#37B679"),
            customdata=cd_rate, hovertemplate=hover_rate
        ))
    else:
        fig_rate = go.Figure(go.Bar(
            x=daily["date"], y=daily["approved_pct"],
            marker_color="#37B679",
            customdata=cd_rate, hovertemplate=hover_rate
        ))
    fig_rate.add_hline(y=75, line_dash="dash", line_color="gray", annotation_text="75% target")
    fig_rate.update_layout(title="Daily Approval Rate (%) — click a point to drill down", xaxis_title="", yaxis_title="Approval Rate (%)", yaxis_range=[0, 100])
    ev_rate = _plot(fig_rate, on_select="rerun", use_container_width=True)
    try:
        if ev_rate.selection.points:
            clicked_x = ev_rate.selection.points[0].get("x")
            if clicked_x:
                parsed = pd.to_datetime(clicked_x).date()
                new_val = None if parsed == st.session_state.drill_date else parsed
                if new_val != st.session_state.drill_date:
                    st.session_state.drill_date = new_val
                    st.rerun()
    except (AttributeError, KeyError, IndexError):
        pass

# ── Transaction drill-down (date click) ──────────────────────────────────────
if st.session_state.drill_date:
    drill_date = st.session_state.drill_date
    if isinstance(drill_date, str):
        drill_date = pd.to_datetime(drill_date).date()
    drill_df = fdf[fdf["date"] == drill_date].sort_values("timestamp").reset_index(drop=True)
    n_drill = len(drill_df)
    approved_drill = int(drill_df["approved"].sum())
    rate_drill = approved_drill / n_drill * 100 if n_drill else 0
    top_dec_drill = top_val(drill_df[~drill_df["approved"]]["decline_reason"]) if not drill_df[~drill_df["approved"]].empty else "N/A"

    hdr, btn = st.columns([8, 1])
    with hdr:
        st.markdown(f"#### Transaction Drill-Down — **{drill_date}**")
        st.caption(
            f"{n_drill} transactions · {approved_drill} approved · "
            f"{n_drill - approved_drill} declined · "
            f"{rate_drill:.1f}% approval · Top decline reason: **{top_dec_drill}**"
        )
    with btn:
        if st.button("✕ Clear", key="clear_date"):
            st.session_state.drill_date = None
            st.rerun()

    # Mini summary by processor for this day
    if n_drill > 0:
        proc_summary = drill_df.groupby("processor").agg(
            total=("id", "count"), approved_sum=("approved_int", "sum")
        ).reset_index()
        proc_summary["approval_rate"] = proc_summary["approved_sum"] / proc_summary["total"] * 100
        s1, s2, s3 = st.columns(len(proc_summary))
        for col, (_, row) in zip([s1, s2, s3], proc_summary.iterrows()):
            col.metric(row["processor"], f"{row['approval_rate']:.1f}%", f"{int(row['total'])} txns")

    st.dataframe(
        drill_df[[
            "id", "timestamp", "country", "payment_method",
            "processor", "amount", "approved", "decline_reason"
        ]],
        use_container_width=True,
        height=380
    )
    st.divider()

with st.expander("Hourly Approval Rate Pattern"):
    fig_h = go.Figure(go.Scatter(
        x=hourly["hour"], y=hourly["approved_pct"],
        mode="lines+markers", line=dict(color="#6C5CE7"),
        customdata=hourly[["transactions"]].values,
        hovertemplate=(
            "<b>Hour %{x}:00</b><br>"
            "Approval rate: %{y:.1f}%<br>"
            "Transactions: %{customdata[0]:,}"
            "<extra></extra>"
        )
    ))
    fig_h.update_layout(title="Approval Rate by Hour of Day (%)", xaxis_title="Hour (0–23)",
                        yaxis_title="Approval Rate (%)", yaxis_range=[0, 100],
                        xaxis=dict(tickmode="linear", dtick=1))
    _plot(fig_h, use_container_width=True)

st.divider()

# ── Section 2: Geography & Payment Methods ────────────────────────────────────
st.markdown('<div id="geography"></div>', unsafe_allow_html=True)
st.subheader("Geography & Payment Methods")
st.caption("Click any bar to drill down — all other charts will filter to your selection.")

# Pre-compute enriched stats on overview_df (so clickable charts always show all options)
country_stats = overview_df.groupby("country").agg(
    total=("id", "count"), approved_sum=("approved_int", "sum")
).reset_index()
country_stats["approval_rate"] = country_stats["approved_sum"] / country_stats["total"] * 100
country_stats["declined"] = country_stats["total"] - country_stats["approved_sum"]
country_stats["top_decline"] = country_stats["country"].map(
    overview_df[~overview_df["approved"]].groupby("country")["decline_reason"].agg(top_val)
).fillna("N/A")
country_stats["top_method"] = country_stats["country"].map(
    overview_df.groupby("country")["payment_method"].agg(top_val)
).fillna("N/A")
# Highlight selected
country_stats["_selected"] = country_stats["country"].apply(
    lambda c: "Selected" if c == st.session_state.drill_country else "Other"
)

method_stats = overview_df.groupby("payment_method").agg(
    total=("id", "count"), approved_sum=("approved_int", "sum")
).reset_index()
method_stats["approval_rate"] = method_stats["approved_sum"] / method_stats["total"] * 100
method_stats["declined"] = method_stats["total"] - method_stats["approved_sum"]
method_stats["top_decline"] = method_stats["payment_method"].map(
    overview_df[~overview_df["approved"]].groupby("payment_method")["decline_reason"].agg(top_val)
).fillna("N/A")
method_stats["top_country"] = method_stats["payment_method"].map(
    overview_df.groupby("payment_method")["country"].agg(top_val)
).fillna("N/A")
method_stats["_selected"] = method_stats["payment_method"].apply(
    lambda m: "Selected" if m == st.session_state.drill_method else "Other"
)

g1, g2 = st.columns(2)

with g1:
    cs_sorted = country_stats.sort_values("approval_rate")
    color_map = {"Selected": "#E74C3C", "Other": "#6C5CE7"}
    fig_cr = go.Figure(go.Bar(
        x=cs_sorted["approval_rate"],
        y=cs_sorted["country"],
        orientation="h",
        marker_color=[color_map.get(s, "#2ECC71") for s in cs_sorted["_selected"]],
        customdata=cs_sorted[["total", "top_method", "top_decline", "declined"]].values,
        hovertemplate=(
            "<b>%{y}</b><br>"
            "Approval rate: %{x:.1f}%<br>"
            "Transactions: %{customdata[0]:,}  |  Declined: %{customdata[3]:,}<br>"
            "Top payment method: %{customdata[1]}<br>"
            "Top decline reason: %{customdata[2]}"
            "<extra></extra>"
        ),
        text=cs_sorted["approval_rate"].map("{:.1f}%".format),
        textposition="outside"
    ))
    fig_cr.update_layout(
        title="Approval Rate by Country — click to drill down",
        xaxis_range=[0, 110], xaxis_title="", yaxis_title=""
    )
    ev_country = _plot(fig_cr, on_select="rerun", use_container_width=True)
    try:
        if ev_country.selection.points:
            clicked = ev_country.selection.points[0].get("y")
            if clicked:
                new_val = None if clicked == st.session_state.drill_country else clicked
                if new_val != st.session_state.drill_country:
                    st.session_state.drill_country = new_val
                    st.rerun()
    except (AttributeError, KeyError, IndexError):
        pass

with g2:
    method_type = st.radio("Method chart", ["Bar", "Donut"], horizontal=True, key="method_type")
    ms_sorted = method_stats.sort_values("approval_rate")
    if method_type == "Bar":
        fig_m = go.Figure(go.Bar(
            x=ms_sorted["approval_rate"],
            y=ms_sorted["payment_method"],
            orientation="h",
            marker_color=[color_map.get(s, "#6C5CE7") for s in ms_sorted["_selected"]],
            customdata=ms_sorted[["total", "top_country", "top_decline", "declined"]].values,
            hovertemplate=(
                "<b>%{y}</b><br>"
                "Approval rate: %{x:.1f}%<br>"
                "Transactions: %{customdata[0]:,}  |  Declined: %{customdata[3]:,}<br>"
                "Top country: %{customdata[1]}<br>"
                "Top decline reason: %{customdata[2]}"
                "<extra></extra>"
            ),
            text=ms_sorted["approval_rate"].map("{:.1f}%".format),
            textposition="outside"
        ))
        fig_m.update_layout(title="Approval Rate by Method — click to drill down",
                            xaxis_range=[0, 110], xaxis_title="", yaxis_title="")
        ev_method = _plot(fig_m, on_select="rerun", use_container_width=True)
        try:
            if ev_method.selection.points:
                clicked = ev_method.selection.points[0].get("y")
                if clicked:
                    new_val = None if clicked == st.session_state.drill_method else clicked
                    if new_val != st.session_state.drill_method:
                        st.session_state.drill_method = new_val
                        st.rerun()
        except (AttributeError, KeyError, IndexError):
            pass
    else:
        fig_m = go.Figure(go.Pie(
            labels=method_stats["payment_method"],
            values=method_stats["total"],
            hole=0.4,
            customdata=method_stats[["approval_rate", "top_decline"]].values,
            hovertemplate=(
                "<b>%{label}</b><br>"
                "Share: %{percent}<br>"
                "Transactions: %{value:,}<br>"
                "Approval rate: %{customdata[0]:.1f}%<br>"
                "Top decline: %{customdata[1]}"
                "<extra></extra>"
            )
        ))
        fig_m.update_layout(title="Payment Methods Breakdown")
        _plot(fig_m, use_container_width=True)

# Country × Method heatmap (uses fdf for detail view)
if not fdf.empty:
    pivot = fdf.pivot_table(
        index="country", columns="payment_method",
        values="approved_int", aggfunc="mean"
    ) * 100
    fig_heat = px.imshow(pivot, title="Approval Rate Heatmap: Country × Payment Method (%)",
                         color_continuous_scale="RdYlGn", zmin=0, zmax=100,
                         labels=dict(color="Approval %"), text_auto=".0f")
    _plot(fig_heat, use_container_width=True)

st.divider()

# ── Section 3: Processor Performance ─────────────────────────────────────────
st.markdown('<div id="processors"></div>', unsafe_allow_html=True)
st.subheader("Processor Performance")
st.caption("Click any bar to drill down.")

proc_stats = overview_df.groupby("processor").agg(
    total=("id", "count"), approved_sum=("approved_int", "sum")
).reset_index()
proc_stats["approval_rate"] = proc_stats["approved_sum"] / proc_stats["total"] * 100
proc_stats["declined"] = proc_stats["total"] - proc_stats["approved_sum"]
proc_stats["top_decline"] = proc_stats["processor"].map(
    overview_df[~overview_df["approved"]].groupby("processor")["decline_reason"].agg(top_val)
).fillna("N/A")
proc_stats["top_country"] = proc_stats["processor"].map(
    overview_df.groupby("processor")["country"].agg(top_val)
).fillna("N/A")
proc_stats["_selected"] = proc_stats["processor"].apply(
    lambda p: "Selected" if p == st.session_state.drill_processor else "Other"
)

p1, p2 = st.columns(2)
with p1:
    colors_proc = [color_map.get(s, "#E67E22") for s in proc_stats["_selected"]]
    fig_p = go.Figure(go.Bar(
        x=proc_stats["processor"],
        y=proc_stats["approval_rate"],
        marker_color=colors_proc,
        customdata=proc_stats[["total", "declined", "top_decline", "top_country"]].values,
        hovertemplate=(
            "<b>%{x}</b><br>"
            "Approval rate: %{y:.1f}%<br>"
            "Transactions: %{customdata[0]:,}  |  Declined: %{customdata[1]:,}<br>"
            "Top decline reason: %{customdata[2]}<br>"
            "Top country: %{customdata[3]}"
            "<extra></extra>"
        ),
        text=proc_stats["approval_rate"].map("{:.1f}%".format),
        textposition="outside"
    ))
    fig_p.update_layout(title="Approval Rate by Processor — click to drill down",
                        yaxis_range=[0, 110], xaxis_title="", yaxis_title="Approval Rate (%)")
    ev_proc = _plot(fig_p, on_select="rerun", use_container_width=True)
    try:
        if ev_proc.selection.points:
            clicked = ev_proc.selection.points[0].get("x")
            if clicked:
                new_val = None if clicked == st.session_state.drill_processor else clicked
                if new_val != st.session_state.drill_processor:
                    st.session_state.drill_processor = new_val
                    st.rerun()
    except (AttributeError, KeyError, IndexError):
        pass

with p2:
    proc_country = fdf.groupby(["country", "processor"]).agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")
    ).reset_index()
    proc_country["approval_rate"] = proc_country["approved_sum"] / proc_country["total"] * 100
    fig_pc = px.bar(proc_country, x="country", y="approval_rate", color="processor",
                    barmode="group", title="Approval Rate by Processor × Country (%)",
                    hover_data={"total": True, "approval_rate": ":.1f"})
    fig_pc.update_layout(yaxis_range=[0, 100], xaxis_title="", yaxis_title="Approval Rate (%)")
    _plot(fig_pc, use_container_width=True)

st.divider()

# ── Section 4: Amount Brackets ────────────────────────────────────────────────
st.markdown('<div id="amounts"></div>', unsafe_allow_html=True)
st.subheader("Transaction Amount Analysis")

amount_stats = fdf.groupby("amount_bin", observed=True).agg(
    total=("id", "count"), approved_sum=("approved_int", "sum")
).reset_index()
amount_stats["approval_rate"] = amount_stats["approved_sum"] / amount_stats["total"] * 100
amount_stats["declined"] = amount_stats["total"] - amount_stats["approved_sum"]
amount_stats["top_decline"] = amount_stats["amount_bin"].map(
    fdf[~fdf["approved"]].groupby("amount_bin", observed=True)["decline_reason"].agg(top_val)
).fillna("N/A")

a1, a2 = st.columns(2)
with a1:
    fig_ab = go.Figure(go.Bar(
        x=amount_stats["amount_bin"].astype(str),
        y=amount_stats["approval_rate"],
        marker_color="#00B4A0",
        customdata=amount_stats[["total", "declined", "top_decline"]].values,
        hovertemplate=(
            "<b>%{x}</b><br>"
            "Approval rate: %{y:.1f}%<br>"
            "Transactions: %{customdata[0]:,}  |  Declined: %{customdata[1]:,}<br>"
            "Top decline reason: %{customdata[2]}"
            "<extra></extra>"
        ),
        text=amount_stats["approval_rate"].map("{:.1f}%".format),
        textposition="outside"
    ))
    fig_ab.update_layout(title="Approval Rate by Amount Bracket (%)",
                         yaxis_range=[0, 110], xaxis_title="Amount Bracket", yaxis_title="Approval Rate (%)")
    _plot(fig_ab, use_container_width=True)

with a2:
    fig_av = go.Figure(go.Bar(
        x=amount_stats["amount_bin"].astype(str),
        y=amount_stats["total"],
        marker_color="#6C5CE7",
        customdata=amount_stats[["approval_rate", "declined"]].values,
        hovertemplate=(
            "<b>%{x}</b><br>"
            "Transactions: %{y:,}<br>"
            "Declined: %{customdata[1]:,}<br>"
            "Approval rate: %{customdata[0]:.1f}%"
            "<extra></extra>"
        ),
        text=amount_stats["total"],
        textposition="outside"
    ))
    fig_av.update_layout(title="Transaction Count by Amount Bracket",
                         xaxis_title="Amount Bracket", yaxis_title="Transactions")
    _plot(fig_av, use_container_width=True)

st.divider()

# ── Section 5: Decline Analysis ───────────────────────────────────────────────
st.markdown('<div id="declines"></div>', unsafe_allow_html=True)
st.subheader("Decline Analysis")
declined_df = fdf[~fdf["approved"]].copy()

d1, d2 = st.columns(2)
with d1:
    dec_type = st.radio("Decline chart", ["Bar", "Pie"], horizontal=True, key="dec_type")
    dec = declined_df["decline_reason"].value_counts().reset_index()
    dec.columns = ["reason", "count"]
    dec["pct"] = dec["count"] / dec["count"].sum() * 100
    if dec_type == "Bar":
        fig_dr = go.Figure(go.Bar(
            x=dec["count"], y=dec["reason"], orientation="h",
            marker_color="#E74C3C",
            customdata=dec[["pct"]].values,
            hovertemplate=(
                "<b>%{y}</b><br>"
                "Count: %{x:,}<br>"
                "Share of declines: %{customdata[0]:.1f}%"
                "<extra></extra>"
            )
        ))
        fig_dr.update_layout(title="Decline Reasons (Overall)", yaxis_title="", xaxis_title="Count")
    else:
        fig_dr = go.Figure(go.Pie(
            labels=dec["reason"], values=dec["count"], hole=0.4,
            hovertemplate="<b>%{label}</b><br>Count: %{value:,}<br>Share: %{percent}<extra></extra>"
        ))
        fig_dr.update_layout(title="Decline Reasons (Overall)")
    _plot(fig_dr, use_container_width=True)

with d2:
    if not declined_df.empty:
        dec_method = declined_df.groupby(["payment_method", "decline_reason"])["id"].count().reset_index(name="count")
        fig_dm = px.bar(dec_method, x="payment_method", y="count", color="decline_reason",
                        barmode="stack", title="Decline Reasons by Payment Method")
        fig_dm.update_layout(xaxis_title="", yaxis_title="Declined Transactions")
        _plot(fig_dm, use_container_width=True)

if not declined_df.empty:
    dec_time = declined_df.groupby(["date", "decline_reason"])["id"].count().reset_index(name="count")
    fig_dt = px.bar(dec_time, x="date", y="count", color="decline_reason",
                    barmode="stack", title="Decline Reasons Over Time")
    fig_dt.update_layout(xaxis_title="", yaxis_title="Declined Transactions")
    _plot(fig_dt, use_container_width=True)

st.divider()

# ── Section 6: Anomaly Deep-Dives ─────────────────────────────────────────────
st.markdown('<div id="anomalies"></div>', unsafe_allow_html=True)
st.subheader("Anomaly Deep-Dives")

an1, an2 = st.columns(2)
with an1:
    pb_daily = fdf[fdf["processor"] == "Processor B"].groupby("day").agg(
        total=("id", "count"), approved_sum=("approved_int", "sum")).reset_index()
    pb_daily["approval_rate"] = pb_daily["approved_sum"] / pb_daily["total"] * 100
    fig_pb = px.bar(pb_daily, x="day", y="approval_rate",
                    title="Processor B — Daily Approval Rate (%)",
                    color_discrete_sequence=["#F77F00"])
    fig_pb.add_vline(x=18, line_dash="dash", line_color="red", annotation_text="Nov 18 anomaly")
    fig_pb.update_layout(yaxis_range=[0, 100])
    _plot(fig_pb, use_container_width=True)

with an2:
    eu_cards = fdf[
        fdf["country"].isin(["Spain", "Germany"]) &
        fdf["payment_method"].isin(["card_visa", "card_mastercard"]) &
        ~fdf["approved"]
    ].copy()
    if not eu_cards.empty:
        eu_cards["period"] = eu_cards["day"].apply(lambda d: "Nov 1–15" if d <= 15 else "Nov 16–30")
        tds = eu_cards.groupby(["period", "decline_reason"])["id"].count().reset_index(name="count")
        fig_tds = px.bar(tds, x="period", y="count", color="decline_reason", barmode="stack",
                         title="Spain + Germany Card Declines — 3DS Spike")
        _plot(fig_tds, use_container_width=True)

st.divider()

# ── Section 7: Recent Transactions + Export ───────────────────────────────────
st.markdown('<div id="transactions"></div>', unsafe_allow_html=True)
st.subheader("Recent Transactions")
st.dataframe(
    fdf.sort_values("timestamp", ascending=False).head(100)[[
        "id", "timestamp", "country", "payment_method", "processor",
        "amount", "amount_bin", "approved", "decline_reason"
    ]].reset_index(drop=True),
    use_container_width=True
)

csv = fdf.to_csv(index=False).encode("utf-8")
st.download_button(
    label="Export Filtered Data as CSV",
    data=csv,
    file_name="luna_filtered_payments.csv",
    mime="text/csv"
)

st.markdown("---")
st.caption("Click any bar chart to drill down · Use sidebar to filter · Export to CSV for further analysis.")

# Luna Travel — Payment Acceptance Dashboard

A Streamlit dashboard for diagnosing payment approval failures across countries, processors, and payment methods. Built for a fictional travel merchant processing ~6,000 transactions in November 2023.

---

## How to Run

### 1. Install dependencies

```bash
python3 -m pip install streamlit plotly pandas numpy
```

### 2. Generate the mock dataset

```bash
python3 generate_payments.py
```

This creates `payments.json` (~6,000 transactions) and prints a data summary:

```
Records generated  : 6,000
Overall approval   : 75.5%
Nov  1-15 approval : 81.4%
Nov 16-30 approval : 69.4%

Anomalies verified:
  Processor B / Nov 18  -> 58 txns, 8.6% approval rate
  Spain+Germany cards (Nov 16-30 declines) -> 56.2% are 3ds_failure
```

### 3. Launch the dashboard

```bash
python3 -m streamlit run app.py
```

Open **http://localhost:8501** in your browser.

---

## Project Structure

```
├── app.py                  # Main Streamlit dashboard
├── generate_payments.py    # Mock data generator (run once)
├── payments.json           # Generated dataset (6,000 transactions)
└── Yuno logo.png           # Logo displayed in sidebar
```

---

## Dashboard Sections

### What Changed? — Auto-detected Insights
Automatically scans the filtered data and surfaces anomalies as natural-language cards, ranked by severity. Detects:
- Processor outages (any processor × day with < 30% approval)
- Daily approval rate drops > 15pp below average
- Country × payment method combinations underperforming
- High-value transaction (> $400) approval gaps
- 3DS failure spikes by region
- Processor × country underperformance

### Smart Recommendations
Translates each detected anomaly into a specific, actionable next step — e.g. "Escalate Processor B outage, enable failover to Processor A or C." Prioritised as HIGH / MEDIUM / LOW.

### What-If Simulator
Estimates the impact of hypothetical routing decisions. Example: *"What would approval rate have been if all Processor B traffic had been routed to Processor A on Nov 18?"* Calculates expected approvals and estimated recovered revenue using the target processor's observed rates for the same country × method × amount bracket combinations.

### Cohort Comparison
Side-by-side comparison of two custom time periods (default: Nov 1–15 vs Nov 16–30). Shows approval rate delta, transaction volume, declined count, and breakdowns by country, method, processor, and decline reason.

### Time Trends
- Daily transaction volume (bar or line)
- Daily approval rate with 75% target line (line or bar)
- Hourly approval rate pattern (expandable)
- **Click any bar/point to drill into that day's transactions inline**

### Geography & Payment Methods
- Approval rate by country (horizontal bar, click to drill)
- Approval rate by payment method (bar or donut, click to drill)
- Country × Payment method approval rate heatmap

### Processor Performance
- Approval rate by processor (click to drill)
- Approval rate by processor × country (grouped bar)

### Transaction Amount Analysis
- Approval rate by amount bracket ($0–50, $50–200, $200–500, $500+)
- Transaction count by bracket

### Decline Analysis
- Decline reasons overall (bar or pie)
- Decline reasons by payment method (stacked bar)
- Decline reasons over time (stacked bar)

### Anomaly Deep-Dives
- Processor B daily approval rate with Nov 18 marked
- Spain + Germany card declines split by period (3DS spike visualised)

### Recent Transactions
Sortable, scrollable table of up to 100 transactions. Updates live with all active filters.

---

## Key Insights the Data Reveals

### 1. Processor B Outage — November 18
Processor B's approval rate collapsed to **~8.6%** on Nov 18 (vs ~75% on surrounding days). Of 58 transactions processed that day, 53 were declined — 80%+ with `technical_error` as the reason, consistent with a processor-side incident rather than issuer or fraud-related causes.

**What-If result:** Routing Processor B's Nov 18 traffic to Processor A would have raised approval from 8.6% to ~79%, recovering an estimated ~$5,800 in revenue.

### 2. 3DS Failure Spike — Europe from Nov 15
Card payments in Spain and Germany saw a sharp increase in `3ds_failure` declines starting Nov 15. In the Nov 16–30 window, 3DS failures account for **~56% of all card declines** in those countries, up from near-baseline in the first half of the month. This pattern is consistent with an issuer-side 3DS rule change or a misconfiguration in the 3DS provider setup.

### 3. Mid-Month Approval Rate Drop
Overall approval rate drops from **~81%** in Nov 1–15 to **~69%** in Nov 16–30 — a 12 percentage point decline. The Processor B outage on Nov 18 and the 3DS spike in Europe both contribute, but the drop is visible even when those segments are filtered out, suggesting a broader mid-month degradation.

### 4. High-Value Transactions Underperform
Transactions above $400 approve at a meaningfully lower rate than average, driven primarily by `fraud_suspicion` declines. This suggests fraud scoring thresholds may be miscalibrated for high-value travel bookings, which are expected to be large but are being flagged at higher rates than warranted.

### 5. Country × Method Combinations
The Country × Payment Method heatmap reveals that not all methods perform equally across markets. Certain combinations (e.g. card payments through Processor B in specific countries) underperform significantly relative to the market average, indicating that processor routing is not optimised per market.

---

## Filters & Interactivity

| Feature | How to use |
|---|---|
| Date range | Sidebar slider — "Day of November" |
| Country, Processor, Method, Amount, Decline reason | Sidebar multiselects |
| Click-to-filter | Click any bar in country, processor, method, or daily charts |
| Clear drill-downs | "Clear click filters" button in sidebar |
| Chart type toggle | Radio buttons above each chart (bar/line, donut/bar, pie/bar) |
| Shareable URLs | Browser URL updates automatically — copy and share |
| Export | "Export Filtered Data as CSV" button at the bottom |

---

## Data Generation

The dataset is fully reproducible via `random.seed(42)`. Key parameters:

| Parameter | Value |
|---|---|
| Records | 6,000 |
| Date range | November 1–30, 2023 |
| Countries | Brazil (30%), Mexico (25%), Argentina (15%), Colombia (15%), Spain (8%), Germany (7%) |
| Payment methods | PIX (Brazil-heavy), OXXO (Mexico-heavy), SEPA (Europe-heavy), card_visa, card_mastercard |
| Processors | Processor A (35%), Processor B (30%), Processor C (35%) |
| Amount distribution | Lognormal, mean ~$120, capped at $800 |
| Approval rate | ~82% Nov 1–15 → ~70% Nov 16–30 |
| Injected anomaly 1 | Processor B on Nov 18: ~10% approval, ~80% technical_error |
| Injected anomaly 2 | Spain + Germany cards after Nov 15: ~63% of declines are 3ds_failure |

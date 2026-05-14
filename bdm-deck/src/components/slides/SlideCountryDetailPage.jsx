import { useEffect, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

// Portal-aligned country → ISO-2 lookup. Used to pull the flag from
// flagcdn.com so we get a real PNG flag, not a Unicode emoji.
const COUNTRY_ISO = {
  "Côte d'Ivoire": 'ci',
  'Brazil': 'br', 'Mexico': 'mx', 'Colombia': 'co', 'Argentina': 'ar',
  'Chile': 'cl', 'Peru': 'pe', 'Uruguay': 'uy', 'Ecuador': 'ec',
  'Bolivia': 'bo', 'Paraguay': 'py', 'Venezuela': 've', 'Costa Rica': 'cr',
  'Dominican Republic': 'do', 'Panama': 'pa', 'Guatemala': 'gt',
  'El Salvador': 'sv', 'Honduras': 'hn', 'Nicaragua': 'ni', 'Cuba': 'cu',
  'Puerto Rico': 'pr', 'Jamaica': 'jm', 'Trinidad and Tobago': 'tt',
  'United States': 'us', 'Canada': 'ca',
  'United Kingdom': 'gb', 'Germany': 'de', 'France': 'fr', 'Spain': 'es',
  'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be', 'Switzerland': 'ch',
  'Austria': 'at', 'Sweden': 'se', 'Norway': 'no', 'Denmark': 'dk',
  'Finland': 'fi', 'Iceland': 'is', 'Ireland': 'ie', 'Portugal': 'pt',
  'Poland': 'pl', 'Czech Republic': 'cz', 'Slovakia': 'sk', 'Hungary': 'hu',
  'Romania': 'ro', 'Bulgaria': 'bg', 'Greece': 'gr', 'Croatia': 'hr',
  'Slovenia': 'si', 'Estonia': 'ee', 'Latvia': 'lv', 'Lithuania': 'lt',
  'Luxembourg': 'lu', 'Malta': 'mt', 'Cyprus': 'cy', 'Serbia': 'rs',
  'Ukraine': 'ua', 'Russia': 'ru',
  'UAE': 'ae', 'Saudi Arabia': 'sa', 'Qatar': 'qa', 'Kuwait': 'kw',
  'Bahrain': 'bh', 'Oman': 'om', 'Jordan': 'jo', 'Lebanon': 'lb',
  'Israel': 'il', 'Turkey': 'tr', 'Iraq': 'iq', 'Iran': 'ir',
  'India': 'in', 'China': 'cn', 'Japan': 'jp', 'South Korea': 'kr',
  'Singapore': 'sg', 'Hong Kong': 'hk', 'Taiwan': 'tw', 'Malaysia': 'my',
  'Indonesia': 'id', 'Philippines': 'ph', 'Thailand': 'th', 'Vietnam': 'vn',
  'Australia': 'au', 'New Zealand': 'nz', 'Bangladesh': 'bd', 'Pakistan': 'pk',
  'Sri Lanka': 'lk', 'Nepal': 'np', 'Cambodia': 'kh', 'Myanmar': 'mm',
  'Egypt': 'eg', 'Morocco': 'ma', 'Algeria': 'dz', 'Tunisia': 'tn',
  'South Africa': 'za', 'Kenya': 'ke', 'Nigeria': 'ng', 'Ghana': 'gh',
  'Ethiopia': 'et', 'Tanzania': 'tz', 'Uganda': 'ug', 'Rwanda': 'rw',
  'Zambia': 'zm', 'Zimbabwe': 'zw', 'Mozambique': 'mz', 'Angola': 'ao',
  'Cameroon': 'cm', 'Senegal': 'sn', "Côte d'Ivoire": 'ci',
  'Botswana': 'bw', 'Mauritius': 'mu',
}

// Lazy-load the portal's COUNTRY_DETAIL_RICH dataset once.
let _detailRichPromise = null
function loadDetailRich() {
  if (_detailRichPromise) return _detailRichPromise
  _detailRichPromise = fetch('/sales-deck/country-detail-rich.json')
    .then((r) => r.json())
    .catch(() => ({}))
  return _detailRichPromise
}

// Colour palette for the payment-method breakdown pie slices — Yuno ramp.
const PIE_COLORS = [
  '#3E4FE0', '#5967E4', '#7C89EF', '#BDC3F6',
  '#1726A6', '#9EA8F2', '#E8EAF5', '#616366',
]

// Horizontal-bar breakdown — same shape as the portal's Country Detail
// "Payment Methods Breakdown — Ecommerce" table. Each row: method (+ detail),
// share rendered as a filled bar with the percentage centered, growth chip
// (green for +, red for -) on the right.
function PaymentBreakdown({ items, theme }) {
  const rows = (items || [])
    .map((it) => ({
      name: it?.name || '',
      detail: it?.detail || '',
      share: Number(it?.share) || 0,
      growth: it?.growth || '',
    }))
    .filter((it) => it.share > 0)
    .sort((a, b) => b.share - a.share)

  const maxShare = rows.reduce((m, r) => Math.max(m, r.share), 0) || 1

  const accentBg = theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(62,79,224,0.14)'
  const accentFill = theme.isLight
    ? 'linear-gradient(90deg, rgba(62,79,224,0.55) 0%, rgba(62,79,224,0.30) 100%)'
    : 'linear-gradient(90deg, rgba(124,137,239,0.85) 0%, rgba(62,79,224,0.55) 100%)'

  const growthColor = (g) => {
    if (!g) return theme.inkMuted
    if (g.startsWith('+')) return '#10b981'
    if (g.startsWith('-')) return '#ef4444'
    return theme.inkMuted
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
      }}
    >
      {rows.map((row, i) => {
        const widthPct = (row.share / maxShare) * 100
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1.4fr) minmax(0, 3fr) auto',
              alignItems: 'center',
              gap: '11.5px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: theme.inkStrong,
                  lineHeight: 1.25,
                  wordBreak: 'break-word',
                }}
              >
                {row.name}
              </div>
              {row.detail && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: theme.inkMuted,
                    letterSpacing: '0.4px',
                    lineHeight: 1.35,
                    wordBreak: 'break-word',
                  }}
                >
                  {row.detail}
                </div>
              )}
            </div>
            <div
              style={{
                position: 'relative',
                height: '23px',
                borderRadius: '999px',
                background: accentBg,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: accentFill,
                  borderRadius: '999px',
                  transition: 'width 0.4s ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font)',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: theme.inkStrong,
                }}
              >
                {row.share}%
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                fontWeight: 700,
                color: growthColor(row.growth),
                fontVariantNumeric: 'tabular-nums',
                minWidth: '64px',
                textAlign: 'right',
              }}
            >
              {row.growth || ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function SlideCountryDetailPage({ selectedCountry }) {
  const theme = useTheme()
  const [rich, setRich] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadDetailRich().then((data) => {
      if (cancelled) return
      setRich(selectedCountry ? data[selectedCountry] || null : null)
    })
    return () => { cancelled = true }
  }, [selectedCountry])

  const iso = selectedCountry ? COUNTRY_ISO[selectedCountry] : null
  const overview = rich?.overview || {}
  // Drop the "Online users" and "In-Store : Ecommerce ratio" overview
  // cards — the user pruned them from this slide.
  const OVERVIEW_HIDDEN = /(online users|in[\s-]store)/i
  const overviewEntries = Object.entries(overview).filter(([k]) => !OVERVIEW_HIDDEN.test(k))
  const localPayments = rich?.local_payments || {}
  // Filter out non-APM rails (gateways, PSPs, acquirers, aggregators) — the
  // "Relevant APMs" card is APM-only by definition.
  const NON_APM_TYPE = /(gateway|psp|acquirer|aggregator)/i
  const filteredApms = (Array.isArray(localPayments.apms) ? localPayments.apms : [])
    .filter((a) => {
      const type = typeof a === 'object' ? (a?.type || '') : ''
      return !NON_APM_TYPE.test(type)
    })
  const breakdown = rich?.payment_methods_breakdown || []
  const rawRegulation = rich?.regulation || []
  const rawDigitalTrends = rich?.digital_trends || rich?.digitalTrends || []

  // Digital Trends — keep entries that read as market guidance for a
  // merchant looking to *operate* in this country (cross-border / CNP /
  // ecommerce). Payment-system names (wallets, PSPs, A2A rails) are
  // *allowed* because they describe the infrastructure a merchant will
  // plug into. Non-payment retailer / consumer-brand anecdotes are
  // dropped because they don't help an operator decide how to plug in.
  const TRENDS_EXCLUDE = new RegExp([
    '\\bb2b\\b', 'business[\\s-]*to[\\s-]*business', 'nearshoring',
    'supply\\s*chain', 'wholesale', 'invoice\\s+finance',
    // Non-payment merchant brand names (retail, marketplaces, streaming,
    // food delivery, social) — these read as anecdotes, not operating
    // guidance. PSPs / wallets stay so trends like "Mercado Pago handles
    // 30% of LATAM ecommerce" still surface.
    '\\bUber\\b', 'Netflix', 'Spotify', 'Discord', 'Amazon\\b', '\\beBay\\b',
    'Alibaba', 'Lazada', 'Shopee', 'iFood', 'Rappi', 'Blinkit', 'Zepto',
    'Zomato', 'Swiggy', 'BigBasket', 'JioMart', 'FamilyMart',
    'PedidosYa', 'GoTo\\b',
    // Drop bullets that are *purely* compliance/legal — those belong on
    // the Regulation card. Initiative announcements that *mention* a
    // regulator or program are kept so they still show up here.
    'payment\\s+aggregator\\s+licen[cs]e', '\\bpa-cb\\b',
    'data\\s+(local|residency|protection)\\s+law',
    'merchant\\s+of\\s+record\\s+model', '\\bmor\\s+model',
    'withhold\\s+tax', 'lgpd', 'gdpr',
    '\\bvat\\s+(rate|applies|withhold)', '\\bgst\\s+(rate|applies|withhold)',
  ].join('|'), 'i')
  const digitalTrends = rawDigitalTrends.filter((t) => {
    const txt = typeof t === 'string' ? t : (t?.text || t?.title || '')
    return !TRENDS_EXCLUDE.test(txt)
  })

  // Regulation card — curated per country, focused on what a merchant
  // entering the market needs to know: Merchant-of-Record feasibility and
  // which high-risk verticals are accepted vs prohibited. Source data is
  // licensing-heavy and inconsistent across markets, so we override it for
  // the top markets and fall back to a filtered version for the long tail.
  const REG_OVERRIDES = {
    'Brazil': [
      'PSP license: Instituição de Pagamento (IP) issued by BACEN — sub-types: emissor de moeda eletrônica, credenciador, iniciador de pagamento, emissor de instrumento pós-pago.',
      'Data hosting: no strict localisation. LGPD treats payment data as sensitive; cross-border allowed with safeguards. ANPD enforcement is active (fines up to 2% of Brazilian revenue).',
      'MoR: widely used — foreign sellers settle in BRL via local MoR/PSP partners that absorb the ISS, PIS/COFINS and IOF tax stack.',
      'Verticals — allowed (regulated): iGaming & sports betting (Bets.gov.br license, 2024), crypto (Marco Legal), adult content. Restricted: pharma & alcohol (product registration + age).',
    ],
    'India': [
      'PSP licenses: RBI Payment Aggregator (PA) for domestic; Payment Aggregator Cross-Border (PA-CB) for foreign flows. Orchestration platforms can avoid a PA license only if they never touch funds.',
      'Data hosting: full localisation mandatory — all payment data (card, transaction, customer) on servers physically in India; no copies outside, including backups.',
      'MoR: only via PA-CB license — high barrier. Most foreign merchants route through a locally licensed PA.',
      'Verticals — prohibited/restricted: real-money gaming & betting (state laws diverge), crypto as payment, adult, alcohol & tobacco online, firearms. Fantasy sports (skill) permitted.',
    ],
    'Mexico': [
      'PSP licenses: IFPE (Institución de Fondos de Pago Electrónico) for wallets/e-money; ITF for crowdfunding & lending. Fintech Law 2.0 (Oct 2026) tightens capital + Open Finance.',
      'Data hosting: LFPDPPP applies — cross-border transfer with consent or contractual safeguards; no general localisation mandate.',
      'MoR: feasible — foreign sellers register with SAT; PSPs withhold IVA (16%) at checkout for cross-border digital services.',
      'Verticals — licensed: sports betting & online casino (DGJS/SEGOB), adult. Restricted/prohibited: crypto as merchant settlement (Banxico), prescription pharma (COFEPRIS).',
    ],
    'United States': [
      'PSP licenses: state Money-Transmitter Licenses (MTL) in 49 states for non-bank funds custody + NY DFS BitLicense for crypto. Federally OCC/FDIC/Fed supervise banks, CFPB consumers.',
      'Data hosting: no federal localisation. State laws (CCPA/CPRA in CA, equivalents in CO/CT/VA/UT) apply + PCI-DSS v4.0 mandatory for cardholder data.',
      'MoR: state-by-state — needs the MTL footprint; commonly offloaded to specialised MoR providers (Paddle, Lemon Squeezy, Stripe Atlas).',
      'Verticals — state-licensed only: online casino (NJ, MI, PA, CT, WV), sports betting (~40 states), adult (age-verification varies by state), firearms (FFL + state). Network-blocked: cannabis (federally Schedule I).',
    ],
    'UAE': [
      'PSP licenses: CBUAE Retail Payment Services (RPSCS) under Federal Decree 6/2025 — compliance deadline Sep 2026. Free-zone alternatives: ADGM FSRA, DIFC DFSA.',
      'Data hosting: PDPL (GDPR-aligned) at federal level plus DIFC and ADGM data laws in free zones. Sensitive sectoral data subject to localisation.',
      'MoR: feasible via CBUAE-licensed PSP or a free-zone (ADGM/DIFC) vehicle.',
      'Verticals — licensed: crypto under VARA (Dubai) and ADGM/FSRA — strict enforcement (KuCoin halted 2026, 19 firms sanctioned 2025). Prohibited: gambling, adult, alcohol-online outside licensed channels.',
    ],
    'Germany': [
      'PSP licenses: BaFin Payment Institution (PI) or E-Money Institution (EMI) under ZAG (German PSD2 transposition). SEPA passport allows EU cross-border.',
      'Data hosting: GDPR + BDSG — among the EU\'s strictest. Payment-data processors subject to BaFin outsourcing rules (MaRisk / KAIT).',
      'MoR: feasible via BaFin PI/EMI — common route for global SaaS entering the EU via Germany.',
      'Verticals — licensed: gambling under GlüStV (since 2021), crypto under MiCA (2024), adult under JMStV (strict youth protection), pharma via DocMorris / Apotheke pharmacies.',
    ],
    'Indonesia': [
      'PSP licenses: BI PJP (Penyedia Jasa Pembayaran) — main PSP authorization; PTP (Penyelenggara Transfer Dana) for remittance; OSS digital service registration for foreign providers.',
      'Data hosting: PDP Law (2024) — consent required for cross-border transfer; sectoral localisation for financial data via OJK/BI rules.',
      'Verticals — permitted: crypto trading via Bappebti (not a permitted payment method). Prohibited: gambling (Kominfo blocks), adult, pharma e-commerce restricted (BPOM). Alcohol & tobacco subject to provincial bans.',
      'Tax: VAT 11%; foreign digital service providers must register and collect VAT.',
    ],
    'Argentina': [
      'PSP licenses: BCRA Proveedor de Servicios de Pago de Cuentas de Pago (PSPCR) — segregated client funds required.',
      'Data hosting: Law 25.326 — cross-border transfers allowed to "adequate" jurisdictions or with consent / contractual clauses; AAIP enforces.',
      'MoR: feasible but FX controls complicate USD settlement — BCRA authorisation required; commonly routed through licensed FX agents.',
      'Verticals — licensed: gambling by province (CABA, Buenos Aires, Mendoza). Crypto legal (not tender) — highest per-capita stablecoin user in LatAm; exchanges register with UIF.',
    ],
    'Chile': [
      'PSP licenses: CMF authorisations under Fintech Law (Ley 21.521 / LMSF, 2023) — six license types including payment initiator and wallet issuer.',
      'Data hosting: Ley 19.628 being replaced by GDPR-aligned Ley 21.719 (in force Dec 2026) — DPO, impact assessments and tighter cross-border transfer rules.',
      'Verticals — licensed: gambling via casino concessions (limited operators), crypto under LMSF (stablecoins permitted but rare at checkout), adult.',
      'Tax: VAT (IVA) 19%; foreign digital providers register under Ley 21.210 (~500 already registered).',
    ],
    'Colombia': [
      'PSP licenses: SFC SEDPE (Sociedad Especializada en Depósitos y Pagos Electrónicos) under Decree 1692/2020 for e-money issuance and account custody.',
      'Data hosting: Ley 1581/2012 — cross-border requires adequacy or contractual safeguards; SIC database registration mandatory.',
      'Verticals — licensed: gambling under Coljuegos (national authority — one of the more orderly LatAm regimes). Crypto legal but unregulated as a payment method; adult permitted.',
      'Tax: VAT (IVA) 19% on most digital services; retención en la fuente withholding applies on payouts to local sellers.',
    ],
    'Peru': [
      'PSP licenses: SBS EEDE (Empresa Emisora de Dinero Electrónico) under DL 1478; BCRP mandates wallet interoperability (Yape ↔ Plin).',
      'Data hosting: Ley 29.733 — cross-border requires adequacy or consent; ANPD enforces.',
      'Verticals — licensed: gambling under MINCETUR (sports-betting law, 2023). Crypto unregulated — BCRP has issued warnings; adult permitted.',
      'Tax: VAT (IGV) 18%; SUNAT enforcement on foreign digital providers tightened in 2025.',
    ],
    'United Kingdom': [
      'PSP licenses: FCA E-Money Institution (EMI) or Payment Institution (PI). Major-Institution status above €3M monthly outbound. PSR oversees schemes.',
      'Data hosting: UK GDPR + Data Protection Act 2018 — adequacy decision with the EU intact; cross-border to "adequate" jurisdictions allowed.',
      'MoR: feasible — FCA EMI / PI is the common route for global SaaS and marketplaces.',
      'Verticals — licensed: gambling under UKGC (among the world\'s strictest — affordability checks, deposit limits, slots stake cap). Crypto promotions under FCA. Adult licensed (age-verification under Online Safety Act 2025).',
    ],
    'France': [
      'PSP licenses: ACPR Établissement de Paiement (EP) or Établissement de Monnaie Électronique (EME). PSAN registration for crypto-asset services.',
      'Data hosting: GDPR + Loi Informatique et Libertés — CNIL high-profile enforcement; cross-border to "adequate" jurisdictions or via SCCs.',
      'Verticals — licensed: gambling under ANJ (sports betting, poker, horse racing). Crypto under MiCA. Adult licensed with Arcom age-verification since 2024. Prohibited: online casinos, tobacco online sale.',
      'Tax: VAT 20%; CB domestic scheme co-badging gives cheaper interchange. PSD2 SCA strictly enforced.',
    ],
    'Italy': [
      'PSP licenses: Banca d\'Italia Istituto di Pagamento (IP) or Istituto di Moneta Elettronica (IMEL). CONSOB regulates markets; OAM keeps the CASP register.',
      'Data hosting: GDPR + Codice Privacy (D.lgs 196/2003) — Garante enforces; cross-border via adequacy or SCCs.',
      'Verticals — licensed: gambling under ADM — one of Europe\'s largest regulated markets (casino, sports, poker, bingo). Crypto under MiCA + OAM. Tobacco is a state-monopoly.',
      'Tax: VAT (IVA) 22%; mandatory B2B/B2C e-invoicing since 2019 — non-compliance blocks deductions.',
    ],
    'Spain': [
      'PSP licenses: Banco de España Entidad de Pago (PI) or Entidad de Dinero Electrónico (EDE). CNMV regulates investment services.',
      'Data hosting: GDPR + LOPDGDD — AEPD enforces strictly; cross-border via adequacy or SCCs.',
      'Verticals — licensed: gambling under DGOJ (since 2012). Crypto under MiCA (CNMV + BdE joint oversight). Tobacco state-monopoly — online sale prohibited.',
      'Tax: VAT (IVA) 21%; Fintech Sandbox (since 2020) eases pilots; PSD2 SCA strictly enforced.',
    ],
    'Japan': [
      'PSP licenses: Funds Transfer Service license under the Payment Services Act — Type I (no cap, stricter capital), Type II (JPY 1M cap), Type III (JPY 50K cap).',
      'Data hosting: APPI (amended 2022) — cross-border transfers require adequacy or specific consent; sectoral guidance from FSA.',
      'MoR: feasible via FTS Type I license; in practice most foreign merchants partner with a domestic PSP for tax & receipts.',
      'Verticals — licensed: crypto under FIEA (one of the strictest globally), adult (age + censorship laws). Prohibited: online gambling outside public lotteries and pari-mutuel.',
    ],
    'Singapore': [
      'PSP licenses: MAS Major Payment Institution (MPI) under PSA 2019 — covers account issuance, domestic transfer, cross-border, merchant acquisition, e-money, DPT services. SPI for smaller volumes.',
      'Data hosting: PDPA — cross-border requires adequacy or consent. MAS Technology Risk Management (TRM) guidelines layered on top for FIs.',
      'MoR: feasible via MPI — the common APAC hub (Stripe, Adyen, Checkout.com, Worldpay all hold one).',
      'Verticals — licensed: crypto under PSA (DPT services strictly regulated, public marketing banned). Prohibited: gambling outside Singapore Pools/Turf Club, adult (sites blocked).',
    ],
    'Thailand': [
      'PSP license: BOT Payment Service Provider under the Payment Systems Act 2017 (PSP / e-money categories).',
      'Data hosting: PDPA (full enforcement 2022, GDPR-aligned) — local representative required for foreign data controllers; cross-border via adequacy or consent.',
      'Verticals — licensed: crypto under SEC Thailand. Prohibited (criminal): gambling outside state lottery & limited horse racing, adult (blocked), pharma online sale.',
      'Tax: VAT 7%; e-Tax & e-Withholding integration with the Revenue Department is mandatory for PSPs above thresholds.',
    ],
    'Vietnam': [
      'PSP license: SBV Intermediary Payment Service Provider (IPSP) — required for PSPs and wallets.',
      'Data hosting: Cybersecurity Law (2018) + PDP Decree (2023) — localisation of user data on Vietnam servers required for certain categories; cross-border transfer requires impact assessment.',
      'Verticals — prohibited (criminal): gambling, adult (Decree 72 blocks). Restricted: pharma online (MoH), crypto legal-grey (not a permitted payment method).',
      'Tax: VAT 10%; 5% digital service tax on foreign providers effective 2022.',
    ],
    'Philippines': [
      'PSP licenses: BSP Electronic Money Issuer (EMI) or Payment System Operator (PSO) under the National Payment Systems Act.',
      'Data hosting: Data Privacy Act 2012 — cross-border with consent or contract; NPC enforces. Sectoral BSP rules on outsourcing.',
      'Verticals — licensed: gambling under PAGCOR (domestic eGames; POGO offshore operations banned 2024). Crypto under BSP VASP framework. Adult prohibited.',
      'Tax: VAT 12% (extended to foreign digital providers since 2024).',
    ],
    'Australia': [
      'PSP licenses: AUSTRAC registration + ASIC AFSL. Payment Licensing Reform (2024) is replacing the purchased-payment facility regime with a modern PSP license.',
      'Data hosting: Privacy Act 1988 + Consumer Data Right (CDR) — APP 8 governs cross-border disclosure with accountability.',
      'Verticals — licensed: gambling under IGA (sports & race wagering allowed). Crypto under ASIC + AUSTRAC. Adult permitted (federal age-verification trial 2025). Prohibited: online casino & in-play sports betting.',
      'Tax: GST 10% (incl. low-value imported goods); netflix tax applies to digital goods/services from overseas.',
    ],
    'South Africa': [
      'PSP licenses: SARB approval for non-bank PSPs under the National Payment System Act (amendments in draft). FSCA supervises market conduct.',
      'Data hosting: POPIA (since 2021, GDPR-aligned) — cross-border requires adequacy, consent or contractual safeguards.',
      'Verticals — licensed: sports betting (provincial), crypto under FSCA (VASP licensing since 2023). Adult permitted. Prohibited: online casino at national level.',
      'Tax: VAT 15%; foreign digital service providers must register under the VAT Act since 2014.',
    ],
    'Nigeria': [
      'PSP licenses: CBN — Switching & Processing (SVB), Mobile Money Operator (MMO), Payment Service Bank (PSB), Payment Solution Service Provider (PSSP). NIBSS operates the NIP rail.',
      'Data hosting: NDPR (GDPR-aligned) enforced by NDPC; CBN guidelines add sectoral localisation for financial data.',
      'Verticals — licensed: gambling via NLRC + state authorities. Crypto partially reopened 2023 with VASP licensing after the 2021 banking ban. Adult prohibited.',
      'Tax: VAT 7.5%; foreign digital service providers within scope.',
    ],
    'Kenya': [
      'PSP license: CBK PSP under the National Payment System Act and Regulations 2014.',
      'Data hosting: Data Protection Act 2019 (GDPR-aligned) — cross-border with adequacy or contractual safeguards; ODPC enforces.',
      'Verticals — licensed: gambling under BCLB. Adult permitted. Crypto not legal tender — VASP framework under development (CMA / CBK joint draft 2025).',
      'Tax: VAT 16%; Digital Service Tax 1.5% on foreign digital providers.',
    ],
    'Egypt': [
      'PSP license: CBE-licensed PSP under Banking Law 194/2020.',
      'Data hosting: Data Protection Law 151/2020 (GDPR-aligned); cross-border with adequacy or licence from the Data Protection Centre.',
      'MoR: feasible — foreign sellers register for the simplified VAT regime; Paymob, Fawry and MyFawry commonly act as local MoR for EGP settlement and tax handling.',
      'Verticals — prohibited: gambling, crypto as payment instrument (CBE directive), adult.',
    ],
    'Saudi Arabia': [
      'PSP licenses: SAMA — Acquiring License, Money Transfer License, Electronic Money Institution License under the PSP Regulation. Open Banking Phase 2 live since 2024.',
      'Data hosting: PDPL (fully enforceable Sep 2024) — sensitive-data localisation; SAMA cloud computing rules layered on top for FIs.',
      'MoR: feasible via SAMA-licensed PSPs (Tap, Geidea, HyperPay) — they handle VAT collection at checkout and Zakat exposure for foreign sellers.',
      'Verticals — prohibited: gambling (Islamic finance), alcohol, adult. Crypto unregulated — SAMA cautious on merchant settlement.',
    ],
    'Qatar': [
      'PSP licenses: QCB Payment Service Provider under the 2022 strategic framework; QFC offers an alternative common-law jurisdiction (QFCRA) similar to DIFC / ADGM.',
      'Data hosting: Law No. 13 of 2016 reinforced by Qatar National Cyber Security Strategy; sensitive financial data subject to sectoral localisation.',
      'MoR: feasible via QCB-licensed PSP or a QFC vehicle.',
      'Verticals — prohibited: gambling, alcohol-online, adult. Crypto unregulated; pharma online via MoPH-licensed pharmacies.',
    ],
    'Bahrain': [
      'PSP licenses: CBB Payment Service Provider — one of the most progressive GCC frameworks, with the Regulatory Sandbox since 2017 and PSD2-style Open Banking mandated 2018.',
      'Data hosting: PDPL (2018, GDPR-aligned) enforced by the Personal Data Protection Authority.',
      'MoR: feasible via CBB-licensed PSP — Bahrain is commonly used as a regional MoR hub for the Gulf.',
      'Verticals — licensed: crypto under CBB Digital Assets framework (2019 — Rain, CoinMENA registered). Prohibited: gambling, adult; alcohol-online only via licensed channels.',
    ],
    'Israel': [
      'PSP licenses: CMISA license under the Payment Services Law (2019, effective 2020) — PSD2-aligned; Bank of Israel supervises bank-related services.',
      'Data hosting: Privacy Protection Law (1981, regulations 2017) — cross-border with adequacy or consent; Privacy Protection Authority enforces.',
      'MoR: feasible via CMISA license; foreign sellers commonly register for VAT under Sec 33A of the VAT Law.',
      'Verticals — licensed: crypto under ISA (exchange licensing); adult permitted. Restricted/prohibited: gambling outside state operators (Mifal Hapayis, Toto); pharma prescription-only.',
    ],
    'Kuwait': [
      'PSP licenses: CBK Payment Service Provider under the Instructions on Electronic Payments (2018, updated 2023).',
      'Data hosting: Law No. 20 of 2014 (IT-focused); comprehensive GDPR-aligned PDPL in draft.',
      'MoR: feasible via CBK-licensed PSP — no VAT yet so MoR tax exposure is limited compared with UAE / Saudi.',
      'Verticals — prohibited: gambling (Islamic finance), alcohol, adult. Crypto unregulated.',
    ],
    'Oman': [
      'PSP licenses: CBO Payment Service Provider under the 2020 PSP Regulatory Framework.',
      'Data hosting: PDPL under Royal Decree 6/2022 (GDPR-aligned); cross-border with adequacy or consent.',
      'MoR: feasible via CBO-licensed PSP (e.g., Thawani).',
      'Verticals — prohibited: gambling, alcohol-online, adult. Crypto unregulated; pharma online via MoH-licensed pharmacies.',
    ],
    'Jordan': [
      'PSP licenses: CBJ Payment Service Provider under the Electronic Transactions and Electronic Money regulations.',
      'Data hosting: Data Protection Law (2023, GDPR-aligned, implementation ongoing).',
      'MoR: feasible via CBJ-licensed PSP; foreign digital providers register for the 16% GST.',
      'Verticals — prohibited or restricted: gambling, adult. Crypto unregulated; pharma online via JFDA-licensed pharmacies.',
    ],
    'Turkey': [
      'PSP licenses: BDDK e-money / payment institution under Law 6493 (2013). BKM operates the card switch; CBRT operates the FAST rail.',
      'Data hosting: KVKK (Law 6698, predates GDPR) — cross-border transfers require Data Protection Authority approval absent adequacy.',
      'Verticals — licensed (state-only): gambling via state monopoly (İddaa, Milli Piyango). Prohibited as payment: crypto since 2021 (legal for investing). Restricted: adult (BTK blocks), pharma online (state pharmacy monopoly).',
      'Tax: VAT 20%; high inflation drives taksit (installment) behaviour at checkout.',
    ],
  }

  // Fallback filters for countries without a curated override.
  const MERCHANT_BOOST = new RegExp([
    'merchant\\s+of\\s+record', '\\bmor\\b', 'payment\\s+aggregator',
    'psp\\s+licen[cs]e', 'licen[cs]e\\s+(required|needed)', 'licen[cs]e\\s+from',
    'settlement', 'payout', 'withhold', '\\bvat\\b', '\\bgst\\b', '\\biva\\b',
    '\\btds\\b', 'cross[\\s-]?border',
    'data\\s+(local|residency|storage|protection)',
    'tokeniz', '\\bkyc\\b', '3[ds]?secure|3ds',
    'high[\\s-]?risk', 'restricted|prohibited', 'gambling|igaming',
    'crypto|virtual\\s+asset|stablecoin', 'adult|pornography',
    'pharma|prescription', 'tobacco|alcohol', 'firearm|weapon',
    'minor|age[\\s-]?verification', '\\bvertical', '\\bindustry',
    'allowed|forbidden|prohibited|banned',
  ].join('|'), 'i')

  // Drop lines that read as payment-method descriptions rather than
  // regulatory guidance — those belong on the digital trends / payment-mix
  // cards.
  const REG_EXCLUDE = new RegExp([
    '^(pix|upi|spei|codi|oxxo|fednow|rtp|mada|jamaica\\s+linq|paynow|bre[\\s-]?b|pse|bi[\\s-]?fast|qris|aani|sarie|prompt\\s*pay|napas|instapay|payshap|nip|m[\\s-]?pesa|sepa|faster\\s+payments|fast|fps|transferencias|yape|plin|nequi|daviplata|bizum|paypay|line\\s+pay|rakuten|gcash|maya|momo|grab\\s*pay|true\\s*money|tng|mada|satispay|postepay|paypal|alipay|wechat)\\s+(is|are)\\b',
    'installment[s]?\\s+payments?\\s+\\(',
    'cultural\\s+default',
    'parcelamento',
    'cuotas\\s+sin\\s+inter',
    'taksit',
    'real[\\s-]?time\\s+payment\\s+rail',
    'instant[\\s-]?payment\\s+rail',
    'launched\\s+(in\\s+)?\\d{4}',
  ].join('|'), 'i')

  const regulation = REG_OVERRIDES[selectedCountry]
    || rawRegulation
      .filter((line) => !REG_EXCLUDE.test(line))
      .sort((a, b) => {
        const am = MERCHANT_BOOST.test(a) ? 0 : 1
        const bm = MERCHANT_BOOST.test(b) ? 0 : 1
        return am - bm
      })

  // All sizes here are fixed pixels (no `vw`). The 1920×1080 design stage
  // already scales uniformly to fit either the iframe or fullscreen, so
  // letting clamp() respond to viewport width was double-scaling and
  // pushing layout past the stage edge in fullscreen. Fixed values =
  // identical layout in every mode.
  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minHeight: 0,
      overflowY: 'auto',
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 28,
      flexShrink: 0,
      marginBottom: 18,
    },
    flag: {
      width: 96,
      height: 'auto',
      borderRadius: 10,
      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      objectFit: 'cover',
      flexShrink: 0,
    },
    name: {
      fontFamily: 'var(--font-display)',
      fontSize: 56,
      fontWeight: 700,
      letterSpacing: '-1.2px',
      lineHeight: 1.05,
      color: theme.ink,
      margin: 0,
    },
    overviewStrip: {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.min(overviewEntries.length, 4))}, minmax(0, 1fr))`,
      gap: 14,
    },
    topStrip: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
    },
    paymentsCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
    },
    apmsWide: {
      flex: '3 1 auto',
    },
    apmsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 14,
    },
    localCombined: {
      gap: 10,
    },
    localCombinedRows: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    localCombinedRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
    },
    localCombinedSub: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      whiteSpace: 'nowrap',
    },
    overviewCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: '1 1 auto',
    },
    overviewLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '19px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '18px',
      minHeight: 0,
    },
    card: {
      // Match the blue-tinted overview/payments cards at the top of the
      // slide so every card on the country detail page reads as one set.
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '14px',
      padding: '15.5px',
      display: 'flex',
      flexDirection: 'column',
      gap: '9px',
      minWidth: 0,
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: '19px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.accent,
    },
    cardTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '19px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
    },
    list: {
      listStyle: 'none', padding: 0, margin: 0,
      display: 'flex', flexDirection: 'column', gap: '6.5px',
    },
    listItem: {
      fontSize: '13.5px',
      lineHeight: 1.45,
      color: theme.inkSecondary,
      paddingLeft: '16px',
      position: 'relative',
    },
    listBullet: {
      position: 'absolute', left: 0, top: '0.55em',
      width: '5px', height: '5px', borderRadius: '50%', background: theme.accent,
    },
    localGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '11.5px',
    },
    localCell: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    localLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    localValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '16.5px',
      fontWeight: 700,
      color: theme.inkStrong,
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '4px',
    },
    chip: {
      fontFamily: 'var(--font)',
      fontSize: '12px',
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: '100px',
      background: theme.isLight ? 'rgba(62,79,224,0.08)' : 'rgba(62,79,224,0.15)',
      border: `1px solid ${theme.borderAccent}`,
      color: theme.isLight ? theme.accentDeep : '#BDC3F6',
    },
    apmGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '9px',
      marginTop: '4px',
    },
    apmCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.06)' : 'rgba(62,79,224,0.10)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '10px',
      padding: '9px 11.5px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    apmName: {
      fontFamily: 'var(--font-display)',
      fontSize: '14.5px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.2,
      wordBreak: 'break-word',
    },
    apmType: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.6px',
      color: theme.inkMuted,
    },
    empty: {
      flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font)',
      fontSize: '19px',
      color: theme.inkMuted, textAlign: 'center', lineHeight: 1.5,
    },
  }

  if (!selectedCountry) {
    return (
      <SlideBase section="Country Detail">
        <div style={styles.empty}>Pick a country on the previous slide to see its detail.</div>
      </SlideBase>
    )
  }

  return (
    <SlideBase section="Country Detail">
      <div style={styles.body}>
        <div style={styles.titleRow}>
          {iso && (
            <img
              src={`https://flagcdn.com/w320/${iso}.png`}
              alt={`${selectedCountry} flag`}
              style={styles.flag}
            />
          )}
          <h2 style={styles.name}>{selectedCountry}</h2>
        </div>

        {overviewEntries.length > 0 && (
          <div style={styles.topStrip}>
            {overviewEntries.slice(0, 8).map(([label, value]) => (
              <div key={label} style={styles.overviewCard}>
                <span style={styles.overviewLabel}>{label}</span>
                <span style={styles.overviewValue}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {(localPayments.scheme || localPayments.a2a || filteredApms.length > 0) && (
          <div style={styles.topStrip}>
            {localPayments.scheme && (
              <div style={{ ...styles.overviewCard, ...styles.paymentsCard }}>
                <span style={styles.overviewLabel}>Local schemes</span>
                <span style={styles.overviewValue}>{localPayments.scheme}</span>
              </div>
            )}
            {localPayments.a2a && (
              <div style={{ ...styles.overviewCard, ...styles.paymentsCard }}>
                <span style={styles.overviewLabel}>A2A</span>
                <span style={styles.overviewValue}>{localPayments.a2a}</span>
              </div>
            )}
            {filteredApms.length > 0 && (
              <div style={{ ...styles.overviewCard, ...styles.paymentsCard, ...styles.localCombined, ...styles.apmsWide }}>
                <span style={styles.overviewLabel}>Relevant APMs</span>
                <div style={styles.apmsRow}>
                  {filteredApms.slice(0, 3).map((a, i) => {
                    const name = typeof a === 'string' ? a : (a?.name || '')
                    const type = typeof a === 'object' ? (a?.type || '') : ''
                    return (
                      <div key={`apm-${i}`} style={styles.localCombinedRow}>
                        {type && <span style={styles.localCombinedSub}>{type}</span>}
                        <span style={styles.overviewValue}>{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={styles.grid}>
          <div style={styles.card}>
            <span style={styles.cardHeader}>Digital Trends</span>
            <ul style={styles.list}>
              {digitalTrends.slice(0, 4).map((t, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={styles.listBullet} aria-hidden />
                  {typeof t === 'string' ? t : (t?.text || t?.title || '')}
                </li>
              ))}
            </ul>
          </div>

          <div style={styles.card}>
            <span style={styles.cardHeader}>Payment Mix E-commerce</span>
            {breakdown.length > 0
              ? <PaymentBreakdown items={breakdown} theme={theme} />
              : <p style={{ color: theme.inkMuted, margin: 0 }}>Breakdown not published for this market.</p>}
          </div>
        </div>

        {regulation.length > 0 && (
          <div style={styles.card}>
            <span style={styles.cardHeader}>Regulation</span>
            <ul style={styles.list}>
              {regulation.slice(0, 4).map((line, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={styles.listBullet} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SlideBase>
  )
}

import { useEffect, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import { COUNTRY_PROVIDERS, PROVIDER_VERTICALS, REGION_PROVIDERS } from '../../data/country-rich-data'
import { COUNTRY_LIST_BY_REGION } from '../../data/regional-data'

// Aliases the rich-JSON country naming → COUNTRY_PROVIDERS naming.
const PROVIDER_KEY_ALIAS = {
  UAE: 'United Arab Emirates',
}

// country → region lookup so we can fall back to REGION_PROVIDERS when
// a country has no curated row. Built once at module load.
const COUNTRY_REGION = (() => {
  const out = {}
  for (const [region, countries] of Object.entries(COUNTRY_LIST_BY_REGION || {})) {
    for (const c of (countries || [])) out[c] = region
  }
  return out
})()

// Pick the top 5 providers for the given country, prioritising rows
// whose PROVIDER_VERTICALS match the merchant's detected vertical
// (digital_goods, retail, travel, etc.). Falls back to the curated
// order when no vertical is known or none of the rows match.
function rankPartnersByVertical(rows, vertical) {
  if (!rows || rows.length === 0) return []
  const v = vertical || 'general'
  const scored = rows.map((row, i) => {
    const tags = PROVIDER_VERTICALS[row.name] || ['general']
    const exact = tags.includes(v)
    const general = tags.includes('general')
    // Lower score = higher priority. Exact vertical first, then general
    // (universal) providers, then the rest. Original-order index breaks
    // ties so the curated "most relevant first" hand-ranking still wins
    // within each tier.
    let score = 2
    if (exact) score = 0
    else if (general) score = 1
    return { row, score, i }
  })
  scored.sort((a, b) => (a.score - b.score) || (a.i - b.i))
  return scored.slice(0, 5).map((s) => s.row)
}

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
        gap: '5px',
        overflow: 'hidden',
      }}
    >
      {rows.slice(0, 6).map((row, i) => {
        const widthPct = (row.share / maxShare) * 100
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(100px, 1.3fr) minmax(0, 3fr) auto',
              alignItems: 'center',
              gap: '9px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: theme.inkStrong,
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {row.name}
              </div>
              {row.detail && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '8.5px',
                    fontWeight: 600,
                    color: theme.inkMuted,
                    letterSpacing: '0.3px',
                    lineHeight: 1.25,
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
                height: '17px',
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
                  fontSize: '10px',
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
                fontSize: '10px',
                fontWeight: 700,
                color: growthColor(row.growth),
                fontVariantNumeric: 'tabular-nums',
                minWidth: '52px',
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

export default function SlideCountryDetailPage({ selectedCountry, merchantVertical }) {
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
  const providerKey = selectedCountry
    ? (PROVIDER_KEY_ALIAS[selectedCountry] || selectedCountry)
    : null
  const countryRegion = selectedCountry ? COUNTRY_REGION[selectedCountry] : null
  const rawPartners =
    (providerKey && COUNTRY_PROVIDERS[providerKey])
    || (countryRegion && REGION_PROVIDERS[countryRegion])
    || []
  const partners = rankPartnersByVertical(rawPartners, merchantVertical)

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

  // Merchant-side regulation per country. Each card describes what a
  // merchant — as a legal entity entering the market — needs to deal
  // with: local presence, tax registration, data residency, and
  // vertical / product restrictions. PSP-side licensing (what a payment
  // provider needs) is intentionally omitted — that is not what the
  // merchant is buying from Yuno.
  const REG_OVERRIDES = {
    'Brazil': [
      'Local entity: not required with a MoR — they settle in BRL and absorb the tax stack. Direct selling needs a CNPJ (corporate tax ID).',
      'Tax stack: ISS 2–5% (municipal), PIS/COFINS ~9.25% (federal), IOF 0.38% on FX. Digital services to Brazilian consumers are in scope.',
      'Data: LGPD (GDPR-equivalent) treats payment data as sensitive; ANPD fines up to 2% of Brazilian revenue. Cross-border allowed with safeguards.',
      'Verticals — licensed: iGaming & sports betting (Bets.gov.br, 2024), crypto (Marco Legal), adult. Restricted: pharma & alcohol (product registration + age).',
    ],
    'India': [
      'Local entity: required for direct operations (subsidiary or branch). MoR via a PA-CB-licensed local partner is the common cross-border path.',
      'Tax: 18% GST on digital services; 1% TDS withheld on marketplace payouts (Sec 194-O); GST registration mandatory above turnover thresholds.',
      'Data: full localisation — payment data must stay on Indian servers; no copies outside, even backups. Raw PANs forbidden in chain (tokenisation since 2022).',
      'Verticals — prohibited/restricted: real-money gaming & betting (state laws diverge), crypto as payment, adult, alcohol & tobacco online. Fantasy sports (skill) permitted.',
    ],
    'Mexico': [
      'Local entity: optional — foreign digital sellers register with SAT under the simplified regime; MoR partners common. Direct retail / financial services need a Mexican entity.',
      'Tax: IVA 16% on B2C digital services — PSPs withhold at checkout; SAT marketplace withholding regime for platforms with Mexican sellers.',
      'Data: LFPDPPP — cross-border transfer with consent or contractual safeguards; no general localisation mandate.',
      'Verticals — licensed: sports betting & online casino (DGJS/SEGOB), adult. Restricted: crypto as merchant settlement (Banxico), prescription pharma (COFEPRIS).',
    ],
    'United States': [
      'Local entity: sales-tax nexus rules trigger state-by-state registration above thresholds (~$100K or 200 transactions). MoR providers (Paddle, Lemon Squeezy) commonly absorb this for SaaS.',
      'Tax: no federal VAT. State + local sales tax 0–10% varies by state, city, and product; economic-nexus rules drive registration even without physical presence.',
      'Data: no federal mandate. State privacy laws apply (CCPA/CPRA in CA, equivalents in CO/CT/VA/UT) plus PCI-DSS v4.0 mandatory for cardholder data.',
      'Verticals — state-licensed: online casino (NJ, MI, PA, CT, WV), sports betting (~40 states), adult (state-specific age-verification), firearms (FFL + state). Network-blocked: cannabis (federally Schedule I).',
    ],
    'UAE': [
      'Local entity: typically required (mainland trade license or free-zone vehicle in ADGM / DIFC / JAFZA). MoR partners enable foreign-seller models without a local entity.',
      'Tax: VAT 5%; corporate tax 9% on profits above AED 375K; no personal income tax. Excise tax on tobacco / sugary drinks.',
      'Data: PDPL (GDPR-aligned) federally; DIFC and ADGM have their own free-zone data laws. Sensitive sectoral data subject to localisation.',
      'Verticals — licensed: crypto under VARA (Dubai) and ADGM / FSRA. Prohibited: gambling, adult, alcohol-online outside licensed channels.',
    ],
    'Germany': [
      'Local entity: not required for EU sellers under VAT OSS (One-Stop-Shop) for B2C. Permanent establishment triggers full German corporate tax.',
      'Tax: VAT 19% standard / 7% reduced. Mandatory B2B/B2C e-invoice rollout phasing in from 2025 (full B2B mandate by 2028).',
      'Data: GDPR + BDSG — among the EU’s strictest. BfDI + state DPAs enforce aggressively; sectoral cloud / outsourcing rules apply for FIs.',
      'Verticals — licensed: gambling (GlüStV, 2021), crypto (MiCA, 2024), adult (JMStV — strict youth protection), pharma via DocMorris / Apotheke pharmacies.',
    ],
    'Indonesia': [
      'Local entity: foreign digital sellers register via OSS (Online Single Submission) above thresholds; direct retail / financial services typically need a PT PMA (foreign-investment company).',
      'Tax: VAT 11% on digital services — foreign providers must register and collect; 5% withholding for non-resident digital services.',
      'Data: PDP Law (2024) — consent required for cross-border transfer; sectoral localisation for financial data via OJK / BI rules.',
      'Verticals — permitted: crypto trading via Bappebti (not a permitted payment method). Prohibited: gambling (Kominfo blocks), adult, pharma e-commerce restricted via BPOM.',
    ],
    'Argentina': [
      'Local entity: typically required for direct selling (SRL/SA). FX controls force foreign sellers through BCRA-authorised channels for USD settlement.',
      'Tax: VAT 21% + provincial gross-income IIBB 3–5% + PAIS tax (30% FX on imports). AFIP withholdings on PSP payouts.',
      'Data: Law 25.326 — cross-border transfers allowed to adequate jurisdictions or with consent / SCCs. AAIP enforces.',
      'Verticals — licensed: gambling by province (CABA, Buenos Aires, Mendoza). Crypto legal (not tender) — highest per-capita stablecoin user in LatAm.',
    ],
    'Chile': [
      'Local entity: optional — foreign digital sellers register under Ley 21.210 to collect IVA without a local entity (~500 already registered).',
      'Tax: VAT (IVA) 19% on most digital services. No withholding for cross-border B2B if the recipient is a registered taxpayer.',
      'Data: Ley 19.628 being replaced by GDPR-aligned Ley 21.719 (in force Dec 2026) — DPO, impact assessments, tighter cross-border rules.',
      'Verticals — licensed: gambling via casino concessions, crypto under LMSF (stablecoins permitted but rare at checkout), adult. Pharma prescription via ISP.',
    ],
    'Colombia': [
      'Local entity: optional — foreign digital sellers register with DIAN to collect IVA without a local entity. Direct retail / financial services need a SAS / SA.',
      'Tax: VAT (IVA) 19% on most digital services. Retención en la fuente (withholding) applies on payouts to local sellers.',
      'Data: Ley 1581/2012 — cross-border requires adequacy or contractual safeguards; SIC database registration mandatory.',
      'Verticals — licensed: gambling under Coljuegos (one of the more orderly LatAm regimes). Crypto legal but unregulated as payment; pharma prescription via INVIMA.',
    ],
    'Peru': [
      'Local entity: optional — foreign digital sellers register with SUNAT to collect IGV. Direct retail / financial services typically need a SAC / SA.',
      'Tax: VAT (IGV) 18%. SUNAT enforcement on foreign digital providers tightened in 2025.',
      'Data: Ley 29.733 — cross-border requires adequacy or consent; ANPD enforces.',
      'Verticals — licensed: gambling under MINCETUR (sports-betting law, 2023). Crypto unregulated (BCRP warnings); pharma prescription via DIGEMID.',
    ],
    'United Kingdom': [
      'Local entity: not required for B2C if VAT-registered under the Non-Established Taxable Person scheme (post-Brexit). PE triggers full UK corporate tax (25%).',
      'Tax: VAT 20% standard / 5% reduced / 0% on most food. Low-value consignment relief ended post-Brexit; digital services taxed at full rate.',
      'Data: UK GDPR + Data Protection Act 2018 — adequacy with the EU intact; cross-border to adequate jurisdictions allowed. ICO enforces.',
      'Verticals — licensed: gambling under UKGC (among the world’s strictest — affordability checks, deposit limits, slots stake cap). Adult licensed (Online Safety Act 2025 age-verification).',
    ],
    'France': [
      'Local entity: not required for EU sellers under VAT OSS for B2C. Non-EU sellers can use IOSS for low-value (<€150) or appoint a fiscal representative.',
      'Tax: VAT 20% standard / 5.5–10% reduced. Digital services within scope. Payment-terms law (LME) caps B2B invoice windows.',
      'Data: GDPR + Loi Informatique et Libertés — CNIL is a high-profile data regulator; cross-border via adequacy or SCCs.',
      'Verticals — licensed: gambling under ANJ (sports, poker, horse racing — online casinos prohibited), crypto under MiCA, adult (Arcom age-verification since 2024).',
    ],
    'Italy': [
      'Local entity: not required for EU sellers under VAT OSS. Non-EU sellers appoint a fiscal representative.',
      'Tax: VAT (IVA) 22%. Mandatory B2B/B2C e-invoicing since 2019 — non-compliance blocks deductions.',
      'Data: GDPR + Codice Privacy (D.lgs 196/2003) — Garante enforces; cross-border via adequacy or SCCs.',
      'Verticals — licensed: gambling under ADM (one of Europe’s largest regulated markets — casino, sports, poker, bingo). Crypto under MiCA + CONSOB / OAM. Tobacco is a state-monopoly.',
    ],
    'Spain': [
      'Local entity: not required for EU sellers under VAT OSS. Non-EU sellers appoint a fiscal representative.',
      'Tax: VAT (IVA) 21%. Foreign digital service providers register; reduced rates 10% / 4% for essentials.',
      'Data: GDPR + LOPDGDD — AEPD enforces strictly; cross-border via adequacy or SCCs.',
      'Verticals — licensed: gambling under DGOJ (since 2012), crypto under MiCA (CNMV + BdE joint oversight). Tobacco state-monopoly — online sale prohibited.',
    ],
    'Japan': [
      'Local entity: foreign digital services to Japanese consumers register for JCT (Japan Consumption Tax). PE triggers full Japanese corporate tax (~30%).',
      'Tax: consumption tax 10% standard / 8% on food. Invoice-based e-receipts mandatory since 2023.',
      'Data: APPI (amended 2022) — cross-border transfers require adequacy or specific consent; sectoral FSA guidance for FIs.',
      'Verticals — licensed: crypto under FIEA (one of the strictest globally), adult (age + censorship laws). Prohibited: gambling outside public lotteries and pari-mutuel.',
    ],
    'Singapore': [
      'Local entity: foreign digital services subject to GST under the Overseas Vendor Registration regime above thresholds. Direct retail / financial services typically need a Pte Ltd.',
      'Tax: GST 9%. Corporate tax 17% (with regional-HQ incentives). Overseas Vendor Registration for foreign digital service providers.',
      'Data: PDPA — cross-border requires adequacy or consent. MAS TRM Guidelines apply for FIs.',
      'Verticals — licensed: crypto under PSA (DPT services strictly regulated; public marketing banned). Prohibited: gambling outside Singapore Pools / Turf Club, adult (sites blocked).',
    ],
    'Thailand': [
      'Local entity: foreign digital services register with the Revenue Department for VAT above thresholds. Local representative required for foreign data controllers under PDPA.',
      'Tax: VAT 7%. Non-resident digital services subject to VAT since 2021 (foreign-vendor registration regime).',
      'Data: PDPA (full enforcement 2022, GDPR-aligned) — local representative required for foreign data controllers; cross-border via adequacy or consent.',
      'Verticals — licensed: crypto under SEC Thailand. Prohibited (criminal): gambling outside state lottery & limited horse racing, adult (blocked), pharma online sale.',
    ],
    'Vietnam': [
      'Local entity: foreign digital services subject to FCT (Foreign Contractor Tax) regime. PE rules trigger full Vietnamese corporate tax (20%).',
      'Tax: VAT 10%. 5% digital service tax on foreign non-resident providers (effective 2022).',
      'Data: Cybersecurity Law (2018) + PDP Decree (2023) — localisation of user data on Vietnam servers required for certain categories; cross-border requires impact assessment.',
      'Verticals — prohibited (criminal): gambling, adult (Decree 72 blocks). Restricted: pharma online (MoH), crypto legal-grey (not a permitted payment method).',
    ],
    'Philippines': [
      'Local entity: foreign digital service providers register for VAT (effective 2024). Direct retail / financial services typically need a domestic corporation.',
      'Tax: VAT 12% (extended to foreign digital providers since 2024). Corporate tax 25%.',
      'Data: Data Privacy Act 2012 — cross-border with consent or contract; NPC enforces.',
      'Verticals — licensed: gambling under PAGCOR (POGO offshore operations banned 2024; domestic eGames licensed). Crypto under BSP VASP framework. Adult prohibited.',
    ],
    'Australia': [
      'Local entity: foreign digital sellers register for GST under the netflix-tax regime. PE rules trigger full Australian corporate tax (25–30%).',
      'Tax: GST 10% (incl. low-value imported goods). Digital products and services from overseas are within scope.',
      'Data: Privacy Act 1988 + Consumer Data Right — APP 8 governs cross-border disclosure with accountability. OAIC enforces.',
      'Verticals — licensed: gambling under IGA (sports & race wagering allowed — online casino prohibited). Crypto under ASIC + AUSTRAC. Adult permitted (federal age-verification trial 2025).',
    ],
    'South Africa': [
      'Local entity: foreign digital service providers register for VAT (since 2014) above ZAR 1M threshold. PE rules trigger SA corporate tax (27%).',
      'Tax: VAT 15%. Foreign digital services subject under VAT Act since 2014; corporate tax 27%.',
      'Data: POPIA (since 2021, GDPR-aligned) — cross-border requires adequacy, consent or contractual safeguards.',
      'Verticals — licensed: sports betting (provincial), crypto under FSCA (VASP licensing since 2023), adult. Prohibited: online casino at national level.',
    ],
    'Nigeria': [
      'Local entity: foreign digital service providers register for VAT (effective 2022). PE rules trigger Nigerian corporate tax (30% large / 20% medium).',
      'Tax: VAT 7.5%. Foreign digital services within scope; corporate tax 30% for large companies.',
      'Data: NDPR (GDPR-aligned) enforced by NDPC; CBN guidelines add sectoral localisation for financial data.',
      'Verticals — licensed: gambling via NLRC + state authorities. Crypto partially reopened 2023 with VASP framework. Adult prohibited.',
    ],
    'Kenya': [
      'Local entity: foreign digital service providers register for Digital Service Tax + VAT. PE rules trigger Kenyan corporate tax (30%).',
      'Tax: VAT 16%. Digital Service Tax 1.5% on foreign digital providers; corporate tax 30%.',
      'Data: Data Protection Act 2019 (GDPR-aligned) — cross-border with adequacy or contractual safeguards. ODPC enforces.',
      'Verticals — licensed: gambling under BCLB. Crypto not legal tender — VASP framework under development. Adult permitted.',
    ],
    'Egypt': [
      'Local entity: foreign digital sellers register via the simplified VAT regime. Direct retail / financial services typically need a domestic LLC or branch.',
      'Tax: VAT 14%. Foreign digital service providers register via simplified regime; corporate tax 22.5%.',
      'Data: Data Protection Law 151/2020 (GDPR-aligned); cross-border with adequacy or licence from the Data Protection Centre.',
      'Verticals — prohibited: gambling, crypto as payment instrument (CBE directive), adult.',
    ],
    'Saudi Arabia': [
      'Local entity: foreign sellers can rely on MoR partners or register with ZATCA for VAT. Direct retail / financial services need a subsidiary or branch under MISA license.',
      'Tax: VAT 15%. Corporate tax 20% for foreign investors; Zakat (2.5%) for GCC-owned businesses instead of corporate tax.',
      'Data: PDPL (fully enforceable Sep 2024) — sensitive-data localisation; SAMA cloud computing rules layered on top for FIs.',
      'Verticals — prohibited: gambling (Islamic finance), alcohol, adult. Crypto unregulated — SAMA cautious on merchant settlement.',
    ],
    'Qatar': [
      'Local entity: foreign sellers typically need a QFC (free-zone) vehicle or a mainland CR (Commercial Registration); QFC offers a common-law alternative.',
      'Tax: VAT legislatively ready since 2018 but not yet implemented. Excise tax 50–100% on tobacco / sugary drinks; corporate tax 10% on foreign-source income.',
      'Data: Law No. 13 of 2016 reinforced by the Qatar National Cyber Security Strategy; sensitive financial data subject to sectoral localisation.',
      'Verticals — prohibited: gambling, alcohol-online, adult. Crypto unregulated; pharma online via MoPH-licensed pharmacies.',
    ],
    'Bahrain': [
      'Local entity: foreign sellers can use a CR (Commercial Registration) or a free-zone vehicle — one of the most foreign-investor-friendly GCC jurisdictions.',
      'Tax: VAT 10% (raised from 5% in 2022). Foreign digital providers register via simplified online regime; no personal income tax.',
      'Data: PDPL (2018, GDPR-aligned) enforced by the Personal Data Protection Authority.',
      'Verticals — licensed: crypto under CBB Digital Assets framework (2019 — Rain, CoinMENA registered). Prohibited: gambling, adult. Alcohol-online only via licensed channels.',
    ],
    'Israel': [
      'Local entity: foreign digital sellers register under Sec 33A of the VAT Law. PE rules trigger Israeli corporate tax (23%).',
      'Tax: VAT 17%. Foreign digital service providers register under Sec 33A.',
      'Data: Privacy Protection Law (1981, regulations 2017) — cross-border with adequacy or consent; Privacy Protection Authority enforces.',
      'Verticals — licensed: crypto under ISA (exchange licensing); adult permitted. Restricted: gambling outside state operators (Mifal Hapayis, Toto); pharma prescription-only.',
    ],
    'Kuwait': [
      'Local entity: foreign sellers typically need a 100%-foreign-owned vehicle via KDIPA or a 51% Kuwaiti-owned WLL / LLC for direct sales.',
      'Tax: no VAT yet (politically delayed since 2018 GCC agreement). Corporate tax 15% applies only to foreign businesses; no personal income tax.',
      'Data: Law No. 20 of 2014 (IT-focused). A comprehensive GDPR-aligned PDPL is in draft.',
      'Verticals — prohibited: gambling (Islamic finance), alcohol, adult. Crypto unregulated.',
    ],
    'Oman': [
      'Local entity: foreign sellers can use Duqm Free Zone (tax breaks, 100% foreign ownership) or a mainland LLC. CBO-licensed PSP partners enable MoR.',
      'Tax: VAT 5% (introduced 2021). Excise tax on tobacco / sugary drinks; no personal income tax.',
      'Data: PDPL under Royal Decree 6/2022 (GDPR-aligned); cross-border with adequacy or consent.',
      'Verticals — prohibited: gambling, alcohol-online, adult. Crypto unregulated; pharma online via MoH-licensed pharmacies.',
    ],
    'Jordan': [
      'Local entity: foreign sellers can use a branch or an LLC. Foreign digital service providers register for the 16% GST.',
      'Tax: VAT (GST) 16%. Foreign digital service providers register; corporate tax 14% for non-financial sectors.',
      'Data: Data Protection Law (2023, GDPR-aligned, implementation ongoing).',
      'Verticals — prohibited or restricted: gambling, adult. Crypto unregulated; pharma online via JFDA-licensed pharmacies.',
    ],
    'Turkey': [
      'Local entity: foreign digital service providers register for KDV (VAT). PE rules trigger Turkish corporate tax (25%). Rep office common before full subsidiary.',
      'Tax: VAT 20%. High inflation drives taksit (installment) checkout behaviour; corporate tax 25%.',
      'Data: KVKK (Law 6698, predates GDPR) — cross-border transfers require Data Protection Authority approval absent adequacy.',
      'Verticals — licensed (state-only): gambling via state monopoly (İddaa, Milli Piyango). Prohibited as payment: crypto since 2021 (legal for investing). Restricted: adult (BTK blocks), pharma online (state pharmacy monopoly).',
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
      gap: 9,
      minHeight: 0,
      overflow: 'hidden',
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0,
      marginBottom: 6,
    },
    flag: {
      width: 68,
      height: 'auto',
      borderRadius: 8,
      boxShadow: '0 12px 28px rgba(0,0,0,0.32)',
      objectFit: 'cover',
      flexShrink: 0,
    },
    name: {
      fontFamily: 'var(--font-display)',
      fontSize: 38,
      fontWeight: 700,
      letterSpacing: '-1px',
      lineHeight: 1.05,
      color: theme.ink,
      margin: 0,
    },
    overviewStrip: {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.min(overviewEntries.length, 4))}, minmax(0, 1fr))`,
      gap: 9,
      flexShrink: 0,
    },
    topStrip: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 9,
      flexShrink: 0,
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
      gap: 9,
    },
    localCombined: {
      gap: 6,
    },
    localCombinedRows: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    localCombinedRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      minWidth: 0,
    },
    localCombinedSub: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      whiteSpace: 'nowrap',
    },
    overviewCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: 10,
      padding: '9px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: '1 1 auto',
      minHeight: 0,
    },
    overviewLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '15px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '11px',
      minHeight: 0,
      flex: '1 1 0',
    },
    card: {
      // Match the blue-tinted overview/payments cards at the top of the
      // slide so every card on the country detail page reads as one set.
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '12px',
      padding: '11px 13px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      fontWeight: 700,
      letterSpacing: '1.6px',
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
      display: 'flex', flexDirection: 'column', gap: '4px',
      minHeight: 0,
    },
    listItem: {
      fontSize: '11.5px',
      lineHeight: 1.35,
      color: theme.inkSecondary,
      paddingLeft: '14px',
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
    partnersIntro: {
      fontSize: '10.5px',
      lineHeight: 1.35,
      color: theme.inkSecondary,
      margin: 0,
    },
    partnersTable: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      marginTop: '2px',
    },
    partnerRow: {
      display: 'grid',
      gridTemplateColumns: 'minmax(100px, 0.7fr) minmax(0, 1.9fr)',
      alignItems: 'center',
      gap: '10px',
      padding: '4px 9px',
      background: theme.isLight ? 'rgba(62,79,224,0.06)' : 'rgba(62,79,224,0.10)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '7px',
    },
    partnerName: {
      fontFamily: 'var(--font-display)',
      fontSize: '11.5px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.15,
      wordBreak: 'break-word',
    },
    partnerNote: {
      fontFamily: 'var(--font)',
      fontSize: '10px',
      fontWeight: 500,
      color: theme.inkSecondary,
      lineHeight: 1.25,
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
              {digitalTrends.slice(0, 3).map((t, i) => (
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

        {(regulation.length > 0 || partners.length > 0) && (
          <div style={styles.grid}>
            {regulation.length > 0 && (
              <div style={styles.card}>
                <span style={styles.cardHeader}>Regulation</span>
                <ul style={styles.list}>
                  {regulation.slice(0, 3).map((line, i) => (
                    <li key={i} style={styles.listItem}>
                      <span style={styles.listBullet} aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={styles.card}>
              <span style={styles.cardHeader}>Providers</span>
              <p style={styles.partnersIntro}>
                We have partnerships with the region&rsquo;s most relevant providers
                (PSPs, Acquirers, APMs, Product and others), ranging from the largest
                players to the niche ones. Thanks to our extensive footprint, we can
                integrate any provider in less than a month and source new ones as
                needed.
              </p>
              <div style={styles.partnersTable}>
                {partners.slice(0, 5).map((p, i) => (
                  <div key={`${p.name}-${i}`} style={styles.partnerRow}>
                    <span style={styles.partnerName}>{p.name}</span>
                    <span style={styles.partnerNote}>{p.relevance || p.description || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideBase>
  )
}

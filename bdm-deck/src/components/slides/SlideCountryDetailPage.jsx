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
        // Distribute rows evenly so gaps are uniform top-to-bottom.
        justifyContent: 'space-around',
      }}
    >
      {rows.slice(0, 6).map((row, i) => {
        const widthPct = (row.share / maxShare) * 100
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              // Fixed first AND growth columns so every bar starts AND ends
              // at the same x-offset regardless of name/growth text length.
              gridTemplateColumns: '170px 1fr 90px',
              alignItems: 'center',
              gap: '9px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: theme.inkStrong,
                  lineHeight: 1.25,
                  wordBreak: 'break-word',
                }}
              >
                {row.name}
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                height: '20px',
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
                  fontSize: '12px',
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
                fontSize: '12px',
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
      'MoR — Yes. MoR partner settles in BRL and absorbs the full tax stack — fastest path for a foreign seller.',
      'Taxes — ~14% effective: ISS 2–5% (city) + PIS/COFINS 9.25% (federal) + IOF 0.38% on FX. Digital sales to Brazilian consumers are in scope.',
      'Direct entry — Brazilian CNPJ (corporate tax ID) + Receita Federal registration + a BRL bank account. PSP contracts in BRL only.',
      'Verticals — Allowed (licensed): iGaming & sports betting (Bets.gov.br, 2024), crypto, adult, alcohol & pharma online (age-gated). Prohibited: cannabis (medical-only).',
      'Data hosting — LGPD applies. Payment data is sensitive. Cross-border allowed with safeguards (SCCs/consent). No strict localisation.',
    ],
    'India': [
      'MoR — Yes, via a PA-CB-licensed local partner. Standard route for cross-border merchants.',
      'Taxes — 18% GST on digital services + 1% TDS withheld on marketplace payouts (Sec 194-O).',
      'Direct entry — local entity required (subsidiary or branch) + GST registration above thresholds.',
      'Verticals — Allowed: fantasy sports (skill-based), e-pharmacy. Prohibited: real-money gaming & betting (state laws diverge), crypto as payment, adult, alcohol & tobacco online, cannabis.',
      'Data hosting — full localisation. Payment data must stay on Indian servers, no foreign backups. Raw PANs forbidden — tokenisation mandatory since 2022.',
    ],
    'Mexico': [
      'MoR — Yes, common. Or register directly with SAT under the simplified foreign-seller regime.',
      'Taxes — 16% IVA on B2C digital services. PSPs withhold at checkout; marketplace withholding for platforms with Mexican sellers.',
      'Direct entry — optional for pure digital. Direct retail / financial services need a Mexican entity.',
      'Verticals — Allowed (licensed): sports betting & online casino (DGJS/SEGOB), adult, prescription pharma (COFEPRIS). Prohibited: crypto as merchant settlement (Banxico), cannabis.',
      'Data hosting — LFPDPPP. Cross-border allowed with consent or contractual safeguards. No general localisation mandate.',
    ],
    'United States': [
      'MoR — Yes. Paddle / Lemon Squeezy commonly absorb state sales-tax nexus for SaaS sellers.',
      'Taxes — no federal VAT. State + local sales tax 0–10% varies by state/city/product. Economic-nexus rules (~$100K or 200 tx/state) trigger registration without physical presence.',
      'Direct entry — no federal incorporation needed, but sales-tax nexus drives state-by-state registration as you cross thresholds.',
      'Verticals — Allowed (state-licensed): online casino (NJ/MI/PA/CT/WV), sports betting (~40 states), adult (state age-verification), firearms (FFL + state), crypto (BSA + state MTL). Prohibited: cannabis (federal Schedule I — network-blocked).',
      'Data hosting — no federal mandate. State privacy laws apply (CCPA/CPRA in CA, equivalents in CO/CT/VA/UT). PCI-DSS v4.0 mandatory for card data.',
    ],
    'UAE': [
      'MoR — Limited. PSPs typically require at minimum a UAE or KSA entity for GCC operations; pure foreign-seller MoR is rare.',
      'Taxes — 5% VAT + 9% corporate tax on profits above AED 375K. No personal income tax. Excise on tobacco / sugary drinks.',
      'Direct entry — mainland trade license OR a free-zone vehicle in ADGM / DIFC / JAFZA. Common GCC HQ jurisdiction.',
      'Verticals — Allowed (licensed): crypto (VARA Dubai / FSRA ADGM), alcohol via licensed channels. Prohibited: gambling, adult, cannabis.',
      'Data hosting — PDPL (GDPR-aligned) federally. ADGM & DIFC have own free-zone rules. Sensitive sectoral data subject to localisation.',
    ],
    'Germany': [
      'MoR — Yes, common for non-EU sellers. EU sellers can register directly via VAT OSS.',
      'Taxes — 19% VAT standard / 7% reduced. Mandatory B2B/B2C e-invoice rollout 2025–2028.',
      'Direct entry — not required for EU sellers under VAT OSS. Permanent establishment triggers full German corporate tax.',
      'Verticals — Allowed (licensed): gambling (GlüStV, 2021), crypto (MiCA, 2024), adult (strict youth-protection), pharma online (licensed pharmacies), cannabis (limited medical). Prohibited: unlicensed gambling.',
      'Data hosting — GDPR + BDSG, among the EU’s strictest. BfDI + state DPAs enforce aggressively. Sectoral cloud/outsourcing rules for financial services.',
    ],
    'Indonesia': [
      'MoR — Yes, recommended. Tax + licensing stack is complex for direct entry.',
      'Taxes — 11% VAT on digital services (foreign providers must register and collect) + 5% withholding for non-resident digital services.',
      'Direct entry — foreign sellers register via OSS (Online Single Submission). Direct retail / financial services need a PT PMA (foreign-investment company).',
      'Verticals — Allowed (licensed): crypto trading via Bappebti (not for payment), pharma e-commerce (BPOM-restricted). Prohibited: gambling (Kominfo blocks), adult, cannabis.',
      'Data hosting — PDP Law (2024). Consent required for cross-border. Sectoral localisation for financial data via OJK / BI rules.',
    ],
    'Argentina': [
      'MoR — Yes, often necessary. FX controls force foreign sellers through BCRA-authorised channels.',
      'Taxes — 21% VAT + provincial gross-income IIBB 3–5% + PAIS tax (30% FX on imports) + AFIP withholdings on payouts. Heavy effective load.',
      'Direct entry — typically requires an SRL/SA for direct selling. FX controls complicate USD settlement.',
      'Verticals — Allowed (licensed by province): gambling (CABA, Buenos Aires, Mendoza), crypto (legal, not tender — top stablecoin user in LatAm), adult. Prohibited: federal-level unlicensed gambling, cannabis.',
      'Data hosting — Law 25.326. Transfers allowed to adequate jurisdictions or with consent / SCCs. AAIP enforces.',
    ],
    'Chile': [
      'MoR — Yes, but direct is also easy: foreign sellers can register under Ley 21.210 with no local entity.',
      'Taxes — 19% IVA on most digital services. No withholding for cross-border B2B if the recipient is a registered taxpayer.',
      'Direct entry — optional. Foreign digital sellers register and operate without a local entity (~500 already do).',
      'Verticals — Allowed (licensed): gambling via casino concessions, crypto under LMSF (rare at checkout), adult, prescription pharma (ISP). Prohibited: cannabis.',
      'Data hosting — Ley 19.628 being replaced by GDPR-aligned Ley 21.719 (in force Dec 2026): DPO, impact assessments, tighter cross-border rules.',
    ],
    'Colombia': [
      'MoR — Yes, common. Or register directly with DIAN.',
      'Taxes — 19% IVA on most digital services + retención en la fuente (withholding) on payouts to local sellers.',
      'Direct entry — optional for digital. Foreign sellers register with DIAN. Direct retail / financial services need an SAS / SA.',
      'Verticals — Allowed (licensed): gambling under Coljuegos (one of the more orderly LatAm regimes), prescription pharma (INVIMA), adult. Prohibited or grey: crypto as payment, cannabis.',
      'Data hosting — Ley 1581/2012. Cross-border requires adequacy or contractual safeguards. SIC database registration mandatory.',
    ],
    'Peru': [
      'MoR — Yes. Or register directly with SUNAT.',
      'Taxes — 18% IGV. SUNAT enforcement on foreign digital providers tightened in 2025.',
      'Direct entry — optional for digital. Foreign sellers register with SUNAT. Direct retail / financial services need a SAC / SA.',
      'Verticals — Allowed (licensed): gambling under MINCETUR (sports-betting law, 2023), prescription pharma (DIGEMID), adult. Prohibited or grey: crypto as payment (BCRP warnings), cannabis.',
      'Data hosting — Ley 29.733. Cross-border requires adequacy or consent. ANPD enforces.',
    ],
    'United Kingdom': [
      'MoR — Yes, common post-Brexit. Or register directly under the Non-Established Taxable Person (NETP) scheme.',
      'Taxes — 20% VAT standard / 5% reduced / 0% on most food. Low-value consignment relief ended post-Brexit.',
      'Direct entry — not required for B2C if VAT-registered under NETP. Permanent establishment triggers full UK corporate tax (25%).',
      'Verticals — Allowed (licensed): gambling under UKGC (strictest in the world — affordability checks, stake caps), crypto (FCA registration), adult (Online Safety Act 2025 age-verification), pharma online (MHRA), cannabis (medical only). Prohibited: unlicensed gambling.',
      'Data hosting — UK GDPR + Data Protection Act 2018. EU adequacy intact — cross-border to adequate jurisdictions allowed. ICO enforces.',
    ],
    'France': [
      'MoR — Yes, common for non-EU. EU sellers can use VAT OSS directly.',
      'Taxes — 20% VAT / 5.5–10% reduced. Digital services in scope. Payment-terms law (LME) caps B2B invoice windows.',
      'Direct entry — not required for EU sellers under OSS. Non-EU sellers use IOSS (<€150) or appoint a fiscal representative.',
      'Verticals — Allowed (licensed): gambling under ANJ (sports, poker, horse racing only), crypto (MiCA), adult (Arcom age-verification since 2024), pharma online (ANSM). Prohibited: online casinos, cannabis (limited medical).',
      'Data hosting — GDPR + Loi Informatique et Libertés. CNIL is a high-profile regulator. Cross-border via adequacy or SCCs.',
    ],
    'Italy': [
      'MoR — Yes, common for non-EU.',
      'Taxes — 22% IVA. Mandatory B2B/B2C e-invoicing since 2019 — non-compliance blocks deductions.',
      'Direct entry — not required for EU sellers under VAT OSS. Non-EU sellers appoint a fiscal representative.',
      'Verticals — Allowed (licensed): gambling under ADM (casino, sports, poker, bingo — one of Europe’s largest regulated markets), crypto (MiCA + CONSOB/OAM), adult, pharma online (AIFA). Prohibited: tobacco online (state-monopoly), cannabis (limited medical).',
      'Data hosting — GDPR + Codice Privacy. Garante enforces. Cross-border via adequacy or SCCs.',
    ],
    'Spain': [
      'MoR — Yes, common for non-EU.',
      'Taxes — 21% IVA standard / 10% / 4% reduced for essentials.',
      'Direct entry — not required for EU sellers under VAT OSS. Non-EU sellers appoint a fiscal representative.',
      'Verticals — Allowed (licensed): gambling under DGOJ (since 2012), crypto (MiCA — CNMV + BdE joint oversight), adult, pharma online (AEMPS). Prohibited: tobacco online (state-monopoly), cannabis.',
      'Data hosting — GDPR + LOPDGDD. AEPD enforces strictly. Cross-border via adequacy or SCCs.',
    ],
    'Japan': [
      'MoR — Yes, common below the local-entity threshold.',
      'Taxes — 10% JCT (consumption tax) standard / 8% on food. Invoice-based e-receipts mandatory since 2023.',
      'Direct entry — foreign digital services register for JCT. Permanent establishment triggers ~30% Japanese corporate tax.',
      'Verticals — Allowed (licensed): crypto (FIEA — strictest globally), adult (age + censorship laws), public lotteries & pari-mutuel. Prohibited: online casino & sports betting (except pari-mutuel), cannabis.',
      'Data hosting — APPI (amended 2022). Cross-border requires adequacy or specific consent. Sectoral FSA guidance for financial services.',
    ],
    'Singapore': [
      'MoR — Yes, useful for the OVR (Overseas Vendor Registration) scheme.',
      'Taxes — 9% GST + 17% corporate tax (regional-HQ incentives available).',
      'Direct entry — foreign digital services register under OVR above thresholds. Direct retail / financial services typically need a Pte Ltd.',
      'Verticals — Allowed (licensed): crypto under PSA (DPT strictly regulated — public marketing banned), gambling via Singapore Pools / Turf Club only. Prohibited: private gambling operators, adult (blocked), cannabis.',
      'Data hosting — PDPA. Cross-border requires adequacy or consent. MAS TRM Guidelines apply for financial services.',
    ],
    'Thailand': [
      'MoR — Yes, common path for foreign sellers.',
      'Taxes — 7% VAT. Non-resident digital services subject since 2021 (foreign-vendor registration regime).',
      'Direct entry — foreign digital services register with the Revenue Department above thresholds. Local representative required for foreign data controllers under PDPA.',
      'Verticals — Allowed (licensed): crypto under SEC Thailand, state lottery + horse racing. Prohibited (criminal): private gambling, adult (blocked), pharma online sale, cannabis (recently re-restricted).',
      'Data hosting — PDPA (full enforcement 2022, GDPR-aligned). Local representative required for foreign controllers. Cross-border via adequacy or consent.',
    ],
    'Vietnam': [
      'MoR — Yes, useful given FCT complexity.',
      'Taxes — 10% VAT + 5% digital service tax on foreign non-resident providers (since 2022).',
      'Direct entry — foreign digital services subject to FCT (Foreign Contractor Tax). PE rules trigger full Vietnamese corporate tax (20%).',
      'Verticals — Allowed (restricted): pharma online (MoH-permitted only). Prohibited (criminal): gambling, adult (Decree 72 blocks), crypto as payment (legal-grey for investing), cannabis.',
      'Data hosting — Cybersecurity Law (2018) + PDP Decree (2023). Localisation on Vietnam servers required for certain categories. Cross-border requires impact assessment.',
    ],
    'Philippines': [
      'MoR — Yes, useful for foreign sellers.',
      'Taxes — 12% VAT (extended to foreign digital providers since 2024). Corporate tax 25%.',
      'Direct entry — foreign digital service providers register for VAT (effective 2024). Direct retail / financial services typically need a domestic corporation.',
      'Verticals — Allowed (licensed): gambling under PAGCOR (domestic eGames), crypto (BSP VASP framework). Prohibited: adult, POGO offshore operations (banned 2024), cannabis.',
      'Data hosting — Data Privacy Act 2012. Cross-border with consent or contract. NPC enforces.',
    ],
    'Australia': [
      'MoR — Yes, common below the local-entity threshold.',
      'Taxes — 10% GST (including low-value imported goods). Digital products & services from overseas in scope.',
      'Direct entry — foreign digital sellers register for GST under the "netflix-tax" regime. PE rules trigger Australian corporate tax (25–30%).',
      'Verticals — Allowed (licensed): sports & race wagering (IGA), crypto (ASIC + AUSTRAC), adult (federal age-verification trial 2025), pharma online (TGA). Prohibited: online casino, cannabis (medical-only).',
      'Data hosting — Privacy Act 1988 + Consumer Data Right. APP 8 governs cross-border disclosure with accountability. OAIC enforces.',
    ],
    'South Africa': [
      'MoR — Yes, common for foreign sellers above the ZAR 1M VAT threshold.',
      'Taxes — 15% VAT (foreign digital services in scope since 2014) + 27% corporate tax on PE.',
      'Direct entry — foreign digital providers register for VAT above ZAR 1M. PE rules trigger SA corporate tax.',
      'Verticals — Allowed (licensed): sports betting (provincial), crypto under FSCA (VASP licensing since 2023), adult, cannabis (medical, private use). Prohibited: online casino at national level.',
      'Data hosting — POPIA (since 2021, GDPR-aligned). Cross-border requires adequacy, consent or contractual safeguards.',
    ],
    'Nigeria': [
      'MoR — Yes, common path for foreign sellers.',
      'Taxes — 7.5% VAT on foreign digital services + 30% corporate tax (large) / 20% (medium).',
      'Direct entry — foreign digital service providers register for VAT (effective 2022). PE rules trigger Nigerian corporate tax.',
      'Verticals — Allowed (licensed): gambling via NLRC + state authorities, crypto (VASP framework, partially reopened 2023). Prohibited: adult, cannabis.',
      'Data hosting — NDPR (GDPR-aligned) enforced by NDPC. CBN guidelines add sectoral localisation for financial data.',
    ],
    'Kenya': [
      'MoR — Yes, handy given DST + VAT stack.',
      'Taxes — 16% VAT + 1.5% Digital Service Tax on foreign providers + 30% corporate tax.',
      'Direct entry — foreign digital providers register for DST + VAT. PE rules trigger Kenyan corporate tax.',
      'Verticals — Allowed (licensed): gambling under BCLB, adult. Restricted: crypto (not legal tender — VASP framework in development). Prohibited: cannabis.',
      'Data hosting — Data Protection Act 2019 (GDPR-aligned). Cross-border with adequacy or contractual safeguards. ODPC enforces.',
    ],
    'Egypt': [
      'MoR — Limited. PSPs typically prefer a local Egyptian LLC or branch. The simplified VAT regime is the lighter path than securing MoR.',
      'Taxes — 14% VAT on foreign digital services + 22.5% corporate tax.',
      'Direct entry — foreign digital sellers register via the simplified VAT regime. Direct retail / financial services typically need a domestic LLC or branch.',
      'Verticals — Allowed: limited high-risk activity. Prohibited: gambling, crypto as payment (CBE directive), adult, cannabis.',
      'Data hosting — Data Protection Law 151/2020 (GDPR-aligned). Cross-border with adequacy or licence from the Data Protection Centre.',
    ],
    'Saudi Arabia': [
      'MoR — Limited. PSPs typically require at minimum a KSA or UAE entity for GCC operations. Direct ZATCA VAT registration is often the more practical path.',
      'Taxes — 15% VAT + 20% corporate tax for foreign investors (or Zakat 2.5% for GCC-owned).',
      'Direct entry — register with ZATCA for VAT. Direct retail / financial services need a subsidiary or branch under a MISA license. Common GCC HQ jurisdiction.',
      'Verticals — limited. Prohibited: gambling, alcohol, adult. Crypto unregulated — SAMA cautious on merchant settlement.',
      'Data hosting — PDPL (fully enforceable Sep 2024). Sensitive-data localisation. SAMA cloud computing rules layered on top for financial services.',
    ],
    'Qatar': [
      'MoR — Limited. PSPs typically require a regional GCC entity (KSA/UAE) at minimum, or a local QFC vehicle. Standalone foreign-seller MoR is rare.',
      'Taxes — no VAT yet (legislated since 2018, not implemented). 10% corporate tax on foreign-source income. Excise 50–100% on tobacco / sugary drinks.',
      'Direct entry — typically need a QFC (free-zone) vehicle or a mainland Commercial Registration. QFC offers a common-law alternative.',
      'Verticals — Allowed (licensed): pharma online via MoPH-licensed pharmacies. Prohibited: gambling, alcohol-online, adult, crypto (unregulated), cannabis.',
      'Data hosting — Law No. 13 of 2016 + Qatar National Cyber Security Strategy. Sensitive financial data subject to sectoral localisation.',
    ],
    'Bahrain': [
      'MoR — Limited. PSPs typically require a regional GCC entity (KSA/UAE) at minimum. Bahrain CR is the lightest local-entity option.',
      'Taxes — 10% VAT (raised from 5% in 2022). Foreign digital providers register via simplified online regime. No personal income tax.',
      'Direct entry — Commercial Registration (CR) or a free-zone vehicle. Bahrain is one of the most foreign-investor-friendly GCC jurisdictions for direct entry.',
      'Verticals — Allowed (licensed): crypto under CBB Digital Assets framework (2019 — Rain, CoinMENA registered), alcohol via licensed channels. Prohibited: gambling, adult, cannabis.',
      'Data hosting — PDPL (2018, GDPR-aligned) enforced by the Personal Data Protection Authority.',
    ],
    'Israel': [
      'MoR — Limited. Most foreign sellers register directly under Sec 33A; standalone MoR uncommon in this market.',
      'Taxes — 17% VAT. Foreign digital providers register under Sec 33A of the VAT Law.',
      'Direct entry — Sec 33A registration is enough for VAT. PE rules trigger Israeli corporate tax (23%).',
      'Verticals — Allowed (licensed): crypto under ISA (exchange licensing), adult, state gambling (Mifal Hapayis, Toto), prescription pharma. Prohibited: private gambling operators, cannabis (medical only).',
      'Data hosting — Privacy Protection Law (1981, regulations 2017). Cross-border with adequacy or consent. PPA enforces.',
    ],
    'Kuwait': [
      'MoR — Limited. PSPs typically require a regional GCC entity (KSA/UAE) or a local Kuwaiti vehicle.',
      'Taxes — no VAT yet (politically delayed since 2018 GCC agreement). 15% corporate tax applies only to foreign businesses. No personal income tax.',
      'Direct entry — typically need a 100%-foreign-owned vehicle via KDIPA or a 51% Kuwaiti-owned WLL / LLC.',
      'Verticals — Allowed: none of the typical high-risk verticals. Prohibited: gambling (Islamic finance), alcohol, adult, crypto (unregulated), cannabis.',
      'Data hosting — Law No. 20 of 2014 (IT-focused). A comprehensive GDPR-aligned PDPL is in draft.',
    ],
    'Oman': [
      'MoR — Limited. PSPs typically require a regional GCC entity (KSA/UAE) or a local Omani LLC. CBO-licensed PSP partners may enable the model in some cases.',
      'Taxes — 5% VAT (introduced 2021) + excise on tobacco / sugary drinks. No personal income tax.',
      'Direct entry — Duqm Free Zone (tax breaks, 100% foreign ownership) or a mainland LLC.',
      'Verticals — Allowed (licensed): pharma online via MoH-licensed pharmacies. Prohibited: gambling, alcohol-online, adult, crypto (unregulated), cannabis.',
      'Data hosting — PDPL under Royal Decree 6/2022 (GDPR-aligned). Cross-border with adequacy or consent.',
    ],
    'Jordan': [
      'MoR — Limited. PSPs typically want a Jordanian branch/LLC or a regional MENA presence (KSA/UAE).',
      'Taxes — 16% GST (VAT) + 14% corporate tax for non-financial sectors.',
      'Direct entry — a branch or LLC; foreign digital service providers register for the 16% GST.',
      'Verticals — Allowed (licensed): pharma online via JFDA-licensed pharmacies. Prohibited or restricted: gambling, adult, crypto (unregulated), cannabis.',
      'Data hosting — Data Protection Law (2023, GDPR-aligned, implementation ongoing).',
    ],
    'Turkey': [
      'MoR — Limited. PSPs typically want a Turkish entity or a regional MENA presence given FX controls and inflation rules.',
      'Taxes — 20% VAT (KDV) + 25% corporate tax. High inflation drives taksit (installment) checkout behaviour.',
      'Direct entry — foreign digital service providers register for KDV. PE rules trigger Turkish corporate tax. Rep office is common before a full subsidiary.',
      'Verticals — Allowed (state-only): gambling via state monopoly (İddaa, Milli Piyango), crypto for investing. Prohibited: crypto as payment (since 2021). Restricted: adult (BTK blocks), pharma online (state pharmacy monopoly), cannabis.',
      'Data hosting — KVKK (Law 6698, predates GDPR). Cross-border transfers require Data Protection Authority approval absent adequacy.',
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
      gap: 14,
      flexShrink: 0,
    },
    topStrip: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
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
      fontSize: 11,
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
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '19px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      minHeight: 0,
      // Stretch each row to fill its share of vertical space so the slide has
      // no big empty middle. Cards in the same row stay equal height (grid
      // default). Content inside each card distributes via space-around.
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
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: '17px',
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
      // Fill the card height so bullets distribute through the available
      // space instead of clumping at the top with empty space below.
      flex: '1 1 0',
      justifyContent: 'space-around',
    },
    listItem: {
      fontSize: '13.5px',
      lineHeight: 1.4,
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
      fontSize: '17px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.2,
      wordBreak: 'break-word',
    },
    apmType: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
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
      fontSize: '12.5px',
      lineHeight: 1.4,
      color: theme.inkSecondary,
      margin: 0,
    },
    partnersTable: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      marginTop: '2px',
      // Fill the remaining card height so partner rows distribute evenly;
      // overflow: visible on the card prevents clipping.
      flex: '1 1 0',
      justifyContent: 'space-around',
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
      fontSize: '13.5px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.2,
      wordBreak: 'break-word',
    },
    partnerNote: {
      fontFamily: 'var(--font)',
      fontSize: '12px',
      fontWeight: 500,
      color: theme.inkSecondary,
      lineHeight: 1.3,
      // Cap each note to a single line with ellipsis so a long
      // market-relevance string can't grow the row and push the 5th
      // provider off the card.
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
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
                <span style={{ ...styles.overviewValue, marginTop: 'auto', marginBottom: 'auto' }}>{localPayments.scheme}</span>
              </div>
            )}
            {localPayments.a2a && (
              <div style={{ ...styles.overviewCard, ...styles.paymentsCard }}>
                <span style={styles.overviewLabel}>A2A</span>
                <span style={{ ...styles.overviewValue, marginTop: 'auto', marginBottom: 'auto' }}>{localPayments.a2a}</span>
              </div>
            )}
            {filteredApms.length > 0 && (
              <div style={{ ...styles.overviewCard, ...styles.paymentsCard, ...styles.localCombined, ...styles.apmsWide }}>
                <span style={styles.overviewLabel}>Relevant APMs</span>
                <div style={{ ...styles.apmsRow, marginTop: 'auto', marginBottom: 'auto' }}>
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
            <span style={styles.cardHeader}>🚀 Digital Trends</span>
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
            <span style={styles.cardHeader}>💳 Payment Mix E-commerce</span>
            {breakdown.length > 0
              ? <PaymentBreakdown items={breakdown} theme={theme} />
              : <p style={{ color: theme.inkMuted, margin: 0 }}>Breakdown not published for this market.</p>}
          </div>
        </div>

        {(regulation.length > 0 || partners.length > 0) && (
          <div style={styles.grid}>
            {regulation.length > 0 && (
              <div style={styles.card}>
                <span style={styles.cardHeader}>⚖️ Regulation</span>
                <ul style={styles.list}>
                  {regulation.slice(0, 5).map((line, i) => (
                    <li key={i} style={styles.listItem}>
                      <span style={styles.listBullet} aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={styles.card}>
              <span style={styles.cardHeader}>🤝 Providers</span>
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

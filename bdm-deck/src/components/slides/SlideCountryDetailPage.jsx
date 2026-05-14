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
        gap: '14px',
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
              gap: '18px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: '17px',
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
                    fontSize: '12px',
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
                height: '30px',
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
                  fontSize: '14px',
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
                fontSize: '14px',
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
  ].join('|'), 'i')
  const digitalTrends = rawDigitalTrends.filter((t) => {
    const txt = typeof t === 'string' ? t : (t?.text || t?.title || '')
    return !TRENDS_EXCLUDE.test(txt)
  })

  // Regulation — keep everything that matters to a merchant landing in
  // this market and boost the topics that determine *how* they plug in:
  // Merchant of Record availability, licensing, settlement, tax, data
  // residency, tokenisation, cross-border + the regulated / high-risk
  // industries (gambling, crypto, adult, pharma, firearms, alcohol).
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
    'minor|age[\\s-]?verification',
  ].join('|'), 'i')
  // Sort merchant-operating lines to the top; keep everything (no exclude).
  const regulation = [...rawRegulation].sort((a, b) => {
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
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '26px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '28px',
      minHeight: 0,
    },
    card: {
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.025)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '14px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minWidth: 0,
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: '26px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.accent,
    },
    cardTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '26px',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
    },
    list: {
      listStyle: 'none', padding: 0, margin: 0,
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    listItem: {
      fontSize: '18px',
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
      gap: '16px',
    },
    localCell: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    localLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    localValue: {
      fontFamily: 'var(--font-display)',
      fontSize: '22px',
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
      fontSize: '14px',
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
      gap: '12px',
      marginTop: '4px',
    },
    apmCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.06)' : 'rgba(62,79,224,0.10)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    apmName: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
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
      fontSize: '28px',
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
            <span style={styles.cardHeader}>Payment Mix</span>
            {breakdown.length > 0
              ? <PaymentBreakdown items={breakdown} theme={theme} />
              : <p style={{ color: theme.inkMuted, margin: 0 }}>Breakdown not published for this market.</p>}
          </div>
        </div>

        {regulation.length > 0 && (
          <div style={styles.card}>
            <span style={styles.cardHeader}>Regulation</span>
            <ul style={styles.list}>
              {regulation.slice(0, 6).map((line, i) => (
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

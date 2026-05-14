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
        gap: 'clamp(8px, 0.7vw, 14px)',
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
              gap: 'clamp(10px, 0.9vw, 18px)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: 'clamp(13px, 1.05vw, 17px)',
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
                    fontSize: 'clamp(10px, 0.78vw, 12px)',
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
                height: 'clamp(22px, 1.8vw, 30px)',
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
                  fontSize: 'clamp(11px, 0.9vw, 14px)',
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
                fontSize: 'clamp(11px, 0.9vw, 14px)',
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

  // Filter Digital Trends to keep CNP / consumer-ecommerce focus — drop
  // B2B-only points so the slide aligns with merchants doing card-not-
  // present / cross-border sales into the country.
  const B2B_EXCLUDE = /(\bb2b\b|business[\s-]*to[\s-]*business|nearshoring|supply\s*chain|wholesale|invoice\s+finance)/i
  const digitalTrends = rawDigitalTrends.filter((t) => {
    const txt = typeof t === 'string' ? t : (t?.text || t?.title || '')
    return !B2B_EXCLUDE.test(txt)
  })

  // Sort regulation so the lines most relevant to a merchant landing in
  // this market (Merchant of Record, Payment Aggregator licensing, settle-
  // ment / VAT / data residency) bubble to the top of the 4-item display.
  const MERCHANT_BOOST = /(merchant\s+of\s+record|\bmor\b|payment\s+aggregator|psp\s+license|settlement|withhold|\bvat\b|\bgst\b|cross[\s-]?border|data\s+(local|residency|storage))/i
  const regulation = [...rawRegulation].sort((a, b) => {
    const am = MERCHANT_BOOST.test(a) ? 0 : 1
    const bm = MERCHANT_BOOST.test(b) ? 0 : 1
    return am - bm
  })

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(16px, 1.4vw, 28px)',
      minHeight: 0,
      overflowY: 'auto',
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(20px, 1.8vw, 36px)',
      flexShrink: 0,
    },
    flag: {
      width: 'clamp(72px, 6vw, 108px)',
      height: 'auto',
      borderRadius: '10px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      objectFit: 'cover',
      flexShrink: 0,
    },
    name: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(36px, 3.4vw, 64px)',
      fontWeight: 700,
      letterSpacing: '-1.2px',
      lineHeight: 1.05,
      color: theme.ink,
      margin: 0,
    },
    overviewStrip: {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.min(overviewEntries.length, 4))}, minmax(0, 1fr))`,
      gap: 'clamp(10px, 0.9vw, 16px)',
    },
    topStrip: {
      // Flex wrap instead of fixed-column grid so each card sizes to its
      // own content. Long values widen the card itself; the row simply
      // wraps to a second line when there's no horizontal room left.
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'clamp(10px, 0.9vw, 16px)',
    },
    // Highlight variant for the local payments row — slightly tinted blue
    // surface so it reads as a different section from the overview metrics.
    paymentsCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
    },
    apmsWide: {
      // Relevant APMs holds 3 inner columns so it carries proportionally
      // more weight than the single-stat cards next to it on the same row.
      flex: '3 1 auto',
    },
    apmsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 'clamp(10px, 0.8vw, 16px)',
    },
    localCombined: {
      gap: '10px',
    },
    localCombinedRows: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(8px, 0.6vw, 12px)',
    },
    localCombinedRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    localCombinedSub: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(9px, 0.7vw, 11px)',
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      whiteSpace: 'nowrap',
    },
    overviewCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.10)' : 'rgba(124,137,239,0.16)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '12px',
      padding: 'clamp(12px, 1vw, 18px) clamp(14px, 1.2vw, 22px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      // Stretch to fill the row — cards distribute evenly horizontally
      // while still wrapping to a second line when they collectively need
      // more space than the row offers.
      flex: '1 1 auto',
    },
    overviewLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(10px, 0.78vw, 12px)',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(18px, 1.5vw, 26px)',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'clamp(16px, 1.4vw, 28px)',
      minHeight: 0,
    },
    card: {
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.025)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '14px',
      padding: 'clamp(18px, 1.6vw, 30px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(10px, 0.9vw, 16px)',
      minWidth: 0,
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(18px, 1.5vw, 26px)',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.accent,
    },
    cardTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(18px, 1.5vw, 26px)',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
    },
    list: {
      listStyle: 'none', padding: 0, margin: 0,
      display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 12px)',
    },
    listItem: {
      fontSize: 'clamp(13px, 1.05vw, 18px)',
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
      gap: 'clamp(10px, 0.9vw, 16px)',
    },
    localCell: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    localLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(10px, 0.8vw, 12px)',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    localValue: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(16px, 1.3vw, 22px)',
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
      fontSize: 'clamp(11px, 0.95vw, 14px)',
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
      gap: 'clamp(8px, 0.7vw, 12px)',
      marginTop: '4px',
    },
    apmCard: {
      background: theme.isLight ? 'rgba(62,79,224,0.06)' : 'rgba(62,79,224,0.10)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '10px',
      padding: 'clamp(8px, 0.7vw, 14px) clamp(10px, 0.9vw, 16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    apmName: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(14px, 1.15vw, 20px)',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.2px',
      lineHeight: 1.2,
      wordBreak: 'break-word',
    },
    apmType: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(10px, 0.78vw, 12px)',
      fontWeight: 600,
      letterSpacing: '0.6px',
      color: theme.inkMuted,
    },
    empty: {
      flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font)',
      fontSize: 'clamp(18px, 1.5vw, 28px)',
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

import { useEffect, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

// Portal-aligned country → ISO-2 lookup. Used to pull the flag from
// flagcdn.com so we get a real PNG flag, not a Unicode emoji.
const COUNTRY_ISO = {
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

function PieChart({ items, theme }) {
  const valid = (items || [])
    .map((it) => ({ name: it.name, share: Number(it.share) || 0, detail: it.detail }))
    .filter((it) => it.share > 0)
  const total = valid.reduce((sum, it) => sum + it.share, 0)
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 6

  let angle = -Math.PI / 2 // start at top
  const slices = valid.map((it, i) => {
    const slice = (it.share / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += slice
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = slice > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return { d, color: PIE_COLORS[i % PIE_COLORS.length], name: it.name, share: it.share, detail: it.detail }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 2vw, 36px)', flex: 1, minHeight: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke={theme.isLight ? '#ffffff' : '#0B0E16'} strokeWidth="1.5">
            <title>{s.name}: {s.share}%</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={r * 0.45} fill={theme.isLight ? '#ffffff' : '#0B0E16'} />
      </svg>
      <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)', minWidth: 0 }}>
        {slices.map((s, i) => (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '10px 1fr auto',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'var(--font)',
              fontSize: 'clamp(13px, 1.05vw, 18px)',
              color: theme.inkSecondary,
            }}
          >
            <span
              aria-hidden
              style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </span>
            <span style={{ fontWeight: 700, color: theme.inkStrong }}>{s.share}%</span>
          </li>
        ))}
      </ul>
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
  const breakdown = rich?.payment_methods_breakdown || []
  const regulation = rich?.regulation || []
  const digitalTrends = rich?.digital_trends || rich?.digitalTrends || []

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
    overviewCard: {
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.03)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '12px',
      padding: 'clamp(12px, 1vw, 18px) clamp(14px, 1.2vw, 22px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: 0,
    },
    overviewLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(10px, 0.78vw, 12px)',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    overviewValue: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(18px, 1.5vw, 26px)',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
      fontSize: 'clamp(10px, 0.85vw, 13px)',
      fontWeight: 700,
      letterSpacing: '1.6px',
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
              src={`https://flagcdn.com/w240/${iso}.png`}
              alt={`${selectedCountry} flag`}
              style={styles.flag}
            />
          )}
          <h2 style={styles.name}>{selectedCountry}</h2>
        </div>

        {overviewEntries.length > 0 && (
          <div style={styles.overviewStrip}>
            {overviewEntries.slice(0, 8).map(([label, value]) => (
              <div key={label} style={styles.overviewCard}>
                <span style={styles.overviewLabel}>{label}</span>
                <span style={styles.overviewValue}>{value}</span>
              </div>
            ))}
          </div>
        )}

        <div style={styles.grid}>
          <div style={styles.card}>
            <span style={styles.cardHeader}>Digital Trends</span>
            <span style={styles.cardTitle}>Market signals</span>
            <ul style={styles.list}>
              {digitalTrends.slice(0, 6).map((t, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={styles.listBullet} aria-hidden />
                  {typeof t === 'string' ? t : (t?.text || t?.title || '')}
                </li>
              ))}
            </ul>
          </div>

          <div style={styles.card}>
            <span style={styles.cardHeader}>Local Payments</span>
            <span style={styles.cardTitle}>Scheme, A2A, APMs</span>
            <div style={styles.localGrid}>
              {localPayments.scheme && (
                <div style={styles.localCell}>
                  <span style={styles.localLabel}>Local scheme</span>
                  <span style={styles.localValue}>{localPayments.scheme}</span>
                </div>
              )}
              {localPayments.a2a && (
                <div style={styles.localCell}>
                  <span style={styles.localLabel}>A2A rail</span>
                  <span style={styles.localValue}>{localPayments.a2a}</span>
                </div>
              )}
            </div>
            {Array.isArray(localPayments.apms) && localPayments.apms.length > 0 && (
              <>
                <span style={styles.localLabel}>Most important APMs</span>
                <div style={styles.chipRow}>
                  {localPayments.apms.slice(0, 8).map((a, i) => (
                    <span key={i} style={styles.chip}>
                      {typeof a === 'string' ? a : (a?.name || '')}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <span style={styles.cardHeader}>Regulation</span>
            <span style={styles.cardTitle}>Compliance trends</span>
            <ul style={styles.list}>
              {regulation.slice(0, 5).map((line, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={styles.listBullet} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div style={styles.card}>
            <span style={styles.cardHeader}>Payment Mix</span>
            <span style={styles.cardTitle}>Distribution of payments</span>
            {breakdown.length > 0
              ? <PieChart items={breakdown} theme={theme} />
              : <p style={{ color: theme.inkMuted, margin: 0 }}>Breakdown not published for this market.</p>}
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

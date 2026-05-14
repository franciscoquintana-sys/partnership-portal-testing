import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import {
  REGION_LABEL,
  REGION_META,
  COUNTRY_TIER,
  COUNTRY_FLAG,
  getRegionCountries,
  getRegionTierGroups,
} from '../../data/regional-data'
import { getCountryCoords } from '../../data/country-coords'

const TIER_COLOR = {
  1: { dot: '#4ADE80', bar: '#4ADE80', label: '#86EFAC', soft: 'rgba(74,222,128,0.14)', border: 'rgba(74,222,128,0.35)' },
  2: { dot: '#F59E0B', bar: '#F59E0B', label: '#FBBF24', soft: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)' },
  3: { dot: '#FCD34D', bar: '#FCD34D', label: '#FDE68A', soft: 'rgba(252,211,77,0.12)', border: 'rgba(252,211,77,0.32)' },
  'high-risk': { dot: '#A1A1AA', bar: '#A1A1AA', label: '#D4D4D8', soft: 'rgba(161,161,170,0.12)', border: 'rgba(161,161,170,0.3)' },
}

const TIER_ORDER = [1, 2, 3, 'high-risk']

export default function SlideRegionTierMap({ region }) {
  const theme = useTheme()
  const meta = REGION_META[region]
  const countries = getRegionCountries(region)
  const groups = getRegionTierGroups(region)

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(14px, 1.4vw, 24px)',
      minHeight: 0,
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '42px',
      fontWeight: 500,
      letterSpacing: '-0.8px',
      lineHeight: 1.15,
      color: theme.accentPale,
      margin: 0,
      maxWidth: '80%',
    },
    grid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.85fr 1.4fr',
      gap: 'clamp(18px, 1.6vw, 32px)',
      minHeight: 0,
    },
    // ---- Left column ----
    leftCol: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(14px, 1.2vw, 22px)',
      minHeight: 0,
    },
    statsCard: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(10px, 0.9vw, 16px)',
      padding: 'clamp(16px, 1.4vw, 26px)',
      background: 'rgba(124,137,239,0.08)',
      border: '1px solid rgba(124,137,239,0.22)',
      borderRadius: '14px',
    },
    statsHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    },
    statsBadge: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.accentPale,
    },
    statsGlobe: {
      fontSize: '24px',
      color: theme.accentPale,
    },
    statsRow: {
      display: 'flex',
      gap: 'clamp(18px, 1.6vw, 32px)',
    },
    statItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    statNumber: {
      fontFamily: 'var(--font-display)',
      fontSize: '52px',
      fontWeight: 700,
      letterSpacing: '-1px',
      lineHeight: 1.05,
      background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentPale} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    statLabel: {
      fontSize: '15px',
      fontWeight: 500,
      color: theme.inkSecondary,
      letterSpacing: '0.2px',
    },
    mapBox: {
      flex: 1,
      position: 'relative',
      minHeight: 0,
      borderRadius: '14px',
      overflow: 'hidden',
      border: `1px solid ${theme.borderSubtle}`,
      background: 'rgba(255,255,255,0.02)',
    },
    mapInner: {
      position: 'absolute',
      inset: 0,
      color: 'rgba(255,255,255,0.32)',
    },
    mapImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      pointerEvents: 'none',
      opacity: 0.55,
    },
    tierDot: {
      position: 'absolute',
      width: '14px',
      height: '14px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      border: '2px solid rgba(0,0,0,0.32)',
      pointerEvents: 'none',
      boxShadow: '0 0 12px rgba(0,0,0,0.4)',
    },
    // ---- Middle column: country list ----
    countryColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minHeight: 0,
      overflowY: 'auto',
    },
    countryHeader: {
      fontFamily: 'var(--font)',
      fontSize: '16px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      marginBottom: '8px',
    },
    countryRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '6px 0',
    },
    tierBar: {
      width: '4px',
      height: '24px',
      borderRadius: '2px',
      flexShrink: 0,
    },
    countryFlag: {
      fontSize: '22px',
      lineHeight: 1,
      flexShrink: 0,
    },
    countryIndex: {
      fontFamily: 'var(--font-mono)',
      fontSize: '15px',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: theme.inkMuted,
      minWidth: '24px',
    },
    countryName: {
      fontFamily: 'var(--font)',
      fontSize: '18px',
      fontWeight: 600,
      color: theme.ink,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    // ---- Right column: tier cards ----
    tierColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(10px, 0.9vw, 16px)',
      minHeight: 0,
      overflowY: 'auto',
    },
    tierCard: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(6px, 0.5vw, 10px)',
      padding: 'clamp(12px, 1vw, 18px) clamp(14px, 1.2vw, 22px)',
      borderRadius: '12px',
      border: '1px solid',
      flexShrink: 0,
    },
    tierLabel: {
      fontFamily: 'var(--font-display)',
      fontSize: '18px',
      fontWeight: 700,
      letterSpacing: '0.6px',
      textTransform: 'uppercase',
    },
    tierBlurb: {
      fontSize: '15px',
      lineHeight: 1.5,
      color: theme.inkSecondary,
    },
    tierBullets: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginTop: '4px',
    },
    tierBullet: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      fontSize: '15px',
      lineHeight: 1.5,
      color: theme.ink,
    },
    tierBulletDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      marginTop: '7px',
      flexShrink: 0,
    },
  }

  if (!meta) return null

  return (
    <SlideBase section="Regional Market">
      <div className="reveal" style={{ ...styles.body, '--reveal-delay': '0.05s' }}>
        <h2 style={styles.title}>{meta.intro}</h2>

        <div style={styles.grid}>
          {/* Left: stats + map */}
          <div style={styles.leftCol}>
            <div style={styles.statsCard}>
              <div style={styles.statsHeader}>
                <span style={styles.statsBadge}>{region}</span>
                <span style={styles.statsGlobe} aria-hidden>🌐</span>
              </div>
              <div style={styles.statsRow}>
                <div style={styles.statItem}>
                  <span style={styles.statNumber}>{meta.population}</span>
                  <span style={styles.statLabel}>Population</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statNumber}>~{countries.length}</span>
                  <span style={styles.statLabel}>Number of countries</span>
                </div>
              </div>
            </div>

            <div style={styles.mapBox}>
              <div style={styles.mapInner}>
                <img src="/sales-deck/world-map.svg" alt="" style={styles.mapImage} />
                {countries.map((c) => {
                  const coord = getCountryCoords(c.country)
                  if (!coord) return null
                  const tier = COUNTRY_TIER[c.country] ?? 3
                  const color = TIER_COLOR[tier]
                  return (
                    <div
                      key={c.country}
                      style={{
                        ...styles.tierDot,
                        left: `${coord.x}%`,
                        top: `${coord.y}%`,
                        background: color.dot,
                      }}
                      aria-label={`${c.country} (tier ${tier})`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Middle: numbered country list */}
          <div className="stagger" style={{ ...styles.countryColumn, '--stagger-base': '0.2s', '--stagger-step': '0.03s' }}>
            <div style={styles.countryHeader}>Country</div>
            {countries.map((c, i) => {
              const tier = COUNTRY_TIER[c.country] ?? 3
              const color = TIER_COLOR[tier]
              return (
                <div key={c.country} style={styles.countryRow}>
                  <span style={{ ...styles.tierBar, background: color.bar }} />
                  <span style={styles.countryFlag} aria-hidden>{COUNTRY_FLAG[c.country] || '🏳️'}</span>
                  <span style={styles.countryIndex}>{i + 1}.</span>
                  <span style={styles.countryName}>{c.country}</span>
                </div>
              )
            })}
          </div>

          {/* Right: tier cards */}
          <div className="stagger" style={{ ...styles.tierColumn, '--stagger-base': '0.35s', '--stagger-step': '0.1s' }}>
            {TIER_ORDER.map((tier) => {
              const copy = meta.tierCopy[tier]
              const color = TIER_COLOR[tier]
              const hasContent = (copy.bullets?.length || 0) > 0 || copy.blurb || (groups[tier]?.length || 0) > 0
              if (!hasContent) return null
              return (
                <div
                  key={tier}
                  style={{
                    ...styles.tierCard,
                    background: color.soft,
                    borderColor: color.border,
                  }}
                >
                  <span style={{ ...styles.tierLabel, color: color.label }}>{copy.label}</span>
                  {copy.blurb && <span style={styles.tierBlurb}>{copy.blurb}</span>}
                  {copy.bullets?.length > 0 && (
                    <div style={styles.tierBullets}>
                      {copy.bullets.map((b, i) => (
                        <div key={i} style={styles.tierBullet}>
                          <span style={{ ...styles.tierBulletDot, background: color.bar }} />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

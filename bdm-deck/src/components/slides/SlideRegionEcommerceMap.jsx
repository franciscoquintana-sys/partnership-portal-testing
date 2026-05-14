import { UsersThree, DeviceMobile, ShoppingCart, ChartBar } from '@phosphor-icons/react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import {
  REGION_LABEL,
  COUNTRY_FLAG,
  COUNTRY_TIER,
  getRegionCountries,
} from '../../data/regional-data'
import { getMetrics } from '../../data/country-rich-data'
import { getCountryCoords } from '../../data/country-coords'

const TIER_BAR_COLOR = {
  1: '#4ADE80',
  2: '#F59E0B',
  3: '#FCD34D',
  'high-risk': '#A1A1AA',
}

// Region-level e-commerce metrics slide. Renders the regional map with a
// callout card per T1 / T2 market showing population, smartphone +
// internet penetration, e-commerce market value, and CAGR. Matches the
// source-deck layout from the MENAT pptx.

export default function SlideRegionEcommerceMap({ region }) {
  const theme = useTheme()
  const allCountries = getRegionCountries(region)
  // T1 + T2 only — the source slide title is explicitly "T1 and T2".
  // T3 and high-risk markets are surfaced on the tier-overview slide.
  const focusCountries = allCountries
    .filter((c) => {
      const t = COUNTRY_TIER[c.country]
      return t === 1 || t === 2
    })
    // Stable ordering: T1 first, then T2; alphabetical inside each tier.
    .sort((a, b) => {
      const ta = COUNTRY_TIER[a.country] ?? 3
      const tb = COUNTRY_TIER[b.country] ?? 3
      if (ta !== tb) return ta - tb
      return a.country.localeCompare(b.country)
    })

  // Split into two columns for left / right of the map. Front-loaded
  // left so a 5-country region still feels balanced.
  const mid = Math.ceil(focusCountries.length / 2)
  const leftCountries = focusCountries.slice(0, mid)
  const rightCountries = focusCountries.slice(mid)

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(14px, 1.4vw, 22px)',
      minHeight: 0,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: '24px',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '42px',
      fontWeight: 500,
      letterSpacing: '-0.8px',
      lineHeight: 1.15,
      color: theme.accentPale,
      margin: 0,
      maxWidth: '72%',
    },
    legend: {
      display: 'flex',
      flexDirection: 'row',
      gap: 'clamp(14px, 1.2vw, 22px)',
      flexShrink: 0,
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: theme.inkSecondary,
      fontWeight: 500,
    },
    legendIcon: {
      color: theme.accentPale,
    },
    grid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr 1fr',
      gap: 'clamp(14px, 1.2vw, 22px)',
      minHeight: 0,
    },
    side: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(10px, 0.9vw, 14px)',
      minHeight: 0,
    },
    callout: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px 20px',
      background: 'rgba(124,137,239,0.06)',
      borderRadius: '12px',
      border: '1px solid rgba(124,137,239,0.18)',
      borderLeft: '4px solid',
      flexShrink: 0,
    },
    calloutHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    calloutName: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '0.4px',
      textTransform: 'uppercase',
      color: theme.accentPale,
      flex: 1,
    },
    calloutFlag: {
      fontSize: '26px',
      lineHeight: 1,
    },
    metricRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '17px',
      color: theme.ink,
      fontWeight: 500,
    },
    metricIcon: {
      color: theme.accentPale,
      flexShrink: 0,
    },
    metricValue: {
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.1px',
    },
    mapBox: {
      position: 'relative',
      minHeight: 0,
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${theme.borderSubtle}`,
      background: 'rgba(124,137,239,0.04)',
    },
    mapImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      pointerEvents: 'none',
      opacity: 0.5,
    },
    mapDot: {
      position: 'absolute',
      width: '12px',
      height: '12px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      border: '2px solid rgba(0,0,0,0.32)',
      boxShadow: '0 0 12px rgba(0,0,0,0.4)',
      pointerEvents: 'none',
    },
  }

  function MetricRow({ Icon, value, fallback = '—' }) {
    return (
      <div style={styles.metricRow}>
        <Icon size={18} weight="fill" style={styles.metricIcon} aria-hidden />
        <span style={styles.metricValue}>{value || fallback}</span>
      </div>
    )
  }

  function Callout({ country }) {
    const m = getMetrics(country)
    const tier = COUNTRY_TIER[country] ?? 3
    return (
      <div style={{ ...styles.callout, borderLeftColor: TIER_BAR_COLOR[tier] }}>
        <div style={styles.calloutHeader}>
          <span style={styles.calloutName}>{country}</span>
          <span style={styles.calloutFlag} aria-hidden>{COUNTRY_FLAG[country] || '🏳️'}</span>
        </div>
        <MetricRow Icon={UsersThree} value={m?.population} />
        <MetricRow Icon={DeviceMobile} value={m ? `SP: ${m.sp} | I: ${m.i}` : null} />
        <MetricRow Icon={ShoppingCart} value={m?.marketValue} />
        <MetricRow Icon={ChartBar} value={m?.cagr} />
      </div>
    )
  }

  return (
    <SlideBase section="T1 and T2 Countries">
      <div className="reveal" style={{ ...styles.body, '--reveal-delay': '0.05s' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            T1 and T2 markets within {REGION_LABEL[region]} have become global leaders in e-commerce
          </h2>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <UsersThree size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              Population
            </span>
            <span style={styles.legendItem}>
              <DeviceMobile size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              Smartphone &amp; Internet Penetration
            </span>
            <span style={styles.legendItem}>
              <ShoppingCart size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              E-Commerce Market Value
            </span>
            <span style={styles.legendItem}>
              <ChartBar size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              E-Commerce CAGR
            </span>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.side}>
            {leftCountries.map((c) => <Callout key={c.country} country={c.country} />)}
          </div>

          <div style={styles.mapBox}>
            <img src="/sales-deck/world-map.svg" alt="" style={styles.mapImage} />
            {focusCountries.map((c) => {
              const coord = getCountryCoords(c.country)
              if (!coord) return null
              const tier = COUNTRY_TIER[c.country] ?? 3
              return (
                <div
                  key={c.country}
                  style={{
                    ...styles.mapDot,
                    left: `${coord.x}%`,
                    top: `${coord.y}%`,
                    background: TIER_BAR_COLOR[tier],
                  }}
                  aria-label={c.country}
                />
              )
            })}
          </div>

          <div style={styles.side}>
            {rightCountries.map((c) => <Callout key={c.country} country={c.country} />)}
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

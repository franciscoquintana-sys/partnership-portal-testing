import { useMemo, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import {
  REGIONS,
  REGION_LABEL,
  REGIONAL_DATA,
  getCountryData,
} from '../../data/regional-data'

// Only surface regions that actually have rich country data in the deck.
const DETAIL_REGIONS = REGIONS.filter((r) => (REGIONAL_DATA[r] || []).length > 0)

// Country Detail slide — replicates the portal's per-country panel inside
// the deck. Two in-slide dropdowns (region, country) drive the rendered
// payload. Countries with rich data in REGIONAL_DATA show full coverage
// detail; countries listed only in the picker show a graceful stub.

export default function SlideCountryDetail() {
  const theme = useTheme()
  const [region, setRegion] = useState(DETAIL_REGIONS[0] || REGIONS[0])
  const countriesForRegion = useMemo(
    () => (REGIONAL_DATA[region] || [])
      .map((c) => c.country)
      .slice()
      .sort((a, b) => a.localeCompare(b)),
    [region],
  )
  const [country, setCountry] = useState(countriesForRegion[0] || '')

  // If region changes and the current country is no longer valid, snap to
  // the first country in the new region.
  const validCountry = countriesForRegion.includes(country) ? country : countriesForRegion[0] || ''
  if (validCountry !== country) {
    // Defer the update to avoid setting state during render.
    queueMicrotask(() => setCountry(validCountry))
  }

  const rich = getCountryData(region, validCountry)

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(24px, 2.4vw, 44px)',
      minHeight: 0,
    },
    headerRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(20px, 1.8vw, 32px)',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(40px, 3.8vw, 72px)',
      fontWeight: 500,
      letterSpacing: '-1.2px',
      lineHeight: 1.1,
      color: theme.ink,
      margin: 0,
    },
    titleAccent: {
      backgroundImage: theme.isLight
        ? `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accent} 100%)`
        : 'linear-gradient(135deg, #5967E4 0%, #BDC3F6 55%, #3E4FE0 100%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    },
    filters: {
      display: 'flex',
      gap: 'clamp(16px, 1.5vw, 28px)',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
    },
    filter: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    filterLabel: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(11px, 0.9vw, 14px)',
      fontWeight: 700,
      letterSpacing: '1.6px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    select: {
      fontFamily: 'var(--font)',
      fontSize: 'clamp(16px, 1.3vw, 22px)',
      fontWeight: 600,
      padding: 'clamp(10px, 0.9vw, 16px) clamp(14px, 1.2vw, 22px)',
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.05)',
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '12px',
      color: theme.ink,
      minWidth: 'clamp(220px, 18vw, 320px)',
      cursor: 'pointer',
      outline: 'none',
    },
    detail: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'clamp(20px, 1.8vw, 36px)',
      minHeight: 0,
    },
    card: {
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.025)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '16px',
      padding: 'clamp(24px, 2.2vw, 40px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(12px, 1.1vw, 20px)',
      overflow: 'hidden',
    },
    cardHeader: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(11px, 0.9vw, 14px)',
      fontWeight: 700,
      letterSpacing: '1.6px',
      textTransform: 'uppercase',
      color: theme.accent,
    },
    cardTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(22px, 1.9vw, 32px)',
      fontWeight: 700,
      color: theme.inkStrong,
      letterSpacing: '-0.3px',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(8px, 0.7vw, 14px)',
      padding: 0,
      margin: 0,
      listStyle: 'none',
    },
    listItem: {
      fontSize: 'clamp(15px, 1.2vw, 22px)',
      lineHeight: 1.45,
      color: theme.inkSecondary,
      paddingLeft: '18px',
      position: 'relative',
    },
    listBullet: {
      position: 'absolute',
      left: 0,
      top: '0.55em',
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: theme.accent,
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'clamp(8px, 0.7vw, 12px)',
    },
    chip: {
      fontFamily: 'var(--font)',
      fontSize: 'clamp(13px, 1.05vw, 18px)',
      fontWeight: 600,
      padding: 'clamp(7px, 0.6vw, 12px) clamp(12px, 1vw, 18px)',
      borderRadius: '999px',
      background: theme.isLight ? 'rgba(62,79,224,0.07)' : 'rgba(62,79,224,0.15)',
      border: `1px solid ${theme.borderAccent}`,
      color: theme.isLight ? theme.accentDeep : '#BDC3F6',
    },
    stub: {
      gridColumn: '1 / -1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 'clamp(40px, 4vw, 80px)',
      fontSize: 'clamp(18px, 1.5vw, 28px)',
      color: theme.inkMuted,
      lineHeight: 1.5,
      border: `1px dashed ${theme.borderDefault}`,
      borderRadius: '16px',
    },
  }

  const renderList = (items) => (
    <ul style={styles.list}>
      {items.slice(0, 5).map((line, i) => (
        <li key={i} style={styles.listItem}>
          <span style={styles.listBullet} aria-hidden />
          {line}
        </li>
      ))}
    </ul>
  )

  return (
    <SlideBase section="Country Detail" slideNumber={9}>
      <div className="slide-enter" style={styles.body}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>
            Inside <span style={styles.titleAccent}>{validCountry || 'each market'}</span>
          </h2>
          <div style={styles.filters}>
            <label style={styles.filter}>
              <span style={styles.filterLabel}>Region</span>
              <select
                style={styles.select}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {DETAIL_REGIONS.map((r) => (
                  <option key={r} value={r}>{REGION_LABEL[r] || r}</option>
                ))}
              </select>
            </label>
            <label style={styles.filter}>
              <span style={styles.filterLabel}>Country</span>
              <select
                style={styles.select}
                value={validCountry}
                onChange={(e) => setCountry(e.target.value)}
              >
                {countriesForRegion.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={styles.detail}>
          {rich ? (
            <>
              <div style={styles.card}>
                <span style={styles.cardHeader}>Payment Methods</span>
                <span style={styles.cardTitle}>Top consumer rails</span>
                {renderList(rich.paymentMethods || [])}
              </div>
              <div style={styles.card}>
                <span style={styles.cardHeader}>Digital Trends</span>
                <span style={styles.cardTitle}>Market signals</span>
                {renderList(rich.digitalTrends || [])}
              </div>
              <div style={styles.card}>
                <span style={styles.cardHeader}>Processors</span>
                <span style={styles.cardTitle}>Acquiring coverage</span>
                <div style={styles.chipRow}>
                  {(rich.processors || []).slice(0, 12).map((p) => (
                    <span key={p} style={styles.chip}>{p}</span>
                  ))}
                </div>
              </div>
              <div style={styles.card}>
                <span style={styles.cardHeader}>Methods Covered</span>
                <span style={styles.cardTitle}>Live on Yuno</span>
                <div style={styles.chipRow}>
                  {(rich.paymentMethodsCovered || rich.verticals || []).slice(0, 12).map((p) => (
                    <span key={p} style={styles.chip}>{p}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.stub}>
              Detailed coverage for <strong>{validCountry || 'this market'}</strong> isn&rsquo;t
              published in the deck yet — pick another country to see Yuno&rsquo;s rich market
              brief.
            </div>
          )}
        </div>
      </div>
    </SlideBase>
  )
}

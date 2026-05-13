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
  // Empty string = "no country selected" → render the world map overview
  // (mirrors the portal's Country Detail empty state).
  const [country, setCountry] = useState('')

  // If region changes and the picked country isn't in it anymore, clear
  // the selection so we fall back to the overview map.
  const validCountry = country && countriesForRegion.includes(country) ? country : ''
  if (validCountry !== country) {
    queueMicrotask(() => setCountry(validCountry))
  }

  const rich = validCountry ? getCountryData(region, validCountry) : null

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
    overview: {
      gridColumn: '1 / -1',
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(16px, 1.4vw, 28px)',
      padding: 'clamp(20px, 1.8vw, 36px)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '16px',
      overflow: 'hidden',
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.02)',
    },
    overviewMap: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      opacity: theme.isLight ? 0.18 : 0.22,
      filter: theme.isLight ? 'invert(1) brightness(0.4)' : 'brightness(0) invert(1)',
      pointerEvents: 'none',
    },
    overviewContent: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'clamp(14px, 1.2vw, 22px)',
      maxWidth: '80%',
      textAlign: 'center',
    },
    overviewLead: {
      fontSize: 'clamp(20px, 1.6vw, 32px)',
      fontWeight: 600,
      color: theme.inkSecondary,
      lineHeight: 1.4,
      margin: 0,
    },
    countryChipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'clamp(8px, 0.8vw, 14px)',
      justifyContent: 'center',
    },
    countryChip: {
      fontFamily: 'var(--font)',
      fontSize: 'clamp(13px, 1.1vw, 20px)',
      fontWeight: 600,
      padding: 'clamp(8px, 0.7vw, 14px) clamp(14px, 1.1vw, 20px)',
      borderRadius: '999px',
      background: theme.isLight ? 'rgba(62,79,224,0.07)' : 'rgba(62,79,224,0.15)',
      border: `1px solid ${theme.borderAccent}`,
      color: theme.isLight ? theme.accentDeep : '#BDC3F6',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, background 0.15s ease',
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
                <option value="">All countries</option>
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
            <div style={styles.overview}>
              <img
                src="/sales-deck/world-map.svg"
                alt=""
                style={styles.overviewMap}
                aria-hidden
              />
              <div style={styles.overviewContent}>
                <p style={styles.overviewLead}>
                  Coverage across <strong>{REGION_LABEL[region] || region}</strong> — pick a
                  country to see its market brief.
                </p>
                <div style={styles.countryChipRow}>
                  {countriesForRegion.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={styles.countryChip}
                      onClick={() => setCountry(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SlideBase>
  )
}

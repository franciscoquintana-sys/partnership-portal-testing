import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretDown, Globe, MapPin } from '@phosphor-icons/react'
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

// All rich-data countries flattened across the eligible regions — used when
// "All regions" is selected so the country pill spans the global set.
const ALL_COUNTRIES = DETAIL_REGIONS.flatMap((r) =>
  (REGIONAL_DATA[r] || []).map((c) => ({ country: c.country, region: r })),
).sort((a, b) => a.country.localeCompare(b.country))

export default function SlideCountryDetail() {
  const theme = useTheme()

  // No prefilter: 'all' regions, 'all' countries by default — mirrors the
  // portal's Country Detail empty state.
  const [region, setRegion] = useState('all')
  const [country, setCountry] = useState('')

  const [showRegionMenu, setShowRegionMenu] = useState(false)
  const [showCountryMenu, setShowCountryMenu] = useState(false)
  const regionRef = useRef(null)
  const countryRef = useRef(null)

  const countriesForPicker = useMemo(() => {
    if (region === 'all') return ALL_COUNTRIES
    return (REGIONAL_DATA[region] || [])
      .map((c) => ({ country: c.country, region }))
      .sort((a, b) => a.country.localeCompare(b.country))
  }, [region])

  // Re-validate the selected country when the region changes.
  useEffect(() => {
    if (country && !countriesForPicker.some((c) => c.country === country)) {
      setCountry('')
    }
  }, [region, country, countriesForPicker])

  // Outside-click close, matching the landing-page filter behaviour.
  useEffect(() => {
    if (!showRegionMenu && !showCountryMenu) return
    const onDown = (e) => {
      if (showRegionMenu && !regionRef.current?.contains(e.target)) setShowRegionMenu(false)
      if (showCountryMenu && !countryRef.current?.contains(e.target)) setShowCountryMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showRegionMenu, showCountryMenu])

  // Resolve the active country's rich data when a specific country is picked.
  const resolvedRegion = country
    ? (countriesForPicker.find((c) => c.country === country)?.region || region)
    : region
  const rich = country && resolvedRegion !== 'all'
    ? getCountryData(resolvedRegion, country)
    : null

  const regionPillLabel = region === 'all'
    ? 'All regions'
    : (REGION_LABEL[region] || region)
  const countryPillLabel = country || 'All countries'

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

    // ---------- Filter pills (same look + feel as the old landing page) -----
    filterRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(12px, 1.1vw, 22px)',
      flexWrap: 'wrap',
    },
    filterKicker: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(11px, 0.9vw, 14px)',
      fontWeight: 700,
      letterSpacing: '1.6px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      marginRight: '4px',
    },
    pillWrap: {
      position: 'relative',
    },
    pill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: 'clamp(10px, 0.9vw, 16px) clamp(16px, 1.3vw, 24px)',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '100px',
      color: 'rgba(255,255,255,0.92)',
      fontFamily: 'var(--font)',
      fontSize: 'clamp(13px, 1.05vw, 18px)',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      backdropFilter: 'blur(12px)',
    },
    pillOpen: {
      borderColor: 'rgba(62,79,224,0.55)',
      boxShadow: '0 0 0 4px rgba(62,79,224,0.10)',
    },
    pillIcon: {
      color: 'rgba(189,195,246,0.95)',
    },
    pillCaret: {
      opacity: 0.7,
      transition: 'transform 0.18s ease',
    },
    menu: {
      position: 'absolute',
      top: 'calc(100% + 10px)',
      left: 0,
      minWidth: '260px',
      maxHeight: 'min(60vh, 360px)',
      overflowY: 'auto',
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(28px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '8px',
      boxShadow: '0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset',
      zIndex: 11,
    },
    menuItem: {
      padding: '10px 14px',
      fontSize: '14px',
      fontWeight: 500,
      color: 'rgba(255,255,255,0.88)',
      borderRadius: '10px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      transition: 'background 0.12s ease',
    },
    menuItemActive: {
      background: 'rgba(62,79,224,0.16)',
      color: '#fff',
    },
    menuItemKey: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.4)',
    },

    // ---------- Detail / overview ------------------------------------------
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

  const regionItems = [{ key: 'all', label: 'All regions' }]
    .concat(DETAIL_REGIONS.map((r) => ({ key: r, label: REGION_LABEL[r] || r })))

  const countryItems = [{ country: '', region: null }].concat(countriesForPicker)

  const overviewTitle = region === 'all'
    ? 'Coverage across every region'
    : `Coverage across ${REGION_LABEL[region] || region}`

  return (
    <SlideBase section="Country Detail" slideNumber={9}>
      <div className="slide-enter" style={styles.body}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>
            Inside <span style={styles.titleAccent}>{country || 'each market'}</span>
          </h2>
          <div style={styles.filterRow}>
            <span style={styles.filterKicker}>Filter</span>

            <div ref={regionRef} style={styles.pillWrap}>
              <button
                type="button"
                style={{ ...styles.pill, ...(showRegionMenu ? styles.pillOpen : {}) }}
                onClick={() => setShowRegionMenu((v) => !v)}
              >
                <Globe size={16} weight="regular" style={styles.pillIcon} aria-hidden />
                <span>{regionPillLabel}</span>
                <CaretDown
                  size={12}
                  weight="bold"
                  style={{
                    ...styles.pillCaret,
                    transform: showRegionMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                  aria-hidden
                />
              </button>
              {showRegionMenu && (
                <div role="listbox" style={styles.menu}>
                  {regionItems.map((opt) => {
                    const active = region === opt.key
                    return (
                      <div
                        key={opt.key}
                        role="option"
                        aria-selected={active}
                        style={{ ...styles.menuItem, ...(active ? styles.menuItemActive : {}) }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setRegion(opt.key)
                          setShowRegionMenu(false)
                        }}
                      >
                        <span>{opt.label}</span>
                        {opt.key !== 'all' && (
                          <span style={styles.menuItemKey}>{opt.key}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div ref={countryRef} style={styles.pillWrap}>
              <button
                type="button"
                style={{ ...styles.pill, ...(showCountryMenu ? styles.pillOpen : {}) }}
                onClick={() => setShowCountryMenu((v) => !v)}
              >
                <MapPin size={16} weight="regular" style={styles.pillIcon} aria-hidden />
                <span>{countryPillLabel}</span>
                <CaretDown
                  size={12}
                  weight="bold"
                  style={{
                    ...styles.pillCaret,
                    transform: showCountryMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                  aria-hidden
                />
              </button>
              {showCountryMenu && (
                <div role="listbox" style={styles.menu}>
                  {countryItems.map((opt) => {
                    const active = country === opt.country
                    const label = opt.country || 'All countries'
                    return (
                      <div
                        key={opt.country || 'all'}
                        role="option"
                        aria-selected={active}
                        style={{ ...styles.menuItem, ...(active ? styles.menuItemActive : {}) }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setCountry(opt.country)
                          setShowCountryMenu(false)
                        }}
                      >
                        <span>{label}</span>
                        {opt.region && (
                          <span style={styles.menuItemKey}>{opt.region}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
                  {overviewTitle} — pick a country to see its market brief.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </SlideBase>
  )
}

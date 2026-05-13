import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretDown, Globe, MapPin } from '@phosphor-icons/react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import {
  REGIONS,
  REGION_LABEL,
  REGIONAL_DATA,
  COUNTRY_LIST_BY_REGION,
  getCountryData,
} from '../../data/regional-data'

// Ecommerce-development index (0-100) — same numbers the portal's Country
// Detail heatmap uses. Drives the colour ramp on the slide map.
const ECOMMERCE_INDEX = {
  'South Korea': 95, 'United Kingdom': 94, 'China': 93, 'United States': 92,
  'Singapore': 92, 'Netherlands': 91, 'Denmark': 91, 'Switzerland': 90,
  'Germany': 89, 'Hong Kong': 89, 'Sweden': 89, 'Norway': 88, 'Japan': 88,
  'Finland': 87, 'Australia': 87, 'Ireland': 86, 'Canada': 86, 'France': 85,
  'Austria': 85, 'Belgium': 84, 'New Zealand': 84, 'Estonia': 83,
  'Luxembourg': 83, 'Taiwan': 82, 'Spain': 80, 'Israel': 80, 'Italy': 78,
  'UAE': 78, 'Portugal': 76, 'Czech Republic': 74, 'Slovenia': 73,
  'Poland': 72, 'Malaysia': 70, 'Saudi Arabia': 69, 'Lithuania': 69,
  'Latvia': 68, 'Hungary': 67, 'Slovakia': 67, 'Qatar': 66, 'Greece': 65,
  'Cyprus': 65, 'Malta': 64, 'Bahrain': 64, 'Chile': 63, 'Croatia': 62,
  'Thailand': 60, 'Bulgaria': 59, 'Romania': 58, 'Kuwait': 58, 'Turkey': 57,
  'Russia': 56, 'Oman': 55, 'Brazil': 55, 'Argentina': 53, 'Mexico': 52,
  'Uruguay': 52, 'Colombia': 50, 'Costa Rica': 49, 'Vietnam': 49,
  'South Africa': 48, 'India': 47, 'Panama': 47, 'Indonesia': 46,
  'Philippines': 45, 'Peru': 44, 'Ukraine': 43, 'Morocco': 40, 'Jordan': 40,
  'Egypt': 38, 'Lebanon': 38, 'Sri Lanka': 37, 'Kenya': 36,
  'Dominican Republic': 35, 'Nigeria': 34, 'Ghana': 33, 'Bangladesh': 33,
  'Pakistan': 32, 'Algeria': 31, 'Tunisia': 31, 'Botswana': 32,
  'Ecuador': 32, 'Bolivia': 30, 'Paraguay': 30, 'Guatemala': 30, 'Cambodia': 28,
  'Rwanda': 28, 'Senegal': 25, "Côte d'Ivoire": 26, 'Nepal': 26, 'Honduras': 26,
  'Nicaragua': 25, 'Venezuela': 24, 'Tanzania': 24, 'Cameroon': 22,
  'Angola': 22, 'Iraq': 22, 'Myanmar': 22, 'Uganda': 22, 'Zambia': 22,
  'Mozambique': 20, 'Ethiopia': 20, 'Zimbabwe': 19, 'Mauritius': 45,
}

// Matches the portal's Country Detail choropleth scale exactly:
//   #eef2ff (light indigo) → #818cf8 (mid indigo) → #1e1b4b (deep navy)
// Higher e-commerce-development index = deeper indigo.
const RAMP_STOPS = [
  { t: 0,    rgb: [238, 242, 255] }, // #EEF2FF
  { t: 0.5,  rgb: [129, 140, 248] }, // #818CF8
  { t: 1,    rgb: [30,  27,  75 ] }, // #1E1B4B
]

function indexColor(value) {
  if (value == null) return 'rgba(189,195,246,0.08)'
  const v = Math.max(0, Math.min(100, value)) / 100
  let lo = RAMP_STOPS[0]
  let hi = RAMP_STOPS[RAMP_STOPS.length - 1]
  for (let i = 0; i < RAMP_STOPS.length - 1; i += 1) {
    if (v >= RAMP_STOPS[i].t && v <= RAMP_STOPS[i + 1].t) {
      lo = RAMP_STOPS[i]
      hi = RAMP_STOPS[i + 1]
      break
    }
  }
  const span = hi.t - lo.t || 1
  const local = (v - lo.t) / span
  const r = Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * local)
  const g = Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * local)
  const b = Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * local)
  return `rgb(${r}, ${g}, ${b})`
}

// world-atlas TopoJSON uses long-form country names; our ECOMMERCE_INDEX
// keys use the short forms. Map the divergent ones so the colour lookup
// works without renaming our data.
const NAME_ALIASES = {
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'United Republic of Tanzania': 'Tanzania',
  "Côte d'Ivoire": "Côte d'Ivoire",
  'Iran (Islamic Republic of)': 'Iran',
  'United Arab Emirates': 'UAE',
  'Republic of Korea': 'South Korea',
  'Czechia': 'Czech Republic',
  'Viet Nam': 'Vietnam',
  'Brunei Darussalam': 'Brunei',
  'Lao PDR': 'Laos',
  'Syrian Arab Republic': 'Syria',
  "Dem. Rep. Korea": 'North Korea',
  "Republic of Moldova": 'Moldova',
  "The former Yugoslav Republic of Macedonia": 'North Macedonia',
  'eSwatini': 'Eswatini',
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
  'Democratic Republic of the Congo': 'DR Congo',
  "Lao People's Democratic Republic": 'Laos',
}
const normaliseCountry = (n) => NAME_ALIASES[n] || n

// Only surface regions and countries we actually have rich data for, so
// the picker never shows an entry that lands on a stub.
const DETAIL_REGIONS = REGIONS.filter((r) => (REGIONAL_DATA[r] || []).length > 0)
const COUNTRIES_BY_REGION = Object.fromEntries(
  DETAIL_REGIONS.map((r) => [
    r,
    (REGIONAL_DATA[r] || [])
      .map((c) => c.country)
      .slice()
      .sort((a, b) => a.localeCompare(b)),
  ]),
)

// World atlas TopoJSON — served locally from the deck's own public assets
// so the slide doesn't depend on a third-party CDN at runtime.
let _worldFeaturesPromise = null
function loadWorldFeatures() {
  if (_worldFeaturesPromise) return _worldFeaturesPromise
  _worldFeaturesPromise = fetch('/sales-deck/world-atlas.json')
    .then((r) => r.json())
    .then((topo) => feature(topo, topo.objects.countries).features)
    .catch(() => [])
  return _worldFeaturesPromise
}

function ChoroplethMap({ pickerCountries, region, onPick, styles, theme }) {
  const wrapRef = useRef(null)
  const [features, setFeatures] = useState([])
  const [size, setSize] = useState({ w: 800, h: 420 })

  useEffect(() => {
    let cancelled = false
    loadWorldFeatures().then((f) => { if (!cancelled) setFeatures(f) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pickerSet = useMemo(
    () => new Set(pickerCountries.map((c) => c.country)),
    [pickerCountries],
  )

  const { w, h } = size
  const projection = useMemo(() => {
    if (!w || !h) return null
    const proj = geoNaturalEarth1()
    if (region !== 'all' && features.length && pickerSet.size) {
      const regionFeatures = features.filter((f) =>
        pickerSet.has(normaliseCountry(f.properties?.name || '')),
      )
      if (regionFeatures.length) {
        proj.fitExtent(
          [[20, 20], [Math.max(20, w - 20), Math.max(20, h - 20)]],
          { type: 'FeatureCollection', features: regionFeatures },
        )
        return proj
      }
    }
    proj.fitSize([w, h], { type: 'Sphere' })
    return proj
  }, [w, h, region, features, pickerSet])
  const path = useMemo(() => (projection ? geoPath(projection) : () => ''), [projection])

  return (
    <div ref={wrapRef} style={styles.overviewMapWrap}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={styles.overviewSvg}
      >
        {features.map((f, i) => {
          const rawName = f.properties?.name || ''
          const name = normaliseCountry(rawName)
          const idx = ECOMMERCE_INDEX[name]
          const inPicker = pickerSet.has(name)
          // Mirror the portal exactly: only countries that have an index AND
          // are inside the current region filter receive the indigo fill.
          // Everything else stays a neutral land tone so the world map still
          // reads, no opacity tricks.
          const fill = (idx != null && inPicker)
            ? indexColor(idx)
            : (theme.isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)')
          return (
            <path
              key={f.id || rawName || i}
              d={path(f)}
              fill={fill}
              stroke="#ffffff"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: inPicker && idx != null ? 'pointer' : 'default' }}
              onClick={() => { if (inPicker && idx != null) onPick(name) }}
            >
              <title>
                {name}{idx != null && inPicker ? ` · ecommerce development: ${idx}/100` : ''}
              </title>
            </path>
          )
        })}
      </svg>
    </div>
  )
}

// Every rich-data country flattened across regions — used when
// "All regions" is selected so the country pill spans the global set.
const ALL_COUNTRIES = DETAIL_REGIONS.flatMap((r) =>
  COUNTRIES_BY_REGION[r].map((country) => ({ country, region: r })),
).sort((a, b) => a.country.localeCompare(b.country))

function PillDropdown({ icon: Icon, label, items, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pillStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: 'clamp(10px, 0.9vw, 16px) clamp(18px, 1.4vw, 26px)',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${open ? 'rgba(62,79,224,0.55)' : 'rgba(255,255,255,0.12)'}`,
    boxShadow: open ? '0 0 0 4px rgba(62,79,224,0.10)' : 'none',
    borderRadius: '100px',
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'var(--font)',
    fontSize: 'clamp(13px, 1.05vw, 18px)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    backdropFilter: 'blur(12px)',
  }
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        style={pillStyle}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon size={16} weight="regular" style={{ color: 'rgba(189,195,246,0.95)' }} aria-hidden />
        <span>{label}</span>
        <CaretDown
          size={12}
          weight="bold"
          style={{ opacity: 0.7, transition: 'transform 0.18s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
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
            zIndex: 40,
          }}
        >
          {items.map((opt) => {
            const active = value === opt.value
            return (
              <div
                key={opt.value || 'all'}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: active ? '#fff' : 'rgba(255,255,255,0.88)',
                  background: active ? 'rgba(62,79,224,0.16)' : 'transparent',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background 0.12s ease',
                }}
              >
                <span>{opt.label}</span>
                {opt.tag && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {opt.tag}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SlideCountryDetail() {
  const theme = useTheme()

  // No prefilter: 'all' regions, 'all' countries by default — mirrors the
  // portal's Country Detail empty state.
  const [region, setRegion] = useState('all')
  const [country, setCountry] = useState('')


  const countriesForPicker = useMemo(() => {
    if (region === 'all') return ALL_COUNTRIES
    return (COUNTRIES_BY_REGION[region] || []).map((country) => ({ country, region }))
  }, [region])

  // Re-validate the selected country when the region changes.
  useEffect(() => {
    if (country && !countriesForPicker.some((c) => c.country === country)) {
      setCountry('')
    }
  }, [region, country, countriesForPicker])

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
      gap: 'clamp(14px, 1.2vw, 24px)',
      minHeight: 0,
    },
    headerRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(12px, 1vw, 20px)',
      flexShrink: 0,
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(40px, 3.8vw, 72px)',
      fontWeight: 500,
      letterSpacing: '-1.2px',
      lineHeight: 1.1,
      color: theme.ink,
      margin: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
    subtitle: {
      fontSize: 'clamp(15px, 1.2vw, 22px)',
      fontWeight: 500,
      lineHeight: 1.4,
      color: theme.inkSecondary,
      margin: 0,
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
    pill: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: 'clamp(10px, 0.9vw, 16px) clamp(40px, 3vw, 56px) clamp(10px, 0.9vw, 16px) clamp(16px, 1.3vw, 24px)',
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
    pillIcon: {
      color: 'rgba(189,195,246,0.95)',
      pointerEvents: 'none',
    },
    pillCaret: {
      position: 'absolute',
      right: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      opacity: 0.7,
      pointerEvents: 'none',
    },
    nativeSelect: {
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: 'inherit',
      font: 'inherit',
      cursor: 'pointer',
      paddingRight: '4px',
      minWidth: '140px',
    },
    backBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: 'clamp(10px, 0.9vw, 16px) clamp(16px, 1.3vw, 22px)',
      background: 'rgba(62,79,224,0.18)',
      border: '1px solid rgba(62,79,224,0.45)',
      borderRadius: '100px',
      color: '#fff',
      fontFamily: 'var(--font)',
      fontSize: 'clamp(13px, 1.05vw, 18px)',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background 0.18s ease',
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
      gap: 'clamp(6px, 0.5vw, 10px)',
      padding: 'clamp(4px, 0.4vw, 10px)',
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '16px',
      overflow: 'hidden',
      background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.02)',
    },
    overviewMapWrap: {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    overviewSvg: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
    },
    overviewLead: {
      position: 'absolute',
      top: 'clamp(10px, 1vw, 18px)',
      left: 0,
      right: 0,
      zIndex: 2,
      textAlign: 'center',
      fontSize: 'clamp(13px, 1vw, 18px)',
      fontWeight: 500,
      color: theme.inkSecondary,
      lineHeight: 1.4,
      margin: 0,
      pointerEvents: 'none',
    },
    legend: {
      position: 'absolute',
      bottom: 'clamp(10px, 1vw, 18px)',
      left: 0,
      right: 0,
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(10px, 0.9vw, 18px)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(10px, 0.8vw, 13px)',
      fontWeight: 600,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
      pointerEvents: 'none',
    },
    legendBar: {
      width: 'clamp(160px, 16vw, 280px)',
      height: '10px',
      borderRadius: '5px',
      background: 'linear-gradient(90deg, #EEF2FF 0%, #818CF8 50%, #1E1B4B 100%)',
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
            {country
              ? <>Inside <span style={styles.titleAccent}>{country}</span></>
              : (
                <>
                  Coverage across{' '}
                  <span style={styles.titleAccent}>
                    {region === 'all' ? 'every region' : (REGION_LABEL[region] || region)}
                  </span>
                </>
              )}
          </h2>
          {!country && (
            <p style={styles.subtitle}>Click any country to open its market brief.</p>
          )}
          <div style={styles.filterRow}>
            <span style={styles.filterKicker}>Filter</span>

            <PillDropdown
              icon={Globe}
              label={regionPillLabel}
              value={region}
              onChange={setRegion}
              items={regionItems.map((opt) => ({
                value: opt.key,
                label: opt.label,
                tag: opt.key !== 'all' ? opt.key : null,
              }))}
              theme={theme}
            />

            <PillDropdown
              icon={MapPin}
              label={countryPillLabel}
              value={country}
              onChange={setCountry}
              items={countryItems.map((opt) => ({
                value: opt.country,
                label: opt.country || 'All countries',
                tag: opt.region || null,
              }))}
              theme={theme}
            />

            {country && (
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => setCountry('')}
              >
                ← Back to map
              </button>
            )}
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
          ) : country ? (
            <div style={styles.stub}>
              No detailed market brief is published for <strong>{country}</strong> yet. Pick
              another country or switch back to <em>All countries</em> to explore the global map.
            </div>
          ) : (
            <div style={styles.overview}>
              <ChoroplethMap
                pickerCountries={countriesForPicker}
                region={region}
                onPick={setCountry}
                styles={styles}
                theme={theme}
              />
              <div style={styles.legend}>
                <span>Lower e-commerce index</span>
                <span style={styles.legendBar} aria-hidden />
                <span>Higher</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </SlideBase>
  )
}

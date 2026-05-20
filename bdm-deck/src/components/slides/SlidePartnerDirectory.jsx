import { useEffect, useMemo, useRef, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

// Inline pill dropdown matching SlideCountryDetail's PillDropdown look
// (rounded pill button, searchable list, click-outside-closes). Lighter
// than importing the full component from SlideCountryDetail because we
// don't need the icon support here.
function PillFilter({ label, value, options, onChange, placeholder = 'Type to search…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => (o.label || '').toLowerCase().includes(q))
  }, [options, query])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      const pick = filtered.find((o) => o.value !== 'all') || filtered[0]
      onChange(pick.value)
      setOpen(false)
    }
  }

  const selectedLabel = (options.find((o) => o.value === value) || options[0])?.label || label

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-no-translate
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '11.5px 18px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(62,79,224,0.55)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: open ? '0 0 0 4px rgba(62,79,224,0.10)' : 'none',
          borderRadius: 100,
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.18s ease',
          backdropFilter: 'blur(12px)',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{selectedLabel}</span>
        <span style={{ opacity: 0.7, transition: 'transform 0.18s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', left: 0,
            minWidth: 240, maxHeight: 360, overflowY: 'auto',
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14, padding: 8, zIndex: 20,
            boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            data-no-translate
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px', marginBottom: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8,
              color: '#fff', fontFamily: 'var(--font)', fontSize: 13,
              outline: 'none',
            }}
          />
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>No matches</div>
          ) : (
            filtered.map((o) => (
              <div
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  color: o.value === value ? '#fff' : 'rgba(255,255,255,0.78)',
                  background: o.value === value ? 'rgba(62,79,224,0.35)' : 'transparent',
                  fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// Build the flag URL from an ISO-2 code provided by the server (pycountry
// resolves the country name → ISO server-side, so we don't have to ship
// a hardcoded country→ISO map here and miss countries).
function flagSrcFromIso(iso) {
  if (!iso) return null
  return `https://flagcdn.com/w20/${String(iso).toLowerCase()}.png`
}

// Partner directory table — mirrors the partnerships portal's Partner
// Portfolio page. Pulls the live SOT from /api/partners-directory and
// lets the presenter filter by type, region, country, and free-text
// search. Clicking a row expands to show that provider's full country →
// payment-method coverage.
export default function SlidePartnerDirectory() {
  const theme = useTheme()
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/partners-directory')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j) => {
        if (cancelled) return
        setPartners(Array.isArray(j?.partners) ? j.partners : [])
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || String(e))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const typeOptions = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => { if (p.type) s.add(p.type) })
    return Array.from(s).sort()
  }, [partners])
  const regionOptions = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => (p.regions || []).forEach((r) => s.add(r)))
    return Array.from(s).sort()
  }, [partners])
  const countryOptions = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => (p.countries || []).forEach((c) => s.add(c)))
    return Array.from(s).sort()
  }, [partners])
  const methodOptions = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => {
      Object.values(p.country_methods || {}).forEach((ms) => (ms || []).forEach((m) => s.add(m)))
    })
    return Array.from(s).sort()
  }, [partners])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partners.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (regionFilter !== 'all' && !(p.regions || []).includes(regionFilter)) return false
      if (countryFilter !== 'all' && !(p.countries || []).includes(countryFilter)) return false
      if (methodFilter !== 'all') {
        const hasMethod = Object.values(p.country_methods || {})
          .some((ms) => (ms || []).includes(methodFilter))
        if (!hasMethod) return false
      }
      if (q) {
        const hay = `${p.provider} ${p.type} ${(p.regions || []).join(' ')} ${(p.countries || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [partners, search, typeFilter, regionFilter, countryFilter, methodFilter])

  // Filter a partner's country→methods map by the active region / country
  // / method filters so the expanded row only shows the slice the user is
  // looking at. The generic "CARD" tag is stripped from the rendered
  // chips — it exists only so the methods filter can match "any card
  // brand". The actual brand (Visa, Mastercard, ...) is what shows.
  const filterCoverage = (p) => {
    const out = []
    const cm = p.country_methods || {}
    const cr = p.country_region || {}
    for (const country of Object.keys(cm).sort()) {
      if (countryFilter !== 'all' && country !== countryFilter) continue
      if (regionFilter !== 'all' && cr[country] !== regionFilter) continue
      // Strip the generic CARD tag (case-insensitive) so the detail
      // view only ever shows real brand names — never the umbrella
      // "CARD" label that lives in the data for filter use only.
      let methods = (cm[country] || []).filter((m) => String(m).toUpperCase() !== 'CARD')
      if (methodFilter !== 'all') {
        if (!(cm[country] || []).includes(methodFilter)) continue
        if (String(methodFilter).toUpperCase() !== 'CARD') {
          methods = methods.filter((m) => m === methodFilter)
        }
        if (methods.length === 0) continue
      }
      out.push([country, methods])
    }
    return out
  }

  const inkStrong = theme.inkStrong
  const inkSecondary = theme.inkSecondary
  const inkMuted = theme.inkMuted
  const accent = theme.accent
  const isLight = theme.isLight

  const cellBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(62,79,224,0.06)'
  const cellBorder = isLight ? 'rgba(15,23,42,0.06)' : 'rgba(124,137,239,0.18)'
  const inputBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(62,79,224,0.10)'

  const styles = {
    body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' },
    title: {
      fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700,
      letterSpacing: '-1px', lineHeight: 1.05, color: inkStrong, margin: 0,
    },
    subtitle: { fontFamily: 'var(--font)', fontSize: 17, lineHeight: 1.5, color: inkSecondary, margin: 0, maxWidth: 1280 },
    // Single row: search input + four selects, matching the Country
    // Detail map's pill-dropdown aesthetic. Search grows to fill space.
    filterRow: { display: 'flex', flexWrap: 'nowrap', gap: 10, alignItems: 'center', flexShrink: 0 },
    input: {
      // Fixed compact width so the four pill filters get full breathing
      // room on the row and don't overflow to the right.
      flex: '0 0 200px', minWidth: 0,
      fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 500,
      padding: '11.5px 18px', borderRadius: 100,
      border: isLight
        ? '1px solid rgba(15,23,42,0.12)'
        : '1px solid rgba(255,255,255,0.12)',
      background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)',
      color: inkStrong, outline: 'none',
      transition: 'all 0.18s ease',
      backdropFilter: 'blur(12px)',
    },
    // Mirrors the pill dropdowns on the Country Detail map (icon + label
    // + caret). Native <select> can't render an icon inline reliably, but
    // the spacing / colors / pill radius / glow match.
    select: {
      flex: '0 0 auto',
      fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600,
      padding: '11.5px 18px 11.5px 18px',
      borderRadius: 100,
      border: isLight
        ? '1px solid rgba(15,23,42,0.12)'
        : '1px solid rgba(255,255,255,0.12)',
      background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)',
      color: inkStrong,
      cursor: 'pointer', outline: 'none',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      transition: 'all 0.18s ease',
      backdropFilter: 'blur(12px)',
      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
      paddingRight: 36,
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isLight ? '%230f172a' : '%23ffffff'}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 14px center',
    },
    tableWrap: { flex: '1 1 0', minHeight: 0, overflow: 'auto', border: `1px solid ${cellBorder}`, borderRadius: 10 },
    table: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)', fontSize: 12 },
    th: {
      position: 'sticky', top: 0, zIndex: 1,
      background: isLight ? '#fff' : 'rgba(15,23,42,0.92)',
      color: inkMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      fontSize: 10, padding: '10px 14px', textAlign: 'left',
      borderBottom: `1px solid ${cellBorder}`,
    },
    tr: { background: cellBg, borderBottom: `1px solid ${cellBorder}`, cursor: 'pointer' },
    td: { padding: '10px 14px', color: inkSecondary, verticalAlign: 'top' },
    providerCell: { fontWeight: 700, color: inkStrong, textTransform: 'uppercase', letterSpacing: '0.04em' },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
    chip: {
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 5,
      background: isLight ? 'rgba(62,79,224,0.08)' : 'rgba(124,137,239,0.18)',
      color: isLight ? '#3E4FE0' : '#BDC3F6',
    },
    expandRow: { background: isLight ? 'rgba(62,79,224,0.04)' : 'rgba(124,137,239,0.08)' },
    expandCell: { padding: '14px 18px', color: inkSecondary },
    countryBlock: { marginBottom: 10 },
    countryName: {
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: inkStrong, marginBottom: 4,
    },
    methodChip: {
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4,
      background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(124,137,239,0.10)',
      color: inkSecondary,
    },
    empty: { padding: '30px 18px', textAlign: 'center', color: inkMuted },
  }

  return (
    <SlideBase section="Providers Directory">
      <div style={styles.body}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <h2 style={styles.title}>
            Providers Directory
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 16,
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '1.6px',
                textTransform: 'uppercase',
                color: accent,
                background: isLight ? 'rgba(62,79,224,0.10)' : 'rgba(62,79,224,0.18)',
                border: `1px solid ${theme.borderAccent}`,
                borderRadius: 100,
                verticalAlign: 'middle',
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: accent,
                  boxShadow: '0 0 10px rgba(62,79,224,0.6)',
                  animation: 'pulse 2s infinite',
                }}
                aria-hidden
              />
              Dynamic slide
            </span>
          </h2>
          <p style={styles.subtitle}>
            We have partnerships with the region’s most relevant providers (PSPs, Acquirers, APMs, Fraud Solutions and others), ranging from the largest players to the niche ones. Thanks to our extensive footprint, we can integrate any provider in less than a month and source new ones as needed.
          </p>
        </div>

        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-no-translate
            style={styles.input}
          />
          <PillFilter
            label="ALL TYPES"
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="Search type…"
            options={[{ value: 'all', label: 'ALL TYPES' }, ...typeOptions.map((t) => ({ value: t, label: t }))]}
          />
          <PillFilter
            label="ALL REGIONS"
            value={regionFilter}
            onChange={setRegionFilter}
            placeholder="Search region…"
            options={[{ value: 'all', label: 'ALL REGIONS' }, ...regionOptions.map((r) => ({ value: r, label: r }))]}
          />
          <PillFilter
            label="ALL COUNTRIES"
            value={countryFilter}
            onChange={setCountryFilter}
            placeholder="Search country…"
            options={[{ value: 'all', label: 'ALL COUNTRIES' }, ...countryOptions.map((c) => ({ value: c, label: c }))]}
          />
          <PillFilter
            label="METHODS"
            value={methodFilter}
            onChange={setMethodFilter}
            placeholder="Search method…"
            options={[{ value: 'all', label: 'METHODS' }, ...methodOptions.map((m) => ({ value: m, label: m }))]}
          />
        </div>

        <div style={styles.tableWrap}>
          {loading ? (
            <div style={styles.empty}>Loading partner directory…</div>
          ) : error ? (
            <div style={styles.empty}>Couldn't load partners: {error}</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>No partners match those filters.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Provider</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Regions</th>
                  <th style={styles.th}>Countries</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isOpen = expanded === p.provider
                  return (
                    <>
                      <tr
                        key={p.provider}
                        style={styles.tr}
                        onClick={() => setExpanded(isOpen ? null : p.provider)}
                      >
                        <td style={{ ...styles.td, ...styles.providerCell }}>
                          {isOpen ? '▾ ' : '▸ '}{p.provider}
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {p.type}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.chipRow}>
                            {(p.regions || []).slice(0, 6).map((r) => (
                              <span key={r} style={styles.chip}>{r}</span>
                            ))}
                            {p.regions.length > 6 && <span style={styles.chip}>+{p.regions.length - 6}</span>}
                          </div>
                        </td>
                        <td style={{ ...styles.td, color: inkMuted, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {(p.countries || []).length} markets
                        </td>
                      </tr>
                      {isOpen && (() => {
                        const rows = filterCoverage(p)
                        return (
                          <tr key={`${p.provider}-expand`} style={styles.expandRow}>
                            <td colSpan={4} style={styles.expandCell}>
                              {rows.length === 0 ? (
                                <div style={{ color: inkMuted }}>
                                  No matching country / payment-method coverage for the active filters.
                                </div>
                              ) : (
                                rows.map(([country, methods]) => {
                                  const flag = flagSrcFromIso((p.country_iso || {})[country])
                                  return (
                                    <div key={country} style={styles.countryBlock}>
                                      <div style={{ ...styles.countryName, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {flag && (
                                          <img
                                            src={flag}
                                            alt=""
                                            width={18}
                                            height={13}
                                            style={{ display: 'block', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
                                            aria-hidden
                                          />
                                        )}
                                        <span>{country}</span>
                                      </div>
                                      <div style={styles.chipRow}>
                                        {methods.map((m) => (
                                          <span key={`${country}-${m}`} style={styles.methodChip}>{m}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                            </td>
                          </tr>
                        )
                      })()}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SlideBase>
  )
}

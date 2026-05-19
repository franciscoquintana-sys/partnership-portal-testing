import { useEffect, useMemo, useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partners.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (regionFilter !== 'all' && !(p.regions || []).includes(regionFilter)) return false
      if (countryFilter !== 'all' && !(p.countries || []).includes(countryFilter)) return false
      if (q) {
        const hay = `${p.provider} ${p.type} ${(p.regions || []).join(' ')} ${(p.countries || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [partners, search, typeFilter, regionFilter, countryFilter])

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
    title: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.6px', color: inkStrong, margin: 0 },
    subtitle: { fontFamily: 'var(--font)', fontSize: 13, color: inkSecondary, margin: 0 },
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 0 },
    input: {
      flex: '1 1 220px', minWidth: 0,
      fontFamily: 'var(--font)', fontSize: 12, fontWeight: 500,
      padding: '8px 12px', borderRadius: 8,
      border: `1px solid ${cellBorder}`, background: inputBg, color: inkStrong,
      outline: 'none',
    },
    select: {
      fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700,
      padding: '8px 12px', borderRadius: 8,
      border: `1px solid ${cellBorder}`, background: inputBg, color: inkStrong,
      cursor: 'pointer', outline: 'none',
      textTransform: 'uppercase', letterSpacing: '0.04em',
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
    providerCell: { fontWeight: 700, color: inkStrong },
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
    <SlideBase section="Partner Directory">
      <div style={styles.body}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <h2 style={styles.title}>Partner Directory</h2>
          <p style={styles.subtitle}>
            Every partner in Yuno's network — filter by type, region, country, or search by name.
            Click a row to expand the country-by-country payment-method coverage.
          </p>
        </div>

        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search partner / type / region / country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-no-translate
            style={styles.input}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={styles.select} data-no-translate>
            <option value="all">ALL TYPES</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={styles.select} data-no-translate>
            <option value="all">ALL REGIONS</option>
            {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} style={styles.select} data-no-translate>
            <option value="all">ALL COUNTRIES</option>
            {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
                  <th style={styles.th}>Partner</th>
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
                      {isOpen && (
                        <tr key={`${p.provider}-expand`} style={styles.expandRow}>
                          <td colSpan={4} style={styles.expandCell}>
                            {Object.keys(p.country_methods || {}).length === 0 ? (
                              <div style={{ color: inkMuted }}>No payment-method data for this partner.</div>
                            ) : (
                              Object.entries(p.country_methods).map(([country, methods]) => (
                                <div key={country} style={styles.countryBlock}>
                                  <div style={styles.countryName}>{country}</div>
                                  <div style={styles.chipRow}>
                                    {methods.map((m) => (
                                      <span key={`${country}-${m}`} style={styles.methodChip}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      )}
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

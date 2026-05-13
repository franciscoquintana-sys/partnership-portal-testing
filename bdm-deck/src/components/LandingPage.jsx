import { useState, useEffect, useRef } from 'react'
import { Bank, Handshake, Storefront, Globe, CaretDown, MapPin, Check } from '@phosphor-icons/react'
import { resolveMerchant } from '../data/merchants.generated'
import { resolveBank } from '../data/banks.generated'
import { resolvePartner } from '../data/partners.generated'
import { REGIONS, REGION_LABEL, getRegionCountriesForPicker } from '../data/regional-data'

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // Sit content in the upper third so there is real room for the dropdown
    // below the input on short viewports (~620px). Was 'center' which pushed
    // the input to ~75% of the viewport height with the dropdown clipping.
    justifyContent: 'flex-start',
    paddingTop: 'clamp(48px, 9vh, 140px)',
    background: 'radial-gradient(ellipse at 30% 20%, #1726A6 0%, #000000 40%, #000000 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  // Animated orbs
  orb1: {
    position: 'absolute',
    top: '-20%',
    left: '-15%',
    width: '70vw',
    height: '70vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(62,79,224,0.25) 0%, rgba(62,79,224,0) 60%)',
    filter: 'blur(60px)',
    animation: 'float 12s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute',
    bottom: '-30%',
    right: '-15%',
    width: '60vw',
    height: '60vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(62,79,224,0.18) 0%, rgba(62,79,224,0) 60%)',
    filter: 'blur(60px)',
    animation: 'float 15s ease-in-out infinite reverse',
  },
  stripe1: {
    position: 'absolute',
    top: '-30%',
    right: '-8%',
    width: '42%',
    height: '160%',
    background: 'linear-gradient(160deg, rgba(62,79,224,0.15) 0%, rgba(189,195,246,0.06) 100%)',
    transform: 'rotate(-20deg)',
    borderRadius: '80px',
  },
  stripe2: {
    position: 'absolute',
    top: '-20%',
    right: '8%',
    width: '25%',
    height: '140%',
    background: 'linear-gradient(160deg, rgba(189,195,246,0.08) 0%, rgba(124,137,239,0.03) 100%)',
    transform: 'rotate(-20deg)',
    borderRadius: '80px',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(24px, 4.5vh, 44px)',
    padding: '0 24px',
    width: '100%',
    maxWidth: '860px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1.8px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(12px)',
    animation: 'fadeInUp 0.6s ease-out',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3E4FE0 0%, #BDC3F6 100%)',
    boxShadow: '0 0 10px rgba(62,79,224,0.6)',
    animation: 'pulse 2s infinite',
  },
  yunoLogo: {
    height: '18px',
    opacity: 0.95,
  },
  divider: {
    width: '1px',
    height: '12px',
    background: 'rgba(255,255,255,0.25)',
  },
  titleStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(44px, 5.4vw, 74px)',
    fontWeight: 700,
    letterSpacing: '-1.6px',
    lineHeight: 1.02,
    textAlign: 'center',
    maxWidth: '14em',
    color: '#fff',
    animation: 'fadeInUp 0.7s ease-out 0.1s both',
  },
  titleAccent: {
    background: 'linear-gradient(135deg, #3E4FE0 0%, #BDC3F6 50%, #BDC3F6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundSize: '200% 200%',
    animation: 'gradientShift 8s ease-in-out infinite',
  },
  subtitle: {
    fontSize: '16px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
    maxWidth: '520px',
    lineHeight: 1.65,
    animation: 'fadeInUp 0.7s ease-out 0.2s both',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  // Form is the new top-level container — wraps the merchant input, the
  // region/country pills, and the standalone Let's start button so all three
  // steps live inside the same form submission.
  searchWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 'clamp(18px, 2.2vh, 28px)',
    width: '100%',
    maxWidth: '720px',
    animation: 'fadeInUp 0.7s ease-out 0.3s both',
  },
  // Inner wrapper that anchors the autocomplete dropdown to the input row
  // (the dropdown is absolutely-positioned and reads top: calc(100% + 12px)
  // from this element, not from the form).
  inputArea: {
    position: 'relative',
    width: '100%',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '6px',
    transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
    backdropFilter: 'blur(24px)',
  },
  inputGroupFocused: {
    background: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(62,79,224,0.55)',
    boxShadow: '0 0 0 4px rgba(62,79,224,0.12), 0 12px 40px rgba(62,79,224,0.22)',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 400,
    fontFamily: 'var(--font)',
    padding: '16px 22px',
    letterSpacing: '0',
  },
  // Standalone Let's start button — lives below the region/country pills.
  // Disabled until the user has typed/picked a merchant; once enabled it
  // matches the original inline button styling so the deck still feels the
  // same once the user reaches the bottom of the form.
  submitButton: {
    background: 'linear-gradient(135deg, #3E4FE0 0%, #5967E4 50%, #5967E4 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '15px 36px',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
    letterSpacing: '0.2px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    backgroundSize: '200% 200%',
    minWidth: '180px',
    animation: 'fadeInUp 0.6s ease-out 0.5s both',
  },
  submitButtonDisabled: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.42)',
    cursor: 'not-allowed',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: 'none',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    left: 0,
    right: 0,
    // Reserve ~360px above the input (badge + title + subtitle + paddings)
    // so the dropdown bottom stays inside the viewport at any height.
    // Hard floor at 160px so very short windows still show a couple of items.
    maxHeight: 'max(160px, min(360px, calc(100vh - 360px)))',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.92)',
    backdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '8px',
    boxShadow: '0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset',
    zIndex: 10,
    animation: 'fadeInUp 0.2s ease-out',
  },
  dropdownItem: {
    padding: '11px 14px',
    fontSize: '14px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.88)',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background 0.12s ease',
  },
  dropdownLogo: {
    width: '32px',
    height: '22px',
    objectFit: 'contain',
    display: 'block',
    flexShrink: 0,
    opacity: 0.9,
    // Render every merchant wordmark as white on the dark dropdown row,
    // same treatment used in the slide merchant nodes. Keeps dark-asset
    // brands (Hostinger, United Airlines, etc.) from disappearing.
    filter: 'brightness(0) invert(1)',
  },
  // Phosphor Bank glyph used next to the synthetic "Banking" vertical
  // entry so it reads as a category marker, not a brand wordmark.
  dropdownBankIcon: {
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 0,
    marginLeft: '5px',
  },
  dropdownLogoEmpty: {
    width: '36px',
    height: '28px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  dropdownName: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 600,
    letterSpacing: '-0.1px',
  },
  // Small grey tag at the right of each dropdown row indicating the
  // audience type (Merchant / Acquiring Bank / Partner). Visual only —
  // not clickable. Uses a pale grey so it doesn't compete with the name.
  dropdownTypeTag: {
    flexShrink: 0,
    fontSize: '10.5px',
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    padding: '3px 9px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  // Region pill — sits below the search form. Shows the currently selected
  // region with a globe glyph and a caret; opens a small dropdown of the
  // five canonical regions. Default Americas. The selection threads through
  // onGenerate so the deck's final SlideRegionalConnections renders the
  // right region's processor coverage.
  regionRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.3px',
    animation: 'fadeInUp 0.7s ease-out 0.4s both',
  },
  regionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.42)',
  },
  regionPillWrap: {
    position: 'relative',
  },
  regionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontFamily: 'var(--font)',
    letterSpacing: '0.2px',
  },
  regionPillOpen: {
    background: 'rgba(62,79,224,0.18)',
    borderColor: 'rgba(62,79,224,0.5)',
    boxShadow: '0 0 0 4px rgba(62,79,224,0.1)',
  },
  regionPillGlobe: {
    color: 'rgba(189,195,246,0.95)',
  },
  regionMenu: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    left: '50%',
    transform: 'translateX(-50%)',
    minWidth: '260px',
    maxHeight: 'min(60vh, 320px)',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.92)',
    backdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '8px',
    boxShadow: '0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset',
    zIndex: 11,
    animation: 'fadeInUp 0.2s ease-out',
  },
  regionMenuItem: {
    padding: '10px 14px',
    fontSize: '13px',
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
  regionMenuItemActive: {
    background: 'rgba(62,79,224,0.16)',
    color: '#fff',
  },
  regionMenuItemKey: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
  },
  // Country menu drops a single-column list — needs more height because
  // selecting two regions can surface 16+ markets at once.
  countryMenu: {
    minWidth: '280px',
    maxHeight: 'min(60vh, 320px)',
    overflowY: 'auto',
  },
  pinIcon: {
    color: 'rgba(189,195,246,0.95)',
  },
  // Small numeric badge on the pill — shows the count of selected items
  // so the presenter can tell at a glance how many regions / countries
  // are active without opening the menu.
  pillCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 6px',
    background: 'rgba(124,137,239,0.32)',
    border: '1px solid rgba(124,137,239,0.45)',
    borderRadius: '999px',
    fontSize: '10.5px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: '#fff',
  },
  // 14x14 checkbox slot inside each multi-select menu row. Empty box when
  // unchecked, accented background + check glyph when checked. Sits left
  // of the row label.
  checkBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '15px',
    height: '15px',
    borderRadius: '4px',
    border: '1.5px solid rgba(255,255,255,0.28)',
    background: 'rgba(62,79,224,0.18)',
    color: '#fff',
    flexShrink: 0,
  },
  bottom: {
    position: 'absolute',
    bottom: '36px',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.32)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    animation: 'fadeIn 1s ease-out 0.5s both',
  },
  bottomDivider: {
    width: '1px',
    height: '10px',
    background: 'rgba(255,255,255,0.16)',
  },
}

// Parses a simple one-column CSV (header row + one name per line) into
// entries tagged with the given audience type.
function parseNameCsv(text, type) {
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => ({ name: line.split(',')[0]?.trim(), type }))
    .filter((m) => m.name)
}

const TYPE_LABEL = {
  merchant: 'Merchant',
  bank: 'Acquiring Bank',
  partner: 'Partner',
}

// The search box is URL-only — no preset entries, no Banking shortcut,
// no merchant / bank / partner suggestions.
const SYNTHETIC_ENTRIES = []

function currentMonthYear() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function LandingPage({ onGenerate, loading = false, errorMessage = null }) {
  const [merchant, setMerchant] = useState('')
  const [focused, setFocused] = useState(false)
  const [entries, setEntries] = useState([]) // merchants + banks + partners
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [hoveringBtn, setHoveringBtn] = useState(false)
  // Multi-select region + country. Both default empty — the deck only
  // surfaces region / country slides when the presenter explicitly picks
  // them. Country list is the union of every country in the selected
  // regions; deselecting a region drops its countries from the picker and
  // from the live selection.
  const [regions, setRegions] = useState([])
  const [countries, setCountries] = useState([])
  const [showRegionMenu, setShowRegionMenu] = useState(false)
  const [showCountryMenu, setShowCountryMenu] = useState(false)
  // 'bottom' = menu drops below the pill; 'top' = menu opens above. Flipped
  // on open when there is not enough room below the pill (e.g. iframe
  // viewport too short), so the full list — including its internal scroll —
  // stays visible.
  const [regionPlacement, setRegionPlacement] = useState('bottom')
  const [countryPlacement, setCountryPlacement] = useState('bottom')
  const regionRef = useRef(null)
  const countryRef = useRef(null)

  // Whenever the region set changes, prune any selected countries that
  // belong to a region no longer in the picker. Avoids the stale-pairing
  // case where the pill shows e.g. Brazil while LATAM has been deselected.
  useEffect(() => {
    const validCountries = new Set()
    regions.forEach((r) => getRegionCountriesForPicker(r).forEach((c) => validCountries.add(c.country)))
    setCountries((prev) => prev.filter((c) => validCountries.has(c)))
  }, [regions])

  // Close menus when the user clicks outside. Tied to mousedown so it
  // fires before the click event on the pill that would re-open it.
  useEffect(() => {
    if (!showRegionMenu && !showCountryMenu) return
    const onDown = (e) => {
      if (showRegionMenu && !regionRef.current?.contains(e.target)) setShowRegionMenu(false)
      if (showCountryMenu && !countryRef.current?.contains(e.target)) setShowCountryMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showRegionMenu, showCountryMenu])

  // Flip menu placement when there is not enough room below the pill.
  useEffect(() => {
    if (showRegionMenu && regionRef.current) {
      const r = regionRef.current.getBoundingClientRect()
      setRegionPlacement(window.innerHeight - r.bottom < 260 ? 'top' : 'bottom')
    }
  }, [showRegionMenu])
  useEffect(() => {
    if (showCountryMenu && countryRef.current) {
      const r = countryRef.current.getBoundingClientRect()
      setCountryPlacement(window.innerHeight - r.bottom < 260 ? 'top' : 'bottom')
    }
  }, [showCountryMenu])

  const availableCountries = regions
    .flatMap((r) => getRegionCountriesForPicker(r).map((c) => ({ country: c.country, region: r })))
    .sort((a, b) => a.country.localeCompare(b.country))

  const toggleRegion = (r) => {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }
  const toggleCountry = (c) => {
    setCountries((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const regionPillLabel = regions.length === 0
    ? 'Select region(s)'
    : regions.length === 1
      ? REGION_LABEL[regions[0]]
      : `${regions.length} regions`

  const countryPillLabel = countries.length === 0
    ? 'Select countr(ies)'
    : countries.length === 1
      ? countries[0]
      : `${countries.length} countries`

  useEffect(() => {
    setEntries([])
  }, [])

  const filtered = merchant.trim()
    ? entries
        .filter((e) => e.name.toLowerCase().includes(merchant.toLowerCase()))
        .slice(0, 8)
    : []

  const handleSubmit = (e) => {
    e.preventDefault()
    if (loading) return
    const pick = filtered[highlightIdx]
    if (pick) {
      onGenerate({ name: pick.name, type: pick.type, regions, countries })
    } else if (merchant.trim()) {
      // Free-text fallback: assume merchant.
      onGenerate({ name: merchant.trim(), type: 'merchant', regions, countries })
    }
  }

  const handleKey = (e) => {
    if (!showDropdown || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    }
  }

  return (
    <div style={styles.container} className="noise-overlay">
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.stripe1} />
      <div style={styles.stripe2} />

      <div style={styles.content}>
        <div style={styles.badge}>
          <div style={styles.badgeDot} />
          <img src="/sales-deck/assets/yuno-logo-white.svg" alt="Yuno" style={styles.yunoLogo} />
          <div style={styles.divider} />
          <span>{currentMonthYear()}</span>
        </div>

        <div style={styles.titleStack}>
          <h1 style={styles.title}>
            Powering financial infrastructure<br />
            <span style={styles.titleAccent}>at global scale.</span>
          </h1>

          <div style={styles.subtitle}>
            <span>Type client URL to generate their tailored brief.</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.searchWrapper}>
          <div style={styles.inputArea}>
            <div
              style={{
                ...styles.inputGroup,
                ...(focused ? styles.inputGroupFocused : {}),
              }}
            >
              <input
                style={styles.input}
                type="text"
                placeholder="Type URL..."
                value={merchant}
                onChange={(e) => {
                  setMerchant(e.target.value)
                  setShowDropdown(true)
                  setHighlightIdx(0)
                }}
                onFocus={() => {
                  setFocused(true)
                  setShowDropdown(true)
                }}
                onBlur={() => {
                  setFocused(false)
                  setTimeout(() => setShowDropdown(false), 200)
                }}
                onKeyDown={handleKey}
                autoFocus
                autoComplete="off"
              />
            </div>

            {showDropdown && filtered.length > 0 && (
              <div style={styles.dropdown}>
                {filtered.map((m, i) => {
                  // Resolve a white-silhouette logo based on the entry type.
                  // Falls back to the category icon when the manifest has no
                  // logo path (e.g. small regional banks with no sourceable
                  // asset).
                  const resolved =
                    m.type === 'merchant' ? resolveMerchant(m.name)
                    : m.type === 'bank' ? resolveBank(m.name)
                    : m.type === 'partner' ? resolvePartner(m.name)
                    : null
                  const CategoryIcon = m.type === 'bank' ? Bank : m.type === 'partner' ? Handshake : Storefront
                  return (
                    <div
                      key={`${m.type}:${m.name}`}
                      style={{
                        ...styles.dropdownItem,
                        background:
                          i === highlightIdx ? 'rgba(62,79,224,0.12)' : 'transparent',
                      }}
                      onMouseEnter={() => setHighlightIdx(i)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setMerchant(m.name)
                        setShowDropdown(false)
                      }}
                    >
                      {resolved?.logo ? (
                        <img src={resolved.logo} alt="" style={styles.dropdownLogo} />
                      ) : (
                        <CategoryIcon size={22} weight="regular" style={styles.dropdownBankIcon} aria-hidden />
                      )}
                      <span style={styles.dropdownName}>{m.name}</span>
                      <span style={styles.dropdownTypeTag}>{m.tag || TYPE_LABEL[m.type]}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={styles.regionRow}>
          <span style={styles.regionLabel}>Presenting in</span>
          <div ref={regionRef} style={styles.regionPillWrap}>
            <button
              type="button"
              style={{
                ...styles.regionPill,
                ...(showRegionMenu ? styles.regionPillOpen : {}),
              }}
              onClick={() => setShowRegionMenu((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={showRegionMenu}
            >
              <Globe size={15} weight="regular" style={styles.regionPillGlobe} aria-hidden />
              <span>{regionPillLabel}</span>
              {regions.length > 0 && <span style={styles.pillCount}>{regions.length}</span>}
              <CaretDown
                size={12}
                weight="bold"
                style={{
                  opacity: 0.7,
                  transition: 'transform 0.18s ease',
                  transform: showRegionMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                aria-hidden
              />
            </button>

            {showRegionMenu && (
              <div
                role="listbox"
                aria-multiselectable="true"
                style={{
                  ...styles.regionMenu,
                  ...(regionPlacement === 'top'
                    ? { top: 'auto', bottom: 'calc(100% + 10px)' }
                    : {}),
                }}
              >
                {REGIONS.map((r) => {
                  const selected = regions.includes(r)
                  return (
                    <div
                      key={r}
                      role="option"
                      aria-selected={selected}
                      style={{
                        ...styles.regionMenuItem,
                        ...(selected ? styles.regionMenuItemActive : {}),
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        toggleRegion(r)
                      }}
                    >
                      <span style={styles.checkBox}>
                        {selected && <Check size={11} weight="bold" />}
                      </span>
                      <span style={{ flex: 1 }}>{REGION_LABEL[r]}</span>
                      <span style={styles.regionMenuItemKey}>{r}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {regions.length > 0 && (
            <div ref={countryRef} style={styles.regionPillWrap}>
              <button
                type="button"
                style={{
                  ...styles.regionPill,
                  ...(showCountryMenu ? styles.regionPillOpen : {}),
                }}
                onClick={() => setShowCountryMenu((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={showCountryMenu}
              >
                <MapPin size={15} weight="regular" style={styles.pinIcon} aria-hidden />
                <span>{countryPillLabel}</span>
                {countries.length > 0 && <span style={styles.pillCount}>{countries.length}</span>}
                <CaretDown
                  size={12}
                  weight="bold"
                  style={{
                    opacity: 0.7,
                    transition: 'transform 0.18s ease',
                    transform: showCountryMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                  aria-hidden
                />
              </button>

              {showCountryMenu && (
                <div
                  role="listbox"
                  aria-multiselectable="true"
                  style={{
                    ...styles.regionMenu,
                    ...styles.countryMenu,
                    ...(countryPlacement === 'top'
                      ? { top: 'auto', bottom: 'calc(100% + 10px)' }
                      : {}),
                  }}
                >
                  {availableCountries.map(({ country: c, region: r }) => {
                    const selected = countries.includes(c)
                    return (
                      <div
                        key={`${r}:${c}`}
                        role="option"
                        aria-selected={selected}
                        style={{
                          ...styles.regionMenuItem,
                          ...(selected ? styles.regionMenuItemActive : {}),
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          toggleCountry(c)
                        }}
                      >
                        <span style={styles.checkBox}>
                          {selected && <Check size={11} weight="bold" />}
                        </span>
                        <span style={{ flex: 1 }}>{c}</span>
                        <span style={styles.regionMenuItemKey}>{r}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!merchant.trim() || loading}
            style={{
              ...styles.submitButton,
              ...((!merchant.trim() || loading) ? styles.submitButtonDisabled : {}),
              marginLeft: 'auto',
              transform: hoveringBtn && merchant.trim() && !loading ? 'scale(1.03)' : 'scale(1)',
              boxShadow: hoveringBtn && merchant.trim() && !loading
                ? '0 8px 32px rgba(62,79,224,0.5), 0 0 0 1px rgba(255,255,255,0.2) inset'
                : merchant.trim() && !loading
                  ? '0 4px 20px rgba(62,79,224,0.3)'
                  : 'none',
            }}
            onMouseEnter={() => setHoveringBtn(true)}
            onMouseLeave={() => setHoveringBtn(false)}
          >
            {loading ? 'Loading…' : "Let's start →"}
          </button>
          </div>
          {(loading || errorMessage) && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: '12.5px',
                color: errorMessage ? '#FCA5A5' : 'rgba(255,255,255,0.6)',
                textAlign: 'center',
                marginTop: '4px',
                animation: 'fadeIn 0.25s ease-out',
              }}
            >
              {loading ? 'Fetching name and logo…' : errorMessage}
            </div>
          )}
        </form>
      </div>

      <div style={styles.bottom}>
        <span>{currentMonthYear()}</span>
      </div>
    </div>
  )
}

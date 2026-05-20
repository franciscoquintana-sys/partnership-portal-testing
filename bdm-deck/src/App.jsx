import { useState, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import SlideViewer from './components/SlideViewer'
import PrintViewer from './components/PrintViewer'
import defaultData from './data/_default.json'
import discordData from './data/discord.json'
import { BANKING_DATA } from './data/banking'
import { PARTNER_DATA } from './data/partners'
import { resolveMerchant, slugify } from './data/merchants.generated'
import { resolveBank } from './data/banks.generated'
import { resolvePartner } from './data/partners.generated'
import { fetchMerchantContent, toSlideData } from './lib/supabase'

// Static fallback for merchants curated before the Supabase ingest.
// Used only if Supabase is unreachable or has no row for the slug.
const RESEARCHED = {
  discord: discordData,
}

// Per-merchant cover greeting overrides. When a slug matches, the cover
// renders this exact string instead of the default "Hello {name} team!".
// Useful when JPO is meeting a specific contact and wants the greeting
// addressed by name. Keyed by slug for stable matching.
const GREETING_OVERRIDES = {
  mercari: 'Hi Takeshi',
}

// Slugs whose Diagnostic topology should render the small role subtitle
// (e.g. "Japan Â· acquirer") under each PSP name. The deck hides it by
// default because role labels were inconsistent across merchants;
// listed merchants opt back in when the role text is curated and
// adds context the audience needs.
const SHOW_PSP_ROLES_FOR = new Set([
  'mercari',
  'blackbaud',
  'replit',
])

// Reserved slug â†’ dedicated deck data (not stored in Supabase). Right
// now just "banking" for the Banking vertical pitch; the deck branches
// on MODE='banking' per slide.
const RESERVED_MODES = {
  banking: BANKING_DATA,
}

// Build the slide payload for a selection from the landing page. The
// `selection` argument is either a raw string (legacy / shared-link flow)
// or an object `{name, type, region}` where type is 'merchant' | 'bank' |
// 'partner' and region is one of the canonical REGIONS keys. Region
// threads through every branch as REGION so the final region-aware slide
// can pull the right country list.
async function buildMerchantData(selection, regionsOverride = null, countriesOverride = null) {
  const typed = typeof selection === 'string'
    ? selection.trim()
    : (selection?.name || '').trim()
  const type = typeof selection === 'object' ? selection?.type : null
  // Regions + countries arrive as arrays from the landing page (multi-select)
  // or as comma-separated query params on shared / print links. Overrides
  // (positional args) win so /m/:slug?regions=A,B works even when the slug
  // resolves through the partner / bank URL fallbacks.
  const regions = regionsOverride
    || (typeof selection === 'object' ? selection?.regions : null)
    || []
  const countries = countriesOverride
    || (typeof selection === 'object' ? selection?.countries : null)
    || []
  if (!typed) return null

  // --- Bank selection: reuse Banking deck but stamp the bank's name
  // as COMPANY_NAME so slides that surface it (Infrastructure center
  // logo, Diagnostic merchant node, Solve card) switch from the
  // generic "Banking" label to the specific bank. Pull a white logo
  // from the banks manifest when one exists; slides fall back to the
  // name text when the logo is null.
  if (type === 'bank') {
    const bank = resolveBank(typed)
    // Generic Banking selection (synthetic dropdown entry, no real bank
    // resolved) gets the "Your Bank" placeholder everywhere a bank logo
    // would normally sit, instead of stamping "Banking" as a name.
    // IS_GENERIC also unlocks the banking-only Market Context and Value
    // Levers slides that lead the deck â€” those are scoped to the
    // generic vertical pitch, not specific bank decks.
    const isGeneric = !bank
    return {
      ...BANKING_DATA,
      COMPANY_NAME: isGeneric ? 'Your Bank' : typed,
      COMPANY_LOGO: bank?.logo || null,
      COMPANY_LOGO_MONO: null,
      IS_GENERIC: isGeneric,
      REGIONS: regions, COUNTRIES: countries,
      INPUT_URL: typed,
    }
  }

  // --- Partner selection: reuse the Partners deck (same 8-slide shell
  // as Banking) and override COMPANY_NAME so slides that surface the
  // center node swap to the selected partner. Pull a white logo from
  // the partners manifest when one exists; slides fall back to text.
  if (type === 'partner') {
    const partner = resolvePartner(typed)
    return {
      ...PARTNER_DATA,
      COMPANY_NAME: typed,
      COMPANY_LOGO: partner?.logo || null,
      COMPANY_LOGO_MONO: null,
      REGIONS: regions, COUNTRIES: countries,
      INPUT_URL: typed,
    }
  }

  // Reserved vertical modes (banking) short-circuit: no Supabase lookup,
  // no merchant resolution, just return the hardcoded mode payload.
  const normalized = typed.toLowerCase()
  if (RESERVED_MODES[normalized]) return { ...RESERVED_MODES[normalized], REGIONS: regions, COUNTRIES: countries }

  // URL-flow partner fallback. The landing page passes type='partner'
  // explicitly when a partner is picked from the dropdown, but a
  // shared link like /m/adyen comes in as a bare string with no type.
  // If the slug matches a known partner AND isn't already a merchant
  // we ship the partner deck so the link works the same as the
  // dropdown selection. Merchants always win the tie because the
  // merchants table is curated and a slug-collision means the link
  // was meant for the merchant deck.
  const partnerByUrl = !resolveMerchant(typed) ? resolvePartner(typed) : null
  if (partnerByUrl) {
    return {
      ...PARTNER_DATA,
      COMPANY_NAME: partnerByUrl.name,
      COMPANY_LOGO: partnerByUrl.logo,
      COMPANY_LOGO_MONO: null,
      REGIONS: regions, COUNTRIES: countries,
      INPUT_URL: typed,
    }
  }

  // Fall back to slugifying the raw input so merchants that exist in Supabase
  // but not in merchants.generated.js (no logo, not in the CSV) still resolve.
  const match = resolveMerchant(typed)
  const slugKey = match?.slug || slugify(typed)

  let content = null
  let supabaseName = null
  if (slugKey) {
    const row = await fetchMerchantContent(slugKey)
    if (row) {
      content = toSlideData(row)
      supabaseName = row.name
    }
  }
  if (!content && slugKey && RESEARCHED[slugKey]) content = RESEARCHED[slugKey]
  if (!content) content = defaultData

  // URL input â€” when the typed string looks like a domain or URL, ask the
  // portal to scrape the live site for a name + PNG logo. Best-effort; on
  // network/parse failure we fall back to the domain-derived name so the
  // cover never shows the raw URL string in the greeting.
  let scrapedName = null
  let scrapedLogo = null
  let scrapedVertical = null
  let domainName = null
  const looksLikeUrl = /\.[a-z]{2,}(?:[/?#]|$)/i.test(typed.replace(/^https?:\/\//, ''))
  if (looksLikeUrl) {
    try {
      const host = new URL(typed.startsWith('http') ? typed : `https://${typed}`).hostname.replace(/^www\./, '')
      const first = host.split('.')[0]
      if (first) domainName = first.charAt(0).toUpperCase() + first.slice(1)
    } catch (_) { /* ignore */ }
    try {
      const r = await fetch(`/api/site-info?url=${encodeURIComponent(typed)}`)
      if (r.ok) {
        const j = await r.json()
        scrapedName = j?.name || null
        scrapedLogo = j?.logo || null
        scrapedVertical = j?.vertical || null
      }
    } catch (_) {
      // ignore â€” fall through to defaults
    }
  }

  return {
    ...content,
    COMPANY_NAME: scrapedName || domainName || match?.name || supabaseName || typed,
    COMPANY_LOGO: scrapedLogo || match?.logo || null,
    COMPANY_VERTICAL: scrapedVertical || 'general',
    // Tile-based marks (Bold One) carry a companion white-silhouette PNG
    // so filter:brightness(0) invert(1) diagrams don't flatten the tile
    // to a solid white square. For normal wordmark merchants this is null
    // and the diagrams fall back to COMPANY_LOGO as before.
    COMPANY_LOGO_MONO: match?.logoMono || null,
    COMPANY_GREETING: GREETING_OVERRIDES[slugKey] || null,
    COMPANY_SLUG: slugKey || null,
    SHOW_PSP_ROLES: SHOW_PSP_ROLES_FOR.has(slugKey),
    REGIONS: regions, COUNTRIES: countries,
    // Preserve the raw URL/name input so share links (Copy Link button)
    // can be built with the original "amazon.com" form rather than the
    // slugified "amazon" â€” without the TLD, /api/site-info can't scrape
    // the recipient's logo + name when they open the share link.
    INPUT_URL: typed,
  }
}

// Strip the Vite base path (e.g. "/connections-deck/") from the pathname so the
// /m/:slug routes match the same way whether the deck is mounted at root
// or vendored inside the partnerships portal.
function pathnameInsideBase(pathname) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  if (base === '/') return pathname
  return pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname
}

// Match /m/:slug - the merchant-facing shared link. Returns the slug or null.
function matchMerchantRoute(pathname) {
  const m = pathnameInsideBase(pathname).match(/^\/m\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

// Match /m/:slug/pdf â€” the PDF capture surface used by the server-side
// Playwright renderer. Same data resolution as /m/:slug, but renders all
// slides stacked at native 1920x1080 with no chrome and no animations.
function matchPrintRoute(pathname) {
  const m = pathnameInsideBase(pathname).match(/^\/m\/([^/]+)\/pdf\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const [merchantData, setMerchantData] = useState(null)
  const [sharedMode, setSharedMode] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  // Loading + error gate for the landing-page â†’ deck transition. The deck
  // only advances past the intro once both a name and a PNG logo have been
  // resolved for the typed URL; otherwise the user stays on the landing
  // page and sees the reason.
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState(null)

  // On first render, check the URL. `/m/:slug` â†’ go straight to the deck
  // without the landing page, and hide the internal "send deck" form.
  // `/m/:slug/pdf` â†’ render PrintViewer instead, and signal readiness to
  // the Playwright capturer via `window.__PDF_READY__`.
  useEffect(() => {
    const path = window.location.pathname
    const printSlug = matchPrintRoute(path)
    if (printSlug) {
      // Flag <html> for the print stylesheet â€” html/body/#root use
      // height:100% + overflow:hidden by default, which clips everything
      // past slide 1 and produces a single-page PDF. The CSS hook flips
      // those to height:auto + overflow:visible so the stacked slides
      // flow past the viewport for Chromium to paginate.
      document.documentElement.dataset.printMode = 'true'
      let cancelled = false
      // Regions + countries for shared / print links ride on
      // ?regions=A,B&countries=Brazil,Mexico. Both are comma-separated
      // arrays; either may be absent. SlideViewer skips the region-aware
      // slides when both lists are empty.
      const sharedParams = new URLSearchParams(window.location.search)
      const sharedRegions = (sharedParams.get('regions') || '').split(',').filter(Boolean)
      const sharedCountries = (sharedParams.get('countries') || '').split(',').filter(Boolean)
      buildMerchantData(printSlug, sharedRegions, sharedCountries).then((data) => {
        if (cancelled || !data) return
        setMerchantData(data)
        setPrintMode(true)
      })
      return () => { cancelled = true }
    }
    const slug = matchMerchantRoute(path)
    if (!slug) return
    let cancelled = false
    const sharedParams = new URLSearchParams(window.location.search)
    const sharedRegions = (sharedParams.get('regions') || '').split(',').filter(Boolean)
    const sharedCountries = (sharedParams.get('countries') || '').split(',').filter(Boolean)
    buildMerchantData(slug, sharedRegions, sharedCountries).then((data) => {
      if (cancelled || !data) return
      setMerchantData(data)
      setSharedMode(true)
    })
    return () => { cancelled = true }
  }, [])

  // Tell the Playwright capturer when the PDF surface has actually painted.
  // Two animation frames after data lands gives reveal/animate-in CSS one
  // tick to settle. Server then waits on this flag before calling page.pdf().
  useEffect(() => {
    if (!printMode || !merchantData) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__PDF_READY__ = true
    }))
  }, [printMode, merchantData])

  const handleGenerate = async (rawInput) => {
    setResolving(true)
    setResolveError(null)
    const data = await buildMerchantData(rawInput)
    setResolving(false)
    // Presenter-supplied logo overrides anything the SOT scrape returned,
    // and rescues the path where the scrape couldn't find a logo at all
    // (no auto-fetch needed because the presenter brought their own).
    const customLogo = typeof rawInput === 'object' ? rawInput?.customLogo : null
    if (data && data.COMPANY_NAME && (data.COMPANY_LOGO || customLogo)) {
      if (customLogo) data.COMPANY_LOGO = customLogo
      setMerchantData(data)
      return
    }
    if (data && data.COMPANY_NAME) {
      setResolveError(`Couldn't find a logo for ${data.COMPANY_NAME}. Try another URL or upload one.`)
    } else {
      setResolveError("Couldn't resolve that URL. Try another.")
    }
  }

  const handleBack = () => {
    if (sharedMode) return
    setMerchantData(null)
  }

  // Expose a function on the iframe's window so the parent portal page can
  // build a shareable link to the currently-generated deck. Returns null
  // when no deck has been generated yet.
  useEffect(() => {
    window.getDeckShareLink = () => {
      if (!merchantData) return null
      const slug = merchantData.INPUT_URL
        || merchantData.SLUG
        || merchantData.COMPANY_SLUG
        || (merchantData.COMPANY_NAME
          ? String(merchantData.COMPANY_NAME)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
          : null)
      if (!slug) return window.location.href
      const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
      const params = new URLSearchParams()
      if (Array.isArray(merchantData.REGIONS) && merchantData.REGIONS.length) {
        params.set('regions', merchantData.REGIONS.join(','))
      }
      if (Array.isArray(merchantData.COUNTRIES) && merchantData.COUNTRIES.length) {
        params.set('countries', merchantData.COUNTRIES.join(','))
      }
      const qs = params.toString()
      return `${window.location.origin}${base}m/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
    }
    return () => { try { delete window.getDeckShareLink } catch { /* noop */ } }
  }, [merchantData])

  if (merchantData && printMode) {
    return <PrintViewer data={merchantData} />
  }

  if (merchantData) {
    return (
      <SlideViewer
        data={merchantData}
        onBack={handleBack}
        shared={sharedMode}
      />
    )
  }

  return (
    <LandingPage
      onGenerate={handleGenerate}
      loading={resolving}
      errorMessage={resolveError}
    />
  )
}

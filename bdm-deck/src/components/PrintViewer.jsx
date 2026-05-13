import SlideCover from './slides/SlideCover'
import SlideMarketContext from './slides/SlideMarketContext'
import SlideOrchestrationEra from './slides/SlideOrchestrationEra'
import SlideWhatIsOrchestration from './slides/SlideWhatIsOrchestration'
import SlideWhyPlatformPartner from './slides/SlideWhyPlatformPartner'
import SlideBeyondOrchestration from './slides/SlideBeyondOrchestration'
import SlideValueLevers from './slides/SlideValueLevers'
import SlideWhiteLabelPromise from './slides/SlideWhiteLabelPromise'
import SlideInfrastructure from './slides/SlideInfrastructure'
import SlideDiagnostic from './slides/SlideDiagnostic'
import SlideYunoSolve from './slides/SlideYunoSolve'
import SlideReplitGoingGlobal from './slides/SlideReplitGoingGlobal'
import SlideReplitBenefits from './slides/SlideReplitBenefits'
import SlideDashboard from './slides/SlideDashboard'
import SlideProductSuite from './slides/SlideProductSuite'
import SlideGlobalPresence from './slides/SlideGlobalPresence'
import SlideLeadership from './slides/SlideLeadership'
import SlideTrustedBy from './slides/SlideTrustedBy'
import SlideRegionTierMap from './slides/SlideRegionTierMap'
import SlideRegionEcommerceMap from './slides/SlideRegionEcommerceMap'
import SlideRegionPMsMap from './slides/SlideRegionPMsMap'
import SlideCountryMarket from './slides/SlideCountryMarket'
import SlideCountryConnections from './slides/SlideCountryConnections'
import SlideCTA from './slides/SlideCTA'
import { getRegionCountries } from '../data/regional-data'
import OrbBackground from './OrbBackground'
import { ThemeProvider, useTheme, THEMES } from '../lib/theme'

const LIGHT_THEME_SLUGS = new Set(['replit'])

// Mirrors SlideViewer's slide list / mode filtering so the PDF capture
// produces the exact same deck the audience sees on screen, just stacked.
const ALL_SLIDES = [
  { Component: SlideCover, slug: 'cover', atmospheric: true },
  { Component: SlideMarketContext, slug: 'market-context', onlyForGenericBanking: true },
  { Component: SlideOrchestrationEra, slug: 'orchestration-era', onlyForGenericBanking: true },
  { Component: SlideWhatIsOrchestration, slug: 'what-is-orchestration', onlyForGenericBanking: true },
  { Component: SlideWhyPlatformPartner, slug: 'why-platform-partner', onlyForGenericBanking: true },
  { Component: SlideBeyondOrchestration, slug: 'beyond-orchestration', onlyForGenericBanking: true },
  { Component: SlideValueLevers, slug: 'value-levers', onlyForGenericBanking: true },
  { Component: SlideWhiteLabelPromise, slug: 'white-label-promise', onlyForGenericBanking: true },
  { Component: SlideInfrastructure, slug: 'infrastructure' },
  { Component: SlideDiagnostic, slug: 'diagnostic', skipForModes: ['partner', 'banking'] },
  { Component: SlideYunoSolve, slug: 'yuno-solve', skipForModes: ['banking'] },
  { Component: SlideReplitGoingGlobal, slug: 'replit-going-global', onlyForSlugs: ['replit'] },
  { Component: SlideReplitBenefits, slug: 'replit-benefits', onlyForSlugs: ['replit'] },
  { Component: SlideProductSuite, slug: 'product-suite' },
  { Component: SlideDashboard, slug: 'dashboard' },
  { Component: SlideGlobalPresence, slug: 'global-presence' },
  { Component: SlideLeadership, slug: 'leadership' },
  { Component: SlideTrustedBy, slug: 'trusted-by' },
  { Component: SlideCTA, slug: 'cta' },
]

function slugifyCountry(c) {
  return c.toLowerCase().replace(/\s+/g, '-')
}

function buildRegionalBlock(regions, countries) {
  if (!regions?.length) return []
  const out = []
  for (const region of regions) {
    const r = region.toLowerCase()
    out.push({ Component: SlideRegionTierMap, slug: `region-${r}-tier`, props: { region } })
    out.push({ Component: SlideRegionEcommerceMap, slug: `region-${r}-ecommerce`, props: { region } })
    out.push({ Component: SlideRegionPMsMap, slug: `region-${r}-pms`, props: { region } })
    const regionCountryList = getRegionCountries(region)
    const coveredSet = new Set(
      regionCountryList.filter((c) => c.processors?.length > 0).map((c) => c.country),
    )
    for (const country of countries || []) {
      if (!coveredSet.has(country)) continue
      out.push({
        Component: SlideCountryMarket,
        slug: `country-${slugifyCountry(country)}-brief`,
        props: { region, country },
      })
      out.push({
        Component: SlideCountryConnections,
        slug: `country-${slugifyCountry(country)}-coverage`,
        props: { region, country },
      })
    }
  }
  return out
}

function buildSlides(mode, { isGenericBanking = false, slug = null, regions = [], countries = [] } = {}) {
  const filtered = ALL_SLIDES.filter((s) => {
    if (s.skipForModes?.includes(mode)) return false
    if (s.onlyForModes && !s.onlyForModes.includes(mode)) return false
    if (s.onlyForGenericBanking && !isGenericBanking) return false
    if (s.onlyForSlugs && !s.onlyForSlugs.includes(slug)) return false
    return true
  })
  const gpIdx = filtered.findIndex((s) => s.Component === SlideGlobalPresence)
  if (gpIdx !== -1) {
    const block = buildRegionalBlock(regions, countries)
    if (block.length > 0) {
      filtered.splice(gpIdx + 1, 0, ...block)
    }
  }
  // Mirror SlideViewer: on Replit, Going Global lands before The Solve
  // so the PDF export matches the live deck's storyline order.
  if (slug === 'replit') {
    const i = filtered.findIndex((s) => s.Component === SlideYunoSolve)
    const j = filtered.findIndex((s) => s.Component === SlideReplitGoingGlobal)
    if (i !== -1 && j !== -1) {
      const swapped = filtered.slice()
      ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
      return swapped
    }
  }
  return filtered
}

// PDF capture surface. Each slide renders in its own 1920x1080 stage,
// stacked vertically and pinned to native size so Chromium's pageless
// PDF (driven by @page in print.css) produces one page per slide with
// pixel-identical output to the live viewer.
export default function PrintViewer({ data }) {
  const themeName = LIGHT_THEME_SLUGS.has(data?.COMPANY_SLUG) ? 'light' : 'dark'
  const theme = THEMES[themeName]
  const SLIDES = buildSlides(data?.MODE, {
    isGenericBanking: data?.MODE === 'banking' && data?.IS_GENERIC === true,
    slug: data?.COMPANY_SLUG,
    regions: data?.REGIONS,
    countries: data?.COUNTRIES,
  })

  const total = SLIDES.length
  return (
    <ThemeProvider theme={themeName}>
      <div data-pdf-root style={{ background: theme.bg }}>
        {SLIDES.map(({ Component, slug, atmospheric, props: slideProps }, i) => (
          <div
            key={i}
            className="pdf-page"
            data-slide={slug}
            style={{
              width: '1920px',
              height: '1080px',
              position: 'relative',
              overflow: 'hidden',
              background: theme.bgStage,
              pageBreakAfter: 'always',
              breakAfter: 'page',
            }}
          >
            {atmospheric && theme.orbVisible && <OrbBackground />}
            <Component data={data} shared {...(slideProps || {})} />
            {/* See SlideViewer for the rationale; mirrored here so the
                PDF export carries the same Replit-only auto numbering. */}
            {theme.isLight && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'clamp(18px, 2.4%, 40px)',
                  left: 'clamp(36px, 4.8%, 90px)',
                  fontSize: 'clamp(10px, 0.72vw, 12px)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '1.5px',
                  color: theme.inkFaint,
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              >
                {String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </div>
            )}
          </div>
        ))}
      </div>
    </ThemeProvider>
  )
}

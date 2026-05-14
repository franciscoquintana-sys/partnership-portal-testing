// Cover slide. The globe composition is now assembled inside GlobeHalo so
// the central glow, orbital rings, and pulse dots are perfectly centered on
// the globe (was drifting in the old planet1-based design). Ambient
// particles drift across the whole cover for atmospheric depth.
import { useEffect, useState } from 'react'
import { GlobeHalo, CoverParticles } from './CoverFX'
import { useTheme } from '../../lib/theme'

function currentMonthYear() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Run a fetched logo through a canvas to alpha-key its dominant
// background color so flat PNG/JPG logos read as transparent on the
// dark cover. Skip for SVG/data URLs (already vector) and for
// cross-origin sources that block canvas reads (CORS taint). Falls
// back to the original src on any failure.
function TransparentLogo({ src, alt, style, fallbackFilter }) {
  const [processed, setProcessed] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src) return
    const lower = src.toLowerCase().split('?')[0]
    // Vector / inline images already support transparency.
    if (lower.endsWith('.svg') || src.startsWith('data:')) {
      setProcessed(src)
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        if (!w || !h) { setProcessed(src); return }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const imgData = ctx.getImageData(0, 0, w, h) // throws on CORS taint
        const data = imgData.data
        // Sample 4 corners. If they cluster around a single color (low
        // variance) and that color is near-white or near-black, treat
        // it as the bg and key it out with tolerance.
        const samples = [
          [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
        ].map(([x, y]) => {
          const i = (y * w + x) * 4
          return [data[i], data[i + 1], data[i + 2], data[i + 3]]
        })
        const same = (a, b) =>
          Math.abs(a[0] - b[0]) < 16
          && Math.abs(a[1] - b[1]) < 16
          && Math.abs(a[2] - b[2]) < 16
        const allClustered = samples.every((s) => same(s, samples[0]))
        const [r0, g0, b0, a0] = samples[0]
        const isFlatLight = r0 > 235 && g0 > 235 && b0 > 235
        const isFlatDark = r0 < 20 && g0 < 20 && b0 < 20
        const shouldKey = allClustered && a0 > 200 && (isFlatLight || isFlatDark)
        if (shouldKey) {
          const tol = 24
          for (let i = 0; i < data.length; i += 4) {
            if (
              Math.abs(data[i] - r0) < tol
              && Math.abs(data[i + 1] - g0) < tol
              && Math.abs(data[i + 2] - b0) < tol
            ) {
              data[i + 3] = 0
            }
          }
          ctx.putImageData(imgData, 0, 0)
          setProcessed(canvas.toDataURL('image/png'))
        } else {
          // Already transparent or non-uniform — use as-is.
          setProcessed(src)
        }
      } catch (e) {
        // CORS taint — can't read pixels. Fall back to raw img.
        setFailed(true)
      }
    }
    img.onerror = () => { if (!cancelled) setFailed(true) }
    img.src = src
    return () => { cancelled = true }
  }, [src])

  const finalSrc = failed ? src : (processed || src)
  return (
    <img
      src={finalSrc}
      alt={alt}
      style={{
        ...style,
        ...(failed && fallbackFilter ? { filter: fallbackFilter } : {}),
      }}
    />
  )
}

// Merchant logos whose asset is dark/colored and disappears on the cover's
// black background. Forced to white via brightness(0)+invert(1) so they
// read as clearly as the rest. Matched case-insensitively by COMPANY_NAME
// so a rename elsewhere in the data doesn't silently break the mapping.
const DARK_LOGO_MERCHANTS = new Set([
  'hostinger',
  'united airlines',
  'wayfair',
])
const WHITE_LOGO_FILTER = 'brightness(0) invert(1)'

export default function SlideCover({ data }) {
  const theme = useTheme()
  const isLight = theme.isLight

  const styles = {
    slide: {
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font)',
      background: theme.bg,
    },
    // The globe asset is a white wireframe on transparent, designed
    // for the dark canvas with `screen` blending. On dark we render
    // it as an <img> with the original setup. On light, the image's
    // bright pixels would either disappear or hue-rotate into magenta,
    // so we instead use the asset as a CSS mask over a solid Yuno-blue
    // div. That gives a clean, exact `theme.accent` tint without any
    // filter approximation.
    globeDecor: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      opacity: 0.58,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
      objectFit: 'contain',
      zIndex: 2,
    },
    globeMask: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: theme.accent,
      WebkitMaskImage: 'url(/assets/embellishments/globe.png)',
      maskImage: 'url(/assets/embellishments/globe.png)',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      opacity: 0.55,
      pointerEvents: 'none',
      zIndex: 2,
    },
    wordmarkWatermark: {
      position: 'absolute',
      right: '-20px',
      bottom: '89.5px',
      width: '435px',
      height: 'auto',
      opacity: 0.06,
      pointerEvents: 'none',
      userSelect: 'none',
    },
    content: {
      position: 'relative',
      zIndex: 5,
      width: '100%',
      height: '100%',
      padding: 'clamp(32px, 4%, 72px) clamp(40px, 5%, 96px) clamp(44px, 5%, 80px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    topRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '15.5px',
      lineHeight: 1,
    },
    yunoLogo: {
      // The cover sits on top of the GlobeHalo's outerGlow (a wide
      // rgba(62,79,224,0.28) blur that reaches across the canvas), so
      // a 0.92-opacity logo reads as a faint blue-tinted shape. Lock
      // the cover wordmark to opacity 1 + brightness(0) on light so it
      // lands as solid black, regardless of the ambient glow tint.
      height: '38.5px',
      display: 'block',
      opacity: isLight ? 1 : theme.logoOpacity,
      filter: isLight ? 'brightness(0)' : theme.logoFilter,
    },
    topCluster: {
      display: 'flex',
      flexDirection: 'column',
      gap: '59px',
    },
    greetingBlock: {
      display: 'flex',
      flexDirection: 'column',
    },
    middle: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      maxWidth: '82%',
      gap: '30.5px',
    },
    greeting: {
      fontFamily: 'var(--font-display)',
      fontSize: '51px',
      fontWeight: 700,
      letterSpacing: '-0.6px',
      lineHeight: 1.05,
      color: isLight ? theme.accentDeep : 'rgba(189,195,246,0.95)',
      margin: 0,
      marginBottom: '25.5px',
    },
    merchantLogoWrapper: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
    },
    merchantLogo: {
      height: '89.5px',
      maxWidth: '358.5px',
      objectFit: 'contain',
      display: 'block',
    },
    merchantLogoText: {
      fontFamily: 'var(--font-display)',
      fontSize: '70.5px',
      fontWeight: 700,
      color: theme.ink,
      letterSpacing: '-1.2px',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '83px',
      fontWeight: 400,
      letterSpacing: '-2px',
      lineHeight: 1.02,
      color: isLight ? theme.ink : '#fff',
      margin: 0,
      maxWidth: '70%',
    },
    titleStrong: {
      fontWeight: 700,
      backgroundImage: isLight
        ? `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accent} 100%)`
        : 'linear-gradient(135deg, #5967E4 0%, #BDC3F6 55%, #3E4FE0 100%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    },
    subtitle: {
      fontSize: '22px',
      fontWeight: 400,
      lineHeight: 1.55,
      color: theme.inkSecondary,
      maxWidth: '820px',
      margin: 0,
    },
    companyNameInline: {
      color: theme.ink,
      fontWeight: 600,
    },
    bottom: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    location: {
      fontFamily: 'var(--font-mono)',
      fontSize: '20.5px',
      fontWeight: 600,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    confidential: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 500,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkFaint,
    },
  }

  // Light cover skips the white particle field (invisible on white) and
  // the heavy radial glows (designed to bloom against black). The globe
  // image stays so the cover still has a focal motif, just dimmer.
  return (
    <div style={styles.slide}>
      {!isLight && <CoverParticles />}
      <GlobeHalo>
        {isLight ? (
          <div style={styles.globeMask} aria-hidden />
        ) : (
          <img src="/sales-deck/assets/embellishments/globe.png" alt="" style={styles.globeDecor} aria-hidden />
        )}
      </GlobeHalo>

      <div className="slide-enter" style={styles.content}>
        <div style={styles.topCluster}>
          <div style={styles.topRow}>
            <img src="/sales-deck/assets/yuno-logo-white.svg" alt="Yuno" style={styles.yunoLogo} />
          </div>

          <div className="stagger" style={{ ...styles.greetingBlock, '--stagger-base': '0.12s', '--stagger-step': '0.15s' }}>
            {data.MODE === 'banking' && data.COMPANY_NAME === 'Your Bank' ? (
              <p style={styles.greeting}>Built for your bank</p>
            ) : (
              <>
                <p style={styles.greeting}>
                  {data.COMPANY_GREETING || `Hello ${data.COMPANY_NAME} team!`}
                </p>
                <div style={styles.merchantLogoWrapper}>
                  {data.COMPANY_LOGO ? (
                    isLight ? (
                      // Merchant logo assets in /public/merchants are
                      // mostly white-on-transparent (built for the dark
                      // canvas). On light they vanish into the surface.
                      // Render as a div masked by the logo image, filled
                      // with theme.accent — clean Yuno-blue silhouette
                      // regardless of the source asset's color.
                      <div
                        role="img"
                        aria-label={data.COMPANY_NAME}
                        style={{
                          ...styles.merchantLogo,
                          // The div has no intrinsic dimensions like
                          // an <img> would, so without an explicit
                          // width it collapses to 0 and the mask has
                          // nothing to render. Pin it to the same
                          // clamp the merchantLogo maxWidth uses; the
                          // mask scales to contain inside that box.
                          width: '286.5px',
                          backgroundColor: theme.accent,
                          WebkitMaskImage: `url(${data.COMPANY_LOGO})`,
                          maskImage: `url(${data.COMPANY_LOGO})`,
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                          WebkitMaskSize: 'contain',
                          maskSize: 'contain',
                          WebkitMaskPosition: 'left center',
                          maskPosition: 'left center',
                        }}
                      />
                    ) : (
                      <TransparentLogo
                        src={data.COMPANY_LOGO}
                        alt={data.COMPANY_NAME}
                        style={{
                          ...styles.merchantLogo,
                          ...(DARK_LOGO_MERCHANTS.has((data.COMPANY_NAME || '').toLowerCase())
                            ? { filter: WHITE_LOGO_FILTER }
                            : {}),
                        }}
                        fallbackFilter={
                          DARK_LOGO_MERCHANTS.has((data.COMPANY_NAME || '').toLowerCase())
                            ? WHITE_LOGO_FILTER
                            : null
                        }
                      />
                    )
                  ) : (
                    <span style={styles.merchantLogoText}>{data.COMPANY_NAME}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="stagger" style={{ ...styles.middle, '--stagger-base': '0.42s', '--stagger-step': '0.15s' }}>
          <h1 style={styles.title}>
            Powering financial infrastructure{' '}
            <span style={styles.titleStrong}>at global scale</span>
          </h1>

          {data.MODE === 'banking' ? (
            <p style={styles.subtitle}>
              The orchestration layer your merchants run on, white-labeled under your brand,
              across every market, method, and moment
            </p>
          ) : data.MODE === 'partner' ? (
            <p style={styles.subtitle}>
              One integration to reach{' '}
              <span style={styles.titleStrong}>2,000+ enterprise merchants</span>{' '}
              across every market, method, and moment
            </p>
          ) : (
            <p style={styles.subtitle}>
              How Yuno unifies payments for{' '}
              <span style={styles.companyNameInline}>{data.COMPANY_NAME}</span>{' '}
              across every market, method, and moment
            </p>
          )}
        </div>

        <div style={styles.bottom}>
          {!isLight && (
            <span style={styles.location}>{currentMonthYear()}</span>
          )}
          <span style={styles.confidential}>Strictly Confidential</span>
        </div>
      </div>
    </div>
  )
}

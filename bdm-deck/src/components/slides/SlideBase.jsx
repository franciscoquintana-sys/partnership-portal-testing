import { createContext, useContext } from 'react'
import { useTheme } from '../../lib/theme'

// Lets SlideViewer pipe the dynamic current/total slide index into every
// slide via context, so SlideBase can render the slide tag next to the
// section pill without touching every individual slide component.
export const SlideMetaContext = createContext(null)

// Per-slide chrome shared by every deck slide: section pill (top-left),
// Yuno wordmark (top-right), inner padding, optional slide number.
//
// Reads the active theme from context. Replit decks ship with theme
// 'light' (Nova-style white surface, dark ink, blue accents); every
// other merchant deck stays on the original dark canvas. The wordmark
// is a single-color white SVG, so on light the rendered img gets
// `filter: brightness(0)` to read as black without needing a
// duplicate asset.

export default function SlideBase({ section, slideNumber, children, customBg, theme: themeOverride }) {
  const theme = useTheme()
  // `theme` prop still supported for explicit override (legacy callers).
  const isLight = themeOverride === 'light' || (!themeOverride && theme.isLight)
  // Read the dynamic slide index injected by SlideViewer; rendered next
  // to the section pill so the deck always shows "X / TOTAL" at a glance.
  // `null` (e.g. on the Country Detail map) suppresses the tag entirely.
  const meta = useContext(SlideMetaContext)

  const styles = {
    slide: {
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font)',
      background: isLight ? theme.bg : 'transparent',
      color: theme.ink,
    },
    content: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      height: '100%',
      padding: 'clamp(28px, 3.6%, 64px) clamp(36px, 4.8%, 90px) clamp(56px, 6.2%, 92px)',
      display: 'flex',
      flexDirection: 'column',
    },
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 'clamp(20px, 2.4%, 44px)',
    },
    sectionLabel: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '14px',
      padding: '12px 24px',
      background: isLight ? theme.surface0 : 'var(--surface-0)',
      border: `1px solid ${isLight ? theme.borderSubtle : 'var(--border-subtle)'}`,
      borderRadius: '100px',
      fontSize: '16px',
      fontWeight: 700,
      letterSpacing: '1.8px',
      textTransform: 'uppercase',
      color: isLight ? theme.inkMuted : 'var(--text-muted)',
      backdropFilter: 'blur(12px)',
    },
    sectionDot: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: theme.accent,
    },
    yunoLogo: {
      height: '30.5px',
      opacity: theme.logoOpacity,
      filter: theme.logoFilter,
    },
    slideNumber: {
      position: 'absolute',
      bottom: 'clamp(18px, 2.4%, 40px)',
      left: 'clamp(36px, 4.8%, 90px)',
      fontSize: '10px',
      fontWeight: 700,
      color: theme.inkFaint,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '1.5px',
    },
  }

  const slideStyle = {
    ...styles.slide,
    ...(customBg ? { background: customBg } : {}),
  }

  return (
    <div style={slideStyle}>
      <div className="slide-enter" style={styles.content}>
        <div style={styles.topBar}>
          <span style={styles.sectionLabel}>
            <span style={styles.sectionDot} />
            {section}
          </span>
          <img src="/connections-deck/assets/yuno-logo-white.svg" alt="Yuno" style={styles.yunoLogo} />
        </div>
        {children}
      </div>
      {/* Dynamic current/total tag, fed from SlideViewer via context.
          Pinned bottom-left of the stage so every slide shows it in the
          same place. Suppressed when the context value is null. */}
      {meta && (
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(18px, 2.4%, 40px)',
            left: 'clamp(36px, 4.8%, 90px)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: isLight ? theme.inkMuted : 'rgba(255,255,255,0.55)',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          {meta.index + 1} / {meta.total}
        </div>
      )}
    </div>
  )
}

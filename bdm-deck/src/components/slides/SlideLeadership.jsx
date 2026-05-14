import SlideBase from './SlideBase'
import BeamRule from '../BeamRule'
import { useTheme } from '../../lib/theme'
import { FOUNDERS, LEADERS, PEDIGREE_LOGOS, LOGO_SCALES, LOGO_BASELINE_NUDGE } from './SlideLeadership.data'

const LAVENDER_BASE =
  'linear-gradient(90deg, rgba(189,195,246,0.22) 0%, rgba(189,195,246,0) 100%)'

function SectionHeader({ children, beamDelay = 0, styles }) {
  return (
    <div style={styles.sectionHeader}>
      <span style={styles.sectionDot} />
      <span style={styles.sectionLabel}>{children}</span>
      <BeamRule base={LAVENDER_BASE} delay={beamDelay} />
    </div>
  )
}

function PersonCard({ p, founder, style, styles }) {
  // Leadership team now visually matches founders — same big photo and the
  // blue gradient ring — only the name layout (single line for founders,
  // two lines for the team) differs between the two sections.
  const photoStyle = { ...styles.photo, ...styles.photoFounder }
  // Leadership-team cards split the name across two lines (first name on
  // top, the rest on a second line) so the grid stays uniform regardless
  // of how long someone's surname is. Founders keep a single line so the
  // bigger photos stay paired with full inline names.
  const renderName = () => {
    if (founder) return <div style={styles.name}>{p.name}</div>
    const trimmed = (p.name || '').trim()
    const idx = trimmed.indexOf(' ')
    const first = idx === -1 ? trimmed : trimmed.slice(0, idx)
    const rest = idx === -1 ? '' : trimmed.slice(idx + 1)
    return (
      <div style={styles.name}>
        <div>{first}</div>
        {rest ? <div>{rest}</div> : null}
      </div>
    )
  }
  return (
    <div style={{ ...styles.card, ...style }}>
      <div style={styles.photoWrap}>
        <img src={p.photo} alt={p.name} style={photoStyle} />
        <span data-mask-ring style={styles.photoRing} aria-hidden />
      </div>
      <div style={styles.meta}>
        {renderName()}
        <div style={styles.role}>{p.role}</div>
        {founder && p.pedigreeLabel ? (
          <div style={styles.pedigreeLabel}>{p.pedigreeLabel}</div>
        ) : null}
      </div>
    </div>
  )
}

function StripLogo({ name, styles }) {
  const scale = LOGO_SCALES[name] ?? 1
  const h = `clamp(${24 * scale}px, ${2.3 * scale}vw, ${40 * scale}px)`
  // Wide wordmarks hit the maxWidth cap before reaching natural height —
  // they need a relaxed cap so they read at the same optical size as
  // the others. Worldline's canvas is 9.85:1 (very flat), so it sits in
  // the extra-wide tier with an even higher cap.
  const WIDE = new Set(['checkout'])
  const EXTRA_WIDE = new Set(['worldline'])
  const nudge = LOGO_BASELINE_NUDGE[name] ?? 0
  let maxWidth = '133px'
  if (EXTRA_WIDE.has(name)) maxWidth = '256px'
  else if (WIDE.has(name)) maxWidth = '189.5px'
  return (
    <img
      className="pedigree-logo"
      src={`/sales-deck/company-logos/${name}.png`}
      alt={name}
      style={{
        ...styles.stripLogo,
        height: h,
        maxWidth,
        // marginTop (not transform) so the per-logo nudge doesn't clash
        // with the .pedigree-logo:hover transform defined in index.css.
        ...(nudge ? { marginTop: `${nudge}px` } : {}),
      }}
    />
  )
}

export default function SlideLeadership({ data }) {
  const isBanking = data?.MODE === 'banking'
  const theme = useTheme()

  const styles = {
    // ---------- Title block ----------
    titleBlock: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: '38.5px',
      marginBottom: '46px',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '48.5px',
      fontWeight: 500,
      letterSpacing: '-1.2px',
      lineHeight: 1.1,
      color: theme.ink,
      margin: 0,
      maxWidth: '72%',
    },
    titleAccent: {
      backgroundImage: theme.isLight
        ? `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accent} 100%)`
        : 'linear-gradient(110deg, #3E4FE0 0%, #5967E4 30%, #BDC3F6 68%, #E8EAF5 100%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    },
    tagline: {
      fontSize: '13.5px',
      lineHeight: 1.55,
      color: theme.inkSecondary,
      maxWidth: '34%',
      textAlign: 'right',
      fontWeight: 400,
    },
    taglineEmph: {
      color: theme.inkStrong,
      fontWeight: 700,
    },

    // ---------- Body ----------
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      // Flow Founders → Leadership Team → "We've been there" naturally
      // from the top with a compact gap, so the pedigree strip sits in
      // the upper-middle of the slide instead of being pinned to the
      // bottom where its second logo row gets clipped.
      justifyContent: 'flex-start',
      gap: '48px',
      minHeight: 0,
    },

    // ---------- Section header ----------
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '13px',
    },
    sectionDot: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentPale} 100%)`,
      boxShadow: '0 0 6px rgba(62,79,224,0.6)',
      flexShrink: 0,
    },
    sectionLabel: {
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '1.8px',
      textTransform: 'uppercase',
      color: theme.isLight ? theme.accentDeep : 'rgba(189,195,246,0.92)',
    },
    sectionRule: {
      flex: 1,
      height: '1px',
      background: 'linear-gradient(90deg, rgba(189,195,246,0.22) 0%, rgba(189,195,246,0) 100%)',
    },

    // ---------- Founders row ----------
    // Uses the same 14-column track as the leadership grid below, with
    // each founder spanning 2 columns. That lines founder #1 up with
    // leadership card #1, and founder #2 up with leadership card #2.
    foundersRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(14, 1fr)',
      gap: '30.5px 23px',
    },

    // ---------- Leadership grid ----------
    // 14 virtual columns, each card spans 2. 13 leaders ⇒ row 1 has 7 cards
    // (cols 1–14, fills the row), row 2 has 6 cards shifted to start at col 2
    // (cols 2–13) leaving col 1 + col 14 as half-column gutters — the shorter
    // row stays visually centered without changing per-card width.
    leadersGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(14, 1fr)',
      gap: '30.5px 23px',
    },
    // Each person card spans 2 columns of the 14-col track.
    cardSpan: {
      gridColumn: 'span 2',
      minWidth: 0,
    },
    // 8th card (first of row 2) explicitly starts at col 2 and spans 2.
    // Using the shorthand with both start + span because a standalone
    // gridColumnStart was overriding the span from cardSpan and collapsing
    // this card to 1 col (causing "Juan Manuel Rebull" to clip).
    secondRowStart: {
      gridColumn: '2 / span 2',
    },

    // ---------- Person card ----------
    card: {
      display: 'flex',
      gap: '14px',
      alignItems: 'flex-start',
      minWidth: 0,
    },
    photoWrap: {
      position: 'relative',
      flexShrink: 0,
    },
    photo: {
      width: '96px',
      height: '96px',
      borderRadius: '50%',
      objectFit: 'cover',
      background: theme.surface1,
      display: 'block',
    },
    photoFounder: {
      width: '120px',
      height: '120px',
    },
    photoRing: {
      position: 'absolute',
      inset: '-3px',
      borderRadius: '50%',
      padding: '2px',
      background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentMid} 55%, ${theme.accentPale} 100%)`,
      WebkitMask:
        'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      pointerEvents: 'none',
    },
    photoRingSubtle: {
      position: 'absolute',
      inset: '-1px',
      borderRadius: '50%',
      border: `1px solid ${theme.borderSubtle}`,
      pointerEvents: 'none',
    },
    meta: {
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      minWidth: 0,
      paddingTop: '2px',
      flex: 1,
    },
    name: {
      fontSize: '14.5px',
      fontWeight: 700,
      color: theme.ink,
      lineHeight: 1.2,
      letterSpacing: '0px',
      wordBreak: 'normal',
      hyphens: 'none',
    },
    role: {
      fontSize: '12px',
      fontWeight: 400,
      color: theme.inkSecondary,
      lineHeight: 1.4,
    },
    pedigreeLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: theme.isLight ? theme.accentDeep : 'rgba(189,195,246,0.82)',
      lineHeight: 1.4,
      marginTop: '3px',
      letterSpacing: '0.2px',
    },

    // ---------- Pedigree strip (bottom) ----------
    // marginTop:auto pushes the strip to the bottom of the flex-column body
    // when there's vertical slack (fullscreen / presentation mode), and
    // collapses to 0 when content is already tight (windowed). That keeps
    // the windowed view from overflowing while filling the tall-viewport gap.
    pedigreeStrip: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15.5px',
      padding: '27px 30.5px',
      background: theme.isLight
        ? theme.bgElevated
        : 'linear-gradient(180deg, rgba(62,79,224,0.05) 0%, rgba(62,79,224,0.02) 100%)',
      border: `1px solid ${theme.isLight ? theme.borderDefault : 'rgba(62,79,224,0.12)'}`,
      borderRadius: '14px',
      // No marginTop:auto / translateY anymore — the body now flows
      // top-down with flex-start, so the pedigree strip naturally lands
      // right after Leadership Team and stays within the slide bounds.
      boxShadow: theme.cardShadow,
    },
    pedigreeStripHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '11.5px',
    },
    pedigreeStripLabel: {
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.isLight ? theme.accentDeep : 'rgba(189,195,246,0.82)',
    },
    // Small Yuno dot-grid mark as a decorative accent next to the
    // "We've been there" label. Subtle brand signature on the pedigree row.
    pedigreeMark: {
      width: '16.5px',
      height: '16.5px',
      opacity: theme.isLight ? 0.85 : 0.55,
      pointerEvents: 'none',
      userSelect: 'none',
      flexShrink: 0,
      filter: theme.isLight ? 'brightness(0)' : 'none',
    },
    pedigreeStripLogos: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16.5px',
    },
    pedigreeStripLogosRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '15.5px',
      flexWrap: 'nowrap',
    },
    stripLogo: {
      objectFit: 'contain',
      opacity: theme.isLight ? 0.88 : 0.78,
      // Pedigree logos arrive as black-on-transparent (or white-on-transparent)
      // PNGs; force them to a single tone matched to the surface — white on
      // dark, black on light — so the row reads as a unified silhouette set.
      filter: theme.invertLogos ? 'brightness(0) invert(1)' : 'brightness(0)',
      flex: '0 1 auto',
      minWidth: 0,
      transition:
        'opacity 280ms cubic-bezier(0.16, 1, 0.3, 1),' +
        'transform 320ms cubic-bezier(0.16, 1, 0.3, 1),' +
        'filter 280ms cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'default',
      willChange: 'transform, opacity',
    },
  }

  return (
    <SlideBase section="About Yuno" slideNumber={7}>
      <div className="reveal" style={{ ...styles.titleBlock, '--reveal-delay': '0.05s' }}>
        <h2 style={styles.title}>
          {isBanking ? (
            <>
              Operators who&rsquo;ve scaled payments at global brands,{' '}
              <span style={styles.titleAccent}>now building under yours</span>
            </>
          ) : (
            <>
              World-class, <span style={styles.titleAccent}>merchant-first team</span> built by global payment operators
            </>
          )}
        </h2>
      </div>

      <div style={styles.body}>
        <section className="reveal" style={{ '--reveal-delay': '0.2s' }}>
          <SectionHeader beamDelay={0} styles={styles}>Founders</SectionHeader>
          <div className="stagger" style={{ ...styles.foundersRow, '--stagger-base': '0.3s', '--stagger-step': '0.1s' }}>
            {FOUNDERS.map((p) => (
              <PersonCard key={p.name} p={p} founder styles={styles} style={styles.cardSpan} />
            ))}
          </div>
        </section>

        <section className="reveal" style={{ '--reveal-delay': '0.45s' }}>
          <SectionHeader beamDelay={4.5} styles={styles}>Leadership Team</SectionHeader>
          <div className="stagger" style={{ ...styles.leadersGrid, '--stagger-base': '0.55s', '--stagger-step': '0.04s' }}>
            {LEADERS.map((p, i) => (
              <PersonCard
                key={p.name}
                p={p}
                styles={styles}
                style={{
                  ...styles.cardSpan,
                  ...(i === 7 ? styles.secondRowStart : {}),
                }}
              />
            ))}
          </div>
        </section>

        <div className="reveal" style={{ ...styles.pedigreeStrip, '--reveal-delay': '1.1s' }}>
          <div style={styles.pedigreeStripHeader}>
            <img src="/sales-deck/assets/yuno-mark-white.svg" alt="" style={styles.pedigreeMark} aria-hidden />
            <div style={styles.pedigreeStripLabel}>We&rsquo;ve been there.</div>
          </div>
          <div style={styles.pedigreeStripLogos}>
            <div className="pedigree-logos-row" style={styles.pedigreeStripLogosRow}>
              {PEDIGREE_LOGOS.slice(0, Math.ceil(PEDIGREE_LOGOS.length / 2)).map((l) => (
                <StripLogo key={l} name={l} styles={styles} />
              ))}
            </div>
            <div className="pedigree-logos-row" style={styles.pedigreeStripLogosRow}>
              {PEDIGREE_LOGOS.slice(Math.ceil(PEDIGREE_LOGOS.length / 2)).map((l) => (
                <StripLogo key={l} name={l} styles={styles} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

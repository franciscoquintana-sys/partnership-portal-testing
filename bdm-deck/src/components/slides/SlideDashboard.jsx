import { forwardRef, useRef, useState, useLayoutEffect } from 'react'
import {
  CreditCard,
  IdentificationCard,
  CurrencyDollar,
  MapPin,
  Plus,
  CheckCircle,
  WarningCircle,
  XCircle,
  ArrowsClockwise,
  Star,
  Info,
  CaretRight,
  Minus,
  Sparkle,
  Path,
  Stack,
  Faders,
  ChartLine,
} from '@phosphor-icons/react'
import SlideBase from './SlideBase'
import BeamRule from '../BeamRule'
import { useTheme } from '../../lib/theme'

// Live "merchant view" of dashboard.y.uno. Reproduces the Smart
// Routing screen as faithfully as possible: a single central "âˆ’"
// node forks via two 50% pills into the Stripe and dLocal entries,
// then each PSP cascades into a stage-2 PSP via curved beziers
// that hug the inter-card gap. Boxes never animate; the wiring
// itself comes alive via stroke-dashoffset beams gliding along
// every trace, simulating live transactions.

const PSPS = {
  stripe: { name: 'Stripe', role: 'Stripe Global', glyph: 'S', color: '#635BFF' },
  dlocal: { name: 'dLocal', role: 'dLocal LATAM', glyph: 'd', color: '#FF5C39' },
  // Nuvei brand mark is near-black; on a dark card it would vanish, so
  // surface it as a near-white tile with dark text instead.
  nuvei:  { name: 'Nuvei',  role: 'Nuvei Global',  glyph: 'N', color: '#F4F5F8', fg: '#1B1D29' },
  xendit: { name: 'Xendit', role: 'Xendit Global', glyph: 'X', color: '#DC2626' },
}

const STATUS_ICON = {
  ok:    { Glyph: CheckCircle,     color: '#16A34A' },
  warn:  { Glyph: WarningCircle,   color: '#F59E0B' },
  retry: { Glyph: ArrowsClockwise, color: '#F59E0B' },
  err:   { Glyph: XCircle,         color: '#DC2626' },
}

const StatusRow = forwardRef(function StatusRow({ kind, label, active, styles }, ref) {
  const { Glyph, color } = STATUS_ICON[kind]
  return (
    <div ref={ref} style={styles.statusRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Glyph size={13} weight="regular" color={color} aria-hidden />
        <span>{label}</span>
      </div>
      {active ? (
        <div style={styles.statusOutActive}>
          <CaretRight size={9} weight="bold" aria-hidden />
        </div>
      ) : (
        <div style={styles.statusOutTerminal}>
          <Minus size={9} weight="bold" aria-hidden />
        </div>
      )}
    </div>
  )
})

function PspCard({ pspKey, statuses, cardRef, rowRefs, styles }) {
  const psp = PSPS[pspKey]
  return (
    <div ref={cardRef} style={styles.pspCard}>
      <div style={styles.pspHeader}>
        <div style={{ ...styles.pspGlyph, background: psp.color, color: psp.fg || '#fff' }}>{psp.glyph}</div>
        <div>
          <div style={styles.pspName}>{psp.name}</div>
          <div style={styles.pspRole}>{psp.role}</div>
        </div>
      </div>
      <div style={styles.statusList}>
        {statuses.map((s, i) => (
          <StatusRow
            key={i}
            ref={rowRefs && rowRefs[i]}
            kind={s.kind}
            label={s.label}
            active={s.active}
            styles={styles}
          />
        ))}
      </div>
    </div>
  )
}

// SVG circuit. Every trace is a smooth horizontal-bias bezier so the
// network reads as routed wiring rather than block diagrams. A bright
// beam slides along each path on a stagger so you can see traffic
// flowing condition â†’ split â†’ PSP â†’ stage-2 PSP without any of the
// boxes themselves moving.
function RoutingCircuit({ paths, styles, theme }) {
  if (!paths.length) return null
  // On dark, the soft trail uses white-violet at low opacity and the
  // bright beam glows. On light, the trail flips to a soft accent so
  // it reads against the white canvas; the bright beam stays accent
  // blue but loses the glow halo that was tuned for dark backgrounds.
  const trailStroke = theme.isLight
    ? 'rgba(62, 79, 224, 0.30)'
    : 'rgba(124, 137, 239, 0.35)'
  return (
    <svg style={styles.canvasSvg} aria-hidden>
      <defs>
        <filter id="dashBeamGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((d, i) => {
        // Faster cadence + bigger beam segment so the motion reads
        // even on the short Stripeâ†’Nuvei / dLocalâ†’Xendit hops where
        // the previous 20-pt beam was sliding through too fast to be
        // noticeable.
        const dur = 2.4 + (i % 4) * 0.3
        const delay = -((i * 0.4) % dur)
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={trailStroke} strokeWidth="1.6" strokeLinecap="round" />
            <path
              d={d}
              fill="none"
              stroke={theme.accent}
              strokeWidth="3.2"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="32 68"
              filter={theme.isLight ? undefined : 'url(#dashBeamGlow)'}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-100"
                dur={`${dur}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        )
      })}
    </svg>
  )
}

const BULLETS = [
  {
    Icon: Stack,
    title: 'Plug and play any PSP',
    desc: '460+ providers in our portfolio. Connect Stripe, dLocal, Nuvei, Xendit and the rest with no engineering on your side.',
  },
  {
    Icon: Path,
    title: 'Smart routing per condition',
    desc: 'Route by card brand, BIN, currency, country, amount.',
  },
  {
    Icon: Faders,
    title: 'Choose the volume split',
    desc: '50/50, 70/30, custom weights. Distribute traffic to test, ramp, or load-balance.',
  },
  {
    Icon: ArrowsClockwise,
    title: 'Cascade through declines',
    desc: 'Auto-failover on retryables and errors. Recover revenue that would otherwise drop.',
  },
  {
    Icon: ChartLine,
    title: 'One dashboard, every route',
    desc: 'Live status per PSP per status code. No spreadsheets, no switching tabs.',
  },
]

export default function SlideDashboard() {
  const theme = useTheme()
  const containerRef = useRef(null)
  const conditionsRef = useRef(null)
  const stripeRef = useRef(null)
  const dlocalRef = useRef(null)
  const nuveiRef = useRef(null)
  const xenditRef = useRef(null)
  // Per-row refs so stage-2 traces can land exactly on the status row's
  // right/left edge instead of guessing pixel offsets from the card top.
  const stripeRows = [useRef(null), useRef(null), useRef(null)]
  const nuveiRows  = [useRef(null), useRef(null), useRef(null)]
  const dlocalRows  = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const xenditRows = [useRef(null), useRef(null), useRef(null)]
  const [paths, setPaths] = useState([])
  const [pillPositions, setPillPositions] = useState(null)
  const [nodePos, setNodePos] = useState(null)

  // Browser chrome / dashboard surface. On dark, it's the original
  // near-black inkwell so the mock reads as part of the deck. On
  // light, it flips to white panels with subtle borders so the
  // dashboard reads as a real-product screenshot inside the slide.
  const browserBg = theme.isLight ? theme.bgElevated : '#0E0F18'
  const browserChromeBg = theme.isLight
    ? theme.surface0
    : 'linear-gradient(180deg, #1A1C2A 0%, #14151E 100%)'
  const surfaceBg = theme.isLight ? theme.bgElevated : '#0E0F18'
  const surfaceHeaderBg = theme.isLight ? theme.surface0 : '#14151E'
  const cardBg = theme.isLight ? theme.bgElevated : '#1A1C2A'
  // Central node + split label backgrounds need to match the dashboard
  // canvas behind them so they punch through the SVG traces cleanly.
  const nodePunchBg = theme.isLight ? theme.bgElevated : '#0E0F18'

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '15.5px',
      minHeight: 0,
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '48.5px',
      fontWeight: 500,
      letterSpacing: '-1.2px',
      lineHeight: 1.1,
      color: theme.ink,
      margin: 0,
    },
    titleAccent: {
      backgroundImage: theme.isLight
        ? `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accent} 100%)`
        : `linear-gradient(135deg, ${theme.accentMid} 0%, ${theme.accentPale} 55%, ${theme.accent} 100%)`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      fontWeight: 700,
    },
    monoKicker: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 500,
      letterSpacing: '0.4px',
      color: theme.inkMuted,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    monoKickerCaret: { color: theme.accent },

    // Two-column body â€” text panel takes ~46% so "How does it work?"
    // and the bullet copy breathe; dashboard takes ~54% on the right,
    // small enough that the wiring stays the hero, big enough that the
    // PSP cards remain legible at projector distance.
    mainRow: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: 'minmax(320px, 0.85fr) 1fr',
      gap: '33.5px',
      minHeight: 0,
      alignItems: 'stretch',
    },

    // ---------- LEFT: explanatory copy ----------
    textPanel: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '18px',
    },
    textKicker: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8.5px 15.5px',
      background: theme.isLight ? 'rgba(62, 79, 224, 0.08)' : 'rgba(124,137,239,0.1)',
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '100px',
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.isLight ? theme.accentDeep : 'rgba(189,195,246,0.95)',
      width: 'fit-content',
    },
    textHeadline: {
      fontFamily: 'var(--font-display)',
      fontSize: '32px',
      fontWeight: 600,
      letterSpacing: '-0.6px',
      color: theme.ink,
      lineHeight: 1.12,
      margin: 0,
    },
    textHeadlineAccent: {
      color: theme.isLight ? theme.accent : theme.accentPale,
      fontWeight: 700,
    },
    bulletList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15.5px',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    bullet: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '15.5px',
      alignItems: 'flex-start',
    },
    bulletIcon: {
      width: '37px',
      height: '37px',
      borderRadius: '10px',
      background: theme.isLight
        ? 'linear-gradient(135deg, rgba(62,79,224,0.10) 0%, rgba(62,79,224,0.04) 100%)'
        : 'linear-gradient(135deg, rgba(62,79,224,0.18) 0%, rgba(89,103,228,0.08) 100%)',
      border: `1px solid ${theme.borderAccent}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.isLight ? theme.accent : theme.accentPale,
      flexShrink: 0,
      marginTop: '3px',
    },
    bulletTitle: {
      fontSize: '18px',
      fontWeight: 700,
      color: theme.ink,
      letterSpacing: '-0.1px',
      lineHeight: 1.25,
      display: 'block',
    },
    bulletDesc: {
      fontSize: '14.5px',
      fontWeight: 400,
      color: theme.inkSecondary,
      lineHeight: 1.4,
      display: 'block',
      marginTop: '5px',
    },

    // ---------- RIGHT: browser-framed dashboard ----------
    browser: {
      background: browserBg,
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '12px',
      // Dark: deep drop shadow + faint inset accent halo so the mock
      // floats off the canvas. Light: rely on theme.cardShadow which
      // is a softer ink-tinted shadow tuned for white surfaces; the
      // inset glow disappears since it was a dark-canvas-only effect.
      boxShadow: theme.isLight
        ? theme.cardShadow
        : '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,137,239,0.08) inset',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
    },
    browserChrome: {
      height: '30.5px',
      background: browserChromeBg,
      borderBottom: `1px solid ${theme.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 11px',
      gap: '11px',
      flexShrink: 0,
    },
    trafficLights: { display: 'flex', gap: '5px' },
    trafficDot: (color) => ({
      width: '7.5px',
      height: '7.5px',
      borderRadius: '50%',
      background: color,
    }),
    urlBar: {
      flex: 1,
      height: '19px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      color: theme.inkMuted,
      letterSpacing: '0.2px',
    },

    // Dark-mode surface so the dashboard reads as part of the deck
    // instead of a light interruption between two dark slides. Layout
    // stays identical â€” only the palette flips on light.
    surface: {
      flex: 1,
      background: surfaceBg,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    },
    surfaceHeader: {
      height: '38.5px',
      background: surfaceHeaderBg,
      borderBottom: `1px solid ${theme.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 15.5px',
      flexShrink: 0,
    },
    surfaceHeaderLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '11px',
    },
    // Small Yuno "y" mark sits at the left of the route header, like a
    // product nav indicator. Reads as "you are inside dashboard.y.uno"
    // without taking visual weight from the route name beside it. The
    // SVG is delivered white; on light we flatten it to black so it
    // reads against the white surface.
    yunoMark: {
      height: '14.5px',
      width: 'auto',
      display: 'block',
      opacity: 0.95,
      filter: theme.invertLogos ? 'none' : 'brightness(0)',
    },
    routeName: { fontSize: '11.5px', color: theme.inkMuted },
    routeNameValue: { fontWeight: 700, color: theme.ink, marginLeft: '6px' },
    surfaceHeaderIcons: {
      display: 'flex',
      gap: '9.5px',
      color: theme.inkFaint,
    },

    // Canvas: conditions left, generous middle gap (the central node and
    // its 50% labels float in this space), 2x2 PSP grid right. Overflow
    // visible so bezier control points outside the canvas bounds don't
    // clip the rendered traces.
    canvas: {
      flex: 1,
      position: 'relative',
      padding: '12px 13px',
      display: 'grid',
      gridTemplateColumns: '179px 102.5px 1fr',
      gap: '5px',
      minHeight: 0,
      overflow: 'visible',
    },
    canvasSvg: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 0,
    },

    // Conditions column
    conditionsCol: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: 0,
      position: 'relative',
      zIndex: 1,
    },
    addBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '8.5px 11.5px',
      background: theme.accent,
      border: 'none',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: 600,
      color: '#fff',
      boxShadow: '0 1px 2px rgba(20, 24, 40, 0.08)',
    },
    addBtnIcon: {
      width: '14.5px',
      height: '14.5px',
      background: 'rgba(255,255,255,0.22)',
      color: '#fff',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    metaCard: {
      background: cardBg,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '8px',
      padding: '6px 0',
      display: 'flex',
      flexDirection: 'column',
    },
    metaRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 9px',
      fontSize: '9px',
    },
    metaLabel: { color: theme.inkMuted, fontWeight: 500 },
    metaValue: { color: theme.ink, fontWeight: 600 },

    conditionCard: {
      background: cardBg,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '8px',
      padding: '7.5px 9.5px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      position: 'relative',
    },
    conditionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    conditionIcon: {
      width: '18px',
      height: '18px',
      borderRadius: '5px',
      background: theme.surface0,
      border: `1px solid ${theme.borderDefault}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.inkMuted,
    },
    removeBtn: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: cardBg,
      border: `1px solid ${theme.borderAccent}`,
      color: theme.isLight ? theme.accent : theme.accentPale,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    conditionLabel: {
      fontSize: '10.5px',
      fontWeight: 700,
      color: theme.ink,
    },
    conditionRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
    },
    conditionPill: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 6px',
      background: theme.surface0,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '5px',
      fontSize: '8.5px',
      color: theme.inkSecondary,
      fontWeight: 500,
    },
    conditionOp: {
      background: theme.isLight
        ? 'rgba(62, 79, 224, 0.10)'
        : 'rgba(62,79,224,0.18)',
      border: `1px solid ${theme.borderAccent}`,
      color: theme.isLight ? theme.accent : theme.accentPale,
      fontWeight: 700,
    },

    // Middle column â€” purely visual gap; the central minus node and the
    // two 50% labels are absolute-positioned overlays inside the canvas.
    midCol: { position: 'relative', minWidth: 0 },

    centralNode: {
      position: 'absolute',
      width: '22px',
      height: '22px',
      background: nodePunchBg,
      border: `1.5px solid ${theme.accent}`,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.isLight ? theme.accent : theme.accentPale,
      zIndex: 2,
      // The accent halo glow only reads on dark; on light it muddies
      // the punch-through against the white canvas.
      boxShadow: theme.isLight ? 'none' : '0 0 14px rgba(62, 79, 224, 0.4)',
      transform: 'translate(-50%, -50%)',
    },
    splitLabel: {
      position: 'absolute',
      background: nodePunchBg,
      border: `1px solid ${theme.borderAccent}`,
      borderRadius: '999px',
      padding: '2.5px 7px',
      fontSize: '9px',
      fontWeight: 700,
      color: theme.isLight ? theme.accent : theme.accentPale,
      zIndex: 2,
      boxShadow: theme.isLight ? 'none' : '0 0 8px rgba(62, 79, 224, 0.25)',
      transform: 'translate(-50%, -50%)',
    },

    // PSP grid
    treeCol: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '9px 70.5px',
      minWidth: 0,
      minHeight: 0,
      zIndex: 1,
    },
    pspCard: {
      background: cardBg,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      minWidth: 0,
      height: 'fit-content',
      alignSelf: 'center',
      boxShadow: theme.isLight ? theme.cardShadow : 'none',
    },
    pspHeader: {
      padding: '7.5px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: '7.5px',
      borderBottom: `1px solid ${theme.borderSubtle}`,
    },
    pspGlyph: {
      width: '23.5px',
      height: '23.5px',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '11.5px',
      flexShrink: 0,
    },
    pspName: {
      fontSize: '11.5px',
      fontWeight: 700,
      color: theme.ink,
      lineHeight: 1.1,
    },
    pspRole: {
      fontSize: '8.5px',
      color: theme.inkMuted,
      fontWeight: 500,
      marginTop: '1px',
    },
    statusList: { display: 'flex', flexDirection: 'column' },
    statusRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '5px 10px',
      fontSize: '9.5px',
      fontWeight: 500,
      color: theme.ink,
      borderTop: `1px solid ${theme.borderSubtle}`,
    },
    statusLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px,',
    },
    // Active forward route â€” solid Yuno-blue circle with a right caret.
    // Terminal route â€” outlined dark circle with a "âˆ’" minus glyph.
    statusOutActive: {
      width: '13.5px',
      height: '13.5px',
      background: theme.accent,
      color: '#fff',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    statusOutTerminal: {
      width: '13.5px',
      height: '13.5px',
      background: theme.surface0,
      color: theme.inkFaint,
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  }

  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    const measure = () => {
      const cb = cont.getBoundingClientRect()
      if (!cb.width || !cb.height) return
      // SlideViewer wraps every slide in a transform: scale() to fit the
      // 1920Ã—1080 stage into the viewport. getBoundingClientRect returns
      // POST-transform pixels; SVG paths and absolute-positioned overlays
      // use the canvas's INTRINSIC (pre-transform) pixel space. Without
      // this correction every measured coord is multiplied by the stage
      // scale and the wiring lands inside the conditions column instead
      // of in the gap. Dividing every measurement by the scale puts
      // everything back into the SVG's coordinate space.
      const scale = cont.offsetWidth ? cb.width / cont.offsetWidth : 1
      const rel = (el) => {
        if (!el) return null
        const b = el.getBoundingClientRect()
        return {
          left: (b.left - cb.left) / scale,
          right: (b.right - cb.left) / scale,
          top: (b.top - cb.top) / scale,
          bottom: (b.bottom - cb.top) / scale,
          cy: (b.top - cb.top + b.height / 2) / scale,
          cx: (b.left - cb.left + b.width / 2) / scale,
        }
      }
      const conds = rel(conditionsRef.current)
      const stripe = rel(stripeRef.current)
      const dlocal = rel(dlocalRef.current)
      const nuvei = rel(nuveiRef.current)
      const xendit = rel(xenditRef.current)
      if (!conds || !stripe || !dlocal || !nuvei || !xendit) return

      // Central minus node sits in the middle column gap, vertically
      // centered between Stripe and dLocal so the two forks read as
      // mirrored 50% routes.
      const gapStart = conds.right
      const gapEnd = stripe.left
      const nodeX = gapStart + (gapEnd - gapStart) * 0.32
      const nodeY = (stripe.cy + dlocal.cy) / 2
      setNodePos({ x: nodeX, y: nodeY })

      // Each fork lands at the SUCCEEDED row of the target PSP â€” that
      // is where the routing arrow naturally enters the card in the
      // reference UI, not the geometric center.
      const stripeRow0 = rel(stripeRows[0].current) || { cy: stripe.cy, left: stripe.left }
      const dlocalRow0 = rel(dlocalRows[0].current) || { cy: dlocal.cy, left: dlocal.left }

      // Smooth horizontal-bias cubic bezier from (x1,y1) to (x2,y2).
      const curve = (x1, y1, x2, y2) => {
        const dx = x2 - x1
        const c1x = x1 + dx * 0.55
        const c2x = x2 - dx * 0.55
        return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`
      }

      // 50% pill positions sit on the curve at t=0.5. With the control
      // handles above, the midpoint of a horizontal-bias cubic bezier
      // equals the linear midpoint between endpoints â€” so we can place
      // the pills at simple (x_avg, y_avg) and they land on the trace.
      const topForkStart = { x: nodeX + 14, y: nodeY }
      const topForkEnd = { x: stripeRow0.left, y: stripeRow0.cy }
      const botForkStart = { x: nodeX + 14, y: nodeY }
      const botForkEnd = { x: dlocalRow0.left, y: dlocalRow0.cy }
      setPillPositions({
        top: { x: (topForkStart.x + topForkEnd.x) / 2, y: (topForkStart.y + topForkEnd.y) / 2 },
        bottom: { x: (botForkStart.x + botForkEnd.x) / 2, y: (botForkStart.y + botForkEnd.y) / 2 },
      })

      // Stage-2 row connections: source row right edge â†’ dest row left
      // edge. Measured per row so the curve always touches the actual
      // status row, not a guessed offset.
      const rowEdge = (rowRef, side) => {
        const r = rel(rowRef?.current)
        if (!r) return null
        return { x: side === 'right' ? r.right : r.left, y: r.cy }
      }

      const next = []
      // Conditions trunk â†’ central node (single straight horizontal hop)
      next.push(`M ${conds.right} ${nodeY} L ${nodeX - 14} ${nodeY}`)
      // Central node â†’ Stripe Succeeded row entry
      next.push(curve(topForkStart.x, topForkStart.y, topForkEnd.x, topForkEnd.y))
      // Central node â†’ dLocal Succeeded row entry
      next.push(curve(botForkStart.x, botForkStart.y, botForkEnd.x, botForkEnd.y))

      // Stage-2 cascade story:
      //   - Stripe Succeeded â†’ Nuvei Succeeded (the happy-path trace)
      //   - Stripe Error     â†’ Nuvei Succeeded (the cascade-retry
      //     trace â€” "Stripe errored, we retried on Nuvei and it
      //     succeeded"). This second trace rises sharply from the
      //     bottom of the Stripe card and converges on the same
      //     Nuvei Succeeded entry point as the happy-path trace, so
      //     the merge reads visually.
      // The previous Error â†’ Error horizontal connector was
      // intentionally removed â€” it muddied the cascade story by
      // suggesting errors stay terminal, when the slide narrative is
      // that errors trigger a successful retry on the next PSP.
      const ss = rowEdge(stripeRows[0], 'right')
      const ns = rowEdge(nuveiRows[0], 'left')
      if (ss && ns) next.push(curve(ss.x, ss.y, ns.x, ns.y))
      const se = rowEdge(stripeRows[2], 'right')
      if (se && ns) next.push(curve(se.x, se.y, ns.x, ns.y))
      // dLocal Succeeded â†’ Xendit Succeeded
      const as = rowEdge(dlocalRows[0], 'right')
      const xs = rowEdge(xenditRows[0], 'left')
      if (as && xs) next.push(curve(as.x, as.y, xs.x, xs.y))
      // dLocal All other declines â†’ Xendit Declined
      const ad = rowEdge(dlocalRows[2], 'right')
      const xd = rowEdge(xenditRows[1], 'left')
      if (ad && xd) next.push(curve(ad.x, ad.y, xd.x, xd.y))

      setPaths(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [])

  return (
    <SlideBase section="Yuno Dashboard" slideNumber={6}>
      <div style={styles.body}>
        <h2 style={styles.title}>
          One dashboard,{' '}
          <span style={styles.titleAccent}>every PSP, one click</span>
        </h2>

        <div style={styles.mainRow}>
          {/* LEFT â€” explanatory text */}
          <div style={styles.textPanel}>
            <span style={styles.textKicker}>
              <Sparkle size={13} weight="fill" />
              Plug and play
            </span>
            <h3 style={styles.textHeadline}>
              Connect any PSP in our portfolio,{' '}
              <span style={styles.textHeadlineAccent}>route every transaction your way</span>
            </h3>
            <ul style={styles.bulletList}>
              {BULLETS.map(({ Icon, title, desc }) => (
                <li key={title} style={styles.bullet}>
                  <span style={styles.bulletIcon}>
                    <Icon size={20} weight="regular" />
                  </span>
                  <span>
                    <span style={styles.bulletTitle}>{title}</span>
                    <span style={styles.bulletDesc}>{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT â€” browser-framed dashboard mockup */}
          <div className="reveal border-beam" style={{ ...styles.browser, '--beam-duration': '20s', '--reveal-delay': '0.15s' }}>
            <div style={styles.browserChrome}>
              <div style={styles.trafficLights}>
                <div style={styles.trafficDot('#FF5F57')} />
                <div style={styles.trafficDot('#FEBC2E')} />
                <div style={styles.trafficDot('#28C840')} />
              </div>
              <div style={styles.urlBar}>dashboard.y.uno</div>
            </div>

            <div style={styles.surface}>
              <div style={styles.surfaceHeader}>
                <div style={styles.surfaceHeaderLeft}>
                  <img src="/connections-deck/assets/yuno-mark-white.svg" alt="Yuno" style={styles.yunoMark} />
                  <div style={styles.routeName}>
                    Route name:
                    <span style={styles.routeNameValue}>Card network</span>
                  </div>
                </div>
                <div style={styles.surfaceHeaderIcons}>
                  <Star size={14} weight="regular" aria-hidden />
                  <Info size={14} weight="regular" aria-hidden />
                </div>
              </div>

              <div ref={containerRef} style={styles.canvas}>
                <RoutingCircuit paths={paths} styles={styles} theme={theme} />

                {/* Central minus node sits at the fork point; 50% pills
                    sit on each fork curve at its midpoint so the routing
                    weights label the actual trace, not float in space. */}
                {nodePos && (
                  <div style={{ ...styles.centralNode, left: nodePos.x, top: nodePos.y }}>
                    <Minus size={11} weight="bold" aria-hidden />
                  </div>
                )}
                {pillPositions && (
                  <>
                    <div style={{ ...styles.splitLabel, left: pillPositions.top.x, top: pillPositions.top.y }}>
                      50%
                    </div>
                    <div style={{ ...styles.splitLabel, left: pillPositions.bottom.x, top: pillPositions.bottom.y }}>
                      50%
                    </div>
                  </>
                )}

                {/* LEFT: conditions */}
                <div ref={conditionsRef} style={styles.conditionsCol}>
                  <div style={styles.addBtn}>
                    <span style={styles.addBtnIcon}>
                      <Plus size={10} weight="bold" />
                    </span>
                    Add new condition
                  </div>

                  <div style={styles.metaCard}>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>ID</span>
                      <span style={styles.metaValue}>840611J90</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Name</span>
                      <span style={styles.metaValue}>Cards</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Description</span>
                      <span style={styles.metaValue}>All cards</span>
                    </div>
                  </div>

                  <div style={styles.conditionCard}>
                    <div style={styles.conditionHeader}>
                      <span style={styles.conditionIcon}>
                        <CreditCard size={11} weight="regular" />
                      </span>
                      <span style={styles.removeBtn}>
                        <Minus size={9} weight="bold" />
                      </span>
                    </div>
                    <span style={styles.conditionLabel}>Card brand</span>
                    <div style={styles.conditionRow}>
                      <span style={{ ...styles.conditionPill, ...styles.conditionOp }}>Not equal</span>
                      <span style={styles.conditionPill}>American Express</span>
                    </div>
                  </div>

                  <div style={styles.conditionCard}>
                    <div style={styles.conditionHeader}>
                      <span style={styles.conditionIcon}>
                        <IdentificationCard size={11} weight="regular" />
                      </span>
                    </div>
                    <span style={styles.conditionLabel}>Card BIN</span>
                    <div style={styles.conditionRow}>
                      <span style={{ ...styles.conditionPill, ...styles.conditionOp }}>One of</span>
                      <span style={styles.conditionPill}>272028</span>
                      <span style={styles.conditionPill}>551689</span>
                      <span style={styles.conditionPill}>477191</span>
                      <span style={styles.conditionPill}>582139</span>
                      <span style={styles.conditionPill}>+180</span>
                    </div>
                  </div>

                  <div style={styles.conditionCard}>
                    <div style={styles.conditionHeader}>
                      <span style={styles.conditionIcon}>
                        <CurrencyDollar size={11} weight="regular" />
                      </span>
                    </div>
                    <span style={styles.conditionLabel}>Currency &amp; amount</span>
                    <div style={styles.conditionRow}>
                      <span style={{ ...styles.conditionPill, ...styles.conditionOp }}>Equal</span>
                      <span style={styles.conditionPill}>USD</span>
                    </div>
                  </div>

                  <div style={styles.conditionCard}>
                    <div style={styles.conditionHeader}>
                      <span style={styles.conditionIcon}>
                        <MapPin size={11} weight="regular" />
                      </span>
                    </div>
                    <span style={styles.conditionLabel}>Country</span>
                  </div>
                </div>

                {/* MIDDLE: visual gap (the SVG paints through it) */}
                <div style={styles.midCol} />

                {/* RIGHT: PSP grid 2x2 */}
                <div style={styles.treeCol}>
                  <PspCard
                    pspKey="stripe"
                    cardRef={stripeRef}
                    rowRefs={stripeRows}
                    styles={styles}
                    statuses={[
                      { kind: 'ok',   label: 'Succeeded', active: true },
                      { kind: 'warn', label: 'Declined',  active: false },
                      { kind: 'err',  label: 'Error',     active: true },
                    ]}
                  />
                  <PspCard
                    pspKey="nuvei"
                    cardRef={nuveiRef}
                    rowRefs={nuveiRows}
                    styles={styles}
                    statuses={[
                      { kind: 'ok',   label: 'Succeeded', active: true },
                      { kind: 'warn', label: 'Declined',  active: false },
                      { kind: 'err',  label: 'Error',     active: false },
                    ]}
                  />
                  <PspCard
                    pspKey="dlocal"
                    cardRef={dlocalRef}
                    rowRefs={dlocalRows}
                    styles={styles}
                    statuses={[
                      { kind: 'ok',    label: 'Succeeded',          active: true },
                      { kind: 'retry', label: 'Retryable',          active: false },
                      { kind: 'warn',  label: 'All other declines', active: true },
                      { kind: 'err',   label: 'Error',              active: false },
                    ]}
                  />
                  <PspCard
                    pspKey="xendit"
                    cardRef={xenditRef}
                    rowRefs={xenditRows}
                    styles={styles}
                    statuses={[
                      { kind: 'ok',   label: 'Succeeded', active: true },
                      { kind: 'warn', label: 'Declined',  active: false },
                      { kind: 'err',  label: 'Error',     active: false },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

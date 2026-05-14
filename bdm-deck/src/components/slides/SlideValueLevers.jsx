import {
  ArrowsSplit,
  ChartLineUp,
  CurrencyDollar,
  Lightning,
  Stack,
} from '@phosphor-icons/react'
import SlideBase from './SlideBase'
import BeamRule from '../BeamRule'

// Banking-mode value-levers slide: four mechanisms a unified orchestration
// layer activates the moment the bank plugs in, each anchored to a single
// quantified impact line so the bank reads the economics first and the
// mechanism second. Bottom-row benchmark strip carries cross-portfolio
// proof points (inDrive, Rappi, McDonald's) so the figures don't feel
// like our own marketing math.

const LEVERS = [
  {
    kicker: '01',
    name: 'Approval uplift',
    icon: ArrowsSplit,
    stat: '+3-8',
    statUnit: 'pp',
    statLabel: 'Authorization rate',
    body: 'Smart routing picks the highest-performing acquirer per BIN, issuer, and time-of-day. Every percentage point of uplift translates directly into captured revenue.',
  },
  {
    kicker: '02',
    name: 'Cost optimization',
    icon: CurrencyDollar,
    stat: '15-25',
    statUnit: '%',
    statLabel: 'Acquiring cost reduction',
    body: 'Eligible card volume routes through domestic rails when the economics beat international scheme fees. Cost-differential routing closes the gap on every transaction.',
  },
  {
    kicker: '03',
    name: 'APM activation',
    icon: Lightning,
    stat: 'Days',
    statUnit: '',
    statLabel: 'Time to a new method',
    body: 'New payment methods activate by configuration, not engineering. From 3-6 months per gateway to days, with 1,000+ methods pre-connected on the platform.',
  },
  {
    kicker: '04',
    name: 'Ops consolidation',
    icon: Stack,
    stat: '30-40',
    statUnit: '%',
    statLabel: 'Ops time reduction',
    body: 'One reconciliation, one dashboard, one dispute workflow across every gateway. Finance closes books in hours instead of days, with no provider lock-in.',
  },
]

const BENCHMARKS = [
  {
    label: 'inDrive',
    detail: '+8pp approval uplift across 10 markets',
  },
  {
    label: 'Rappi',
    detail: '27 payment methods activated across 9 countries in 12 months',
  },
  {
    label: "McDonald's",
    detail: 'Reconciliation consolidated across 21 countries into one dashboard',
  },
]

const styles = {
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    gap: '19px',
  },
  monoKicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.4px',
    color: 'rgba(255,255,255,0.42)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '7.5px',
  },
  monoKickerCaret: {
    color: 'rgba(124,137,239,0.9)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '25.5px',
    marginBottom: '18px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '34.5px',
    fontWeight: 500,
    letterSpacing: '-1.2px',
    lineHeight: 1.1,
    color: '#fff',
    margin: 0,
    maxWidth: '74%',
  },
  titleAccent: {
    backgroundImage: 'linear-gradient(135deg, #5967E4 0%, #BDC3F6 55%, #3E4FE0 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: '14px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.01em',
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '40%',
    textAlign: 'right',
  },
  // 4-card row sized to fit four columns at 1920×1080. Cards are tall
  // and lean: stat dominates, body sits beneath as supporting prose.
  cardRow: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '14px',
    minHeight: 0,
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
    padding: '22px 22px 24.5px',
    background: 'linear-gradient(160deg, rgba(62,79,224,0.07) 0%, rgba(0,0,0,0.55) 100%)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
    minHeight: 0,
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  cardKicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'rgba(124,137,239,0.95)',
  },
  cardIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(62,79,224,0.18) 0%, rgba(89,103,228,0.08) 100%)',
    border: '1px solid rgba(124,137,239,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(189,195,246,0.95)',
    flexShrink: 0,
  },
  // Stat block: hero number + small unit pinned at the right baseline.
  cardStatRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  cardStat: {
    fontFamily: 'var(--font-display)',
    fontSize: '54px',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-2.5px',
    backgroundImage: 'linear-gradient(135deg, #BDC3F6 0%, #5967E4 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  },
  cardStatUnit: {
    fontFamily: 'var(--font-display)',
    fontSize: '23px',
    fontWeight: 600,
    color: 'rgba(189,195,246,0.95)',
    lineHeight: 1,
    letterSpacing: '-0.5px',
  },
  cardStatLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.6px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '5px',
    lineHeight: 1.4,
  },
  cardDivider: {
    height: '1px',
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
    margin: '4px 0',
  },
  cardName: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    lineHeight: 1.18,
  },
  cardBody: {
    fontSize: '14px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
    letterSpacing: '0.01em',
    margin: 0,
  },
  // Benchmark strip, cross-portfolio proof points pinned beneath the
  // four levers so the figures read as portfolio truth, not assertion.
  benchmarkStrip: {
    display: 'grid',
    gridTemplateColumns: 'auto repeat(3, 1fr)',
    gap: '15.5px',
    alignItems: 'stretch',
    padding: '15.5px 19px',
    background:
      'linear-gradient(135deg, rgba(124,137,239,0.08) 0%, rgba(0,0,0,0.5) 100%)',
    border: '1px solid rgba(124,137,239,0.18)',
    borderRadius: '14px',
  },
  benchmarkLabelCol: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '4px',
    paddingRight: '15.5px',
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  benchmarkKicker: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11.5px',
    fontWeight: 700,
    letterSpacing: '1.8px',
    textTransform: 'uppercase',
    color: 'rgba(124,137,239,0.95)',
  },
  benchmarkTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '19px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.4px',
    lineHeight: 1.18,
  },
  benchmarkCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    justifyContent: 'center',
    paddingLeft: '9px',
  },
  benchmarkLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: '20.5px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
  },
  benchmarkDetail: {
    fontSize: '13px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.45,
  },
  illustrative: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    color: 'rgba(255,255,255,0.32)',
    marginTop: '5px',
    textAlign: 'left',
  },
}

export default function SlideValueLevers() {
  return (
    <SlideBase section="Value Levers" slideNumber={3}>
      <div style={styles.monoKicker}>
        <span style={styles.monoKickerCaret}>&gt;</span>
        what_unlocks
        <BeamRule />
      </div>

      <div style={styles.titleRow}>
        <h2 style={styles.title}>
          Four levers a unified orchestration{' '}
          <span style={styles.titleAccent}>layer can unlock</span>
        </h2>
        <p style={styles.subtitle}>
          Each one is measurable, already proven across our portfolio, and live
          the moment the orchestration layer plugs in.
        </p>
      </div>

      <div style={styles.body}>
        <div
          className="stagger"
          style={{
            ...styles.cardRow,
            '--stagger-base': '0.18s',
            '--stagger-step': '0.1s',
          }}
        >
          {LEVERS.map((l) => {
            const Icon = l.icon
            return (
              <div
                key={l.name}
                className="border-beam"
                style={{ ...styles.card, '--beam-duration': '24s' }}
              >
                <div style={styles.cardHead}>
                  <span style={styles.cardKicker}>{l.kicker}</span>
                  <span style={styles.cardIcon}>
                    <Icon size="60%" weight="regular" aria-hidden />
                  </span>
                </div>

                <div>
                  <div style={styles.cardStatRow}>
                    <span style={styles.cardStat}>{l.stat}</span>
                    {l.statUnit && <span style={styles.cardStatUnit}>{l.statUnit}</span>}
                  </div>
                  <div style={styles.cardStatLabel}>{l.statLabel}</div>
                </div>

                <div style={styles.cardDivider} />

                <div style={styles.cardName}>{l.name}</div>
                <p style={styles.cardBody}>{l.body}</p>
              </div>
            )
          })}
        </div>

        <div className="reveal" style={{ ...styles.benchmarkStrip, '--reveal-delay': '0.7s' }}>
          <div style={styles.benchmarkLabelCol}>
            <span style={styles.benchmarkKicker}>Portfolio proof</span>
            <span style={styles.benchmarkTitle}>Live across the network</span>
          </div>
          {BENCHMARKS.map((b) => (
            <div key={b.label} style={styles.benchmarkCard}>
              <span style={styles.benchmarkLabel}>{b.label}</span>
              <span style={styles.benchmarkDetail}>{b.detail}</span>
            </div>
          ))}
        </div>

        <div style={styles.illustrative}>
          &gt; figures are cross-portfolio benchmarks; bank-specific projections sized in a data conversation
        </div>
      </div>
    </SlideBase>
  )
}

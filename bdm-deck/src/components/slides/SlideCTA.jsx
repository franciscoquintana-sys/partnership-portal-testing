import { useState } from 'react'
import { buildEmail } from '../../data/email-template'
import { useTheme } from '../../lib/theme'

const SENDERS = [
  { id: 'german', name: 'Germán Tatis', email: 'german.tatis@y.uno', initials: 'GT' },
  { id: 'samuel-carreno', name: 'Samuel Carreño', email: 'samuel.carreno@y.uno', initials: 'SC' },
  { id: 'daniela', name: 'Daniela Reyes', email: 'daniela.reyes@y.uno', initials: 'DR' },
  { id: 'mauricio', name: 'Mauricio Schwartzmann', email: 'ms@y.uno', initials: 'MS' },
  { id: 'martin', name: 'Martin Mexia', email: 'm@y.uno', initials: 'MM' },
  { id: 'melissa', name: 'Melissa Pottenger', email: 'melissa.pottenger@y.uno', initials: 'MP' },
  { id: 'justo', name: 'Justo Benetti', email: 'justo@y.uno', initials: 'JB' },
  { id: 'samuel-vieira', name: 'Samuel Vieira', email: 'samuel@y.uno', initials: 'SV' },
  { id: 'briana', name: 'Briana Gargurevich', email: 'briana@y.uno', initials: 'BG' },
  { id: 'jarrett', name: 'Jarrett Falasco', email: 'jarrett.falasco@y.uno', initials: 'JF' },
  { id: 'magdalena', name: 'Magdalena Torrealba', email: 'magdalena.torrealba@y.uno', initials: 'MT' },
]

// Always CC'd on every outgoing email - handled by the backend, not
// surfaced in the UI (merchants don't need to see our internal cc list).
const CC_RECIPIENTS = [
  { name: 'Justo Benetti', email: 'justo@y.uno' },
  { name: 'Samuel Vieira', email: 'samuel@y.uno' },
  { name: 'Briana Gargurevich', email: 'briana@y.uno' },
]

// Per-sender CC override. When the selected sender's id is a key here,
// the email goes out CC'd to this list instead of CC_RECIPIENTS — used
// when a specific sender wants their own escalation chain in the loop
// rather than the default SDR cc roster.
const CC_OVERRIDES_BY_SENDER = {
  justo: [
    { name: 'Mauricio Schwartzmann', email: 'ms@y.uno' },
    { name: 'Juan Pablo Ortega',     email: 'jp@y.uno' },
  ],
}

function resolveCcList(senderId) {
  return CC_OVERRIDES_BY_SENDER[senderId] || CC_RECIPIENTS
}

export default function SlideCTA({ data, shared = false }) {
  const theme = useTheme()
  const [selectedSDR, setSelectedSDR] = useState('german')
  const [merchantName, setMerchantName] = useState('')
  const [merchantEmail, setMerchantEmail] = useState('')
  const [focused, setFocused] = useState(null) // 'name' | 'email' | null
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [copied, setCopied] = useState(false)

  // Theme-aware caret SVG for the sender select. Dark uses white-50,
  // light uses dark-ink-50 so the caret reads on the white field.
  const selectCaret = theme.isLight
    ? `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10' viewBox='0 0 14 10' fill='none'%3E%3Cpath d='M1 1.5L7 8L13 1.5' stroke='%231E2030' stroke-opacity='0.5' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E")`
    : `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10' viewBox='0 0 14 10' fill='none'%3E%3Cpath d='M1 1.5L7 8L13 1.5' stroke='white' stroke-opacity='0.5' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E")`

  const styles = {
    slide: {
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font)',
    },
    bg: {
      position: 'absolute',
      inset: 0,
      background: theme.isLight
        ? `radial-gradient(ellipse at 30% 70%, rgba(62,79,224,0.08) 0%, ${theme.bg} 45%, ${theme.bg} 100%)`
        : 'radial-gradient(ellipse at 30% 70%, #1726A6 0%, #000000 40%, #000000 100%)',
    },
    orb1: {
      position: 'absolute',
      bottom: '-30%',
      left: '-15%',
      width: '70vw',
      height: '70vw',
      borderRadius: '50%',
      background: theme.isLight
        ? 'radial-gradient(circle, rgba(62,79,224,0.10) 0%, transparent 60%)'
        : 'radial-gradient(circle, rgba(62,79,224,0.2) 0%, transparent 60%)',
      filter: 'blur(80px)',
      animation: 'float 12s ease-in-out infinite',
    },
    orb2: {
      position: 'absolute',
      top: '-20%',
      right: '-15%',
      width: '50vw',
      height: '50vw',
      borderRadius: '50%',
      background: theme.isLight
        ? 'radial-gradient(circle, rgba(62,79,224,0.08) 0%, transparent 60%)'
        : 'radial-gradient(circle, rgba(62,79,224,0.15) 0%, transparent 60%)',
      filter: 'blur(80px)',
      animation: 'float 14s ease-in-out infinite reverse',
    },
    stripe1: {
      position: 'absolute',
      bottom: '-30%',
      left: '-8%',
      width: '42%',
      height: '160%',
      background: theme.isLight
        ? 'linear-gradient(160deg, rgba(62,79,224,0.06) 0%, rgba(189,195,246,0.03) 100%)'
        : 'linear-gradient(160deg, rgba(62,79,224,0.12) 0%, rgba(189,195,246,0.06) 100%)',
      transform: 'rotate(-20deg)',
      borderRadius: '80px',
    },
    stripe2: {
      position: 'absolute',
      bottom: '-20%',
      left: '8%',
      width: '25%',
      height: '140%',
      background: theme.isLight
        ? 'linear-gradient(160deg, rgba(30,32,48,0.03) 0%, transparent 100%)'
        : 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
      transform: 'rotate(-20deg)',
      borderRadius: '80px',
    },
    // Closing brand wordmark — sits in the lower-right as a "signed by Yuno"
    // moment on the final slide. Opposite the slide counter (lower-left) so
    // they balance without stacking. Higher opacity than the cover/solution
    // watermarks because this is the brand sign-off, not atmospheric accent.
    closingWordmark: {
      position: 'absolute',
      right: 'clamp(36px, 4.8%, 90px)',
      bottom: 'clamp(22px, 2.8%, 44px)',
      width: '115px',
      height: 'auto',
      opacity: 0.6,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 2,
    },
    content: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      height: '100%',
      padding: 'clamp(32px, 4%, 72px) clamp(40px, 5%, 96px) clamp(60px, 6.5%, 100px)',
      display: 'flex',
      flexDirection: 'column',
    },
    topRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionLabel: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '7px 16px',
      background: theme.sectionLabelBg,
      border: `1px solid ${theme.sectionLabelBorder}`,
      borderRadius: '100px',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '1.8px',
      textTransform: 'uppercase',
      color: theme.sectionLabelText,
      backdropFilter: 'blur(12px)',
    },
    sectionDot: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3E4FE0 0%, #BDC3F6 100%)',
    },
    yunoLogo: {
      height: '19px',
      opacity: theme.logoOpacity,
      filter: theme.logoFilter,
    },
    main: {
      flex: 1,
      display: 'flex',
      gap: '4%',
      alignItems: 'center',
      paddingTop: '25.5px',
    },
    left: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '25.5px',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '54px',
      fontWeight: 500,
      letterSpacing: '-1.5px',
      lineHeight: 1.05,
      color: theme.ink,
    },
    accent: theme.isLight
      ? {
          background: `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accent} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
          fontWeight: 700,
        }
      : {
          background: 'linear-gradient(135deg, #3E4FE0 0%, #5967E4 50%, #BDC3F6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 8s ease-in-out infinite',
        },
    subtitle: {
      fontSize: '19px',
      fontWeight: 400,
      lineHeight: 1.5,
      color: theme.inkSecondary,
      maxWidth: '95%',
    },
    stats: {
      display: 'flex',
      gap: '25.5px',
      marginTop: '13px',
    },
    stat: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    statNum: {
      fontFamily: 'var(--font-display)',
      fontSize: '32px',
      fontWeight: 700,
      color: theme.ink,
      letterSpacing: '-0.8px',
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    },
    statLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: theme.inkSecondary,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      marginTop: '8px',
    },
    // EMAIL FORM
    right: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    formCard: {
      background: theme.isLight
        ? theme.bgElevated
        : 'linear-gradient(135deg, rgba(62,79,224,0.08) 0%, rgba(0,0,0,0.8) 100%)',
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '22px',
      padding: '33.5px',
      backdropFilter: theme.isLight ? 'none' : 'blur(24px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20.5px',
      boxShadow: theme.isLight
        ? theme.cardShadow
        : '0 32px 80px rgba(0,0,0,0.4)',
      position: 'relative',
      overflow: 'hidden',
    },
    formHeader: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    formLabel: {
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '1.8px',
      textTransform: 'uppercase',
      color: 'rgba(62,79,224,0.85)',
    },
    formTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '24.5px',
      fontWeight: 700,
      color: theme.ink,
      letterSpacing: '-0.3px',
      lineHeight: 1.15,
    },
    formSubtitle: {
      fontSize: '14px',
      fontWeight: 400,
      color: theme.inkMuted,
      marginTop: '4px',
      lineHeight: 1.5,
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    fieldLabel: {
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: theme.inkMuted,
    },
    senderSelect: {
      width: '100%',
      background: theme.isLight ? theme.bgElevated : 'rgba(0,0,0,0.5)',
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '12px',
      padding: '15.5px 16.5px',
      color: theme.ink,
      fontSize: '14px',
      fontWeight: 500,
      fontFamily: 'var(--font)',
      outline: 'none',
      cursor: 'pointer',
      appearance: 'none',
      WebkitAppearance: 'none',
      backgroundImage: selectCaret,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 18px center',
      paddingRight: '48px',
    },
    senderEmailHint: {
      fontSize: '12px',
      fontWeight: 500,
      color: theme.isLight ? theme.accent : 'rgba(189,195,246,0.7)',
      letterSpacing: '0.1px',
      marginTop: '4px',
      paddingLeft: '2px',
      fontFamily: 'var(--font)',
    },
    sdrRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
    },
    sdrOption: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '9px',
      background: theme.surface0,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '10px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    sdrOptionActive: {
      background: 'linear-gradient(135deg, rgba(62,79,224,0.15) 0%, rgba(89,103,228,0.08) 100%)',
      borderColor: 'rgba(62,79,224,0.4)',
      boxShadow: '0 0 20px rgba(62,79,224,0.2)',
    },
    sdrAvatar: {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, rgba(62,79,224,0.3) 0%, rgba(89,103,228,0.2) 100%)',
      border: '1px solid rgba(62,79,224,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontSize: '10px',
      fontWeight: 600,
      color: 'var(--yuno-light-blue)',
      flexShrink: 0,
      letterSpacing: '0.5px',
    },
    sdrInfo: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      gap: '2px',
    },
    sdrName: {
      fontSize: '11px',
      fontWeight: 700,
      color: theme.ink,
      letterSpacing: '0px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    sdrEmail: {
      fontSize: '8px',
      fontWeight: 400,
      color: theme.inkMuted,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    input: {
      width: '100%',
      background: theme.isLight ? theme.bgElevated : 'rgba(0,0,0,0.5)',
      border: `1px solid ${theme.borderDefault}`,
      borderRadius: '12px',
      padding: '15.5px 16.5px',
      color: theme.ink,
      fontSize: '15px',
      fontWeight: 500,
      fontFamily: 'var(--font)',
      outline: 'none',
      transition: 'all 0.2s',
    },
    ccNote: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 14px',
      background: theme.surface0,
      border: `1px solid ${theme.borderSubtle}`,
      borderRadius: '10px',
      fontSize: '10px',
      color: theme.inkMuted,
    },
    ccIcon: {
      fontSize: '14px',
      color: 'rgba(124,137,239,0.7)',
    },
    ccText: {
      color: theme.inkSecondary,
      fontWeight: 600,
    },
    sendBtn: {
      width: '100%',
      padding: '18px',
      // Submit is the primary CTA; keep the brand-blue gradient on both
      // themes so it stays bold and unmistakable.
      background: 'linear-gradient(135deg, #3E4FE0 0%, #5967E4 50%, #5967E4 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '14px',
      fontSize: '15.5px',
      fontWeight: 700,
      fontFamily: 'var(--font)',
      cursor: 'pointer',
      letterSpacing: '0.2px',
      transition: 'all 0.2s',
      boxShadow: '0 4px 20px rgba(62,79,224,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    },
    // "Download deck" anchor lives below the stats on the closing slide.
    // Outline style (vs the filled email send-btn on the right) so two
    // primary actions don't compete in internal mode where both render.
    downloadDeck: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      marginTop: '30.5px',
      padding: '15.5px 23px',
      background: 'rgba(62,79,224,0.08)',
      border: '1px solid rgba(124,137,239,0.45)',
      borderRadius: '14px',
      color: theme.isLight ? theme.accentDeep : '#fff',
      fontSize: '14px',
      fontWeight: 700,
      fontFamily: 'var(--font)',
      letterSpacing: '0.2px',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
      alignSelf: 'flex-start',
      boxShadow: '0 4px 20px rgba(62,79,224,0.18)',
    },
    sendBtnDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
      boxShadow: 'none',
    },
    successNote: {
      fontSize: '13px',
      color: theme.isLight ? '#16A34A' : '#4ade80',
      fontWeight: 600,
      textAlign: 'center',
      padding: '12px',
    },
    slideNumber: {
      position: 'absolute',
      bottom: 'clamp(18px, 2.4%, 40px)',
      left: 'clamp(36px, 4.8%, 90px)',
      fontSize: '10px',
      fontWeight: 700,
      color: theme.inkFaint,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '1.5px',
    },
  }

  const canSend = merchantEmail.includes('@') && merchantEmail.includes('.') && !sending

  const handleSend = async (e) => {
    e.preventDefault()
    if (!canSend) return
    setSending(true)

    const sender = SENDERS.find((s) => s.id === selectedSDR)
    const ccList = resolveCcList(sender?.id)
    const merchantSlug = data?.SLUG
      || (data?.COMPANY_NAME ? String(data.COMPANY_NAME).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null)
    const deckUrl = merchantSlug
      ? `${window.location.origin}/m/${encodeURIComponent(merchantSlug)}`
      : window.location.origin

    const tpl = buildEmail({
      company: data?.COMPANY_NAME,
      toEmail: merchantEmail.trim(),
      toName: merchantName.trim(),
      senderName: sender?.name,
      senderEmail: sender?.email,
      ccEmails: ccList.map((r) => r.email),
      deckUrl,
    })

    // Convert the plain-text template to light HTML (preserve line breaks
    // + linkify the deck URL).
    const html = tpl.body
      .split('\n')
      .map((line) => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 10px;">${line.replace(deckUrl, `<a href="${deckUrl}" style="color:#3E4FE0;font-weight:600;">${deckUrl}</a>`)}</p>`)
      .join('')

    try {
      const res = await fetch('/api/send-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: sender?.name, email: sender?.email },
          toName: merchantName.trim() || undefined,
          toEmail: merchantEmail.trim(),
          ccEmails: ccList.map((r) => r.email),
          subject: tpl.subject,
          html,
          company: data?.COMPANY_NAME,
          merchantSlug,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setSending(false)
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setMerchantName('')
        setMerchantEmail('')
      }, 3000)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CTA] send failed', err)
      setSending(false)
      alert(`Send failed: ${err.message}`)
    }
  }

  // Focus styling tokens for inputs — accent border + faint accent halo.
  const focusBorder = theme.accent
  const focusHalo = theme.isLight
    ? '0 0 0 4px rgba(62,79,224,0.12)'
    : '0 0 0 4px rgba(62,79,224,0.12)'

  return (
    <div style={styles.slide}>
      <div style={styles.bg} />
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.stripe1} />
      <div style={styles.stripe2} />

      <div className="slide-enter" style={styles.content}>
        <div style={styles.topRow}>
          <span style={styles.sectionLabel}>
            <span style={styles.sectionDot} />
            Next Steps
          </span>
          <img src="/sales-deck/assets/yuno-logo-white.svg" alt="Yuno" style={styles.yunoLogo} />
        </div>

        <div
          style={{
            ...styles.main,
            ...(shared ? { justifyContent: 'center' } : {}),
          }}
        >
          <div
            className="stagger"
            style={{
              ...styles.left,
              '--stagger-base': '0.15s',
              '--stagger-step': '0.12s',
              ...(shared ? { maxWidth: '900px', flex: 'none' } : {}),
            }}
          >
            <h2 style={styles.title}>
              {data?.MODE === 'banking' ? (
                <>
                  Let&rsquo;s make Yuno the engine under{' '}
                  <span style={styles.accent}>your brand</span>
                </>
              ) : data?.MODE === 'partner' ? (
                <>
                  Let&rsquo;s scale your merchant reach{' '}
                  <span style={styles.accent}>together</span>
                </>
              ) : (
                <>
                  Let&rsquo;s build the payment stack of the internet economy,{' '}
                  <span style={styles.accent}>together</span>
                </>
              )}
            </h2>
            <p style={styles.subtitle}>
              {data?.MODE === 'banking' ? (
                <>Keep the customer, keep the brand, keep the commercials. Yuno carries the <strong style={{ color: theme.ink }}>global stack</strong> underneath.</>
              ) : data?.MODE === 'partner' ? (
                <>One integration with Yuno puts <strong style={{ color: theme.ink }}>{data.COMPANY_NAME}</strong> in front of the enterprise merchants already running on our platform.</>
              ) : (
                <>Yuno will be <strong style={{ color: theme.ink }}>{data.COMPANY_NAME}</strong>'s last payment integration ever</>
              )}
            </p>
            <div className="stagger" style={{ ...styles.stats, '--stagger-base': '0.42s', '--stagger-step': '0.08s' }}>
              {(data?.MODE === 'banking'
                ? [
                    { n: '+8pp', l: 'inDrive · auth uplift' },
                    { n: '27',   l: 'Rappi · APMs in 12 months' },
                    { n: '21',   l: 'McDonald’s · countries on 1 dashboard' },
                  ]
                : data?.MODE === 'partner'
                ? [
                    { n: '2,000+', l: 'enterprise merchants on Yuno' },
                    { n: '$80B+',  l: 'TPV per year routed' },
                    { n: 'Weeks',  l: 'to activate, not months' },
                  ]
                : [
                    { n: '+3–8%', l: 'authorization uplift' },
                    { n: '25%+',  l: 'declines recovered' },
                    { n: 'Weeks', l: 'to launch markets' },
                  ]
              ).map((s) => (
                <div key={s.l} style={styles.stat}>
                  <div style={styles.statNum}>{s.n}</div>
                  <div style={styles.statLabel}>{s.l}</div>
                </div>
              ))}
            </div>

            {data?.COMPANY_SLUG && (
              <a
                data-download-deck
                href={`/api/pdf/${encodeURIComponent(data.COMPANY_SLUG)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.downloadDeck}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(62,79,224,0.18)'
                  e.currentTarget.style.borderColor = 'rgba(124,137,239,0.75)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(62,79,224,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(124,137,239,0.45)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span>Open the full deck (PDF)</span>
              </a>
            )}
          </div>

          {!shared && (
          <div className="reveal" style={{ ...styles.right, '--reveal-delay': '0.35s' }}>
            <div
              className="border-beam"
              style={{ ...styles.formCard, '--beam-duration': '28s' }}
            >
              <div style={styles.formHeader}>
                <span style={styles.formTitle}>Let&rsquo;s keep the conversation going.</span>
                <span style={styles.formSubtitle}>
                  Book a demo to know more about Yuno platform.
                </span>
              </div>

              <a
                href="https://y.uno/book-a-demo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.sendBtn,
                  textDecoration: 'none',
                  textAlign: 'center',
                  transform: hovering ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: hovering
                    ? '0 8px 32px rgba(62,79,224,0.5)'
                    : '0 4px 20px rgba(62,79,224,0.3)',
                }}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                Book a Demo →
              </a>

              <button
                type="button"
                onClick={async () => {
                  // Build a shareable URL that lands the recipient directly
                  // on this merchant's deck, skipping the "Type client URL"
                  // onboarding screen. The merchant state lives in JS, not
                  // the URL bar, so we have to reconstruct the link from
                  // `data` rather than just copy window.location.
                  // Prefer the raw URL the presenter typed (e.g. "amazon.com")
                  // so the share link's /api/site-info call has a real domain
                  // to scrape. Fallback to the slug/name only when no input
                  // URL was preserved.
                  const slug = data?.INPUT_URL
                    || data?.SLUG
                    || data?.COMPANY_SLUG
                    || (data?.COMPANY_NAME
                      ? String(data.COMPANY_NAME)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '')
                      : null)
                  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
                  let deckUrl
                  if (slug) {
                    const params = new URLSearchParams()
                    if (Array.isArray(data?.REGIONS) && data.REGIONS.length) {
                      params.set('regions', data.REGIONS.join(','))
                    }
                    if (Array.isArray(data?.COUNTRIES) && data.COUNTRIES.length) {
                      params.set('countries', data.COUNTRIES.join(','))
                    }
                    const qs = params.toString()
                    deckUrl = `${window.location.origin}${base}m/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
                  } else {
                    // No merchant data yet — fall back to the current URL
                    // (probably the landing page).
                    deckUrl = window.location.href
                  }
                  try {
                    await navigator.clipboard.writeText(deckUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    // Fallback: prompt so the user can copy manually if
                    // clipboard API is blocked (e.g. iframe + no HTTPS).
                    window.prompt('Copy this link:', deckUrl)
                  }
                }}
                style={{
                  ...styles.sendBtn,
                  background: 'transparent',
                  color: theme.ink,
                  border: `1px solid ${theme.borderAccent}`,
                  boxShadow: 'none',
                  marginTop: 12,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Link copied' : 'Copy interactive deck link'}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
      {/* Hardcoded "09 / 09" reflects the original 9-slide cut. Replit
          (light theme) renders 12 slides total, so the viewer paints
          the canonical auto-numbered overlay instead. */}
      {!theme.isLight && <div style={styles.slideNumber}>09 / 09</div>}
    </div>
  )
}

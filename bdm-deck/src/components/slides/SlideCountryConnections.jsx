import { useState } from 'react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import { getCountryData, hasCoverage, COUNTRY_FLAG } from '../../data/regional-data'
import { getProviders } from '../../data/country-rich-data'
import { getProviderLogoSources, getProviderBrandColor } from '../../data/provider-logos'

// Country connections slide. Renders a four-column table mirroring the
// source deck (Most Relevant / Type / Description / Relevance). When the
// country has curated provider rows we use them as-is; otherwise we fall
// back to the simple processors list with "—" placeholders so the slide
// still ships with the merchant's deck rather than going missing.

export default function SlideCountryConnections({ region, country }) {
  const theme = useTheme()
  const cd = getCountryData(region, country)
  if (!cd) return null
  const covered = hasCoverage(cd)
  const rich = getProviders(country)
  // Build rows: rich curated rows when we have them, otherwise synthesise
  // minimal rows from the simple processors list so the table never sits
  // empty for an in-coverage country.
  const rows = rich
    ? rich
    : (cd.processors || []).map((name) => ({ name, type: '—', description: '—', relevance: '—' }))

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(14px, 1.4vw, 22px)',
      minHeight: 0,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
    },
    flag: {
      fontSize: '48px',
      lineHeight: 1,
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '56px',
      fontWeight: 500,
      letterSpacing: '-0.8px',
      color: theme.accentPale,
      margin: 0,
    },
    intro: {
      padding: '24px 30px',
      background: 'rgba(124,137,239,0.06)',
      border: '1px solid rgba(124,137,239,0.18)',
      borderRadius: '10px',
      fontSize: '20px',
      lineHeight: 1.55,
      color: theme.ink,
    },
    table: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr 1.7fr 1.5fr',
      gap: '0',
      background: 'rgba(124,137,239,0.04)',
      border: '1px solid rgba(124,137,239,0.16)',
      borderRadius: '12px',
      overflow: 'hidden',
      minHeight: 0,
      alignContent: 'start',
    },
    headerCell: {
      padding: '22px 26px',
      fontFamily: 'var(--font-display)',
      fontSize: '17px',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: theme.accentPale,
      borderBottom: '1px solid rgba(124,137,239,0.25)',
    },
    cell: {
      padding: '22px 26px',
      fontSize: '18px',
      lineHeight: 1.5,
      color: theme.ink,
      borderTop: `1px solid ${theme.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
    },
    nameCell: {
      fontFamily: 'var(--font-display)',
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.1px',
      color: theme.accentPale,
      gap: '14px',
    },
    // Uniform 170×52 logo box. Real logos render as white silhouettes
    // (brightness 0 + invert) so dark colour wordmarks (Stripe, Adyen)
    // and light wordmarks both read against the dark canvas at the
    // same visual weight. Box is transparent — no card chrome so logos
    // float on the slide background like the rest of the deck.
    nameLogoBox: {
      width: '170px',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 0,
      boxSizing: 'border-box',
    },
    nameLogo: {
      maxWidth: '100%',
      maxHeight: '100%',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain',
      display: 'block',
      filter: 'brightness(0) invert(1)',
      opacity: 0.95,
    },
    // Wordmark pill — used when there's no logo asset. Same fixed
    // 170×52 box as the logo so the column stays aligned. Text sits
    // in the provider's brand colour to keep visual variety.
    nameWordmark: {
      width: '170px',
      height: '52px',
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 800,
      letterSpacing: '-0.3px',
      padding: '0 16px',
      borderRadius: '8px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 0,
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    typeCell: {
      color: theme.inkSecondary,
      fontWeight: 500,
    },
    // ---------- No-coverage fallback ----------
    verifyBlock: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(16px, 1.5vw, 28px)',
      padding: 'clamp(40px, 4vw, 80px)',
      background: 'rgba(220,160,90,0.08)',
      border: '1px dashed rgba(220,160,90,0.45)',
      borderRadius: '16px',
      textAlign: 'center',
    },
    verifyKicker: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'clamp(11px, 0.85vw, 14px)',
      fontWeight: 700,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: 'rgba(220,160,90,0.95)',
    },
    verifyTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(22px, 1.9vw, 36px)',
      fontWeight: 600,
      letterSpacing: '-0.6px',
      lineHeight: 1.2,
      color: theme.ink,
      maxWidth: '720px',
    },
    verifyBody: {
      fontSize: 'clamp(13px, 1vw, 16px)',
      lineHeight: 1.6,
      color: theme.inkSecondary,
      maxWidth: '640px',
    },
  }

  return (
    <SlideBase section="Country Coverage">
      <div className="reveal" style={{ ...styles.body, '--reveal-delay': '0.05s' }}>
        <div style={styles.titleRow}>
          <span style={styles.flag} aria-hidden>{COUNTRY_FLAG[country] || '🏳️'}</span>
          <h2 style={styles.title}>{country}</h2>
        </div>

        {covered ? (
          <>
            <div style={styles.intro}>
              We have partnerships with the region's most relevant providers, ranging from the largest players to the niche ones. Thanks to our extensive {region} footprint, we can integrate any PSPs in less than a month and source new ones as needed.
            </div>

            <div style={styles.table}>
              <div style={styles.headerCell}>Most Relevant</div>
              <div style={styles.headerCell}>Type</div>
              <div style={styles.headerCell}>Description</div>
              <div style={styles.headerCell}>Relevance</div>

              {rows.map((row, i) => (
                <ProviderRow key={i} row={row} styles={styles} />
              ))}
            </div>
          </>
        ) : (
          <div style={styles.verifyBlock}>
            <span style={styles.verifyKicker}>Verify before pitch</span>
            <h3 style={styles.verifyTitle}>
              We don't have confirmed connections in {country} yet.
            </h3>
            <p style={styles.verifyBody}>
              The market is on our roadmap but coverage isn't live. Please confirm with the regional team before committing dates to the merchant — we don't want this slide to overstate what Yuno can route in-country today.
            </p>
          </div>
        )}
      </div>
    </SlideBase>
  )
}

function ProviderRow({ row, styles }) {
  const sources = getProviderLogoSources(row.name)
  // Walk the URL chain on each image-load failure. When the cursor
  // advances past the last source we drop to a styled wordmark in the
  // provider's brand colour.
  const [srcIdx, setSrcIdx] = useState(0)
  const current = sources[srcIdx]
  const exhausted = srcIdx >= sources.length
  const brand = getProviderBrandColor(row.name)

  const nameContent = exhausted || !current ? (
    <span style={{ ...styles.nameWordmark, color: brand || styles.nameCell.color }}>
      {row.name || '—'}
    </span>
  ) : (
    <div style={styles.nameLogoBox}>
      <img
        src={current.url}
        alt={row.name}
        style={styles.nameLogo}
        onError={() => setSrcIdx((i) => i + 1)}
      />
    </div>
  )

  return (
    <>
      <div style={{ ...styles.cell, ...styles.nameCell }}>{nameContent}</div>
      <div style={{ ...styles.cell, ...styles.typeCell }}>{row.type || '—'}</div>
      <div style={styles.cell}>{row.description || '—'}</div>
      <div style={styles.cell}>{row.relevance || '—'}</div>
    </>
  )
}

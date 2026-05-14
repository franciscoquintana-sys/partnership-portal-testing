import { useState } from 'react'
import { CreditCard, Calculator, DeviceMobile } from '@phosphor-icons/react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import {
  REGION_LABEL,
  COUNTRY_FLAG,
  COUNTRY_TIER,
  getRegionCountries,
} from '../../data/regional-data'
import { getLocalPMs } from '../../data/country-rich-data'
import { getCountryCoords } from '../../data/country-coords'
import { getPmLogo } from '../../data/provider-logos'

const TIER_BAR_COLOR = {
  1: '#4ADE80',
  2: '#F59E0B',
  3: '#FCD34D',
  'high-risk': '#A1A1AA',
}

export default function SlideRegionPMsMap({ region }) {
  const theme = useTheme()
  const allCountries = getRegionCountries(region)
  const focusCountries = allCountries
    .filter((c) => {
      const t = COUNTRY_TIER[c.country]
      return t === 1 || t === 2
    })
    .sort((a, b) => {
      const ta = COUNTRY_TIER[a.country] ?? 3
      const tb = COUNTRY_TIER[b.country] ?? 3
      if (ta !== tb) return ta - tb
      return a.country.localeCompare(b.country)
    })
  const mid = Math.ceil(focusCountries.length / 2)
  const leftCountries = focusCountries.slice(0, mid)
  const rightCountries = focusCountries.slice(mid)

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: 0,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: '24px',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: '42px',
      fontWeight: 500,
      letterSpacing: '-0.8px',
      lineHeight: 1.15,
      color: theme.accentPale,
      margin: 0,
      maxWidth: '72%',
    },
    legend: {
      display: 'flex',
      flexDirection: 'row',
      gap: '15.5px',
      flexShrink: 0,
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: theme.inkSecondary,
      fontWeight: 500,
    },
    legendIcon: {
      color: theme.accentPale,
    },
    grid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr 1fr',
      gap: '15.5px',
      minHeight: 0,
    },
    side: {
      display: 'flex',
      flexDirection: 'column',
      gap: '11.5px',
      minHeight: 0,
    },
    callout: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px 20px',
      background: 'rgba(124,137,239,0.06)',
      borderRadius: '12px',
      border: '1px solid rgba(124,137,239,0.18)',
      borderLeft: '4px solid',
      flexShrink: 0,
    },
    calloutHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    calloutName: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '0.4px',
      textTransform: 'uppercase',
      color: theme.accentPale,
      flex: 1,
    },
    calloutFlag: {
      fontSize: '26px',
      lineHeight: 1,
    },
    pmRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '17px',
      color: theme.ink,
      fontWeight: 600,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
      minHeight: '24px',
    },
    pmItems: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      flex: 1,
    },
    pmRowMissing: {
      color: theme.inkFaint,
      fontStyle: 'italic',
      textTransform: 'none',
      letterSpacing: 0,
      fontWeight: 400,
    },
    pmIcon: {
      color: theme.accentPale,
      flexShrink: 0,
    },
    // PM brand-kit logos render in their natural colours (the white
    // silhouette filter was flattening transparent-bg PNGs to solid
    // white rectangles for marks like Klarna and PayPal). Height +
    // maxWidth both clamped so wide wordmarks (UPI, KakaoPay) sit at
    // the same visual weight as compact icons (Pix, Bizum) across the
    // row.
    pmLogo: {
      height: '20px',
      width: 'auto',
      maxWidth: '70px',
      objectFit: 'contain',
      display: 'block',
    },
    mapBox: {
      position: 'relative',
      minHeight: 0,
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${theme.borderSubtle}`,
      background: 'rgba(124,137,239,0.04)',
    },
    mapImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      pointerEvents: 'none',
      opacity: 0.5,
    },
    mapDot: {
      position: 'absolute',
      width: '12px',
      height: '12px',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      border: '2px solid rgba(0,0,0,0.32)',
      boxShadow: '0 0 12px rgba(0,0,0,0.4)',
      pointerEvents: 'none',
    },
  }

  function PMItem({ name }) {
    const logo = getPmLogo(name)
    const [failed, setFailed] = useState(false)
    if (logo && !failed) {
      return (
        <img
          src={logo}
          alt={name}
          style={styles.pmLogo}
          onError={() => setFailed(true)}
        />
      )
    }
    return <span>{name}</span>
  }

  function PMRow({ Icon, items }) {
    const list = Array.isArray(items)
      ? items.filter((v) => v && v !== 'x')
      : items && items !== 'x'
        ? [items]
        : []
    const missing = list.length === 0
    return (
      <div style={{ ...styles.pmRow, ...(missing ? styles.pmRowMissing : {}) }}>
        <Icon size={18} weight="fill" style={styles.pmIcon} aria-hidden />
        {missing ? (
          <span>—</span>
        ) : (
          <span style={styles.pmItems}>
            {list.map((v) => <PMItem key={v} name={v} />)}
          </span>
        )}
      </div>
    )
  }

  function Callout({ country }) {
    const pms = getLocalPMs(country)
    const tier = COUNTRY_TIER[country] ?? 3
    const apms = pms?.apms || []
    return (
      <div style={{ ...styles.callout, borderLeftColor: TIER_BAR_COLOR[tier] }}>
        <div style={styles.calloutHeader}>
          <span style={styles.calloutName}>{country}</span>
          <span style={styles.calloutFlag} aria-hidden>{COUNTRY_FLAG[country] || '🏳️'}</span>
        </div>
        <PMRow Icon={CreditCard} items={pms?.localScheme} />
        <PMRow Icon={Calculator} items={pms?.localA2A} />
        <PMRow Icon={DeviceMobile} items={apms} />
      </div>
    )
  }

  return (
    <SlideBase section="T1 and T2 Countries">
      <div className="reveal" style={{ ...styles.body, '--reveal-delay': '0.05s' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            Yuno handles all major international payment methods, while going deep into local ones
          </h2>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <CreditCard size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              Local Scheme
            </span>
            <span style={styles.legendItem}>
              <Calculator size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              Local A2A
            </span>
            <span style={styles.legendItem}>
              <DeviceMobile size={18} weight="fill" style={styles.legendIcon} aria-hidden />
              Most Relevant APMs
            </span>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.side}>
            {leftCountries.map((c) => <Callout key={c.country} country={c.country} />)}
          </div>

          <div style={styles.mapBox}>
            <img src="/sales-deck/world-map.svg" alt="" style={styles.mapImage} />
            {focusCountries.map((c) => {
              const coord = getCountryCoords(c.country)
              if (!coord) return null
              const tier = COUNTRY_TIER[c.country] ?? 3
              return (
                <div
                  key={c.country}
                  style={{
                    ...styles.mapDot,
                    left: `${coord.x}%`,
                    top: `${coord.y}%`,
                    background: TIER_BAR_COLOR[tier],
                  }}
                  aria-label={c.country}
                />
              )
            })}
            <span style={{
              position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
              fontSize: '9px', fontFamily: 'var(--font-mono)',
              letterSpacing: '1.6px', textTransform: 'uppercase', color: theme.inkMuted,
            }}>
              {REGION_LABEL[region]}
            </span>
          </div>

          <div style={styles.side}>
            {rightCountries.map((c) => <Callout key={c.country} country={c.country} />)}
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

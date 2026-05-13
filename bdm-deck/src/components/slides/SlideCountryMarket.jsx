import {
  DeviceMobile, Target, ShoppingCart, Globe,
  FileText, Wallet, CreditCard, TrendUp,
  Monitor, Dress, Sparkle, Truck,
  ShoppingBag, ForkKnife, Airplane, House,
  GameController, Storefront, Phone, Heart,
  Lightning, Scales, Shield, Lock, Coins, UsersThree, ShareNetwork,
} from '@phosphor-icons/react'
import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'
import { getCountryData, COUNTRY_FLAG } from '../../data/regional-data'
import { getPie, getProTips } from '../../data/country-rich-data'

// Pie-chart palette in source-deck order: deep blue → dark → pale →
// mid → grey → soft. Slot one colour per slice in the same order they
// appear in COUNTRY_PIE so the visual reads left-to-right.
const PIE_COLORS = ['#3E4FE0', '#1B1F3A', '#E0E4FA', '#5967E4', '#71717A', '#C5CCFA']

// Keyword-driven icon pickers. Each row in Digital Trends / Pro Tip /
// Verticals previously rotated through a fixed icon array by index, so
// the icon next to "Fashion & Apparel" might end up as a Monitor or a
// Truck depending on its position. Now each bullet picks its own icon
// based on what it actually says. Regex order matters — more specific
// patterns sit above broader ones.

function iconForTrend(text) {
  const t = (text || '').toLowerCase()
  if (/smartphone|mobile penetration/.test(t)) return DeviceMobile
  if (/internet penetration/.test(t)) return Globe
  if (/cagr|growth|projected|by 20\d\d|fastest-growing/.test(t)) return TrendUp
  if (/instant|fast|rail|prompt|insta|sarie|fawran|cliq|wamd|spei|pix|upi|qris/.test(t)) return Lightning
  if (/regulat|law|fintech|compliance|policy|ley|licens|samá|sama|rbi|bdd|bafin/.test(t)) return Scales
  if (/wallet/.test(t)) return Wallet
  if (/market|e-commerce|ecommerce|gmv|tpv/.test(t)) return ShoppingCart
  if (/vision|target|2030/.test(t)) return Target
  if (/user|population/.test(t)) return UsersThree
  return Globe
}

function iconForTip(text) {
  const t = (text || '').toLowerCase()
  if (/regulat|licens|local entity|compliance|sama|rbi|aml|kyc/.test(t)) return Shield
  if (/bnpl|tamara|tabby|klarna|afterpay|installment|taksit|cuotas|parcelado/.test(t)) return Coins
  if (/wallet/.test(t)) return Wallet
  if (/instant|a2a|rail|pix|spei|upi|prompt|fast/.test(t)) return Lightning
  if (/cross-border|multi-currency|currency|fx/.test(t)) return ShareNetwork
  if (/merchant|enterprise|brand/.test(t)) return Storefront
  if (/data|privacy|consent|ccpa|gdpr/.test(t)) return Lock
  if (/scheme|card|mada|knet|benefit|troy|cb |bizum/.test(t)) return CreditCard
  if (/growth|lever|performance|table.?stakes|day 1|priority|uplift|yoy/.test(t)) return TrendUp
  return FileText
}

function iconForVertical(name) {
  const v = (name || '').toLowerCase()
  if (/gaming/.test(v)) return GameController
  if (/quick commerce|delivery/.test(v)) return Truck
  if (/grocery|grocer|food|beverage|restaurant/.test(v)) return ForkKnife
  if (/travel|hospitality|tourism|airline/.test(v)) return Airplane
  if (/home|furniture|living/.test(v)) return House
  if (/telecom|phone/.test(v)) return Phone
  if (/electronic|technology|tech|appliance|media|gadget|mobile/.test(v)) return Monitor
  if (/fashion|clothing|apparel|luxury|shoe|muslim/.test(v)) return Dress
  if (/beauty|cosmetic|wellness|personal care/.test(v)) return Sparkle
  if (/health|supplement/.test(v)) return Heart
  if (/retail|marketplace|shop|store/.test(v)) return Storefront
  return ShoppingBag
}

// Build an SVG arc path from an angle range.
function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, endAngle)
  const end = polar(cx, cy, r, startAngle)
  const large = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`
}
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function SlideCountryMarket({ region, country }) {
  const theme = useTheme()
  const cd = getCountryData(region, country)
  if (!cd) return null
  const pie = getPie(country)
  const proTips = getProTips(country)
  // Fallback: when no curated pro tips, fall back to the first 4 digital
  // trends so the panel never renders empty.
  const tips = proTips || cd.digitalTrends?.slice(0, 4) || []
  const trends = cd.digitalTrends?.slice(0, 4) || []
  const verticals = cd.verticals?.slice(0, 4) || []

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
    grid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1.25fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '24px',
      minHeight: 0,
    },
    panel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '32px',
      background: 'rgba(124,137,239,0.04)',
      border: '1px solid rgba(124,137,239,0.16)',
      borderRadius: '14px',
      minHeight: 0,
      minWidth: 0,
    },
    panelTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '2.2px',
      textTransform: 'uppercase',
      color: theme.accentPale,
    },
    columnsRow: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '20px',
      minHeight: 0,
    },
    column: {
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    },
    columnIcon: {
      color: theme.accentPale,
    },
    columnText: {
      fontSize: '17px',
      lineHeight: 1.4,
      color: theme.ink,
      fontWeight: 500,
    },
    pieRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '32px',
      flex: 1,
      minHeight: 0,
    },
    pieSvg: {
      flexShrink: 0,
    },
    pieLegend: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flex: 1,
    },
    pieLegendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '17px',
      color: theme.ink,
      fontWeight: 500,
    },
    pieLegendDot: {
      width: '14px',
      height: '14px',
      borderRadius: '3px',
      flexShrink: 0,
    },
    piePct: {
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 700,
      marginLeft: 'auto',
      color: theme.accentPale,
      fontSize: '18px',
    },
    pieEmpty: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      fontSize: '17px',
      color: theme.inkFaint,
      fontStyle: 'italic',
    },
    verticalsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      flex: 1,
      alignItems: 'center',
    },
    verticalItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
      textAlign: 'center',
    },
    verticalIconWrap: {
      width: '72px',
      height: '72px',
      borderRadius: '50%',
      background: 'rgba(124,137,239,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
    },
    verticalLabel: {
      fontSize: '17px',
      fontWeight: 600,
      color: theme.ink,
      lineHeight: 1.25,
    },
  }

  // Compute pie arcs once.
  const total = pie ? pie.reduce((s, p) => s + p.pct, 0) : 0
  let cursor = 0
  const arcs = pie ? pie.map((slice, i) => {
    const startAngle = (cursor / total) * 360
    cursor += slice.pct
    const endAngle = (cursor / total) * 360
    return { d: arcPath(80, 80, 78, startAngle, endAngle), color: PIE_COLORS[i % PIE_COLORS.length] }
  }) : []

  return (
    <SlideBase section="Country Brief">
      <div className="reveal" style={{ ...styles.body, '--reveal-delay': '0.05s' }}>
        <div style={styles.titleRow}>
          <span style={styles.flag} aria-hidden>{COUNTRY_FLAG[country] || '🏳️'}</span>
          <h2 style={styles.title}>{country}</h2>
        </div>

        <div style={styles.grid}>
          {/* Top-left: Digital Trends */}
          <div style={styles.panel}>
            <span style={styles.panelTitle}>Digital Trends</span>
            <div style={styles.columnsRow}>
              {trends.map((t, i) => {
                const Icon = iconForTrend(t)
                return (
                  <div key={i} style={styles.column}>
                    <Icon size={36} weight="duotone" style={styles.columnIcon} aria-hidden />
                    <span style={styles.columnText}>{t}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top-right: Pie chart */}
          <div style={styles.panel}>
            <span style={styles.panelTitle}>Primary Payment Methods in E-Commerce</span>
            {pie ? (
              <div style={styles.pieRow}>
                <svg width="220" height="220" viewBox="0 0 160 160" style={styles.pieSvg} aria-hidden>
                  {arcs.map((a, i) => (
                    <path key={i} d={a.d} fill={a.color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                  ))}
                </svg>
                <div style={styles.pieLegend}>
                  {pie.map((p, i) => (
                    <div key={i} style={styles.pieLegendItem}>
                      <span style={{ ...styles.pieLegendDot, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span>{p.label}</span>
                      <span style={styles.piePct}>{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={styles.pieEmpty}>Payment-share breakdown not yet curated for {country}.</div>
            )}
          </div>

          {/* Bottom-left: Pro Tip */}
          <div style={styles.panel}>
            <span style={styles.panelTitle}>Pro Tip</span>
            <div style={styles.columnsRow}>
              {tips.map((t, i) => {
                const Icon = iconForTip(t)
                return (
                  <div key={i} style={styles.column}>
                    <Icon size={36} weight="duotone" style={styles.columnIcon} aria-hidden />
                    <span style={styles.columnText}>{t}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom-right: Verticals */}
          <div style={styles.panel}>
            <span style={styles.panelTitle}>Key E-comm Verticals</span>
            <div style={styles.verticalsRow}>
              {verticals.map((v) => {
                const Icon = iconForVertical(v)
                return (
                  <div key={v} style={styles.verticalItem}>
                    <div style={styles.verticalIconWrap}>
                      <Icon size={36} weight="duotone" aria-hidden />
                    </div>
                    <span style={styles.verticalLabel}>{v}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </SlideBase>
  )
}

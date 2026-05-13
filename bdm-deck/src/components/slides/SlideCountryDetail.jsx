import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

// Country Detail slide — embeds the portal's own /insights Country Detail
// view (same-origin) inside the deck. embed=1 strips the portal sidebar /
// banner so just the map + filters + per-country panel render. Tweaks to
// what's shown live in templates/insights.html behind a `{% if embed %}`
// branch, so any change in the portal lands here too.

export default function SlideCountryDetail() {
  const theme = useTheme()
  return (
    <SlideBase section="Country Detail" slideNumber={9}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          border: `1px solid ${theme.borderSubtle}`,
          background: theme.isLight ? theme.bgElevated : 'rgba(255,255,255,0.02)',
        }}
      >
        <iframe
          src="/insights?view=country&embed=1"
          title="Country Detail"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            border: 0,
            background: 'transparent',
          }}
        />
      </div>
    </SlideBase>
  )
}

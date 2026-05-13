import SlideBase from './SlideBase'
import { useTheme } from '../../lib/theme'

// Portal-aligned country → ISO-2 lookup (matches COUNTRY_ISO in server.py).
// Used to pull the flag from flagcdn.com so we get a real PNG flag, not a
// Unicode emoji (Windows renders those as country code letters).
const COUNTRY_ISO = {
  'Brazil': 'br', 'Mexico': 'mx', 'Colombia': 'co', 'Argentina': 'ar',
  'Chile': 'cl', 'Peru': 'pe', 'Uruguay': 'uy', 'Ecuador': 'ec',
  'Bolivia': 'bo', 'Paraguay': 'py', 'Venezuela': 've', 'Costa Rica': 'cr',
  'Dominican Republic': 'do', 'Panama': 'pa', 'Guatemala': 'gt',
  'El Salvador': 'sv', 'Honduras': 'hn', 'Nicaragua': 'ni', 'Cuba': 'cu',
  'Puerto Rico': 'pr', 'Jamaica': 'jm', 'Trinidad and Tobago': 'tt',
  'United States': 'us', 'Canada': 'ca',
  'United Kingdom': 'gb', 'Germany': 'de', 'France': 'fr', 'Spain': 'es',
  'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be', 'Switzerland': 'ch',
  'Austria': 'at', 'Sweden': 'se', 'Norway': 'no', 'Denmark': 'dk',
  'Finland': 'fi', 'Iceland': 'is', 'Ireland': 'ie', 'Portugal': 'pt',
  'Poland': 'pl', 'Czech Republic': 'cz', 'Slovakia': 'sk', 'Hungary': 'hu',
  'Romania': 'ro', 'Bulgaria': 'bg', 'Greece': 'gr', 'Croatia': 'hr',
  'Slovenia': 'si', 'Estonia': 'ee', 'Latvia': 'lv', 'Lithuania': 'lt',
  'Luxembourg': 'lu', 'Malta': 'mt', 'Cyprus': 'cy', 'Serbia': 'rs',
  'Ukraine': 'ua', 'Russia': 'ru',
  'UAE': 'ae', 'Saudi Arabia': 'sa', 'Qatar': 'qa', 'Kuwait': 'kw',
  'Bahrain': 'bh', 'Oman': 'om', 'Jordan': 'jo', 'Lebanon': 'lb',
  'Israel': 'il', 'Turkey': 'tr', 'Iraq': 'iq', 'Iran': 'ir',
  'India': 'in', 'China': 'cn', 'Japan': 'jp', 'South Korea': 'kr',
  'Singapore': 'sg', 'Hong Kong': 'hk', 'Taiwan': 'tw', 'Malaysia': 'my',
  'Indonesia': 'id', 'Philippines': 'ph', 'Thailand': 'th', 'Vietnam': 'vn',
  'Australia': 'au', 'New Zealand': 'nz', 'Bangladesh': 'bd', 'Pakistan': 'pk',
  'Sri Lanka': 'lk', 'Nepal': 'np', 'Cambodia': 'kh', 'Myanmar': 'mm',
  'Egypt': 'eg', 'Morocco': 'ma', 'Algeria': 'dz', 'Tunisia': 'tn',
  'South Africa': 'za', 'Kenya': 'ke', 'Nigeria': 'ng', 'Ghana': 'gh',
  'Ethiopia': 'et', 'Tanzania': 'tz', 'Uganda': 'ug', 'Rwanda': 'rw',
  'Zambia': 'zm', 'Zimbabwe': 'zw', 'Mozambique': 'mz', 'Angola': 'ao',
  'Cameroon': 'cm', 'Senegal': 'sn', "Côte d'Ivoire": 'ci',
  'Botswana': 'bw', 'Mauritius': 'mu',
}

export default function SlideCountryDetailPage({ selectedCountry }) {
  const theme = useTheme()
  const iso = selectedCountry ? COUNTRY_ISO[selectedCountry] : null

  const styles = {
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'clamp(20px, 2vw, 40px)',
      minHeight: 0,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(20px, 1.8vw, 36px)',
      flexShrink: 0,
    },
    flag: {
      width: 'clamp(80px, 7vw, 124px)',
      height: 'auto',
      borderRadius: '10px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      objectFit: 'cover',
      flexShrink: 0,
    },
    name: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(40px, 3.8vw, 72px)',
      fontWeight: 700,
      letterSpacing: '-1.2px',
      lineHeight: 1.05,
      color: theme.ink,
      margin: 0,
    },
    empty: {
      fontFamily: 'var(--font)',
      fontSize: 'clamp(18px, 1.5vw, 28px)',
      color: theme.inkMuted,
      lineHeight: 1.5,
    },
  }

  return (
    <SlideBase section="Country Detail">
      <div style={styles.body}>
        {selectedCountry ? (
          <div style={styles.titleRow}>
            {iso && (
              <img
                src={`https://flagcdn.com/w240/${iso}.png`}
                alt={`${selectedCountry} flag`}
                style={styles.flag}
              />
            )}
            <h2 style={styles.name}>{selectedCountry}</h2>
          </div>
        ) : (
          <p style={styles.empty}>
            Pick a country on the previous slide to see its detail here.
          </p>
        )}
      </div>
    </SlideBase>
  )
}

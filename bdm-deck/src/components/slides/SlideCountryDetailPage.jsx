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
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(28px, 3vw, 60px)',
      minHeight: 0,
      padding: 'clamp(40px, 4vw, 80px)',
    },
    flag: {
      width: 'clamp(180px, 18vw, 320px)',
      height: 'auto',
      borderRadius: '14px',
      boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      objectFit: 'cover',
    },
    name: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(56px, 6.5vw, 120px)',
      fontWeight: 700,
      letterSpacing: '-2px',
      lineHeight: 1.02,
      color: theme.ink,
      margin: 0,
      textAlign: 'center',
    },
    empty: {
      fontFamily: 'var(--font)',
      fontSize: 'clamp(18px, 1.5vw, 28px)',
      color: theme.inkMuted,
      textAlign: 'center',
      lineHeight: 1.5,
    },
  }

  return (
    <SlideBase section="Country Detail">
      <div style={styles.body}>
        {selectedCountry ? (
          <>
            {iso && (
              <img
                src={`https://flagcdn.com/w320/${iso}.png`}
                alt={`${selectedCountry} flag`}
                style={styles.flag}
              />
            )}
            <h2 style={styles.name}>{selectedCountry}</h2>
          </>
        ) : (
          <p style={styles.empty}>
            Pick a country on the previous slide to see its detail here.
          </p>
        )}
      </div>
    </SlideBase>
  )
}

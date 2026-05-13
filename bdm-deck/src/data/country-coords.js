// Approximate x/y percent coordinates for each country on world-map.svg.
// Used by SlideRegionOverview to drop pulse pins for every country we cover
// in a selected region. Values are eyeballed against the SVG viewbox; exact
// capital-city precision isn't important since the map is decorative and
// the sidebar carries the canonical list.

export const COUNTRY_COORDS = {
  // Americas
  'United States': { x: 22, y: 38 },
  'Canada': { x: 22, y: 26 },
  'Mexico': { x: 18, y: 47 },
  // LATAM
  'Brazil': { x: 33, y: 65 },
  'Colombia': { x: 27, y: 56 },
  'Chile': { x: 28, y: 73 },
  'Argentina': { x: 30, y: 75 },
  'Peru': { x: 25, y: 62 },
  // Europe
  'United Kingdom': { x: 47, y: 30 },
  'Germany': { x: 51, y: 32 },
  'France': { x: 49, y: 35 },
  'Spain': { x: 47, y: 38 },
  'Netherlands': { x: 50, y: 31 },
  'Italy': { x: 52, y: 38 },
  'Poland': { x: 54, y: 31 },
  'Sweden': { x: 53, y: 24 },
  // APAC
  'Japan': { x: 86, y: 38 },
  'South Korea': { x: 83, y: 38 },
  'India': { x: 71, y: 48 },
  'Indonesia': { x: 80, y: 62 },
  'Singapore': { x: 79, y: 58 },
  'Australia': { x: 86, y: 72 },
  'Philippines': { x: 84, y: 55 },
  'Thailand': { x: 77, y: 53 },
  // MENAT
  'Saudi Arabia': { x: 60, y: 47 },
  'United Arab Emirates': { x: 63, y: 48 },
  'Turkey': { x: 57, y: 38 },
  'Qatar': { x: 62, y: 47 },
  'Kuwait': { x: 61, y: 45 },
  'Bahrain': { x: 62, y: 46 },
  'Oman': { x: 64, y: 50 },
  'Jordan': { x: 58, y: 43 },
  'Egypt': { x: 57, y: 47 },
  'Morocco': { x: 47, y: 44 },
  'Iraq': { x: 60, y: 42 },
  'Algeria': { x: 50, y: 45 },
  'Tunisia': { x: 52, y: 42 },
  'Libya': { x: 54, y: 47 },
  'Lebanon': { x: 58, y: 42 },
  'Djibouti': { x: 61, y: 55 },
  'Iran': { x: 64, y: 42 },
  'Yemen': { x: 62, y: 52 },
  'Syria': { x: 58, y: 41 },
  'Palestine': { x: 58, y: 43 },
}

export function getCountryCoords(country) {
  return COUNTRY_COORDS[country] || null
}

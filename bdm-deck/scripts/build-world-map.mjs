// Generates a land-only world map SVG at public/world-map.svg from Natural
// Earth 1:110m land topology, using geoEqualEarth projection. One path per
// continent landmass (no country borders, no subdivisions) so the result is
// a clean coastline silhouette — the Plaid/Mercury treatment.
//
// Run: npm run build:world-map
// Re-run only when you want to change projection/resolution.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { feature } from 'topojson-client'
import { geoEqualEarth, geoPath } from 'd3-geo'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')

const WIDTH = 2000
const HEIGHT = 1000

const topo = JSON.parse(readFileSync('/tmp/land-110m.json', 'utf8'))
const land = feature(topo, topo.objects.land)

const projection = geoEqualEarth().fitSize([WIDTH, HEIGHT], land)
const path = geoPath(projection)
const d = path(land)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet">
  <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
</svg>
`

writeFileSync(resolve(appRoot, 'public/world-map.svg'), svg)

// Also emit the projection function output so we can compute office pixel
// positions with the same equal-earth projection at build time. Saves a tiny
// JSON of { city: [xPct, yPct] } for SlideGlobalPresence to consume — no more
// manual lat/lon → equirectangular math.
const OFFICES = [
  ['New York',      -74.006,   40.7128],
  ['Miami',         -80.1918,  25.7617],
  ['Mexico City',   -99.1332,  19.4326],
  ['Bogota',        -74.0721,   4.7110],
  ['Sao Paulo',     -46.6333, -23.5505],
  ['Buenos Aires',  -58.3816, -34.6037],
  ['London',         -0.1276,  51.5074],
  ['Paris',           2.3522,  48.8566],
  ['Madrid',         -3.7038,  40.4168],
  ['Oporto',         -8.6291,  41.1579],
  ['Warsaw',         21.0122,  52.2297],
  ['Dubai',          55.2708,  25.2048],
  ['Doha',           51.5310,  25.2854],
  ['Shanghai',      121.4737,  31.2304],
  ['Singapore',     103.8198,   1.3521],
]

const offices = OFFICES.map(([city, lon, lat]) => {
  const [x, y] = projection([lon, lat])
  return { city, x: +(x / WIDTH * 100).toFixed(2), y: +(y / HEIGHT * 100).toFixed(2) }
})

writeFileSync(
  resolve(appRoot, 'src/data/offices.generated.json'),
  JSON.stringify(offices, null, 2) + '\n',
)

console.log(`Wrote public/world-map.svg (${svg.length} bytes, 1 path)`)
console.log(`Wrote src/data/offices.generated.json (${offices.length} offices, Equal Earth projection)`)

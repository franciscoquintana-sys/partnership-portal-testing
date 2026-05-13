// Scan the source "Logos Merchants" folder + public/merchants.csv, copy
// every logo into public/merchants/ under a slugified filename, and emit a
// manifest at src/data/merchants.generated.js that the app uses to resolve
// merchant input → display name + logo path.
//
// Re-run after dropping new logos into the source folder:
//   npm run build:merchants
//
// Idempotent: overwrites destination files, rewrites the manifest.

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs'
import { join, extname, basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Preprocess a merchant logo so it renders as a white silhouette on the
// dark deck background with NO white card wrapper needed.
//
// Technique: darkness-as-alpha. For each pixel:
//   - R = G = B = 255 (pure white)
//   - A = (255 - luminance) * originalAlpha / 255
//
// Result: dark ink in the source (black Disney script) becomes fully
// opaque white; white/light backgrounds become fully transparent. Works
// uniformly for dark-on-white PNGs without alpha, dark-on-transparent
// PNGs with alpha, and rasterized SVGs.
// Universal pipeline: corner-color subtraction with nearest-corner
// matching (handles gradients), plus a low-end threshold that snaps
// background noise to fully transparent. Works for:
//   - dark-on-white / dark-on-transparent sources (Disney, Amazon)
//   - colored-on-white (Facebook, Meta, Spotify)
//   - colored-on-dark (Netflix red-on-black)
//   - white-on-colored (Vivenu white-on-blue)
//   - off-white bgs (eBay's #F5F5F3)
//   - saturated colored bgs (Lyft pink)
//   - gradient bgs (Trip.com blue gradient)
async function toWhiteOnTransparent(srcPath, dstPath, { upscaleWidth = null } = {}) {
  const isSvg = srcPath.toLowerCase().endsWith('.svg')
  const base = isSvg
    ? sharp(srcPath).resize({ width: 1024, withoutEnlargement: false })
    : upscaleWidth
      ? sharp(srcPath).resize({ width: upscaleWidth, withoutEnlargement: false })
      : sharp(srcPath)
  const { data, info } = await base
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  // Sample 4 corners. We keep each corner's color separately (not a
  // single average) so we can measure per-pixel distance against the
  // NEAREST corner - handles gradient bgs like Trip.com cleanly.
  const cornerCoords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  const cornerRGB = []
  let cornersWithPartialAlpha = 0
  for (const [x, y] of cornerCoords) {
    const i = (y * width + x) * channels
    const a = data[i + 3]
    if (a > 128) cornerRGB.push([data[i], data[i + 1], data[i + 2]])
    // < 220 filters out PNG/JPG encoding noise (254-255 round-trip).
    // Real anti-aliased edges land at much lower alpha (150-200).
    if (a < 220 && a > 0) cornersWithPartialAlpha++
  }
  const hasTransparentBg = cornerRGB.length === 0

  // Partial-alpha corners: content extends to edges with anti-aliased
  // alpha (e.g. Netflix red wordmark filling the whole frame, corners
  // at 152-201 alpha). Corner-subtraction would wipe the entire image
  // since every pixel is the "bg" color. Use srcAlpha pass-through: the
  // source's alpha channel already IS the mask we want. Require at
  // least 2 corners with partial alpha to avoid false positives from
  // single-pixel edge noise (Fanatics has one corner at 254).
  const useSrcAlphaPassThrough = !hasTransparentBg && cornersWithPartialAlpha >= 2

  // ---- Fill-plus-glyph detection (Fanvue case)
  // When the source has transparent corners AND its opaque content has
  // a dominant mid-luma saturated color (= colored tile) AND there exist
  // pixels far from that dominant (= the glyph / wordmark inside the
  // tile), treat the dominant color as bg and subtract. This salvages
  // tile-based brand assets where the colored fill is decoration and
  // the actual mark is the contrasting shape inside.
  let dominantFill = null
  if (hasTransparentBg) {
    let rSum = 0, gSum = 0, bSum = 0, n = 0
    for (let i = 0; i < width * height; i++) {
      const a = data[i * channels + 3]
      if (a > 128) {
        rSum += data[i * channels + 0]
        gSum += data[i * channels + 1]
        bSum += data[i * channels + 2]
        n++
      }
    }
    if (n > 0) {
      const avgR = rSum / n
      const avgG = gSum / n
      const avgB = bSum / n
      const avgLuma = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB
      const chroma = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB)
      if (avgLuma > 50 && avgLuma < 210 && chroma > 30) {
        // Count pixels far (> 100 RGB units) from the dominant. If >5%,
        // the content is bimodal → it's a tile + glyph and subtraction
        // is safe. Uniform-color wordmarks (Trip.com blue) fail this
        // check and fall through to the whiteness formula.
        let farCount = 0
        for (let i = 0; i < width * height; i++) {
          const a = data[i * channels + 3]
          if (a > 128) {
            const dr = data[i * channels + 0] - avgR
            const dg = data[i * channels + 1] - avgG
            const db = data[i * channels + 2] - avgB
            if (Math.sqrt(dr * dr + dg * dg + db * db) > 100) farCount++
          }
        }
        if (farCount / n > 0.05) dominantFill = [avgR, avgG, avgB]
      }
    }
  }

  const useCornerSubtraction = !hasTransparentBg && !useSrcAlphaPassThrough
  const useDominantSubtraction = dominantFill !== null
  const refPoints = useCornerSubtraction
    ? cornerRGB
    : useDominantSubtraction
      ? [dominantFill]
      : null

  function distToNearestRef(r, g, b) {
    let min = Infinity
    for (const [cr, cg, cb] of refPoints) {
      const dr = r - cr, dg = g - cg, db = b - cb
      const d2 = dr * dr + dg * dg + db * db
      if (d2 < min) min = d2
    }
    return Math.sqrt(min)
  }

  // First pass (subtraction cases only): find the 98th-percentile
  // distance from the reference. That's the normalization scale.
  let maxDist = 1
  if (refPoints) {
    const dists = []
    for (let i = 0; i < width * height; i++) {
      const r = data[i * channels + 0]
      const g = data[i * channels + 1]
      const b = data[i * channels + 2]
      const a = data[i * channels + 3]
      if (a > 128) dists.push(distToNearestRef(r, g, b))
    }
    dists.sort((x, y) => x - y)
    maxDist = dists[Math.floor(dists.length * 0.98)] || 1
  }

  // Below this normalized distance, snap to fully transparent. Kills
  // JPG compression artifacts and gradient stepping that would otherwise
  // leave a visible tinted rectangle on the deck navy.
  const LOW_THRESHOLD = 0.08

  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels + 0]
    const g = data[i * channels + 1]
    const b = data[i * channels + 2]
    const srcAlpha = data[i * channels + 3]
    let alpha
    if (useSrcAlphaPassThrough) {
      // Content extends to the corners with anti-aliased edges — trust
      // the source's alpha channel directly.
      alpha = srcAlpha
    } else if (refPoints) {
      const d = distToNearestRef(r, g, b)
      const normalized = Math.min(1, d / maxDist)
      if (normalized < LOW_THRESHOLD) {
        alpha = 0
      } else {
        const stretched = (normalized - LOW_THRESHOLD) / (1 - LOW_THRESHOLD)
        alpha = stretched * srcAlpha
      }
    } else {
      // Transparent-bg source with no colored fill detected: classic
      // min(R,G,B) whiteness formula. Any non-white pixel is ink,
      // anti-aliased edges ramp smoothly.
      const whiteness = Math.min(r, g, b)
      alpha = ((255 - whiteness) / 255) * srcAlpha
    }
    out[i * 4 + 0] = 255
    out[i * 4 + 1] = 255
    out[i * 4 + 2] = 255
    out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(alpha)))
  }
  // Trim transparent margins so the glyph fills the frame. Otherwise
  // logos with large empty viewBoxes (e.g. Salesforce's 273x191 cloud
  // floating in mostly whitespace) render tiny with wasted padding on
  // the deck. threshold=5 lets anti-aliased edges survive.
  await sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
    .png({ compressionLevel: 9 })
    .toFile(dstPath)
}

// Slugs that should keep their brand colors intact instead of being
// normalized to a white silhouette. Use for tile-based marks where the
// colored fill IS the brand identity (e.g. Bold One's red BO tile) —
// stripping the red would leave nothing visually distinctive. Any slug in
// this set bypasses toWhiteOnTransparent() and gets a straight format
// conversion from source → PNG.
const RAW_COLOR_SLUGS = new Set()

async function convertRawColor(srcPath, dstPath, { upscaleWidth = 1600 } = {}) {
  const isSvg = srcPath.toLowerCase().endsWith('.svg')
  const base = isSvg
    ? sharp(srcPath).resize({ width: upscaleWidth, withoutEnlargement: false })
    : sharp(srcPath).resize({ width: upscaleWidth, withoutEnlargement: false })
  await base.ensureAlpha().png({ compressionLevel: 9 }).toFile(dstPath)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')

// Default source - the desktop folder the user drops new logos into.
// Override with MERCHANT_LOGO_SRC env var if the folder moves.
const srcLogos =
  process.env.MERCHANT_LOGO_SRC ||
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Logos Merchants'

const dstLogos = join(appRoot, 'public/merchants')
const csvPath = join(appRoot, 'public/merchants.csv')
const manifestPath = join(appRoot, 'src/data/merchants.generated.js')

// ---------- helpers ----------

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Strip filename noise like trailing `-logo` so "Discord-logo.png" slugs as "discord".
function cleanFileSlug(s) {
  return s.replace(/-(logo|logotype|mark|wordmark|icon)$/i, '')
}

// Strip weird double-extensions like "Hertz.svg.png" → base "Hertz", ext ".png".
function normalizeExt(file) {
  const lower = file.toLowerCase()
  if (lower.endsWith('.svg.png')) {
    return { base: file.replace(/\.svg\.png$/i, ''), ext: '.png' }
  }
  const ext = extname(file)
  return { base: basename(file, ext), ext: ext.toLowerCase() }
}

// Strip common corporate suffixes from CSV company names for looser matching.
// e.g. "Alibaba Group" → "alibaba", "Marriott International" → "marriott".
const NAME_NOISE = /\b(group|groups|inc|incorporated|international|intl|corp|corporation|llc|ltd|limited|co|airlines|hotels|resorts|motors|electronics|athletica|studios|media|holdings|bank|financial|technologies|technology)\b/gi

function trimName(name) {
  return name
    .replace(NAME_NOISE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim()
}

// Super-light CSV parse - the CSV is well-formed, no embedded commas in names.
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n')
  const rows = lines.slice(1).map((line) => line.split(','))
  return rows
    .map((cols) => ({
      name: cols[0]?.trim(),
      tier: cols[1]?.trim(),
      industry: cols[2]?.trim() || null,
    }))
    .filter((m) => m.name)
}

// ---------- step 1: copy + normalize source logos ----------

if (!existsSync(srcLogos)) {
  console.error(`Source folder not found: ${srcLogos}`)
  process.exit(1)
}
if (!existsSync(dstLogos)) mkdirSync(dstLogos, { recursive: true })

// Clean any stale files from previous runs (script fully owns this dir).
for (const f of readdirSync(dstLogos)) {
  if (f.startsWith('.')) continue
  unlinkSync(join(dstLogos, f))
}

const slugToLogoPath = {} // slug → public web path (e.g. /merchants/amazon.png)
const slugToLogoMonoPath = {} // slug → mono-silhouette variant (RAW_COLOR_SLUGS only)
const slugToFileSlug = {} // slug → the same slug (for reverse display)

const sourceFiles = readdirSync(srcLogos).filter(
  (f) => !f.startsWith('.') && !f.startsWith('~'),
)

// First pass: figure out which source file wins for each slug (rank
// SVG > PNG > JPG - pre-preprocessing, so vector sources remain highest
// fidelity for rasterization).
const slugToSource = {}
for (const file of sourceFiles) {
  const { base, ext } = normalizeExt(file)
  const s = cleanFileSlug(slug(base))
  if (!s) continue
  const rank = { '.svg': 3, '.png': 2, '.jpg': 1, '.jpeg': 1 }
  const existing = slugToSource[s]
  if (existing && (rank[ext] ?? 0) <= (rank[existing.ext] ?? 0)) continue
  slugToSource[s] = { ext, srcFullPath: join(srcLogos, file) }
}

// Slugs where toWhiteOnTransparent produces a broken output (fully
// transparent PNG for Hostinger, wrong color separation for United
// Airlines). Raw-copy the source SVG instead; SlideCover's
// DARK_LOGO_MERCHANTS set applies brightness(0)+invert(1) at render time
// so the black default-fill paths render white on the dark deck bg.
const RAW_SVG_COPY_OVERRIDES = new Set(['hostinger', 'united-airlines'])

// Slugs whose PNG source has already been pre-processed (pure white RGB
// with an alpha mask carrying the shape). Running toWhiteOnTransparent
// on these would wipe them — the whiteness-as-alpha formula reads them
// as 100% background. Raw-copy the PNG and just trim whitespace.
const PREPROCESSED_PNG_OVERRIDES = new Set(['care-com', 'trip-com'])

// Second pass: preprocess each winning source into a white-on-transparent
// PNG at the destination. All outputs are .png regardless of source type.
console.log(`Preprocessing ${Object.keys(slugToSource).length} logos…`)
for (const [s, { srcFullPath, ext }] of Object.entries(slugToSource)) {
  if (PREPROCESSED_PNG_OVERRIDES.has(s) && ext === '.png') {
    const destName = `${s}.png`
    await sharp(srcFullPath)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
      .png({ compressionLevel: 9 })
      .toFile(join(dstLogos, destName))
    slugToLogoPath[s] = `/merchants/${destName}`
    slugToFileSlug[s] = s
    continue
  }
  if (RAW_SVG_COPY_OVERRIDES.has(s) && ext === '.svg') {
    const destName = `${s}.svg`
    writeFileSync(join(dstLogos, destName), readFileSync(srcFullPath))
    slugToLogoPath[s] = `/merchants/${destName}`
    slugToFileSlug[s] = s
    continue
  }
  const destName = `${s}.png`
  try {
    if (RAW_COLOR_SLUGS.has(s)) {
      // Tile-based mark: keep the color tile for the Cover (rendered
      // without any filter) AND generate a companion "-mono.png" that
      // went through toWhiteOnTransparent so slides with the
      // brightness(0) invert(1) filter get a clean white-on-transparent
      // silhouette instead of a solid white square.
      // Force an upscale on tile sources (often low-res 200x200 JPGs) so
      // both the color tile and the mono silhouette have enough pixels to
      // render crisp at 2x+ sizes on the slides.
      await convertRawColor(srcFullPath, join(dstLogos, destName), { upscaleWidth: 1600 })
      await toWhiteOnTransparent(srcFullPath, join(dstLogos, `${s}-mono.png`), { upscaleWidth: 1600 })
      slugToLogoMonoPath[s] = `/merchants/${s}-mono.png`
    } else {
      await toWhiteOnTransparent(srcFullPath, join(dstLogos, destName))
    }
    slugToLogoPath[s] = `/merchants/${destName}`
    slugToFileSlug[s] = s
  } catch (err) {
    console.error(`  ✗ Failed to process ${srcFullPath}: ${err.message}`)
  }
}

// ---------- step 2: read CSV + resolve each row to a logo ----------

const csvRaw = readFileSync(csvPath, 'utf8')
const csvRows = parseCsv(csvRaw)

// Build an ordered list of candidate slugs for a CSV company name.
// Ordered best → worst: full name, parentheticals removed, noise suffixes
// removed, slash/pipe-split tokens, then each individual word.
function candidateSlugsFor(name) {
  const out = []
  const push = (s) => {
    if (s && !out.includes(s)) out.push(s)
  }
  push(slug(name))
  push(slug(name.replace(/\(.*?\)/g, '').trim()))
  push(slug(trimName(name)))
  for (const part of name.split(/[/|]/)) {
    const p = part.trim()
    if (!p) continue
    push(slug(p))
    push(slug(trimName(p)))
  }
  // Last resort: individual words (helps "Warner Bros. Discovery" → "warner" etc.)
  for (const word of name.split(/\s+/)) {
    push(slug(word))
  }
  return out.filter(Boolean)
}

// Prefix-match fallback: given a candidate slug, find a file slug that
// starts-with or is-started-by it. Handles asymmetric partial matches like
// CSV "Discord" vs file slug "discord" (after cleanFileSlug strips "-logo").
function prefixMatch(candidate, fileSlugs) {
  for (const fs of fileSlugs) {
    if (fs === candidate) return fs
  }
  for (const fs of fileSlugs) {
    if (fs.startsWith(candidate + '-') || candidate.startsWith(fs + '-')) return fs
  }
  return null
}

const fileSlugList = Object.keys(slugToLogoPath)

const merchants = csvRows.map((row) => {
  const candidates = candidateSlugsFor(row.name)
  let logo = null
  let matchedSlug = null
  for (const s of candidates) {
    if (slugToLogoPath[s]) {
      logo = slugToLogoPath[s]
      matchedSlug = s
      break
    }
    const pm = prefixMatch(s, fileSlugList)
    if (pm && slugToLogoPath[pm]) {
      logo = slugToLogoPath[pm]
      matchedSlug = pm
      break
    }
  }
  const logoMono = matchedSlug ? slugToLogoMonoPath[matchedSlug] || null : null
  return {
    name: row.name,
    slug: slug(row.name),
    tier: row.tier || null,
    industry: row.industry,
    logo,
    logoMono,
    matchedSlug,
  }
})

// ---------- step 3: build a merged slug → merchant lookup ----------
// Keyed by CSV slug AND by every file slug (so the app resolves typed input like
// "amazon" or "meta" even when the CSV has it under a combined name).

const lookup = {}
for (const m of merchants) lookup[m.slug] = m

// Alias any file-slug that matches a CSV merchant's matchedSlug to that
// same CSV entry, so short URLs like /m/expedia resolve to the tier-1
// /m/expedia-group record (and thus pick up its Supabase content).
const bySharedMatched = {}
for (const m of merchants) {
  if (m.matchedSlug && !bySharedMatched[m.matchedSlug]) bySharedMatched[m.matchedSlug] = m
}

for (const [fileSlug, path] of Object.entries(slugToLogoPath)) {
  if (lookup[fileSlug]) continue
  if (bySharedMatched[fileSlug]) {
    lookup[fileSlug] = bySharedMatched[fileSlug]
    continue
  }
  // No CSV row maps to this logo - synthesize a display name from the slug.
  const display = fileSlug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
  lookup[fileSlug] = {
    name: display,
    slug: fileSlug,
    tier: null,
    industry: null,
    logo: path,
    logoMono: slugToLogoMonoPath[fileSlug] || null,
    matchedSlug: fileSlug,
  }
}

// ---------- step 4: emit the manifest ----------

if (!existsSync(dirname(manifestPath))) {
  mkdirSync(dirname(manifestPath), { recursive: true })
}

const header = `// GENERATED by scripts/build-merchants.mjs - DO NOT EDIT BY HAND.
// Re-run: npm run build:merchants
// Sources:
//   - ${srcLogos}
//   - public/merchants.csv
// Generated at: ${new Date().toISOString()}
`

const body = `
export const MERCHANTS = ${JSON.stringify(lookup, null, 2)}

export const MERCHANT_LIST = ${JSON.stringify(merchants, null, 2)}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Resolve any user input (typed name or selected CSV row) to a merchant entry.
// Falls back through: exact slug → slash/pipe-split tokens → null.
export function resolveMerchant(input) {
  if (!input) return null
  const trimmed = String(input).trim()
  const direct = MERCHANTS[slugify(trimmed)]
  if (direct) return direct
  for (const token of trimmed.split(/[/|,·]/)) {
    const m = MERCHANTS[slugify(token)]
    if (m) return m
  }
  return null
}
`

writeFileSync(manifestPath, header + body)

// ---------- step 5: report ----------

const matched = merchants.filter((m) => m.logo).length
const unmatched = merchants.filter((m) => !m.logo)

console.log(`Source logos found:      ${sourceFiles.length}`)
console.log(`Logos copied to public:  ${Object.keys(slugToLogoPath).length}`)
console.log(`CSV merchant rows:       ${merchants.length}`)
console.log(`CSV → logo matched:      ${matched} / ${merchants.length}`)
console.log(`Total lookup keys:       ${Object.keys(lookup).length}`)
console.log(`Manifest written:        ${manifestPath.replace(appRoot + '/', '')}`)
if (unmatched.length > 0) {
  console.log('')
  console.log(`Unmatched CSV entries (${unmatched.length}) - need a logo drop or alias:`)
  for (const m of unmatched) console.log(`  · ${m.name}`)
}

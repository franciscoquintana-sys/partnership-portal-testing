// Build step: take each team headshot from public/team-source/, run it
// through @imgly/background-removal-node (u2net-based AI segmentation),
// and composite the subject onto a white square. Output goes to
// public/team/<slug>.png.
//
// Re-run: npm run build:team
//
// Source is public/team-source/ (checked into git so we can re-process
// any time). Outputs are public/team/<slug>.png, overwriting whatever
// lives there.

import { removeBackground } from '@imgly/background-removal-node'
import sharp from 'sharp'
import {
  readdirSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs'
import { join, extname, basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')
const srcDir = join(appRoot, 'public/team-source')
const dstDir = join(appRoot, 'public/team')

if (!existsSync(srcDir)) {
  console.error(`Source folder not found: ${srcDir}`)
  process.exit(1)
}
if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })

// Clean any old non-.png files from dst (we're standardizing on PNG output)
for (const f of readdirSync(dstDir)) {
  if (f.startsWith('.')) continue
  const ext = extname(f).toLowerCase()
  if (ext !== '.png') unlinkSync(join(dstDir, f))
}

// ---- background-removal model is ~80MB, downloaded once on first run.
// Use medium quality — good segmentation for headshots, faster than general.
const config = {
  model: 'medium',
  output: { format: 'image/png', quality: 1.0 },
}

// Normalization targets. All outputs land on an 800×800 white canvas with
// approximately the same head size, so the grid of circular crops in the
// Leadership slide looks uniform. We normalize by HEAD width (widest alpha
// slice in the top third of the subject bbox) rather than full bbox,
// because bbox includes shoulders which vary a lot person-to-person.
const CANVAS = 800
const TARGET_HEAD_WIDTH = 360   // head occupies ~45% of canvas width
const HEAD_TOP_MARGIN = 0.06    // head top sits 6% from canvas top → leaves hair room

// Per-subject vertical nudges (pixels, negative = up). Applied after the
// automatic positioning to correct individual photos where the default
// bottom-alignment leaves the head sitting lower than the rest of the
// grid. Keep to minimum: the pipeline handles most photos fine.
const VERTICAL_NUDGES = {}

// Find the tight alpha bbox + an approximate head width. The top 35% of
// the bbox is where the head lives for typical head-and-shoulders framing;
// the widest opaque slice in that zone is roughly ear-to-ear.
function measureSubject(alpha, W, H) {
  let minX = W, minY = H, maxX = -1, maxY = -1
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) {
      if (alpha[row + x] > 64) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const bboxH = maxY - minY + 1
  const topZoneEnd = minY + Math.floor(bboxH * 0.35)
  let headWidth = 0
  for (let y = minY; y <= topZoneEnd; y++) {
    const row = y * W
    let l = W, r = -1
    for (let x = 0; x < W; x++) {
      if (alpha[row + x] > 64) {
        if (x < l) l = x
        if (x > r) r = x
      }
    }
    if (r > l) {
      const slice = r - l + 1
      if (slice > headWidth) headWidth = slice
    }
  }
  return {
    minX, minY, maxX, maxY,
    bboxW: maxX - minX + 1,
    bboxH,
    bboxCenterX: (minX + maxX) / 2,
    headWidth,
  }
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const sources = readdirSync(srcDir).filter((f) => !f.startsWith('.'))
console.log(`Processing ${sources.length} team photos…\n`)

const results = []
for (const file of sources) {
  const ext = extname(file)
  const base = basename(file, ext)
  const slug = slugify(base)
  const srcPath = join(srcDir, file)
  const dstPath = join(dstDir, `${slug}.png`)

  process.stdout.write(`  ${slug.padEnd(24)} `)
  try {
    // Run the segmentation
    const cutoutBlob = await removeBackground(srcPath, config)
    const cutoutBuf = Buffer.from(await cutoutBlob.arrayBuffer())

    // Measure the subject's alpha bbox + approximate head width, then
    // scale so every face ends up at roughly the same size. Composite
    // onto a fixed CANVAS×CANVAS white square so the rendered circles
    // in the Leadership slide are visually uniform.
    const meta = await sharp(cutoutBuf).metadata()
    const { data: alpha } = await sharp(cutoutBuf)
      .extractChannel('alpha')
      .raw()
      .toBuffer({ resolveWithObject: true })
    const m = measureSubject(alpha, meta.width, meta.height)
    if (!m) throw new Error('no opaque pixels in cutout')

    const scale = TARGET_HEAD_WIDTH / m.headWidth
    const newW = Math.round(meta.width * scale)
    const newH = Math.round(meta.height * scale)
    const scaledCutout = await sharp(cutoutBuf).resize(newW, newH).toBuffer()

    // After scale, bbox coordinates scale accordingly. Place so:
    //   head center-x → canvas center
    //   subject bottom → canvas bottom (fills the circle crop without
    //                    leaving a white band below the torso)
    // If that bottom-alignment would push the head above the canvas,
    // fall back to anchoring head-top at HEAD_TOP_MARGIN instead.
    const sCenterX  = m.bboxCenterX * scale
    const sBboxTop  = m.minY * scale
    const sBboxBot  = m.maxY * scale
    const left = Math.round(CANVAS / 2 - sCenterX)
    const bottomAlignedTop = CANVAS - 1 - sBboxBot
    let top = bottomAlignedTop + sBboxTop >= CANVAS * 0.02
      ? Math.round(bottomAlignedTop)
      : Math.round(CANVAS * HEAD_TOP_MARGIN - sBboxTop)
    top += VERTICAL_NUDGES[slug] || 0

    // Sharp's composite rejects negative offsets and inputs larger than
    // the canvas, so pre-extract only the portion that lands on-canvas.
    const srcX = Math.max(0, -left)
    const srcY = Math.max(0, -top)
    const dstX = Math.max(0, left)
    const dstY = Math.max(0, top)
    const cropW = Math.max(0, Math.min(newW - srcX, CANVAS - dstX))
    const cropH = Math.max(0, Math.min(newH - srcY, CANVAS - dstY))
    if (cropW === 0 || cropH === 0) {
      throw new Error(`positioning left=${left} top=${top} produces empty crop`)
    }
    const visiblePart = await sharp(scaledCutout)
      .extract({ left: srcX, top: srcY, width: cropW, height: cropH })
      .toBuffer()

    const whiteBg = await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    }).png().toBuffer()

    await sharp(whiteBg)
      .composite([{ input: visiblePart, left: dstX, top: dstY }])
      .png({ compressionLevel: 9 })
      .toFile(dstPath)

    const outStats = readFileSync(dstPath).length
    console.log(
      `ok  head=${m.headWidth}→${TARGET_HEAD_WIDTH} (×${scale.toFixed(2)})  ${(outStats / 1024).toFixed(1)}kb`,
    )
    results.push({ slug, ok: true })
  } catch (e) {
    console.log(`FAIL  ${e.message}`)
    results.push({ slug, ok: false, err: e.message })
  }
}

const ok = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)
console.log(`\n${ok} / ${results.length} processed.`)
if (failed.length) {
  console.log(`\nFailed:\n  ${failed.map((r) => `${r.slug}: ${r.err}`).join('\n  ')}`)
  process.exit(1)
}

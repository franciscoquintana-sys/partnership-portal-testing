// Auto-trim transparent whitespace from every provider PNG so the visible
// mark fills the canvas. Reports before/after dimensions. Idempotent —
// re-running on already-trimmed files is a no-op.
import sharp from 'sharp'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'public/logos/providers'
const files = readdirSync(dir).filter((f) => f.endsWith('.png'))

for (const f of files) {
  const path = join(dir, f)
  const before = await sharp(path).metadata()
  const buf = await sharp(path)
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  await sharp(buf).toFile(path)
  const after = await sharp(path).metadata()
  const pct = ((after.width * after.height) / (before.width * before.height) * 100).toFixed(0)
  console.log(
    `${f.padEnd(20)} ${before.width}x${before.height}  →  ${after.width}x${after.height}   (${pct}%)`,
  )
}

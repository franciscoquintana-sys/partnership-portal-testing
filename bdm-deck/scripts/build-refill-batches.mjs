// Splits the 181 refill targets into N batches for parallel research
// agents. Each batch file contains merchant {slug, name, current_psp_names}
// plus a one-line research instruction so the agent prompts stay compact.
//
// Run: node scripts/build-refill-batches.mjs [batches]  (default 10)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const IN = path.join(HERE, 'out', 'psp-refill-targets.json')
const OUT_DIR = path.join(HERE, 'out', 'refill-batches')

const batches = Number(process.argv[2]) || 10
fs.mkdirSync(OUT_DIR, { recursive: true })

const targets = JSON.parse(fs.readFileSync(IN, 'utf8'))
const size = Math.ceil(targets.length / batches)

for (let i = 0; i < batches; i++) {
  const chunk = targets.slice(i * size, (i + 1) * size)
  if (chunk.length === 0) continue
  const simplified = chunk.map((t) => ({
    slug: t.slug,
    name: t.name,
    current_psps: t.current.map((p) => p.name),
    need_additional: Math.max(0, 4 - t.current_psps?.length ?? t.current.length),
  }))
  const file = path.join(OUT_DIR, `batch-${String(i + 1).padStart(2, '0')}.json`)
  fs.writeFileSync(file, JSON.stringify(simplified, null, 2))
  console.log(`batch-${String(i + 1).padStart(2, '0')}.json → ${chunk.length} merchants`)
}

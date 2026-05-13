// READ-ONLY: measure character counts of capability descriptions in Supabase
// `merchants` table and report the distribution against SlideYunoSolve's
// visual budget (comfortable <=240, tight 241-320, overflow >320).
//
// Run: node --env-file=.env.local scripts/audit-capability-lengths.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing Supabase env. Run with: node --env-file=.env.local scripts/audit-capability-lengths.mjs')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await sb
  .from('merchants')
  .select('slug, name, capability_titles, capability_descs')
  .order('slug', { ascending: true })

if (error) {
  console.error('Supabase error:', error)
  process.exit(1)
}

const COMFORT = 240
const TIGHT = 320

const bucketOf = (n) => (n <= COMFORT ? 'comfortable' : n <= TIGHT ? 'tight' : 'overflow')

const rows = []
for (const m of data) {
  const descs = m.capability_descs || []
  const titles = m.capability_titles || []
  for (let i = 0; i < 4; i++) {
    const desc = (descs[i] || '').trim()
    const title = (titles[i] || '').trim()
    rows.push({
      slug: m.slug,
      name: m.name,
      slot: i + 1,
      title,
      desc,
      len: desc.length,
      bucket: bucketOf(desc.length),
    })
  }
}

// Overall summary
const totalMerchants = data.length
const totalCells = rows.length
const byBucket = rows.reduce((acc, r) => ((acc[r.bucket] = (acc[r.bucket] || 0) + 1), acc), {})
const lens = rows.map((r) => r.len).sort((a, b) => a - b)
const avg = Math.round(lens.reduce((s, x) => s + x, 0) / lens.length)
const median = lens[Math.floor(lens.length / 2)]
const p90 = lens[Math.floor(lens.length * 0.9)]
const max = lens[lens.length - 1]
const min = lens[0]

console.log('\n=== CAPABILITY DESCRIPTION LENGTH AUDIT ===')
console.log(`Merchants: ${totalMerchants}`)
console.log(`Capability cells: ${totalCells}`)
console.log(`Buckets  (comfortable <=${COMFORT}, tight ${COMFORT + 1}-${TIGHT}, overflow >${TIGHT}):`)
for (const b of ['comfortable', 'tight', 'overflow']) {
  const c = byBucket[b] || 0
  console.log(`  ${b.padEnd(12)} ${String(c).padStart(4)}  (${((c / totalCells) * 100).toFixed(1)}%)`)
}
console.log(`\nLength stats (chars): min=${min}  avg=${avg}  median=${median}  p90=${p90}  max=${max}`)

// Per-slot bucket counts
console.log('\n=== PER-SLOT BUCKET DISTRIBUTION ===')
console.log('slot | comfortable | tight | overflow | avg | median | max')
for (let s = 1; s <= 4; s++) {
  const slotRows = rows.filter((r) => r.slot === s)
  const slotLens = slotRows.map((r) => r.len).sort((a, b) => a - b)
  const slotAvg = Math.round(slotLens.reduce((a, b) => a + b, 0) / slotLens.length)
  const slotMed = slotLens[Math.floor(slotLens.length / 2)]
  const slotMax = slotLens[slotLens.length - 1]
  const c = slotRows.filter((r) => r.bucket === 'comfortable').length
  const t = slotRows.filter((r) => r.bucket === 'tight').length
  const o = slotRows.filter((r) => r.bucket === 'overflow').length
  console.log(
    `  ${s}  |   ${String(c).padStart(4)}     | ${String(t).padStart(4)}  |  ${String(o).padStart(4)}   | ${String(slotAvg).padStart(3)} |  ${String(slotMed).padStart(3)}   | ${slotMax}`,
  )
}

// Top 10 worst offenders
console.log('\n=== TOP 10 LONGEST (worst offenders) ===')
const worst = [...rows].sort((a, b) => b.len - a.len).slice(0, 10)
for (const r of worst) {
  console.log(`  ${r.len}  ${r.slug}  slot ${r.slot}`)
  console.log(`       "${r.desc.slice(0, 100)}${r.desc.length > 100 ? '...' : ''}"`)
}

// 5 representative "tight" examples (around 260-300 chars)
console.log('\n=== 5 REPRESENTATIVE TIGHT EXAMPLES (260-310 chars) ===')
const tightExamples = rows.filter((r) => r.len >= 260 && r.len <= 310).slice(0, 5)
for (const r of tightExamples) {
  console.log(`  ${r.len}  ${r.slug}  slot ${r.slot}`)
  console.log(`       "${r.desc}"`)
}

// Concentration: how many merchants have ANY overflow vs tight
const merchAny = new Map()
for (const r of rows) {
  const cur = merchAny.get(r.slug) || { overflow: 0, tight: 0 }
  if (r.bucket === 'overflow') cur.overflow++
  if (r.bucket === 'tight') cur.tight++
  merchAny.set(r.slug, cur)
}
const withOverflow = [...merchAny.values()].filter((v) => v.overflow > 0).length
const withTight = [...merchAny.values()].filter((v) => v.tight > 0).length
const withAnyIssue = [...merchAny.values()].filter((v) => v.overflow > 0 || v.tight > 0).length
console.log('\n=== CONCENTRATION ===')
console.log(`Merchants with >=1 overflow cell:         ${withOverflow}/${totalMerchants} (${((withOverflow / totalMerchants) * 100).toFixed(1)}%)`)
console.log(`Merchants with >=1 tight cell:            ${withTight}/${totalMerchants}`)
console.log(`Merchants with >=1 tight or overflow:     ${withAnyIssue}/${totalMerchants}`)

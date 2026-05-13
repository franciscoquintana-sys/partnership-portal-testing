// Applies the PSP top-ups in scripts/sql/merchants-topup-fixes.json so every
// merchant reaches 4 PSPs. For each merchant, appends add_psps to the current
// psps array (preserving existing names/roles, skipping any agent-proposed
// name that already exists in the current set).
//
// Run: node --env-file=.env.local scripts/apply-topup-fixes.mjs [--dry-run]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fixes = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/merchants-topup-fixes.json'), 'utf8'))
const dryRun = process.argv.includes('--dry-run')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing env'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

const slugs = Object.keys(fixes).filter((s) => !s.startsWith('_') && fixes[s]?.add_psps?.length)
console.log(`Merchants to top up: ${slugs.length}`)

let applied = 0, skipped = 0, totalAdded = 0
const chunks = []

for (const slug of slugs) {
  const fix = fixes[slug]
  const { data: row, error } = await sb.from('merchants').select('slug, psps').eq('slug', slug).single()
  if (error) { console.log(`  ! ${slug}: ${error.message}`); skipped++; continue }

  const existingNames = new Set((row.psps || []).map((p) => (p?.name || '').toLowerCase()))
  const additions = fix.add_psps.filter((p) => p?.name && !existingNames.has(p.name.toLowerCase()))
  if (!additions.length) {
    console.log(`  = ${slug}: nothing new to add (all proposed names already present)`)
    skipped++
    continue
  }

  const nextPsps = [...(row.psps || []), ...additions]
  chunks.push({ slug, current: row.psps?.length || 0, nextCount: nextPsps.length, additions, nextPsps })
  totalAdded += additions.length
}

console.log(`Will add ${totalAdded} new PSP entries across ${chunks.length} merchants.`)

if (dryRun) {
  for (const c of chunks.slice(0, 10)) {
    console.log(`[DRY] ${c.slug}: ${c.current} → ${c.nextCount}, adds [${c.additions.map((a) => a.name).join(', ')}]`)
  }
  if (chunks.length > 10) console.log(`  … and ${chunks.length - 10} more`)
  console.log('Dry run, not writing.')
  process.exit(0)
}

for (const c of chunks) {
  const { error } = await sb.from('merchants').update({ psps: c.nextPsps }).eq('slug', c.slug)
  if (error) { console.log(`  ! ${c.slug}: ${error.message}`); continue }
  applied++
  console.log(`  ✓ ${c.slug}: ${c.current} → ${c.nextCount}`)
}

console.log(`Applied: ${applied}, skipped: ${skipped}.`)

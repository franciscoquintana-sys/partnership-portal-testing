// Consolidates the 10 batch-NN-result.json files from the research agents
// and appends the verified additional_psps to each merchant's current
// `psps` array in Supabase. Snapshots before mutating. Dedupes
// case-insensitively against current names.
//
// Run:  node --env-file=.env.local scripts/apply-psp-refill.mjs
// Dry:  add --dry-run

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BATCHES_DIR = path.join(HERE, 'out', 'refill-batches')
const OUT_DIR = path.join(HERE, 'out')

function normKey(s) { return String(s || '').trim().toLowerCase() }

function loadAllResults() {
  const files = fs.readdirSync(BATCHES_DIR).filter((f) => /-result\.json$/.test(f))
  const bySlug = new Map()
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(BATCHES_DIR, file), 'utf8'))
    for (const entry of data) {
      if (!entry?.slug || !Array.isArray(entry.additional_psps)) continue
      if (entry.additional_psps.length === 0) continue
      // An agent could list the same slug twice (unlikely but safe).
      const existing = bySlug.get(entry.slug) || []
      bySlug.set(entry.slug, [...existing, ...entry.additional_psps])
    }
  }
  return bySlug
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const additions = loadAllResults()
  console.log(`Merchants with additions from research: ${additions.size}`)

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // Snapshot current state before the second mutation in this session.
  const { data: before, error: beforeErr } = await sb.from('merchants').select('slug,psps')
  if (beforeErr) { console.error(beforeErr); process.exit(1) }
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(OUT_DIR, `psp-backup-${ts}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2))
  console.log(`Backup: ${backupPath}`)

  const beforeBySlug = new Map(before.map((r) => [r.slug, r.psps || []]))

  let ok = 0, failed = 0, skipped = 0, addedTotal = 0
  for (const [slug, adds] of additions) {
    const current = beforeBySlug.get(slug) || []
    const seen = new Set(current.map((p) => normKey(p.name)))
    const merged = [...current]
    for (const add of adds) {
      if (!add?.name) continue
      const k = normKey(add.name)
      if (seen.has(k)) continue
      seen.add(k)
      // Strip the `source` field — we keep it only in the result files
      // for the audit trail, not in Supabase's display column.
      const { source, ...clean } = add
      merged.push(clean)
      addedTotal++
    }
    if (merged.length === current.length) {
      skipped++
      continue
    }
    if (dryRun) { ok++; continue }
    const { error } = await sb.from('merchants').update({ psps: merged }).eq('slug', slug)
    if (error) {
      console.error(`  FAIL ${slug}: ${error.message}`)
      failed++
    } else {
      ok++
    }
  }
  console.log(`Done. Updated: ${ok}. Skipped (no net new): ${skipped}. Failed: ${failed}. Total PSP entries added: ${addedTotal}.`)
}

main()

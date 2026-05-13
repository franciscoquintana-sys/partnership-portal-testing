// Applies the plan produced by classify-psps.mjs to Supabase.
// Before writing, snapshots the current state of every merchant's `psps`
// column to scripts/out/psp-backup-<ISO>.json so the mutation is
// reversible.
//
// Run:  node --env-file=.env.local scripts/apply-psp-cleanup.mjs
// Dry:  add --dry-run to skip writes
//
// Prereqs: classify-psps.mjs has produced scripts/out/psp-cleanup-plan.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLAN_PATH = path.join(HERE, 'out', 'psp-cleanup-plan.json')
const OUT_DIR = path.join(HERE, 'out')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!fs.existsSync(PLAN_PATH)) {
    console.error(`Plan not found at ${PLAN_PATH}. Run classify-psps.mjs first.`)
    process.exit(1)
  }
  const { plan } = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'))
  console.log(`Loaded plan: ${plan.length} merchants to update`)

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // Snapshot entire current psps state before mutating. Reversible by
  // re-applying the backup row-by-row if we ever need to roll back.
  const { data: before, error: beforeErr } = await sb
    .from('merchants')
    .select('slug,psps')
  if (beforeErr) { console.error(beforeErr); process.exit(1) }
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(OUT_DIR, `psp-backup-${ts}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2))
  console.log(`Backup written: ${backupPath}`)

  if (dryRun) {
    console.log('--dry-run specified, skipping writes.')
    return
  }

  let ok = 0
  let failed = 0
  for (const entry of plan) {
    const { error } = await sb
      .from('merchants')
      .update({ psps: entry.keep })
      .eq('slug', entry.slug)
    if (error) {
      console.error(`  FAIL ${entry.slug}: ${error.message}`)
      failed++
    } else {
      ok++
    }
  }
  console.log(`Done. Updated ${ok}/${plan.length}. Failed: ${failed}.`)
}

main()

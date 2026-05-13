// Persists the render-time "pad to 4 PSPs" logic INTO Supabase so each
// merchant row actually carries 4 { name, role } entries. Research-driven
// real PSPs stay in-place and first; filler spots use a global pool of
// credible enterprise processors (Adyen, Stripe, Braintree, Checkout.com,
// Worldpay, Cybersource), skipping anything that would duplicate a real
// name (case-insensitive) or another already-picked filler.
//
// Snapshots before mutating. Idempotent — re-running after a manual
// correction in Supabase is safe, it just re-tops-up to 4.
//
// Run:  node --env-file=.env.local scripts/fill-supabase-psps-to-four.mjs
// Dry:  add --dry-run

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// Pool of credible global enterprise processors used to fill PSP slots.
// Ordered by how "obvious" they read as a credible PSP in a payments stack.
const FILLER_POOL = [
  { name: 'Adyen',        role: 'Global · acquirer' },
  { name: 'Stripe',       role: 'Global · processor' },
  { name: 'Braintree',    role: 'Global · processor' },
  { name: 'Checkout.com', role: 'Global · processor' },
  { name: 'Worldpay',     role: 'Global · acquirer' },
  { name: 'Cybersource',  role: 'Global · gateway' },
]

function normKey(s) {
  return String(s || '').trim().toLowerCase()
}

// Normalizes a raw PSP entry (string or object) into { name, role } shape.
function toPspObj(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    const name = raw.trim()
    return name ? { name } : null
  }
  if (typeof raw === 'object' && raw.name) return { ...raw, name: String(raw.name).trim() }
  return null
}

// Given a current PSP list, return a list of { name, role } fillers to
// append so the total reaches 4, skipping anything already in the list.
function pickFillers(currentPsps, target = 4) {
  const normalized = (currentPsps || []).map(toPspObj).filter(Boolean)
  if (normalized.length >= target) return []
  const takenKeys = new Set(normalized.map((p) => normKey(p.name)))
  const fillers = []
  for (const candidate of FILLER_POOL) {
    if (normalized.length + fillers.length >= target) break
    if (takenKeys.has(normKey(candidate.name))) continue
    fillers.push(candidate)
    takenKeys.add(normKey(candidate.name))
  }
  return fillers
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: rows, error: readErr } = await sb
    .from('merchants')
    .select('slug, name, psps')
  if (readErr) { console.error(readErr); process.exit(1) }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(OUT_DIR, `psp-backup-${ts}.json`)
  if (!dryRun) {
    fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2))
    console.log(`Backup written: ${backupPath}`)
  }

  let touched = 0
  let skipped = 0
  let failed = 0
  let totalAdded = 0
  const changeLog = []

  for (const row of rows) {
    const current = Array.isArray(row.psps) ? row.psps : []
    const normalized = current.map(toPspObj).filter(Boolean)
    if (normalized.length >= 4) { skipped++; continue }

    const fillers = pickFillers(normalized, 4)
    if (fillers.length === 0) { skipped++; continue }

    const nextPsps = [...normalized, ...fillers]
    changeLog.push({
      slug: row.slug,
      name: row.name,
      before_count: normalized.length,
      added: fillers.map((f) => f.name),
      after_count: nextPsps.length,
    })

    if (dryRun) {
      touched++
      totalAdded += fillers.length
      continue
    }

    const { error: updErr } = await sb
      .from('merchants')
      .update({ psps: nextPsps })
      .eq('slug', row.slug)
    if (updErr) {
      console.error(`[${row.slug}] update failed:`, updErr.message)
      failed++
      continue
    }
    touched++
    totalAdded += fillers.length
  }

  const logPath = path.join(OUT_DIR, `psp-fill-to-four-${ts}.json`)
  if (!dryRun) fs.writeFileSync(logPath, JSON.stringify(changeLog, null, 2))

  console.log('')
  console.log(`Mode:           ${dryRun ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Rows scanned:   ${rows.length}`)
  console.log(`Touched:        ${touched}`)
  console.log(`Skipped:        ${skipped}  (already had 4+ PSPs)`)
  console.log(`Failed:         ${failed}`)
  console.log(`PSP entries +:  ${totalAdded}`)
  if (!dryRun) console.log(`Change log:     ${logPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

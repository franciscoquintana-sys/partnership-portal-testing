// Removes em-dashes (—, U+2014) from every text field on the merchants
// table in Supabase. Em-dashes read as AI-written copy; the deck's editor
// wants them out. En-dashes (–, U+2013) used for number/date ranges
// (e.g. "+3–8%", "April 29–30") are conventional typography and stay.
//
// Replacement policy:
//   - "word — Word"  → "word. Word"   (em-dash joining a new full clause)
//   - "word — word"  → "word, word"   (em-dash mid-phrase)
//   - Double em-dash around a parenthetical (--foo--) → commas
// Each candidate is normalized via a single regex that collapses any
// surrounding whitespace into the replacement token.
//
// Snapshots the full merchants payload before mutating, supports --dry-run.
//
// Run (dry):    node --env-file=.env.local scripts/strip-em-dashes.mjs --dry-run
// Run (apply): node --env-file=.env.local scripts/strip-em-dashes.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// Replace a single em-dash depending on what follows. If the next non-space
// character is a capital letter, treat as a clause break (period + space).
// Otherwise treat as a comma.
function stripEmDashes(input) {
  if (typeof input !== 'string' || !input.includes('—')) return { out: input, changed: false }
  let out = input
  // Walk em-dashes one at a time so we can peek at the following character.
  out = out.replace(/\s*—\s*/g, (_match, offset, full) => {
    // Find first non-space char AFTER the em-dash region we just matched
    const idx = offset + _match.length
    const nextChar = full[idx] || ''
    if (/[A-Z]/.test(nextChar)) return '. '
    return ', '
  })
  // Collapse any accidental ", ," or ". ." duplicates from prior punctuation.
  out = out.replace(/,\s*,/g, ',').replace(/\.\s*\./g, '.')
  return { out, changed: out !== input }
}

function cleanArrayOfStrings(arr) {
  if (!Array.isArray(arr)) return { out: arr, changed: false }
  let changed = false
  const out = arr.map((s) => {
    const r = stripEmDashes(s)
    if (r.changed) changed = true
    return r.out
  })
  return { out, changed }
}

function cleanArrayOfObjects(arr, keys) {
  if (!Array.isArray(arr)) return { out: arr, changed: false }
  let changed = false
  const out = arr.map((item) => {
    if (!item || typeof item !== 'object') return item
    const next = { ...item }
    for (const k of keys) {
      if (typeof next[k] === 'string') {
        const r = stripEmDashes(next[k])
        if (r.changed) { changed = true; next[k] = r.out }
      }
    }
    return next
  })
  return { out, changed }
}

async function main() {
  const dry = process.argv.includes('--dry-run')

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: rows, error } = await sb
    .from('merchants')
    .select('slug, name, pain_titles, capability_titles, capability_descs, psps, missing_methods')
  if (error) { console.error(error); process.exit(1) }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  if (!dry) {
    fs.writeFileSync(path.join(OUT_DIR, `em-dash-backup-${ts}.json`), JSON.stringify(rows, null, 2))
  }

  let touched = 0
  let hitsTotal = 0
  const diffLog = []

  for (const row of rows) {
    const updates = {}
    let rowChanged = false

    const pt = cleanArrayOfStrings(row.pain_titles)
    if (pt.changed) { updates.pain_titles = pt.out; rowChanged = true }

    const ct = cleanArrayOfStrings(row.capability_titles)
    if (ct.changed) { updates.capability_titles = ct.out; rowChanged = true }

    const cd = cleanArrayOfStrings(row.capability_descs)
    if (cd.changed) { updates.capability_descs = cd.out; rowChanged = true }

    const psps = cleanArrayOfObjects(row.psps, ['name', 'role'])
    if (psps.changed) { updates.psps = psps.out; rowChanged = true }

    const mm = cleanArrayOfObjects(row.missing_methods, ['method', 'market'])
    if (mm.changed) { updates.missing_methods = mm.out; rowChanged = true }

    if (!rowChanged) continue

    // Count hits in diff-log for visibility
    const hits = Object.entries(updates).flatMap(([field, val]) => {
      const before = row[field]
      const beforeStr = JSON.stringify(before)
      const afterStr = JSON.stringify(val)
      return [{ field, before: beforeStr, after: afterStr }]
    })
    hitsTotal += hits.length
    touched++
    diffLog.push({ slug: row.slug, name: row.name, fields: Object.keys(updates) })

    console.log(`  ${row.slug.padEnd(22)} fields=[${Object.keys(updates).join(', ')}]`)

    if (!dry) {
      const { error: updErr } = await sb
        .from('merchants')
        .update(updates)
        .eq('slug', row.slug)
      if (updErr) console.error(`  update failed: ${updErr.message}`)
    }
  }

  console.log('')
  console.log(`Mode:        ${dry ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Rows total:  ${rows.length}`)
  console.log(`Rows touched: ${touched}`)
  console.log(`Fields cleaned: ${hitsTotal}`)
  if (!dry) {
    const logPath = path.join(OUT_DIR, `em-dash-strip-${ts}.json`)
    fs.writeFileSync(logPath, JSON.stringify(diffLog, null, 2))
    console.log(`Log: ${logPath}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

// Dumps the live Supabase `merchants` table into a flat CSV for team
// review in Google Sheets or Excel. One row per merchant with every field
// the deck consumes: pains, capabilities (title + desc), PSPs, missing
// methods, capabilities_live. Easy to scan, easy to sort/filter, easy to
// paste into a tracking sheet where teammates flag what's wrong.
//
// Workflow:
//   1. Run this script.
//   2. Upload scripts/out/merchants-review.csv to Google Sheets (or open in
//      Excel / Numbers).
//   3. Share with the team. Add a "corrections" column or use cell comments
//      to flag errors.
//   4. Feed corrections back via the research/fill scripts or manual edits.
//
// Run:
//   node --env-file=.env.local scripts/export-merchants-for-review.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// CSV escaping: wrap in "..." and double any inner quote.
function csv(v) {
  if (v === null || v === undefined) return ''
  const s = String(v).replace(/"/g, '""')
  // Always quote — merchants.name can have commas (e.g. "Bill.com, Inc.")
  // and descriptions span newlines.
  return `"${s}"`
}

// Format a PSP entry from jsonb: { name, role } or "name" → "Name · role".
function fmtPsp(p) {
  if (!p) return ''
  if (typeof p === 'string') return p
  return p.role ? `${p.name} · ${p.role}` : p.name
}

// Format missing method: { method, market } → "Method @ Market".
function fmtMethod(m) {
  if (!m) return ''
  if (typeof m === 'string') return m
  return m.market ? `${m.method} @ ${m.market}` : m.method
}

async function main() {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb
    .from('merchants')
    .select('slug, name, pain_titles, capability_titles, capability_descs, psps, missing_methods, capabilities_live, updated_at')
    .order('name', { ascending: true })
  if (error) { console.error(error); process.exit(1) }

  const CAPS = ['payouts', 'subscriptions', 'tokenization', 'fraud', 'kyc', 'kyb', 'baas']

  const header = [
    'slug', 'name',
    'pain_1', 'pain_2', 'pain_3', 'pain_4', 'pain_5',
    'capability_1_title', 'capability_1_desc',
    'capability_2_title', 'capability_2_desc',
    'capability_3_title', 'capability_3_desc',
    'capability_4_title', 'capability_4_desc',
    'psps',
    'missing_methods',
    'cap_payouts', 'cap_subscriptions', 'cap_tokenization',
    'cap_fraud', 'cap_kyc', 'cap_kyb', 'cap_baas',
    'capabilities_live_count',
    'updated_at',
  ]

  const rows = [header.map(csv).join(',')]

  for (const m of data) {
    const pains = m.pain_titles || []
    const capT = m.capability_titles || []
    const capD = m.capability_descs || []
    const live = new Set(m.capabilities_live || [])
    const row = [
      m.slug,
      m.name,
      pains[0] || '', pains[1] || '', pains[2] || '', pains[3] || '', pains[4] || '',
      capT[0] || '', capD[0] || '',
      capT[1] || '', capD[1] || '',
      capT[2] || '', capD[2] || '',
      capT[3] || '', capD[3] || '',
      (m.psps || []).map(fmtPsp).join(' | '),
      (m.missing_methods || []).map(fmtMethod).join(' | '),
      ...CAPS.map((k) => (live.has(k) ? 'LIVE' : 'missing')),
      live.size,
      m.updated_at,
    ]
    rows.push(row.map(csv).join(','))
  }

  const outPath = path.join(OUT_DIR, 'merchants-review.csv')
  fs.writeFileSync(outPath, rows.join('\n'))
  console.log(`Wrote ${data.length} merchants → ${outPath}`)
  console.log('')
  console.log('Next steps:')
  console.log('  1. Open the CSV in Google Sheets (File → Import → this file)')
  console.log('  2. Share the sheet with the team for review')
  console.log('  3. Add a "corrections" column for flagging issues')
}

main().catch((err) => { console.error(err); process.exit(1) })

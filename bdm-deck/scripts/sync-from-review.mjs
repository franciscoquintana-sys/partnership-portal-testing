// Diff the team-reviewed xlsx (merchants-reviewTEAM.xlsx) against the live
// Supabase `merchants` table and push any cell-level changes. The xlsx is
// the source of truth after this run.
//
// Prereq: /tmp/review-xlsx.json written by a one-liner at the end of this
// file's header (the python block below dumps the xlsx). Run that first:
//
//   python3 - <<'PY'
//   import json, openpyxl
//   wb = openpyxl.load_workbook(
//       '/Users/isabellapdl/Desktop/Stripe Sessions Decks/merchants-reviewTEAM.xlsx',
//       data_only=True)
//   ws = wb['merchants-review']
//   header = [c.value for c in ws[1]]
//   rows = {}
//   for r in ws.iter_rows(min_row=2, values_only=True):
//       rec = dict(zip(header, r))
//       if rec.get('slug'):
//           rows[rec['slug']] = rec
//   json.dump(rows, open('/tmp/review-xlsx.json', 'w'))
//   PY
//
// Then run this script:
//   node --env-file=.env.local scripts/sync-from-review.mjs            # preview
//   node --env-file=.env.local scripts/sync-from-review.mjs --apply    # write

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const XLSX_JSON = '/tmp/review-xlsx.json'
const APPLY = process.argv.includes('--apply')

const CAPS = ['payouts', 'subscriptions', 'tokenization', 'fraud', 'kyc', 'kyb', 'baas']

// ---------- parse helpers ----------

function parsePsps(s) {
  if (!s) return []
  return String(s).split('|').map((x) => x.trim()).filter(Boolean).map((entry) => {
    const [name, ...roleParts] = entry.split(' · ')
    const role = roleParts.join(' · ').trim()
    return role ? { name: name.trim(), role } : { name: name.trim() }
  })
}

function parseMissingMethods(s) {
  if (!s) return []
  return String(s).split('|').map((x) => x.trim()).filter(Boolean).map((entry) => {
    const [method, market] = entry.split(' @ ').map((x) => x.trim())
    return market ? { method, market } : { method }
  })
}

function parseArrayField(row, prefix, max) {
  const out = []
  for (let i = 1; i <= max; i++) {
    const v = row[`${prefix}_${i}`]
    out.push(v == null || v === '' ? '' : String(v))
  }
  // Drop trailing empties so ['a', 'b', '', '', ''] → ['a', 'b']
  while (out.length && !out[out.length - 1]) out.pop()
  return out
}

function parseCapsLive(row) {
  return CAPS.filter((k) => String(row[`cap_${k}`] || '').toUpperCase() === 'LIVE')
}

// Normalize an xlsx row into a shape comparable to a Supabase row.
function normalizeXlsx(row) {
  return {
    name: row.name == null ? null : String(row.name),
    pain_titles: parseArrayField(row, 'pain', 5),
    capability_titles: [1, 2, 3, 4].map((i) => {
      const v = row[`capability_${i}_title`]
      return v == null ? '' : String(v)
    }).filter((x, i, a) => x || a.slice(i).some(Boolean)),
    capability_descs: [1, 2, 3, 4].map((i) => {
      const v = row[`capability_${i}_desc`]
      return v == null ? '' : String(v)
    }).filter((x, i, a) => x || a.slice(i).some(Boolean)),
    psps: parsePsps(row.psps),
    missing_methods: parseMissingMethods(row.missing_methods),
    capabilities_live: parseCapsLive(row),
  }
}

// Normalize a Supabase row the same way so arrays of objects compare
// cleanly regardless of key order.
function normalizeSb(row) {
  return {
    name: row.name,
    pain_titles: row.pain_titles || [],
    capability_titles: row.capability_titles || [],
    capability_descs: row.capability_descs || [],
    psps: (row.psps || []).map((p) =>
      typeof p === 'string' ? { name: p } : (p.role ? { name: p.name, role: p.role } : { name: p.name })
    ),
    missing_methods: (row.missing_methods || []).map((m) =>
      typeof m === 'string' ? { method: m } : (m.market ? { method: m.method, market: m.market } : { method: m.method })
    ),
    capabilities_live: row.capabilities_live || [],
  }
}

function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b)
}

// ---------- main ----------

async function main() {
  const xlsxData = JSON.parse(fs.readFileSync(XLSX_JSON, 'utf8'))
  const xlsxSlugs = new Set(Object.keys(xlsxData))
  console.log(`Loaded ${xlsxSlugs.size} merchants from xlsx`)

  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await sb
    .from('merchants')
    .select('slug, name, pain_titles, capability_titles, capability_descs, psps, missing_methods, capabilities_live')
    .order('slug', { ascending: true })
  if (error) throw error
  const sbBySlug = Object.fromEntries(data.map((r) => [r.slug, r]))
  console.log(`Pulled ${data.length} merchants from Supabase`)

  const COMPARE_FIELDS = [
    'name',
    'pain_titles',
    'capability_titles',
    'capability_descs',
    'psps',
    'missing_methods',
    'capabilities_live',
  ]

  const pending = []
  const onlyInXlsx = []
  const onlyInSb = []

  for (const slug of xlsxSlugs) {
    const xRow = normalizeXlsx(xlsxData[slug])
    const sRow = sbBySlug[slug]
    if (!sRow) {
      onlyInXlsx.push(slug)
      continue
    }
    const sNorm = normalizeSb(sRow)
    const diff = {}
    for (const f of COMPARE_FIELDS) {
      if (!deepEqual(xRow[f], sNorm[f])) {
        diff[f] = { from: sNorm[f], to: xRow[f] }
      }
    }
    if (Object.keys(diff).length) pending.push({ slug, diff, update: xRow })
  }

  for (const sbSlug of Object.keys(sbBySlug)) {
    if (!xlsxSlugs.has(sbSlug)) onlyInSb.push(sbSlug)
  }

  console.log('')
  console.log(`Merchants with changes: ${pending.length}`)
  console.log(`Merchants only in xlsx:  ${onlyInXlsx.length}${onlyInXlsx.length ? '  → ' + onlyInXlsx.join(', ') : ''}`)
  console.log(`Merchants only in Supa:  ${onlyInSb.length}${onlyInSb.length ? '  → ' + onlyInSb.join(', ') : ''}`)
  console.log('')

  for (const { slug, diff } of pending) {
    console.log(`—— ${slug} ——`)
    for (const [f, { from, to }] of Object.entries(diff)) {
      console.log(`  ${f}:`)
      console.log(`    from: ${JSON.stringify(from)}`)
      console.log(`    to:   ${JSON.stringify(to)}`)
    }
  }

  if (!APPLY) {
    console.log('')
    console.log('Preview only. Re-run with --apply to push changes to Supabase.')
    return
  }

  console.log('')
  console.log(`Applying ${pending.length} updates…`)
  let ok = 0
  let fail = 0
  for (const { slug, update } of pending) {
    const patch = {
      name: update.name,
      pain_titles: update.pain_titles,
      capability_titles: update.capability_titles,
      capability_descs: update.capability_descs,
      psps: update.psps,
      missing_methods: update.missing_methods,
      capabilities_live: update.capabilities_live,
    }
    const { error: upErr } = await sb.from('merchants').update(patch).eq('slug', slug)
    if (upErr) {
      console.error(`  ✗ ${slug}: ${upErr.message}`)
      fail++
    } else {
      ok++
    }
  }
  console.log(`Done. ${ok} updated, ${fail} failed.`)
}

main().catch((err) => { console.error(err); process.exit(1) })

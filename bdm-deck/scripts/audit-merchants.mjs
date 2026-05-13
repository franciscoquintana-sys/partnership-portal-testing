// Reads every row in the `merchants` Supabase table and produces an
// inventory of missing / placeholder content so we can spin up a research
// pass that fills the gaps.
//
// Run: node --env-file=.env.local scripts/audit-merchants.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// Same defaults the ingest script uses — anything matching these is a
// "the lookup didn't know what to say" placeholder, not real content.
const PLACEHOLDER_ROLE = 'Regional · gateway'
const PLACEHOLDER_MARKET = 'Regional'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: rows, error } = await sb.from('merchants')
  .select('slug, name, pain_titles, psps, missing_methods, capability_titles, capability_descs')
  .order('slug')

if (error) { console.error(error); process.exit(1) }

function emptyStrings(arr) {
  if (!Array.isArray(arr)) return 0
  return arr.filter((x) => !x || !String(x).trim()).length
}

const report = rows.map((r) => {
  const issues = []

  // Array cardinality vs expected shape
  const painLen = Array.isArray(r.pain_titles) ? r.pain_titles.length : 0
  const capTitlesLen = Array.isArray(r.capability_titles) ? r.capability_titles.length : 0
  const capDescsLen = Array.isArray(r.capability_descs) ? r.capability_descs.length : 0
  const pspLen = Array.isArray(r.psps) ? r.psps.length : 0
  const methodLen = Array.isArray(r.missing_methods) ? r.missing_methods.length : 0

  if (painLen < 5) issues.push(`pain_titles=${painLen}/5`)
  if (emptyStrings(r.pain_titles)) issues.push(`pain_titles_empty=${emptyStrings(r.pain_titles)}`)
  if (capTitlesLen < 4) issues.push(`capability_titles=${capTitlesLen}/4`)
  if (emptyStrings(r.capability_titles)) issues.push(`capability_titles_empty=${emptyStrings(r.capability_titles)}`)
  if (capDescsLen < 4) issues.push(`capability_descs=${capDescsLen}/4`)
  if (emptyStrings(r.capability_descs)) issues.push(`capability_descs_empty=${emptyStrings(r.capability_descs)}`)

  if (pspLen === 0) issues.push('psps=0 (EMPTY)')
  if (methodLen === 0) issues.push('missing_methods=0 (EMPTY)')

  // Placeholder-role PSPs — lookup didn't find a real role for them
  const placeholderPspNames = (r.psps || [])
    .filter((p) => !p?.name || p?.role === PLACEHOLDER_ROLE)
    .map((p) => p?.name || '(no-name)')
  if (placeholderPspNames.length) {
    issues.push(`psps_placeholder_role=${placeholderPspNames.length} [${placeholderPspNames.join(', ')}]`)
  }

  // Placeholder-market methods — same deal for local methods
  const placeholderMethodNames = (r.missing_methods || [])
    .filter((m) => !m?.method || m?.market === PLACEHOLDER_MARKET)
    .map((m) => m?.method || '(no-name)')
  if (placeholderMethodNames.length) {
    issues.push(`methods_placeholder_market=${placeholderMethodNames.length} [${placeholderMethodNames.join(', ')}]`)
  }

  return {
    slug: r.slug,
    name: r.name,
    pain_titles_count: painLen,
    psps_count: pspLen,
    missing_methods_count: methodLen,
    capability_titles_count: capTitlesLen,
    capability_descs_count: capDescsLen,
    placeholder_psps: placeholderPspNames,
    placeholder_methods: placeholderMethodNames,
    issues,
  }
})

// --- SUMMARY ---

const clean = report.filter((r) => !r.issues.length)
const withIssues = report.filter((r) => r.issues.length)

console.log(`Total merchants: ${rows.length}`)
console.log(`Clean (zero issues): ${clean.length}`)
console.log(`With at least one issue: ${withIssues.length}`)
console.log('')

// Bucket issues by type
const buckets = {
  'Empty PSPs': report.filter((r) => r.psps_count === 0),
  'Empty missing_methods': report.filter((r) => r.missing_methods_count === 0),
  'Placeholder PSP roles (lookup miss)': report.filter((r) => r.placeholder_psps.length),
  'Placeholder method markets (lookup miss)': report.filter((r) => r.placeholder_methods.length),
  'Under 5 pain titles': report.filter((r) => r.pain_titles_count < 5),
  'Under 4 capability titles': report.filter((r) => r.capability_titles_count < 4),
  'Under 4 capability descs': report.filter((r) => r.capability_descs_count < 4),
}

for (const [label, list] of Object.entries(buckets)) {
  if (!list.length) continue
  console.log(`${label}: ${list.length}`)
  for (const r of list.slice(0, 20)) {
    const relevant = r.issues.filter((i) =>
      (label.startsWith('Empty PSPs') && i.startsWith('psps=0')) ||
      (label.startsWith('Empty missing_methods') && i.startsWith('missing_methods=0')) ||
      (label.startsWith('Placeholder PSP') && i.startsWith('psps_placeholder_role')) ||
      (label.startsWith('Placeholder method') && i.startsWith('methods_placeholder_market')) ||
      (label.startsWith('Under 5 pain') && i.startsWith('pain_titles=')) ||
      (label.startsWith('Under 4 capability titles') && i.startsWith('capability_titles=')) ||
      (label.startsWith('Under 4 capability descs') && i.startsWith('capability_descs='))
    )
    console.log(`  · ${r.slug}${relevant.length ? ' → ' + relevant.join('; ') : ''}`)
  }
  if (list.length > 20) console.log(`  … and ${list.length - 20} more`)
  console.log('')
}

// Write full JSON for the next agent pass
const outPath = path.join(HERE, 'sql/merchants-audit.json')
fs.writeFileSync(outPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  total: rows.length,
  clean_count: clean.length,
  with_issues_count: withIssues.length,
  merchants: report,
}, null, 2))
console.log(`Full JSON report → ${outPath.replace(path.dirname(HERE) + '/', '')}`)

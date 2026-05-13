// Batch QA pass over every merchants row in Supabase. Produces three
// reports: one for PSP integrity (only real PSPs), one for capability
// coverage (industry-based heuristic), and one for missing-methods
// shape (count, duplicates, single-region overload). Read-only — no
// writes. Output: scripts/out/merchant-qa-<ts>.json + console summary.
//
// Run: node --env-file=.env.local scripts/batch-qa-merchants.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// PSP role allowlist (mirrors qa-topology-strict.mjs). A PSP role is
// valid only if it contains one of these substrings, case-insensitive.
const ALLOWED_ROLE_RE = /\bacquirer|\bgateway|\bprocessor\b|paypal unit|\bapms?\b|\bsmb\b|\bpsp\b/i

// Industry → expected baseline capabilities the merchant should likely
// have running today. If they're missing, we flag the chip as a likely
// oversight rather than a real upsell. This is heuristic; the user
// validates against ground truth before acting.
const INDUSTRY_BASELINE = {
  // Marketplaces and platforms with peer-to-peer flows
  marketplace: ['payouts', 'kyc', 'kyb', 'tokenization', 'fraud'],
  // Travel + hospitality
  travel:      ['tokenization', 'fraud', 'tax'],
  // Subscription DTC
  subscription:['subscriptions', 'tokenization', 'fraud'],
  // E-commerce / retail
  ecommerce:   ['tokenization', 'fraud', 'tax'],
  // SaaS B2B
  saas:        ['subscriptions', 'tokenization', 'fraud', 'tax'],
  // Health/wellness apps (often subscription)
  health:      ['subscriptions', 'tokenization', 'fraud'],
  // Gaming / streaming
  gaming:      ['subscriptions', 'tokenization', 'fraud'],
  // Fintech / banking-adjacent
  fintech:     ['kyc', 'tokenization', 'fraud', 'payouts'],
  // Wallet operators
  wallet:      ['kyc', 'kyb', 'tokenization', 'fraud', 'payouts'],
}

// Map common industry strings (free-form text in merchants.generated.js)
// onto our taxonomy keys above.
function inferIndustryBucket(industry, name) {
  const i = String(industry || '').toLowerCase()
  const n = String(name || '').toLowerCase()
  if (/marketplace/.test(i)) return 'marketplace'
  if (/travel|hospitality|airline|hotel/.test(i)) return 'travel'
  if (/subscription|dtc/.test(i)) return 'subscription'
  if (/saas|software|cloud|infrastructure/.test(i)) return 'saas'
  if (/health|wellness|fitness|nutrition|medical/.test(i)) return 'health'
  if (/gaming|game|stream|media|entertain/.test(i)) return 'gaming'
  if (/fintech|finance|bank|payment|wallet/.test(i)) return /wallet/.test(i + n) ? 'wallet' : 'fintech'
  if (/e-?commerce|retail|shop|store/.test(i)) return 'ecommerce'
  if (/marketplace|two-sided/.test(n)) return 'marketplace'
  return null
}

// Crude region tagger from a missing_methods entry's market field.
// Buckets: latam, north-america, europe, apac, mea, global, unknown.
function regionOf(market) {
  const m = String(market || '').toLowerCase()
  if (/brazil|brasil|mexico|colombia|chile|argentina|peru|uruguay|latam|latin/.test(m)) return 'latam'
  if (/\bus\b|usa|united states|canada|north america/.test(m)) return 'north-america'
  if (/germany|france|italy|spain|netherlands|belgium|poland|portugal|austria|sweden|norway|denmark|finland|baltic|nordic|europe|eu\b|sepa|uk|united kingdom|ireland/.test(m)) return 'europe'
  if (/japan|china|korea|india|thailand|singapore|indonesia|malaysia|vietnam|philippines|taiwan|hong kong|apac|asia|sea\b|inbound/.test(m)) return 'apac'
  if (/saudi|uae|kuwait|qatar|africa|nigeria|south africa|kenya|egypt|mena|mea|middle east/.test(m)) return 'mea'
  if (/global|foreign cards|international/.test(m)) return 'global'
  return 'unknown'
}

async function main() {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: rows, error } = await sb
    .from('merchants')
    .select('slug, name, psps, capabilities_live, missing_methods')
  if (error) { console.error(error); process.exit(1) }

  // Load merchants manifest for industry hints.
  const manifest = JSON.parse(
    fs
      .readFileSync(path.join(HERE, '..', 'src', 'data', 'merchants.generated.js'), 'utf8')
      .match(/export const MERCHANTS = (\{[\s\S]*?\n\})\s*\n/)[1]
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"'),
  ).valueOf
    ? null
    : null
  // Simpler: read the manifest as a module
  const manifestMod = await import(path.join('file://', HERE, '..', 'src', 'data', 'merchants.generated.js'))
  const MERCHANTS = manifestMod.MERCHANTS || {}

  const issues = {
    psp_violations: [],          // PSPs whose role doesn't match the allowlist
    no_psps: [],                  // merchants with 0 PSPs
    no_methods: [],               // merchants with 0 missing_methods
    method_count_low: [],         // merchants with <3 missing_methods
    methods_single_region: [],    // all methods sit in one region (likely incomplete)
    duplicate_methods: [],        // duplicate (method, market) entries
    capability_gaps: [],          // industry baseline capability missing
    no_capabilities: [],          // capabilities_live is empty
  }

  for (const row of rows) {
    const slug = row.slug
    const psps = Array.isArray(row.psps) ? row.psps : []
    const methods = Array.isArray(row.missing_methods) ? row.missing_methods : []
    const caps = Array.isArray(row.capabilities_live) ? row.capabilities_live : []
    const manifestEntry = MERCHANTS[slug] || {}
    const industryBucket = inferIndustryBucket(manifestEntry.industry, row.name)

    // PSP check
    if (!psps.length) issues.no_psps.push({ slug, name: row.name })
    for (const p of psps) {
      const role = String(p.role || '')
      if (!ALLOWED_ROLE_RE.test(role)) {
        issues.psp_violations.push({ slug, name: row.name, psp: p })
      }
    }

    // Method coverage
    if (!methods.length) {
      issues.no_methods.push({ slug, name: row.name })
    } else if (methods.length < 3) {
      issues.method_count_low.push({ slug, name: row.name, count: methods.length })
    }
    const seen = new Set()
    for (const m of methods) {
      const key = `${(m.method || '').toLowerCase()}|${(m.market || '').toLowerCase()}`
      if (seen.has(key)) {
        issues.duplicate_methods.push({ slug, name: row.name, method: m })
      } else {
        seen.add(key)
      }
    }
    if (methods.length >= 4) {
      const regions = new Set(methods.map((m) => regionOf(m.market)))
      regions.delete('unknown')
      regions.delete('global')
      if (regions.size === 1) {
        issues.methods_single_region.push({
          slug,
          name: row.name,
          region: [...regions][0],
          count: methods.length,
        })
      }
    }

    // Capability gaps
    if (!caps.length) {
      issues.no_capabilities.push({ slug, name: row.name })
    } else if (industryBucket) {
      const baseline = INDUSTRY_BASELINE[industryBucket] || []
      const liveSet = new Set(caps)
      const missing = baseline.filter((b) => !liveSet.has(b) && !(b === 'kyc' && liveSet.has('kyb')) && !(b === 'kyb' && liveSet.has('kyc')))
      if (missing.length) {
        issues.capability_gaps.push({
          slug,
          name: row.name,
          industry: manifestEntry.industry,
          bucket: industryBucket,
          live: caps,
          likely_missing: missing,
        })
      }
    }
  }

  // Summary
  const summary = {
    total_merchants: rows.length,
    psp_violations: issues.psp_violations.length,
    no_psps: issues.no_psps.length,
    no_methods: issues.no_methods.length,
    method_count_low: issues.method_count_low.length,
    methods_single_region: issues.methods_single_region.length,
    duplicate_methods: issues.duplicate_methods.length,
    capability_gaps: issues.capability_gaps.length,
    no_capabilities: issues.no_capabilities.length,
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(OUT_DIR, `merchant-qa-${ts}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({ summary, issues }, null, 2))

  console.log('==================================================')
  console.log('BATCH MERCHANT QA REPORT')
  console.log('==================================================')
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k.padEnd(28)} ${String(v).padStart(4)}`)
  }
  console.log(`\nReport: ${reportPath}`)

  // Show top examples per category
  const SHOW = 5
  for (const [cat, list] of Object.entries(issues)) {
    if (!list.length) continue
    console.log(`\n--- ${cat} (showing first ${Math.min(SHOW, list.length)} of ${list.length}) ---`)
    for (const item of list.slice(0, SHOW)) {
      console.log('  ', JSON.stringify(item))
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

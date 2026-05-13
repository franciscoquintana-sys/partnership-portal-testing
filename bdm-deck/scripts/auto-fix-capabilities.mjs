// Auto-applies high-confidence capability baselines to merchants whose
// industry strongly implies the chip should be live today. Conservative
// rule set: only adds capabilities where ground-truth confidence is
// near-certain across the portfolio. Won't remove anything; only fills
// gaps.
//
// Run: node --env-file=.env.local scripts/auto-fix-capabilities.mjs --dry-run
// Apply: node --env-file=.env.local scripts/auto-fix-capabilities.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// Industry → high-confidence baseline. Only capabilities a merchant in
// this bucket almost certainly runs in production today, given their
// product surface and scale.
const HIGH_CONFIDENCE_BASELINE = {
  // Marketplaces with seller payouts (peer-to-peer, gig, services)
  marketplace:  ['tokenization', 'fraud', 'payouts', 'kyc'],
  // Two-sided platforms with business sellers
  marketplace_b2b: ['tokenization', 'fraud', 'payouts', 'kyc', 'kyb'],
  // Travel + hospitality
  travel:       ['tokenization', 'fraud'],
  // Subscription DTC (apps, content, media)
  subscription: ['subscriptions', 'tokenization', 'fraud'],
  // E-commerce / retail
  ecommerce:    ['tokenization', 'fraud', 'tax'],
  // SaaS B2B
  saas:         ['subscriptions', 'tokenization', 'fraud', 'tax'],
  // Health / wellness consumer apps
  health:       ['subscriptions', 'tokenization', 'fraud'],
  // Gaming, streaming, media subscriptions
  gaming:       ['subscriptions', 'tokenization', 'fraud'],
  // Fintech / banking-adjacent
  fintech:      ['kyc', 'tokenization', 'fraud'],
  // Mobile wallets
  wallet:       ['kyc', 'kyb', 'tokenization', 'fraud', 'payouts'],
}

// Buckets that need a B2B variant (different baseline)
const B2B_MARKETPLACE_PATTERNS = /shops|sellers|business|wholesale|b2b|enterprise/i

function inferBucket(industry, name) {
  const i = String(industry || '').toLowerCase()
  const n = String(name || '').toLowerCase()
  if (/marketplace/.test(i)) {
    return B2B_MARKETPLACE_PATTERNS.test(i + n) ? 'marketplace_b2b' : 'marketplace'
  }
  if (/travel|hospitality|airline|hotel/.test(i)) return 'travel'
  if (/subscription|dtc/.test(i)) return 'subscription'
  if (/saas|software|cloud|infrastructure/.test(i)) return 'saas'
  if (/health|wellness|fitness|nutrition|medical/.test(i)) return 'health'
  if (/gaming|game|stream|media|entertain/.test(i)) return 'gaming'
  if (/fintech|finance|bank|payment/.test(i)) {
    if (/wallet/.test(i + n)) return 'wallet'
    return 'fintech'
  }
  if (/e-?commerce|retail|shop|store|marketplace/.test(i)) return 'ecommerce'
  return null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const manifestMod = await import(path.join('file://', HERE, '..', 'src', 'data', 'merchants.generated.js'))
  const MERCHANTS = manifestMod.MERCHANTS || {}

  const { data: rows, error } = await sb
    .from('merchants')
    .select('slug, name, capabilities_live')
  if (error) { console.error(error); process.exit(1) }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const changeLog = []
  let touched = 0, skipped = 0, failed = 0, addedTotal = 0

  for (const row of rows) {
    const live = new Set(Array.isArray(row.capabilities_live) ? row.capabilities_live : [])
    const manifestEntry = MERCHANTS[row.slug] || {}
    const bucket = inferBucket(manifestEntry.industry, row.name)
    if (!bucket) { skipped++; continue }
    const baseline = HIGH_CONFIDENCE_BASELINE[bucket] || []
    const additions = baseline.filter((cap) => !live.has(cap))
    if (!additions.length) { skipped++; continue }

    const next = [...live, ...additions]
    addedTotal += additions.length
    changeLog.push({
      slug: row.slug,
      name: row.name,
      industry: manifestEntry.industry,
      bucket,
      before: [...live],
      added: additions,
      after: next,
    })

    if (dryRun) { touched++; continue }
    const { error: updErr } = await sb
      .from('merchants')
      .update({ capabilities_live: next })
      .eq('slug', row.slug)
    if (updErr) {
      console.error(`[${row.slug}] update failed:`, updErr.message)
      failed++
    } else {
      touched++
    }
  }

  const logPath = path.join(OUT_DIR, `capabilities-fix-${ts}.json`)
  fs.writeFileSync(logPath, JSON.stringify(changeLog, null, 2))

  console.log('')
  console.log(`Mode:               ${dryRun ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Rows scanned:       ${rows.length}`)
  console.log(`Touched:            ${touched}`)
  console.log(`Skipped (no change):${skipped}`)
  console.log(`Failed:             ${failed}`)
  console.log(`Capabilities added: ${addedTotal}`)
  console.log(`Change log:         ${logPath}`)

  // Bucket summary
  const buckets = {}
  for (const c of changeLog) {
    buckets[c.bucket] = (buckets[c.bucket] || 0) + 1
  }
  console.log('\nBy bucket:')
  for (const [b, n] of Object.entries(buckets)) {
    console.log(`  ${b.padEnd(20)} ${n}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

// Reads every merchant's research .md in /Research, normalizes the
// DATABASE FIELDS block, enriches PSPs with roles and methods with markets,
// and upserts the result into the Supabase `merchants` table.
//
// Run: node --env-file=.env.local scripts/ingest-merchants.mjs
// Requires: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { MERCHANTS, slugify, resolveMerchant } from '../src/data/merchants.generated.js'

// Default points at the legacy /Research folder. Override with
// `--root <absolute path>` to ingest a different batch (e.g. the
// /New Research folder for the 2026 wave of merchants).
const rootArgIdx = process.argv.indexOf('--root')
const RESEARCH_ROOT = rootArgIdx !== -1 && process.argv[rootArgIdx + 1]
  ? process.argv[rootArgIdx + 1]
  : '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Research'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PSP_ROLES = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/psp-roles.json'), 'utf8'))
const METHOD_MARKETS = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/method-markets.json'), 'utf8'))

const JUNK_VALUES = new Set([
  'N/A', 'Undisclosed', 'None identified', 'None confirmed',
  'None', 'TBD', 'Unknown', 'Not disclosed', 'Credit/Debit Cards',
  'Credit Cards', 'Debit Cards',
])

// Patterns that look like PSP entries but are actually payment methods,
// rails, or generic descriptors. The diagnostic slide draws every PSP
// straight onto the topology boxes, so "Credit Card" or "Invoice / Wire"
// would appear next to "Stripe" as if it were a provider.
const NON_PSP_PATTERNS = [
  // Card / cash generics
  /^credit\s*card/i,
  /^credit\s*\/?\s*debit/i,
  /^debit\s*card/i,
  /^cards?\s*only$/i,
  /^cards?$/i,
  /^card\s+processor/i,
  /^card\s+acquir(er|ing)/i,
  /^credit\s+card\s+processing/i,
  /^debit\s+card\s+networks?$/i,
  /^card\/ach\s+funding$/i,
  /^cash$/i,
  // Bank rails / wire / ACH / check
  /^invoice/i,
  /^wire$/i,
  /^wire\s+transfer/i,
  /^wire\s*\/\s*check$/i,
  /^bank\s+wire/i,
  /^bank\s+transfer/i,
  /^direct\s+debit$/i,
  /^direct\s+deposit$/i,
  /^direct\s+invoicing$/i,
  /^direct\s+web\s+billing$/i,
  /^ach$/i,
  /^ach\s*\/\s*(direct\s+debit|fedwire|nacha|sepa|bacs|e-?check|direct\s+deposit|checking\s+account|bank\s+transfers?)/i,
  /^ach\s+(debit|direct\s+deposit|network|direct\s+bank\s+transfers?)$/i,
  /^ach\s+via\s+/i,
  /^check$/i,
  /^check\s+payments?$/i,
  /^paper\s+check$/i,
  /^sepa\s+(direct\s+debit|dd)/i,
  /^sepa\s+dd\s*\//i,
  /^eft\s*\/\s*ach/i,
  /^cross-?border\s+wire\s+network$/i,
  // Wallets / IAP / methods (these belong in missing_methods, not psps)
  /^apple\s+pay$/i,
  /^google\s+pay$/i,
  /^samsung\s+pay$/i,
  /^apple\s+pay\s*\/\s*google\s+pay$/i,
  // Generic / placeholder descriptors
  /^purchase\s+order/i,
  /^usd\s+only$/i,
  /^cryptocurrency\s+processor$/i,
  /^carrier\s+billing$/i,
  /^enterprise\s+invoicing$/i,
  /^manual\s+invoice$/i,
  /^paycheck\s+deduction$/i,
  /^insurance\s+claims$/i,
  /^medicare\s*\/\s*medicaid/i,
  /^ebt\s*\/\s*snap/i,
  /^hsa\s*\/\s*fsa\s+cards/i,
  /^mobile\s+money\s+networks?$/i,
  // "Internal", "Local", "Multiple", "Legacy", "Third-party", "Undisclosed", "Regional bank"
  /^internal(\s|$)/i,
  /^local(\s|$)/i,
  /^legacy(\s|$)/i,
  /^multiple(\s|$)/i,
  /^third[-\s]party(\s|$)/i,
  /^undisclosed(\s|$)/i,
  /^proprietary(\s|$)/i,
  /^regional\s+bank/i,
  /^external\s+gateways?$/i,
  /^none\s+detected$/i,
  /^not\s+confirmed$/i,
  /^\d+[\d,+]*\s+(more|us\s+bank)/i,
  /\[inference\]/i,
  // Card networks (not PSPs — they're rails the PSP routes onto)
  /^mastercard$/i,
  /^mastercard\s+start\s+path$/i,
  /^visa$/i,
  /^visa\s+network$/i,
  /^visa\s*\/\s*mastercard(\s|\/|$)/i,
  /^visa\/mc(\s|\/|$)/i,
  /^discover\s+global\s+network$/i,
  /^unionpay$/i,
  // Issuer banks (cards-issued-by, not merchant acquirers)
  /^mrv\s+banks?$/i,
  /^republic\s+bank\s*(&|and)\s*trust/i,
  // Wallets / checkouts (not real processors when listed alone)
  /^venmo$/i,
  /^cash\s*app(\s+pay)?$/i,
  /^paypal$/i,
  /^paypal\s*\/\s*venmo$/i,
  /^paypal\s*complete(\s+payments)?$/i,
  /^amazon\s+pay$/i,
  /^shop\s+pay$/i,
  /^stripe\s+link$/i,
  // BNPL (payment methods, not processors)
  /^klarna$/i,
  /^affirm$/i,
  /^afterpay$/i,
  /^sezzle$/i,
  /^zip$/i,
  /^clearpay/i,
  /^uplift$/i,
  /^sunbit$/i,
  /^paidy$/i,
  /^chariot$/i,
  /^afterpay\s*\/\s*zip$/i,
  /^klarna\s*\+\s*zip$/i,
]

function isNonPsp(name) {
  return NON_PSP_PATTERNS.some((rx) => rx.test(String(name).trim()))
}

function normalize(raw) {
  const stripped = String(raw || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  if (!stripped || stripped.startsWith('No ') || /^\(/.test(String(raw).trim())) return null
  if (JUNK_VALUES.has(stripped)) return null
  return stripped
}

function extractBlock(md) {
  const match = md.match(/DATABASE FIELDS:[\s\S]*?```/m)
  return match ? match[0] : null
}

function extractField(block, label) {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'm')
  const m = block.match(re)
  return m ? m[1].trim() : null
}

function extractIndexed(block, prefix, count) {
  const out = []
  for (let i = 1; i <= count; i++) {
    out.push(extractField(block, `${prefix}${i}`))
  }
  return out
}

function extractIndexedMulti(block, prefix, maxCount) {
  // Handles two source-data quirks:
  //   1. Rows that cram multiple values: "Stripe PSP_2: Adyen ..."
  //   2. Rows that combine PSPs with " + ": "PayPal + Google Pay"
  //      The diagnostic slide draws each entry as its own chip, so a
  //      combined entry shows up as one fat box with two brand names.
  // Strip parenthetical content BEFORE splitting on " + " so an annotation
  // like "Stripe (Subscriptions + Marketplace)" stays a single entry
  // instead of fragmenting into "Stripe (Subscriptions" and "Marketplace)".
  const values = []
  for (let i = 1; i <= maxCount; i++) {
    const raw = extractField(block, `${prefix}${i}`)
    if (!raw) continue
    const stripped = raw.replace(/\s*\([^)]*\)\s*/g, ' ')
    const parts = stripped.split(new RegExp(`\\s*${prefix}\\d+:\\s*`))
    for (const part of parts) {
      for (const sub of part.split(/\s+\+\s+/)) {
        const v = normalize(sub)
        if (v) values.push(v)
      }
    }
  }
  // Dedupe preserving order (in case a merchant lists the same PSP twice)
  return [...new Set(values)]
}

function buildMerchantRow(folderName, md) {
  const block = extractBlock(md)
  if (!block) return { folder: folderName, error: 'no DATABASE FIELDS block' }

  const merchantNameRaw = extractField(block, 'Nombre merchant') || folderName

  // Resolve slug: resolveMerchant() handles "Alibaba Group" → "alibaba-group",
  // falls back to slugifying the folder name if no entry exists in the generated list.
  const match = resolveMerchant(merchantNameRaw) || resolveMerchant(folderName)
  const slug = match?.slug || slugify(folderName)
  const name = match?.name || merchantNameRaw

  const painTitles = extractIndexed(block, 'Tittle_Pain Point_', 5)
    .map((t) => (t ? t.trim() : null))
  if (painTitles.some((t) => !t)) {
    return { folder: folderName, slug, error: 'missing pain titles' }
  }

  const pspNames = extractIndexedMulti(block, 'PSP_', 10).filter((nm) => !isNonPsp(nm))
  const psps = pspNames.map((nm) => ({
    name: nm,
    role: PSP_ROLES[nm] || 'Regional · gateway',
  }))

  // Drop any "missing method" that's already in the merchant's PSP list.
  // A merchant who lists PayPal as a wallet they use shouldn't also see
  // "PayPal · Global" surfaced as a method they're missing — the slide
  // would contradict itself in front of the audience.
  const pspNamesLower = new Set(psps.map((p) => p.name.toLowerCase()))
  const methodNames = extractIndexedMulti(block, 'Local_M_', 10)
    .filter((m) => {
      const ml = m.toLowerCase()
      for (const pn of pspNamesLower) {
        if (pn === ml || pn.includes(ml) || ml.includes(pn)) return false
      }
      return true
    })
  const missingMethods = methodNames.map((m) => ({
    method: m,
    market: METHOD_MARKETS[m] || 'Regional',
  }))

  const capTitles = extractIndexed(block, 'Tittle_Yuno_Cap', 4)
  const capDescs = extractIndexed(block, 'Desc_Yuno_Cap', 4)
  if (capTitles.some((t) => !t) || capDescs.some((d) => !d)) {
    return { folder: folderName, slug, error: 'missing capability fields' }
  }

  return {
    row: {
      slug,
      name,
      pain_titles: painTitles,
      psps,
      missing_methods: missingMethods,
      capability_titles: capTitles,
      capability_descs: capDescs,
    },
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  let sb = null
  if (!dryRun) {
    const url = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local ...')
      process.exit(1)
    }
    sb = createClient(url, serviceKey, { auth: { persistSession: false } })
  }

  const folders = fs.readdirSync(RESEARCH_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'Companies & Parameters')

  const rows = []
  const errors = []
  const unmatched = []

  for (const folder of folders) {
    const dir = path.join(RESEARCH_ROOT, folder.name)
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    if (!files.length) {
      errors.push({ folder: folder.name, error: 'no .md file' })
      continue
    }
    const md = fs.readFileSync(path.join(dir, files[0]), 'utf8')
    const result = buildMerchantRow(folder.name, md)
    if (result.error) {
      errors.push(result)
      continue
    }
    if (!MERCHANTS[result.row.slug]) {
      unmatched.push({ folder: folder.name, slug: result.row.slug })
    }
    rows.push(result.row)
  }

  console.log(`Parsed: ${rows.length} merchants ready to upsert.`)
  console.log(`Errors: ${errors.length}`)
  if (errors.length) errors.forEach((e) => console.log('  -', e.folder, '→', e.error))
  console.log(`Slugs not in merchants.generated.js: ${unmatched.length}`)
  if (unmatched.length) console.log('  samples:', unmatched.slice(0, 10))

  if (dryRun) {
    console.log('\n--- sample row (Airbnb or first) ---')
    const sample = rows.find((r) => r.slug === 'airbnb') || rows[0]
    console.log(JSON.stringify(sample, null, 2))
    console.log('\nDry run, not writing to Supabase.')
    return
  }

  // Upsert in chunks of 50.
  const CHUNK = 50
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await sb.from('merchants').upsert(chunk, { onConflict: 'slug' })
    if (error) {
      console.error(`Chunk ${i / CHUNK} failed:`, error)
      process.exit(1)
    }
    written += chunk.length
    console.log(`Upserted ${written}/${rows.length}`)
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

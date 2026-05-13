// Per-merchant deep research for the Diagnostic slide capability chips.
// For each merchant, reads the research markdown in
//   /Users/isabellapdl/Desktop/Stripe Sessions Decks/Research/<Name>/*.md
// plus the merchant's pain/capability text from Supabase, and asks Claude
// to classify each of the 7 capabilities as LIVE (already active in the
// merchant's stack / business model) or MISSING (upsell opportunity for
// Yuno).
//
// Capabilities classified:
//   payouts · subscriptions · tokenization · fraud · kyc · kyb · baas
//
// Writes the LIVE slugs to Supabase column `capabilities_live` (text[]).
// Run the 002_add_capabilities_live.sql migration before first use.
//
// Run (dry-run sample):
//   node --env-file=.env.local scripts/research-capabilities.mjs --sample 5
//
// Run (apply all):
//   node --env-file=.env.local scripts/research-capabilities.mjs --all --apply
//
// Run (one merchant):
//   node --env-file=.env.local scripts/research-capabilities.mjs --merchant discord --apply

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')
// Research now lives in two folders: the legacy /Research batch and the
// 2026 /New Research wave. Index both so loadResearch() can find any
// merchant regardless of which batch it shipped in.
const RESEARCH_DIRS = [
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Research',
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/New Research',
]

// ---------- CLI ----------
function parseArgs(argv) {
  const a = { sample: null, merchant: null, all: false, onlyEmpty: false, apply: false, concurrency: 4 }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]
    if (t === '--sample') a.sample = parseInt(rest[++i], 10)
    else if (t.startsWith('--sample=')) a.sample = parseInt(t.split('=')[1], 10)
    else if (t === '--merchant') a.merchant = rest[++i]
    else if (t.startsWith('--merchant=')) a.merchant = t.split('=')[1]
    else if (t === '--all') a.all = true
    else if (t === '--only-empty') a.onlyEmpty = true
    else if (t === '--apply') a.apply = true
    else if (t === '--concurrency') a.concurrency = parseInt(rest[++i], 10)
  }
  if (!a.sample && !a.merchant && !a.all && !a.onlyEmpty) a.sample = 5
  return a
}
const args = parseArgs(process.argv)

// ---------- Capability catalog ----------
const CAPABILITIES = [
  { key: 'payouts',       label: 'Payouts',       hint: 'Merchant sends money OUT to third parties (sellers, drivers, creators, employees, partners). Not customer refunds — those are payin reversals.' },
  { key: 'subscriptions', label: 'Subscriptions', hint: 'Merchant bills customers on a recurring schedule (monthly/annual/usage). If the merchant is SaaS or offers memberships, this is LIVE.' },
  { key: 'tokenization',  label: 'Tokenization',  hint: 'Merchant stores cards-on-file / tokens for 1-click or recurring charges. If they have "save card for later" or recurring, this is LIVE.' },
  { key: 'fraud',         label: 'Fraud',         hint: 'Merchant runs fraud / 3DS / chargeback defense via a dedicated provider or in-house system. Most serious e-commerce or fintech runs one.' },
  { key: 'kyc',           label: 'KYC',           hint: 'Merchant verifies INDIVIDUAL consumer identity (ID doc, selfie, PEP/sanctions). Required for fintech, crypto, marketplaces, regulated verticals.' },
  { key: 'kyb',           label: 'KYB',           hint: 'Merchant verifies BUSINESS identity for B2B customers or suppliers (EIN/CIF, UBO checks). Required for fintech platforms and B2B marketplaces.' },
  { key: 'baas',          label: 'BaaS',          hint: 'Merchant issues cards, bank accounts, or wallets via a Banking-as-a-Service provider. Present in neobanks, crypto platforms, some marketplaces.' },
]

// ---------- Clients ----------
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 6 })
const MODEL = 'claude-sonnet-4-6'

// ---------- Research loader ----------
// Research files live at /Research/<Title Case Name>/<slug>-stripe-sessions-research.md.
// The folder names don't always match slug casing (e.g. "1Password", "Bill.com"),
// so we do a case-insensitive directory scan once, then look up by slug/name.
// Index maps slug-form key → { root, folder } so we can resolve a merchant
// to whichever batch its research lives in (legacy Research vs the New
// Research wave).
let researchIndex = null
function getResearchIndex() {
  if (researchIndex) return researchIndex
  researchIndex = new Map()
  for (const root of RESEARCH_DIRS) {
    if (!fs.existsSync(root)) continue
    const dirs = fs.readdirSync(root).filter((d) => {
      const full = path.join(root, d)
      return fs.statSync(full).isDirectory()
    })
    for (const d of dirs) {
      const key = d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      // First-write wins so a merchant present in both folders prefers
      // the legacy /Research version (already-curated copy).
      if (!researchIndex.has(key)) researchIndex.set(key, { root, folder: d })
    }
  }
  return researchIndex
}

function loadResearch(slug, name) {
  const idx = getResearchIndex()
  const candidates = [
    slug,
    slug.replace(/-/g, ''),
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  ]
  let hit = null
  for (const c of candidates) {
    if (idx.has(c)) { hit = idx.get(c); break }
  }
  if (!hit) return null
  const full = path.join(hit.root, hit.folder)
  const mdFile = fs.readdirSync(full).find((f) => f.endsWith('.md'))
  if (!mdFile) return null
  try {
    return fs.readFileSync(path.join(full, mdFile), 'utf8')
  } catch {
    return null
  }
}

// ---------- Prompt ----------
function buildPrompt({ name, slug, research, pain_titles, capability_titles }) {
  const capList = CAPABILITIES.map((c) => `- ${c.key} (${c.label}): ${c.hint}`).join('\n')
  const researchBlock = research
    ? `\n--- RESEARCH DOCUMENT ---\n${research.slice(0, 14000)}\n--- END RESEARCH ---\n`
    : '\n(No dedicated research document available — rely on the merchant name and known market context.)\n'
  return `You are classifying which of 7 payment-stack capabilities a real merchant has LIVE today vs MISSING.

Merchant: ${name} (slug: ${slug})
Known pain points (slide 2 copy): ${(pain_titles || []).join(' | ') || '(none)'}
Yuno capabilities pitched (slide 3 copy): ${(capability_titles || []).join(' | ') || '(none)'}
${researchBlock}

Capabilities to classify:
${capList}

For EACH capability, decide: is it clearly LIVE in the merchant's public stack or business model today?
- "live" = the merchant already operates this capability (own-built or via a vendor). The chip will render GREEN on the diagnostic slide.
- "missing" = they do not clearly operate it today, or there's no public evidence. The chip will render MUTED (upsell for Yuno).

Rules:
- Be conservative. If evidence is thin or speculative, mark "missing". Default to "missing" unless the merchant's business model obviously requires it or the research explicitly cites it.
- Subscriptions = TRUE for any SaaS, streaming, membership, or recurring-billing merchant.
- Payouts = TRUE only for marketplaces, gig platforms, creator tools paying out to third parties. NOT true for refunds.
- Tokenization = TRUE if the merchant has card-on-file, 1-click, or recurring billing (all imply tokens).
- Fraud = TRUE for most mature e-commerce, fintech, crypto, travel, ticketing. FALSE for B2B invoicing-only.
- KYC = TRUE for fintech, crypto, banking, marketplaces with seller onboarding, regulated age-restricted (alcohol/gambling). FALSE for pure e-commerce.
- KYB = TRUE for B2B SaaS processing payouts to companies, fintech platforms onboarding businesses, supplier networks. FALSE for consumer-only.
- BaaS = TRUE only when the merchant issues cards, bank accounts, or stored balances via a banking partner. Otherwise FALSE.

Return ONLY a single JSON object, no preamble, no markdown fence:
{"payouts": "live"|"missing", "subscriptions": "live"|"missing", "tokenization": "live"|"missing", "fraud": "live"|"missing", "kyc": "live"|"missing", "kyb": "live"|"missing", "baas": "live"|"missing"}`
}

async function classifyOne(merchant) {
  const research = loadResearch(merchant.slug, merchant.name)
  const prompt = buildPrompt({
    name: merchant.name,
    slug: merchant.slug,
    research,
    pain_titles: merchant.pain_titles,
    capability_titles: merchant.capability_titles,
  })
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  // Extract first JSON object from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${raw.slice(0, 200)}`)
  const parsed = JSON.parse(jsonMatch[0])
  const live = []
  for (const cap of CAPABILITIES) {
    if (parsed[cap.key] === 'live') live.push(cap.key)
  }
  return { live, raw: parsed, hadResearch: Boolean(research) }
}

// ---------- Concurrency limiter ----------
async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      try {
        results[i] = { ok: true, value: await fn(items[i], i) }
      } catch (err) {
        results[i] = { ok: false, error: err }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ---------- Main ----------
async function main() {
  const { data: rows, error } = await sb
    .from('merchants')
    .select('slug, name, pain_titles, capability_titles, capabilities_live')
  if (error) {
    if (error.message?.includes('capabilities_live')) {
      console.error('Column capabilities_live not found on merchants table.')
      console.error('Run this SQL first in the Supabase SQL editor:')
      console.error('   alter table public.merchants add column if not exists capabilities_live text[] not null default \'{}\';')
      process.exit(2)
    }
    console.error(error); process.exit(1)
  }

  let targets = rows
  if (args.merchant) targets = rows.filter((r) => r.slug === args.merchant)
  else if (args.onlyEmpty) targets = rows.filter((r) => !r.capabilities_live || r.capabilities_live.length === 0)
  else if (args.sample) targets = rows.slice(0, args.sample)

  console.log(`Model: ${MODEL}`)
  console.log(`Mode: ${args.apply ? 'APPLY (writes to Supabase)' : 'DRY RUN'}`)
  console.log(`Targets: ${targets.length} merchants`)
  console.log('')

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(OUT_DIR, `capabilities-research-${ts}.json`)
  const logEntries = []

  const results = await runWithConcurrency(targets, args.concurrency, async (merchant) => {
    const { live, raw, hadResearch } = await classifyOne(merchant)
    logEntries.push({ slug: merchant.slug, name: merchant.name, hadResearch, live, raw })

    if (args.apply) {
      const { error: updErr } = await sb
        .from('merchants')
        .update({ capabilities_live: live })
        .eq('slug', merchant.slug)
      if (updErr) throw updErr
    }

    console.log(`  ${merchant.slug.padEnd(22)} ${hadResearch ? '📄' : '  '} live=[${live.join(', ')}]`)
    return live
  })

  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(`Done. ${ok}/${targets.length} classified.`)
  if (failed.length) {
    console.log(`Failed: ${failed.length}`)
    failed.slice(0, 5).forEach((f) => console.log(`  ${f.error.message || f.error}`))
  }
  fs.writeFileSync(logPath, JSON.stringify(logEntries, null, 2))
  console.log(`Log: ${logPath}`)
}

main().catch((err) => { console.error(err); process.exit(1) })

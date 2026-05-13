// For each merchant, re-read the full research markdown and ask Claude to
// pick missing payment methods THAT MATCH the merchant's HQ + primary
// markets. The structured Local_M_N fields in the source research were
// pulled top-down without geographic filtering, so a Brazil-only neobank
// (Neon) ended up showing UPI / RuPay / BLIK as "missing" — irrelevant.
//
// Usage:
//   node --env-file=.env.local scripts/research-missing-methods.mjs --merchant neon --apply
//   node --env-file=.env.local scripts/research-missing-methods.mjs --apply --concurrency 2
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const METHOD_MARKETS = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/method-markets.json'), 'utf8'))
const RESEARCH_DIRS = [
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Research',
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/New Research',
]

function parseArgs(argv) {
  const a = { merchant: null, apply: false, concurrency: 4, all: false }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]
    if (t === '--merchant') a.merchant = rest[++i]
    else if (t === '--apply') a.apply = true
    else if (t === '--all') a.all = true
    else if (t === '--concurrency') a.concurrency = parseInt(rest[++i], 10)
  }
  return a
}
const args = parseArgs(process.argv)

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 6 })
const MODEL = 'claude-sonnet-4-6'

let researchIndex = null
function getResearchIndex() {
  if (researchIndex) return researchIndex
  researchIndex = new Map()
  for (const root of RESEARCH_DIRS) {
    if (!fs.existsSync(root)) continue
    for (const d of fs.readdirSync(root)) {
      const full = path.join(root, d)
      if (!fs.statSync(full).isDirectory()) continue
      const key = d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!researchIndex.has(key)) researchIndex.set(key, full)
    }
  }
  return researchIndex
}

function loadResearch(slug, name) {
  const idx = getResearchIndex()
  for (const c of [slug, slug.replace(/-/g, ''), name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]) {
    if (idx.has(c)) {
      const md = fs.readdirSync(idx.get(c)).find((f) => f.endsWith('.md'))
      if (md) return fs.readFileSync(path.join(idx.get(c), md), 'utf8')
    }
  }
  return null
}

function buildPrompt({ name, currentMethods, currentPsps, research }) {
  return `You are picking 8 to 10 missing local payment methods for a merchant's diagnostic slide. The slide caption is "Some alternative payment methods you are not offering." Each entry renders as a chip "<method> · <market>".

Merchant: ${name}
PSPs the merchant currently uses: ${currentPsps.length ? currentPsps.join(', ') : '(unknown)'}
Methods currently flagged as missing in our database: ${currentMethods.length ? currentMethods.map((m) => `${m.method}/${m.market}`).join(' | ') : '(none)'}

The chips must reflect the merchant's REAL geographic footprint. Anchor your picks to:
1. The merchant's HQ / headquarters country
2. The merchant's primary markets (where they do business)
3. Methods their target users would actually want at checkout

Hard rules:
- A Brazilian neobank should NOT see UPI / India or BLIK / Poland chips — anchor to Brazil + LATAM.
- A US-only company should NOT see Pix, OXXO, iDEAL — anchor to US (and Canada if relevant).
- A US-headquartered global company (e.g. travel OTA, AI SaaS) CAN show a mix of US + their top international markets, but US-specific gaps (Apple Pay, Google Pay, Cash App Pay, Affirm, Klarna, Zelle, Venmo) come first when the US is a primary market.
- A LATAM-focused company should anchor to LATAM (Pix, Boleto, OXXO, SPEI, PSE, Nequi, Mercado Pago, Daviplata) and NOT show Asian or European methods.
- An EU company anchors to EU methods (iDEAL, Bancontact, SEPA, Klarna, Sofort, BLIK, P24, Trustly, Giropay).
- An Asian company anchors to relevant Asian methods (UPI, Alipay, WeChat Pay, GrabPay, PayPay, Konbini, KakaoPay, etc.).
- DO NOT include methods the merchant already accepts (per the research).
- DO NOT include generic descriptors like "Credit Card" or "Bank Transfer". Use specific brand names.

Use the research below to determine the merchant's HQ + primary markets + already-accepted methods. Many of these research files include a "Top 5 Markets Gap Analysis" section that lists missing methods per market — use that as the source of truth when present.

Return 8 to 10 entries. Mix markets only if the merchant truly operates across regions; otherwise anchor everything to one region.

--- RESEARCH ---
${research.slice(0, 18000)}
--- END RESEARCH ---

Return ONLY a JSON array of objects, no preamble, no markdown fence. Each object has keys "method" (string, brand name) and "market" (string, country or region):
[{"method": "Apple Pay", "market": "US"}, {"method": "Klarna", "market": "Europe"}, ...]`
}

async function classifyOne(merchant) {
  const research = loadResearch(merchant.slug, merchant.name)
  if (!research) return { methods: null, reason: 'no research file' }
  const prompt = buildPrompt({
    name: merchant.name,
    currentMethods: merchant.missing_methods || [],
    currentPsps: (merchant.psps || []).map((p) => p.name),
    research,
  })
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  const m = raw.match(/\[[\s\S]*\]/)
  if (!m) throw new Error(`No JSON array: ${raw.slice(0, 200)}`)
  const arr = JSON.parse(m[0])
  return {
    methods: arr
      .filter((o) => o && typeof o.method === 'string' && typeof o.market === 'string')
      .map((o) => ({ method: o.method.trim(), market: o.market.trim() }))
      .filter((o) => o.method && o.market),
  }
}

async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      try { results[i] = { ok: true, value: await fn(items[i], i) } }
      catch (err) { results[i] = { ok: false, error: err } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const { data: rows } = await sb.from('merchants').select('slug, name, psps, missing_methods').order('slug')
let targets
if (args.merchant) targets = rows.filter((r) => r.slug === args.merchant)
else if (args.all) targets = rows
else targets = rows.slice(0, 5)

console.log(`Model: ${MODEL}`)
console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`)
console.log(`Targets: ${targets.length} merchants\n`)

const results = await runWithConcurrency(targets, args.concurrency, async (m) => {
  const { methods, reason } = await classifyOne(m)
  if (!methods) {
    console.log(`  ${m.slug.padEnd(22)} skip (${reason})`)
    return null
  }
  console.log(`  ${m.slug.padEnd(22)} → ${methods.map((x) => `${x.method}/${x.market}`).join(' | ')}`)
  if (args.apply) {
    const { error } = await sb.from('merchants').update({ missing_methods: methods }).eq('slug', m.slug)
    if (error) throw error
  }
  return methods
})
const ok = results.filter((r) => r.ok).length
console.log(`\nDone. ${ok}/${targets.length} processed.`)
const failed = results.filter((r) => !r.ok)
if (failed.length) failed.slice(0, 5).forEach((f) => console.log(`  fail: ${f.error.message || f.error}`))

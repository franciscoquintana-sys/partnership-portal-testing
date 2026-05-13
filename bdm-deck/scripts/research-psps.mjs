// For merchants whose ingested PSP list was thin (the structured PSP_N
// fields had filler like "Credit/Debit Cards", "N/A", "Internal Billing
// Stack"), re-read the full research markdown and ask Claude to extract
// the merchant's real payment stack from the narrative.
//
// Run (dry-run, only merchants with <2 PSPs):
//   node --env-file=.env.local scripts/research-psps.mjs
//
// Run (apply):
//   node --env-file=.env.local scripts/research-psps.mjs --apply
//
// Run (one merchant):
//   node --env-file=.env.local scripts/research-psps.mjs --merchant slack --apply
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PSP_ROLES = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/psp-roles.json'), 'utf8'))

// Mirror of the NON_PSP_PATTERNS in ingest-merchants.mjs so a Claude
// hallucination like "Undisclosed Payment Processor" or "Google Cloud"
// gets dropped before we write to Supabase.
const NON_PSP_PATTERNS = [
  /^credit\s*card/i, /^credit\s*\/?\s*debit/i, /^debit\s*card/i,
  /^cards?\s*only$/i, /^cards?$/i, /^card\s+processor/i,
  /^card\s+acquir(er|ing)/i, /^credit\s+card\s+processing/i,
  /^debit\s+card\s+networks?$/i, /^card\/ach\s+funding$/i, /^cash$/i,
  /^invoice/i, /^wire$/i, /^wire\s+transfer/i, /^wire\s*\/\s*check$/i,
  /^bank\s+wire/i, /^bank\s+transfer/i, /^direct\s+debit$/i,
  /^direct\s+deposit$/i, /^direct\s+invoicing$/i, /^direct\s+web\s+billing$/i,
  /^ach$/i, /^ach\s*\/\s*(direct\s+debit|fedwire|nacha|sepa|bacs|e-?check|direct\s+deposit|checking\s+account|bank\s+transfers?)/i,
  /^ach\s+(debit|direct\s+deposit|network|direct\s+bank\s+transfers?)$/i,
  /^ach\s+via\s+/i, /^check$/i, /^check\s+payments?$/i, /^paper\s+check$/i,
  /^sepa\s+(direct\s+debit|dd)/i, /^sepa\s+dd\s*\//i, /^eft\s*\/\s*ach/i,
  /^cross-?border\s+wire\s+network$/i, /^purchase\s+order/i, /^usd\s+only$/i,
  /^cryptocurrency\s+processor$/i, /^carrier\s+billing$/i,
  /^enterprise\s+invoicing$/i, /^manual\s+invoice$/i, /^paycheck\s+deduction$/i,
  /^insurance\s+claims$/i, /^medicare\s*\/\s*medicaid/i, /^ebt\s*\/\s*snap/i,
  /^hsa\s*\/\s*fsa\s+cards/i, /^mobile\s+money\s+networks?$/i,
  /^internal(\s|$)/i, /^local(\s|$)/i, /^legacy(\s|$)/i, /^multiple(\s|$)/i,
  /^third[-\s]party(\s|$)/i, /^undisclosed(\s|$)/i, /^proprietary(\s|$)/i,
  /^regional\s+bank/i, /^external\s+gateways?$/i, /^none\s+detected$/i,
  /^not\s+confirmed$/i, /^\d+[\d,+]*\s+(more|us\s+bank)/i, /\[inference\]/i,
  /^mastercard$/i, /^mastercard\s+start\s+path$/i, /^visa$/i,
  /^visa\s+network$/i, /^visa\s*\/\s*mastercard(\s|\/|$)/i, /^visa\/mc(\s|\/|$)/i,
  /^discover\s+global\s+network$/i, /^unionpay$/i,
  /^mrv\s+banks?$/i, /^republic\s+bank\s*(&|and)\s*trust/i,
  /^google\s+cloud$/i, /^apple\s+pay$/i, /^google\s+pay$/i,
  /^venmo$/i, /^cash\s*app(\s+pay)?$/i,
  /^paypal$/i, /^paypal\s*\/\s*venmo$/i, /^paypal\s*complete(\s+payments)?$/i,
  /^amazon\s+pay$/i, /^shop\s+pay$/i, /^stripe\s+link$/i,
  /^klarna$/i, /^affirm$/i, /^afterpay$/i, /^sezzle$/i, /^zip$/i,
  /^clearpay/i, /^uplift$/i, /^sunbit$/i, /^paidy$/i, /^chariot$/i,
  /^afterpay\s*\/\s*zip$/i, /^klarna\s*\+\s*zip$/i,
]
const isNonPsp = (n) => NON_PSP_PATTERNS.some((rx) => rx.test(String(n).trim()))
const RESEARCH_DIRS = [
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Research',
  '/Users/isabellapdl/Desktop/Stripe Sessions Decks/New Research',
]

function parseArgs(argv) {
  const a = { merchant: null, apply: false, threshold: 2, concurrency: 4 }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]
    if (t === '--merchant') a.merchant = rest[++i]
    else if (t === '--apply') a.apply = true
    else if (t === '--threshold') a.threshold = parseInt(rest[++i], 10)
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

function buildPrompt({ name, currentPsps, research }) {
  return `You are extracting the real Payment Service Provider (PSP) / gateway / billing-platform stack for a merchant from a research document.

Merchant: ${name}
PSPs currently in our database: ${currentPsps.length ? currentPsps.join(', ') : '(none)'}

The structured PSP_N fields in the research were filled with filler like "Credit/Debit Cards", "ACH", "Internal Billing Stack", "N/A", or "None identified", so we filtered them out and ended up with too few real PSPs to render the topology slide.

Re-read the full research narrative below and identify ALL the real PSPs / gateways / billing platforms the merchant uses for their OWN payments. Include things like:
- Stripe, Adyen, Braintree, Worldpay, Cybersource, Authorize.net, Chase Paymentech, Checkout.com, Elavon, Vantiv, Fiserv
- Subscription/billing platforms: Zuora, Recurly, Chargebee, Paddle, Maxio
- BNPL: Klarna, Affirm, Afterpay, Sezzle, Zip (only if MERCHANT accepts at checkout)
- Wallets: PayPal, Apple Pay, Google Pay, Venmo, Cash App Pay (only if MERCHANT explicitly accepts)
- IAP: Apple App Store, Google Play (only if merchant has mobile app billing)
- Marketplaces: AWS Marketplace, Azure Marketplace, Google Cloud Marketplace
- Bank rails / treasury: Plaid, Modern Treasury, Marqeta, Tipalti (for payouts)
- Card-issuing platforms: Galileo, Marqeta, Stripe Issuing
- Local: Mercado Pago, Conekta, Ebanx, dLocal, Razorpay, etc.

CRITICAL EXCLUSIONS — do NOT include:
- Generic descriptors: "Credit Card", "Wire Transfer", "ACH", "Bank Transfer", "Direct Debit"
- Card networks: Mastercard, Visa, Amex, Discover (alone — not real PSPs)
- Issuer banks (cards-issued-by, not the merchant's acquirer)
- Brands mentioned only as competitors, comparison points, or industry context (e.g. "competitor TuneCore uses PayPal" → don't include PayPal for THIS merchant)
- Brands the merchant explicitly does NOT use (e.g. "PayPal: NOT accepted" → exclude PayPal)
- Brands attached to a different product line that isn't this merchant's own billing (e.g. for Adobe, "Braintree integrates with Adobe Commerce" is for Adobe Commerce CUSTOMERS, not Adobe's own subscription billing — exclude)

Goal: 2 to 4 PSPs that genuinely process this merchant's own revenue / payouts. If the research only confirms 1 real PSP and explicitly states others are not used, return only that one — accuracy over volume.

--- RESEARCH ---
${research.slice(0, 16000)}
--- END RESEARCH ---

Return ONLY a JSON array of PSP name strings, no preamble, no markdown fence:
["Stripe", "PayPal", ...]`
}

async function classifyOne(merchant) {
  const research = loadResearch(merchant.slug, merchant.name)
  if (!research) return { psps: null, reason: 'no research file' }
  const prompt = buildPrompt({
    name: merchant.name,
    currentPsps: (merchant.psps || []).map((p) => p.name),
    research,
  })
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  const m = raw.match(/\[[\s\S]*?\]/)
  if (!m) throw new Error(`No JSON array in response: ${raw.slice(0, 200)}`)
  const arr = JSON.parse(m[0])
  return { psps: arr.filter((s) => typeof s === 'string' && s.trim() && !isNonPsp(s)) }
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

const { data: rows } = await sb.from('merchants').select('slug, name, psps').order('slug')
let targets = args.merchant ? rows.filter((r) => r.slug === args.merchant) : rows.filter((r) => (r.psps || []).length < args.threshold)

console.log(`Model: ${MODEL}`)
console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`)
console.log(`Targets: ${targets.length} merchants with <${args.threshold} PSPs\n`)

const results = await runWithConcurrency(targets, args.concurrency, async (m) => {
  const { psps, reason } = await classifyOne(m)
  if (!psps) {
    console.log(`  ${m.slug.padEnd(22)} skip (${reason})`)
    return null
  }
  const enriched = psps.map((name) => ({ name, role: PSP_ROLES[name] || 'Regional · gateway' }))
  console.log(`  ${m.slug.padEnd(22)} → ${psps.join(' | ')}`)
  if (args.apply) {
    const { error } = await sb.from('merchants').update({ psps: enriched }).eq('slug', m.slug)
    if (error) throw error
  }
  return enriched
})
const ok = results.filter((r) => r.ok).length
console.log(`\nDone. ${ok}/${targets.length} processed.`)
const failed = results.filter((r) => !r.ok)
if (failed.length) failed.slice(0, 5).forEach((f) => console.log(`  fail: ${f.error.message || f.error}`))

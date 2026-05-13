// Dry-run classifier for the `psps` column in Supabase `merchants` table.
// Buckets every unique PSP name as KEEP (real PSP/acquirer/gateway) or
// DROP (wallet, BNPL, card network, payout platform, billing software,
// transfer rail, sponsor bank, placeholder, Stripe feature module). Also
// flags merchants that will end up with <3 PSPs after the drop — those
// need refilling in step 3.
//
// Run:  node --env-file=.env.local scripts/classify-psps.mjs
//
// Writes: scripts/out/psp-cleanup-plan.json  (used by the apply step)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out', 'psp-cleanup-plan.json')

// Variant → canonical. Applied BEFORE the drop check, so DROP_EXACT and
// PSP_ROLES lookups see the canonical name.
const NORMALIZE = {
  // JPMorgan family (keep "Chase Paymentech" separate — that's the acquirer arm)
  'jpmorgan': 'JPMorgan Chase',
  'jpmorgan chase': 'JPMorgan Chase',
  'jp morgan chase': 'JPMorgan Chase',
  'j.p. morgan': 'JPMorgan Chase',
  'jpmorgan payments': 'JPMorgan Chase',
  'chase': 'JPMorgan Chase',
  // Cybersource casing
  'cybersource': 'Cybersource',
  'cybersource/visa': 'Cybersource',
  'cybersource / worldpay / moneris': 'Cybersource',
  // Authorize.net casing
  'authorize.net': 'Authorize.net',
  'auth.net': 'Authorize.net',
  // EBANX casing
  'ebanx': 'EBANX',
  // Mercado Pago spacing
  'mercadopago': 'Mercado Pago',
  'mercado pago': 'Mercado Pago',
  // Braintree / PayPal combos
  'paypal/braintree': 'PayPal/Braintree',
  'paypal / braintree': 'PayPal/Braintree',
  'braintree/paypal': 'PayPal/Braintree',
  'braintree / paypal': 'PayPal/Braintree',
  // PayPal Complete
  'paypal complete': 'PayPal Complete Payments',
  'paypal complete payments': 'PayPal Complete Payments',
  // Square
  'square payments': 'Square',
  // Ingenico/Worldline — Ingenico is now part of Worldline
  'ingenico / worldline': 'Worldline',
  // Galileo family (all dropped — see DROP_EXACT below)
  'galileo/technisys': 'Galileo',
}

// Explicit drop list — exact, case-insensitive match after trimming and
// normalization. Every entry here was observed in the current Supabase
// data and is clearly not a PSP/acquirer/gateway.
const DROP_EXACT = new Set([
  // Wallets / pay buttons
  'apple pay', 'google pay', 'amazon pay', 'shop pay', 'cash app pay',
  'venmo', 'apple', 'apple iap', 'apple in-app purchase', 'apple internal',
  'apple app store', 'apple app store payments', 'alipay', 'm-pesa',
  'stripe link', 'rivian wallet', 'paypal / venmo', 'paypal/venmo',
  'apple pay / google pay', 'ant group / alipay',
  // App-store billing
  'google play', 'google play billing', 'google play store',
  'google payments', 'amazon iap', 'amazon appstore',
  'roku billing services', 'roku pay',
  'apple app store / google play', 'app store / google play',
  'apple/google/amazon/roku',
  // BNPL / lenders
  'klarna', 'affirm', 'afterpay', 'zip', 'uplift', 'carecredit',
  'afterpay/zip', 'clearpay/afterpay',
  // Card networks
  'visa', 'mastercard', 'american express', 'discover global network',
  'uatp', 'visa network', 'visa direct', 'visa / mastercard',
  'visa/mc/amex/discover networks', 'visa / mastercard / amex / discover',
  'visa/mc direct', 'mastercard gateway', 'visa / mastercard / amex',
  // Mass-payout platforms
  'hyperwallet', 'tipalti', 'payoneer', 'payoneer checkout', 'melio',
  'wise', 'dwolla', 'modern treasury', 'pingpong',
  // Subscription / billing software (not the processor underneath)
  'zuora', 'chargebee', 'recurly', 'recurly gateway', 'paddle', 'avalara',
  'stripe billing', 'stripe capital', 'stripe radar', 'stripe identity',
  'stripe tax', 'stripe adaptive acceptance',
  'stripe optimized checkout suite', 'stripe terminal', 'stripe express',
  'churn buster', 'revenuecat', 'orb', 'flex', 'ezypay',
  'hubspot payments', 'sertifi', 'commerce layer', 'sabre synxis',
  'onyx centersource/grouppay', 'oracle payments', 'xsolla pay station',
  'stripe [inference]',
  // Marketplace billing
  'aws marketplace', 'azure marketplace', 'azure billing',
  'google cloud marketplace',
  // Carrier/mobile billing
  'carrier billing', 'bango', 'docomo digital', 'codapay', 'boku',
  // Transfer rails
  'ach', 'ach direct debit', 'ach direct deposit', 'ach debit',
  'sepa direct debit', 'wire transfer', 'bank transfer', 'bank wire',
  'bank wire / ach', 'wire transfer / ach', 'wire transfer / check',
  'check', 'wire / check', 'direct debit', 'ach/e-check',
  'ach / fedwire', 'ach/fedwire', 'ach / sepa', 'ach / sepa / bacs',
  'sepa dd / bacs / ach', 'ach / direct debit', 'ach / nacha',
  'paycheck deduction', 'internal ach processing', 'ebt/snap',
  'ach debit',
  // Crypto off-ramp / custody
  'circle', 'zerohash', 'bitstamp', 'gemini', 'triple-a', 'bancard',
  'dtcc', 'schwab clearing', 'bridge / stripe',
  // Sponsor banks (BaaS / issuing, not acquirers)
  'cross river bank', 'celtic bank', 'coastal community bank',
  'mvb bank', 'sutton bank', 'bny mellon', 'webbank', 'green dot bank',
  'tab bank', 'charles schwab bank', 'sofi bank n.a.',
  'lucid financial services', 'rivian financial services',
  'synchrony bank', 'pathward n.a.', 'citi retail services',
  'capital one', 'j.p. morgan / mizuho / waterfall',
  // Placeholders / non-answers
  'card acquiring', 'credit card', 'credit card processing',
  'credit/debit card processor', 'card processor', 'undisclosed card processor',
  'undisclosed acquirer', 'undisclosed primary processor',
  'undisclosed primary acquirer', 'third-party payment processor',
  'legacy processors', 'multiple psps', 'multiple', 'internal',
  'internal billing stack', 'internal escrow', 'internal/regional acquirers',
  'cards only', 'cryptocurrency processor', 'external gateways',
  'third-party pos', 'third-party iframes', 'enterprise invoicing',
  'local payout banks', 'local banking partners', 'mobile money networks',
  'local bank acquirers', 'comcast internal billing', 'microsoft commerce',
  'salesforce commerce cloud',
  // Borderline cases approved for drop: ACH/data-auth, card issuing BaaS,
  // local rails/methods, operator contamination, loyalty programs.
  'plaid', 'marqeta', 'galileo', 'sofort', 'leovegas',
  'spei / pix / cvu / pse', 'pse', 'seapass',
])

// Heuristic: anything starting with "stripe " followed by a non-core product
// is a Stripe feature, not the PSP itself. We keep only 'stripe',
// 'stripe connect', 'stripe standard' (all real PSP configurations).
const STRIPE_KEEP = new Set(['stripe', 'stripe connect', 'stripe standard'])

function normKey(s) {
  return String(s || '').trim().toLowerCase()
}

// Returns the canonical display name (preserving casing) for a raw PSP name.
function canonical(rawName) {
  const raw = String(rawName || '').trim()
  if (!raw) return raw
  const key = normKey(raw)
  if (NORMALIZE[key]) return NORMALIZE[key]
  return raw
}

function shouldDrop(name) {
  const n = normKey(name)
  if (!n) return true
  if (DROP_EXACT.has(n)) return true
  if (n.startsWith('stripe ') && !STRIPE_KEEP.has(n)) return true
  if (n.includes('[inference]')) return true
  return false
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await sb.from('merchants').select('slug,name,psps')
  if (error) { console.error(error); process.exit(1) }

  const plan = []
  const uniqueKept = new Map()
  const uniqueDropped = new Map()

  for (const row of data) {
    const keep = []
    const drop = []
    const seen = new Set()
    for (const p of row.psps || []) {
      const canon = canonical(p.name)
      if (shouldDrop(canon)) {
        drop.push(p)
        uniqueDropped.set(p.name, (uniqueDropped.get(p.name) || 0) + 1)
        continue
      }
      // Dedupe within a merchant after normalization (e.g. "Stripe" appearing
      // twice, or "PayPal/Braintree" + "Braintree/PayPal" collapsing to one).
      const canonKey = normKey(canon)
      if (seen.has(canonKey)) continue
      seen.add(canonKey)
      keep.push({ ...p, name: canon })
      uniqueKept.set(canon, (uniqueKept.get(canon) || 0) + 1)
    }
    const changed = drop.length > 0 ||
      keep.length !== (row.psps || []).length ||
      keep.some((k, i) => k.name !== (row.psps || [])[i]?.name)
    if (changed) {
      plan.push({ slug: row.slug, name: row.name, before: row.psps || [], keep, drop })
    }
  }

  const needsRefill = plan.filter((p) => p.keep.length < 3)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ plan, summary: {
    merchants_total: data.length,
    merchants_affected: plan.length,
    merchants_needing_refill: needsRefill.length,
    unique_kept: [...uniqueKept.entries()].sort((a,b) => b[1]-a[1]),
    unique_dropped: [...uniqueDropped.entries()].sort((a,b) => b[1]-a[1]),
  } }, null, 2))

  console.log('==================================================')
  console.log('PSP CLEANUP DRY RUN — no Supabase writes happened')
  console.log('==================================================')
  console.log(`Merchants total:          ${data.length}`)
  console.log(`Merchants with drops:     ${plan.length}`)
  console.log(`Will drop below 3 PSPs:   ${needsRefill.length} (need refill)`)
  console.log()
  console.log('--- Names being DROPPED (count of merchants) ---')
  for (const [name, count] of [...uniqueDropped.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(String(count).padStart(4), name)
  }
  console.log()
  console.log('--- Names being KEPT (count of merchants) ---')
  for (const [name, count] of [...uniqueKept.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(String(count).padStart(4), name)
  }
  console.log()
  console.log(`Plan written to: ${OUT}`)
}

main()

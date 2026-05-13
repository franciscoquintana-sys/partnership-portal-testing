// Strict QA pass on Supabase merchants.psps so the Diagnostic topology
// renders ONLY real PSPs (acquirers, gateways, processors, regional
// PSP/APM aggregators, SMB-PSPs). Drops orchestrators, banks, wallets,
// BNPL, IAP, bank rails, sponsor banks, marketplaces, payouts, MoRs,
// cross-border, billing software, POS terminals, issuer processors,
// crypto, etc.
//
// Two-step pass per merchant:
//   1. Normalize role labels for canonical PSPs that historically got
//      mislabeled (Stripe="Global · cards" → "Global · processor",
//      Razorpay="APAC · cards" → "India · acquirer", etc).
//   2. Drop any entry whose role doesn't match the strict allowlist.
//   3. Dedupe by canonical name.
//   4. Pad to 4 with global fillers (Adyen, Stripe, Braintree,
//      Checkout.com, Worldpay, Cybersource).
//
// Run:  node --env-file=.env.local scripts/qa-topology-strict.mjs --dry-run
// Apply: node --env-file=.env.local scripts/qa-topology-strict.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')

// Canonical role overrides for known PSPs whose role got stored as
// "cards" or other non-PSP-sounding labels in some merchant rows. The
// override key is the lowercased PSP name.
const ROLE_OVERRIDES = {
  'stripe': 'Global · processor',
  'stripe standard': 'Global · processor',
  'stripe [inference]': 'Global · processor',
  'stripe connect': 'Global · processor',
  'adyen': 'Global · acquirer',
  'braintree': 'Global · PayPal unit',
  'braintree / paypal': 'Global · PayPal unit',
  'braintree/paypal': 'Global · PayPal unit',
  'paypal/braintree': 'Global · PayPal unit',
  'paypal / braintree': 'Global · PayPal unit',
  'worldpay': 'Global · acquirer',
  'checkout.com': 'EMEA · acquirer',
  'cybersource': 'Global · gateway',
  'cybersource/visa': 'Global · gateway',
  'razorpay': 'India · acquirer',
  'fiserv': 'US · acquirer',
  'first data': 'US · acquirer',
  'chase paymentech': 'US · acquirer',
  'jpmorgan payments': 'US · acquirer',
  'shopify payments': 'Global · processor',
  'square': 'US · processor',
  'square payments': 'US · processor',
  'ebanx': 'LatAm · APMs',
  'onlineips': 'Regional · gateway',
  'axcess ps': 'Regional · gateway',
}

// Names that are explicitly NOT PSPs and must always be dropped, even
// if their role string happens to contain an allowed substring. Match
// is case-insensitive after trim.
const NAME_DROPLIST = new Set([
  // Orchestrators
  'juspay', 'primer', 'revenuecat',
  // Banks (when not their acquirer arm)
  'jpmorgan chase', 'jp morgan chase', 'jpmorgan', 'j.p. morgan',
  'j.p. morgan / mizuho / waterfall', 'citibank', 'bny mellon',
  'capital one', 'charles schwab bank', 'lucid financial services',
  'sofi bank n.a.', 'tab bank', 'citi retail services',
  'synchrony bank',
  // Sponsor banks
  'cross river bank', 'celtic bank', 'coastal community bank',
  'mvb bank', 'sutton bank', 'webbank', 'green dot bank',
  'pathward n.a.', 'rivian financial services',
  // Wallets / pay buttons
  'paypal', 'paypal complete', 'paypal complete payments',
  'paypal / venmo', 'paypal/venmo', 'apple pay', 'google pay',
  'amazon pay', 'shop pay', 'cash app pay', 'venmo', 'alipay',
  'm-pesa', 'stripe link', 'rivian wallet', 'apple pay / google pay',
  'ant group / alipay', 'airtm', 'onepay', 'google payments',
  // BNPL / lenders
  'klarna', 'affirm', 'afterpay', 'zip', 'uplift', 'carecredit',
  'afterpay/zip', 'clearpay/afterpay', 'ratepay',
  // Card networks / placeholders
  'visa', 'mastercard', 'american express', 'discover global network',
  'uatp', 'visa network', 'visa direct', 'visa / mastercard',
  'visa/mc/amex/discover networks', 'visa / mastercard / amex / discover',
  'visa/mc direct', 'mastercard gateway', 'visa / mastercard / amex',
  'credit card', 'credit card processing', 'credit/debit card processor',
  'card processor', 'cards only', 'cryptocurrency processor',
  // App-store billing / IAP
  'apple', 'apple iap', 'apple in-app purchase', 'apple internal',
  'apple app store', 'apple app store payments', 'google play',
  'google play billing', 'google play store', 'amazon iap',
  'amazon appstore', 'roku billing services', 'roku pay',
  'apple app store / google play', 'app store / google play',
  'apple/google/amazon/roku',
  // Bank rails / transfer rails
  'ach', 'ach direct debit', 'ach direct deposit', 'ach debit',
  'ach/e-check', 'ach / fedwire', 'ach/fedwire', 'ach / sepa',
  'ach / sepa / bacs', 'ach / direct debit', 'ach / nacha',
  'sepa direct debit', 'sepa dd / bacs / ach', 'wire transfer',
  'bank transfer', 'bank wire', 'bank wire / ach',
  'wire transfer / ach', 'wire transfer / check', 'check',
  'wire / check', 'direct debit', 'gocardless', 'modern treasury',
  'dwolla', 'sofort', 'pse', 'spei / pix / cvu / pse',
  'paycheck deduction', 'internal ach processing', 'ebt/snap',
  // Mass-payout platforms
  'hyperwallet', 'tipalti', 'payoneer', 'payoneer checkout', 'melio',
  'wise', 'pingpong',
  // Cross-border MoRs
  'flywire', 'esw', 'fiftyone/global-e', 'useepay',
  // Subscription / billing software
  'zuora', 'chargebee', 'recurly', 'recurly gateway', 'paddle',
  'avalara', 'churn buster', 'orb', 'flex', 'ezypay',
  'hubspot payments', 'sertifi', 'commerce layer', 'sabre synxis',
  'onyx centersource/grouppay', 'oracle payments',
  'xsolla', 'xsolla pay station',
  // Stripe feature modules (keep core Stripe / Stripe Standard / Stripe Connect)
  'stripe billing', 'stripe capital', 'stripe radar', 'stripe identity',
  'stripe tax', 'stripe adaptive acceptance', 'stripe terminal',
  'stripe express', 'stripe optimized checkout suite',
  // Marketplace billing
  'aws marketplace', 'azure marketplace', 'azure billing',
  'google cloud marketplace', 'microsoft commerce',
  'salesforce commerce cloud',
  // Carrier/mobile billing
  'carrier billing', 'bango', 'docomo digital', 'codapay', 'boku',
  // Crypto off-ramp / custody / stablecoin
  'circle', 'zerohash', 'bitstamp', 'gemini', 'triple-a', 'bancard',
  'dtcc', 'schwab clearing', 'bridge / stripe',
  // Issuer processors (card issuance, not acceptance)
  'galileo', 'galileo/technisys', 'marqeta', 'paymentology',
  // Open banking data / ID
  'plaid', 'truelayer',
  // POS terminals (when name explicit)
  'softpay', 'clover / fiserv',
  // Vertical CRM / niche modules
  'lawpay', 'pay theory',
  // Hospitality plug-ins
  'planet',
  // Placeholders / non-answers
  'card acquiring', 'undisclosed card processor', 'undisclosed acquirer',
  'undisclosed primary processor', 'undisclosed primary acquirer',
  'undisclosed payment processor',
  'third-party payment processor', 'legacy processors', 'multiple psps',
  'multiple', 'internal', 'internal billing stack', 'internal escrow',
  'internal/regional acquirers', 'external gateways', 'third-party pos',
  'third-party iframes', 'enterprise invoicing', 'local payout banks',
  'local banking partners', 'mobile money networks', 'local bank acquirers',
  'comcast internal billing', 'leovegas', 'spei / pix / cvu / pse',
  'seapass', 'sofort',
  // Per-merchant junk surfaced during QA (insurance/healthcare claim flows,
  // cloud vendors, video tools, the merchant's own product name, etc.)
  'insurance claims', 'medicare/medicaid', 'bluejeans by verizon',
  'google cloud', '3,400+ us bank connections', 'radial',
  'mastercard start path', 'link money',
  // Invoicing / billing rails surfacing as fake "PSPs"
  'invoice / net 30', 'direct invoicing', 'direct web billing',
  'purchase order / wire transfer', 'invoice', 'po / wire',
  // Ad networks / wallets / banks slipping through with gateway roles
  'pangle / tiktok', 'column n.a.', 'proprietary agent wallet',
])

// Allowed role substrings (lowercased) — entry survives only if its
// (post-override) role contains one of these. This is the second guard
// after the name droplist.
const ALLOWED_ROLE_RE = /\bacquirer|\bgateway|\bprocessor\b|paypal unit|\bapms?\b|\bsmb\b|\bpsp\b/i

// Variant → canonical name. Applied before everything else so the
// droplist and overrides see one canonical form.
const NORMALIZE = {
  'jpmorgan': 'JPMorgan Chase',
  'jpmorgan chase': 'JPMorgan Chase',
  'jp morgan chase': 'JPMorgan Chase',
  'j.p. morgan': 'JPMorgan Chase',
  'jpmorgan payments': 'JPMorgan Chase',
  'chase': 'JPMorgan Chase',
  'cybersource': 'Cybersource',
  'cybersource/visa': 'Cybersource',
  'cybersource / worldpay / moneris': 'Cybersource',
  'authorize.net': 'Authorize.net',
  'auth.net': 'Authorize.net',
  'ebanx': 'EBANX',
  'mercadopago': 'Mercado Pago',
  'mercado pago': 'Mercado Pago',
  'paypal/braintree': 'Braintree',
  'paypal / braintree': 'Braintree',
  'braintree/paypal': 'Braintree',
  'braintree / paypal': 'Braintree',
  'square payments': 'Square',
  'ingenico / worldline': 'Worldline',
  'galileo/technisys': 'Galileo',
}

// Fillers used when a merchant ends up with <4 PSPs after the cleanup.
const FILLER_POOL = [
  { name: 'Adyen',        role: 'Global · acquirer' },
  { name: 'Stripe',       role: 'Global · processor' },
  { name: 'Braintree',    role: 'Global · PayPal unit' },
  { name: 'Checkout.com', role: 'EMEA · acquirer' },
  { name: 'Worldpay',     role: 'Global · acquirer' },
  { name: 'Cybersource',  role: 'Global · gateway' },
]

const TARGET_COUNT = 4

function normKey(s) { return String(s || '').trim().toLowerCase() }

function canonicalName(raw) {
  const n = String(raw || '').trim()
  if (!n) return n
  const k = normKey(n)
  return NORMALIZE[k] || n
}

function applyRoleOverride(name, role) {
  const k = normKey(name)
  return ROLE_OVERRIDES[k] || role
}

function isDropped(name) {
  const k = normKey(name)
  if (!k) return true
  if (NAME_DROPLIST.has(k)) return true
  if (k.includes('[inference]')) return true
  // Any "stripe X" we didn't whitelist explicitly is a Stripe feature module.
  if (k.startsWith('stripe ') && !['stripe', 'stripe standard', 'stripe connect'].includes(k)) {
    return true
  }
  return false
}

function pickFillers(currentPsps, target = TARGET_COUNT) {
  if (currentPsps.length >= target) return []
  const taken = new Set(currentPsps.map((p) => normKey(p.name)))
  const fillers = []
  for (const cand of FILLER_POOL) {
    if (currentPsps.length + fillers.length >= target) break
    if (taken.has(normKey(cand.name))) continue
    fillers.push(cand)
    taken.add(normKey(cand.name))
  }
  return fillers
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const { data: rows, error } = await sb
    .from('merchants')
    .select('slug, name, psps')
  if (error) { console.error(error); process.exit(1) }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  if (!dryRun) {
    const backupPath = path.join(OUT_DIR, `psp-backup-${ts}.json`)
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2))
    console.log(`Backup written: ${backupPath}`)
  }

  const changeLog = []
  let touched = 0, skipped = 0, failed = 0
  let droppedTotal = 0, refilledTotal = 0, roleFixedTotal = 0

  for (const row of rows) {
    const before = Array.isArray(row.psps) ? row.psps : []
    const dropped = []
    const survivors = []
    const seen = new Set()
    let roleFixed = 0

    for (const raw of before) {
      if (!raw || !raw.name) continue
      const name = canonicalName(raw.name)
      if (isDropped(name)) {
        dropped.push({ ...raw, name })
        continue
      }
      const overrideRole = applyRoleOverride(name, raw.role)
      if (overrideRole !== raw.role) roleFixed++
      const role = overrideRole || ''
      if (!ALLOWED_ROLE_RE.test(role)) {
        dropped.push({ name, role })
        continue
      }
      const key = normKey(name)
      if (seen.has(key)) continue
      seen.add(key)
      survivors.push({ name, role })
    }

    // Cap at 4 (research could have surfaced 5+ valid PSPs)
    let kept = survivors.slice(0, TARGET_COUNT)
    const fillers = pickFillers(kept, TARGET_COUNT)
    const next = [...kept, ...fillers]

    const same =
      next.length === before.length &&
      next.every((p, i) => p.name === before[i]?.name && p.role === before[i]?.role)

    if (same) { skipped++; continue }

    droppedTotal += dropped.length
    refilledTotal += fillers.length
    roleFixedTotal += roleFixed
    changeLog.push({
      slug: row.slug,
      name: row.name,
      before,
      after: next,
      dropped,
      filled: fillers,
      role_fixes: roleFixed,
    })

    if (dryRun) { touched++; continue }

    const { error: updErr } = await sb
      .from('merchants')
      .update({ psps: next })
      .eq('slug', row.slug)
    if (updErr) {
      console.error(`[${row.slug}] update failed:`, updErr.message)
      failed++
    } else {
      touched++
    }
  }

  const logPath = path.join(OUT_DIR, `psp-qa-strict-${ts}.json`)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(logPath, JSON.stringify(changeLog, null, 2))

  console.log('')
  console.log(`Mode:               ${dryRun ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Rows scanned:       ${rows.length}`)
  console.log(`Touched:            ${touched}`)
  console.log(`Skipped (no diff):  ${skipped}`)
  console.log(`Failed:             ${failed}`)
  console.log(`Entries dropped:    ${droppedTotal}`)
  console.log(`Entries filled:     ${refilledTotal}`)
  console.log(`Role labels fixed:  ${roleFixedTotal}`)
  console.log(`Change log:         ${logPath}`)
}

main().catch((err) => { console.error(err); process.exit(1) })

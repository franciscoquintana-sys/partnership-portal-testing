// Re-cleans every merchant's psps[] from the pre-QA backup snapshot,
// applying the same drop + role-normalize rules as qa-topology-strict.mjs
// but WITHOUT padding to 4. Result: each merchant ends up with only the
// PSPs that came from research (1, 2, 3, or 4 entries). Filler entries
// added by the previous fill-to-four pass are removed.
//
// Run:   node --env-file=.env.local scripts/strip-fillers.mjs --dry-run
// Apply: node --env-file=.env.local scripts/strip-fillers.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, 'out')
// Pre-QA backup, captured at the start of qa-topology-strict.mjs's first
// applied run. This is the last snapshot before fillers were inserted.
const SOURCE_BACKUP = path.join(OUT_DIR, 'psp-backup-2026-04-28T16-37-16-756Z.json')

// Mirrored from qa-topology-strict.mjs so the cleanup logic stays
// identical. Keep these two files in sync if either changes.

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

const NAME_DROPLIST = new Set([
  'juspay', 'primer', 'revenuecat',
  'jpmorgan chase', 'jp morgan chase', 'jpmorgan', 'j.p. morgan',
  'j.p. morgan / mizuho / waterfall', 'citibank', 'bny mellon',
  'capital one', 'charles schwab bank', 'lucid financial services',
  'sofi bank n.a.', 'tab bank', 'citi retail services',
  'synchrony bank',
  'cross river bank', 'celtic bank', 'coastal community bank',
  'mvb bank', 'sutton bank', 'webbank', 'green dot bank',
  'pathward n.a.', 'rivian financial services',
  'paypal', 'paypal complete', 'paypal complete payments',
  'paypal / venmo', 'paypal/venmo', 'apple pay', 'google pay',
  'amazon pay', 'shop pay', 'cash app pay', 'venmo', 'alipay',
  'm-pesa', 'stripe link', 'rivian wallet', 'apple pay / google pay',
  'ant group / alipay', 'airtm', 'onepay', 'google payments',
  'klarna', 'affirm', 'afterpay', 'zip', 'uplift', 'carecredit',
  'afterpay/zip', 'clearpay/afterpay', 'ratepay',
  'visa', 'mastercard', 'american express', 'discover global network',
  'uatp', 'visa network', 'visa direct', 'visa / mastercard',
  'visa/mc/amex/discover networks', 'visa / mastercard / amex / discover',
  'visa/mc direct', 'mastercard gateway', 'visa / mastercard / amex',
  'credit card', 'credit card processing', 'credit/debit card processor',
  'card processor', 'cards only', 'cryptocurrency processor',
  'apple', 'apple iap', 'apple in-app purchase', 'apple internal',
  'apple app store', 'apple app store payments', 'google play',
  'google play billing', 'google play store', 'amazon iap',
  'amazon appstore', 'roku billing services', 'roku pay',
  'apple app store / google play', 'app store / google play',
  'apple/google/amazon/roku',
  'ach', 'ach direct debit', 'ach direct deposit', 'ach debit',
  'ach/e-check', 'ach / fedwire', 'ach/fedwire', 'ach / sepa',
  'ach / sepa / bacs', 'ach / direct debit', 'ach / nacha',
  'sepa direct debit', 'sepa dd / bacs / ach', 'wire transfer',
  'bank transfer', 'bank wire', 'bank wire / ach',
  'wire transfer / ach', 'wire transfer / check', 'check',
  'wire / check', 'direct debit', 'gocardless', 'modern treasury',
  'dwolla', 'sofort', 'pse', 'spei / pix / cvu / pse',
  'paycheck deduction', 'internal ach processing', 'ebt/snap',
  'hyperwallet', 'tipalti', 'payoneer', 'payoneer checkout', 'melio',
  'wise', 'pingpong',
  'flywire', 'esw', 'fiftyone/global-e', 'useepay',
  'zuora', 'chargebee', 'recurly', 'recurly gateway', 'paddle',
  'avalara', 'churn buster', 'orb', 'flex', 'ezypay',
  'hubspot payments', 'sertifi', 'commerce layer', 'sabre synxis',
  'onyx centersource/grouppay', 'oracle payments',
  'xsolla', 'xsolla pay station',
  'stripe billing', 'stripe capital', 'stripe radar', 'stripe identity',
  'stripe tax', 'stripe adaptive acceptance', 'stripe terminal',
  'stripe express', 'stripe optimized checkout suite',
  'aws marketplace', 'azure marketplace', 'azure billing',
  'google cloud marketplace', 'microsoft commerce',
  'salesforce commerce cloud',
  'carrier billing', 'bango', 'docomo digital', 'codapay', 'boku',
  'circle', 'zerohash', 'bitstamp', 'gemini', 'triple-a', 'bancard',
  'dtcc', 'schwab clearing', 'bridge / stripe',
  'galileo', 'galileo/technisys', 'marqeta', 'paymentology',
  'plaid', 'truelayer',
  'softpay', 'clover / fiserv',
  'lawpay', 'pay theory',
  'planet',
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
  'insurance claims', 'medicare/medicaid', 'bluejeans by verizon',
  'google cloud', '3,400+ us bank connections', 'radial',
  'mastercard start path', 'link money',
  // Invoicing / billing rails surfacing as fake "PSPs"
  'invoice / net 30', 'direct invoicing', 'direct web billing',
  'purchase order / wire transfer', 'invoice', 'po / wire',
  // Ad networks / wallets / banks slipping through with gateway roles
  'pangle / tiktok', 'column n.a.', 'proprietary agent wallet',
])

const ALLOWED_ROLE_RE = /\bacquirer|\bgateway|\bprocessor\b|paypal unit|\bapms?\b|\bsmb\b|\bpsp\b/i

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

function normKey(s) { return String(s || '').trim().toLowerCase() }

function canonicalName(raw) {
  const n = String(raw || '').trim()
  if (!n) return n
  const k = normKey(n)
  return NORMALIZE[k] || n
}

function isDropped(name) {
  const k = normKey(name)
  if (!k) return true
  if (NAME_DROPLIST.has(k)) return true
  if (k.includes('[inference]')) return true
  if (k.startsWith('stripe ') && !['stripe', 'stripe standard', 'stripe connect'].includes(k)) {
    return true
  }
  return false
}

function cleanPsps(rawArray) {
  const survivors = []
  const seen = new Set()
  for (const raw of rawArray || []) {
    if (!raw || !raw.name) continue
    const name = canonicalName(raw.name)
    if (isDropped(name)) continue
    const role = ROLE_OVERRIDES[normKey(name)] || raw.role || ''
    if (!ALLOWED_ROLE_RE.test(role)) continue
    const key = normKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    survivors.push({ name, role })
  }
  return survivors
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const sourceRows = JSON.parse(fs.readFileSync(SOURCE_BACKUP, 'utf8'))
  console.log(`Source backup: ${path.basename(SOURCE_BACKUP)} (${sourceRows.length} rows)`)

  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  if (!dryRun) {
    const { data: current } = await sb.from('merchants').select('slug, psps')
    const backupPath = path.join(OUT_DIR, `psp-backup-${ts}.json`)
    fs.writeFileSync(backupPath, JSON.stringify(current, null, 2))
    console.log(`Pre-strip backup: ${backupPath}`)
  }

  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 }
  const changeLog = []
  let touched = 0, failed = 0, empty = 0

  for (const row of sourceRows) {
    const cleaned = cleanPsps(row.psps).slice(0, 4)
    const bucket = cleaned.length >= 5 ? '5+' : cleaned.length
    distribution[bucket]++
    if (cleaned.length === 0) empty++

    changeLog.push({
      slug: row.slug,
      before: row.psps,
      after: cleaned,
    })

    if (dryRun) continue

    const { error } = await sb
      .from('merchants')
      .update({ psps: cleaned })
      .eq('slug', row.slug)
    if (error) {
      console.error(`[${row.slug}] update failed:`, error.message)
      failed++
    } else {
      touched++
    }
  }

  const logPath = path.join(OUT_DIR, `psp-strip-fillers-${ts}.json`)
  fs.writeFileSync(logPath, JSON.stringify(changeLog, null, 2))

  console.log('')
  console.log(`Mode:              ${dryRun ? 'DRY RUN' : 'APPLIED'}`)
  console.log(`Rows scanned:      ${sourceRows.length}`)
  console.log(`Touched:           ${touched}`)
  console.log(`Failed:            ${failed}`)
  console.log(`Merchants empty:   ${empty}`)
  console.log(`Distribution:`)
  for (const [k, v] of Object.entries(distribution)) {
    console.log(`  ${k} PSPs: ${v}`)
  }
  console.log(`Change log:        ${logPath}`)
}

main().catch((err) => { console.error(err); process.exit(1) })

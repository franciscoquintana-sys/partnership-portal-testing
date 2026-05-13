// Pull every merchant from Supabase and flag rows whose psps[] contains
// entries that are NOT actually PSPs (e.g. "Credit Card", "Invoice / Wire",
// "Bank Transfer", "ACH" with no brand). Mirrors the NON_PSP_PATTERNS list
// inside ingest-merchants.mjs so this audit and the ingest filter stay
// in sync.
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const NON_PSP_PATTERNS = [
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
  /^apple\s+pay$/i,
  /^google\s+pay$/i,
  /^samsung\s+pay$/i,
  /^apple\s+pay\s*\/\s*google\s+pay$/i,
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
  /^mastercard$/i,
  /^mastercard\s+start\s+path$/i,
  /^visa$/i,
  /^visa\s+network$/i,
  /^visa\s*\/\s*mastercard(\s|\/|$)/i,
  /^visa\/mc(\s|\/|$)/i,
  /^discover\s+global\s+network$/i,
  /^unionpay$/i,
  /^mrv\s+banks?$/i,
  /^republic\s+bank\s*(&|and)\s*trust/i,
  /^venmo$/i,
  /^cash\s*app(\s+pay)?$/i,
  /^paypal$/i,
  /^paypal\s*\/\s*venmo$/i,
  /^paypal\s*complete(\s+payments)?$/i,
  /^amazon\s+pay$/i,
  /^shop\s+pay$/i,
  /^stripe\s+link$/i,
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

const { data, error } = await sb.from('merchants').select('slug, name, psps').order('slug')
if (error) { console.error(error); process.exit(1) }

const flagged = []
const noPsps = []
for (const row of data) {
  const all = (row.psps || []).map((p) => p.name)
  const bad = (row.psps || []).filter((p) => isNonPsp(p.name))
  if (bad.length) flagged.push({ slug: row.slug, name: row.name, all, bad: bad.map((p) => p.name) })
  if (all.length === 0) noPsps.push({ slug: row.slug, name: row.name })
}

console.log(`Total merchants: ${data.length}`)
console.log(`Flagged: ${flagged.length}`)
console.log(`Empty psps[]: ${noPsps.length}\n`)
for (const m of flagged) {
  console.log(`${m.slug} (${m.name})`)
  console.log(`  all: ${m.all.join(' | ')}`)
  console.log(`  bad: ${m.bad.join(' | ')}`)
}
if (noPsps.length) {
  console.log('\n--- merchants with empty psps[] (slide will hide topology) ---')
  for (const m of noPsps) console.log(`  ${m.slug} (${m.name})`)
}

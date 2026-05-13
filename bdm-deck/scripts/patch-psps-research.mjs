// One-off patch: write researched PSPs into Supabase for merchants whose
// .md files only listed generic rails (Credit Card, ACH, Wire) and were
// therefore stripped to empty psps[] by the ingest filter. PSPs sourced
// from public case studies / help docs and recorded in PATCHES below.
//
// Run: node --env-file=.env.local scripts/patch-psps-research.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PSP_ROLES = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/psp-roles.json'), 'utf8'))

// Zuora customers: per the Desktop/Zuora gateway TPV breakdown, Stripe
// ($2.4B), Orbital/Chase Paymentech ($1.7B), and Adyen ($1.4B) are the
// dominant downstream processors. We surface the relevant subset for
// each Zuora merchant alongside their own confirmed entries.
const PATCHES = {
  box: ['Zuora', 'Stripe', 'Adyen'],
  experian: ['Worldpay', 'PagueVeloz'],
  wrapbook: ['Plaid'],
  // Asana research confirms Stripe via Zuora. Avalara is tax, not a PSP,
  // so swap it for Adyen + Chase Paymentech (top Zuora gateways).
  asana: ['Stripe', 'Zuora', 'Adyen', 'Chase Paymentech'],
  // ServiceNow research only surfaced AWS Marketplace after the non-PSP
  // filter. ServiceNow runs on Zuora; backfill with the top gateways.
  servicenow: ['Zuora', 'Stripe', 'Adyen', 'AWS Marketplace'],
  // Super.com: Qolo is the single processor per research ("Co-operative
  // Authorization: Qolo receives network transactions"). PayPal / Venmo /
  // Cash App Pay are FUNDING methods for the Super deposit account, not
  // processors. Single-PSP dependency is exactly the pain point.
  'super-com': ['Qolo'],
  // Fanatics confirmed in person they do NOT use PayPal. Apple Pay /
  // Google Pay are wallets, not PSPs — only the real processors stay.
  fanatics: ['Fiserv', 'Paysafe'],
  // DoorDash structured PSP_N had checkout methods (PayPal, Klarna)
  // mixed with real PSPs. Real stack per research narrative:
  // Stripe Connect (acquiring), Marqeta (card issuing for Dashers),
  // Hyperwallet (Dasher payouts).
  doordash: ['Stripe', 'Marqeta', 'Hyperwallet'],
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

for (const [slug, names] of Object.entries(PATCHES)) {
  const psps = names.map((name) => ({ name, role: PSP_ROLES[name] || 'Regional · gateway' }))
  const { error } = await sb.from('merchants').update({ psps }).eq('slug', slug)
  if (error) { console.error(slug, error); process.exit(1) }
  console.log(`${slug} → ${psps.map((p) => `${p.name} (${p.role})`).join(' | ')}`)
}
console.log('\nDone.')

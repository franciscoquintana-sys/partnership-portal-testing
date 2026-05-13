// Scans every merchant research .md in /Research and emits two alphabetized
// JSON files: the unique universe of PSP names and the unique universe of
// local-payment-method names. These feed the role + market lookups that
// the ingest step applies before writing to Supabase.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RESEARCH_ROOT = '/Users/isabellapdl/Desktop/Stripe Sessions Decks/Research'
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sql')

function extractBlock(md) {
  const match = md.match(/DATABASE FIELDS:[\s\S]*?```/m)
  return match ? match[0] : null
}

// Strip parenthesized context like "Adyen (EU/UK/US card issuance)" → "Adyen"
// and filter junk like "(No additional PSPs confirmed)".
const JUNK = new Set([
  'N/A', 'Undisclosed', 'None identified', 'None confirmed',
  'None', 'TBD', 'Unknown', 'Not disclosed', 'Credit/Debit Cards',
  'Credit Cards', 'Debit Cards',
])

function normalize(raw) {
  const stripped = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  if (!stripped || stripped.startsWith('No ') || /^\(/.test(raw.trim())) return null
  if (JUNK.has(stripped)) return null
  return stripped
}

function extractValues(block, prefix) {
  if (!block) return []
  const re = new RegExp(`^${prefix}[^:]*:\\s*(.+)$`, 'gm')
  const out = []
  let m
  while ((m = re.exec(block)) !== null) {
    // Some rows cram several values in one line: "Stripe PSP_2: Adyen PSP_3: ...".
    // Split on any re-occurrence of the prefix mid-string before normalizing.
    const parts = m[1].split(new RegExp(`\\s*${prefix}\\d+:\\s*`))
    for (const part of parts) {
      const v = normalize(part)
      if (v) out.push(v)
    }
  }
  return out
}

const folders = fs.readdirSync(RESEARCH_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'Companies & Parameters')

const psps = new Map()    // name -> count
const methods = new Map()

for (const folder of folders) {
  const dir = path.join(RESEARCH_ROOT, folder.name)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  if (!files.length) continue
  const md = fs.readFileSync(path.join(dir, files[0]), 'utf8')
  const block = extractBlock(md)

  for (const v of extractValues(block, 'PSP_')) {
    psps.set(v, (psps.get(v) || 0) + 1)
  }
  for (const v of extractValues(block, 'Local_M_')) {
    methods.set(v, (methods.get(v) || 0) + 1)
  }
}

function toSortedArray(map) {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
}

const pspOut = toSortedArray(psps)
const methodOut = toSortedArray(methods)

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'psps-unique.json'), JSON.stringify(pspOut, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'methods-unique.json'), JSON.stringify(methodOut, null, 2))

console.log(`Scanned ${folders.length} merchant folders.`)
console.log(`Unique PSPs: ${pspOut.length}`)
console.log(`Unique local methods: ${methodOut.length}`)
console.log(`Wrote ${path.join(OUT_DIR, 'psps-unique.json')}`)
console.log(`Wrote ${path.join(OUT_DIR, 'methods-unique.json')}`)

// Post-cleanup, lists every merchant currently carrying <3 PSPs in Supabase.
// These are the refill targets for step 3 (web research for real PSPs).
//
// Run: node --env-file=.env.local scripts/list-refill-targets.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out', 'psp-refill-targets.json')

async function main() {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await sb.from('merchants').select('slug,name,psps').order('slug')
  if (error) { console.error(error); process.exit(1) }

  const targets = data
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      current: r.psps || [],
      current_count: (r.psps || []).length,
      need: Math.max(0, 4 - (r.psps || []).length),
    }))
    .filter((t) => t.current_count < 4)

  fs.writeFileSync(OUT, JSON.stringify(targets, null, 2))
  console.log(`Merchants with <4 PSPs: ${targets.length}`)
  const buckets = { 0: [], 1: [], 2: [], 3: [] }
  for (const t of targets) buckets[t.current_count].push(t)
  for (const k of [0, 1, 2, 3]) {
    console.log(`  ${buckets[k].length} merchants at ${k} PSPs`)
  }
  console.log(`\nTargets written to: ${OUT}`)
}

main()

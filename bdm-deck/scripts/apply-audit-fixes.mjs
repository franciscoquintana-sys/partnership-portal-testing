// Applies the edits in scripts/sql/merchants-audit-fixes.json to the
// Supabase merchants table. Idempotent: re-running just rewrites the same
// values. Use --dry-run to preview without writing.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fixes = JSON.parse(fs.readFileSync(path.join(HERE, 'sql/merchants-audit-fixes.json'), 'utf8'))

const dryRun = process.argv.includes('--dry-run')
const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing env'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

async function loadMerchant(slug) {
  const { data, error } = await sb.from('merchants').select('*').eq('slug', slug).single()
  if (error) throw error
  return data
}

async function saveMerchant(slug, patch) {
  if (dryRun) { console.log(`[DRY] would patch ${slug}:`, Object.keys(patch).join(', ')); return }
  const { error } = await sb.from('merchants').update(patch).eq('slug', slug)
  if (error) throw error
  console.log(`Patched ${slug}: ${Object.keys(patch).join(', ')}`)
}

// --- Experian: replace empty psps with the speculative 4 ---
{
  const fix = fixes.experian
  if (!fix.psps || fix.psps.length !== 4) throw new Error('Experian fix malformed')
  const row = await loadMerchant('experian')
  console.log(`Experian: before psps=${row.psps?.length || 0}, after psps=${fix.psps.length}`)
  await saveMerchant('experian', { psps: fix.psps })
}

// --- Fanvue: update roles on the 2 placeholder PSPs by matching name ---
{
  const fix = fixes.fanvue
  const row = await loadMerchant('fanvue')
  const updated = (row.psps || []).map((p) => {
    const hit = fix.psps_to_update.find((u) => u.match_name === p.name)
    return hit ? { ...p, role: hit.new_role } : p
  })
  const changed = updated.filter((p, i) => p.role !== row.psps[i]?.role).map((p) => p.name)
  console.log(`Fanvue: role updates on [${changed.join(', ')}]`)
  await saveMerchant('fanvue', { psps: updated })
}

// --- Hostinger: replace any PSP whose name matches match_name ---
{
  const fix = fixes.hostinger
  const row = await loadMerchant('hostinger')
  const updated = (row.psps || []).map((p) => {
    const hit = fix.psps_to_replace.find((r) => r.match_name === p.name)
    return hit ? { name: hit.new_name, role: hit.new_role } : p
  })
  const changed = updated.filter((p, i) => p.name !== row.psps[i]?.name).map((p) => p.name)
  console.log(`Hostinger: replacements [${changed.join(', ')}]`)
  await saveMerchant('hostinger', { psps: updated })
}

console.log('Done.')

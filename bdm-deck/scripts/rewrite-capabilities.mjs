// Rewrite Yuno capability descriptions so they fit a ~240-char card budget
// on the Stripe Sessions deck. Reads from Supabase `merchants` table, calls
// Claude Sonnet 4.6 to compress each cell, and (by default) prints a dry-run
// preview. Only writes back when --apply is passed.
//
// Run (dry-run sample):
//   node --env-file=.env.local scripts/rewrite-capabilities.mjs --sample 10
//
// Run (apply one merchant):
//   node --env-file=.env.local scripts/rewrite-capabilities.mjs --merchant nubank --apply
//
// Run (apply all 828 cells):
//   node --env-file=.env.local scripts/rewrite-capabilities.mjs --all --apply
//
// Requires env:
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY
//   ANTHROPIC_API_KEY

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { mkdir, writeFile, appendFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'out')

// ---------- CLI parsing ----------
function parseArgs(argv) {
  const args = {
    sample: null,
    merchant: null,
    all: false,
    apply: false,
    onlyFailed: null,
    onlyTight: false,
  }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--sample') {
      args.sample = parseInt(rest[++i], 10)
    } else if (a.startsWith('--sample=')) {
      args.sample = parseInt(a.split('=')[1], 10)
    } else if (a === '--merchant') {
      args.merchant = rest[++i]
    } else if (a.startsWith('--merchant=')) {
      args.merchant = a.split('=')[1]
    } else if (a === '--all') {
      args.all = true
    } else if (a === '--only-failed') {
      args.onlyFailed = rest[++i]
    } else if (a.startsWith('--only-failed=')) {
      args.onlyFailed = a.split('=')[1]
    } else if (a === '--only-tight') {
      args.onlyTight = true
    } else if (a === '--apply') {
      args.apply = true
    } else if (a === '--apply=false') {
      args.apply = false
    } else if (a === '--apply=true') {
      args.apply = true
    }
  }
  // Default action: sample 10, dry-run
  if (
    args.sample == null &&
    !args.merchant &&
    !args.all &&
    !args.onlyFailed &&
    !args.onlyTight
  ) {
    args.sample = 10
  }
  return args
}

const args = parseArgs(process.argv)

// ---------- Env checks ----------
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error(
    'ERROR: Missing Supabase env. Run with: node --env-file=.env.local scripts/rewrite-capabilities.mjs ...',
  )
  process.exit(1)
}

const anthropicKey = process.env.ANTHROPIC_API_KEY
if (!anthropicKey) {
  console.error(
    'ERROR: ANTHROPIC_API_KEY is not set. Export it before running, e.g.\n' +
      '  export ANTHROPIC_API_KEY=sk-ant-...\n' +
      '  node --env-file=.env.local scripts/rewrite-capabilities.mjs --sample 10',
  )
  process.exit(1)
}

if (args.all && !args.apply) {
  console.error('ERROR: --all requires --apply. Refusing to touch all 828 cells without explicit opt-in.')
  process.exit(1)
}

const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
// maxRetries=6 gives the SDK room to back off through 429 rate-limit storms
// (Sonnet 4.6 is capped at 50 req/min on this org). timeout defaults handle
// long-tail completions.
const anthropic = new Anthropic({ apiKey: anthropicKey, maxRetries: 6 })

const MODEL = 'claude-sonnet-4-6'
const MAX_CHARS = 240
// 50 RPM org limit on Sonnet 4.6. With 2 calls per cell worst-case (retry
// path), concurrency 4 keeps average throughput around 20-40 RPM.
const CONCURRENCY = 4

// ---------- Prompt ----------
function buildPrompt({ company_name, capability_title, original, orig_len }) {
  return `You are rewriting one capability description for Yuno's sales deck.

Merchant: ${company_name}
Capability title: ${capability_title}
Original description (${orig_len} chars):
${original}

Rewrite it as a single paragraph, <= 240 characters (target 200-230), preserving:
- the merchant name if in original,
- all concrete numbers (dollars, %, country counts),
- named payment rails (PIX, BLIK, iDEAL, UPI, KakaoPay, etc.),
- the core value prop from the title.

Drop: PSP stack enumerations ("Stripe + Adyen + ..."), filler adjectives, repeated claims. Active voice, no em-dashes. Return ONLY the rewritten description, no preamble, no quotes.`
}

function buildStricterPrompt({ company_name, capability_title, original, orig_len, prev }) {
  return `Your previous rewrite was ${prev.length} chars, which is OVER the 240-char hard limit. Rewrite again, this time strictly <= 240 characters (target 200-220). Preserve the merchant name, numbers, and named rails. Drop PSP stack enumerations and filler. Active voice, no em-dashes, no quotes, no preamble.

Merchant: ${company_name}
Capability title: ${capability_title}
Original (${orig_len} chars):
${original}

Previous attempt (${prev.length} chars - TOO LONG):
${prev}

Return ONLY the new rewritten description.`
}

async function rewriteOne({ company_name, capability_title, original }) {
  const orig_len = original.length

  const call = async (prompt) => {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    // Strip wrapping quotes if model added them despite instruction
    return text.replace(/^["'`]+|["'`]+$/g, '').trim()
  }

  const first = await call(buildPrompt({ company_name, capability_title, original, orig_len }))
  if (first.length <= MAX_CHARS) {
    return { rewritten: first, flagged: false, retried: false }
  }

  const second = await call(
    buildStricterPrompt({ company_name, capability_title, original, orig_len, prev: first }),
  )
  if (second.length <= MAX_CHARS) {
    return { rewritten: second, flagged: false, retried: true }
  }

  // Neither passed - keep shorter of the two, flag it
  const shorter = second.length <= first.length ? second : first
  return { rewritten: shorter, flagged: true, retried: true }
}

// ---------- Fetch merchants ----------
async function fetchAllRows() {
  const { data, error } = await sb
    .from('merchants')
    .select('slug, name, capability_titles, capability_descs')
    .order('slug', { ascending: true })
  if (error) {
    console.error('Supabase error:', error)
    process.exit(1)
  }
  return data
}

function bucketOf(n) {
  if (n <= 240) return 'comfortable'
  if (n <= 320) return 'tight'
  return 'overflow'
}

// ---------- Sample picker ----------
function pickSample(allCells, n) {
  const overflow = allCells.filter((c) => c.bucket === 'overflow')
  const tight = allCells.filter((c) => c.bucket === 'tight')
  const comfortable = allCells.filter((c) => c.bucket === 'comfortable')

  const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // Goal: >=3 overflow, >=3 tight, >=2 comfortable, and all 4 slots covered
  const picked = []
  const slotsSeen = new Set()
  const pushPick = (c) => {
    picked.push(c)
    slotsSeen.add(c.slot)
  }

  const overflowShuf = shuffle(overflow)
  const tightShuf = shuffle(tight)
  const comfShuf = shuffle(comfortable)

  for (let i = 0; i < 3 && i < overflowShuf.length; i++) pushPick(overflowShuf[i])
  for (let i = 0; i < 3 && i < tightShuf.length; i++) pushPick(tightShuf[i])
  for (let i = 0; i < 2 && i < comfShuf.length; i++) pushPick(comfShuf[i])

  // Try to cover missing slots from remaining cells
  const pickedIds = new Set(picked.map((c) => `${c.slug}-${c.slot}`))
  const remaining = [...overflowShuf, ...tightShuf, ...comfShuf].filter(
    (c) => !pickedIds.has(`${c.slug}-${c.slot}`),
  )
  for (const c of remaining) {
    if (picked.length >= n) break
    if (!slotsSeen.has(c.slot)) pushPick(c)
  }

  // Fill up to n from remaining
  for (const c of remaining) {
    if (picked.length >= n) break
    const id = `${c.slug}-${c.slot}`
    if (!pickedIds.has(id)) {
      picked.push(c)
      pickedIds.add(id)
    }
  }

  return picked.slice(0, n)
}

// ---------- Concurrency helper ----------
async function runInBatches(items, batchSize, worker) {
  const results = new Array(items.length)
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize)
    const settled = await Promise.allSettled(slice.map((it, j) => worker(it, i + j)))
    settled.forEach((r, j) => {
      results[i + j] = r
    })
  }
  return results
}

// ---------- Main ----------
async function main() {
  console.log(`Model: ${MODEL}`)
  console.log(`Mode: ${args.apply ? 'APPLY (writes to Supabase)' : 'DRY-RUN (no writes)'}`)
  if (args.sample) console.log(`Picking ${args.sample} random cells`)
  if (args.merchant) console.log(`Single merchant: ${args.merchant}`)
  if (args.all) console.log(`ALL 828 cells (batch mode)`)

  await mkdir(OUT_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')

  const rows = await fetchAllRows()
  const allCells = []
  for (const m of rows) {
    const descs = m.capability_descs || []
    const titles = m.capability_titles || []
    for (let i = 0; i < 4; i++) {
      const desc = (descs[i] || '').trim()
      const title = (titles[i] || '').trim()
      if (!desc) continue
      allCells.push({
        slug: m.slug,
        name: m.name,
        company_name: m.company_name || m.name || m.slug,
        slot: i + 1,
        slotIdx: i,
        title,
        desc,
        len: desc.length,
        bucket: bucketOf(desc.length),
      })
    }
  }

  // Build target list
  let targets = []
  if (args.merchant) {
    targets = allCells.filter((c) => c.slug === args.merchant)
    if (targets.length === 0) {
      console.error(`No cells found for merchant slug "${args.merchant}".`)
      process.exit(1)
    }
  } else if (args.all) {
    targets = allCells
  } else if (args.onlyTight) {
    // Aggressive third pass: target ONLY cells currently >240 chars in
    // Supabase. Prompt path (buildPrompt) already targets <=240 — when the
    // model returns >240 on this pass, the stricter retry kicks in.
    targets = allCells.filter((c) => c.len > MAX_CHARS)
    if (targets.length === 0) {
      console.log('No cells currently exceed 240 chars. Nothing to do.')
      process.exit(0)
    }
    console.log(`Found ${targets.length} cells still >240 chars.`)
    if (!args.apply) {
      console.error('ERROR: --only-tight requires --apply.')
      process.exit(1)
    }
  } else if (args.onlyFailed) {
    // Read JSONL error log from a previous run, re-target just those cells.
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile(args.onlyFailed, 'utf8')
    const failedKeys = new Set()
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const { slug, slot } = JSON.parse(line)
        if (slug && slot) failedKeys.add(`${slug}#${slot}`)
      } catch {}
    }
    targets = allCells.filter((c) => failedKeys.has(`${c.slug}#${c.slot}`))
    if (targets.length === 0) {
      console.error(`No matching cells found from error log ${args.onlyFailed}.`)
      process.exit(1)
    }
    console.log(`Loaded ${failedKeys.size} failed keys from ${args.onlyFailed}; ${targets.length} still exist in Supabase.`)
    if (!args.apply) {
      console.error('ERROR: --only-failed requires --apply (this is a reprocessing run, not a preview).')
      process.exit(1)
    }
  } else if (args.sample) {
    targets = pickSample(allCells, args.sample)
  }

  console.log(`\nTargets: ${targets.length} cells\n`)

  // ---------- Rewrite ----------
  const startedAt = Date.now()
  let done = 0
  const errorLogPath = resolve(OUT_DIR, `rewrite-errors-${ts}.jsonl`)

  const results = await runInBatches(targets, CONCURRENCY, async (cell) => {
    try {
      const { rewritten, flagged, retried } = await rewriteOne({
        company_name: cell.company_name,
        capability_title: cell.title,
        original: cell.desc,
      })
      done++
      if (args.all && done % 20 === 0) {
        console.log(`  progress: ${done}/${targets.length}`)
      }
      return { ...cell, rewritten, newLen: rewritten.length, flagged, retried }
    } catch (err) {
      const msg = err?.message || String(err)
      await appendFile(
        errorLogPath,
        JSON.stringify({ slug: cell.slug, slot: cell.slot, error: msg }) + '\n',
      )
      return { ...cell, rewritten: null, newLen: null, flagged: true, retried: false, error: msg }
    }
  })

  const successes = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r) => r && r.rewritten)

  // ---------- Dry-run output ----------
  if (!args.apply) {
    console.log('\n=== DRY-RUN PREVIEW ===\n')
    // Sort by slot, then slug for readable table
    const sorted = [...successes].sort((a, b) => a.slot - b.slot || a.slug.localeCompare(b.slug))
    for (const r of sorted) {
      const arrow = `${String(r.len).padStart(3)} -> ${String(r.newLen).padStart(3)}`
      const tag = r.flagged ? ' [FLAG >240]' : r.retried ? ' [retried]' : ''
      console.log(`-- ${r.slug} * slot ${r.slot}  (${arrow})${tag}`)
      console.log(`   title:  ${r.title}`)
      console.log(`   before: ${r.desc}`)
      console.log(`   after:  ${r.rewritten}`)
      console.log()
    }
    // Summary
    const flagged = successes.filter((r) => r.flagged).length
    const retried = successes.filter((r) => r.retried && !r.flagged).length
    console.log(`Summary: ${successes.length} rewritten, ${retried} needed retry, ${flagged} still >240 chars`)

    const previewPath = resolve(OUT_DIR, `rewrite-preview-${ts}.json`)
    await writeFile(previewPath, JSON.stringify({ model: MODEL, generatedAt: ts, results: successes }, null, 2))
    console.log(`\nFull JSON preview: ${previewPath}`)
    console.log(`\nNo Supabase writes performed (dry-run).`)
    return
  }

  // ---------- Apply path ----------
  // Group by slug, merge into capability_descs array, update per row
  const bySlug = new Map()
  for (const r of successes) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, [])
    bySlug.get(r.slug).push(r)
  }

  // Need original full arrays for rows we're updating
  const slugs = [...bySlug.keys()]
  const rowsBySlug = new Map(rows.filter((m) => slugs.includes(m.slug)).map((m) => [m.slug, m]))

  console.log(`\nApplying updates to ${slugs.length} merchant rows...`)
  let appliedRows = 0
  let failedRows = 0

  for (const slug of slugs) {
    const row = rowsBySlug.get(slug)
    if (!row) continue
    const newDescs = [...(row.capability_descs || ['', '', '', ''])]
    for (const r of bySlug.get(slug)) {
      newDescs[r.slotIdx] = r.rewritten
    }
    const { error } = await sb.from('merchants').update({ capability_descs: newDescs }).eq('slug', slug)
    if (error) {
      failedRows++
      await appendFile(
        errorLogPath,
        JSON.stringify({ slug, error: error.message || String(error), phase: 'update' }) + '\n',
      )
      console.error(`  FAIL  ${slug}  ${error.message || error}`)
    } else {
      appliedRows++
    }
    if (appliedRows % 20 === 0) console.log(`  applied ${appliedRows}/${slugs.length} rows`)
  }

  const previewPath = resolve(OUT_DIR, `rewrite-applied-${ts}.json`)
  await writeFile(previewPath, JSON.stringify({ model: MODEL, appliedAt: ts, results: successes }, null, 2))

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\nDone. ${appliedRows} rows updated, ${failedRows} failed in ${elapsed}s.`)
  console.log(`Record: ${previewPath}`)
  if (failedRows > 0) console.log(`Errors: ${errorLogPath}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Downloads logos for every merchant in merchants.csv.
 *
 * Strategy:
 *   1. Try Clearbit's logo API (high-res, transparent): https://logo.clearbit.com/{domain}
 *   2. Fallback to Google Favicon (always works, smaller): https://www.google.com/s2/favicons?domain={domain}&sz=256
 *
 * Domain is guessed from company name unless overridden in DOMAIN_OVERRIDES.
 *
 * Output:
 *   public/logos/{slug}.png       (binary logo file)
 *   public/logos/manifest.json    (slug -> path + source)
 *
 * Usage:
 *   node scripts/download-logos.mjs
 *   node scripts/download-logos.mjs --only Discord,Spotify
 *   node scripts/download-logos.mjs --retry-failed
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'public', 'merchants.csv')
const LOGOS_DIR = path.join(ROOT, 'public', 'logos')
const MANIFEST_PATH = path.join(LOGOS_DIR, 'manifest.json')

// Known tricky merchants - map directly to the correct domain
const DOMAIN_OVERRIDES = {
  '1Password': '1password.com',
  '99 Ranch Market': '99ranch.com',
  'ABC Fitness': 'abcfitness.com',
  'Bill.com': 'bill.com',
  'Buy Me a Coffee': 'buymeacoffee.com',
  'Academia.edu': 'academia.edu',
  'audibene': 'audibene.de',
  'BILT': 'biltrewards.com',
  'Bold.One': 'bold.one',
  'Buy Me a Coffee': 'buymeacoffee.com',
  'ByteDance': 'bytedance.com',
  'Bumble': 'bumble.com',
  'Cambly': 'cambly.com',
  'Care.com': 'care.com',
  'Chegg': 'chegg.com',
  'Credit Karma': 'creditkarma.com',
  'Dashlane': 'dashlane.com',
  'Deel': 'deel.com',
  'DoorDash': 'doordash.com',
  'Dropbox': 'dropbox.com',
  'Duolingo': 'duolingo.com',
  'Epic Games': 'epicgames.com',
  'Etsy': 'etsy.com',
  'Evernote': 'evernote.com',
  'Expedia': 'expedia.com',
  'Fiverr': 'fiverr.com',
  'Flipkart': 'flipkart.com',
  'GitHub': 'github.com',
  'GoFundMe': 'gofundme.com',
  'Grammarly': 'grammarly.com',
  'Hulu': 'hulu.com',
  'Instacart': 'instacart.com',
  'LinkedIn': 'linkedin.com',
  'Lyft': 'lyft.com',
  'Masterclass': 'masterclass.com',
  'Miro': 'miro.com',
  'Netflix': 'netflix.com',
  'Notion': 'notion.so',
  'OpenAI': 'openai.com',
  'Patreon': 'patreon.com',
  'PayPal': 'paypal.com',
  'Peloton': 'onepeloton.com',
  'Pinterest': 'pinterest.com',
  'Pluralsight': 'pluralsight.com',
  'Reddit': 'reddit.com',
  'Roblox': 'roblox.com',
  'Shopify': 'shopify.com',
  'Skillshare': 'skillshare.com',
  'Slack': 'slack.com',
  'Snap': 'snap.com',
  'Snapchat': 'snapchat.com',
  'Spotify': 'spotify.com',
  'Squarespace': 'squarespace.com',
  'TikTok': 'tiktok.com',
  'Tinder': 'tinder.com',
  'Twitch': 'twitch.tv',
  'Uber': 'uber.com',
  'Udemy': 'udemy.com',
  'Upwork': 'upwork.com',
  'Wise': 'wise.com',
  'Wix': 'wix.com',
  'WordPress': 'wordpress.com',
  'YouTube': 'youtube.com',
  'Zoom': 'zoom.us',
  'Discord': 'discord.com',
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function guessDomain(name) {
  if (DOMAIN_OVERRIDES[name]) return DOMAIN_OVERRIDES[name]
  const cleaned = name
    .toLowerCase()
    .replace(/[^\w\s.]/g, '')
    .replace(/\s+/g, '')
  return `${cleaned}.com`
}

async function fetchLogo(domain) {
  // Try Clearbit first (high quality, transparent bg)
  const clearbitUrl = `https://logo.clearbit.com/${domain}`
  try {
    const resp = await fetch(clearbitUrl)
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      if (buf.length > 200) return { buffer: buf, source: 'clearbit' }
    }
  } catch {}

  // Fallback: Google Favicon (always works, lower-res)
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
  try {
    const resp = await fetch(googleUrl)
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      if (buf.length > 200) return { buffer: buf, source: 'google' }
    }
  } catch {}

  return null
}

async function main() {
  const args = process.argv.slice(2)
  const onlyFlag = args.findIndex((a) => a === '--only')
  const retryFailed = args.includes('--retry-failed')
  const onlyList =
    onlyFlag >= 0 && args[onlyFlag + 1] ? args[onlyFlag + 1].split(',').map((s) => s.trim()) : null

  await fs.mkdir(LOGOS_DIR, { recursive: true })

  // Load existing manifest to skip already-downloaded
  let manifest = {}
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'))
  } catch {}

  const csv = await fs.readFile(CSV_PATH, 'utf-8')
  const lines = csv.trim().split('\n').slice(1)
  const merchants = lines
    .map((line) => {
      const [name, tier] = line.split(',')
      return { name: name?.trim(), tier: tier?.trim() }
    })
    .filter((m) => m.name)
    .filter((m) => !onlyList || onlyList.some((o) => m.name.toLowerCase() === o.toLowerCase()))

  console.log(`\nFound ${merchants.length} merchants to process`)
  console.log(`Manifest currently has ${Object.keys(manifest).length} entries\n`)

  let ok = 0
  let failed = 0
  let skipped = 0

  // Rate-limit: process 10 at a time
  const BATCH_SIZE = 10
  for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
    const batch = merchants.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (m) => {
        const slug = slugify(m.name)
        const existing = manifest[m.name]

        // Skip if already have it (unless --retry-failed and it previously failed)
        if (existing && !(retryFailed && existing.source === 'failed')) {
          return { name: m.name, status: 'skipped' }
        }

        const domain = guessDomain(m.name)
        const result = await fetchLogo(domain)

        if (!result) {
          manifest[m.name] = { slug, domain, source: 'failed' }
          return { name: m.name, domain, status: 'failed' }
        }

        const filePath = path.join(LOGOS_DIR, `${slug}.png`)
        await fs.writeFile(filePath, result.buffer)
        manifest[m.name] = {
          slug,
          domain,
          path: `/logos/${slug}.png`,
          source: result.source,
          size: result.buffer.length,
        }
        return { name: m.name, domain, status: 'ok', source: result.source, size: result.buffer.length }
      })
    )

    for (const r of results) {
      if (r.status === 'ok') {
        ok++
        console.log(`  ✓ [${r.source}] ${r.name} (${r.domain}) - ${(r.size / 1024).toFixed(1)}KB`)
      } else if (r.status === 'failed') {
        failed++
        console.log(`  ✗ ${r.name} (${r.domain})`)
      } else {
        skipped++
      }
    }

    // Save manifest after each batch
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${ok} downloaded · ${skipped} skipped · ${failed} failed`)
  console.log(`Manifest saved to: ${MANIFEST_PATH}`)
  console.log(`${'='.repeat(50)}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// Re-run logo pipeline for banks and partners with smarter source selection.
// Key fix vs prior version: some Simple Icons SVGs render as negative-space
// tiles (white block with letter cutouts, e.g. Wells Fargo). After processing,
// we measure the "fill ratio" of each candidate (opaque pixels divided by
// bounding-box area) and reject anything that comes back > 0.78, falling
// through to logo.dev (which always returns positive shapes). For each name
// we collect candidates from multiple sources, score them, and keep the best.

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = '/Users/isabellapdl/Desktop/Stripe Sessions Decks/stripe-sessions-app'
const LOGO_DEV_TOKEN = 'pk_X-1ZO13GSgeOoUrIuJ6GMQ'

// ---------- domain overrides (where guessing the .com fails) ----------
const BANK_DOMAINS = {
  'Axos Bank': 'axosbank.com',
  'BMO': 'bmo.com',
  'Banc of California': 'bancofcal.com',
  'Banco Azteca S.A.': 'bancoazteca.com.mx',
  'Banco BICE': 'bice.cl',
  'Banco Guayaquil': 'bancoguayaquil.com',
  'Bancoli': 'bancoli.com',
  'Bank of America': 'bankofamerica.com',
  'Bank of Baroda': 'bankofbaroda.com',
  'Bank of Marin': 'bankofmarin.com',
  'Bankful': 'bankful.com',
  'Banking Circle': 'bankingcircle.com',
  'Barclays': 'barclays.com',
  'CIBC': 'cibc.com',
  'CTBC Bank': 'ctbcbank.com',
  'CalPrivate Bank': 'calprivate.bank',
  'California Bank & Trust': 'calbanktrust.com',
  'Celtic Bank': 'celticbank.com',
  'Citizens Bank': 'citizensbank.com',
  'City National Bank': 'cnb.com',
  'Column': 'column.com',
  'Comerica Bank': 'comerica.com',
  'Credit One Bank': 'creditonebank.com',
  'Deutsche Bank': 'db.com',
  'East West Bank': 'eastwestbank.com',
  'Elavon': 'elavon.com',
  'Exchange Bank': 'exchangebank.com',
  'FFB Bank': 'ffbbank.com',
  'Fifth Third Bank': '53.com',
  'First Citizens Bank': 'firstcitizens.com',
  'Flagstar Private Bank': 'flagstar.com',
  'Grasshopper Bank': 'grasshopper.bank',
  'HSBC': 'hsbc.com',
  'JPMorgan Chase': 'jpmorganchase.com',
  'MUFG': 'mufgamericas.com',
  'Monzo': 'monzo.com',
  'RBC': 'rbcroyalbank.com',
  'Santander': 'santander.com',
  'Silicon Valley Bank': 'svb.com',
  'SouthState Bank': 'southstatebank.com',
  'Standard Chartered': 'sc.com',
  'Sunwest Bank': 'sunwestbank.com',
  'TASI Bank': 'tasibank.com',
  'Thread Bank': 'thread.bank',
  'U.S. Bank': 'usbank.com',
  'Wells Fargo': 'wellsfargo.com',
  'Zions Bank': 'zionsbank.com',
}

const PARTNER_DOMAINS = {
  'Affirm': 'affirm.com',
  'Agentix Pay': 'agentixpay.com',
  'Airwallex': 'airwallex.com',
  'Alipay': 'alipay.com',
  'Alma': 'getalma.eu',
  'American Express': 'americanexpress.com',
  'Ant Group': 'antgroup.com',
  'BBVA': 'bbva.com',
  'BCG': 'bcg.com',
  'Bankful': 'bankful.com',
  'Barak Consulting Group': 'barakconsulting.com',
  'Basis Theory': 'basistheory.com',
  'Block': 'block.xyz',
  'Boku': 'boku.com',
  'Chargebee': 'chargebee.com',
  'Checkout.com': 'checkout.com',
  'Cleo': 'meetcleo.com',
  'Coinbase': 'coinbase.com',
  'Deloitte': 'deloitte.com',
  'EBANX': 'ebanx.com',
  'Elo': 'elo.com.br',
  'Ernst & Young': 'ey.com',
  'FIS': 'fisglobal.com',
  'Fiserv': 'fiserv.com',
  'Getnet': 'getnet.com.br',
  'Klarna': 'klarna.com',
  'Kraken': 'kraken.com',
  'Mastercard': 'mastercard.com',
  'McKinsey': 'mckinsey.com',
  'Nium': 'nium.com',
  'North': 'north.com',
  'PPRO': 'ppro.com',
  'PROSA': 'prosa.com.mx',
  'PayPal': 'paypal.com',
  'Plaid': 'plaid.com',
  'Planet DDS': 'planetdds.com',
  'PwC': 'pwc.com',
  'Rain': 'rain.com',
  'Rapyd': 'rapyd.net',
  'Razorpay': 'razorpay.com',
  'Recurly': 'recurly.com',
  'Rodina Consulting': 'rodinaconsulting.com',
  'SaaS Payments Consulting': 'saaspaymentsconsulting.com',
  'Scalapay': 'scalapay.com',
  'TabaPay': 'tabapay.com',
  'TrueLayer': 'truelayer.com',
  'Trustly': 'trustly.com',
  'Visa': 'visa.com',
  'Western Union': 'westernunion.com',
  'Whish Money': 'whish.money',
  'Zip': 'zip.co',
  'dLocal': 'dlocal.com',
}

// Brands known to render correctly via Simple Icons (positive silhouettes,
// not negative tiles). Anything not in this set falls straight to logo.dev.
// We measure fill-ratio at runtime as a backstop, but this allowlist
// avoids paying the latency of fetching Simple Icons for brands we know
// will fail, and saves us from false-positive scoring for some edge cases.
const SIMPLE_ICONS_ALLOW = {
  // Card networks, networks, payment giants — typically positive marks
  'Visa': 'visa',
  'Mastercard': 'mastercard',
  'PayPal': 'paypal',
  'American Express': 'americanexpress',
  'Klarna': 'klarna',
  'Affirm': 'affirm',
  'Plaid': 'plaid',
  'Razorpay': 'razorpay',
  'Coinbase': 'coinbase',
  'Kraken': 'kraken',
  'Western Union': 'westernunion',
  'Alipay': 'alipay',
  'Airwallex': 'airwallex',
  'Trustly': 'trustly',
  'Checkout.com': 'checkout',
  'Deloitte': 'deloitte',
  'PwC': 'pwc',
  // Banks — only the ones whose Simple Icons SVG is a positive wordmark.
  // Wells Fargo / Bank of America / HSBC / Barclays etc. render as
  // negative tiles (white block with cutouts), so we keep them OUT and
  // route them through logo.dev which returns proper marks.
  'Monzo': 'monzo',
  'Deutsche Bank': 'deutschebank',
}

// ---------- pipeline ----------
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function fetchBuf(url) {
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) return null
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 200) return null
  return buf
}

// Same algorithm as build-merchants.mjs toWhiteOnTransparent. Returns the
// processed white-on-transparent PNG buffer.
async function toWhiteBuf(srcBuf, { svg = false } = {}) {
  let pipeline = sharp(srcBuf)
  if (svg) pipeline = pipeline.resize({ width: 1024, withoutEnlargement: false })
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  // Fast path for already-white-on-transparent inputs (Simple Icons SVGs
  // rasterized, or any source that arrives as white pixels with alpha
  // mask). Detect: corners fully transparent AND the median opaque pixel
  // is near-white. The whiteness formula in the slow path would zero
  // these out (white "ink" reads as background to that branch).
  let cornersAllTransparent = true
  for (const [x, y] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]]) {
    if (data[(y * width + x) * channels + 3] > 16) { cornersAllTransparent = false; break }
  }
  if (cornersAllTransparent) {
    let nearWhite = 0, sampled = 0
    const stride = Math.max(1, Math.floor((width * height) / 5000))
    for (let i = 0; i < width * height; i += stride) {
      const a = data[i * channels + 3]
      if (a > 200) {
        sampled++
        const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2]
        if (r > 220 && g > 220 && b > 220) nearWhite++
      }
    }
    if (sampled > 50 && nearWhite / sampled > 0.85) {
      const out = Buffer.alloc(width * height * 4)
      for (let i = 0; i < width * height; i++) {
        out[i*4+0] = 255
        out[i*4+1] = 255
        out[i*4+2] = 255
        out[i*4+3] = data[i*channels+3]
      }
      return await sharp(out, { raw: { width, height, channels: 4 } })
        .trim({ background: { r:0,g:0,b:0,alpha:0 }, threshold: 5 })
        .png({ compressionLevel: 9 })
        .toBuffer()
    }
  }

  const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]]
  const cornerRGB = []
  let cornersPartialAlpha = 0
  for (const [x, y] of corners) {
    const i = (y * width + x) * channels
    const a = data[i + 3]
    if (a > 128) cornerRGB.push([data[i], data[i+1], data[i+2]])
    if (a < 220 && a > 0) cornersPartialAlpha++
  }
  const hasTransparentBg = cornerRGB.length === 0
  const useSrcAlphaPassThrough = !hasTransparentBg && cornersPartialAlpha >= 2

  let dominantFill = null
  if (hasTransparentBg) {
    let rs = 0, gs = 0, bs = 0, n = 0
    for (let i = 0; i < width * height; i++) {
      const a = data[i*channels+3]
      if (a > 128) { rs += data[i*channels]; gs += data[i*channels+1]; bs += data[i*channels+2]; n++ }
    }
    if (n > 0) {
      const avgR = rs/n, avgG = gs/n, avgB = bs/n
      const luma = 0.299*avgR + 0.587*avgG + 0.114*avgB
      const chroma = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB)
      if (luma > 50 && luma < 210 && chroma > 30) {
        let far = 0
        for (let i = 0; i < width * height; i++) {
          const a = data[i*channels+3]
          if (a > 128) {
            const dr = data[i*channels]-avgR, dg = data[i*channels+1]-avgG, db = data[i*channels+2]-avgB
            if (Math.sqrt(dr*dr+dg*dg+db*db) > 100) far++
          }
        }
        if (far/n > 0.05) dominantFill = [avgR, avgG, avgB]
      }
    }
  }

  const useCornerSubtraction = !hasTransparentBg && !useSrcAlphaPassThrough
  const refPoints = useCornerSubtraction ? cornerRGB : (dominantFill ? [dominantFill] : null)

  function dist(r, g, b) {
    let m = Infinity
    for (const [cr, cg, cb] of refPoints) {
      const dr = r-cr, dg = g-cg, db = b-cb
      const d2 = dr*dr + dg*dg + db*db
      if (d2 < m) m = d2
    }
    return Math.sqrt(m)
  }

  let maxDist = 1
  if (refPoints) {
    const ds = []
    for (let i = 0; i < width * height; i++) {
      const r = data[i*channels], g = data[i*channels+1], b = data[i*channels+2], a = data[i*channels+3]
      if (a > 128) ds.push(dist(r, g, b))
    }
    ds.sort((x, y) => x - y)
    maxDist = ds[Math.floor(ds.length * 0.98)] || 1
  }

  const LOW = 0.08
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const r = data[i*channels], g = data[i*channels+1], b = data[i*channels+2], srcA = data[i*channels+3]
    let alpha
    if (useSrcAlphaPassThrough) {
      alpha = srcA
    } else if (refPoints) {
      const d = dist(r, g, b)
      const norm = Math.min(1, d / maxDist)
      if (norm < LOW) alpha = 0
      else alpha = ((norm - LOW) / (1 - LOW)) * srcA
    } else {
      const whiteness = Math.min(r, g, b)
      alpha = ((255 - whiteness) / 255) * srcA
    }
    out[i*4+0] = 255
    out[i*4+1] = 255
    out[i*4+2] = 255
    out[i*4+3] = Math.max(0, Math.min(255, Math.round(alpha)))
  }

  return await sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ background: { r:0,g:0,b:0,alpha:0 }, threshold: 5 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// Score a candidate PNG buffer: returns { fillRatio, contentEdge } where
// fillRatio is the fraction of the trimmed bbox that is opaque (>0.78
// means a "tile/block", which is the negative-space failure case), and
// contentEdge is the minimum dimension of the trimmed image (resolution
// quality, higher is better).
async function scoreLogo(buf) {
  const meta = await sharp(buf).metadata()
  if (!meta.width || !meta.height) return { fillRatio: 1, contentEdge: 0, ok: false }
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let opaque = 0
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i*4+3] > 200) opaque++
  }
  const fillRatio = opaque / (info.width * info.height)
  const contentEdge = Math.min(info.width, info.height)
  return { fillRatio, contentEdge, ok: true, w: info.width, h: info.height }
}

// Some Simple Icons SVGs are negative-space tiles: a white card with the
// wordmark cut OUT in transparent letter shapes (American Express,
// Wells Fargo, Bank of America, etc.). For these, alpha inversion
// recovers the wordmark as solid white. We strip the surviving outer
// frame by re-trimming with a slightly higher alpha threshold so the
// thin border line that survives inversion gets cropped out too.
async function invertAlpha(srcBuf) {
  const { data, info } = await sharp(srcBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) {
    out[i*4+0] = 255
    out[i*4+1] = 255
    out[i*4+2] = 255
    out[i*4+3] = 255 - data[i*4+3]
  }
  return await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    // Higher threshold (40) discards the thin frame border that
    // survives inversion as low-alpha pixels.
    .trim({ background: { r:0,g:0,b:0,alpha:0 }, threshold: 40 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function tryCandidate(url, { svg = false, allowInversion = false } = {}) {
  const raw = await fetchBuf(url)
  if (!raw) return null
  try {
    // Detect "negative tile" SVGs by sampling corner alpha BEFORE
    // toWhiteBuf collapses everything. A genuine wordmark/silhouette has
    // transparent corners; a negative-tile design (American Express,
    // Wells Fargo) has fully opaque corners with letter cutouts.
    let isNegativeTile = false
    if (svg && allowInversion) {
      const probe = await sharp(raw).resize({ width: 256 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const { width: pw, height: ph } = probe.info
      const ch = probe.info.channels
      let opaqueCorners = 0
      for (const [x, y] of [[0,0],[pw-1,0],[0,ph-1],[pw-1,ph-1]]) {
        if (probe.data[(y * pw + x) * ch + 3] > 200) opaqueCorners++
      }
      isNegativeTile = opaqueCorners >= 3
    }

    const processed = await toWhiteBuf(raw, { svg })
    const score = await scoreLogo(processed)
    if (!score.ok || score.contentEdge < 24) return null
    if (isNegativeTile) {
      const inverted = await invertAlpha(processed)
      const invertedScore = await scoreLogo(inverted)
      if (invertedScore.ok && invertedScore.contentEdge >= 24) {
        return { buf: inverted, score: invertedScore, url, inverted: true }
      }
    }
    return { buf: processed, score, url }
  } catch {
    return null
  }
}

async function bestLogoFor(name, domains) {
  const domain = domains[name]
  const candidates = []

  // Simple Icons (only for allowlisted brands). allowInversion=true so
  // that negative-tile SVGs (American Express, etc.) produce a candidate
  // with the wordmark recovered via alpha inversion.
  if (SIMPLE_ICONS_ALLOW[name]) {
    const slug = SIMPLE_ICONS_ALLOW[name]
    const c = await tryCandidate(`https://cdn.simpleicons.org/${slug}/white`, { svg: true, allowInversion: true })
    if (c) candidates.push({ ...c, source: c.inverted ? 'simpleicons-inverted' : 'simpleicons' })
  }

  // logo.dev at high res (always tried)
  if (domain) {
    const c = await tryCandidate(
      `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&format=png&size=1024&retina=true`
    )
    if (c) candidates.push({ ...c, source: 'logo.dev' })
  }

  // Pick the best. Two heuristics applied in order:
  //   1. Reject tiles (fillRatio > 0.85) when at least one candidate is
  //      below that threshold. fillRatio = opaque pixels / bbox area.
  //      Tile-shaped logos (white block with cutouts) score near 1.0.
  //   2. Prefer Simple Icons over logo.dev when both pass quality. The
  //      SI source is curated and ships consistent wordmarks; logo.dev
  //      tends to return favicon-style square marks. Sorting purely by
  //      contentEdge would reward favicons over wordmarks because a
  //      wide wordmark has a small short-edge.
  if (candidates.length === 0) return null
  const nonTiles = candidates.filter((c) => c.score.fillRatio < 0.85)
  const pool = nonTiles.length ? nonTiles : candidates
  const sourceRank = (s) => (s === 'simpleicons-inverted' ? 0 : s === 'simpleicons' ? 1 : 2)
  pool.sort((a, b) => {
    const sr = sourceRank(a.source) - sourceRank(b.source)
    if (sr !== 0) return sr
    return b.score.contentEdge - a.score.contentEdge
  })
  return pool[0]
}

async function processList(csvPath, domains, dstDir, publicPrefix, manifestPath, exportName) {
  const csv = await fs.readFile(csvPath, 'utf8')
  const names = csv.replace(/\r\n/g, '\n').trim().split('\n').slice(1).map((l) => l.split(',')[0].trim()).filter(Boolean)
  await fs.mkdir(dstDir, { recursive: true })

  const entries = []
  let ok = 0, failed = 0
  for (const name of names) {
    const slug = slugify(name)
    process.stdout.write(`  ${name} ... `)
    const best = await bestLogoFor(name, domains)
    if (best) {
      const dst = path.join(dstDir, `${slug}.png`)
      await fs.writeFile(dst, best.buf)
      console.log(`ok [${best.source}] ${best.score.w}x${best.score.h} fill=${best.score.fillRatio.toFixed(2)}`)
      entries.push({ name, slug, logo: `${publicPrefix}/${slug}.png`, logoMono: null, matchedSlug: slug })
      ok++
    } else {
      console.log('FAIL')
      entries.push({ name, slug, logo: null, logoMono: null, matchedSlug: slug })
      failed++
    }
  }

  // Write manifest
  const map = Object.fromEntries(entries.map((e) => [e.slug, e]))
  const lines = [
    '// GENERATED by /tmp/fix-logos.mjs - re-run if you add or rename rows.',
    `// Generated at: ${new Date().toISOString()}`,
    '',
    `export const ${exportName.toUpperCase()} = ${JSON.stringify(map, null, 2)}`,
    '',
    `export const ${exportName.toUpperCase()}_LIST = Object.values(${exportName.toUpperCase()})`,
    '',
    `export function slugify(s) {`,
    `  return String(s || '')`,
    `    .toLowerCase()`,
    `    .replace(/[^a-z0-9]+/g, '-')`,
    `    .replace(/^-+|-+$/g, '')`,
    `}`,
    '',
    `export function resolve${exportName.charAt(0).toUpperCase()}${exportName.slice(1)}(input) {`,
    `  if (!input) return null`,
    `  const trimmed = String(input).trim()`,
    `  const direct = ${exportName.toUpperCase()}[slugify(trimmed)]`,
    `  if (direct) return direct`,
    `  for (const token of trimmed.split(/[\\/|,]/)) {`,
    `    const m = ${exportName.toUpperCase()}[slugify(token)]`,
    `    if (m) return m`,
    `  }`,
    `  return null`,
    `}`,
    '',
  ]
  await fs.writeFile(manifestPath, lines.join('\n'))
  console.log(`\n  ==> ${ok} ok, ${failed} failed. Manifest written to ${manifestPath}\n`)
}

(async () => {
  console.log('--- BANKS ---')
  await processList(
    path.join(ROOT, 'public/banks.csv'),
    BANK_DOMAINS,
    path.join(ROOT, 'public/banks'),
    '/banks',
    path.join(ROOT, 'src/data/banks.generated.js'),
    'bank',
  )
  console.log('--- PARTNERS ---')
  await processList(
    path.join(ROOT, 'public/partners.csv'),
    PARTNER_DOMAINS,
    path.join(ROOT, 'public/partners'),
    '/partners',
    path.join(ROOT, 'src/data/partners.generated.js'),
    'partner',
  )
  console.log('Done.')
})().catch((e) => { console.error(e); process.exit(1) })

// QA screenshot for the Product Suite slide (slide 5). Saves two shots:
// full slide + a zoomed clip of column 4's bottom so the chevron
// placement relative to Reconciliation and Payments Concierge is easy
// to see at a glance.
import { chromium } from '@playwright/test'

const url = process.argv[2] || 'http://localhost:5173/m/roblox?slide=5'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

await page.screenshot({ path: '/tmp/qa-suite-full.png' })
await page.screenshot({
  path: '/tmp/qa-suite-col4.png',
  clip: { x: 1320, y: 180, width: 600, height: 820 },
})
await browser.close()
console.log('wrote /tmp/qa-suite-full.png and /tmp/qa-suite-col4.png')

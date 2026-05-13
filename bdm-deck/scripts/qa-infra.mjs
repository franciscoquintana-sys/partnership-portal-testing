import { chromium } from '@playwright/test'

const url = process.argv[2] || 'http://localhost:5173/?slide=2'
const out = process.argv[3] || '/tmp/qa-infra.png'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log('wrote', out)

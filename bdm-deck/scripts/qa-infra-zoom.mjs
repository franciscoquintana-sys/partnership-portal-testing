// Zoomed QA: screenshot the diagram area of slide 2 with a tight clip
// so individual logo sizes are easy to compare.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
await page.goto(process.argv[2] || 'http://localhost:5173/m/roblox?slide=2', {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(1500)

// Clip to the main diagram area — roughly the top 2/3 of the slide,
// full width, after the title.
await page.screenshot({
  path: process.argv[3] || '/tmp/qa-infra-zoom.png',
  clip: { x: 0, y: 120, width: 1920, height: 720 },
})
await browser.close()
console.log('wrote', process.argv[3] || '/tmp/qa-infra-zoom.png')

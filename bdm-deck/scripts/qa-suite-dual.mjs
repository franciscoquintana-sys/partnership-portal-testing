// Screenshot the Product Suite slide at two sizes — the canonical 1920×1080
// stage (presentation view) and a 1280×720 viewport (common laptop / normal
// editor preview). Transform:scale should keep the layout identical; this
// catches any vw-based nudge that drifts when the outer viewport changes.
import { chromium } from '@playwright/test'

const url = process.argv[2] || 'http://localhost:5173/m/roblox?slide=5'
const browser = await chromium.launch()

for (const { w, h, label } of [
  { w: 1920, h: 1080, label: 'full' },
  { w: 1280, h: 720, label: 'laptop' },
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `/tmp/qa-suite-${label}.png` })
  await ctx.close()
}
await browser.close()
console.log('wrote /tmp/qa-suite-full.png and /tmp/qa-suite-laptop.png')

// Screenshots of the route harness: node e2e/shot.cjs <out folder> <query>... (one picture per query).
// Needs the dev server (pnpm dev); SHOT_URL overrides http://localhost:5173.
const { chromium } = require('playwright')

const [out, ...queries] = process.argv.slice(2)
const base = process.env.SHOT_URL ?? 'http://localhost:5173'
;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  for (const [i, q] of queries.entries()) {
    await page.goto(`${base}/route-dev.html?hud=0&${q}`)
    await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 12000))
    const file = `${out}/${i}-${q.replace(/\W+/g, '_').slice(0, 60)}.png`
    await page.screenshot({ path: file, timeout: 120000 })
    console.log(file)
  }
  await browser.close()
})()

// End-to-end smoke test in headless Chromium: a solo workout, a two-rider Zombie Bus ride and the three road
// races, the last ones with bots.
// Run with scripts/e2e.sh, which starts a sped-up server on E2E_URL.
const { chromium } = require('playwright')

const URL = process.env.E2E_URL ?? 'http://localhost:8199'
const errors = []

async function rider(browser, name) {
  // E2E_VIEWPORT=1180x820 rides at iPad size.
  const [width, height] = (process.env.E2E_VIEWPORT ?? '1280x720').split('x').map(Number)
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  await page.goto(`${URL}/?fast=60`)
  await page.click(`text=${name}`)
  await page.fill('input[placeholder="Password"]', name.toLowerCase())
  await page.keyboard.press('Enter')
  await page.waitForSelector('.home-games').catch(async (e) => {
    console.error(
      `${name} login failed; page says:\n${(await page.innerText('body')).slice(0, 400)}`,
    )
    throw e
  })
  await page.waitForTimeout(600)
  if (await page.locator('text=Welcome to Cranky').count()) await page.keyboard.press('Escape')
  return page
}

async function useSim(page) {
  await page.click('text=Use simulator', { timeout: 5000 })
}

async function solo(page) {
  await page.click('text=Solo workout')
  await page.click('.chip-sel[data-g="sprint"]')
  await page.click('.plan-card:has-text("Sprints 8×10"), .plan-card:has-text("Sprints 8x10")')
  await page.click('.startbar button:text-is("Start")')
  await useSim(page)
  await page.waitForSelector('text=Ride done', { timeout: 120000 })
  const text = await page.innerText('body')
  if (!/Sprints/i.test(text)) throw new Error('solo results missing sprint section')
  await page.click('button:has-text("Done")')
  await page.waitForSelector('.home-games')
}

async function crew(host, guest) {
  await host.click('.home-game:has-text("Zombie Bus")')
  await host.waitForSelector('.code-letters')
  const code = (await host.innerText('.code-letters')).replace(/\s/g, '')
  await guest.fill('input[placeholder="ABCD"]', code)
  await guest.keyboard.press('Enter')
  await useSim(guest)
  await host.waitForSelector('text=Luke')
  await host.click('.seg.diff >> text=Hard')
  await host.click('.plan-card:has-text("Bus Quick 30")')
  await host.waitForTimeout(500)
  await host.click('text=Start the bus')
  if (process.env.E2E_SHOTS) {
    await host.waitForTimeout(40000)
    await host.screenshot({ path: `${process.env.E2E_SHOTS}/Zombie-Bus.png`, timeout: 120000 })
  }
  for (const p of [host, guest]) await p.waitForSelector('.res-hero', { timeout: 240000 })
  const text = await host.innerText('body')
  for (const want of ['Bus score', 'Awards', 'Crew', 'Luke'])
    if (!new RegExp(want, 'i').test(text)) throw new Error(`crew results missing "${want}"`)
}

// A road race with three bots on Nundah: the game picked in the group-ride lobby, the podium, then the results.
async function race(page, game, laps, want) {
  await page.click('.home-mode:has-text("Free ride")')
  await page.click('text=Nundah')
  await page.click('button:text-is("Group ride")')
  await useSim(page).catch(() => {})
  await page.waitForSelector('.road-lobby')
  for (let i = 0; i < 3; i++)
    (await page.click('[aria-label="One more bot"]'), await page.waitForTimeout(400))
  await page.click(`.road-opts .seg >> text=${game}`)
  await page.waitForTimeout(500)
  const lapText = laps === 1 ? '1 lap' : `${laps} laps`
  for (
    let i = 0;
    i < 20 && !(await page.locator(`.road-opts b:text-is("${lapText}")`).count());
    i++
  )
    (await page.click('[aria-label="One lap fewer"]'), await page.waitForTimeout(500))
  await page.click('text=Start the ride')
  await page.waitForSelector('text=Back to the lobby', { timeout: 180000 })
  const text = await page.innerText('body')
  for (const w of want)
    if (!new RegExp(w, 'i').test(text)) throw new Error(`${game} results missing "${w}"`)
  await page.click('text=Back to the lobby')
  await page.click('text=Leave the ride')
  await page.waitForSelector('.home-games')
}

;(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  try {
    const alex = await rider(browser, 'Alex')
    await solo(alex)
    console.log('solo workout: ok')
    const luke = await rider(browser, 'Luke')
    await crew(alex, luke)
    console.log('crew ride: ok')
    const racer = await rider(browser, 'Kat')
    await race(racer, 'Race', 1, ['Nundah', 'race'])
    await race(racer, 'Crit', 2, ['crit', 'won the prime'])
    console.log('road races: ok')
    if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`)
    console.log('e2e passed')
  } catch (e) {
    console.error(String(e))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()

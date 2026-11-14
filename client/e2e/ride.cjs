// End-to-end smoke test in headless Chromium: a solo workout, a two-rider Zombie Bus ride, a Kidney Stone
// Express shift, a Speed Dating night and a Climate Lawsuit game, the last three with bots.
// Run with scripts/e2e.sh, which starts a sped-up server on E2E_URL.
const { chromium } = require('playwright')

const URL = process.env.E2E_URL ?? 'http://localhost:8199'
const errors = []

async function rider(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  await page.goto(`${URL}/?fast=60`)
  await page.click(`text=${name}`)
  await page.fill('input[placeholder="Password"]', name.toLowerCase())
  await page.keyboard.press('Enter')
  await page.waitForSelector('.home-games').catch(async (e) => {
    console.error(`${name} login failed; page says:\n${(await page.innerText('body')).slice(0, 400)}`)
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
  for (const p of [host, guest]) await p.waitForSelector('text=Made it!', { timeout: 240000 })
  const text = await host.innerText('body')
  for (const want of ['Bus score', 'Awards', 'Crew', 'Luke']) if (!new RegExp(want, 'i').test(text)) throw new Error(`crew results missing "${want}"`)
}

// A scripted crew game with no ERG: one rider and three bots through a whole shift.
async function shift(page) {
  await page.click('.home-game:has-text("Kidney Stone Express")')
  await useSim(page)
  await page.waitForSelector('.code-letters')
  await page.click('.game-card:has-text("Kidney Stone Express")')
  for (let i = 0; i < 3; i++) await page.click('button[aria-label="More bot"]')
  await page.click('text=Start the shift')
  await page.waitForSelector('.am', { timeout: 20000 })
  await page.waitForSelector('text=Made it!', { timeout: 240000 })
  const text = await page.innerText('body')
  for (const want of ['Shift score', 'Google reviews', 'Paramedic of the Week', 'Kat'])
    if (!new RegExp(want, 'i').test(text)) throw new Error(`shift results missing "${want}"`)
}

// Speed Dating with three bots: six dates, the wedding and the divorce.
async function night(page) {
  await page.click('.home-game:has-text("Speed Dating")')
  await useSim(page)
  await page.waitForSelector('.code-letters')
  await page.click('.game-card:has-text("Speed Dating")')
  for (let i = 0; i < 3; i++) await page.click('button[aria-label="More bot"]')
  await page.click('text=Open the bar')
  await page.waitForSelector('.dt', { timeout: 20000 })
  await page.waitForSelector('text=Made it!', { timeout: 300000 })
  const text = await page.innerText('body')
  for (const want of ['Chemistry', 'Couples', 'The leaked group chat', 'Best Match'])
    if (!new RegExp(want, 'i').test(text)) throw new Error(`dating results missing "${want}"`)
}

// Climate Lawsuit with three bots: four decades, a fuel change, the Trial and Sentencing.
async function town(page) {
  await page.click('.home-game:has-text("Climate Lawsuit")')
  await useSim(page)
  await page.waitForSelector('.code-letters')
  await page.click('.game-card:has-text("Climate Lawsuit")')
  for (let i = 0; i < 3; i++) await page.click('button[aria-label="More bot"]')
  await page.click('text=Start the 1980s')
  await page.waitForSelector('.cl', { timeout: 20000 })
  await page.locator('.ch-opt:has-text("Solar")').click({ timeout: 120000 })
  await page.waitForSelector('text=Made it!', { timeout: 300000 })
  const text = await page.innerText('body')
  for (const want of ['Town profit', 'The Trial', 'Polluter of the Decade', 'Coal|Solar|Gas|Wind|Pty|Corp'])
    if (!new RegExp(want, 'i').test(text)) throw new Error(`climate results missing "${want}"`)
}

;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    const alex = await rider(browser, 'Alex')
    await solo(alex)
    console.log('solo workout: ok')
    const luke = await rider(browser, 'Luke')
    await crew(alex, luke)
    console.log('crew ride: ok')
    await shift(await rider(browser, 'Kat'))
    console.log('Kidney Stone Express: ok')
    await night(await rider(browser, 'Jack'))
    console.log('Speed Dating: ok')
    await town(await rider(browser, 'Angus'))
    console.log('Climate Lawsuit: ok')
    if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`)
    console.log('e2e passed')
  } catch (e) {
    console.error(String(e))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()

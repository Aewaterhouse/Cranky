import './style.css'
import { FtmsTrainer } from './trainer/ftms'
import { ErgController } from './trainer/ergController'
import { SimTrainer } from './trainer/simTrainer'
import { BleClick } from './trainer/zwiftClick'
import type { Trainer } from './types'
import { h, show } from './ui/dom'

/** Phase 0 trainer check: connect, read power/cadence, set ERG. */
const live = h('div', { class: 'big' }, '– W · – rpm')
const status = h(
  'p',
  { class: 'dim' },
  navigator.bluetooth
    ? 'Web Bluetooth available'
    : 'No Web Bluetooth in this browser (needs Chrome/Edge/Bluefy over HTTPS)',
)
const ftp = h('input', { type: 'number', value: 200 })
const watts = h('input', { type: 'number', value: 150 })
let erg: ErgController | null = null
const use = (t: Trainer) => {
  t.onData((d) => (live.textContent = `${d.power} W · ${Math.round(d.cadence)} rpm`))
  t.onStatus(
    (s) => (status.textContent = s === 'connected' ? `Connected: ${t.name}` : 'Reconnecting…'),
  )
  erg = new ErgController(t, +ftp.value)
  setInterval(() => erg!.tick(), 250)
  status.textContent = `Connected: ${t.name}`
}
const clickStatus = h(
  'p',
  { class: 'dim' },
  'Not paired. Raw messages go to the console as [Click].',
)
const presses = h('div', { class: 'big' }, '–')
let ups = 0
let downs = 0
async function pairClick() {
  try {
    const c = new BleClick()
    c.onShift = (d) => {
      if (d > 0) ups++
      else downs++
      presses.textContent = `${d > 0 ? 'UP ▲' : 'DOWN ▼'} · up ${ups} · down ${downs}`
    }
    c.onStatus = () => (clickStatus.textContent = `${c.name}: ${c.status}`)
    await c.connect()
  } catch (e) {
    clickStatus.textContent = String(e)
  }
}
show(
  h(
    'div',
    { class: 'page' },
    h('h1', {}, 'Trainer spike'),
    status,
    live,
    h(
      'div',
      { class: 'card row' },
      h(
        'button',
        {
          onclick: async () => {
            try {
              const t = new FtmsTrainer()
              await t.connect()
              use(t)
            } catch (e) {
              status.textContent = String(e)
            }
          },
        },
        'Connect FTMS',
      ),
      h(
        'button',
        {
          onclick: () => {
            const s = new SimTrainer()
            s.start()
            use(s)
          },
        },
        'Simulated',
      ),
    ),
    h(
      'div',
      { class: 'card row' },
      h('label', { class: 'field' }, 'FTP', ftp),
      h('label', { class: 'field' }, 'ERG W', watts),
      h(
        'button',
        {
          onclick: () => {
            if (!erg) return
            erg.ftp = +ftp.value
            erg.setTarget(+watts.value)
          },
        },
        'Set ERG',
      ),
      h('button', { onclick: () => erg?.setTarget(null) }, 'ERG off (sim 0%)'),
      h('button', { onclick: () => erg?.failsafe() }, 'Release'),
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'Zwift Click test'),
      clickStatus,
      presses,
      h('button', { onclick: () => void pairClick() }, 'Pair Zwift Click'),
    ),
    h('p', { class: 'dim' }, 'Record results per device in docs/testing.md (iPad: try Bluefy).'),
  ),
)

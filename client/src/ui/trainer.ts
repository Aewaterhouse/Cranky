import { FtmsTrainer } from '../trainer/ftms'
import { BleHr, currentHr, hrSource, onHrChange, setHr, SimHr } from '../trainer/heartRate'
import { bindKeys, SimTrainer } from '../trainer/simTrainer'
import type { Trainer, TrainerStatus } from '../types'
import { clickSection } from './clickPair'
import { h } from './dom'
import { modal, toast } from './toast'

type Data = { power: number; cadence: number }
let trainer: Trainer | null = null
let sim: SimTrainer | null = null
let last: Data | null = null
let status: TrainerStatus = 'connected'
const subs = new Set<() => void>()
export const currentTrainer = () => trainer

const notify = () => subs.forEach((f) => f())
onHrChange(notify)
const set = (t: Trainer | null) => {
  const same = trainer === t
  if (trainer && !same) trainer.close?.()
  trainer = t
  last = null
  status = 'connected'
  if (!same)
    t?.onStatus((s) => {
      if (trainer !== t) return
      status = s
      last = null
      toast(
        s === 'connected' ? 'Trainer reconnected' : 'Trainer disconnected, reconnecting…',
        s === 'connected' ? 'good' : 'bad',
      )
      notify()
    })
  listen()
  notify()
}

/** Re-attach the readout after a ride took over the data callback. */
export function listen() {
  trainer?.onData((d) => {
    last = d
    notify()
  })
}

/** Calls `f` on every reading or connection change while `el` stays in the page. */
function live(el: HTMLElement, f: () => void) {
  const g = () => (el.isConnected ? f() : subs.delete(g))
  subs.add(g)
  f()
  return el
}

const reading = () =>
  status === 'reconnecting'
    ? 'Reconnecting…'
    : last
      ? `${last.power} W · ${Math.round(last.cadence)} rpm`
      : 'waiting for data…'

export function trainerPill() {
  const el = h('button', { class: 'pill', onclick: () => openTrainer() })
  return live(el, () => {
    el.classList.toggle('ok', !!trainer && status === 'connected')
    el.classList.toggle('warn', status === 'reconnecting')
    el.replaceChildren(
      h('i', { class: 'dot' }),
      h(
        'span',
        {},
        trainer
          ? `${trainer.name} · ${reading()}${currentHr() ? ` · ${currentHr()} bpm` : ''}`
          : 'No trainer',
      ),
    )
  })
}

/** Lobby readiness row: green with a live reading, or a warning with a way to fix it. */
export function trainerCheck() {
  const el = h('div', { class: 'tcheck' })
  return live(el, () => {
    el.classList.toggle('ok', !!trainer)
    el.replaceChildren(
      h('i', { class: `dot${trainer ? ' on' : ''}` }),
      trainer
        ? h('span', {}, h('b', {}, trainer.name), h('small', {}, reading()))
        : h(
            'span',
            {},
            h('b', {}, 'No trainer connected'),
            h('small', {}, 'You will not be able to ride.'),
          ),
      h('button', { onclick: () => openTrainer() }, trainer ? 'Change' : 'Connect'),
    )
  })
}

async function connectBt() {
  if (!navigator.bluetooth) {
    toast('Web Bluetooth needs Chrome or Edge over HTTPS (or localhost).', 'bad')
    return false
  }
  try {
    const t = new FtmsTrainer()
    await t.connect()
    set(t)
    return true
  } catch (e) {
    const msg = (e as Error).message
    if (/globally disabled/i.test(msg))
      toast(
        'Bluetooth is switched off in this browser. In Brave: open brave://flags/#brave-web-bluetooth-api, set Enabled, relaunch. Or use Chrome or Edge.',
        'bad',
      )
    else if (!/cancel/i.test(msg)) toast(`Could not connect: ${msg}`, 'bad')
    return false
  }
}

function useSim(ftp: number) {
  if (!sim) {
    sim = new SimTrainer()
    sim.start(4)
    bindKeys(sim, ftp)
  }
  set(sim)
}

async function connectHr() {
  if (!navigator.bluetooth) return toast('Web Bluetooth needs Chrome or Edge over HTTPS.', 'bad')
  try {
    const s = new BleHr()
    await s.connect()
    setHr(s)
  } catch (e) {
    const msg = (e as Error).message
    if (!/cancel/i.test(msg)) toast(`Could not connect the strap: ${msg}`, 'bad')
  }
}

/** Optional heart-rate section of the trainer modal. */
function hrSection() {
  const sec = h('section', { class: 'hr-sec' })
  return live(sec, () => {
    const src = hrSource()
    const bpm = currentHr()
    sec.replaceChildren(
      h('h3', {}, 'Heart rate (optional)'),
      src
        ? h(
            'div',
            { class: 'readout' },
            h('i', { class: `dot${bpm ? ' on' : ''}` }),
            h('b', {}, src.name),
            h('span', { class: 'num' }, bpm ? `${bpm} bpm` : 'waiting for data…'),
          )
        : h(
            'p',
            {},
            'Pair a Bluetooth chest strap or armband to record your heart rate. On the bus your crew sees your bpm, and your % of max once you set a max heart rate under Rider settings.',
          ),
      h(
        'div',
        { class: 'row' },
        src
          ? h('button', { onclick: () => setHr(null) }, 'Disconnect')
          : h('button', { onclick: () => void connectHr() }, 'Connect strap'),
        !src && trainer === sim
          ? h(
              'button',
              {
                onclick: () =>
                  setHr(
                    new SimHr(
                      () => sim!.power,
                      () => ftpNow,
                    ),
                  ),
              },
              'Simulated heart rate',
            )
          : '',
      ),
    )
  })
}

let ftpNow = 200
/** Remembers the FTP the sim's S and A keys should use. */
export const setSimFtp = (ftp: number) => (ftpNow = ftp)

const KEYS: [string, string][] = [
  ['↑ ↓', 'free-ride watts'],
  ['← →', 'cadence'],
  ['[ ]', 'ERG effort'],
  ['S', 'sprint power'],
  ['A', 'easy power'],
]

/** Trainer picker. With `then`, runs it once a trainer is ready (used by "start riding" buttons). */
export function openTrainer(then?: () => void) {
  const done = (ok: boolean) => {
    if (!ok) return
    close()
    toast(`${trainer!.name} ready`, 'good')
    then?.()
  }
  const readout = h('div', { class: 'readout' })
  live(readout, () =>
    readout.replaceChildren(
      h('i', { class: `dot${trainer ? ' on' : ''}` }),
      trainer ? h('b', {}, trainer.name) : 'Nothing connected yet',
      trainer ? h('span', { class: 'num' }, reading()) : '',
    ),
  )
  const close = modal(
    then ? 'Pick a trainer to ride' : 'Trainer',
    readout,
    h(
      'div',
      { class: 'options' },
      h(
        'section',
        {},
        h('h3', {}, 'Bluetooth trainer'),
        h('p', {}, 'Wahoo KICKR, Jet Black and other FTMS trainers.'),
        h(
          'ul',
          { class: 'hints' },
          h('li', {}, 'Close MyWhoosh and the Wahoo app first, or they hog the trainer.'),
          h('li', {}, 'Needs Chrome or Edge, over HTTPS or localhost.'),
        ),
        h('button', { class: 'primary', onclick: async () => done(await connectBt()) }, 'Connect'),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Simulated trainer'),
        h('p', {}, 'No bike handy? Fake it from the keyboard.'),
        h(
          'dl',
          { class: 'keys' },
          ...KEYS.flatMap(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)]),
        ),
        h('button', { onclick: () => (useSim(ftpNow), done(true)) }, 'Use simulator'),
      ),
    ),
    hrSection(),
    clickSection(),
  )
}

/** Wraps a "start riding" action so it asks for a trainer first. */
export const needTrainer = (fn: () => void) => () => (trainer ? fn() : openTrainer(fn))

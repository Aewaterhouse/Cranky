import { PLANS } from '../content'
import type { Profile } from '../core/curve'
import { generate, parsePlan, planTotal } from '../core/plan'
import { saveProfile } from '../core/profile'
import { FtmsTrainer } from '../trainer/ftms'
import { bindKeys, SimTrainer } from '../trainer/simTrainer'
import { TIERS, type Plan, type Tier, type Trainer } from '../types'
import { fmt, h, show } from './dom'

export interface HomeActions {
  drill(plan: Plan): void
  create(): void
  join(code: string): void
}

let trainer: Trainer | null = null
let sim: SimTrainer | null = null
export const currentTrainer = () => trainer

export const DURATIONS = [0, 30, 45, 60, 75, 90]

export function planFor(id: string, minutes: number): Plan {
  const raw = PLANS.find((p) => p.id === id)!
  return minutes ? generate(raw, minutes) : parsePlan(raw)
}

/** Garage: profile, trainer pairing, solo and crew entry points. */
export function showHome(profile: Profile, act: HomeActions) {
  const live = h('div', { class: 'live' }, trainer ? `${trainer.name} connected` : 'No trainer connected')
  const watch = () => trainer?.onData((d) => (live.textContent = `${trainer!.name}: ${d.power} W · ${Math.round(d.cadence)} rpm`))
  watch()
  const field = (label: string, input: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), input)
  const name = h('input', { value: profile.name, placeholder: 'Your name', maxLength: 16 })
  const ftp = h('input', { type: 'number', value: profile.ftp, min: 50, max: 600 })
  const tier = h('select', {}, ...TIERS.map((t) => h('option', { value: t, selected: t === profile.tier }, t)))
  const save = () => {
    profile.name = name.value.trim() || 'Rider'
    profile.ftp = Math.max(50, Math.min(600, +ftp.value || 200))
    profile.tier = tier.value as Tier
    saveProfile(profile)
  }
  for (const i of [name, ftp, tier]) i.addEventListener('change', save)
  const plan = h('select', {}, ...PLANS.map((p) => h('option', { value: p.id }, `${p.name} (${fmt(planTotal(parsePlan(p).blocks))})`)))
  const mins = h('select', {}, ...DURATIONS.map((m) => h('option', { value: m }, m ? `${m} min` : 'As written')))
  const desc = h('p', { class: 'dim' })
  const upd = () => (desc.textContent = PLANS.find((p) => p.id === plan.value)?.desc ?? '')
  plan.addEventListener('change', upd)
  upd()
  const code = h('input', { placeholder: 'CODE', maxLength: 4, style: 'width:6em;text-transform:uppercase' })
  const need = (fn: () => void) => () => {
    save()
    if (!trainer) return alert('Connect a trainer or use the simulated trainer first.')
    if (!profile.name) return alert('Enter your name first.')
    fn()
  }
  const connectBt = async () => {
    if (!navigator.bluetooth) return alert('Web Bluetooth is not available. Use Chrome or Edge over HTTPS (or localhost).')
    try {
      const t = new FtmsTrainer()
      await t.connect()
      trainer = t
      watch()
    } catch (e) {
      alert(`Could not connect: ${(e as Error).message}`)
    }
  }
  const useSim = () => {
    if (!sim) {
      sim = new SimTrainer()
      sim.start(4)
      bindKeys(sim, profile.ftp)
    }
    trainer = sim
    watch()
  }
  show(h('div', { class: 'page' },
    h('h1', {}, '🧟 Zombie Bus'),
    h('div', { class: 'card' }, h('h2', {}, 'Rider'), h('div', { class: 'row' }, field('Name', name), field('FTP (W)', ftp), field('Tier', tier)),
      h('p', { class: 'dim' }, `${profile.stats.rides} rides · ${Math.round(profile.stats.secs / 3600)} h · ${profile.stats.kj} kJ · ${profile.stats.streak} week streak`)),
    h('div', { class: 'card' }, h('h2', {}, 'Trainer'), live,
      h('div', { class: 'row' }, h('button', { onclick: connectBt }, 'Connect trainer (Bluetooth)'), h('button', { class: 'ghost', onclick: useSim }, 'Use simulated trainer')),
      h('p', { class: 'dim' }, 'Close MyWhoosh/Wahoo apps first. Sim keys: ↑↓ free-ride watts, ←→ cadence, [ ] ERG effort, S sprint power, A easy power.')),
    h('div', { class: 'card' }, h('h2', {}, 'Ride with the crew'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: need(act.create) }, 'Start a bus'), code, h('button', { onclick: need(() => act.join(code.value.toUpperCase())) }, 'Join'))),
    h('div', { class: 'card' }, h('h2', {}, 'Solo drill'), h('div', { class: 'row' }, field('Plan', plan), field('Length', mins)), desc,
      h('button', { onclick: need(() => act.drill(planFor(plan.value, +mins.value))) }, 'Start drill')),
  ))
}

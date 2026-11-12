import { zoneOf } from '../core/curve'
import type { RideRecorder } from '../core/ride'
import { h } from './dom'
import { GRADE_COLOUR, set } from './hudKit'
import { ZONE_COLOURS } from './planGraph'

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)

/** Normalised power: 4th-root mean of the 30 s rolling average to the 4th power. */
export function normalisedPower(power: number[]) {
  if (power.length < 30) return mean(power)
  const pre = [0]
  for (const p of power) pre.push(pre[pre.length - 1] + p)
  let s = 0
  for (let i = 30; i < pre.length; i++) s += ((pre[i] - pre[i - 30]) / 30) ** 4
  return (s / (pre.length - 30)) ** 0.25
}

export function rideStats(rec: RideRecorder) {
  const zones = Array(7).fill(0)
  for (const p of rec.power) zones[zoneOf(p, rec.ftp)]++
  return {
    avg: mean(rec.power),
    np: normalisedPower(rec.power),
    kj: rec.power.reduce((a, b) => a + b, 0) / 1000,
    cad: mean(rec.cadence.filter((c) => c > 0)),
    zones,
  }
}

/** Bottom-left "my stats": a slim strip that expands to the full panel (Tab toggles). */
export function makeStats(rec: RideRecorder) {
  const v = (cls = '') => h('b', { class: cls })
  const avg = v(),
    np = v(),
    kj = v(),
    cad = v(),
    comp = v(),
    stripTxt = h('span', {})
  const cell = (label: string, el: HTMLElement, unit: string) =>
    h('div', { class: 'st-cell' }, h('label', {}, label), h('div', {}, el, h('small', {}, unit)))
  const zbar = h('div', { class: 'st-zones' })
  const zleg = h('div', { class: 'st-zleg' })
  const sprints = h('div', { class: 'st-sprints' })
  const body = h(
    'div',
    { class: 'st-body' },
    h(
      'div',
      { class: 'st-grid' },
      cell('AVG POWER', avg, 'W'),
      cell('NORM. POWER', np, 'W'),
      cell('ENERGY', kj, 'kJ'),
      cell('AVG CADENCE', cad, 'rpm'),
      cell('COMPLIANCE', comp, '%'),
    ),
    h('label', {}, 'TIME IN ZONE'),
    zbar,
    zleg,
    h('label', {}, 'SPRINTS'),
    sprints,
  )
  const strip = h(
    'button',
    { class: 'st-strip', title: 'My stats (Tab)', onclick: () => toggle() },
    h('span', { class: 'st-ico' }, '📊'),
    stripTxt,
    h('kbd', {}, 'Tab'),
  )
  const root = h('section', { class: 'hud-glass st' }, body, strip)
  const toggle = () => {
    root.classList.toggle('open')
    lastN = -1
    setTimeout(() => api.update())
  }
  const key = (e: KeyboardEvent) => {
    if (!root.isConnected) return removeEventListener('keydown', key)
    if (e.key !== 'Tab') return
    e.preventDefault()
    toggle()
  }
  addEventListener('keydown', key)
  let lastN = -1
  const api = {
    root,
    update() {
      if (rec.power.length === lastN) return
      lastN = rec.power.length
      const s = rideStats(rec)
      set(stripTxt, `AVG ${Math.round(s.avg)} W · NP ${Math.round(s.np)} · ${Math.round(s.kj)} kJ`)
      if (!root.classList.contains('open')) return
      set(avg, `${Math.round(s.avg)}`)
      set(np, `${Math.round(s.np)}`)
      set(kj, s.kj.toFixed(1))
      set(cad, `${Math.round(s.cad)}`)
      set(comp, `${Math.round(rec.summary().compliance * 100)}`)
      const tot = s.zones.reduce((a, b) => a + b, 0) || 1
      zbar.replaceChildren(
        ...s.zones.map((z, i) => {
          const seg = h('i', { title: `Z${i + 1}` })
          seg.style.cssText = `flex:${z / tot};background:${ZONE_COLOURS[i]}`
          return seg
        }),
      )
      zleg.replaceChildren(
        ...s.zones.map((z, i) => {
          const l = h('span', {}, `Z${i + 1} ${Math.round((z / tot) * 100)}%`)
          l.style.color = ZONE_COLOURS[i]
          return l
        }),
      )
      sprints.replaceChildren(
        ...(rec.sprints.length
          ? rec.sprints.map((r) => {
              const c = h('span', { class: 'st-chip' }, `${r.grade} ${r.avg} W`)
              c.style.setProperty('--g', GRADE_COLOUR[r.grade])
              return c
            })
          : [h('span', { class: 'st-none' }, 'None yet')]),
      )
    },
  }
  return api
}

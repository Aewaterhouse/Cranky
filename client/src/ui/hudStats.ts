import { zoneOf } from '../core/curve'
import type { RideRecorder } from '../core/ride'
import { h } from './dom'
import { GRADE_COLOUR, set } from './hudKit'
import { hudStat } from './hudParts'
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

/** "My stats" for the bus: the rows of the stats drawer under the power panel, with time in zone and sprint grades. */
export function makeStats(rec: RideRecorder) {
  const rows = {
    avg: hudStat('Avg power'),
    np: hudStat('Normalised'),
    kj: hudStat('Energy'),
    cad: hudStat('Avg cadence'),
    comp: hudStat('Compliance'),
  }
  const zbar = h('div', { class: 'st-zones' })
  const sprints = h('div', { class: 'st-sprints' })
  const root = h(
    'div',
    { class: 'glass hstats' },
    ...Object.values(rows).map((r) => r.el),
    h('div', {}, h('span', {}, 'Time in zone'), h('span', {}, 'Z1 → Z7')),
    zbar,
    h('div', {}, h('span', {}, 'Sprints')),
    sprints,
  )
  let lastN = -1
  return {
    root,
    update() {
      if (rec.power.length === lastN || !root.offsetParent) return
      lastN = rec.power.length
      const s = rideStats(rec)
      set(rows.avg.v, `${Math.round(s.avg)} W`)
      set(rows.np.v, `${Math.round(s.np)} W`)
      set(rows.kj.v, `${Math.round(s.kj)} kJ`)
      set(rows.cad.v, `${Math.round(s.cad)} rpm`)
      set(rows.comp.v, `${Math.round(rec.summary().compliance * 100)}%`)
      const tot = s.zones.reduce((a, b) => a + b, 0) || 1
      zbar.replaceChildren(
        ...s.zones.map((z, i) => {
          const seg = h('i', { title: `Z${i + 1} ${Math.round((z / tot) * 100)}%` })
          seg.style.cssText = `flex:${z / tot};background:${ZONE_COLOURS[i]}`
          return seg
        }),
      )
      sprints.replaceChildren(
        ...(rec.sprints.length
          ? rec.sprints.map((r) => {
              const c = h('span', { class: 'st-chip' }, `${r.grade} ${r.avg} W`)
              c.style.setProperty('--g', GRADE_COLOUR[r.grade])
              return c
            })
          : [h('span', {}, 'None yet')]),
      )
    },
  }
}

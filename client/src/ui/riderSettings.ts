import { CFG } from '../config'
import { ftpSuggestion, recordFtp, type Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { settings } from '../core/settings'
import { unitNames, weightIn, weightToKg } from '../core/units'
import {
  ftpSeries,
  hrZones,
  powerZones,
  validBounds,
  wkgStr,
  zoneBounds,
} from '../core/riderMetrics'
import { TIERS, type Tier } from '../types'
import { h, seg } from './dom'
import { ZONE_COLOURS } from './planGraph'
import { chartBox, niceTicks, svgEl } from './svg'
import { stravaPanel } from './strava'
import { setSimFtp } from './trainer'

const TIER_HELP: Record<Tier, string> = {
  hard: 'Full targets, the plan as written.',
  medium: `Targets at ${CFG.tierFactor.medium * 100}%. Still a proper workout.`,
  easy: `Targets at ${CFG.tierFactor.easy * 100}%. Recovery day or new to the bike.`,
}
const num = (value: number | undefined, min: number, max: number, placeholder = '') =>
  h('input', { type: 'number', value: value ?? '', min, max, placeholder, inputmode: 'decimal' })
const field = (input: HTMLElement, unit: string) =>
  h('label', { class: 'ftp' }, input, h('span', {}, unit))
const day = (t: number) =>
  new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

/** Step chart of FTP over time. */
export function ftpChart(p: Profile) {
  const pts = ftpSeries(p)
  const c = chartBox(480, 180)
  const t0 = pts[0].t
  const t1 = Math.max(pts[pts.length - 1].t, t0 + 86400000)
  const vals = pts.map((q) => q.ftp)
  const lo = Math.floor((Math.min(...vals) - 10) / 10) * 10
  const hi = Math.ceil((Math.max(...vals) + 10) / 10) * 10
  const x = (t: number) => c.l + ((t - t0) / (t1 - t0)) * c.pw
  const y = (v: number) => c.t + (1 - (v - lo) / (hi - lo)) * c.ph
  for (const v of niceTicks(hi - lo, 3).map((v) => v + lo))
    c.svg.append(
      svgEl('line', { x1: c.l, x2: c.W - c.r, y1: y(v), y2: y(v), class: 'grid' }),
      svgEl('text', { x: c.l - 6, y: y(v) + 4, class: 'ax', 'text-anchor': 'end' }, String(v)),
    )
  const d = pts.map((q, i) => (i ? `H${x(q.t)} V${y(q.ftp)}` : `M${x(q.t)} ${y(q.ftp)}`)).join(' ')
  c.svg.append(
    svgEl('path', { d: `${d} H${c.W - c.r}`, class: 'ftp-line' }),
    svgEl('text', { x: c.l, y: c.H - 6, class: 'ax' }, day(t0)),
    svgEl('text', { x: c.W - c.r, y: c.H - 6, class: 'ax', 'text-anchor': 'end' }, 'today'),
  )
  for (const q of pts) {
    const dot = svgEl('circle', { cx: x(q.t), cy: y(q.ftp), r: 4, class: 'ftp-dot' })
    dot.append(svgEl('title', {}, `${q.ftp} W from ${day(q.t)}`))
    c.svg.append(dot)
  }
  return c.svg
}

function zoneTables(p: Profile) {
  const box = h('div')
  const draw = () => {
    const b = zoneBounds(p)
    const inputs = b.map((v) => num(Math.round(v * 100), 10, 300))
    inputs.forEach((i) =>
      i.addEventListener('change', () => {
        const next = inputs.map((x) => +x.value / 100)
        if (validBounds(next)) {
          p.zoneBounds = next.every((v, k) => v === CFG.zones[k]) ? undefined : next
          saveProfile(p)
        }
        draw()
      }),
    )
    const rows = powerZones(p.ftp, b).map((z, i) =>
      h(
        'tr',
        {},
        h('td', {}, h('i', { class: 'zdot', style: `background:${ZONE_COLOURS[i]}` }), `Z${z.z}`),
        h('td', {}, z.name),
        h('td', { class: 'num' }, z.hi == null ? `${z.lo}+ W` : `${z.lo} to ${z.hi} W`),
        h(
          'td',
          { class: 'num' },
          i < inputs.length ? h('span', { class: 'pct' }, inputs[i], '%') : '–',
        ),
      ),
    )
    box.replaceChildren(
      h(
        'table',
        { class: 'ztable' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ...['Zone', '', `Watts at ${p.ftp} W`, 'Up to % FTP'].map((x) => h('th', {}, x)),
          ),
        ),
        h('tbody', {}, ...rows),
      ),
      h(
        'p',
        { class: 'dim' },
        'Edit the upper bounds. Recorded time in zone keeps the standard bounds so rides stay comparable. ',
        h(
          'button',
          {
            class: 'link',
            disabled: !p.zoneBounds,
            onclick: () => ((p.zoneBounds = undefined), saveProfile(p), draw()),
          },
          'Reset to standard',
        ),
      ),
    )
  }
  draw()
  return box
}

function hrTable(p: Profile) {
  if (!p.maxHr) return h('p', { class: 'dim' }, 'Add your max heart rate to see your zones.')
  return h(
    'table',
    { class: 'ztable' },
    h('thead', {}, h('tr', {}, ...['Zone', '', 'Beats per minute'].map((x) => h('th', {}, x)))),
    h(
      'tbody',
      {},
      ...hrZones(p.maxHr, p.restHr).map((z, i) =>
        h(
          'tr',
          {},
          h(
            'td',
            {},
            h('i', { class: 'zdot', style: `background:${ZONE_COLOURS[i + 1]}` }),
            `Z${z.z}`,
          ),
          h('td', {}, z.name),
          h('td', { class: 'num' }, z.z === 1 ? `up to ${z.hi}` : `${z.lo} to ${z.hi}`),
        ),
      ),
    ),
  )
}

/** FTP, weight, heart rate, zones and default tier. `changed` fires after FTP or weight edits. */
export function riderSettings(p: Profile, changed: () => void) {
  const save = () => (saveProfile(p), setSimFtp(p.ftp), changed())
  const ftp = num(p.ftp, 50, 600)
  const kg = h('span', { class: 'dim' }, wkgStr(p.ftp, p.weightKg))
  const tip = h('div')
  const suggest = () => {
    const s = ftpSuggestion(p)
    tip.replaceChildren(
      s
        ? h(
            'p',
            { class: 'suggest' },
            `Your 20 min best suggests ${s} W. `,
            h(
              'button',
              { class: 'link', onclick: () => ((ftp.value = String(s)), setFtp()) },
              'Use it',
            ),
          )
        : '',
    )
  }
  const setFtp = () => {
    recordFtp(p, Math.max(50, Math.min(600, Math.round(+ftp.value) || 200)))
    ftp.value = String(p.ftp)
    kg.textContent = wkgStr(p.ftp, p.weightKg)
    save()
    suggest()
    hist.replaceChildren(ftpChart(p))
  }
  ftp.addEventListener('change', setFtp)
  const wu = settings.units
  const shown = (kg?: number) => (kg ? +weightIn(kg, wu).toFixed(1) : undefined)
  const weight = num(shown(p.weightKg), 30, 560, 'optional')
  weight.setAttribute('step', '0.1')
  weight.addEventListener('change', () => {
    const v = Math.round(weightToKg(+weight.value, wu) * 10) / 10
    p.weightKg = v >= 30 && v <= 250 ? v : undefined
    weight.value = String(shown(p.weightKg) ?? '')
    kg.textContent = wkgStr(p.ftp, p.weightKg)
    save()
  })
  const hrInput = (key: 'maxHr' | 'restHr', min: number, max: number) => {
    const i = num(p[key], min, max, 'optional')
    i.addEventListener('change', () => {
      const v = Math.round(+i.value)
      p[key] = v >= min && v <= max ? v : undefined
      i.value = p[key] ? String(p[key]) : ''
      saveProfile(p)
      hrBox.replaceChildren(hrTable(p))
    })
    return i
  }
  const hrBox = h('div', {}, hrTable(p))
  const hist = h('div', {}, ftpChart(p))
  const help = h('p', { class: 'dim' }, TIER_HELP[p.tier])
  const tiers = seg(
    TIERS.map((t) => [t, t[0].toUpperCase() + t.slice(1)]),
    p.tier,
    (t) => ((p.tier = t), saveProfile(p), (help.textContent = TIER_HELP[t])),
  )
  suggest()
  const panel = (title: string, ...kids: (Node | string)[]) =>
    h('section', { class: 'panel' }, h('h2', { class: 'label' }, title), ...kids)
  return h(
    'div',
    { class: 'cols' },
    h(
      'div',
      {},
      panel(
        'FTP',
        h('div', { class: 'row' }, field(ftp, 'W'), kg),
        h('p', { class: 'dim' }, 'Every target is a percentage of this. Too hard? Lower it.'),
        tip,
      ),
      panel(
        'Weight',
        field(weight, unitNames(wu).weight),
        h('p', { class: 'dim' }, 'Optional. Gives you W/kg on your power curve.'),
      ),
      panel('Default tier', tiers, help),
      panel(
        'Heart rate',
        h(
          'div',
          { class: 'row' },
          h('label', { class: 'field' }, 'Max', field(hrInput('maxHr', 100, 230), 'bpm')),
          h('label', { class: 'field' }, 'Resting', field(hrInput('restHr', 30, 100), 'bpm')),
        ),
        h(
          'p',
          { class: 'dim' },
          'Optional. Colours your heart rate by zone. A resting rate switches the table to heart-rate reserve.',
        ),
        hrBox,
      ),
    ),
    h(
      'div',
      {},
      panel('Strava', stravaPanel()),
      panel('Power zones', zoneTables(p)),
      panel('FTP history', hist),
    ),
  )
}

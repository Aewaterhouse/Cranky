import { CFG } from '../config'
import type { Profile } from '../core/curve'
import { dailyTss, fitness, heatmap, streaks, weeklyTss, type FitnessDay } from '../core/fitness'
import { h } from './dom'
import { chartBox, niceTicks, svgEl } from './svg'

const CTL = '#3bb2d1'
const ATL = '#e85d9c'
const short = (day: string) =>
  new Date(`${day}T12:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
const panel = (title: string, ...kids: (Node | string)[]) =>
  h('section', { class: 'panel' }, h('h2', { class: 'label' }, title), ...kids)

function weeklyChart(weeks: { start: string; tss: number }[]) {
  const c = chartBox(480, 220, { l: 38, r: 8, t: 12, b: 28 })
  const top = niceTicks(Math.max(50, ...weeks.map((w) => w.tss)) * 1.05, 4)
  const hi = top[top.length - 1]
  const y = (v: number) => c.t + (1 - v / hi) * c.ph
  const bw = c.pw / weeks.length
  for (const v of top)
    c.svg.append(
      svgEl('line', { x1: c.l, x2: c.W - c.r, y1: y(v), y2: y(v), class: 'grid' }),
      svgEl('text', { x: c.l - 6, y: y(v) + 4, class: 'ax', 'text-anchor': 'end' }, String(v)),
    )
  weeks.forEach((w, i) => {
    const x = c.l + i * bw
    const bar = svgEl('rect', {
      x: x + bw * 0.15,
      y: y(w.tss),
      width: bw * 0.7,
      height: Math.max(0, c.t + c.ph - y(w.tss)),
      rx: 3,
      class: i === weeks.length - 1 ? 'wk-bar now' : 'wk-bar',
    })
    bar.append(svgEl('title', {}, `Week of ${short(w.start)}: ${Math.round(w.tss)} TSS`))
    c.svg.append(bar)
    if (i % 2 === weeks.length % 2 || bw > 60)
      c.svg.append(
        svgEl(
          'text',
          { x: x + bw / 2, y: c.H - 9, class: 'ax', 'text-anchor': 'middle' },
          short(w.start),
        ),
      )
  })
  return c.svg
}

/** CTL, ATL and TSB over the last 90 days with a hover read-out. */
function formChart(days: FitnessDay[]) {
  const narrow = innerWidth < 600
  const c = chartBox(narrow ? 340 : 640, narrow ? 250 : 280, { l: 38, r: 8, t: 12, b: 28 })
  const vals = days.flatMap((d) => [d.ctl, d.atl, d.tsb])
  const step = niceTicks(Math.max(20, Math.max(...vals)) - Math.min(0, Math.min(...vals)), 5)[1]
  const lo = Math.min(0, Math.floor(Math.min(...vals) / step) * step)
  const hi = Math.max(step * 2, Math.ceil(Math.max(...vals) / step) * step)
  const x = (i: number) => c.l + (i / (days.length - 1)) * c.pw
  const y = (v: number) => c.t + (1 - (v - lo) / (hi - lo)) * c.ph
  for (let v = lo; v <= hi; v += step)
    c.svg.append(
      svgEl('line', {
        x1: c.l,
        x2: c.W - c.r,
        y1: y(v),
        y2: y(v),
        class: v === 0 ? 'grid zero' : 'grid',
      }),
      svgEl('text', { x: c.l - 6, y: y(v) + 4, class: 'ax', 'text-anchor': 'end' }, String(v)),
    )
  ;[0, 30, 60, 89].forEach((i) =>
    c.svg.append(
      svgEl(
        'text',
        {
          x: x(i),
          y: c.H - 9,
          class: 'ax',
          'text-anchor': i === 89 ? 'end' : i ? 'middle' : 'start',
        },
        short(days[i].day),
      ),
    ),
  )
  const path = (k: 'ctl' | 'atl' | 'tsb') =>
    days.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  c.svg.append(
    svgEl('polygon', {
      points: `${x(0)},${y(0)} ${path('tsb')} ${x(days.length - 1)},${y(0)}`,
      class: 'tsb-fill',
    }),
    svgEl('polyline', { points: path('tsb'), class: 'fline tsb' }),
    svgEl('polyline', { points: path('atl'), class: 'fline', stroke: ATL }),
    svgEl('polyline', { points: path('ctl'), class: 'fline', stroke: CTL }),
  )
  const guide = svgEl('line', { y1: c.t, y2: c.t + c.ph, class: 'gline', visibility: 'hidden' })
  const tip = h('div', { class: 'ctip', hidden: true })
  c.svg.append(guide)
  const show = (e: PointerEvent) => {
    const r = c.svg.getBoundingClientRect()
    const f = (((e.clientX - r.left) / r.width) * c.W - c.l) / c.pw
    const i = Math.min(days.length - 1, Math.max(0, Math.round(f * (days.length - 1))))
    const d = days[i]
    guide.setAttribute('x1', String(x(i)))
    guide.setAttribute('x2', String(x(i)))
    guide.setAttribute('visibility', 'visible')
    const row = (col: string, label: string, v: number) =>
      h(
        'div',
        {},
        h('i', { style: `background:${col}` }),
        h('span', {}, label),
        h('b', {}, v.toFixed(0)),
      )
    tip.replaceChildren(
      h('strong', {}, short(d.day)),
      row(CTL, 'Fitness (CTL)', d.ctl),
      row(ATL, 'Fatigue (ATL)', d.atl),
      row('var(--tox)', 'Form (TSB)', d.tsb),
      h('small', {}, d.tss ? `${Math.round(d.tss)} TSS that day` : 'Rest day'),
    )
    tip.hidden = false
    const left = (x(i) / c.W) * r.width
    tip.style.left = `${left}px`
    tip.classList.toggle('flip', left > r.width * 0.55)
  }
  const hide = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    guide.setAttribute('visibility', 'hidden')
    tip.hidden = true
  }
  c.svg.addEventListener('pointermove', show)
  c.svg.addEventListener('pointerdown', show)
  c.svg.addEventListener('pointerleave', hide)
  return h('div', { class: 'cwrap' }, c.svg, tip)
}

function heat(grid: ReturnType<typeof heatmap>) {
  const cell = 14
  const gap = 3
  const l = 22
  const t = 18
  const svg = svgEl('svg', {
    viewBox: `0 0 ${l + grid.length * (cell + gap)} ${t + 7 * (cell + gap)}`,
    class: 'rchart heat',
    role: 'img',
  })
  ;['Mon', 'Wed', 'Fri'].forEach((d, i) =>
    svg.append(svgEl('text', { x: 0, y: t + i * 2 * (cell + gap) + cell - 2, class: 'ax' }, d[0])),
  )
  let lastMonth = ''
  grid.forEach((week, w) => {
    const m = new Date(`${week[0].day}T12:00`).toLocaleDateString('en-AU', { month: 'short' })
    if (m !== lastMonth)
      svg.append(svgEl('text', { x: l + w * (cell + gap), y: 11, class: 'ax' }, m))
    lastMonth = m
    week.forEach((d, i) => {
      if (d.future) return
      const level = d.tss == null ? 0 : d.tss < 40 ? 1 : d.tss < 80 ? 2 : d.tss < 130 ? 3 : 4
      const r = svgEl('rect', {
        x: l + w * (cell + gap),
        y: t + i * (cell + gap),
        width: cell,
        height: cell,
        rx: 3,
        class: `hm l${level}`,
      })
      r.append(
        svgEl(
          'title',
          {},
          `${short(d.day)}: ${d.tss == null ? 'rest' : `${Math.round(d.tss)} TSS`}`,
        ),
      )
      svg.append(r)
    })
  })
  return svg
}

/** Trends tab: weekly TSS, fitness / fatigue / form, calendar heatmap and streaks. */
export function trendsTab(p: Profile, now = new Date()) {
  if (!p.rides.length)
    return panel(
      'Trends',
      h('p', { class: 'dim' }, 'Ride a few times and your fitness trends show up here.'),
    )
  const daily = dailyTss(p.rides)
  const days = fitness(daily, now)
  const last = days[days.length - 1]
  const st = streaks(daily, now)
  const t = CFG.trends
  const stat = (v: string | number, l: string) =>
    h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l))
  const guessed = p.rides.some((r) => r.tss == null)
  return h(
    'div',
    {},
    h(
      'section',
      { class: 'panel stats' },
      stat(Math.round(last.ctl), 'fitness (CTL)'),
      stat(Math.round(last.atl), 'fatigue (ATL)'),
      stat((last.tsb > 0 ? '+' : '') + Math.round(last.tsb), 'form (TSB)'),
      stat(`${st.current} / ${st.best}`, 'day streak / best'),
    ),
    panel(
      'Fitness, fatigue and form',
      formChart(days),
      h(
        'p',
        { class: 'dim legend' },
        h('i', { class: 'lkey', style: `background:${CTL}` }),
        `Fitness: ${t.ctlDays} day average of daily TSS  `,
        h('i', { class: 'lkey', style: `background:${ATL}` }),
        `Fatigue: ${t.atlDays} day average  `,
        h('i', { class: 'lkey', style: 'background:var(--tox)' }),
        'Form: fitness minus fatigue. Slightly negative is training hard; positive is fresh.',
      ),
    ),
    h(
      'div',
      { class: 'cols' },
      panel(`Weekly TSS, last ${t.weeks} weeks`, weeklyChart(weeklyTss(daily, now))),
      panel(
        `Ride days, last ${t.heatWeeks} weeks`,
        heat(heatmap(daily, now)),
        h(
          'p',
          { class: 'dim legend' },
          'Less ',
          ...[0, 1, 2, 3, 4].map((l) => h('i', { class: `hm-key l${l}` })),
          ' More. Darker means a bigger day.',
        ),
      ),
    ),
    guessed
      ? h(
          'p',
          { class: 'dim' },
          'Rides from before TSS was recorded are estimated from their time in each zone.',
        )
      : '',
  )
}

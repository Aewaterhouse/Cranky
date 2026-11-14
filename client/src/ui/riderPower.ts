import { CFG } from '../config'
import { api } from '../core/api'
import { mateLine, type CrewRider } from '../core/crewCurve'
import { type Profile } from '../core/curve'
import {
  curveLines,
  fmtDur,
  lineKg,
  nearestDur,
  xFrac,
  yTop,
  yValue,
  type CurveLine,
  type CurvePt,
} from '../core/powerCurve'
import { h, seg } from './dom'
import { crewBoard } from './riderCrew'
import { chartBox, niceTicks, smoothPath, svgEl } from './svg'

const COLOUR: Record<CurveLine['key'], string> = {
  all: 'var(--acc)',
  d90: 'var(--tox)',
  last: '#3bb2d1',
  mate: 'var(--dim)',
}
const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** Interactive log-time power curve. Hover or tap for the values at a duration; toggle W and W/kg. */
export function curveChart(p: Profile, mates: CrewRider[] = []) {
  const own = curveLines(p).filter((l) => l.pts.length)
  const picked = new Set<string>()
  let lines = own
  let kg: number | undefined
  const colour = (l: CurveLine) => l.colour ?? COLOUR[l.key]
  const rebuild = () => {
    lines = [...own, ...mates.flatMap((m, i) => (picked.has(m.id) ? [mateLine(m, i)] : []))].filter(
      (l) => l.pts.length && !(kg && l.key === 'mate' && !l.kg),
    )
  }
  const narrow = innerWidth < 600
  const c = chartBox(narrow ? 340 : 640, narrow ? 300 : 320, { l: 44, r: 10, t: 14, b: 30 })
  const tip = h('div', { class: 'ctip', hidden: true })
  const wrap = h('div', { class: 'cwrap' }, c.svg, tip)
  const plot = svgEl('g')
  const guide = svgEl('g', { class: 'guide' })
  c.svg.append(plot, guide)
  const x = (d: number) => c.l + xFrac(d) * c.pw
  const draw = () => {
    const top = yTop(lines, kg)
    plot.replaceChildren()
    for (const v of niceTicks(top, 5))
      plot.append(
        svgEl('line', {
          x1: c.l,
          x2: c.W - c.r,
          y1: c.t + (1 - v / top) * c.ph,
          y2: c.t + (1 - v / top) * c.ph,
          class: 'grid',
        }),
        svgEl(
          'text',
          { x: c.l - 6, y: c.t + (1 - v / top) * c.ph + 4, class: 'ax', 'text-anchor': 'end' },
          String(v),
        ),
      )
    for (const d of CFG.curveLabels.filter(
      (d) => !narrow || [1, 15, 60, 300, 1200, 3600].includes(d),
    ))
      plot.append(
        svgEl('text', { x: x(d), y: c.H - 9, class: 'ax', 'text-anchor': 'middle' }, fmtDur(d)),
      )
    for (const l of lines) {
      const col = colour(l)
      const y = (w: number) => c.t + (1 - yValue(w, lineKg(l, kg)) / top) * c.ph
      const path = (qs: CurvePt[]) =>
        smoothPath(qs.map((q): [number, number] => [+x(q.d).toFixed(1), +y(q.w).toFixed(1)]))
      plot.append(
        svgEl('path', { d: path(l.pts), class: 'cline faint', stroke: col, fill: 'none' }),
      )
      let run: CurvePt[] = []
      const flush = () => {
        if (run.length > 1)
          plot.append(
            svgEl('path', { d: path(run), class: `cline ${l.key}`, stroke: col, fill: 'none' }),
          )
        run = []
      }
      for (const q of l.pts) q.real ? run.push(q) : flush()
      flush()
      // Dots only at the labelled durations: the finer points shape the line without crowding it.
      for (const q of l.pts.filter((q) => CFG.curveLabels.includes(q.d)))
        plot.append(
          svgEl('circle', {
            cx: x(q.d),
            cy: y(q.w),
            r: q.real ? 3.5 : 3,
            class: q.real ? 'cdot' : 'cdot est',
            fill: q.real ? col : 'var(--card)',
            stroke: col,
          }),
        )
    }
    guide.replaceChildren()
    tip.hidden = true
  }
  const show = (e: PointerEvent) => {
    const r = c.svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * c.W
    const d = nearestDur(Math.min(1, Math.max(0, (px - c.l) / c.pw)))
    const top = yTop(lines, kg)
    guide.replaceChildren(
      svgEl('line', { x1: x(d), x2: x(d), y1: c.t, y2: c.H - c.b, class: 'gline' }),
    )
    const rows = lines.flatMap((l) => {
      const q = l.pts.find((z) => z.d === d)
      if (!q) return []
      const y = c.t + (1 - yValue(q.w, lineKg(l, kg)) / top) * c.ph
      guide.append(svgEl('circle', { cx: x(d), cy: y, r: 5.5, fill: colour(l), class: 'ghalo' }))
      const lk = l.key === 'mate' ? l.kg : p.weightKg
      const wk = lk ? ` · ${(q.w / lk).toFixed(2)} W/kg` : ''
      return [
        h(
          'div',
          { class: q.real ? '' : 'est' },
          h('i', { style: `background:${colour(l)}` }),
          h('span', {}, l.label),
          h('b', {}, `${q.w} W${wk}`),
          h('small', {}, q.date ? when(q.date) : 'estimate'),
        ),
      ]
    })
    tip.replaceChildren(h('strong', {}, fmtDur(d)), ...rows)
    tip.hidden = false
    const left = (x(d) / c.W) * r.width
    tip.style.left = `${left}px`
    tip.classList.toggle('flip', left > r.width * 0.55)
  }
  c.svg.addEventListener('pointermove', show)
  c.svg.addEventListener('pointerdown', show)
  c.svg.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && draw())
  draw()
  const unit = seg<'w' | 'kg'>(
    [
      ['w', 'W'],
      ['kg', 'W/kg'],
    ],
    'w',
    (v) => ((kg = v === 'kg' ? p.weightKg : undefined), rebuild(), draw()),
    'unit',
  )
  if (!p.weightKg) unit.querySelector<HTMLButtonElement>('[data-v=kg]')!.disabled = true
  const legend = h(
    'p',
    { class: 'dim legend' },
    ...own.flatMap((l) => [
      h('i', { class: 'lkey', style: `background:${colour(l)}` }),
      `${l.label}  `,
    ]),
    h('span', {}, ' Solid is a real effort, faint and hollow is estimated from FTP.'),
  )
  const chips = h(
    'div',
    { class: 'row chips' },
    ...mates.map((m, i) =>
      h(
        'button',
        {
          class: 'chip',
          style: `--c:${mateLine(m, i).colour}`,
          title: m.weightKg ? '' : 'No weight set, so hidden in W/kg',
          onclick: (e: Event) => {
            const on = !picked.delete(m.id) && !!picked.add(m.id)
            ;(e.currentTarget as HTMLElement).classList.toggle('on', on)
            rebuild()
            draw()
          },
        },
        m.name,
      ),
    ),
  )
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'row chead' },
      h(
        'span',
        { class: 'dim' },
        p.weightKg
          ? 'Hover or tap the chart for details.'
          : 'Add your weight in Settings for W/kg.',
      ),
      unit,
    ),
    mates.length ? chips : '',
    wrap,
    legend,
  )
}

/** Power tab: the curve chart and the best-effort table. */
export function powerTab(p: Profile) {
  const chart = h('div', {}, curveChart(p))
  const board = h('div', {})
  api<CrewRider[]>('/api/crew/curves')
    .then((all) => {
      const mates = all.filter((m) => m.id !== p.id && Object.keys(m.best).length)
      if (mates.length) chart.replaceChildren(curveChart(p, mates))
      board.replaceChildren(crewBoard(all, p.id))
    })
    .catch(() => {})
  const [all, d90, last] = curveLines(p)
  const cell = (q?: CurvePt) =>
    h(
      'td',
      {
        class: q?.real ? 'real' : 'est',
        title: q && !q.real ? `About ${q.w} W from your FTP` : '',
      },
      q?.real ? `${q.w} W` : '–',
      q?.real && p.weightKg ? h('small', {}, ` ${(q.w / p.weightKg).toFixed(1)}`) : '',
    )
  return h(
    'div',
    {},
    h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Power curve'), chart),
    board,
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'Best efforts'),
      h(
        'table',
        { class: 'curve' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ...['Best', 'All time', 'Last 90 days', 'Last ride'].map((x) => h('th', {}, x)),
          ),
        ),
        h(
          'tbody',
          {},
          ...CFG.curveLabels.map((d) =>
            h(
              'tr',
              {},
              h('th', {}, fmtDur(d)),
              cell(all.pts.find((q) => q.d === d)),
              cell(d90.pts.find((q) => q.d === d)),
              cell(last.pts.find((q) => q.d === d)),
            ),
          ),
        ),
      ),
    ),
  )
}

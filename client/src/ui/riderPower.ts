import { CFG } from '../config'
import { type Profile } from '../core/curve'
import {
  curveLines,
  fmtDur,
  nearestDur,
  xFrac,
  yTop,
  yValue,
  type CurveLine,
  type CurvePt,
} from '../core/powerCurve'
import { h, seg } from './dom'
import { chartBox, niceTicks, svgEl } from './svg'

const COLOUR: Record<CurveLine['key'], string> = {
  all: 'var(--acc)',
  d90: 'var(--tox)',
  last: '#3bb2d1',
}
const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** Interactive log-time power curve. Hover or tap for the values at a duration; toggle W and W/kg. */
export function curveChart(p: Profile) {
  const lines = curveLines(p).filter((l) => l.pts.length)
  let kg: number | undefined
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
    const y = (w: number) => c.t + (1 - yValue(w, kg) / top) * c.ph
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
    for (const d of CFG.curveDurations.filter(
      (d) => !narrow || [1, 15, 60, 300, 1200, 3600].includes(d),
    ))
      plot.append(
        svgEl('text', { x: x(d), y: c.H - 9, class: 'ax', 'text-anchor': 'middle' }, fmtDur(d)),
      )
    for (const l of lines) {
      const col = COLOUR[l.key]
      const pt = (q: CurvePt) => `${x(q.d).toFixed(1)},${y(q.w).toFixed(1)}`
      plot.append(
        svgEl('polyline', { points: l.pts.map(pt).join(' '), class: 'cline faint', stroke: col }),
      )
      let run: CurvePt[] = []
      const flush = () => {
        if (run.length > 1)
          plot.append(
            svgEl('polyline', {
              points: run.map(pt).join(' '),
              class: `cline ${l.key}`,
              stroke: col,
            }),
          )
        run = []
      }
      for (const q of l.pts) q.real ? run.push(q) : flush()
      flush()
      for (const q of l.pts)
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
    const y = (w: number) => c.t + (1 - yValue(w, kg) / top) * c.ph
    guide.replaceChildren(
      svgEl('line', { x1: x(d), x2: x(d), y1: c.t, y2: c.H - c.b, class: 'gline' }),
    )
    const rows = lines.flatMap((l) => {
      const q = l.pts.find((z) => z.d === d)
      if (!q) return []
      guide.append(
        svgEl('circle', { cx: x(d), cy: y(q.w), r: 5.5, fill: COLOUR[l.key], class: 'ghalo' }),
      )
      const wk = p.weightKg ? ` · ${(q.w / p.weightKg).toFixed(2)} W/kg` : ''
      return [
        h(
          'div',
          { class: q.real ? '' : 'est' },
          h('i', { style: `background:${COLOUR[l.key]}` }),
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
    (v) => ((kg = v === 'kg' ? p.weightKg : undefined), draw()),
    'unit',
  )
  if (!p.weightKg) unit.querySelector<HTMLButtonElement>('[data-v=kg]')!.disabled = true
  const legend = h(
    'p',
    { class: 'dim legend' },
    ...lines.flatMap((l) => [
      h('i', { class: 'lkey', style: `background:${COLOUR[l.key]}` }),
      `${l.label}  `,
    ]),
    h('span', {}, ' Solid is a real effort, faint and hollow is estimated from FTP.'),
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
    wrap,
    legend,
  )
}

/** Power tab: the curve chart and the best-effort table. */
export function powerTab(p: Profile) {
  const [all, d90, last] = curveLines(p)
  const cell = (q?: CurvePt) =>
    h(
      'td',
      { class: q?.real ? 'real' : 'est' },
      q ? `${q.w} W` : '–',
      q && p.weightKg ? h('small', {}, ` ${(q.w / p.weightKg).toFixed(1)}`) : '',
    )
  return h(
    'div',
    {},
    h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Power curve'), curveChart(p)),
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
          ...CFG.curveDurations.map((d, i) =>
            h(
              'tr',
              {},
              h('th', {}, fmtDur(d)),
              cell(all.pts[i]),
              cell(d90.pts[i]),
              cell(last.pts.find((q) => q.d === d)),
            ),
          ),
        ),
      ),
    ),
  )
}

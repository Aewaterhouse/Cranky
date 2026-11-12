import { hrZone } from '../core/curve'
import type { Live } from '../modes/rideController'
import type { Frame, Plan, Tier } from '../types'
import { fmt, h } from './dom'
import { ZONE_COLOURS } from './planGraph'
import { soloActions, type SoloAction } from './soloExtras'
import { soloPanel, type LiveStats } from './soloPanel'
import { segsFromBlocks } from './soloSegs'
import { workoutChart } from './workoutChart'

export interface SoloHandlers {
  pause: () => void
  skip: () => void
  end: () => void
  intensity: (d: number) => void
  tier: (t: Tier) => void
}

export interface ViewState {
  fast: number
  f: Frame
  live: Live
  total: number
  intensity: number
  paused: string | null
  stats: LiveStats
  power: number[]
  xs: number[]
  cadence: number[]
  hr: (number | null)[]
  actions: SoloAction[]
}

const TIERS: Tier[] = ['hard', 'medium', 'easy']
const BAND = 0.05
const SPAN = 0.3

/** Solo workout player layout: header controls, big numbers, band gauge, charts, interval list and overlays. */
export function soloView(plan: Plan, ftp: number, tier: Tier, on: SoloHandlers, maxHr?: number) {
  const num = (label: string, cls = '') => {
    const v = h('b', {}, '–')
    return { v, el: h('div', { class: `sbig ${cls}` }, h('span', {}, label), v) }
  }
  const tgt = num('Target')
  const pow = num('Power · 3 s')
  const cad = num('Cadence')
  const hr = num('HR')
  const left = num('Interval left', 'clock')
  const unit = (n: { el: HTMLElement }, u: string) => n.el.append(h('small', {}, u))
  unit(tgt, 'W')
  unit(pow, 'W')
  unit(cad, 'rpm')
  unit(hr, 'bpm')
  const blockName = h('div', { class: 'blockname' })
  const next = h('div', { class: 'next' })
  left.el.append(next)
  left.el.prepend(blockName)

  const needle = h('i', { class: 'needle' })
  const dev = h('span', { class: 'dev' })
  const gauge = h(
    'div',
    { class: 'gauge' },
    h('div', {
      class: 'band',
      style: `left:${50 - (BAND / SPAN / 2) * 100}%;width:${(BAND / SPAN) * 100}%`,
    }),
    needle,
    h('span', { class: 'gl' }, `-${SPAN * 100}%`),
    h('span', { class: 'gc' }, 'on target'),
    h('span', { class: 'gr' }, `+${SPAN * 100}%`),
  )

  const main = workoutChart(ftp)
  const zoom = workoutChart(ftp, 60)
  let showCad = false
  let showHr = false
  const toggle = (label: string, on: (v: boolean) => void) => {
    let v = false
    const b = h(
      'button',
      { class: 'ghost', onclick: () => (on((v = !v)), b.classList.toggle('cad-on', v)) },
      label,
    )
    return b
  }
  const cadBtn = toggle('Cadence line', (v) => (showCad = v))
  const hrBtn = toggle('HR line', (v) => (showHr = v))
  const pauseBtn = h('button', { onclick: on.pause })
  const intens = h('b', { class: 'pct' }, '100%')
  const tierSel = h(
    'select',
    {
      onchange: (e: Event) => on.tier((e.target as HTMLSelectElement).value as Tier),
      title: 'Tier',
    },
    ...TIERS.map((t) => h('option', { value: t }, t)),
  )
  tierSel.value = tier
  const ov = h('div', { class: 'overlay' })
  const panel = soloPanel(plan, () => tierSel.value as Tier, ftp)
  const acts = soloActions()
  const kbd = (t: string) => h('kbd', {}, t)

  const root = h(
    'div',
    { class: `erg${plan.test ? ' testing' : ''}` },
    h(
      'header',
      { class: 'solo-head' },
      h('h1', {}, plan.name),
      h('label', { class: 'field' }, 'Tier', tierSel),
      h(
        'div',
        { class: 'field' },
        'Intensity',
        h(
          'div',
          { class: 'stepper' },
          h('button', { onclick: () => on.intensity(-0.01), title: 'Intensity down (-)' }, '−'),
          intens,
          h('button', { onclick: () => on.intensity(0.01), title: 'Intensity up (+)' }, '+'),
        ),
      ),
      h(
        'div',
        { class: 'ctl' },
        cadBtn,
        hrBtn,
        pauseBtn,
        h('button', { onclick: on.skip, title: 'Skip interval (→ or N)' }, 'Skip ', kbd('N')),
        h('button', { class: 'danger', onclick: () => confirmEnd() }, 'End ride'),
      ),
      acts.root,
    ),
    h(
      'section',
      { class: 'solo-main' },
      h('div', { class: 'bigrow' }, tgt.el, pow.el, cad.el, hr.el, left.el),
      h('div', { class: 'gwrap' }, gauge, dev),
      h('div', { class: 'chartbox main' }, main.el, ov),
      h(
        'div',
        { class: 'chartbox zoom' },
        h('span', { class: 'ctag' }, 'Current interval ±60 s'),
        zoom.el,
      ),
    ),
    panel.root,
  )

  let dialog = false
  let key = ''
  const say = (html: Node[] | null, cls = '') => {
    dialog = cls === 'dialog'
    key = ''
    ov.className = `overlay${html ? ` open ${cls}` : ''}`
    if (html) ov.replaceChildren(...html)
  }
  const confirmEnd = () =>
    say(
      [
        h(
          'div',
          { class: 'dlg' },
          h('h2', {}, 'End ride?'),
          h('p', { class: 'dim' }, 'Your ride so far will be saved.'),
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => say(null) }, 'Keep riding'),
            h('button', { class: 'primary', onclick: on.end }, 'End ride'),
          ),
        ),
      ],
      'dialog',
    )

  return {
    root,
    panel,
    /** Big centred message over the chart: countdown digit, sprint prompt, pause notice or grade splash. */
    overlay(big: string | null, sub = '', cls = '') {
      if (dialog || key === `${big}|${sub}|${cls}`) return
      const k = `${big}|${sub}|${cls}`
      say(
        big === null
          ? null
          : [h('div', { class: `ovbig ${cls}` }, big), h('div', { class: 'ovsub' }, sub)],
        cls,
      )
      key = k
    },
    confirmEnd,
    /** Modal question over the chart; resolves with the index of the button pressed. */
    prompt(title: string, lines: string[], buttons: string[]) {
      return new Promise<number>((res) =>
        say(
          [
            h(
              'div',
              { class: 'dlg' },
              h('h2', {}, title),
              ...lines.map((l) => h('p', { class: 'dim' }, l)),
              h(
                'div',
                { class: 'row' },
                ...buttons.map((b, n) =>
                  h('button', { class: n === 0 ? 'primary' : '', onclick: () => res(n) }, b),
                ),
              ),
            ),
          ],
          'dialog',
        ),
      )
    },
    frame(s: ViewState) {
      const { f, live } = s
      acts.set(s.actions)
      const t = f.tgt
      tgt.v.textContent = t == null ? (f.type === 'sprint' ? 'ALL OUT' : 'FREE') : String(t)
      tgt.el.classList.toggle('word', t == null)
      pow.v.textContent = String(Math.round(f.type === 'sprint' ? live.power : live.avg))
      cad.v.textContent = String(Math.round(live.cadence))
      hr.v.textContent = live.hr ? String(live.hr) : '–'
      hr.v.style.color = live.hr && maxHr ? (ZONE_COLOURS[hrZone(live.hr, maxHr)] ?? '') : ''
      left.v.textContent = fmt(f.dur - f.bel)
      blockName.textContent = f.label
      next.textContent = f.next
        ? `Next: ${f.next.label}${f.next.tgt ? ` @ ${f.next.tgt} W` : ''} in ${fmt(f.next.in)}`
        : 'Last interval'
      intens.textContent = `${Math.round(s.intensity * 100)}%`
      pauseBtn.replaceChildren(s.paused ? 'Resume ' : 'Pause ', kbd('Space'))
      root.classList.toggle('paused', !!s.paused)
      // gauge: needle position and colour from deviation against the target
      const d = t ? (live.avg - t) / t : 0
      gauge.classList.toggle('off', !t)
      needle.style.left = `${50 + (Math.max(-SPAN, Math.min(SPAN, d)) / SPAN) * 50}%`
      const a = Math.abs(d)
      needle.style.background = a <= BAND ? 'var(--tox)' : a <= 0.1 ? 'var(--acc)' : 'var(--bad)'
      pow.v.style.color = !t
        ? ''
        : a <= BAND
          ? 'var(--tox)'
          : a <= 0.1
            ? 'var(--acc)'
            : 'var(--bad)'
      dev.textContent = t ? `${live.avg - t >= 0 ? '+' : ''}${Math.round(live.avg - t)} W` : ''
      const segs = segsFromBlocks(plan.blocks, tierSel.value as Tier, ftp, s.intensity)
      const data = {
        gap: s.fast * 3 + 3,
        segs,
        total: s.total,
        power: s.power,
        xs: s.xs,
        cadence: s.cadence,
        hr: s.hr,
        now: f.el,
        showCadence: showCad,
        showHr,
      }
      main.set(data)
      zoom.set(data)
      panel.frame(f.i, s.intensity)
      panel.stats(s.stats)
    },
  }
}

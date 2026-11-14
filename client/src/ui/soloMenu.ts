import { TIER_NAME, TIERS, type Plan, type Tier } from '../types'
import { CFG } from '../config'
import { h } from './dom'
import { hudMenu } from './hudParts'
import { modeSwitch } from './soloMode'
import type { SoloHandlers, SoloPart } from './soloView'

/** A − value + stepper on glass, for the dock. */
const stepper = (down: () => void, up: () => void, titles: [string, string]) => {
  const val = h('b', { class: 'pct' }, '100%')
  const el = h(
    'div',
    { class: 'glass stepper' },
    h('button', { onclick: down, title: titles[0] }, '−'),
    val,
    h('button', { onclick: up, title: titles[1] }, '+'),
  )
  return { el, val }
}

/**
 * The solo player's controls: the ☰ menu (mode, tier, pause, skip, end, the view toggles, media, chart lines,
 * display size) and the two steppers that stay in the dock (intensity; level or gradient outside ERG).
 */
export function soloMenu(
  plan: Plan,
  tier: Tier,
  on: SoloHandlers,
  ui: { toggle: (p: SoloPart) => void; confirmEnd: () => void; media: () => void },
) {
  const m = hudMenu()
  const modes = modeSwitch({ set: on.mode, nudge: on.nudge })
  const intens = stepper(
    () => on.intensity(-0.01),
    () => on.intensity(0.01),
    ['Intensity down (-)', 'Intensity up (+)'],
  )
  intens.el.prepend(h('span', {}, 'Intensity'))
  const tierSel = h(
    'select',
    {
      onchange: (e: Event) => on.tier((e.target as HTMLSelectElement).value as Tier),
      title: 'Effort',
    },
    ...TIERS.map((t) =>
      h('option', { value: t }, `${TIER_NAME[t]} ${Math.round(CFG.tierFactor[t] * 100)}%`),
    ),
  )
  tierSel.value = tier
  const pauseBtn = h('button', { onclick: () => (m.close(), on.pause()) })
  const lines = { cadence: false, hr: false }
  const line = (label: string, k: keyof typeof lines) => {
    const b: HTMLElement = h(
      'button',
      { onclick: () => b.classList.toggle('on', (lines[k] = !lines[k])) },
      label,
    )
    return b
  }
  m.el.append(
    h('h2', {}, plan.name),
    modes.root,
    h('label', { class: 'tier' }, 'Effort', tierSel),
    m.grid(
      pauseBtn,
      m.item('Skip interval', 'N', on.skip),
      m.item('End ride', 'Esc', ui.confirmEnd, 'danger'),
      m.item('Stats', 'S', () => ui.toggle('stats')),
      m.item('Intervals', 'I', () => ui.toggle('riders')),
      m.item('Clean view', 'H', () => ui.toggle('clean')),
      m.item('Media', '', ui.media),
      line('Cadence line', 'cadence'),
      line('Heart rate line', 'hr'),
    ),
    m.size(),
  )
  return {
    menu: m,
    modes,
    intens,
    lines,
    tier: () => tierSel.value as Tier,
    paused: (p: boolean) => pauseBtn.replaceChildren(p ? 'Resume' : 'Pause', h('kbd', {}, 'Space')),
  }
}

import { isMine, myPlans, PLANS, removeMyPlan, saveMyPlan } from '../content'
import { importWorkout } from '../core/workoutImport'
import { blockTarget, parsePlan, planTotal } from '../core/plan'
import type { Block, Plan, Tier } from '../types'
import { h } from './dom'
import { DURATIONS, planFor } from './home'
import { planGraph, zoneColour } from './planGraph'
import { openBuilder } from './builder'
import { toast } from './toast'

export const isBusRun = (id: string) => id.startsWith('bus-')
const mid = (b: Block, tier: Tier = 'hard') => blockTarget(b, tier, b.dur / 2)
export const minsLabel = (blocks: Block[]) => `${Math.round(planTotal(blocks) / 60)} min`

/** Small badges derived from the blocks: intensity first, then what is in the plan. */
export function planTags(p: Plan): { t: string; c?: string }[] {
  const bl = p.blocks
  const work = bl.filter((b) => mid(b) != null)
  const wsum = work.reduce((s, b) => s + b.dur, 0) || 1
  const avg = work.reduce((s, b) => s + mid(b)! * b.dur, 0) / wsum
  // Fourth-power mean (like normalised power) so hard efforts count for more than easy time.
  const np = (work.reduce((s, b) => s + mid(b)! ** 4 * b.dur, 0) / wsum) ** 0.25
  const score = np + (bl.filter((b) => b.type === 'sprint').length >= 5 ? 0.1 : 0)
  const level = score < 0.7 ? 'Easy' : score < 0.85 ? 'Moderate' : score < 0.95 ? 'Hard' : 'Brutal'
  const tags: { t: string; c?: string }[] = [{ t: level, c: zoneColour(score + 0.05) }]
  const rb = bl.filter((b) => b.type === 'sprint').length
  if (rb) tags.push({ t: `${rb} roadblock${rb > 1 ? 's' : ''}` })
  const has = (lo: number, hi: number, dur: number) =>
    bl.some((b) => {
      const m = mid(b)
      return b.type !== 'over-under' && b.dur >= dur && m != null && m >= lo && m < hi
    })
  if (bl.some((b) => b.type === 'over-under')) tags.push({ t: 'over-unders' })
  if (has(0.84, 0.97, 300)) tags.push({ t: 'sweet spot' })
  if (has(0.97, 1.1, 180)) tags.push({ t: 'threshold' })
  if (has(1.1, 9, 60)) tags.push({ t: 'VO2' })
  if (has(0.75, 0.84, 300)) tags.push({ t: 'tempo' })
  if (avg < 0.7) tags.push({ t: 'endurance' })
  if (bl.some((b) => b.type === 'free')) tags.push({ t: 'servo stop' })
  return tags
}

export const tagEls = (p: Plan) =>
  planTags(p).map((x, i) =>
    h('span', { class: `tag${i ? '' : ' lvl'}`, style: x.c ? `--c:${x.c}` : undefined }, x.t),
  )

/** Watts for the plan's biggest block, e.g. "228–252 W". */
export function mainWatts(p: Plan, tier: Tier, ftp: number) {
  const long = p.blocks.filter((b) => mid(b) != null && b.dur >= 180)
  const b = long.sort((x, y) => mid(y)! * y.dur - mid(x)! * x.dur)[0]
  if (!b) return '–'
  const at = b.type === 'ramp' ? [0, b.dur] : b.type === 'over-under' ? [0, b.step!] : [0]
  const w = at.map((s) => Math.round(blockTarget(b, tier, s)! * ftp))
  return w[1] && w[1] !== w[0] ? `${Math.min(...w)}–${Math.max(...w)} W` : `${w[0]} W`
}

/** Goal groups in display order: [goal, title, note]. */
const GOALS = [
  ['bus', 'Bus runs', 'built for the game'],
  ['sweet-spot', 'Sweet spot', 'the bread and butter'],
  ['threshold', 'Threshold', 'at and around FTP'],
  ['vo2', 'VO2 max', 'short and savage'],
  ['sprint', 'Sprint', 'all-out and anaerobic'],
  ['tempo', 'Tempo', 'comfortably hard'],
  ['endurance', 'Endurance', 'long and steady'],
  ['recovery', 'Recovery', 'easy days'],
] as const

export interface PickerOpts {
  plan: string
  minutes: number
  /** Which group sits on top. */
  first?: 'bus' | 'workout'
  /** Show imported workouts and the import button (solo only). Needs the rider's FTP for .erg files. */
  mineFtp?: number
  onChange(plan: string, minutes: number): void
}

/** Plan cards in two groups plus length chips. `set()` moves the selection without firing `onChange`. */
export function planPicker(o: PickerOpts) {
  let { plan, minutes } = o
  const cards = new Map<
    string,
    { el: HTMLElement; gfx: HTMLElement; dur: HTMLElement; tags: HTMLElement }
  >()
  const card = (id: string) => {
    const raw = parsePlan(PLANS.find((p) => p.id === id))
    const gfx = h('div', { class: 'pg' })
    const dur = h('span', { class: 'dur' })
    const tags = h('div', { class: 'tags' })
    const el = h(
      'button',
      { class: 'plan-card', 'aria-pressed': 'false', onclick: () => pick(id, minutes) },
      gfx,
      h('div', { class: 'ttl' }, h('b', {}, raw.name), dur),
      h('p', {}, raw.desc ?? ''),
      tags,
      h('span', { class: 'tick' }, '✓'),
    )
    cards.set(id, { el, gfx, dur, tags })
    return el
  }
  const paint = () => {
    for (const [id, c] of cards) {
      const on = id === plan
      c.el.classList.toggle('on', on)
      c.el.setAttribute('aria-pressed', String(on))
      const p = planFor(id, minutes)
      c.tags.replaceChildren(...tagEls(p))
      c.gfx.replaceChildren(planGraph(p.blocks))
      c.dur.textContent = minsLabel(p.blocks)
    }
    chips.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', +b.dataset.m! === minutes)
      b.setAttribute('aria-checked', String(+b.dataset.m! === minutes))
    })
  }
  const pick = (id: string, m: number) => {
    plan = id
    minutes = m
    paint()
    o.onChange(id, m)
  }
  const chips = h(
    'div',
    { class: 'chips', role: 'radiogroup', 'aria-label': 'Length' },
    ...DURATIONS.map((m) =>
      h(
        'button',
        { class: 'chip-sel', role: 'radio', 'data-m': m, onclick: () => pick(plan, m) },
        m ? `${m} min` : 'As written',
      ),
    ),
  )
  const group = (title: string, note: string, ids: string[]) =>
    h(
      'section',
      { class: 'pp-group' },
      h('h3', { class: 'label' }, title, h('small', {}, note)),
      h('div', { class: 'pp-grid' }, ...ids.map(card)),
    )
  const ids = PLANS.filter((p) => p.goal !== 'test' && !isMine(p.id)).map((p) => p.id)
  const goalOf = (id: string) =>
    isMine(id) ? 'mine' : (PLANS.find((p) => p.id === id)?.goal ?? 'endurance')
  const order = o.first === 'workout' ? [...GOALS.slice(1), GOALS[0]] : GOALS
  const groups = new Map(
    order.map(
      ([g, title, note]) =>
        [
          g,
          group(
            title,
            note,
            ids.filter((i) => goalOf(i) === g),
          ),
        ] as const,
    ),
  )
  let filter = goalOf(plan) === 'mine' ? 'all' : goalOf(plan)
  const filterChips = h(
    'div',
    { class: 'chips', role: 'radiogroup', 'aria-label': 'Goal' },
    ...[['all', 'All'] as const, ...order].map(([g, title]) =>
      h(
        'button',
        {
          class: 'chip-sel',
          role: 'radio',
          'data-g': g,
          onclick: () => ((filter = g), showGroups()),
        },
        title,
      ),
    ),
  )
  const showGroups = () => {
    for (const [g, sec] of groups) sec.hidden = filter !== 'all' && filter !== g
    filterChips
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', b.dataset.g === filter))
  }
  showGroups()
  const mineGrid = h('div', { class: 'pp-grid' })
  const file = h('input', { type: 'file', accept: '.zwo,.erg,.mrc', hidden: true })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    file.value = ''
    if (!f) return
    try {
      const p = importWorkout(f.name, await f.text(), o.mineFtp ?? 200)
      saveMyPlan(p)
      fillMine()
      pick(p.id, 0)
      toast(`Imported ${p.name}`, 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  })
  const built = (p: Plan) => {
    fillMine()
    pick(p.id, 0)
  }
  const fillMine = () => {
    for (const id of [...cards.keys()].filter(isMine)) cards.delete(id)
    mineGrid.replaceChildren(
      ...myPlans().map((p) => {
        const c = card(p.id)
        const x = h('span', { class: 'pp-del', title: 'Remove', role: 'button' }, '✕')
        x.addEventListener('click', (e) => {
          e.stopPropagation()
          removeMyPlan(p.id)
          fillMine()
          if (plan === p.id) pick(ids[0], minutes)
          else paint()
        })
        const ed = h('span', { class: 'pp-del pp-edit', title: 'Edit', role: 'button' }, '✎')
        ed.addEventListener('click', (e) => {
          e.stopPropagation()
          if (p.edit) openBuilder(p, built)
          else toast('Only workouts from the builder can be edited', 'bad')
        })
        c.append(ed, x)
        return c
      }),
      h(
        'button',
        { class: 'plan-card pp-import', onclick: () => openBuilder(null, built) },
        h('b', {}, '+ Build workout'),
        h('p', {}, 'drag and drop your own'),
      ),
      h(
        'button',
        { class: 'plan-card pp-import', onclick: () => file.click() },
        h('b', {}, '+ Import workout'),
        h('p', {}, '.zwo, .erg or .mrc file'),
      ),
    )
  }
  const mine = h(
    'section',
    { class: 'pp-group' },
    h('h3', { class: 'label' }, 'My workouts', h('small', {}, 'built or imported, solo only')),
    mineGrid,
    file,
  )
  if (o.mineFtp) fillMine()
  const el = h(
    'div',
    { class: 'picker' },
    h('div', { class: 'pp-len' }, h('span', { class: 'label' }, 'Length'), chips),
    h('div', { class: 'pp-len' }, h('span', { class: 'label' }, 'Goal'), filterChips),
    ...groups.values(),
    ...(o.mineFtp ? [mine] : []),
  )
  paint()
  return Object.assign(el, {
    set(id: string, m: number) {
      if (id === plan && m === minutes) return
      if (id !== plan && goalOf(id) !== 'mine' && filter !== 'all') filter = goalOf(id)
      plan = id
      minutes = m
      showGroups()
      paint()
    },
  })
}

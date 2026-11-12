import { CFG } from '../config'
import { blockTarget, planTotal } from '../core/plan'
import type { Profile } from '../core/curve'
import { TIERS, type Block, type Plan, type Tier } from '../types'
import { fmt, h, seg } from './dom'
import { planFor, type HomeActions } from './home'
import { planGraph } from './planGraph'
import { mainWatts, minsLabel, planPicker, tagEls } from './planPicker'
import { needTrainer } from './trainer'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const same = (a: Block, b: Block) => JSON.stringify(a) === JSON.stringify(b)

/** Collapses repeated runs of 1-4 blocks (the flattened sets) into "3 ×" groups. */
function groups(bl: Block[]) {
  const out: { rep: number; blocks: Block[] }[] = []
  for (let i = 0; i < bl.length;) {
    let best = { rep: 1, p: 1 }
    for (let p = 1; p <= 4 && i + 2 * p <= bl.length; p++) {
      let k = 1
      while (
        i + (k + 1) * p <= bl.length &&
        bl.slice(i, i + p).every((b, j) => same(b, bl[i + k * p + j]))
      )
        k++
      if (k > 1 && k * p > best.rep * best.p) best = { rep: k, p }
    }
    out.push({ rep: best.rep, blocks: bl.slice(i, i + best.p) })
    i += best.rep * best.p
  }
  return out
}

export function blockWatts(b: Block, tier: Tier, ftp: number) {
  if (b.type === 'sprint') return 'all out'
  if (b.type === 'free') return 'free ride'
  const at = b.type === 'ramp' ? [0, b.dur] : b.type === 'over-under' ? [0, b.step!] : [0]
  const w = at.map((s) => Math.round(blockTarget(b, tier, s)! * ftp))
  return w[1] && w[1] !== w[0] ? `${w[0]}–${w[1]} W` : `${w[0]} W`
}

function blockList(plan: Plan, tier: Tier, ftp: number) {
  const row = (b: Block) =>
    h(
      'li',
      { class: `blk ${b.type}` },
      h('span', {}, b.label ?? cap(b.type)),
      h('span', { class: 'bd' }, fmt(b.dur)),
      h('span', { class: 'bw' }, blockWatts(b, tier, ftp)),
    )
  return h(
    'ol',
    { class: 'blocks' },
    ...groups(plan.blocks).flatMap((g) =>
      g.rep > 1
        ? [h('li', { class: 'rep' }, `${g.rep} ×`), ...g.blocks.map((b) => row(b))]
        : g.blocks.map(row),
    ),
  )
}

/** Solo workout setup: pick a plan, pick a tier, see what you are in for, go. */
export function soloSetup(p: Profile, act: HomeActions, back: () => void) {
  let id = 'ss-2x15'
  let minutes = 0
  let tier = p.tier
  const summary = h('section', { class: 'panel summary' })
  const startLabel = h('span', { class: 'sb-what' })
  const watts = h('b', {})
  const tierSeg = seg(
    TIERS.map((t) => [
      t,
      h('span', {}, h('b', {}, cap(t)), h('small', {}, `${Math.round(CFG.tierFactor[t] * 100)}%`)),
    ]),
    tier,
    (t) => ((tier = t), paint()),
    'tiers',
  )
  const paint = () => {
    const plan = planFor(id, minutes)
    watts.textContent = mainWatts(plan, tier, p.ftp)
    startLabel.replaceChildren(h('b', {}, plan.name), ` · ${minsLabel(plan.blocks)} · ${cap(tier)}`)
    summary.replaceChildren(
      h('h2', { class: 'label' }, 'Your ride'),
      h(
        'div',
        { class: 'sum-top' },
        h('h3', {}, plan.name),
        h('div', { class: 'tags' }, ...tagEls(plan)),
      ),
      planGraph(plan.blocks, tier),
      h(
        'div',
        { class: 'sum-stats' },
        h('div', {}, h('b', {}, fmt(planTotal(plan.blocks))), h('span', {}, 'total time')),
        h('div', {}, watts, h('span', {}, `main block at ${p.ftp} W FTP`)),
      ),
      blockList(plan, tier, p.ftp),
    )
    for (const t of TIERS) {
      const w = mainWatts(plan, t, p.ftp)
      tierSeg.querySelector(`[data-v=${t}] small`)!.textContent = w
    }
  }
  const picker = planPicker({
    plan: id,
    minutes,
    first: 'workout',
    onChange: (i, m) => ((id = i), (minutes = m), paint()),
  })
  paint()
  return h(
    'div',
    { class: 'solo-setup' },
    h('button', { class: 'back', onclick: back }, '← Back'),
    h('h1', {}, 'Solo workout'),
    h(
      'p',
      { class: 'lede' },
      'Just you and the plan, no bus. Good for training or testing a trainer.',
    ),
    h(
      'div',
      { class: 'setup-cols' },
      h('div', {}, picker),
      h(
        'aside',
        {},
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'Effort'),
          tierSeg,
          h('p', { class: 'dim' }, 'Watts are for the biggest block, at your FTP.'),
        ),
        summary,
      ),
    ),
    h(
      'div',
      { class: 'startbar' },
      startLabel,
      h(
        'button',
        {
          class: 'primary go',
          onclick: needTrainer(() => ((p.tier = tier), act.drill(planFor(id, minutes)))),
        },
        'Start',
      ),
    ),
  )
}

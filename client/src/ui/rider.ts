import { CFG } from '../config'
import { curves, ftpSuggestion, type Point, type Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { TIERS, type Tier } from '../types'
import { h } from './dom'
import { setSimFtp } from './trainer'

const TIER_HELP: Record<Tier, string> = {
  hard: 'Full targets, the plan as written.',
  medium: `Targets at ${CFG.tierFactor.medium * 100}%. Still a proper workout.`,
  easy: `Targets at ${CFG.tierFactor.easy * 100}%. Recovery day or new to the bike.`,
}
const dur = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`)
const cell = (p: Point) =>
  h(
    'td',
    { class: p.real ? 'real' : 'est', title: p.real ? 'From your rides' : 'Estimated from FTP' },
    `${p.w} W`,
  )

/** FTP, default tier, lifetime stats and the power curve. */
export function riderTab(p: Profile) {
  const save = () => {
    saveProfile(p)
    setSimFtp(p.ftp)
  }
  const ftp = h('input', { type: 'number', value: p.ftp, min: 50, max: 600, inputmode: 'numeric' })
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
    p.ftp = Math.max(50, Math.min(600, Math.round(+ftp.value) || 200))
    ftp.value = String(p.ftp)
    save()
    suggest()
  }
  ftp.addEventListener('change', setFtp)
  suggest()
  const help = h('p', { class: 'dim' })
  const seg = h('div', { class: 'seg', role: 'radiogroup' })
  const tiers = () => {
    help.textContent = TIER_HELP[p.tier]
    seg.replaceChildren(
      ...TIERS.map((t) =>
        h(
          'button',
          {
            role: 'radio',
            'aria-checked': String(t === p.tier),
            class: t === p.tier ? 'on' : '',
            onclick: () => ((p.tier = t), save(), tiers()),
          },
          t[0].toUpperCase() + t.slice(1),
        ),
      ),
    )
  }
  tiers()
  const s = p.stats
  const stat = (v: string | number, l: string) =>
    h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l))
  const c = curves(p)
  return h(
    'div',
    { class: 'rider' },
    h('h1', {}, p.name),
    h(
      'div',
      { class: 'cols' },
      h(
        'div',
        {},
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'FTP'),
          h('label', { class: 'ftp' }, ftp, h('span', {}, 'W')),
          h('p', { class: 'dim' }, 'Every target is a percentage of this. Too hard? Lower it.'),
          tip,
        ),
        h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Default tier'), seg, help),
        h(
          'section',
          { class: 'panel stats' },
          stat(s.rides, 'rides'),
          stat(Math.round(s.secs / 360) / 10, 'hours'),
          stat(s.kj.toLocaleString('en-AU'), 'kJ'),
          stat(s.streak, s.streak === 1 ? 'week streak' : 'weeks streak'),
        ),
      ),
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'label' }, 'Power curve'),
        h(
          'table',
          { class: 'curve' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Best'), h('th', {}, 'All time'), h('th', {}, 'Last 90 days')),
          ),
          h(
            'tbody',
            {},
            ...CFG.curveDurations.map((d) =>
              h('tr', {}, h('th', {}, dur(d)), cell(c.allTime[d]), cell(c.d90[d])),
            ),
          ),
        ),
        h(
          'p',
          { class: 'dim legend' },
          h('span', { class: 'real' }, 'Bold'),
          ' from your rides, ',
          h('span', { class: 'est' }, 'grey'),
          ' estimated from FTP.',
        ),
      ),
    ),
  )
}

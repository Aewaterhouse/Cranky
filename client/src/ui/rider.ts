import { CFG } from '../config'
import { curves, ftpSuggestion, type Point, type Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { TIERS, type Tier } from '../types'
import { avatar, h, seg } from './dom'
import { curveChart, dur, history, zoneBar } from './riderStats'
import { setSimFtp } from './trainer'

const TIER_HELP: Record<Tier, string> = {
  hard: 'Full targets, the plan as written.',
  medium: `Targets at ${CFG.tierFactor.medium * 100}%. Still a proper workout.`,
  easy: `Targets at ${CFG.tierFactor.easy * 100}%. Recovery day or new to the bike.`,
}
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
  const maxHr = h('input', {
    type: 'number',
    value: p.maxHr ?? '',
    min: 100,
    max: 230,
    placeholder: 'optional',
    inputmode: 'numeric',
  })
  maxHr.addEventListener('change', () => {
    const v = Math.round(+maxHr.value)
    p.maxHr = v >= 100 && v <= 230 ? v : undefined
    maxHr.value = p.maxHr ? String(p.maxHr) : ''
    save()
  })
  suggest()
  const help = h('p', { class: 'dim' })
  const tiers = seg(
    TIERS.map((t) => [t, t[0].toUpperCase() + t.slice(1)]),
    p.tier,
    (t) => ((p.tier = t), save(), (help.textContent = TIER_HELP[t])),
  )
  help.textContent = TIER_HELP[p.tier]
  const s = p.stats
  const stat = (v: string | number, l: string) =>
    h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, l))
  const c = curves(p)
  return h(
    'div',
    { class: 'rider' },
    h(
      'header',
      { class: 'rider-head' },
      avatar(p.name, 'xl'),
      h(
        'div',
        {},
        h('h1', {}, p.name),
        h('p', { class: 'dim' }, `FTP ${p.ftp} W · ${p.tier} tier`),
      ),
    ),
    h(
      'section',
      { class: 'panel stats' },
      stat(s.rides, 'rides'),
      stat(Math.round(s.secs / 360) / 10, 'hours'),
      stat(s.kj.toLocaleString('en-AU'), 'kJ'),
      stat(s.streak, s.streak === 1 ? 'week streak' : 'weeks streak'),
    ),
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
        h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Default tier'), tiers, help),
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'Max heart rate'),
          h('label', { class: 'ftp' }, maxHr, h('span', {}, 'bpm')),
          h('p', { class: 'dim' }, 'Optional. Colours your heart rate by zone in the solo player.'),
        ),
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'Time in zone'),
          zoneBar(s.zones),
        ),
      ),
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'label' }, 'Power curve'),
        curveChart(c.allTime, c.d90),
        h(
          'p',
          { class: 'dim legend' },
          h('i', { class: 'key all' }),
          'All time ',
          h('i', { class: 'key d90' }),
          'Last 90 days',
        ),
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
    h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Recent rides'), history(p)),
  )
}

import './style.css'
import './screens.css'
import { frameAt } from './core/plan'
import { GAME_UI } from './modes/crew/gameUi'
import type { AmboState, Ask, BusState, Game, RiderTick, Tick } from './net/protocol'
import { World } from './scene/world'
import type { Plan } from './types'
import { h } from './ui/dom'
import { makeHud } from './ui/hud'

/**
 * Dev page: a crew game's HUD over its scene, fed made-up ticks (no server). Params: `game=ambo`,
 * `state=run|event|siren|me|brake|ramp|reverse|base|cool`, `ask=1` (a question sheet), `fx=delivered|fellout|walked|review`.
 */
const q = new URLSearchParams(location.search)
const game = (q.get('game') ?? 'ambo') as Game
const state = q.get('state') ?? 'run'
const ui = GAME_UI[game]
const stage = h('div', { class: 'stage' })
document.getElementById('app')!.append(stage)
const world = new World(stage)
const plan: Plan = {
  id: 'dev',
  name: 'Dev',
  blocks: [
    { type: 'free', dur: 360, label: 'Base station' },
    { type: 'free', dur: 300, label: 'Run 1: Kidney Stone' },
    { type: 'free', dur: 90, label: 'Hospital ramping' },
    { type: 'free', dur: 300, label: 'Run 2: Wheelie Bin Jump' },
    { type: 'free', dur: 240, label: 'Drive home' },
  ],
}
const hud = makeHud(
  () => {},
  () => {},
  {
    plan,
    meId: 'a',
    weightKg: 75,
    game,
    panel: ui?.panel(),
    events: ui?.events,
    onAct: (k, v) => hud.toast(`act ${k} = ${v}`),
  },
)
stage.append(hud.root)

const phase =
  (
    { ramp: 'ramp', reverse: 'reverse', base: 'base', cool: 'cool' } as Record<
      string,
      AmboState['phase']
    >
  )[state] ?? 'run'
const EVENTS: Record<string, AmboState['event']> = {
  event: {
    k: 'green',
    name: 'Green light wave',
    text: 'Everyone over 95% or you miss it.',
    left: 14,
  },
  siren: {
    k: 'siren',
    name: "Somebody won't pull over",
    text: 'Sprint! The rest hold steady.',
    left: 8,
    who: 'b',
  },
  me: {
    k: 'siren',
    name: "Somebody won't pull over",
    text: 'Sprint! The rest hold steady.',
    left: 8,
    who: 'a',
  },
}
const ambo = (t: number): AmboState => ({
  g: 'ambo',
  phase,
  run: 2,
  runs: 5,
  patient:
    phase === 'base' || phase === 'cool'
      ? null
      : {
          id: 'stone',
          name: 'Kidney Stone',
          icon: '😖',
          line: 'Every. Single. Bump. I felt that one in my teeth.',
        },
  comfort: 55 + Math.sin(t / 3) * 40,
  dist: 2600 - ((t * 9) % 2600),
  total: 2600,
  speed: 31,
  par: 200,
  eta: 188,
  event: EVENTS[state] ?? null,
  brake: state === 'brake',
  perk: state === 'run' ? 'spike' : null,
  sweet: (t / 20) % 1,
  reviews: [
    {
      patient: 'Fishing Hook in Thumb',
      icon: '🎣',
      stars: 4,
      text: 'Driver let me finish the story about the flathead.',
    },
  ],
  score: 312,
  siren: EVENTS[state]?.who ?? null,
})
const ask: Ask = {
  k: 'fuel',
  title: 'Pick your fuel for the 1990s',
  sub: 'Leaving coal costs coins.',
  left: 22,
  v: 'coal',
  opts: [
    { v: 'coal', icon: '🏭', label: 'Coal', sub: 'Any power earns. Filthy.' },
    { v: 'gas', icon: '🔥', label: 'Gas', sub: 'Surges pay a bonus. 20 coins' },
    { v: 'solar', icon: '☀️', label: 'Solar', sub: 'Only 85 to 90%. 40 coins' },
    { v: 'wind', icon: '🌬️', label: 'Wind', sub: 'Gusts only. 50 coins', off: true },
  ],
}
const rider = (name: string, w: number, extra: Partial<RiderTick> = {}): RiderTick => ({
  name,
  tier: 'hard',
  tgt: 213,
  w,
  cad: 88,
  s: 0.9,
  st: 'riding',
  band: [200, 225],
  ...extra,
})
const bus = {
  speed: 9,
  dist: 4200,
  armour: 100,
  gap: 0,
  scrap: 0,
  rb: null,
  streak: 0,
  next: 'drop',
} as BusState
const t0 = performance.now()
let fired = false
const el0 = { base: 60, run: 480, ramp: 700, cool: 1100 }[phase as string] ?? 480
setInterval(() => {
  const t = (performance.now() - t0) / 1000
  const fx =
    !fired && q.has('fx') && t > 1.5
      ? [{ k: q.get('fx')!, text: 'One star. Would not ride again.' }]
      : []
  fired ||= fx.length > 0
  const m: Tick = {
    t: 'tick',
    el: el0 + t,
    i: 1,
    bel: t,
    ev: phase,
    riders: {
      a: rider('Alex', 215, {
        ask: q.has('ask') ? ask : null,
        band: state === 'me' ? 'sprint' : [200, 225],
      }),
      b: rider('Mo', 198),
      c: rider('Kat', 240, { s: 0.5 }),
      d: rider('Bot Baz', 205),
    },
    bus,
    fx,
    game: { ...ambo(t) },
  }
  const f = frameAt(plan.blocks, m.el, 'hard', 250)
  const me = m.riders.a
  const live = { power: 215, cadence: 88, avg: 213, c: 1, band: true, hr: 148 }
  if (f) {
    const b = me.band
    hud.frame(
      { ...f, tgt: b === 'sprint' ? null : 213, band: b === 'free' ? undefined : (b ?? undefined) },
      live,
      1290,
      m.ev,
    )
  }
  hud.tick(m)
  world.state = {
    speed: 9,
    gap: null,
    armour: null,
    mood: 'longhaul',
    roadblock: null,
    riders: Object.entries(m.riders).map(([id, r]) => ({
      id,
      name: r.name,
      c: r.s,
      st: r.st,
      cadence: r.cad,
    })),
    ...ui?.scene(m),
  }
}, 500)

import '../solo.css'
import '../freeride.css'
import '../freeHud.css'
import '../freeHudDock.css'
import '../freeHudSeg.css'
import { CFG } from '../config'
import type { ListRider } from '../core/hud'
import type { LapInfo } from '../core/laps'
import { routeStats, type Route } from '../core/route'
import type { SegBoard, SegLive } from '../modes/freeRide/segmentRun'
import type { Live } from '../modes/rideController'
import { h } from './dom'
import { freeRideFlat } from './freeRideFlat'
import { freeRideHud } from './freeRideHud'

export interface FreeHandlers {
  pause: () => void
  end: () => void
  /** Trainer difficulty, 0..1. */
  difficulty: (v: number) => void
}

export interface FreeState {
  live: Live
  /** m/s */
  speed: number
  grade: number
  trainerGrade: number
  /** Virtual gear, and whether the rider is using the gears (so the chip is worth showing). */
  gear: number
  gears: boolean
  dist: number
  el: number
  paused: 'manual' | 'auto' | null
  /** Waiting for the first pedal stroke. */
  starting: boolean
  avgPower: number
  np: number
  ftp: number
  weightKg: number
  /** Seconds to the finish at the average speed so far. */
  etaS: number
  /** Everyone on the road, me included. */
  riders: ListRider[]
  me: string
  /** Lap rides only. */
  lap?: LapInfo
  /** The climb or sprint segment being ridden or coming up, and the splits for the whole route or lap. */
  seg?: SegLive
  whole?: string[]
  /** The top three of that segment (of the whole route or lap between segments). */
  board?: SegBoard
  /** Headwind in m/s (a tailwind is negative), when the wind setting is on. */
  wind?: number
  /** Group rides: watts saved by drafting right now, and the keep-together scale on my speed (1 is none). */
  group?: { draftW: number; band: number }
  /** Group rides: a big line and a small one over the view (the countdown, waiting at the finish). */
  banner?: [string, string]
}

/** HUD parts that can be switched on and off. */
export type FreePart = 'clean' | 'stats' | 'map' | 'riders'

/** What a layout is handed, and what it gives back. */
export interface FreeParts {
  route: Route
  on: FreeHandlers
  difficulty: number
  mapBox: HTMLElement
  ov: HTMLElement
  toggle: (part: FreePart) => void
  confirmEnd: () => void
}
export interface FreeLayout {
  el: HTMLElement
  frame(s: FreeState): void
  setDifficulty(v: number): void
}

/**
 * Free ride player. With `world` it is a HUD over the 3D scene, which is drawn into `stage`; otherwise (or after
 * `flat()`) the flat layout of tiles, profiles and map. Both share the map, the pause overlay and the toasts.
 */
export function freeRideView(route: Route, on: FreeHandlers, difficulty: number, world = false) {
  const stage = h('div', { class: 'fr-stage' })
  const mapBox = h('div', { class: 'fr-map' })
  mapBox.hidden = true
  let mapUpdate: ((d: number, others: number[]) => void) | undefined
  // The map is optional: no coordinates, no network or a failed load all leave the panel hidden.
  if (routeStats(route).hasMap && navigator.onLine)
    void import('./freeRideMap')
      .then((m) => {
        const r = m.routeMap(mapBox, route)
        mapBox.hidden = false
        r.resize()
        new ResizeObserver(r.resize).observe(mapBox)
        mapUpdate = r.update
      })
      .catch(() => {
        mapBox.hidden = true
      })

  const ov = h('div', { class: 'overlay' })
  let dialog = false
  const say = (nodes: Node[] | null, cls = '') => {
    dialog = cls === 'dialog'
    ov.className = `overlay${nodes ? ` open ${cls}` : ''}`
    if (nodes) ov.replaceChildren(...nodes)
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
            h('button', { onclick: () => (delete ov.dataset.k, say(null)) }, 'Keep riding'),
            h('button', { class: 'primary', onclick: on.end }, 'End ride'),
          ),
        ),
      ],
      'dialog',
    )

  const toastBox = h('div', { class: 'fr-toast', role: 'status' })
  let toastTimer = 0
  let fanfareUntil = 0
  const toast = (text: string, secs = CFG.hud.toastS) => {
    // A fanfare (a PR) holds the stage: a passing remark does not talk over it.
    const big = secs > CFG.hud.toastS
    if (!big && performance.now() < fanfareUntil) return
    fanfareUntil = big ? performance.now() + secs * 1000 : 0
    toastBox.textContent = text
    toastBox.classList.add('on')
    toastBox.classList.toggle('big', big)
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toastBox.classList.remove('on'), secs * 1000)
  }

  // Each part is a class on the root; a phone starts without the map and the rider list.
  const phone = matchMedia(`(max-height: ${CFG.hud.phoneMaxH}px)`).matches
  const toggle = (part: FreePart) => root.classList.toggle(`hud-${part}`)
  const parts: FreeParts = { route, on, difficulty, mapBox, ov, toggle, confirmEnd }
  let layout = world ? freeRideHud(parts) : freeRideFlat(parts)
  const root = h(
    'div',
    { class: `fr${world ? ' fr3d' : ''}${phone ? '' : ' hud-map hud-riders'}` },
    stage,
    layout.el,
    toastBox,
  )
  if (world) root.append(ov)
  // In clean view a tap anywhere brings the HUD back (there is no H key on a phone).
  stage.addEventListener('click', () => root.classList.remove('hud-clean'))

  return {
    root,
    stage,
    /** Drops back to the flat layout (no WebGL, or the scene failed to start). */
    flat() {
      if (!root.classList.contains('fr3d')) return
      root.classList.remove('fr3d')
      const f = freeRideFlat(parts)
      layout.el.replaceWith(f.el)
      layout = f
    },
    confirmEnd,
    toggle,
    /** A short message, top centre, gone after a few seconds (`secs` to hold a fanfare longer). */
    toast,
    setDifficulty(v: number) {
      parts.difficulty = v
      layout.setDifficulty(v)
    },
    frame(s: FreeState) {
      layout.frame(s)
      mapUpdate?.(
        s.dist,
        s.riders.filter((r) => r.id !== s.me).map((r) => r.d),
      )
      root.classList.toggle('paused', !!s.paused)
      if (dialog) return
      const msg = s.banner
        ? [...s.banner, 'count']
        : s.starting
          ? ['Start pedalling', 'The clock starts when you do', 'count']
          : s.paused === 'manual'
            ? ['Paused', 'Press Space to carry on', 'pause']
            : s.paused === 'auto'
              ? ['Auto-paused', 'Keep pedalling to carry on', 'pause']
              : null
      const key = msg?.join('|') ?? ''
      if (ov.dataset.k === key) return
      ov.dataset.k = key
      say(
        msg && [
          h('div', { class: `ovbig ${msg[2]}` }, msg[0]),
          h('div', { class: 'ovsub' }, msg[1]),
        ],
        msg?.[2],
      )
    },
  }
}

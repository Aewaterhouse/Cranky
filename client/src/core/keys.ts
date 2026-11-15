/**
 * The rider's ride keys: every keyboard action, its default keys (up to two) and the rider's own choice, saved on
 * this device. A key belongs to one action wherever both could fire, so one press does one thing: actions only
 * share a key when they live in different ride screens. The simulator's keys work in every screen.
 */

export type Scope = 'solo' | 'free' | 'bus' | 'sim'
type Def = { label: string; group: string; scope: Scope[]; keys: string[] }

const RIDE: Scope[] = ['solo', 'free', 'bus']
const def = (group: string, scope: Scope[], label: string, ...keys: string[]): Def => ({
  label,
  group,
  scope,
  keys,
})
const all = (label: string, ...keys: string[]) => def('Every ride', RIDE, label, ...keys)
const solo = (label: string, ...keys: string[]) => def('Solo workout', ['solo'], label, ...keys)
const sim = (label: string, ...keys: string[]) => def('Simulator', ['sim'], label, ...keys)

export const ACTIONS = {
  gearUp: all('Gear harder', 'ArrowUp', 'x'),
  gearDown: all('Gear easier', 'ArrowDown', 'z'),
  strengthUp: all('Shift strength up', "'"),
  strengthDown: all('Shift strength down', ';'),
  stats: all('Stats', 's', 'Tab'),
  clean: all('Clean view', 'h'),
  erg: def('Every ride', ['solo', 'bus'], 'ERG (solo: ERG mode; crew games: on or off)', 'e'),
  pause: def('Solo and free ride', ['solo', 'free'], 'Pause or resume', ' ', 'p'),
  end: def('Solo and free ride', ['solo', 'free'], 'End the ride', 'Escape'),
  intensityUp: def(
    'Solo and free ride',
    ['solo', 'free'],
    'Intensity up (free ride: difficulty)',
    '+',
    '=',
  ),
  intensityDown: def(
    'Solo and free ride',
    ['solo', 'free'],
    'Intensity down (free ride: difficulty)',
    '-',
    '_',
  ),
  camera: def('Free ride and crew games', ['free', 'bus'], 'Camera view', 'c'),
  riders: def('Free ride and crew games', ['free', 'bus'], 'Rider list', 'r'),
  cards: def('Free ride and crew games', ['free', 'bus'], 'Open every crew card', 'd'),
  map: def('Free ride and crew games', ['free'], 'Map (free ride)', 'm'),
  skip: solo('Skip interval', 'n', 'ArrowRight'),
  levelUp: solo('Level or gradient up', '.'),
  levelDown: solo('Level or gradient down', ','),
  modeRes: solo('Resistance mode', 'r'),
  modeSlope: solo('Slope mode', 'g'),
  intervals: solo('Interval list', 'i'),
  simUp: sim('Power +10 W', 'PageUp'),
  simDown: sim('Power −10 W', 'PageDown'),
  simCadUp: sim('Cadence +2 rpm', 'End'),
  simCadDown: sim('Cadence −2 rpm', 'Home'),
  simEffortUp: sim('How well it follows ERG +0.05', ']'),
  simEffortDown: sim('How well it follows ERG −0.05', '['),
  simSprint: sim('Sprint: 300% FTP', 'q'),
  simEasy: sim('Easy: 60% FTP', 'a'),
} satisfies Record<string, Def>

export type ActionId = keyof typeof ACTIONS
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]
export const MAX_KEYS = 2
const STORE = 'cranky.keys'

let map: Record<ActionId, string[]> | null = null
const defaults = () =>
  Object.fromEntries(ACTION_IDS.map((id) => [id, [...ACTIONS[id].keys]])) as Record<
    ActionId,
    string[]
  >

/** Reads this device's keys (the defaults for anything not set, or if storage is out of reach). */
export function reloadKeys() {
  map = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown>
    for (const id of ACTION_IDS) {
      const v = saved[id]
      if (Array.isArray(v)) map[id] = v.filter((k) => typeof k === 'string').slice(0, MAX_KEYS)
    }
  } catch {
    /* defaults */
  }
  return map
}
const keys = () => map ?? reloadKeys()
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(keys()))
  } catch {
    /* kept for this visit only */
  }
}

export const keysOf = (id: ActionId): readonly string[] => keys()[id]

/** A key as the bindings store it: one character in lower case (so Shift does not matter), else its name. */
export const keyOf = (e: { key: string }) =>
  e.key === 'Spacebar' ? ' ' : e.key.length === 1 ? e.key.toLowerCase() : e.key

const NAMES: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Escape: 'Esc',
}
export const keyLabel = (k: string) => NAMES[k] ?? (k.length === 1 ? k.toUpperCase() : k)

/** An action's keys for a hint, e.g. "↑ X" (`n` keys at most), or '' when it has none. */
export const keyHint = (id: ActionId, n = MAX_KEYS) =>
  keysOf(id).slice(0, n).map(keyLabel).join(' ')

/** A button's title with the action's first key, e.g. "Camera view (C)", or the bare label when it has none. */
export const withKey = (label: string, id: ActionId) => {
  const k = keyHint(id, 1)
  return k ? `${label} (${k})` : label
}

/** "Tap Resume or press Space", without the key if the rider has none for pausing. */
export const resumeHint = () =>
  `Tap Resume${keyHint('pause', 1) ? ` or press ${keyHint('pause', 1)}` : ''}`

/** Whether two actions can fire in the same screen (the simulator's keys fire in all of them). */
export const overlaps = (a: ActionId, b: ActionId) => {
  const x = ACTIONS[a].scope as Scope[]
  const y = ACTIONS[b].scope as Scope[]
  return x.includes('sim') || y.includes('sim') || x.some((s) => y.includes(s))
}

/** Another action this key would also fire, with the slot it sits in, or null. */
export function clashOf(id: ActionId, key: string) {
  for (const other of ACTION_IDS) {
    const slot = keys()[other].indexOf(key)
    if (other !== id && slot >= 0 && overlaps(id, other)) return { id: other, slot }
  }
  return null
}

/**
 * Puts `key` in the action's `slot` (null clears it). If another action that can fire alongside already has the
 * key, the two swap: that action gets the key this slot had (or loses the slot when it was empty).
 */
export function setKey(id: ActionId, slot: number, key: string | null) {
  const m = keys()
  const mine = [...m[id]]
  const old = mine[slot] ?? null
  if (key !== null) {
    const clash = clashOf(id, key)
    if (clash) {
      const theirs = [...m[clash.id]]
      if (old !== null && !theirs.includes(old)) theirs[clash.slot] = old
      else theirs.splice(clash.slot, 1)
      m[clash.id] = theirs
    }
    const dup = mine.indexOf(key)
    if (dup >= 0 && dup !== slot) mine.splice(dup, 1)
  }
  if (key === null) mine.splice(slot, 1)
  else if (slot < mine.length) mine[slot] = key
  else mine.push(key)
  m[id] = mine.slice(0, MAX_KEYS)
  save()
}

export function resetKeys() {
  map = defaults()
  try {
    localStorage.removeItem(STORE)
  } catch {
    /* nothing saved */
  }
}

const TEXT = /^(text|search|email|number|password|url|tel|date|time|)$/
/** The key went to a text box (or a list), so it is the rider typing, never a ride key. */
export function typing(e: { target: EventTarget | null }) {
  const el = e.target as HTMLElement | null
  if (!el?.tagName) return false
  if (el.tagName === 'INPUT') return TEXT.test((el as HTMLInputElement).type ?? '')
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable
}

const SCROLL = new Set([
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

/**
 * Which of the screen's actions this key press is (none while typing or with Ctrl or Cmd held). In a ride screen
 * the arrows, Space and Page Up and Down never scroll the page, bound or not.
 */
export function actionOf(e: KeyboardEvent, scope: Scope): ActionId | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return
  if (scope !== 'sim' && SCROLL.has(e.key)) e.preventDefault()
  const k = keyOf(e)
  return ACTION_IDS.find(
    (id) => (ACTIONS[id].scope as Scope[]).includes(scope) && keys()[id].includes(k),
  )
}

/** Whether this key press is `id`, for a handler with one action (never while typing or with Ctrl or Cmd held). */
export const isKey = (e: KeyboardEvent, id: ActionId) =>
  !(e.ctrlKey || e.metaKey || e.altKey || typing(e)) && keys()[id].includes(keyOf(e))

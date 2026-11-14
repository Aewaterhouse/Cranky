import AVATAR from '../../../content/avatar.json'

/** One option of a rider's body: a 0..100 slider, a picker or colour (an index) or an on/off toggle. */
export interface BodyField {
  key: string
  tab: string
  label: string
  type: 'slider' | 'pick' | 'colour' | 'toggle'
  max: number
  def: number
  /** Slider end labels. */
  lo?: string
  hi?: string
  /** Picker and colour option names, and the colours themselves. */
  opts?: string[]
  colours?: string[]
  /** The unremarkable choices a default body picks from. */
  normal?: number[]
}
/** A rider's body: a whole number per option key. See docs/avatars.md. */
export type Body = Record<string, number>

export const BODY_FIELDS = AVATAR.fields as BodyField[]
export const BODY_TABS = [...new Set(BODY_FIELDS.map((f) => f.tab))]
export const BODY_PRESETS = AVATAR.presets as unknown as { name: string; body: Partial<Body> }[]
const VERSION = AVATAR.version
const field = (key: string) => BODY_FIELDS.find((f) => f.key === key)!
const clampTo = (f: BodyField, v: unknown) =>
  Math.min(f.max, Math.max(0, Math.round(Number.isFinite(+v!) ? +v! : f.def)))

/** A whole body from any part of one: missing options take their plain value, the rest are clamped. */
export const fullBody = (b: Partial<Body> = {}): Body =>
  Object.fromEntries(BODY_FIELDS.map((f) => [f.key, clampTo(f, b[f.key] ?? f.def)]))

/** The string a body travels as in `look.body`: the version, then each option in table order. */
export const encodeBody = (b: Body) =>
  [VERSION, ...BODY_FIELDS.map((f) => clampTo(f, b[f.key] ?? f.def))].join('-')

/** The body in a `look.body` string, or undefined if it isn't one this version understands. */
export function decodeBody(s?: string): Body | undefined {
  const n = s?.split('-').map(Number)
  if (!n || n[0] !== VERSION || n.length !== BODY_FIELDS.length + 1) return undefined
  if (n.some((v) => !Number.isInteger(v))) return undefined
  return Object.fromEntries(BODY_FIELDS.map((f, i) => [f.key, clampTo(f, n[i + 1])]))
}

/** A small seeded generator (mulberry32) from a string, so a rider's default never changes. */
function seeded(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The body a rider has until they make one: ordinary, and always the same for the same id. */
export function defaultBody(id: string): Body {
  const r = seeded(id)
  return Object.fromEntries(
    BODY_FIELDS.map((f) => {
      const v = r()
      if (f.type === 'slider') return [f.key, clampTo(f, f.def + (v - 0.5) * DEFAULT_SPREAD)]
      if (f.normal) return [f.key, f.normal[Math.floor(v * f.normal.length)]]
      return [f.key, f.def]
    }),
  )
}
/** How far (in slider points, end to end) a default body strays from the plain values. */
const DEFAULT_SPREAD = 30

/** Anything goes: every option anywhere in its range (sliders lean to the ends a little, for laughs). */
export function randomBody(r: () => number = Math.random): Body {
  return Object.fromEntries(
    BODY_FIELDS.map((f) => {
      if (f.type !== 'slider') return [f.key, Math.floor(r() * (f.max + 1))]
      const v = r()
      return [f.key, clampTo(f, r() < 0.3 ? (v < 0.5 ? v * 30 : 70 + v * 30) : v * 100)]
    }),
  )
}

/** The body a look carries, else the rider's default. */
export const bodyOf = (id: string, look?: { body?: string }) =>
  decodeBody(look?.body) ?? defaultBody(id)

/** An option's colour (skin, hair, eyes) as a hex string. */
export const bodyColour = (b: Body, key: string) => field(key).colours![b[key]] ?? '#888888'

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: (Node | string)[]
) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v)
    else if (k === 'class') el.className = String(v)
    else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v
    else el.setAttribute(k, String(v))
  }
  el.append(...kids)
  return el
}

export const app = () => document.getElementById('app')!
export function show(...nodes: Node[]) {
  app().replaceChildren(...nodes)
}
export const fmt = (s: number) => {
  s = Math.max(0, Math.ceil(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export const pctStr = (c: number | null | undefined) =>
  c == null ? '–' : `${Math.round(c * 100)}%`

const HUES = ['#f2b705', '#7fd13b', '#3bb2d1', '#e85d9c', '#ff7a3d', '#a78bfa']
/** Initials on a per-rider colour, stable across screens. */
export function avatar(name: string, size = '') {
  // Multiplier picked so the six crew names land on six different colours.
  const n = [...name.toLowerCase()].reduce((a, c) => (a * 113 + c.charCodeAt(0)) % 9973, 7)
  return h(
    'span',
    { class: `ava ${size}`, style: `--c:${HUES[n % HUES.length]}`, 'aria-hidden': 'true' },
    name.slice(0, 2).toUpperCase(),
  )
}

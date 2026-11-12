type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]) {
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
export const pctStr = (c: number | null | undefined) => (c == null ? '–' : `${Math.round(c * 100)}%`)

import type { Live } from '../modes/rideController'
import type { ShopItem } from '../net/protocol'
import type { Frame, SprintResult, Tier } from '../types'
import { TIERS } from '../types'
import { fmt, h, pctStr } from './dom'

export interface HudRider {
  name: string
  c: number | null
  st: string
  tier: string
  p: number
}

/** Ride overlay: targets, live numbers, compliance, roster, bus stats and banners. */
export function makeHud(onTier: (t: Tier) => void, onQuit: () => void) {
  const el = (cls: string, text = '') => h('div', { class: cls }, text)
  const tgt = el('big'),
    pow = el('big'),
    cad = el('big'),
    comp = el('big')
  const bar = el('bar-fill')
  const block = el('block'),
    next = el('next'),
    timer = el('timer')
  const roster = el('roster'),
    bus = el('busstats'),
    banner = el('banner'),
    toast = el('toast'),
    shopEl = el('shop')
  const tier = h(
    'select',
    { onchange: (e: Event) => onTier((e.target as HTMLSelectElement).value as Tier) },
    ...TIERS.map((t) => h('option', { value: t }, t)),
  )
  const stat = (label: string, v: HTMLElement) =>
    h('div', { class: 'stat' }, h('label', {}, label), v)
  const root = h(
    'div',
    { class: 'hud' },
    h('div', { class: 'top' }, h('div', {}, block, next), timer),
    h(
      'div',
      { class: 'panel' },
      stat('Target', tgt),
      stat('Power (3 s)', pow),
      stat('Cadence', cad),
      stat('Compliance', comp),
      h('div', { class: 'bar' }, bar),
      h(
        'div',
        { class: 'row' },
        tier,
        h('button', { class: 'ghost', onclick: onQuit }, 'End ride'),
      ),
    ),
    roster,
    bus,
    banner,
    toast,
    shopEl,
  )
  let bannerT: ReturnType<typeof setTimeout>
  let toastT: ReturnType<typeof setTimeout>
  return {
    root,
    setTier: (t: string) => (tier.value = t),
    frame(f: Frame | null, live: Live, total: number) {
      if (!f) return
      tgt.textContent = f.tgt == null ? (f.type === 'sprint' ? 'ALL OUT' : 'Free') : `${f.tgt} W`
      pow.textContent = `${Math.round(live.avg)} W`
      cad.textContent = `${Math.round(live.cadence)}`
      comp.textContent = f.type === 'sprint' ? '–' : pctStr(live.c)
      const c = live.c ?? 1
      bar.style.width = `${c * 100}%`
      bar.style.background = c > 0.85 ? '#4c4' : c > 0.6 ? '#fb3' : '#e44'
      block.textContent = `${f.label} · ${fmt(f.dur - f.bel)}`
      next.textContent = f.next
        ? `Next: ${f.next.label}${f.next.tgt ? ` @ ${f.next.tgt} W` : ''} in ${fmt(f.next.in)}`
        : 'Last block'
      timer.textContent = `${fmt(f.el)} / ${fmt(total)}`
      root.classList.toggle('sprinting', f.type === 'sprint')
    },
    roster(rs: HudRider[]) {
      roster.replaceChildren(
        ...rs.map((r) =>
          h(
            'div',
            { class: `rr ${r.st}` },
            h('span', {}, r.name),
            h(
              'span',
              {},
              r.st === 'riding' ? pctStr(r.c) : r.st === 'fell' ? 'FELL OFF' : 'spectating',
            ),
            h('span', { class: 'dim' }, `${r.tier[0].toUpperCase()} · ${r.p} W`),
          ),
        ),
      )
    },
    bus(items: [string, string][]) {
      bus.replaceChildren(...items.map(([k, v]) => h('div', {}, h('label', {}, k), h('b', {}, v))))
    },
    banner(text: string, cls = '', ms = 2500) {
      banner.textContent = text
      banner.className = `banner show ${cls}`
      clearTimeout(bannerT)
      bannerT = setTimeout(() => (banner.className = 'banner'), ms)
    },
    toast(text: string) {
      toast.textContent = text
      toast.className = 'toast show'
      clearTimeout(toastT)
      toastT = setTimeout(() => (toast.className = 'toast'), 3000)
    },
    /** Servo Stop shop; hidden when closed. */
    shop(open: boolean, scrap: number, buy: (item: ShopItem) => void) {
      shopEl.style.display = open ? '' : 'none'
      if (!open) return
      const items: [ShopItem, string, number][] = [
        ['plating', 'Armour plating +25', 40],
        ['repellent', 'Horde repellent', 60],
        ['sync', 'Wider sync window', 50],
      ]
      const key = items.map(([, , c]) => scrap >= c).join()
      if (shopEl.dataset.key === key) return
      shopEl.dataset.key = key
      shopEl.replaceChildren(
        h('b', {}, '🛠 Servo shop (bus scrap)'),
        ...items.map(([id, name, cost]) =>
          h('button', { disabled: scrap < cost, onclick: () => buy(id) }, `${name} · ${cost}`),
        ),
      )
    },
    sprint(r: SprintResult) {
      this.banner(
        `${r.grade}! ${r.avg} W (${Math.round(r.pct * 100)}%)${r.combo > 1 ? ` · combo x${r.combo}` : ''}`,
        `grade-${r.grade}`,
        3500,
      )
    },
  }
}
export type Hud = ReturnType<typeof makeHud>

import type { SprintResult } from '../types'
import { h } from './dom'
import { FX_ICON } from './hudKit'
import { CFG } from '../config'

/** Centre splashes (one at a time, with priority) and the short stacked event feed. */
export function makeSplash() {
  const layer = h('div', { class: 'hud-splash' })
  const feed = h('div', { class: 'hud-feed' })
  const flash = h('div', { class: 'hud-flash' })
  let cur = { prio: 0, until: 0 }
  let timer: ReturnType<typeof setTimeout>
  // Callouts that arrive while a more important one is up wait their turn (briefly) instead of vanishing.
  type Args = [string, string, string?, number?, number?, ...Node[]]
  let waiting: { args: Args; at: number }[] = []
  const next = () => {
    const now = performance.now()
    waiting = waiting.filter((w) => now - w.at < CFG.hud.splashWaitMs)
    const w = waiting.sort((a, b) => (b.args[4] ?? 1) - (a.args[4] ?? 1)).shift()
    if (w) splash(...w.args)
  }

  function splash(cls: string, big: string, sub = '', ms = 2000, prio = 1, ...extra: Node[]) {
    const now = performance.now()
    if (now < cur.until && prio < cur.prio) {
      if (prio > 0 && waiting.length < 3)
        waiting.push({ args: [cls, big, sub, ms, prio, ...extra], at: now })
      return
    }
    cur = { prio, until: now + ms }
    const sp = h('div', { class: `sp ${cls}` }, h('div', { class: 'sp-big' }, big))
    if (sub) sp.append(h('div', { class: 'sp-sub' }, sub))
    sp.style.setProperty('--ms', `${ms}ms`)
    sp.append(...extra)
    layer.replaceChildren(sp)
    clearTimeout(timer)
    timer = setTimeout(() => (sp.remove(), next()), ms)
  }

  const confetti = () =>
    Array.from({ length: 36 }, () => {
      const c = h('i', { class: 'sp-conf' }, ['✨', '⭐', '🔥', ''][Math.floor(Math.random() * 4)])
      c.style.cssText = `--x:${(Math.random() - 0.5) * 120}vw;--y:${-10 - Math.random() * 40}vh;--r:${Math.random() * 720 - 360}deg;--d:${Math.random() * 0.5}s;--h:${Math.random() * 360}deg`
      return c
    })

  return {
    layer,
    feed,
    flash,
    splash,
    grade(r: SprintResult) {
      const sub = `${r.avg} W · ${Math.round(r.pct * 100)}% of your best${r.combo > 1 ? `  ·  COMBO ×${r.combo}` : ''}`
      const legend = r.grade === 'LEGEND'
      splash(
        `sp-grade sp-${r.grade}`,
        `${r.grade}${legend ? '!!!' : '!'}`,
        sub,
        legend ? 5000 : 3500,
        3,
        ...(legend ? [h('div', { class: 'sp-rays' }), ...confetti()] : []),
      )
      if (legend || r.grade === 'MEGA') {
        flash.className = 'hud-flash on'
        flash.dataset.g = r.grade
        setTimeout(() => (flash.className = 'hud-flash'), 900)
      }
    },
    /** Add a line to the feed; it fades out by itself. */
    line(k: string, text: string, tone = '') {
      if (feed.firstElementChild?.textContent?.endsWith(text)) return
      const row = h(
        'div',
        { class: `fd ${tone}` },
        h('span', { class: 'fd-ico' }, FX_ICON[k] ?? '•'),
        h('span', {}, text),
      )
      feed.prepend(row)
      while (feed.children.length > 4) feed.lastElementChild!.remove()
      setTimeout(() => row.classList.add('out'), 6000)
      setTimeout(() => row.remove(), 6600)
    },
  }
}

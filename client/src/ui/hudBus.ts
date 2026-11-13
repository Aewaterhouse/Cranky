import type { BusState, RiderTick } from '../net/protocol'
import { h } from './dom'
import { pulse, set, tween } from './hudKit'

const GAP_MAX = 120
const GAP_CLOSE = 25
const SYNC_RPM = 5
const SYNC_MIN_CADENCE = 30
const STREAK_NAME: Record<string, string> = {
  drop: 'SUPPLY DROP',
  airstrike: 'AIR STRIKE',
  gunship: 'GUNSHIP',
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? (s[s.length >> 1] + s[(s.length - 1) >> 1]) / 2 : 0
}

/** Top-left bus status: armour, horde gap, speed/distance/scrap, engine sync and upgrade pips. */
export function makeBusPanel() {
  const t = (cls: string, v = '') => h('b', { class: cls }, v)
  const armourN = t('bs-n'),
    armourFill = h('i', {}),
    gapN = t('bs-n'),
    speed = t('bs-v'),
    dist = t('bs-v'),
    scrap = t('bs-v', '0')
  const zombie = h('span', { class: 'bs-zed' }, '🧟')
  const busIco = h('span', { class: 'bs-bus' }, '🚌')
  const gapTrack = h('div', { class: 'bs-gap' }, zombie, busIco)
  const armour = h('div', { class: 'bs-bar' }, armourFill)
  const syncState = h('span', { class: 'bs-sync-s' })
  const syncTrack = h('div', { class: 'bs-sync-t' }, h('i', { class: 'bs-win' }))
  const win = syncTrack.firstElementChild as HTMLElement
  const pipsEl = h('div', { class: 'bs-pips' })
  const nitroFill = h('i', {})
  const nitroState = h('span', { class: 'bs-sync-s' })
  const streakFill = h('i', {})
  const streakState = h('span', { class: 'bs-sync-s' })
  const stat = (label: string, v: HTMLElement, unit: string) =>
    h('div', { class: 'bs-stat' }, h('label', {}, label), h('div', {}, v, h('small', {}, unit)))
  const root = h(
    'section',
    { class: 'hud-glass bs' },
    h('div', { class: 'bs-head' }, h('label', {}, '🛡 ARMOUR'), armourN),
    armour,
    h('div', { class: 'bs-head' }, h('label', {}, 'HORDE GAP'), gapN),
    gapTrack,
    h(
      'div',
      { class: 'bs-stats' },
      stat('SPEED', speed, 'km/h'),
      stat('DIST', dist, 'km'),
      stat('SCRAP', scrap, '⚙'),
    ),
    h('div', { class: 'bs-head' }, h('label', {}, 'ENGINE SYNC'), syncState),
    syncTrack,
    h('div', { class: 'bs-head' }, h('label', {}, 'NITRO'), nitroState),
    h('div', { class: 'bs-nitro' }, nitroFill),
    h('div', { class: 'bs-head' }, h('label', {}, 'STREAK'), streakState),
    h('div', { class: 'bs-nitro bs-streak' }, streakFill),
    pipsEl,
  )
  const dots = new Map<string, HTMLElement>()
  let lastArmour = -1
  const pips = (icon: string, n: number, slots: number) =>
    h(
      'span',
      {},
      ...Array.from({ length: Math.max(slots, n) }, (_, i) =>
        h('i', { class: i < n ? 'on' : '' }, icon),
      ),
    )
  return {
    root,
    update(b: BusState, riders: Record<string, RiderTick>) {
      const a = Math.round(b.armour)
      set(armourN, `${a}`)
      armourFill.style.width = `${Math.max(0, Math.min(100, b.armour))}%`
      armour.classList.toggle('low', a < 30)
      if (lastArmour >= 0 && b.armour < lastArmour - 0.5) {
        pulse(root, 'hit')
        pulse(armour, 'hit')
      }
      lastArmour = b.armour
      set(gapN, `${Math.round(b.gap)} m`)
      const f = Math.max(0, Math.min(1, b.gap / GAP_MAX))
      zombie.style.left = `${(1 - f) * 78}%`
      gapTrack.classList.toggle('close', b.gap < GAP_CLOSE)
      set(speed, `${Math.round(b.speed * 3.6)}`)
      set(dist, (b.dist / 1000).toFixed(2))
      tween(scrap, b.scrap)
      const ridersOn = Object.entries(riders).filter(
        ([, r]) => r.st === 'riding' && r.cad >= SYNC_MIN_CADENCE,
      )
      const med = median(ridersOn.map(([, r]) => r.cad))
      const w = SYNC_RPM + b.syncw
      const half = w * 2.5
      win.style.width = `${(w / half) * 50}%`
      for (const [id, d] of dots) if (!riders[id] || !ridersOn.some(([i]) => i === id)) d.remove()
      for (const [id, r] of ridersOn) {
        let d = dots.get(id)
        if (!d || !d.isConnected) {
          d = h('i', { class: 'bs-dot' }, r.name.slice(0, 1).toUpperCase())
          dots.set(id, d)
          syncTrack.append(d)
        }
        const off = Math.max(-1, Math.min(1, (r.cad - med) / half))
        d.style.left = `${50 + off * 47}%`
        d.classList.toggle('out', Math.abs(r.cad - med) > w)
        d.title = `${r.name} ${Math.round(r.cad)} rpm`
      }
      syncTrack.dataset.s = b.tune ? 'tune' : b.sync ? 'sync' : 'off'
      set(syncState, b.tune ? 'IN TUNE ×1.25' : b.sync ? 'IN SYNC…' : `MATCH CADENCE ±${w} rpm`)
      nitroFill.style.width = `${(b.boost ? 1 : (b.nitro ?? 0)) * 100}%`
      nitroFill.parentElement!.dataset.s = b.boost ? 'boost' : ''
      set(
        nitroState,
        b.boost
          ? 'BOOSTING!'
          : b.nitro > 0.02
            ? `${Math.round(b.nitro * 100)}%`
            : 'RIDE CLEAN TO CHARGE',
      )
      streakFill.style.width = `${(b.gunship ? 1 : (b.streak ?? 0)) * 100}%`
      streakFill.parentElement!.dataset.s = b.gunship ? 'boost' : ''
      set(streakState, b.gunship ? 'GUNSHIP UP!' : `NEXT: ${STREAK_NAME[b.next] ?? ''}`)
      const key = `${b.repel}/${b.syncw}`
      if (pipsEl.dataset.k !== key) {
        pipsEl.dataset.k = key
        pipsEl.replaceChildren(
          h('label', {}, 'REPELLENT'),
          pips('🛡', b.repel, 3),
          h('label', {}, 'SYNC UPGRADES'),
          pips('🔧', Math.round(b.syncw / 3), 3),
        )
      }
    },
  }
}

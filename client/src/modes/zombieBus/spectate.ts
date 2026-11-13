import '../../hud.css'
import '../../tv.css'
import { CFG } from '../../config'
import { frameAt, planTotal } from '../../core/plan'
import type { Lobby, ServerMsg, Tick } from '../../net/protocol'
import { WsClient } from '../../net/wsClient'
import type { Mood } from '../../scene/params'
import { World } from '../../scene/world'
import { mood as moodAudio, SFX, stopAudio } from '../../ui/audio'
import { h, show } from '../../ui/dom'
import { makeBusPanel } from '../../ui/hudBus'
import { makeHeader } from '../../ui/hudHeader'
import { eventOf, FX_DEFAULT } from '../../ui/hudKit'
import { makeSplash } from '../../ui/hudSplash'
import { makeTvBoard } from '../../ui/hudTvBoard'
import { tvEnd, tvLobby } from '../../ui/hudTvScreens'
import { toast } from '../../ui/toast'
import type { Grade } from '../../types'

const FX_SOUND: Record<string, () => void> = {
  buy: SFX.scrap,
  repel: SFX.shake,
  hit: SFX.hit,
  grab: SFX.grab,
  shake: SFX.shake,
  smash: SFX.MEGA,
  crash: SFX.hit,
  hauled: SFX.scrap,
  tune: SFX.GREAT,
  fell: SFX.FAIL,
  drop: SFX.scrap,
  airstrike: SFX.GREAT,
  gunship: SFX.MEGA,
}
const CARD_FX = new Set(['surge', 'longhaul', 'rampup', 'roadblock', 'servo'])
const GRADE_RE = /: (FAIL|HIT|GREAT|MEGA|LEGEND)\b/

/** TV / second-screen view of a bus: big scene, crew board and bus status. Sends only `watch`. */
export function spectate(code: string, leaveTo: () => void) {
  const stage = h('div', { class: 'stage' })
  show(stage)
  const world = new World(stage)
  const sp = makeSplash()
  const bus = makeBusPanel()
  const board = makeTvBoard()
  let l: Lobby | null = null
  let header = makeHeader(undefined, 'hard')
  let planId = ''
  let total = 0
  const grades = new Map<string, Grade[]>()
  const ui = h('div', { class: 'tv-ui' })
  const slot = h('div', { class: 'tv-slot' })
  const net = new WsClient(code)
  const status = h('span', { class: 'dim' })
  const leave = () => {
    removeEventListener('resize', fit)
    removeEventListener('keydown', onKey)
    net.close()
    stopAudio()
    world.dispose()
    history.replaceState(null, '', location.pathname)
    leaveTo()
  }
  const root = h(
    'div',
    { class: 'hud tv' },
    ui,
    h(
      'div',
      { class: 'tv-ctl' },
      status,
      h('button', { class: 'ghost', onclick: leave }, 'Leave'),
      h('small', {}, 'F: fullscreen'),
    ),
  )
  const left = h('div', { class: 'tv-left' }, bus.root, sp.feed)
  ui.append(header.root, left, board.root, sp.flash, sp.layer, slot)
  stage.append(root)

  /** The HUD is laid out at a fixed design height and zoomed to the screen. */
  const fit = () => {
    const z = Math.min(CFG.tv.maxZoom, Math.max(CFG.tv.minZoom, innerHeight / CFG.tv.designH))
    ui.style.cssText = `transform:scale(${z});width:${innerWidth / z}px;height:${innerHeight / z}px`
    root.classList.toggle('narrow', innerWidth / innerHeight < 1.5)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 'f') return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  addEventListener('resize', fit)
  addEventListener('keydown', onKey)
  fit()

  const screen = (el?: HTMLElement) => slot.replaceChildren(...(el ? [el] : []))
  const looks = () => Object.fromEntries((l?.riders ?? []).map((r) => [r.id, r.look]))
  const setPlan = (m: Lobby) => {
    if (m.plan.id === planId && m.state !== 'lobby') return
    planId = m.plan.id
    total = planTotal(m.plan.blocks)
    const old = header.root
    header = makeHeader(m.plan, 'hard')
    old.replaceWith(header.root)
  }

  let lastI = -2
  let lastEv = ''
  let lastCount = 0
  function tick(m: Tick) {
    if (!l) return
    screen()
    root.classList.remove('idle')
    root.classList.toggle('pre', m.i < 0)
    const lk = looks()
    const f = m.i >= 0 ? frameAt(l.plan.blocks, m.el, 'hard', 100) : null
    if (m.i < 0) sp.splash('sp-count sp-pre', `${Math.ceil(-m.el)}`, 'BUS LEAVES IN', 1100, 0)
    if (f) {
      if (f.next) f.next.tgt = null
      header.update(f, m.ev, f.el, total, m.bus.rb)
      if (m.i !== lastI) {
        SFX.block()
        const s = eventOf(m.ev)
        if (f.type === 'sprint') sp.splash('sp-go', 'SPRINT!', 'Everything you have!', 1600, 2)
        else
          sp.splash(
            'sp-title',
            `${s.icon} ${s.name}`,
            f.label.toLowerCase() === s.name.toLowerCase() ? '' : f.label,
            2200,
            1,
          )
        root.style.setProperty('--ev', s.col)
      }
      const count = f.next?.type === 'sprint' ? Math.ceil(f.next.in) : 0
      if (count !== lastCount && count > 0 && count <= 3) {
        SFX.countdown()
        sp.splash('sp-count', `${count}`, 'SPRINT INCOMING', 1000, 2)
      }
      lastCount = count
    }
    lastI = m.i
    if (m.ev !== lastEv) moodAudio((lastEv = m.ev))
    for (const fx of m.fx) {
      FX_SOUND[fx.k]?.()
      if (fx.k === 'hit' || fx.k === 'crash') world.fx('hit')
      if (fx.k === 'smash' || fx.k === 'crash') world.fx('smash')
      if (fx.k === 'shake') world.fx('shake')
      if (fx.k === 'drop' || fx.k === 'airstrike') world.fx(fx.k)
      if (fx.k === 'slowmo') {
        world.fx('slowmo')
        world.fx('shake')
      }
      if (CARD_FX.has(fx.k)) continue
      const text = fx.text ?? FX_DEFAULT[fx.k] ?? ''
      const who = (fx.id && m.riders[fx.id]?.name) || 'Someone'
      const grade = fx.k === 'sprint' ? (GRADE_RE.exec(text)?.[1] as Grade | undefined) : undefined
      if (grade && fx.id) {
        grades.set(fx.id, [...(grades.get(fx.id) ?? []), grade])
        SFX[grade]()
        if (CFG.tv.bigSplashGrades.includes(grade))
          sp.splash(`sp-grade sp-${grade}`, `${who.toUpperCase()} ${grade}!`, '', 2600, 3)
      } else if (fx.k === 'fell')
        sp.splash(
          'sp-fell',
          `${who.toUpperCase()} FELL OFF!`,
          'Keep the crew on target to haul them back',
          3200,
          2,
        )
      else if (fx.k === 'smash')
        sp.splash('sp-smash', 'ROADBLOCK SMASHED!', text.match(/\+\d+ scrap/)?.[0] ?? '', 2800, 2)
      if (text) sp.line(fx.k, text, ['hit', 'grab', 'crash', 'fell'].includes(fx.k) ? 'bad' : '')
    }
    const b = m.bus
    world.state = {
      speed: b.speed,
      gap: b.gap,
      armour: b.armour,
      mood: (m.i < 0 || m.ev === 'warmup' || m.ev === 'cooldown' ? 'drill' : m.ev) as Mood,
      roadblock: b.rb,
      busLook: lk[l.host],
      riders: Object.entries(m.riders).map(([id, r]) => ({
        id,
        name: r.name,
        c: r.s,
        st: r.st,
        cadence: r.cad,
        look: lk[id],
      })),
    }
    bus.update(b, m.riders)
    board.update(m.riders, grades)
  }

  net.onStatus = (up) => (status.textContent = up ? '' : 'reconnecting…')
  net.onOpen = () => net.send({ t: 'watch' })
  net.onMsg = (m: ServerMsg) => {
    if (m.t === 'lobby') {
      l = m
      setPlan(m)
      if (m.state === 'lobby') {
        grades.clear()
        lastI = -2
        screen(tvLobby(m))
        world.state = {
          speed: 0,
          gap: 100,
          armour: 100,
          mood: 'drill',
          roadblock: null,
          busLook: looks()[m.host],
          riders: m.riders.map((r) => ({
            id: r.id,
            name: r.name,
            c: null,
            st: 'riding',
            cadence: 0,
            look: r.look,
          })),
        }
        root.classList.add('idle')
      }
    } else if (m.t === 'tick') tick(m)
    else if (m.t === 'end') {
      stopAudio()
      lastEv = ''
      root.classList.add('idle')
      screen(tvEnd(m.summary, leave))
    } else if (m.t === 'error') {
      toast(m.msg, 'bad')
      leave()
    }
  }
}

import '../road.css'
import { CFG } from '../config'
import type { Profile } from '../core/curve'
import { ROUTE_INDEX } from '../core/routeLibrary'
import type { RoadLobby, RoadStyle } from '../net/protocol'
import { avatar, h, seg } from './dom'
import { toast } from './toast'
import { trainerCheck } from './trainer'

export interface RoadLobbyCtx {
  profile: () => Profile
  status: HTMLElement
  setup(route: string, laps: number, style: RoadStyle, together: boolean): void
  bots(n: number): void
  start(): void
  leave(): void
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Link copied. Send it to the crew.', 'good')
  } catch {
    toast(text, 'info')
  }
}

/** Group-ride lobby, built once and patched in place: who is in, the route, and the host's choices. */
export function roadLobbyView(c: RoadLobbyCtx) {
  let l: RoadLobby | undefined
  const send = (over: Partial<Pick<RoadLobby, 'route' | 'laps' | 'style' | 'together'>>) => {
    if (!l) return
    const next = { ...l, ...over }
    // Changing the style resets keep-together to that style's usual setting.
    const together = over.style ? over.style === 'social' : next.together
    c.setup(next.route, next.laps, next.style, together)
  }
  const riders = h('div', { class: 'road-riders' })
  const code = h('div', { class: 'code-letters' })
  const routeSel = h(
    'select',
    { onchange: () => send({ route: routeSel.value, laps: 1 }) },
    ...ROUTE_INDEX.map((r) =>
      h('option', { value: r.id }, `${r.name} · ${r.km.toFixed(1)} km · ${r.gainM} m up`),
    ),
  )
  const routeText = h('b', {})
  const lapN = h('b', {})
  const step = (by: number, label: string) =>
    h(
      'button',
      {
        class: 'ghost',
        'aria-label': label,
        onclick: () => l && send({ laps: Math.max(1, Math.min(CFG.road.lapsMax, l.laps + by)) }),
      },
      by < 0 ? '−' : '+',
    )
  const lapRow = h(
    'div',
    { class: 'bot-row' },
    h('span', {}, 'Laps'),
    step(-1, 'One lap fewer'),
    lapN,
    step(1, 'One lap more'),
  )
  const total = h('span', { class: 'dim' })
  const styleSeg = seg<RoadStyle>(
    [
      ['social', 'Social'],
      ['race', 'Race'],
    ],
    'social',
    (style) => send({ style }),
    'diff',
  )
  const keep = h('input', { type: 'checkbox', onchange: () => send({ together: keep.checked }) })
  const keepNote = h('span', { class: 'dim' })
  const botN = h('b', {}, '0')
  const botBtn = (d: number, label: string) =>
    h(
      'button',
      { class: 'ghost', 'aria-label': label, onclick: () => c.bots(bots + d) },
      d < 0 ? '−' : '+',
    )
  const botRow = h(
    'div',
    { class: 'bot-row' },
    h('span', {}, '🤖 Bots'),
    botBtn(-1, 'One bot fewer'),
    botN,
    botBtn(1, 'One more bot'),
  )
  let bots = 0
  const startSlot = h('div', { class: 'start-slot' })
  const hostOnly = [routeSel, lapRow, styleSeg, botRow]

  const update = (m: RoadLobby) => {
    l = m
    const me = c.profile()
    const isHost = m.host === me.id
    const host = m.riders.find((r) => r.id === m.host)?.name ?? 'the host'
    const card = ROUTE_INDEX.find((r) => r.id === m.route)
    bots = m.riders.filter((r) => r.bot).length
    botN.textContent = String(bots)
    riders.replaceChildren(
      ...m.riders.map((r) =>
        h(
          'div',
          { class: `road-rider${r.connected ? '' : ' away'}${r.id === me.id ? ' me' : ''}` },
          avatar(r.name, 'lg'),
          h(
            'div',
            {},
            h(
              'b',
              {},
              r.name,
              r.bot ? ' 🤖' : '',
              r.id === m.host ? h('span', { class: 'driver' }, 'Host') : '',
            ),
            h(
              'small',
              {},
              r.line ??
                `${r.ftp} W FTP · ${(r.ftp / r.kg).toFixed(1)} W/kg${r.connected ? '' : ' · away'}`,
            ),
          ),
        ),
      ),
    )
    if (code.dataset.code !== m.code) {
      code.dataset.code = m.code
      code.replaceChildren(...[...m.code].map((ch) => h('span', {}, ch)))
    }
    routeSel.value = m.route
    routeText.textContent = card?.name ?? m.route
    lapN.textContent = `${m.laps} ${m.laps === 1 ? 'lap' : 'laps'}`
    total.textContent = `${(m.distance / 1000).toFixed(1)} km in all`
    styleSeg.set(m.style)
    keep.checked = m.together
    keep.disabled = !isHost
    keepNote.textContent = m.together
      ? 'A gentle tow for riders off the back, a hand on the jersey for riders off the front.'
      : 'Every rider for themselves.'
    for (const el of hostOnly) el.hidden = !isHost
    routeText.hidden = isHost
    lapRow.hidden = !isHost || !card?.loop
    startSlot.replaceChildren(
      isHost
        ? h(
            'button',
            { class: 'primary mega-go', onclick: c.start },
            m.state === 'done' ? 'Ride again' : 'Start the ride',
          )
        : h(
            'div',
            { class: 'waiting' },
            h('i', { class: 'spin' }),
            `Waiting for ${host} to start…`,
          ),
    )
  }

  const el = h(
    'div',
    { class: 'lobby page road-lobby' },
    h('h1', {}, 'Group ride ', c.status),
    h(
      'div',
      { class: 'lobby-cols' },
      h(
        'div',
        {},
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'On the road'),
          riders,
          botRow,
        ),
        h(
          'section',
          { class: 'panel codebox' },
          h('div', {}, h('h2', { class: 'label' }, 'Ride code'), code),
          h(
            'button',
            { class: 'copy', onclick: () => l && copy(`${location.origin}/?join=${l.code}`) },
            'Copy invite link',
          ),
        ),
      ),
      h(
        'div',
        {},
        h(
          'section',
          { class: 'panel road-opts' },
          h('h2', { class: 'label' }, 'The ride'),
          routeSel,
          routeText,
          lapRow,
          total,
          h('div', { class: 'bot-row' }, h('span', {}, 'Style'), styleSeg),
          h('label', { class: 'bot-row' }, keep, h('span', {}, 'Keep together'), keepNote),
        ),
        h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Trainer'), trainerCheck()),
        startSlot,
        h('button', { class: 'ghost leave', onclick: c.leave }, 'Leave the ride'),
      ),
    ),
  )
  return Object.assign(el, { update })
}

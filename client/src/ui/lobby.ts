import type { Profile } from '../core/curve'
import type { Difficulty, Lobby } from '../net/protocol'
import { TIERS, type Tier } from '../types'
import { avatar, h, seg } from './dom'
import { planGraph } from './planGraph'
import { mainWatts, minsLabel, planPicker, tagEls } from './planPicker'
import { toast } from './toast'
import { trainerCheck } from './trainer'

const SEATS = 6
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export interface LobbyCtx {
  profile: () => Profile
  status: HTMLElement
  setup(plan: string, minutes: number): void
  tier(t: Tier): void
  bots(n: number): void
  difficulty(level: Difficulty): void
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

/** The lobby page is built once; `update` patches it in place so scroll and focus survive. */
export function lobbyView(c: LobbyCtx) {
  const seats = h('div', { class: 'seats' })
  const code = h('div', { class: 'code-letters' })
  const run = h('section', { class: 'panel run' })
  const tierSeg = seg(
    TIERS.map((t) => [t, cap(t)]),
    c.profile().tier,
    (t) => c.tier(t),
  )
  const tierNote = h('p', { class: 'dim' })
  const botN = h('b', {}, '0')
  const botBtn = (d: number, label: string) =>
    h(
      'button',
      { class: 'ghost', 'aria-label': `${label} bot`, onclick: () => c.bots(bots + d) },
      d < 0 ? '−' : '+',
    )
  const botLess = botBtn(-1, 'Fewer')
  const botMore = botBtn(1, 'More')
  const botRow = h(
    'div',
    { class: 'bot-row', hidden: true },
    h('span', {}, '🤖 Bots'),
    botLess,
    botN,
    botMore,
  )
  let bots = 0
  const DIFF: [Difficulty, string][] = [
    ['easy', 'Easy'],
    ['normal', 'Normal'],
    ['hard', 'Hard'],
    ['nightmare', 'Nightmare'],
  ]
  const diffSeg = seg(DIFF, 'normal', (v) => c.difficulty(v), 'diff')
  const diffNote = h('span', { class: 'dim' })
  const diffRow = h('div', { class: 'bot-row' }, h('span', {}, '💀 Horde'), diffSeg, diffNote)
  const mutRow = h('div', { class: 'bot-row mut-row' })
  const startSlot = h('div', { class: 'start-slot' })
  const pickerBox = h('section', { class: 'panel', hidden: true })
  let picker: ReturnType<typeof planPicker> | null = null
  let link = ''
  let runKey = ''

  const seat = (r?: Lobby['riders'][number], host?: string) =>
    r
      ? h(
          'div',
          { class: `seat${r.connected ? '' : ' away'}${r.id === c.profile().id ? ' me' : ''}` },
          h('i', {
            class: `dot${r.connected ? ' on' : ''}`,
            title: r.connected ? 'Connected' : 'Away',
          }),
          avatar(r.name, 'lg'),
          h('b', {}, r.name),
          h('span', { class: `tier-badge ${r.tier}` }, r.tier),
          h('small', {}, `${r.ftp} W`),
          r.bot ? h('span', { class: 'bot-badge', title: 'Bot rider' }, '🤖') : '',
          r.id === host ? h('span', { class: 'driver' }, 'Driver') : '',
        )
      : h(
          'div',
          { class: 'seat vacant' },
          h('span', { class: 'ghost-ava' }, '?'),
          h('small', {}, 'waiting…'),
        )

  const update = (l: Lobby) => {
    const me = c.profile()
    const isHost = l.host === me.id
    const mine = l.riders.find((r) => r.id === me.id)
    const tier = mine?.tier ?? me.tier
    const driver = l.riders.find((r) => r.id === l.host)?.name ?? 'the driver'

    bots = l.riders.filter((r) => r.bot).length
    botN.textContent = String(bots)
    botRow.hidden = !isHost
    diffSeg.set(l.difficulty)
    mutRow.hidden = !l.mutator
    if (l.mutator)
      mutRow.replaceChildren(
        h('span', {}, '🎲 This week'),
        h('b', {}, l.mutator.name),
        h('span', { class: 'dim' }, l.mutator.desc),
      )
    diffSeg.hidden = !isHost
    diffNote.textContent = isHost ? '' : DIFF.find(([d]) => d === l.difficulty)![1]
    botLess.disabled = bots === 0
    botMore.disabled = l.riders.length >= SEATS
    seats.replaceChildren(...Array.from({ length: SEATS }, (_, i) => seat(l.riders[i], l.host)))
    link = `${location.origin}/?join=${l.code}`
    if (code.dataset.code !== l.code) {
      code.dataset.code = l.code
      code.replaceChildren(...[...l.code].map((ch) => h('span', {}, ch)))
    }
    tierSeg.set(tier)
    tierNote.textContent = `${mainWatts(l.plan, tier, me.ftp)} on the big block at ${me.ftp} W FTP.`

    const key = `${l.plan.id}|${l.minutes}|${l.plan.blocks.length}|${tier}|${isHost}`
    if (key !== runKey) {
      runKey = key
      run.replaceChildren(
        h('h2', { class: 'label' }, 'The run'),
        h(
          'div',
          { class: 'run-top' },
          h('h3', {}, l.plan.name),
          h('span', { class: 'dur-big' }, minsLabel(l.plan.blocks)),
        ),
        h('div', { class: 'tags' }, ...tagEls(l.plan)),
        planGraph(l.plan.blocks, tier),
        h('p', { class: 'dim' }, l.plan.desc ?? ''),
        isHost ? '' : h('p', { class: 'dim' }, `${driver} picks the run. It updates here live.`),
      )
    }

    pickerBox.hidden = !isHost
    if (isHost) {
      if (!picker) {
        picker = planPicker({
          plan: l.plan.id,
          minutes: l.minutes,
          first: 'bus',
          onChange: c.setup,
        })
        pickerBox.replaceChildren(h('h2', { class: 'label' }, 'Choose the run'), picker)
      } else picker.set(l.plan.id, l.minutes)
    }

    startSlot.replaceChildren(
      isHost
        ? h('button', { class: 'primary mega-go', onclick: c.start }, 'Start the bus')
        : h(
            'div',
            { class: 'waiting' },
            h('i', { class: 'spin' }),
            `Waiting for ${driver} to start…`,
          ),
    )
  }

  const el = h(
    'div',
    { class: 'lobby page' },
    h('h1', {}, 'Bus lobby ', c.status),
    h(
      'div',
      { class: 'lobby-cols' },
      h(
        'div',
        {},
        h(
          'section',
          { class: 'bus' },
          h('div', { class: 'bus-roof' }, h('span', {}, 'ZOMBIE BUS')),
          seats,
          botRow,
          diffRow,
          mutRow,
          h('div', { class: 'bus-floor' }, h('i', {}), h('i', {})),
        ),
        h(
          'section',
          { class: 'panel codebox' },
          h('div', {}, h('h2', { class: 'label' }, 'Bus code'), code),
          h('button', { class: 'copy', onclick: () => copy(link) }, 'Copy invite link'),
        ),
      ),
      h(
        'div',
        {},
        run,
        h(
          'section',
          { class: 'panel' },
          h('h2', { class: 'label' }, 'Your effort'),
          tierSeg,
          tierNote,
        ),
        h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Trainer'), trainerCheck()),
        startSlot,
        h('button', { class: 'ghost leave', onclick: c.leave }, 'Leave the bus'),
      ),
    ),
    pickerBox,
  )
  return Object.assign(el, { update })
}

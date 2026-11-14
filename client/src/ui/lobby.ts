import { CFG } from '../config'
import type { Profile } from '../core/curve'
import type { Difficulty, Game, Lobby, TrainerMode } from '../net/protocol'
import { GAMES } from '../modes/crew/games'
import { FIRST_VIDEO, videoSource } from '../core/watchSync'
import { gameCard } from './gameCard'
import { TIER_NAME, TIERS, type Tier } from '../types'
import { settings } from '../core/settings'
import { avatar, h, seg } from './dom'
import { planGraph } from './planGraph'
import { mainWatts, minsLabel, planPicker, tagEls } from './planPicker'
import { toast } from './toast'
import { trainerCheck } from './trainer'

const SEATS = 6

export interface LobbyCtx {
  profile: () => Profile
  status: HTMLElement
  setup(plan: string, minutes: number): void
  tier(t: Tier): void
  /** This rider's trainer mode: ERG, or virtual gears with ERG off. */
  erg(on: boolean): void
  /** Host: the whole ride on ERG, on gears, or each rider chooses. */
  trainers(mode: TrainerMode): void
  bots(n: number): void
  difficulty(level: Difficulty): void
  game(game: Game): void
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
    TIERS.map((t) => [t, `${TIER_NAME[t]} · ${Math.round(CFG.tierFactor[t] * 100)}%`]),
    c.profile().tier,
    (t) => c.tier(t),
  )
  const tierNote = h('p', { class: 'dim' })
  const ergSeg = seg<'erg' | 'gears'>(
    [
      ['erg', 'ERG'],
      ['gears', 'Gears'],
    ],
    settings.busErg ? 'erg' : 'gears',
    (v) => c.erg(v === 'erg'),
  )
  const ERG_WHAT =
    'ERG holds your target for you. Gears: ERG off, you shift (Z X, the arrows or a Zwift Click) to hold it.'
  const ergNote = h('p', { class: 'dim' }, ERG_WHAT)
  const TRAINERS: [TrainerMode, string][] = [
    ['choose', 'Each rider'],
    ['erg', 'All ERG'],
    ['gears', 'All gears'],
  ]
  const trainSeg = seg(TRAINERS, 'choose', (v) => c.trainers(v), 'diff')
  const trainNote = h('span', { class: 'dim' })
  const trainRow = h('div', { class: 'bot-row' }, h('span', {}, '🚲 Trainers'), trainSeg, trainNote)
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
  const DIFF_WHAT: Record<Difficulty, string> = {
    easy: 'A gentle chase. Ride the plan and you will make it.',
    normal: 'The horde keeps coming. A good crew limps home.',
    hard: 'Doomed unless the crew earns air strikes and gunships with clean riding.',
    nightmare: 'You will not make it. Make them work for it.',
  }
  const DIFF: [Difficulty, string][] = [
    ['easy', 'Easy'],
    ['normal', 'Normal'],
    ['hard', 'Hard'],
    ['nightmare', 'Nightmare'],
  ]
  const diffSeg = seg(DIFF, 'normal', (v) => c.difficulty(v), 'diff')
  const diffNote = h('span', { class: 'dim' })
  const diffWhat = h('span', { class: 'dim diff-what' })
  const diffRow = h(
    'div',
    { class: 'bot-row' },
    h('span', {}, '💀 Horde'),
    diffSeg,
    diffNote,
    diffWhat,
  )
  const mutRow = h('div', { class: 'bot-row mut-row' })
  // Watch Party: a link pasted here goes on the moment the countdown starts.
  const firstNote = h('span', { class: 'dim' })
  const firstIn = h('input', {
    placeholder: 'Paste a YouTube or Twitch link to start with',
    value: sessionStorage.getItem(FIRST_VIDEO) ?? '',
    oninput: () => {
      const v = videoSource(firstIn.value)
      if (v) sessionStorage.setItem(FIRST_VIDEO, v)
      else sessionStorage.removeItem(FIRST_VIDEO)
      firstNote.textContent = !firstIn.value
        ? ''
        : v
          ? '✓ It starts with the ride'
          : 'That doesn’t look like a video link'
    },
  }) as HTMLInputElement
  const firstRow = h(
    'div',
    { class: 'bot-row first-video' },
    h('span', {}, '📺 First video'),
    firstIn,
    firstNote,
  )
  const gameRow = h('div', { class: 'game-cards' })
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
          h('span', { class: `tier-badge ${r.tier}` }, TIER_NAME[r.tier]),
          h('small', {}, `${r.ftp} W`),
          r.bot ? h('span', { class: 'bot-badge', title: 'Bot rider' }, '🤖') : '',
          r.bot
            ? ''
            : h(
                'span',
                { class: 'erg-badge', title: r.erg === false ? 'ERG off, on gears' : 'ERG on' },
                r.erg === false ? '⚙ Gears' : 'ERG',
              ),
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
    const game = l.game ?? 'bus'
    const info = GAMES[game]
    const ids = isHost ? (Object.keys(GAMES) as Game[]) : [game]
    gameRow.replaceChildren(...ids.map((g) => gameCard(g, g === game, isHost, c.game)))
    diffRow.hidden = !info.plan
    firstRow.hidden = game !== 'watch'
    title.textContent = game === 'bus' ? 'Bus lobby' : `${info.name} lobby`
    roof.textContent = info.name.toUpperCase()
    effort.hidden = trainRow.hidden = !!info.fixed
    const trainers = l.trainers ?? 'choose'
    trainSeg.set(trainers)
    trainSeg.hidden = !isHost
    trainNote.textContent = isHost ? '' : TRAINERS.find(([t]) => t === trainers)![1]
    ergSeg.hidden = trainers !== 'choose'
    ergNote.textContent =
      trainers === 'choose'
        ? ERG_WHAT
        : `${driver} has everyone on ${trainers === 'erg' ? 'ERG' : 'gears (ERG off, you shift)'} this ride.`
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
    diffWhat.textContent = DIFF_WHAT[l.difficulty]
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

    const key = `${l.plan.id}|${l.minutes}|${l.plan.blocks.length}|${tier}|${isHost}|${game}`
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
        info.plan ? planGraph(l.plan.blocks, tier) : h('p', {}, `${info.icon} ${info.blurb}`),
        h('p', { class: 'dim' }, l.plan.desc ?? ''),
        isHost ? '' : h('p', { class: 'dim' }, `${driver} picks the run. It updates here live.`),
      )
    }

    pickerBox.hidden = !isHost || !!info.fixed
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
        ? h('button', { class: 'primary mega-go', onclick: c.start }, info.start)
        : h(
            'div',
            { class: 'waiting' },
            h('i', { class: 'spin' }),
            `Waiting for ${driver} to start…`,
          ),
    )
  }

  const title = h('span', {}, 'Bus lobby')
  const roof = h('span', {}, 'ZOMBIE BUS')
  const effort = h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'label' }, 'Your effort'),
    tierSeg,
    tierNote,
    ergSeg,
    ergNote,
  )
  const el = h(
    'div',
    { class: 'lobby page' },
    h('h1', {}, title, ' ', c.status),
    h(
      'div',
      { class: 'lobby-cols' },
      h(
        'div',
        {},
        h(
          'section',
          { class: 'bus' },
          h('div', { class: 'bus-roof' }, roof),
          seats,
          botRow,
          gameRow,
          firstRow,
          diffRow,
          trainRow,
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
        effort,
        h('section', { class: 'panel' }, h('h2', { class: 'label' }, 'Trainer'), trainerCheck()),
        startSlot,
        h('button', { class: 'ghost leave', onclick: c.leave }, 'Leave the bus'),
      ),
    ),
    pickerBox,
  )
  return Object.assign(el, { update })
}

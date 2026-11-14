import { TRAINING_PLANS } from '../content'
import { api } from '../core/api'
import type { Profile } from '../core/curve'
import { dayKey } from '../core/fitness'
import { saveProfile } from '../core/profile'
import {
  addDays,
  perWeek,
  schedule,
  sessionState,
  WEEKDAYS,
  workoutInfo,
  type RideLite,
  type Session,
  type SessionState,
} from '../core/trainingPlan'
import { h } from './dom'
import { modal } from './toast'

/** Opens a workout (by id) in the solo player. */
type Go = (workout: string) => void
const STATE: Record<SessionState, string> = {
  done: '✓ Done',
  missed: 'Missed',
  today: 'Today',
  upcoming: '',
}
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_DAYS = [2, 4, 6]

const dayLabel = (d: string) =>
  new Date(`${d}T12:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
const sub = (id: string) => {
  const i = workoutInfo(id)
  return `${Math.round(i.secs / 60)} min · ${i.tss} TSS`
}

/** Rides to match sessions against: the server's history, or this device's when offline. */
const loadRides = (p: Profile): Promise<RideLite[]> =>
  api<RideLite[]>('/api/rides').catch(() => p.rides)

/** The rider's plan and its sessions, or null when they are on none. */
function active(p: Profile) {
  const tp = p.plan && TRAINING_PLANS.find((x) => x.id === p.plan!.id)
  return tp ? { tp, sessions: schedule(tp, p.plan!) } : null
}

/** "Today's workout" on the Ride tab: today's session, or the next one, with a Start button. */
export function todayCard(p: Profile, go: Go, open: () => void) {
  const card = h('section', { class: 'panel today-plan' })
  const a = active(p)
  if (!a) return card
  const paint = (rides: RideLite[]) => {
    const today = dayKey(Date.now())
    const s = a.sessions.find((x) => x.date >= today)
    const st = s && sessionState(s, workoutInfo(s.workout), rides, today)
    const done = a.sessions.filter(
      (x) => sessionState(x, workoutInfo(x.workout), rides, today) === 'done',
    )
    card.replaceChildren(
      h('h2', { class: 'label' }, `${a.tp.emoji} ${a.tp.name}`),
      h(
        'div',
        { class: 'tp-row' },
        s
          ? h(
              'span',
              {},
              h(
                'small',
                { class: 'dim' },
                s.date === today ? 'Today’s workout' : `Rest day. Next up, ${dayLabel(s.date)}`,
              ),
              h('b', {}, workoutInfo(s.workout).name),
              h('small', { class: 'dim' }, sub(s.workout)),
            )
          : h(
              'span',
              {},
              h('b', {}, 'Plan finished!'),
              `${done.length} of ${a.sessions.length} sessions done.`,
            ),
        h('button', { class: 'ghost', onclick: open }, '📅 Calendar'),
        !s
          ? ''
          : st === 'done'
            ? h('span', { class: 'tp-done' }, '✓ Done. Nice work.')
            : h(
                'button',
                { class: 'primary', onclick: () => go(s.workout) },
                s.date === today ? 'Start' : 'Ride it now',
              ),
      ),
    )
  }
  paint([])
  loadRides(p).then(paint)
  return card
}

function sessionCell(s: Session | undefined, date: string, st: SessionState | 'rest', go: Go) {
  const kids = [h('small', {}, dayLabel(date))]
  if (!s) return h('div', { class: 'pl-day rest' }, ...kids, h('span', { class: 'dim' }, 'Rest'))
  const i = workoutInfo(s.workout)
  return h(
    'button',
    { class: `pl-day ${st}`, title: `Ride ${i.name}`, onclick: () => go(s.workout) },
    ...kids,
    h('b', {}, i.name),
    h('span', { class: 'dim' }, sub(s.workout)),
    h('em', {}, STATE[st as SessionState] ?? ''),
  )
}

/** The calendar: this plan week up top, then every week as a row of seven days. */
function calendar(p: Profile, go: Go, redraw: () => void) {
  const a = active(p)!
  const pick = p.plan!
  const root = h('div', { class: 'plan-cal' })
  const paint = (rides: RideLite[]) => {
    const today = dayKey(Date.now())
    const state = new Map(
      a.sessions.map((s) => [s.date, sessionState(s, workoutInfo(s.workout), rides, today)]),
    )
    const count = (k: SessionState) => [...state.values()].filter((v) => v === k).length
    const nowWeek = Math.floor(
      (Date.parse(`${today}T12:00`) - Date.parse(`${pick.start}T12:00`)) / 864e5 / 7,
    )
    const week = (w: number) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(pick.start, w * 7 + d)
        const s = a.sessions.find((x) => x.date === date)
        const cell = sessionCell(s, date, s ? state.get(date)! : 'rest', go)
        if (date === today) cell.classList.add('is-today')
        return cell
      })
    root.replaceChildren(
      h(
        'p',
        { class: 'lede' },
        nowWeek < 0
          ? `Starts ${dayLabel(pick.start)}.`
          : nowWeek >= a.tp.weeks.length
            ? 'Plan finished.'
            : `Week ${nowWeek + 1} of ${a.tp.weeks.length}.`,
        ` ${count('done')} done, ${count('missed')} missed, ${count('upcoming') + count('today')} to go.`,
      ),
      ...a.tp.weeks.map((_, w) =>
        h(
          'section',
          { class: `panel pl-week${w === nowWeek ? ' now' : ''}` },
          h(
            'h2',
            { class: 'label' },
            w === nowWeek ? `Week ${w + 1} · this week` : `Week ${w + 1}`,
          ),
          h('div', { class: 'pl-grid' }, ...week(w)),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          { onclick: () => ((pick.start = today), saveProfile(p), redraw()) },
          'Restart from today',
        ),
        h('button', { class: 'ghost danger', onclick: () => leave(p, redraw) }, 'Leave plan'),
      ),
    )
  }
  paint([])
  loadRides(p).then(paint)
  return root
}

function leave(p: Profile, redraw: () => void) {
  const close = modal(
    'Leave this plan?',
    h('p', {}, 'Your rides stay in your history. You can pick a plan again any time.'),
    h(
      'div',
      { class: 'row' },
      h('button', { onclick: () => close() }, 'Stay on it'),
      h(
        'button',
        { class: 'primary', onclick: () => (delete p.plan, saveProfile(p), close(), redraw()) },
        'Leave plan',
      ),
    ),
  )
}

/** Choose a plan, a start day and riding weekdays. */
function picker(p: Profile, redraw: () => void) {
  let id = TRAINING_PLANS[0].id
  const days = new Set(DEFAULT_DAYS)
  const date = h('input', { type: 'date', value: dayKey(Date.now()), 'aria-label': 'Start date' })
  const go = h('button', { class: 'primary' }, 'Start plan')
  const hint = h('p', { class: 'dim' })
  const cards = h('div', { class: 'pl-cards' })
  const dayBtns = h('div', { class: 'pl-days' })
  const paint = () => {
    const tp = TRAINING_PLANS.find((x) => x.id === id)!
    const need = perWeek(tp)
    cards.replaceChildren(
      ...TRAINING_PLANS.map((x) =>
        h(
          'button',
          { class: `pl-card${x.id === id ? ' on' : ''}`, onclick: () => ((id = x.id), paint()) },
          h('span', { class: 'big-emoji' }, x.emoji),
          h(
            'span',
            {},
            h('b', {}, x.name),
            h('small', {}, `${x.weeks.length} weeks · ${perWeek(x)} rides a week`),
            h('span', { class: 'dim' }, x.blurb),
          ),
        ),
      ),
    )
    dayBtns.replaceChildren(
      ...MON_FIRST.map((d) =>
        h(
          'button',
          {
            class: days.has(d) ? 'on' : '',
            'aria-pressed': String(days.has(d)),
            onclick: () => (days.has(d) ? days.delete(d) : days.add(d), paint()),
          },
          WEEKDAYS[d],
        ),
      ),
    )
    hint.textContent = `Pick at least ${need} days. ${days.size > need ? 'Spare days are rest days.' : ''}`
    go.disabled = days.size < need || !date.value
  }
  date.oninput = paint
  go.onclick = () => {
    p.plan = { id, start: date.value, days: [...days].sort() }
    saveProfile(p)
    redraw()
  }
  paint()
  return h(
    'div',
    {},
    cards,
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'label' }, 'When do you ride?'),
      dayBtns,
      hint,
      h('label', { class: 'pl-start' }, 'Start on ', date),
      go,
    ),
  )
}

/** The Training plan screen: the picker, or the calendar of the plan the rider is on. */
export function planScreen(p: Profile, go: Go, back: () => void) {
  const body = h('div')
  const redraw = () => {
    const a = active(p)
    scrollTo(0, 0)
    body.replaceChildren(
      h('h1', {}, a ? `${a.tp.emoji} ${a.tp.name}` : 'Training plans'),
      a ? calendar(p, go, redraw) : picker(p, redraw),
    )
  }
  redraw()
  return h(
    'div',
    { class: 'plan-screen' },
    h('button', { class: 'back', onclick: back }, '← Back'),
    body,
  )
}

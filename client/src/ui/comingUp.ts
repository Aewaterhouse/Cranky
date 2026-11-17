import { api } from '../core/api'
import { gameOf } from '../modes/crew/games'
import { h } from './dom'
import { toast } from './toast'

interface Planned {
  n: number
  at: string
  /** The crew game: the bus, or one that has gone on a ride planned before it went. */
  game: string
  note: string
  host: string
  hostName: string
  in: string[]
  names: string[]
}

const when = (at: string) =>
  new Date(`${at}Z`).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

/** An .ics file for a planned ride, so it lands in the rider's own calendar with a 10 minute reminder. */
function ics(p: Planned) {
  const t = p.at.replace(/[-:]/g, '') + '00Z'
  const name = gameOf(p.game)?.name ?? p.game
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cranky//EN',
    'BEGIN:VEVENT',
    `UID:cranky-${p.n}@cranky`,
    `DTSTAMP:${t}`,
    `DTSTART:${t}`,
    `SUMMARY:Cranky: ${name}`,
    `DESCRIPTION:${p.note || 'Crew ride'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${name} in 10 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = h('a', {
    href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })),
    download: `cranky-${p.n}.ics`,
  })
  a.click()
}

/**
 * Home's "Coming up": crew rides on the calendar with who is in, I'm in or out, a calendar file, and a form to
 * plan one. A toast says when one you are in starts within 15 minutes.
 */
export function comingUp(me: string) {
  const list = h('div', { class: 'feed' })
  const at = h('input', { type: 'datetime-local' })
  const note = h('input', { placeholder: 'A note (optional)', maxlength: 120 })
  // Quick picks: tonight, tomorrow morning, the weekend mornings.
  const local = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const at_ = (days: number, hour: number, min = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, min, 0, 0)
    return d
  }
  const nextDay = (dow: number) => (dow - new Date().getDay() + 7) % 7 || 7
  const chips = h(
    'span',
    { class: 'row' },
    ...(
      [
        ['Tonight 6:30 pm', at_(0, 18, 30)],
        ['Tomorrow 6 am', at_(1, 6)],
        ['Sat 7 am', at_(nextDay(6), 7)],
        ['Sun 7 am', at_(nextDay(0), 7)],
      ] as [string, Date][]
    ).map(([label, d]) =>
      h(
        'button',
        { type: 'button', class: 'chip-sel', onclick: () => (at.value = local(d)) },
        label,
      ),
    ),
  )
  const form = h(
    'form',
    {
      class: 'row plan-ride',
      hidden: true,
      onsubmit: (e: Event) => {
        e.preventDefault()
        if (!at.value) return at.focus()
        const utc = new Date(at.value).toISOString().slice(0, 16)
        api('/api/schedule', {
          method: 'POST',
          body: JSON.stringify({ at: utc, game: 'bus', note: note.value }),
        })
          .then(() => ((form.hidden = true), load()))
          .catch(() => toast('Could not plan that ride', 'bad'))
      },
    },
    chips,
    at,
    note,
    h('button', { class: 'primary' }, 'Plan it'),
  )
  const root = h(
    'section',
    { class: 'panel' },
    h(
      'h2',
      { class: 'label' },
      'Coming up',
      h('button', { class: 'link', onclick: () => (form.hidden = !form.hidden) }, ' + Plan a ride'),
    ),
    form,
    list,
  )
  const row = (p: Planned) => {
    const mine = p.in.includes(me)
    return h(
      'div',
      { class: 'feed-row' },
      h('span', { class: 'gc-icon' }, gameOf(p.game)?.icon ?? '🗓️'),
      h(
        'span',
        {},
        h('b', {}, `${gameOf(p.game)?.name ?? p.game} · ${when(p.at)}`),
        h('small', { class: 'dim' }, ` ${p.note ? `${p.note} · ` : ''}${p.names.join(', ')}`),
      ),
      h(
        'span',
        { class: 'row' },
        h('button', { class: 'ghost', title: 'Add to your calendar', onclick: () => ics(p) }, '📅'),
        p.host === me
          ? h(
              'button',
              {
                class: 'ghost',
                onclick: () => api(`/api/schedule/${p.n}`, { method: 'DELETE' }).then(load),
              },
              'Cancel',
            )
          : h(
              'button',
              {
                class: mine ? 'ghost' : 'primary',
                onclick: () =>
                  api(`/api/schedule/${p.n}/rsvp?on=${!mine}`, { method: 'POST' }).then(load),
              },
              mine ? "I'm out" : "I'm in",
            ),
      ),
    )
  }
  const load = () =>
    api<Planned[]>('/api/schedule')
      .then((ps) => {
        list.replaceChildren(
          ...(ps.length
            ? ps.map(row)
            : [
                h('p', { class: 'dim' }, 'Nothing planned. Plan a ride and the crew sees it here.'),
              ]),
        )
        const soon = ps.find(
          (p) =>
            p.in.includes(me) &&
            Date.parse(`${p.at}Z`) - Date.now() < 15 * 60000 &&
            Date.parse(`${p.at}Z`) > Date.now() - 600000,
        )
        if (soon)
          toast(
            `${gameOf(soon.game)?.name ?? 'Your ride'} starts ${when(soon.at)}. Open the lobby when the crew is ready.`,
            'good',
          )
      })
      .catch(() => (root.hidden = true))
  void load()
  return root
}

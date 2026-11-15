import { CFG } from '../config'
import { autoPosts, endWith, rideKeeper } from '../core/keepRide'
import type { RideSummary } from '../core/ride'
import { h } from './dom'
import { stravaKnown, stravaStatus } from './strava'
import { modal, toast } from './toast'

/**
 * The results screen's "keep this ride?" line: Discard ride (asks once), and when the ride would post to Strava
 * by itself, "Posting to Strava in 45 s · Don't post". Returns the bar and `keep`, which every way off the screen
 * calls first.
 */
export function keepBar(o: {
  rider: string
  s: RideSummary
  queued: boolean
  noPost: boolean
  restore: () => void
  leave: () => void
}) {
  const line = h('span', { class: 'dim' })
  const say = (...n: (Node | string)[]) => line.replaceChildren(...n)
  const k = rideKeeper({
    rider: o.rider,
    date: o.s.record.date,
    queued: o.queued,
    restore: o.restore,
    onTick: (left) => left > 0 && say(...posting(left)),
    onKept: () => {
      bin.hidden = true
      if (k.left() <= 0) say('Saved and sent to Strava.')
    },
  })
  const notPosting = () => say("Won't post to Strava. You can upload it from History later.")
  const posting = (left: number) => [
    `Posting to Strava in ${left} s · `,
    h('button', { class: 'linkish', onclick: () => (k.noPost(), notPosting()) }, "Don't post"),
  ]
  if (o.noPost) k.noPost()
  if (o.queued && !o.s.test)
    stravaStatus().then(
      (st) => {
        if (!autoPosts(st, o.s)) return
        if (o.noPost) return notPosting()
        say(...posting(CFG.stravaPostDelayS))
        k.countdown()
      },
      () => {},
    )
  const bin: HTMLElement = h(
    'button',
    {
      class: 'ghost danger',
      onclick: () => {
        const close = modal(
          'Bin this ride?',
          h('p', {}, "It won't be saved anywhere."),
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => close() }, 'Keep it'),
            h(
              'button',
              {
                class: 'danger',
                onclick: () => {
                  close()
                  k.bin()
                  toast('Ride binned. Nothing was saved.')
                  o.leave()
                },
              },
              'Bin it',
            ),
          ),
        )
      },
    },
    'Discard ride',
  )
  const el = h('div', { class: 'row res-keep' }, bin, line)
  // Any other way off the screen (a tab, the next crew ride) keeps the ride too.
  let seen = false
  const watch = setInterval(() => {
    if (k.state() !== 'open') return clearInterval(watch)
    if (seen && !el.isConnected) k.keep()
    seen ||= el.isConnected
  }, 1000)
  return { el, keep: k.keep }
}

/**
 * The end-ride confirm's extra ways out: Discard ride (a second tap confirms) and, when Strava would post the
 * ride by itself, End without posting. `end` ends the ride as End ride does.
 */
export function endButtons(end: () => void) {
  const ask = h('p', { class: 'dim', hidden: true }, "Bin this ride? It won't be saved anywhere.")
  const bin: HTMLElement = h(
    'button',
    {
      class: 'danger',
      onclick: () => {
        if (ask.hidden) return ((ask.hidden = false), (bin.textContent = 'Bin it'))
        endWith('bin')
        end()
      },
    },
    'Discard ride',
  )
  const st = stravaKnown()
  const noPost = h(
    'button',
    { onclick: () => (endWith('noPost'), end()) },
    "End, don't post to Strava",
  )
  return { ask, buttons: st?.connected && st.auto ? [bin, noPost] : [bin] }
}

/** Asks Strava's state at the start of a ride, so the end-ride confirm knows it at once. */
export const warmStrava = () => void stravaStatus().catch(() => {})

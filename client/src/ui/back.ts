import { toast } from './toast'

/**
 * The browser's (or phone's) Back button inside a screen that has no address of its own: the screen registers what
 * Back should do, and a history entry is added so Back lands here instead of leaving the app. Tabs use the address.
 */
let back: (() => void) | null = null
let skip = false

globalThis.addEventListener?.('popstate', () => {
  if (skip) return void (skip = false)
  const f = back
  back = null
  f?.()
})

/** Back runs `fn` (once). Null forgets it, taking our history entry with it. */
export function setBack(fn: (() => void) | null) {
  if (fn && !back) history.pushState({ cranky: 1 }, '')
  if (!fn && back && history.state?.cranky) {
    skip = true
    history.back()
  }
  back = fn
}

/** During a ride Back does nothing but say how to leave, so a stray swipe never ends the ride. */
export function holdBack(how = 'Use the menu (☰) to end the ride.') {
  setBack(() => {
    toast(how)
    holdBack(how)
  })
}

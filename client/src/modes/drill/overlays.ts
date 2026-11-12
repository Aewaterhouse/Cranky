import { fmt } from '../../ui/dom'
import type { Frame } from '../../types'

export type Overlay = [string | null, string?, string?]

export interface OverlayCtx {
  f: Frame
  power: number
  paused: boolean
  completing: boolean
  grace: number
  manual: boolean
  ergOn: boolean
  /** Whole seconds until a sprint, when one is 1-3 s away. */
  sprintIn: number
  reconnecting: boolean
}

/** The big centred message for the current moment of the ride, or none. */
export function pickOverlay(c: OverlayCtx): Overlay {
  if (c.reconnecting)
    return [
      'Trainer disconnected, reconnecting…',
      'Keep pedalling, we will carry on when it is back.',
      'pause',
    ]
  if (c.completing)
    return [
      'WORKOUT COMPLETE',
      `Finishing in ${Math.ceil(c.grace)} s. Add easy minutes to keep spinning.`,
      'pause',
    ]
  if (c.paused)
    return [
      'PAUSED',
      c.manual
        ? `Press Space to resume.${c.ergOn ? ' ERG is easing off.' : ''}`
        : 'Auto-paused. Start pedalling to carry on.',
      'pause',
    ]
  if (c.f.type === 'sprint')
    return ['SPRINT!', `ERG OFF · ${Math.round(c.power)} W · ${fmt(c.f.dur - c.f.bel)}`, 'sprint']
  if (c.sprintIn > 0 && c.sprintIn <= 3)
    return [String(c.sprintIn), 'Sprint next. ERG switches off', 'count']
  return [null]
}

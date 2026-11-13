import { onClickShift } from '../../trainer/zwiftClick'
import type { RideMode } from '../../ui/soloMode'

export interface KeyActions {
  pause: () => void
  skip: () => void
  end: () => void
  /** Intensity step: +0.01 or -0.01. */
  bump: (d: number) => void
  mode: (k: RideMode) => void
  /** Level or gradient step: +1 or -1. */
  step: (d: number) => void
  /** Virtual gear: +1 (X) or -1 (Z). */
  gear: (d: number) => void
}

const MODES: Record<string, RideMode> = { e: 'erg', r: 'res', g: 'slope' }

/** Keyboard handler for the solo player. `skipOnArrow` is off with the simulator, whose arrows steer it. */
export function soloKeys(on: KeyActions, skipOnArrow: boolean) {
  return (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return
    const k = e.key
    const mode = MODES[k.toLowerCase()]
    const act =
      k === ' ' || k === 'p' || k === 'P'
        ? on.pause
        : k === 'n' || k === 'N' || (k === 'ArrowRight' && skipOnArrow)
          ? on.skip
          : k === '+' || k === '='
            ? () => on.bump(0.01)
            : k === '-' || k === '_'
              ? () => on.bump(-0.01)
              : k === 'Escape'
                ? on.end
                : k === ',' || k === '.'
                  ? () => on.step(k === '.' ? 1 : -1)
                  : k === 'z' || k === 'Z' || k === 'x' || k === 'X'
                    ? () => on.gear(k.toLowerCase() === 'x' ? 1 : -1)
                    : mode
                      ? () => on.mode(mode)
                      : undefined
    if (!act) return
    act()
    e.preventDefault()
  }
}

/** Zwift Click in the solo player: gears in slope mode, intensity in ERG, level in resistance. Returns the unsubscribe. */
export const soloClick = (on: KeyActions, kind: () => RideMode) =>
  onClickShift((d) =>
    kind() === 'slope' ? on.gear(d) : kind() === 'erg' ? on.bump(d / 100) : on.step(d),
  )

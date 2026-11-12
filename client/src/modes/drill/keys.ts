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
                  : mode
                    ? () => on.mode(mode)
                    : undefined
    if (!act) return
    act()
    e.preventDefault()
  }
}

import type { FreePart } from '../../ui/freeRideView'

const HUD_KEYS: Record<string, FreePart> = { h: 'clean', s: 'stats', m: 'map', r: 'riders' }

export interface FreeKeyActions {
  pause(): void
  end(): void
  /** Trainer difficulty up or down by this much. */
  nudge(d: number): void
  /** Virtual gear up (1) or down (-1). */
  shift(d: number): void
  /** Shift strength down (-1) or up (1) a step. */
  strength(d: number): void
  toggle(part: FreePart): void
}

/** The free-ride key map: Space or P pause, Esc end, + and - difficulty, Z and X gears, ; and ' shift strength, H S M R the HUD parts. */
export const freeKeys = (on: FreeKeyActions) => (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || e.ctrlKey || e.metaKey) return
  const k = e.key.toLowerCase()
  const act =
    k === ' ' || k === 'p'
      ? on.pause
      : k === 'escape'
        ? on.end
        : k === '+' || k === '='
          ? () => on.nudge(0.05)
          : k === '-' || k === '_'
            ? () => on.nudge(-0.05)
            : k === 'z' || k === 'x'
              ? () => on.shift(k === 'x' ? 1 : -1)
              : k === ';' || k === "'"
                ? () => on.strength(k === "'" ? 1 : -1)
              : k in HUD_KEYS
                ? () => on.toggle(HUD_KEYS[k])
                : null
  if (!act) return
  act()
  e.preventDefault()
}

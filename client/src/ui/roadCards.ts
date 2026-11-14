import { gapText, type ListRider } from '../core/hud'
import type { RideStats } from '../net/protocol'
import { crewCards, type CardRider } from './crewCards'

/**
 * Group free rides (and their TV view) as crew cards: watts, heart rate and the gap to me on each card; FTP,
 * weight and cadence when one is opened. There is no target, so no compliance bar. My own ride so far comes
 * from my own recording (`mine`); the server does not send one for road rides.
 */
export function roadCards(cls = '') {
  const col = crewCards(`road ${cls}`)
  return {
    root: col.root,
    /** Gaps are to `from` (me, or on the TV the rider followed), in time at `speed` m/s. */
    set(riders: ListRider[], meId: string, speed: number, mine?: RideStats, from = meId) {
      const me = riders.find((r) => r.id === from)
      const rows: CardRider[] = riders
        .filter((r) => !r.ghost)
        .map((r) => ({
          id: r.id,
          name: r.name,
          tier: r.tag,
          w: r.power ?? 0,
          st: r.st === 'away' ? 'away' : 'riding',
          note:
            r.st === 'finished'
              ? 'finished'
              : me && r !== me
                ? gapText(r.d - me.d, speed)
                : undefined,
          hr: r.hr,
          cad: r.cadence,
          ftp: r.ftp,
          kg: r.kg,
          stats: r.id === meId ? mine : undefined,
        }))
      col.update(rows, meId)
    },
  }
}

import { TIER_NAME } from '../types'
import { CFG } from '../config'
import { crewShares } from '../core/hud'
import { rideShares } from '../core/crewStats'
import type { RideStats, Tick } from '../net/protocol'
import { crewCards, type CardRider } from './crewCards'

/**
 * The crew on the bus, as cards down the right edge (see `crewCards`): watts and share of the crew's,
 * compliance (or the haul-back countdown while fallen), heart rate and ERG or gears. 💪 marks whoever
 * carries most while someone is off the bus.
 */
export function makeRoster(cls = 'crew') {
  const col = crewCards(cls)
  const fellAt = new Map<string, number>()
  // The ride so far comes once a second; keep the last for the ticks in between.
  let stats: Record<string, RideStats> = {}
  let shares: Record<string, number> = {}
  return {
    root: col.root,
    update({ riders, el, stats: st }: Pick<Tick, 'riders' | 'el' | 'stats'>, meId: string) {
      if (st) {
        stats = st
        shares = rideShares(st)
      }
      const { share, carrier } = crewShares(riders)
      const rows: CardRider[] = Object.entries(riders).map(([id, r]) => {
        if (r.st === 'fell' && !fellAt.has(id)) fellAt.set(id, el)
        if (r.st !== 'fell') fellAt.delete(id)
        const left = Math.max(0, CFG.hud.cards.haulS - (el - (fellAt.get(id) ?? el)))
        return {
          id,
          name: r.name,
          tier: TIER_NAME[r.tier][0],
          w: r.w,
          st: r.st,
          s: r.s,
          note:
            r.st === 'fell'
              ? `fell · ${Math.ceil(left)} s`
              : r.st === 'spectator'
                ? 'watching'
                : undefined,
          hr: r.hr,
          hrp: r.hrp,
          erg: r.erg ?? true,
          share: share[id],
          carrier: id === carrier,
          tgt: r.tgt,
          cad: r.cad,
          stats: stats[id],
          rideShare: shares[id],
        }
      })
      col.update(rows, meId)
    },
  }
}

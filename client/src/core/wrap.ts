import type { RideRecord } from './curve'

/** A month of riding in a few numbers: rides, hours, kJ, the most ridden workout, the longest ride and the best 20 min. */
export function monthWrap(rides: RideRecord[], now = new Date()) {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`
  const mine = rides.filter((r) => key(new Date(r.date)) === key(now))
  if (!mine.length) return null
  const count = new Map<string, number>()
  for (const r of mine) if (r.plan) count.set(r.plan, (count.get(r.plan) ?? 0) + 1)
  const fav = [...count].sort((a, b) => b[1] - a[1])[0]
  return {
    month: now.toLocaleDateString('en-AU', { month: 'long' }),
    rides: mine.length,
    hours: Math.round(mine.reduce((a, r) => a + r.secs, 0) / 360) / 10,
    kj: Math.round(mine.reduce((a, r) => a + r.kj, 0)),
    fav: fav && fav[1] > 1 ? fav[0] : null,
    longest: Math.round(Math.max(...mine.map((r) => r.secs)) / 60),
    best20: Math.max(0, ...mine.map((r) => r.best[1200] ?? 0)) || null,
  }
}

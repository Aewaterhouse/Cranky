import { api } from '../../core/api'

/** Per-second power from the rider's most recent solo attempt at this workout, or null. */
export async function loadGhost(planName: string): Promise<number[] | null> {
  try {
    const rows =
      await api<{ id: number; plan: string; crew: boolean; secs: number }[]>('/api/rides')
    const last = rows.find((r) => r.plan === planName && !r.crew && r.secs > 300)
    if (!last) return null
    const ride = await api<{ power?: number[] }>(`/api/rides/${last.id}`)
    return ride.power?.length ? ride.power : null
  } catch {
    return null
  }
}

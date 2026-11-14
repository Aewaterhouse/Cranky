import { encodeFit } from '../core/fit'
import type { RideSummary } from '../core/ride'
import { rideTrack } from '../core/rideTrack'
import { saveFile } from './saveFile'

/** The ride as a .fit file; a free ride on a route this device still has gets its map position too. */
export const fitBytes = async (s: RideSummary) =>
  encodeFit({
    start: s.record.date,
    power: s.power,
    cadence: s.cadence ?? [],
    hr: s.hr,
    np: s.np,
    tss: s.tss,
    intensity: s.if,
    ...(await rideTrack(s).catch(() => ({}))),
  })

/** Downloads the ride as a .fit file. */
export async function downloadFit(s: RideSummary) {
  const bytes = await fitBytes(s)
  return saveFile(
    new Blob([bytes as BlobPart], { type: 'application/octet-stream' }),
    `cranky-${s.record.date.slice(0, 16).replace(':', '')}.fit`,
  )
}

/** Downloads the full summary as JSON. */
export const downloadJson = (s: RideSummary) =>
  saveFile(
    new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
    `ride-${s.record.date.slice(0, 16).replace(':', '')}.json`,
  )

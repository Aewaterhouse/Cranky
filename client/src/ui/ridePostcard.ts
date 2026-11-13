import type { RideSummary } from '../core/ride'
import { segClock } from '../core/segments'
import { climbLabel, distLabel, type Units } from '../core/units'

const W = 1200
const H = 800
const PHOTO_H = 560

/** The headline numbers on a free ride's postcard. */
export function postcardTiles(
  s: RideSummary,
  kg: number,
  units: Units = 'metric',
): [label: string, value: string][] {
  const prs = s.segments?.filter((r) => r.pr).length ?? 0
  return [
    ['Distance', distLabel(s.distance ?? 0, units)],
    ['Climbed', climbLabel(s.ascent ?? 0, units)],
    ['Time', segClock(s.record.secs)],
    ['Avg power', `${s.avgPower} W`],
    ['W/kg', (s.avgPower / kg).toFixed(2)],
    ...(prs ? [['PRs', String(prs)] as [string, string]] : []),
  ]
}

/**
 * A postcard of a free ride: the still taken at the lookout or the finish (or, without one, the ride's power as
 * a skyline) with the route name, the date and the headline numbers.
 */
export async function ridePostcard(
  s: RideSummary,
  kg: number,
  image?: string,
  units: Units = 'metric',
) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!
  const sky = x.createLinearGradient(0, 0, 0, PHOTO_H)
  sky.addColorStop(0, '#2b3a55')
  sky.addColorStop(1, '#e8a86b')
  x.fillStyle = sky
  x.fillRect(0, 0, W, PHOTO_H)
  const img = new Image()
  if (image) {
    img.src = image
    await img.decode().catch(() => {})
  }
  if (img.width) {
    const k = Math.max(W / img.width, PHOTO_H / img.height)
    x.drawImage(
      img,
      (W - img.width * k) / 2,
      (PHOTO_H - img.height * k) / 2,
      img.width * k,
      img.height * k,
    )
  } else if (s.power.length > 1) {
    // No still (the 2D layout): the ride's power drawn as a range of hills.
    const top = Math.max(1, ...s.power)
    x.fillStyle = '#1f2a22'
    x.beginPath()
    x.moveTo(0, PHOTO_H)
    s.power.forEach((p, i) =>
      x.lineTo((i / (s.power.length - 1)) * W, PHOTO_H - 60 - (p / top) * (PHOTO_H - 200)),
    )
    x.lineTo(W, PHOTO_H)
    x.fill()
  }
  x.fillStyle = '#15161a'
  x.fillRect(0, PHOTO_H, W, H - PHOTO_H)
  x.fillStyle = '#f2b705'
  x.fillRect(0, PHOTO_H, W, 6)
  x.font = "400 54px 'Bungee', Impact, system-ui"
  x.fillStyle = '#f3f0e6'
  x.fillText(s.route?.name ?? s.planName, 40, PHOTO_H + 78, W - 300)
  x.font = '600 24px system-ui'
  x.fillStyle = '#9c998f'
  const date = new Date(s.record.date).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  x.fillText(date, 40, PHOTO_H + 116)
  x.textAlign = 'right'
  x.font = "400 30px 'Bungee', Impact, system-ui"
  x.fillStyle = '#f2b705'
  x.fillText('CRANKY', W - 40, PHOTO_H + 74)
  x.textAlign = 'left'
  const tiles = postcardTiles(s, kg, units)
  tiles.forEach(([label, value], i) => {
    const at = 40 + (i * (W - 80)) / tiles.length
    x.font = '600 18px system-ui'
    x.fillStyle = '#9c998f'
    x.fillText(label.toUpperCase(), at, PHOTO_H + 168)
    x.font = '700 38px system-ui'
    x.fillStyle = '#f3f0e6'
    x.fillText(value, at, PHOTO_H + 212)
  })
  return c
}

/** Downloads a canvas as a PNG. */
export function savePng(c: HTMLCanvasElement, name: string) {
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `${name}.png`
  a.click()
}

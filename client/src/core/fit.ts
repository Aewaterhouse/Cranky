/**
 * Minimal FIT activity encoder: one cycling session with per-second power, cadence and heart rate. A ride with
 * a `track` (free ride on a route) also gets position, altitude, distance and speed, and a lap message per lap.
 */

const FIT_EPOCH = 631065600 // seconds between the Unix epoch and 1989-12-31T00:00:00Z
const ENUM = 0x00
const U8 = 0x02
const U16 = 0x84
const U32 = 0x86
const S32 = 0x85
const SIZE: Record<number, number> = { [ENUM]: 1, [U8]: 1, [U16]: 2, [U32]: 4, [S32]: 4 }
const SEMI = 2 ** 31 / 180 // degrees to FIT semicircles
type Field = [num: number, type: number, value: number]

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
  0x5000, 0x9c01, 0x8801, 0x4400,
]
export function fitCrc(bytes: ArrayLike<number>, crc = 0): number {
  for (let i = 0; i < bytes.length; i++) {
    for (const nibble of [bytes[i] & 0xf, bytes[i] >> 4]) {
      const t = CRC_TABLE[crc & 0xf]
      crc = ((crc >> 4) & 0x0fff) ^ t ^ CRC_TABLE[nibble]
    }
  }
  return crc
}

export interface FitRide {
  /** ISO start time. */
  start: string
  power: number[]
  cadence: number[]
  /** Per-second heart rate; null or missing where there was no strap. */
  hr?: (number | null)[]
  np?: number
  tss?: number
  intensity?: number
  /** Where the rider was at each recorded second: degrees, metres above sea level, metres ridden. */
  track?: { lat: number; lon: number; ele: number; dist: number }[]
  /** Lap rides: the length of a lap in metres. Needs `track`. */
  lapM?: number
}

/** Returns the bytes of a .fit activity file. */
export function encodeFit(r: FitRide): Uint8Array {
  const out: number[] = []
  const defined = new Map<number, string>()
  const put = (v: number, size: number) => {
    for (let i = 0; i < size; i++) out.push((v >>> (8 * i)) & 0xff)
  }
  /** Writes a data message, preceded by its definition whenever the local type's layout changes. */
  const msg = (local: number, global: number, fields: Field[]) => {
    const sig = `${global}:${fields.map(([n, t]) => `${n}.${t}`).join()}`
    if (defined.get(local) !== sig) {
      defined.set(local, sig)
      out.push(0x40 | local, 0, 0)
      put(global, 2)
      out.push(fields.length)
      for (const [n, t] of fields) out.push(n, SIZE[t], t)
    }
    out.push(local)
    for (const [, t, v] of fields)
      put(t === S32 ? Math.round(v) : Math.max(0, Math.round(v)), SIZE[t])
  }

  const n = r.power.length
  const t0 = Math.floor(Date.parse(r.start) / 1000) - FIT_EPOCH
  const t1 = t0 + Math.max(0, n - 1)
  const ms = n * 1000
  const hr = (r.hr ?? []).filter((x): x is number => x != null && x > 0)
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)

  msg(0, 0, [
    [0, ENUM, 4],
    [1, U16, 255],
    [2, U16, 0],
    [4, U32, t0],
  ])
  const tr = r.track?.length === n && n ? r.track : undefined
  const lapEnds: number[] = [] // index of the last record of each finished lap
  for (let i = 0; i < n; i++) {
    const at = tr?.[i]
    msg(1, 20, [
      [253, U32, t0 + i],
      ...(at
        ? ([
            [0, S32, at.lat * SEMI],
            [1, S32, at.lon * SEMI],
            [2, U16, (at.ele + 500) * 5],
            [5, U32, at.dist * 100],
            [6, U16, (at.dist - (tr![i - 1]?.dist ?? 0)) * 1000],
          ] as Field[])
        : []),
      [3, U8, r.hr?.[i] || 0xff],
      [4, U8, Math.min(254, r.cadence[i] ?? 0)],
      [7, U16, r.power[i]],
    ])
    if (at && r.lapM && i < n - 1 && Math.floor(tr![i + 1].dist / r.lapM) > lapEnds.length)
      lapEnds.push(i)
  }
  const totals: Field[] = [
    [253, U32, t1],
    [2, U32, t0],
    [7, U32, ms],
    [8, U32, ms],
  ]
  const distM = tr ? tr[n - 1].dist : 0
  let up = 0
  for (let i = 1; tr && i < n; i++) up += Math.max(0, tr[i].ele - tr[i - 1].ele)
  if (!tr)
    msg(2, 19, [
      ...totals,
      [0, ENUM, 9],
      [1, ENUM, 1],
      [19, U16, mean(r.power)],
      [20, U16, Math.max(0, ...r.power)],
    ])
  // With a track: one lap message per lap ridden (the last one may be part of a lap).
  let from = 0
  for (const [k, to] of (tr ? [...lapEnds, n - 1] : []).entries()) {
    const pw = r.power.slice(from, to + 1)
    msg(2, 19, [
      [254, U16, k],
      [253, U32, t0 + to],
      [2, U32, t0 + from],
      [7, U32, (to + 1 - from) * 1000],
      [8, U32, (to + 1 - from) * 1000],
      [9, U32, (tr![to].dist - (from ? tr![from - 1].dist : 0)) * 100],
      [0, ENUM, 9],
      [1, ENUM, 1],
      [19, U16, mean(pw)],
      [20, U16, Math.max(0, ...pw)],
    ])
    from = to + 1
  }
  msg(3, 18, [
    ...totals,
    [0, ENUM, 8],
    [1, ENUM, 1],
    [5, ENUM, 2],
    [6, ENUM, tr ? 58 : 6],
    [20, U16, mean(r.power)],
    [21, U16, Math.max(0, ...r.power)],
    [18, U8, mean(r.cadence)],
    [16, U8, hr.length ? mean(hr) : 0xff],
    [17, U8, hr.length ? Math.max(...hr) : 0xff],
    [34, U16, r.np ?? 0xffff],
    [35, U16, r.tss != null ? r.tss * 10 : 0xffff],
    [36, U16, r.intensity != null ? r.intensity * 1000 : 0xffff],
    [48, U32, r.power.reduce((s, v) => s + v, 0)],
    [25, U16, 0],
    [26, U16, tr ? lapEnds.length + 1 : 1],
    ...(tr
      ? ([
          [9, U32, distM * 100],
          [22, U16, up],
          [14, U16, (distM / n) * 1000],
        ] as Field[])
      : []),
  ])
  msg(4, 34, [
    [253, U32, t1],
    [0, U32, ms],
    [1, U16, 1],
    [2, ENUM, 0],
    [3, ENUM, 26],
    [4, ENUM, 1],
  ])

  const head = [14, 0x10, 2132 & 0xff, 2132 >> 8, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54]
  for (let i = 0; i < 4; i++) head[4 + i] = (out.length >>> (8 * i)) & 0xff
  const hc = fitCrc(head)
  const body = [...head, hc & 0xff, hc >> 8, ...out]
  const crc = fitCrc(body)
  return Uint8Array.from([...body, crc & 0xff, crc >> 8])
}

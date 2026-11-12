import { CFG } from '../config'

const HR_SERVICE = 0x180d
const HR_MEASURE = 0x2a37

/** Heart Rate Measurement: flags bit 0 set means a uint16 value follows, otherwise uint8. */
export function parseHr(v: DataView): number {
  return v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1)
}

/** One step of the simulated HR: resting 60 rising towards ~175 at FTP, lagging by `lagS`. */
export function simHrStep(hr: number, watts: number, ftp: number, dt: number): number {
  const { rest, atFtp, max, lagS } = CFG.hr
  const target = Math.min(max, rest + ((atFtp - rest) * watts) / Math.max(1, ftp))
  return hr + (target - hr) * (1 - Math.exp(-dt / lagS))
}

export interface HrSource {
  name: string
  onBpm(cb: (bpm: number | null) => void): void
  close(): void
}

/** Simulated strap: samples `watts()` once a second. */
export class SimHr implements HrSource {
  name = 'Simulated heart rate'
  private hr = CFG.hr.rest
  private cb: (bpm: number | null) => void = () => {}
  private timer = setInterval(() => {
    this.hr = simHrStep(this.hr, this.watts(), this.ftp(), 1)
    this.cb(Math.round(this.hr))
  }, 1000)
  constructor(
    private watts: () => number,
    private ftp: () => number,
  ) {}
  onBpm(cb: (bpm: number | null) => void) {
    this.cb = cb
    cb(Math.round(this.hr))
  }
  close() {
    clearInterval(this.timer)
  }
}

/** Web Bluetooth heart-rate strap with the same retry-with-backoff reconnect as the trainer. */
export class BleHr implements HrSource {
  name = 'Heart-rate strap'
  private dev?: BluetoothDevice
  private cb: (bpm: number | null) => void = () => {}
  private closed = false
  private reconnecting = false

  async connect() {
    this.dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [HR_SERVICE] }] })
    this.name = this.dev.name ?? this.name
    this.dev.addEventListener('gattserverdisconnected', () => void this.reconnect())
    await this.attach()
  }

  private async attach() {
    const server = await this.dev!.gatt!.connect()
    const svc = await server.getPrimaryService(HR_SERVICE)
    const ch = await svc.getCharacteristic(HR_MEASURE)
    ch.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value
      if (v) this.cb(parseHr(v))
    })
    await ch.startNotifications()
  }

  private async reconnect() {
    if (this.closed || this.reconnecting) return
    this.reconnecting = true
    this.cb(null)
    const wait = CFG.hr.backoffMs
    for (let i = 0; !this.closed; i++) {
      await new Promise((r) => setTimeout(r, wait[Math.min(i, wait.length - 1)]))
      if (this.closed) break
      try {
        await this.attach()
        break
      } catch {
        try {
          this.dev?.gatt?.disconnect()
        } catch {
          /* already gone */
        }
      }
    }
    this.reconnecting = false
  }

  onBpm(cb: (bpm: number | null) => void) {
    this.cb = cb
  }
  close() {
    this.closed = true
    if (this.dev?.gatt?.connected) this.dev.gatt.disconnect()
  }
}

let src: HrSource | null = null
let bpm: number | null = null
const subs = new Set<() => void>()

/** Latest bpm of the paired strap, or null (none paired, or the link is down). */
export const currentHr = () => bpm
export const hrSource = () => src
export const onHrChange = (f: () => void) => (subs.add(f), () => subs.delete(f))

/** Replaces the paired strap (null disconnects). */
export function setHr(s: HrSource | null) {
  src?.close()
  src = s
  bpm = null
  s?.onBpm((v) => {
    if (src !== s) return
    bpm = v
    subs.forEach((f) => f())
  })
  subs.forEach((f) => f())
}

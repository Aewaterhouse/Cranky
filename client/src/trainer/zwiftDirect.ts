import { CFG } from '../config'

/**
 * EXPERIMENTAL, trainer check page only (foundation plan 2.5): send a virtual gear ratio straight to a Zwift-protocol
 * trainer (Zwift Hub, JetBlack Victory, KICKR CORE). Bytes from docs/zwift-gear-protocol.md. No ride imports this;
 * rides write to the trainer only through ergController.ts.
 */

const Z = (n: number) => `0000000${n}-19ca-4651-86e5-fa29dcdd09d1`
export const ZWIFT_SERVICES = [Z(1), 0xfc82] as const
const FTMS = 0x1826
const FTMS_CONTROL = 0x2ad9
const RX = Z(3)
const MEASURE = Z(2)
const REPLY = Z(4)

export const varint = (n: number) => {
  const out: number[] = []
  do {
    out.push((n & 0x7f) | (n > 0x7f ? 0x80 : 0))
    n = Math.floor(n / 128)
  } while (n > 0)
  return out
}
const zigzag = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1)
/** HubCommand (0x04) with one length-delimited field `tag` holding field 2 = `v` (varint). */
const command = (tag: number, v: number) => {
  const body = [0x10, ...varint(v)]
  return [0x04, tag, body.length, ...body]
}

export const RIDE_ON = [...'RideOn'].map((c) => c.charCodeAt(0)).concat(0x02, 0x01)
export const START = [0x41, 0x08, 0x05]
export const READ_GEAR = [0x00, 0x08, 0x88, 0x04]
/** PhysicalParam: gear ratio × 10000. */
export const gearMsg = (ratio: number) => command(0x2a, Math.round(ratio * 10000))
/** SimulationParam: incline % × 100, zigzag encoded. */
export const inclineMsg = (pct: number) => command(0x22, zigzag(Math.round(pct * 100)))
export const hex = (b: ArrayLike<number>) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ')

/** Varint fields of a protobuf body (other wire types skipped). */
export function fields(b: Uint8Array, from = 1) {
  const out: Record<number, number> = {}
  let i = from
  const read = () => {
    let v = 0
    let m = 1
    while (i < b.length) {
      const x = b[i++]
      v += (x & 0x7f) * m
      m *= 128
      if (!(x & 0x80)) break
    }
    return v
  }
  while (i < b.length) {
    const key = read()
    const wire = key & 7
    if (wire === 0) out[key >> 3] = read()
    else if (wire === 2) i += read()
    else break
  }
  return out
}

/** One Zwift-protocol session: every byte both ways goes to `log`. */
export class ZwiftDirect {
  private dev?: BluetoothDevice
  private rx?: BluetoothRemoteGATTCharacteristic
  private ftms?: BluetoothRemoteGATTCharacteristic
  private subs: BluetoothRemoteGATTCharacteristic[] = []
  gear: number = CFG.gears.start
  onRiding: (power: number, cadence: number) => void = () => {}

  constructor(private log: (dir: '→' | '←' | '·', text: string) => void) {}

  get on() {
    return !!this.rx
  }

  private async write(c: BluetoothRemoteGATTCharacteristic, bytes: number[], what: string) {
    this.log('→', `${what}: ${hex(bytes)}`)
    await c.writeValueWithResponse(new Uint8Array(bytes))
  }

  private listen(c: BluetoothRemoteGATTCharacteristic, name: string) {
    c.addEventListener('characteristicvaluechanged', () => {
      const v = c.value
      if (!v) return
      const b = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      this.log('←', `${name}: ${hex(b)}`)
      if (name === 'riding' && b[0] === 0x03) {
        const f = fields(b)
        this.onRiding(f[1] ?? 0, f[2] ?? 0)
      }
    })
    this.subs.push(c)
    return c.startNotifications()
  }

  /** Pick the trainer, find the Zwift service, and run the handshake: RideOn, start, incline 0, the middle gear. */
  async start() {
    this.dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS] }],
      optionalServices: [...ZWIFT_SERVICES],
    })
    this.log('·', `Picked ${this.dev.name ?? 'trainer'}`)
    const gatt = await this.dev.gatt!.connect()
    let svc: BluetoothRemoteGATTService | undefined
    for (const u of ZWIFT_SERVICES) svc ??= await gatt.getPrimaryService(u).catch(() => undefined)
    if (!svc) throw new Error('No Zwift service on this trainer: it does not support direct gears.')
    this.log('·', `Zwift service ${svc.uuid}`)
    this.ftms = await (await gatt.getPrimaryService(FTMS)).getCharacteristic(FTMS_CONTROL)
    await this.listen(this.ftms, 'ftms')
    await this.listen(await svc.getCharacteristic(MEASURE), 'riding')
    await this.listen(await svc.getCharacteristic(REPLY), 'reply')
    this.rx = await svc.getCharacteristic(RX)
    await this.write(this.rx, RIDE_ON, 'RideOn')
    await this.write(this.rx, START, 'start')
    await this.write(this.rx, inclineMsg(0), 'incline 0%')
    await this.setGear(this.gear)
  }

  /** Gear 1-24 from CFG.gears.ratios, then ask the trainer to read it back. */
  async setGear(gear: number) {
    if (!this.rx) return
    this.gear = gear
    const r = CFG.gears.ratios[gear - 1]
    await this.write(this.rx, gearMsg(r), `gear ${gear} (${r})`)
    await this.write(this.rx, READ_GEAR, 'read gear')
  }

  /** Does the FTMS control point still answer? (One source saw it stop after RideOn.) */
  async checkFtms() {
    if (this.ftms) await this.write(this.ftms, [0x00], 'FTMS request control')
  }

  /**
   * Back to normal: middle gear and a flat road, then drop the link. No source has a "leave Zwift mode" message, so
   * disconnecting is the only sure way back; the ride page's own FTMS connection reconnects by itself.
   */
  async stop() {
    try {
      if (this.rx) {
        await this.write(this.rx, gearMsg(CFG.gears.ratios[CFG.gears.start - 1]), 'middle gear')
        await this.write(this.rx, inclineMsg(0), 'incline 0%')
      }
      for (const c of this.subs) await c.stopNotifications().catch(() => {})
    } finally {
      this.rx = this.ftms = undefined
      this.subs = []
      this.dev?.gatt?.disconnect()
      this.log('·', 'Disconnected')
    }
  }
}

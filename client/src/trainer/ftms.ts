import type { Trainer } from '../types'

const FTMS = 0x1826
const BIKE_DATA = 0x2ad2
const CONTROL = 0x2ad9

/** Web Bluetooth FTMS driver (Wahoo, Jet Black and friends). */
export class FtmsTrainer implements Trainer {
  name = 'Trainer'
  private ctrl?: BluetoothRemoteGATTCharacteristic
  private dev?: BluetoothDevice
  private dataCb: (d: { power: number; cadence: number }) => void = () => {}
  private discCb: () => void = () => {}
  private queue: Promise<unknown> = Promise.resolve()
  private haveControl = false

  async connect() {
    this.dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [FTMS] }] })
    this.name = this.dev.name ?? 'Trainer'
    this.dev.addEventListener('gattserverdisconnected', () => this.discCb())
    const server = await this.dev.gatt!.connect()
    const svc = await server.getPrimaryService(FTMS)
    const data = await svc.getCharacteristic(BIKE_DATA)
    data.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value
      if (v) this.dataCb(parseBikeData(v))
    })
    await data.startNotifications()
    this.ctrl = await svc.getCharacteristic(CONTROL)
    await this.ctrl.startNotifications().catch(() => {})
  }

  onData(cb: (d: { power: number; cadence: number }) => void) {
    this.dataCb = cb
  }
  onDisconnect(cb: () => void) {
    this.discCb = cb
  }

  private write(bytes: number[]) {
    const run = () => this.ctrl!.writeValueWithResponse(new Uint8Array(bytes))
    this.queue = this.queue.then(run, run)
    return this.queue as Promise<void>
  }

  async requestControl() {
    if (this.haveControl) return
    await this.write([0x00])
    await this.write([0x07])
    this.haveControl = true
  }
  async setPower(w: number) {
    await this.requestControl()
    await this.write([0x05, w & 0xff, (w >> 8) & 0xff])
  }
  /** Indoor bike simulation: no wind, grade in 0.01%, default rolling resistance and drag. */
  async setSim(gradePct: number) {
    await this.requestControl()
    const g = Math.round(gradePct * 100)
    await this.write([0x11, 0, 0, g & 0xff, (g >> 8) & 0xff, 40, 51])
  }
  async release() {
    await this.write([0x01])
    this.haveControl = false
  }
}

/** Indoor Bike Data: flags then optional fields in spec order. */
export function parseBikeData(v: DataView): { power: number; cadence: number } {
  const flags = v.getUint16(0, true)
  let o = 2
  let power = 0
  let cadence = 0
  if (!(flags & 0x1)) o += 2
  if (flags & 0x2) o += 2
  if (flags & 0x4) {
    cadence = v.getUint16(o, true) / 2
    o += 2
  }
  if (flags & 0x8) o += 2
  if (flags & 0x10) o += 3
  if (flags & 0x20) o += 2
  if (flags & 0x40) power = v.getInt16(o, true)
  return { power, cadence }
}

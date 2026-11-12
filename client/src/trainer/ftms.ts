import { CFG } from '../config'
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
  private pending?: { op: number; resolve: (r: number) => void }

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
    this.ctrl.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value
      const r = v && parseControlReply(v)
      if (r && r.op === this.pending?.op) this.pending.resolve(r.result)
    })
    await this.ctrl.startNotifications().catch(() => {})
  }

  onData(cb: (d: { power: number; cadence: number }) => void) {
    this.dataCb = cb
  }
  onDisconnect(cb: () => void) {
    this.discCb = cb
  }

  /** Runs `fn` after every earlier operation has finished, so writes never overlap. */
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn, fn)
    this.queue = p.catch(() => {})
    return p
  }

  /** Writes one control point command and waits (up to replyMs) for its reply. No reply is fine. */
  private async send(bytes: number[], what: string, retry = true): Promise<void> {
    const reply = this.expect(bytes[0])
    try {
      await this.ctrl!.writeValueWithResponse(new Uint8Array(bytes))
    } catch (e) {
      this.pending = undefined
      throw e
    }
    const code = await reply
    if (code === undefined || code === RESULT.ok) return
    if (code === RESULT.notPermitted && retry && bytes[0] !== OP.request) {
      this.haveControl = false
      await this.ensureControl()
      return this.send(bytes, what, false)
    }
    throw new Error(`Trainer rejected ${what}: ${RESULT_TEXT[code] ?? `code ${code}`}`)
  }

  private expect(op: number) {
    return new Promise<number | undefined>((resolve) => {
      const timer = setTimeout(() => {
        this.pending = undefined
        resolve(undefined)
      }, CFG.ftms.replyMs)
      this.pending = {
        op,
        resolve: (r) => {
          clearTimeout(timer)
          this.pending = undefined
          resolve(r)
        },
      }
    })
  }

  private async ensureControl() {
    if (this.haveControl) return
    await this.send([OP.request], 'request control')
    await this.send([OP.start], 'start')
    this.haveControl = true
  }

  requestControl() {
    return this.run(() => this.ensureControl())
  }
  setPower(w: number) {
    return this.run(async () => {
      await this.ensureControl()
      await this.send([OP.power, w & 0xff, (w >> 8) & 0xff], 'set power')
    })
  }
  /** Indoor bike simulation: no wind, grade in 0.01%, default rolling resistance and drag. */
  setSim(gradePct: number) {
    return this.run(async () => {
      await this.ensureControl()
      const g = Math.round(gradePct * 100)
      await this.send([OP.sim, 0, 0, g & 0xff, (g >> 8) & 0xff, 40, 51], 'set simulation')
    })
  }
  release() {
    return this.run(async () => {
      this.haveControl = false
      await this.send([OP.reset], 'release')
    })
  }
}

const OP = { request: 0x00, reset: 0x01, power: 0x05, start: 0x07, sim: 0x11 }
const RESULT = { ok: 1, notPermitted: 5 }
const RESULT_TEXT: Record<number, string> = {
  2: 'not supported',
  3: 'invalid parameter',
  4: 'operation failed',
  5: 'control not permitted',
}

/** Control point indication: [0x80, request opcode, result code]. Null for anything else. */
export function parseControlReply(v: DataView): { op: number; result: number } | null {
  if (v.byteLength < 3 || v.getUint8(0) !== 0x80) return null
  return { op: v.getUint8(1), result: v.getUint8(2) }
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

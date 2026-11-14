import { CFG } from '../config'

// Zwift Click v1 (BC1) and the Click v2 pucks, unencrypted. Sources: jat255/zwift_click_handling,
// OpenBikeControl/bikecontrol. The v2 speaks the Zwift Ride format on its own service.
const SERVICE = '00000001-19ca-4651-86e5-fa29dcdd09d1'
const SERVICE_V2 = '0000fc82-0000-1000-8000-00805f9b34fb'
const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1'
const SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1'
const SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1'
const RIDE_ON = new Uint8Array([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e])
const START_V2 = new Uint8Array([...RIDE_ON, 0x02, 0x03])
const BUTTONS = 0x37
const RIDE_BUTTONS = 0x23
// Ride button bits: right, up, right shifter count as plus; left, down, left shifter as minus.
const RIDE_PLUS = 0x4 | 0x2 | 0x1000
const RIDE_MINUS = 0x1 | 0x8 | 0x100

export interface ClickButtons {
  plus: boolean
  minus: boolean
}

/**
 * Button message: 0x37, then protobuf varint fields 1 (plus) and 2 (minus). Value 0 is pressed and 1
 * released; a missing field is the protobuf default, 0, so pressed. Null for any other message.
 */
export function parseClick(b: Uint8Array): ClickButtons | null {
  if (b[0] !== BUTTONS) return null
  const v: Record<number, number> = { 1: 0, 2: 0 }
  for (let i = 1; i + 1 < b.length; i += 2) v[b[i] >> 3] = b[i + 1]
  return { plus: v[1] === 0, minus: v[2] === 0 }
}

/**
 * Click v2 button message: 0x23, then a protobuf whose field 1 is a bitmask with a 0 bit for each held
 * button. Other fields (analog paddles) are skipped; no field 1 reads as nothing held. Null for any other message.
 */
export function parseRide(b: Uint8Array): ClickButtons | null {
  if (b[0] !== RIDE_BUTTONS) return null
  let i = 1
  const varint = () => {
    let v = 0
    for (let s = 0; i < b.length; s += 7) {
      v += (b[i] & 0x7f) * 2 ** s
      if (!(b[i++] & 0x80)) break
    }
    return v
  }
  let map = 0xffffffff
  while (i < b.length) {
    const key = varint()
    if ((key & 7) === 0) {
      const v = varint()
      if (key >> 3 === 1) map = v
    } else if ((key & 7) === 2) i += varint()
    else break
  }
  const held = ~map
  return { plus: (held & RIDE_PLUS) !== 0, minus: (held & RIDE_MINUS) !== 0 }
}

/** Turns button states into presses: +1 for a new plus press, -1 for minus. Releases and repeats give nothing. */
export function clickPresses() {
  let was: ClickButtons = { plus: false, minus: false }
  return (b: ClickButtons) => {
    const out = [...(b.plus && !was.plus ? [1] : []), ...(b.minus && !was.minus ? [-1] : [])]
    was = b
    return out
  }
}

const hex = (v: DataView) =>
  [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join(' ')

export type ClickStatus = 'connected' | 'reconnecting'

/** Web Bluetooth Zwift Click (v1 or a v2 puck): RideOn handshake, then plus/minus presses. Never touches the trainer. */
export class BleClick {
  name = 'Zwift Click'
  status: ClickStatus = 'connected'
  onShift: (d: number) => void = () => {}
  onStatus: () => void = () => {}
  private dev?: BluetoothDevice
  private closed = false
  private reconnecting = false
  private presses = clickPresses()

  async connect() {
    this.dev = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Zwift Click' }, { services: [SERVICE] }, { services: [SERVICE_V2] }],
      optionalServices: [SERVICE, SERVICE_V2],
    })
    this.name = this.dev.name ?? this.name
    this.dev.addEventListener('gattserverdisconnected', () => void this.reconnect())
    await this.attach()
  }

  private async attach() {
    const gatt = await this.dev!.gatt!.connect()
    const v2 = await gatt.getPrimaryService(SERVICE_V2).catch(() => null)
    const svc = v2 ?? (await gatt.getPrimaryService(SERVICE))
    const start = v2 ? START_V2 : RIDE_ON
    for (const id of [ASYNC, SYNC_TX]) {
      const ch = await svc.getCharacteristic(id)
      ch.addEventListener('characteristicvaluechanged', (e) => {
        const v = (e.target as BluetoothRemoteGATTCharacteristic).value
        if (v) this.handle(id, v)
      })
      await ch.startNotifications()
    }
    const rx = await svc.getCharacteristic(SYNC_RX)
    await (rx.properties.writeWithoutResponse
      ? rx.writeValueWithoutResponse(start)
      : rx.writeValueWithResponse(start))
    this.presses = clickPresses()
    this.status = 'connected'
    this.onStatus()
  }

  private handle(id: string, v: DataView) {
    console.log(`[Click] ${id === ASYNC ? 'async' : 'syncTx'}: ${hex(v)}`)
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
    const b = parseClick(bytes) ?? parseRide(bytes)
    if (b) this.presses(b).forEach((d) => this.onShift(d))
  }

  private async reconnect() {
    if (this.closed || this.reconnecting) return
    this.reconnecting = true
    this.status = 'reconnecting'
    this.onStatus()
    const wait = CFG.click.backoffMs
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

  close() {
    this.closed = true
    if (this.dev?.gatt?.connected) this.dev.gatt.disconnect()
  }
}

let src: BleClick | null = null
const subs = new Set<() => void>()
const shifts = new Set<(d: number) => void>()

export const clickSource = () => src
export const onClickChange = (f: () => void) => (subs.add(f), () => subs.delete(f))
/** Subscribes to Click presses (+1 up, -1 down); returns the unsubscribe. */
export const onClickShift = (f: (d: number) => void) => (shifts.add(f), () => void shifts.delete(f))

/** Replaces the paired Click (null disconnects). */
export function setClick(c: BleClick | null) {
  src?.close()
  src = c
  if (c) {
    c.onShift = (d) => src === c && shifts.forEach((f) => f(d))
    c.onStatus = () => src === c && subs.forEach((f) => f())
  }
  subs.forEach((f) => f())
}

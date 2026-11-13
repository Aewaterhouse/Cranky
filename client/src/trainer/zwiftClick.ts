import { CFG } from '../config'

// Zwift Click v1 (BC1), unencrypted. Sources: jat255/zwift_click_handling, OpenBikeControl/bikecontrol.
const SERVICE = '00000001-19ca-4651-86e5-fa29dcdd09d1'
const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1'
const SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1'
const SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1'
const RIDE_ON = new Uint8Array([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e])
const BUTTONS = 0x37

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

/** Web Bluetooth Zwift Click: RideOn handshake, then plus/minus presses. Never touches the trainer. */
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
      filters: [{ namePrefix: 'Zwift Click' }, { services: [SERVICE] }],
      optionalServices: [SERVICE],
    })
    this.name = this.dev.name ?? this.name
    this.dev.addEventListener('gattserverdisconnected', () => void this.reconnect())
    await this.attach()
  }

  private async attach() {
    const svc = await (await this.dev!.gatt!.connect()).getPrimaryService(SERVICE)
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
      ? rx.writeValueWithoutResponse(RIDE_ON)
      : rx.writeValueWithResponse(RIDE_ON))
    this.presses = clickPresses()
    this.status = 'connected'
    this.onStatus()
  }

  private handle(id: string, v: DataView) {
    console.log(`[Click] ${id === ASYNC ? 'async' : 'syncTx'}: ${hex(v)}`)
    const b = parseClick(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
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

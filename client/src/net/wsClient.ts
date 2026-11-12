import { CFG } from '../config'
import type { ClientMsg, ServerMsg } from './protocol'

/** WebSocket with automatic reconnect. `onOpen` runs on every (re)connect. */
export class WsClient {
  onMsg: (m: ServerMsg) => void = () => {}
  onOpen: () => void = () => {}
  onStatus: (up: boolean) => void = () => {}
  private ws?: WebSocket
  private closed = false

  constructor(private code: string, private id: string) {
    this.open()
  }

  private open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${location.host}/ws/${this.code}?id=${encodeURIComponent(this.id)}`)
    this.ws.onopen = () => (this.onStatus(true), this.onOpen())
    this.ws.onmessage = (e) => this.onMsg(JSON.parse(e.data))
    this.ws.onclose = () => {
      this.onStatus(false)
      if (!this.closed) setTimeout(() => this.open(), CFG.net.reconnectMs)
    }
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }

  close() {
    this.closed = true
    this.ws?.close()
  }
}

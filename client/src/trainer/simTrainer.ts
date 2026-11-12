import { CFG } from '../config'
import type { Trainer } from '../types'

export interface Bot {
  /** Called every step with seconds since start; return overrides. */
  (t: number, s: SimTrainer): void
}

/** Fake trainer: ERG mode forces target * effort; sim mode uses `manual` watts. */
export class SimTrainer implements Trainer {
  name = 'Simulated trainer'
  erg: number | null = null
  manual = CFG.sim.baseWatts
  effort = 1
  cadence = CFG.sim.baseCadence
  power = 0
  t = 0
  log: string[] = []
  private dataCb: (d: { power: number; cadence: number }) => void = () => {}
  private timer?: ReturnType<typeof setInterval>

  constructor(private bot?: Bot, private rng: () => number = Math.random) {}

  async connect() {}
  onData(cb: (d: { power: number; cadence: number }) => void) {
    this.dataCb = cb
  }
  onDisconnect() {}
  async requestControl() {
    this.log.push('control')
  }
  async setPower(w: number) {
    this.erg = w
    this.log.push(`erg ${w}`)
  }
  async setSim(g: number) {
    this.erg = null
    this.log.push(`sim ${g}`)
  }
  async release() {
    this.erg = null
    this.log.push('release')
  }

  step(dt: number) {
    this.t += dt
    this.bot?.(this.t, this)
    const noise = (this.rng() - 0.5) * 2 * CFG.sim.noiseW
    const base = this.erg !== null ? this.erg * this.effort : this.manual
    this.power = Math.max(0, Math.round(base + noise))
    this.dataCb({ power: this.power, cadence: Math.round(this.cadence + (this.rng() - 0.5) * 2) })
  }

  start(hz = 4) {
    this.timer = setInterval(() => this.step(1 / hz), 1000 / hz)
  }
  stop() {
    clearInterval(this.timer)
  }
}

/** Keyboard control for manual testing: arrows = watts/cadence, [ ] = effort, S = sprint. */
export function bindKeys(sim: SimTrainer, ftp: number) {
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return
    const k = e.key
    if (k === 'ArrowUp') sim.manual += 10
    else if (k === 'ArrowDown') sim.manual = Math.max(0, sim.manual - 10)
    else if (k === 'ArrowRight') sim.cadence += 2
    else if (k === 'ArrowLeft') sim.cadence = Math.max(0, sim.cadence - 2)
    else if (k === ']') sim.effort = Math.min(1.5, +(sim.effort + 0.05).toFixed(2))
    else if (k === '[') sim.effort = Math.max(0.3, +(sim.effort - 0.05).toFixed(2))
    else if (k === 's' || k === 'S') sim.manual = Math.round(ftp * 3)
    else if (k === 'a' || k === 'A') sim.manual = Math.round(ftp * 0.6)
    else return
    e.preventDefault()
  })
}

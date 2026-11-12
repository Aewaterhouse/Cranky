import type { Block } from '../../types'

/** Per-block share of recorded seconds with cadence inside the block's `cad` band (null: no band or no samples). */
export class CadenceTally {
  private inBand: number[]
  private all: number[]
  constructor(private blocks: Block[]) {
    this.inBand = blocks.map(() => 0)
    this.all = blocks.map(() => 0)
  }

  add(i: number, cadence: number) {
    const c = this.blocks[i]?.cad
    if (!c) return
    this.all[i]++
    if (cadence >= c[0] && cadence <= c[1]) this.inBand[i]++
  }

  pct(): (number | null)[] {
    return this.blocks.map((b, i) => (b.cad && this.all[i] ? this.inBand[i] / this.all[i] : null))
  }
}

export const inCadBand = (cad: [number, number] | undefined, c: number) =>
  !cad || (c >= cad[0] && c <= cad[1])

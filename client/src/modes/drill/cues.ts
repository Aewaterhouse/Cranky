import type { Block } from '../../types'
import { startOf } from '../../core/plan'

/** Decides when a block's coach cues are due. Each cue shows once; cues before the start position count as shown. */
export class CueTracker {
  private shown = new Set<string>()

  constructor(
    private blocks: Block[],
    from = 0,
  ) {
    blocks.forEach((b, i) =>
      b.cues?.forEach((c, n) => startOf(blocks, i) + c.at < from && this.shown.add(`${i}:${n}`)),
    )
  }

  /** The newest cue now due in block `i` at `bel` seconds into it, if any. */
  due(i: number, bel: number): string | undefined {
    let text: string | undefined
    this.blocks[i]?.cues?.forEach((c, n) => {
      if (c.at > bel || this.shown.has(`${i}:${n}`)) return
      this.shown.add(`${i}:${n}`)
      text = c.text
    })
    return text
  }
}

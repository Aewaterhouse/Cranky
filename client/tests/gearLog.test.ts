import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { GearLog } from '../src/core/gearLog'

const W = CFG.gearLog.movedW

describe('gear log', () => {
  it('times the ack and the first power report that moves far enough', () => {
    const log = new GearLog()
    const r = log.press(1000, 13, 1.2, 200)
    log.ack(r, 1080)
    log.power(1250, 200 + W - 1)
    expect(r.moveMs).toBeUndefined()
    log.power(1500, 200 + W)
    log.power(1750, 300)
    expect(r).toMatchObject({ ackMs: 80, moveMs: 500 })
    expect(log.moved(r, 2000)).toBe('500 ms')
  })

  it('counts a drop in power as a move too, and gives up after the time-out', () => {
    const log = new GearLog()
    const down = log.press(0, 11, -1, 250)
    log.power(300, 250 - W)
    expect(down.moveMs).toBe(300)
    const r = log.press(1000, 12, 0, 200)
    expect(log.moved(r, 2000)).toBe('waiting')
    log.power(1000 + CFG.gearLog.timeoutS * 1000 + 1, 400)
    expect(r.moveMs).toBeUndefined()
    expect(log.moved(r, 1000 + CFG.gearLog.timeoutS * 1000 + 1)).toBe('no move')
  })

  it('keeps the newest rows first, gives medians and a pasteable table', () => {
    const log = new GearLog()
    for (let i = 0; i < CFG.gearLog.rows + 5; i++) {
      const r = log.press(i * 1000, 12, 0.5, 200)
      log.ack(r, i * 1000 + 50 + i)
      log.power(i * 1000 + 400, 260)
    }
    expect(log.rows).toHaveLength(CFG.gearLog.rows)
    expect(log.rows[0].n).toBe(CFG.gearLog.rows + 5)
    expect(log.stats().moveMs).toBe(400)
    const lines = log.text(1e9).split('\n')
    expect(lines[0]).toBe('n\tpress ms\tgear\tgradient %\tack ms\tpower moved')
    expect(lines[1].startsWith('6\t5000\t12\t0.5\t')).toBe(true)
  })
})

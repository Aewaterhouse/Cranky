import { describe, expect, it, vi } from 'vitest'
import { CFG } from '../src/config'
import { nextStrength } from '../src/core/gears'
import { soloKeys, type KeyActions } from '../src/modes/drill/keys'
import { freeKeys, type FreeKeyActions } from '../src/modes/freeRide/keys'

const S = CFG.gears.strength
const press = (key: string) =>
  ({ key, target: null, preventDefault() {} }) as unknown as KeyboardEvent

describe('shift strength', () => {
  it('steps on the grid and stays in range', () => {
    expect(nextStrength(1.5, 1)).toBe(1.6)
    expect(nextStrength(1.5, -1)).toBe(1.4)
    expect(nextStrength(1.53, 0)).toBe(1.5)
    expect(nextStrength(S.max, 1)).toBe(S.max)
    expect(nextStrength(S.min, -1)).toBe(S.min)
  })
  it("is on ; and ' in free ride and the solo player", () => {
    const free = { strength: vi.fn() } as unknown as FreeKeyActions
    freeKeys(free)(press("'"))
    freeKeys(free)(press(';'))
    expect(vi.mocked(free.strength).mock.calls).toEqual([[1], [-1]])
    const solo = { strength: vi.fn() } as unknown as KeyActions
    soloKeys(solo, true)(press("'"))
    soloKeys(solo, true)(press(';'))
    expect(vi.mocked(solo.strength).mock.calls).toEqual([[1], [-1]])
  })
})

import { describe, expect, it } from 'vitest'
import { GAMES } from '../src/modes/crew/games'
import { SHELVES } from '../src/ui/gamePicker'

describe('game picker', () => {
  it('shelves every crew game exactly once', () => {
    const shelved = SHELVES.flatMap(([, ids]) => ids)
    expect(shelved.sort()).toEqual(Object.keys(GAMES).sort())
  })
})

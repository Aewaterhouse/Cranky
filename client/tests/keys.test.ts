import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTION_IDS,
  ACTIONS,
  actionOf,
  overlaps,
  clashOf,
  keyHint,
  keyOf,
  keysOf,
  reloadKeys,
  resetKeys,
  setKey,
  typing,
} from '../src/core/keys'
import { soloKeys, type KeyActions } from '../src/modes/drill/keys'
import { freeKeys, type FreeKeyActions } from '../src/modes/freeRide/keys'
import { SimTrainer, simKeys } from '../src/trainer/simTrainer'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

/** A key press as the handlers see one. */
const press = (key: string, target: object | null = null, mods = {}) =>
  ({
    key,
    target,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() {},
    ...mods,
  }) as KeyboardEvent

beforeEach(() => {
  store.clear()
  reloadKeys()
})

describe('ride key bindings', () => {
  it('shifts gear on the arrows and on Z X in solo and free ride', () => {
    const free = { shift: vi.fn() } as unknown as FreeKeyActions
    const solo = { gear: vi.fn() } as unknown as KeyActions
    for (const k of ['ArrowUp', 'x', 'ArrowDown', 'Z']) {
      freeKeys(free)(press(k))
      soloKeys(solo)(press(k))
    }
    expect(vi.mocked(free.shift).mock.calls).toEqual([[1], [1], [-1], [-1]])
    expect(vi.mocked(solo.gear).mock.calls).toEqual([[1], [1], [-1], [-1]])
  })

  it('follows a rebound gear key', () => {
    setKey('gearUp', 0, 'PageDown')
    const free = { shift: vi.fn() } as unknown as FreeKeyActions
    freeKeys(free)(press('PageDown'))
    freeKeys(free)(press('ArrowUp'))
    expect(vi.mocked(free.shift).mock.calls).toEqual([[1]])
  })

  it('starts on the defaults', () => {
    for (const id of ACTION_IDS) expect(keysOf(id)).toEqual(ACTIONS[id].keys)
    expect(keysOf('gearUp')).toEqual(['ArrowUp', 'x'])
    expect(keysOf('gearDown')).toEqual(['ArrowDown', 'z'])
  })

  it('rebinds a slot and keeps two keys per action', () => {
    setKey('camera', 1, 'v')
    expect(keysOf('camera')).toEqual(['c', 'v'])
    setKey('camera', 0, 'b')
    expect(keysOf('camera')).toEqual(['b', 'v'])
    setKey('camera', 2, 'k')
    expect(keysOf('camera')).toHaveLength(2)
    expect(actionOf(press('V'), 'bus')).toBe('camera')
    expect(actionOf(press('c'), 'bus')).toBeUndefined()
  })

  it('clears a slot', () => {
    setKey('pause', 0, null)
    expect(keysOf('pause')).toEqual(['p'])
  })

  it('swaps on a clash, only between actions that can fire together', () => {
    expect(clashOf('camera', 'd')).toEqual({ id: 'cards', slot: 0 })
    setKey('camera', 0, 'd')
    expect(keysOf('camera')).toEqual(['d'])
    expect(keysOf('cards')).toEqual(['c'])
    // R is the rider list on the bus and Resistance in solo: different screens, so no clash
    expect(clashOf('modeRes', 'r')).toBeNull()
  })

  it('moves a key within one action rather than doubling it', () => {
    setKey('pause', 1, ' ')
    expect(keysOf('pause')).toEqual(['p', ' '])
  })

  it('resets to the defaults', () => {
    setKey('camera', 0, 'v')
    resetKeys()
    expect(keysOf('camera')).toEqual(['c'])
    expect(store.has('cranky.keys')).toBe(false)
  })

  it('saves per device and reads them back', () => {
    setKey('clean', 0, 'k')
    expect(JSON.parse(store.get('cranky.keys')!).clean).toEqual(['k'])
    reloadKeys()
    expect(keysOf('clean')).toEqual(['k'])
    store.set('cranky.keys', 'not json')
    reloadKeys()
    expect(keysOf('clean')).toEqual(['h'])
  })

  it('reads page-turner keys and names keys for hints', () => {
    setKey('gearUp', 1, 'PageUp')
    expect(actionOf(press('PageUp'), 'free')).toBe('gearUp')
    expect(keyOf(press('X'))).toBe('x')
    expect(keyHint('pause')).toBe('Space P')
    expect(keyHint('end')).toBe('Esc')
  })

  it('never treats keys typed into a text box as ride keys', () => {
    const box = (tagName: string, type = '') => ({ tagName, type })
    expect(typing(press('z', box('INPUT', 'text')))).toBe(true)
    expect(typing(press('z', box('TEXTAREA')))).toBe(true)
    expect(typing(press('z', { tagName: 'DIV', isContentEditable: true }))).toBe(true)
    expect(actionOf(press('z', box('INPUT', 'text')), 'free')).toBeUndefined()
    expect(actionOf(press('z', box('INPUT', 'search')), 'free')).toBeUndefined()
    // a slider or a button keeps the ride keys working
    expect(actionOf(press('z', box('INPUT', 'range')), 'free')).toBe('gearDown')
    expect(actionOf(press('z', box('BUTTON')), 'free')).toBe('gearDown')
    expect(actionOf(press('z', null, { ctrlKey: true }), 'free')).toBeUndefined()
  })
})

describe('one key press, one action', () => {
  const ev = (key: string, target: object | null = null) => {
    const e = { ...press(key, target), prevented: false } as KeyboardEvent & { prevented: boolean }
    e.preventDefault = () => void (e.prevented = true)
    return e
  }

  it('has no default key on two actions that can fire together', () => {
    for (const a of ACTION_IDS)
      for (const b of ACTION_IDS)
        if (a < b && overlaps(a, b))
          expect(ACTIONS[a].keys.filter((k) => (ACTIONS[b].keys as string[]).includes(k))).toEqual(
            [],
          )
  })

  it('arrows shift gears and leave the simulator alone', () => {
    const sim = new SimTrainer()
    const before = { p: sim.manual, c: sim.cadence }
    const onSim = simKeys(sim, 200)
    const free = { shift: vi.fn() } as unknown as FreeKeyActions
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const e = ev(k)
      freeKeys(free)(e)
      onSim(e)
      expect(e.prevented).toBe(true) // the page never scrolls in a ride
    }
    expect(vi.mocked(free.shift).mock.calls).toEqual([[1], [-1]])
    expect({ p: sim.manual, c: sim.cadence }).toEqual(before)
  })

  it('moves the simulator on its own keys, which no ride key uses', () => {
    const sim = new SimTrainer()
    const onSim = simKeys(sim, 200)
    const p0 = sim.manual
    onSim(ev('PageUp'))
    expect(sim.manual).toBe(p0 + 10)
    onSim(ev('PageDown'))
    expect(sim.manual).toBe(p0)
    const c0 = sim.cadence
    onSim(ev('End'))
    expect(sim.cadence).toBe(c0 + 2)
    onSim(ev('Q'))
    expect(sim.manual).toBe(600)
    onSim(ev('a'))
    expect(sim.manual).toBe(120)
    // S is Stats in every ride, not the simulator's sprint any more
    onSim(ev('s'))
    expect(sim.manual).toBe(120)
    for (const k of ['PageUp', 'PageDown', 'Home', 'End', 'q', 'a', '[', ']'])
      for (const scope of ['solo', 'free', 'bus'] as const)
        expect(actionOf(ev(k), scope)).toBeUndefined()
  })

  it('ignores ride and simulator keys typed into a text box', () => {
    const sim = new SimTrainer()
    const p0 = sim.manual
    const box = { tagName: 'INPUT', type: 'text' }
    simKeys(sim, 200)(ev('PageUp', box))
    simKeys(sim, 200)(ev('q', box))
    expect(sim.manual).toBe(p0)
    const free = { shift: vi.fn(), pause: vi.fn() } as unknown as FreeKeyActions
    const e = ev('ArrowUp', box)
    freeKeys(free)(e)
    freeKeys(free)(ev(' ', { tagName: 'TEXTAREA' }))
    expect(free.shift).not.toHaveBeenCalled()
    expect(free.pause).not.toHaveBeenCalled()
    expect(e.prevented).toBe(false) // the cursor still moves in the box
  })
})

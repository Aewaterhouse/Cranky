import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTION_IDS,
  ACTIONS,
  actionOf,
  clashOf,
  keyHint,
  keyOf,
  keysOf,
  reloadKeys,
  resetKeys,
  setKey,
  typing,
} from '../src/core/keys'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

/** A key press as the handlers see one. */
const press = (key: string, target: object | null = null, mods = {}) =>
  ({ key, target, ctrlKey: false, metaKey: false, altKey: false, ...mods }) as KeyboardEvent

beforeEach(() => {
  store.clear()
  reloadKeys()
})

describe('ride key bindings', () => {
  it('starts on the defaults', () => {
    for (const id of ACTION_IDS) expect(keysOf(id)).toEqual(ACTIONS[id].keys)
    expect(keysOf('gearDown')).toContain('z')
    expect(keysOf('gearUp')).toContain('x')
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

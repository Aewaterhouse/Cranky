import { describe, expect, it } from 'vitest'
import { CFG } from '../src/config'
import { difficulty, estimateSeconds, lengthClass, packToRoute } from '../src/core/routeLibrary'
import { FIXTURE_PACK } from './fixtures/routePack'

describe('routeLibrary', () => {
  it('converts a pack with the same build as GPX', () => {
    const r = packToRoute(FIXTURE_PACK)
    expect(r.id).toBe('test-hill')
    expect(r.region).toBe('VIC')
    expect(r.distance).toBeGreaterThan(1000)
    expect(r.distance).toBeLessThan(1200)
    expect(r.ascent).toBeGreaterThan(30)
    expect(r.points[0].lat).toBeDefined()
    expect(r.points[5].grade).toBeGreaterThan(3)
  })
  it('rates difficulty 1 to 5', () => {
    expect(difficulty(20, 0.5)).toBe(1)
    expect(difficulty(500, 2)).toBe(3)
    expect(difficulty(1013, 4.8)).toBe(4)
    expect(difficulty(1013, 7)).toBe(5)
    expect(difficulty(5000, 9)).toBe(5)
  })
  it('classes length from config', () => {
    const { short, long } = CFG.freeRide.library.lengthKm
    expect([lengthClass(short - 1), lengthClass(short), lengthClass(long)]).toEqual([
      'short',
      'medium',
      'long',
    ])
  })
  it('estimates longer and steeper routes as slower', () => {
    const flat = estimateSeconds(20, 0, 200)
    expect(estimateSeconds(20, 1000, 200)).toBeGreaterThan(flat)
    expect(estimateSeconds(40, 0, 200)).toBeGreaterThan(flat)
  })
})

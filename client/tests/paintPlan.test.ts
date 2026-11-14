import { describe, expect, it } from 'vitest'
import { buildRoute } from '../src/core/route'
import { routeSegments } from '../src/core/segments'
import { planPaint } from '../src/scene/route/paintPlan'

// Flat, a 1.5 km climb at 7%, then flat again: 6 km in all.
const route = buildRoute(
  'paint-test',
  'Paint test',
  Array.from({ length: 601 }, (_, i) => {
    const d = i * 10
    return { d, ele: 100 + Math.min(Math.max(d - 2000, 0), 1500) * 0.07 }
  }),
)

describe('road paint', () => {
  const { lines, words } = planPaint(route, ['Bec Smith', 'Mo', 'Kaz'])
  const climb = routeSegments(route).find((s) => s.kind === 'climb')!
  it('puts a KOM line at the top of the climb, with dots before it', () => {
    expect(lines.find((l) => l.kind === 'kom')!.d).toBe(climb.end)
    const dots = lines.filter((l) => l.kind === 'dots')
    expect(dots.length).toBeGreaterThan(2)
    expect(dots.every((l) => l.d > climb.start && l.d < climb.end)).toBe(true)
    expect(words.some((w) => w.text === 'KOM' && w.d < climb.end)).toBe(true)
  })
  it('paints kilometres to go and chalks the rider first near the top', () => {
    expect(words.filter((w) => w.text.endsWith(' KM')).map((w) => w.text)).toEqual([
      '1 KM',
      '2 KM',
      '3 KM',
      '4 KM',
      '5 KM',
    ])
    const near = words
      .filter((w) => /BEC|MO|KAZ/.test(w.text) && w.d > climb.end - 400 && w.d < climb.end)
      .sort((a, b) => a.d - b.d)
    expect(near.length).toBe(3)
    expect(near[0].text).toContain('BEC')
  })
  it('marks the sprint with two lines', () => {
    const sprint = routeSegments(route).find((s) => s.kind === 'sprint')
    if (sprint)
      expect(lines.filter((l) => l.kind === 'sprint').map((l) => l.d)).toEqual([
        sprint.start,
        sprint.end,
      ])
  })
})

import { describe, expect, it } from 'vitest'
import { BODY_FIELDS, fullBody, randomBody, type Body } from '../src/core/body'
import { buildBody, dimsOf } from '../src/scene/riderBody'
import { buildHead } from '../src/scene/riderHead'

const sliders = BODY_FIELDS.filter((f) => f.type === 'slider')
const all = (v: number): Body => fullBody(Object.fromEntries(sliders.map((f) => [f.key, v])))
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296)
/** Every picker at each of its values, the sliders at both ends, and a few hundred random bodies. */
const bodies: Body[] = [
  all(0),
  all(100),
  ...BODY_FIELDS.flatMap((f) =>
    Array.from({ length: f.type === 'slider' ? 0 : f.max + 1 }, (_, v) => fullBody({ [f.key]: v })),
  ),
  ...Array.from({ length: 300 }, () => randomBody(rnd)),
]

describe('rider model', () => {
  it('stays inside the triangle budget for any body and headwear', () => {
    let most = 0
    for (const b of bodies)
      for (const wear of ['none', 'helmet', 'hat'] as const)
        most = Math.max(most, buildBody(b).triangles + buildHead(b, wear).triangles)
    expect(most).toBeLessThanOrEqual(3000)
    expect(most).toBeGreaterThan(500)
  })

  it('has the same vertices whatever the body, so chest and belly can be painted', () => {
    const n = buildBody(all(0)).triangles
    for (const b of bodies.slice(0, 80)) expect(buildBody(b).triangles).toBe(n)
  })

  it('has every part the pose moves, and no broken vertices', () => {
    for (const b of bodies.slice(0, 60)) {
      const f = buildBody(b)
      const names = ['thigh', 'shin', 'upper', 'fore', 'hand', 'shoe'].flatMap((n) => [
        n + 0,
        n + 1,
      ])
      for (const n of ['torso', 'hips', 'neck', ...names])
        expect(f.parts[n]?.n, n).toBeGreaterThan(0)
      f.write()
      const pos = f.geo.attributes.position.array as Float32Array
      expect(pos.every(Number.isFinite)).toBe(true)
      const d = dimsOf(b)
      expect(Object.values(d).every((v) => v > 0 && Number.isFinite(v))).toBe(true)
    }
  })
})

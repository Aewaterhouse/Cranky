import { describe, expect, it } from 'vitest'
import { FEEL } from '../src/scene/route/feelVis'
import {
  bendLean,
  camRoll,
  fovKick,
  levelPhase,
  newRoadPose,
  poseWants,
  shakeAmount,
  type PoseIn,
} from '../src/scene/route/riderPose'

const P = FEEL.rider
const C = FEEL.cam
const base: PoseIn = { grade: 0, speed: 8, cadence: 85, power: 200, effort: 0.8 }
const wants = (s: Partial<PoseIn>, was = newRoadPose()) => poseWants({ ...base, ...s }, was)

describe('what the rider on the road is doing', () => {
  it('sits and pedals on an ordinary road', () => {
    expect(wants({})).toEqual({ stand: 0, tuck: 0, cheer: 0, coast: 0 })
  })
  it('gets out of the saddle on a steep ramp or a hard effort', () => {
    expect(wants({ grade: 0.09 }).stand).toBe(1)
    expect(wants({ grade: 0.07 }).stand).toBe(0)
    expect(wants({ effort: 1.5 }).stand).toBe(1)
    expect(wants({ grade: -0.09 }).stand).toBe(0)
  })
  it('stays up while the gradient hovers at the threshold', () => {
    const up = wants({ grade: P.standGrade })
    expect(wants({ grade: P.standGrade - 0.01 }, up).stand).toBe(1)
    expect(wants({ grade: P.standGrade - 0.01 }).stand).toBe(0)
    expect(wants({ grade: P.standGrade - 0.03 }, up).stand).toBe(0)
  })
  it('coasts with no power, but a stopped rider is not coasting', () => {
    expect(wants({ power: 0 }).coast).toBe(1)
    expect(wants({ power: 0, speed: 0 }).coast).toBe(0)
    expect(wants({ power: 0, grade: 0.12 }).stand).toBe(0)
  })
  it('goes by cadence when nobody says what the power is', () => {
    expect(wants({ power: undefined, cadence: 0 }).coast).toBe(1)
    expect(wants({ power: undefined, cadence: 80 }).coast).toBe(0)
  })
  it('tucks only when coasting fast downhill, and sits up a bit slower than it tucked', () => {
    const fast = { power: 0, speed: P.tuckMs + 1, grade: -0.06 }
    expect(wants(fast).tuck).toBe(1)
    expect(wants({ ...fast, power: 250 }).tuck).toBe(0)
    expect(wants({ ...fast, grade: 0 }).tuck).toBe(0)
    expect(wants({ ...fast, speed: P.tuckMs - 1 }).tuck).toBe(0)
    expect(wants({ ...fast, speed: P.tuckMs - 1 }, wants(fast)).tuck).toBe(1)
  })
  it('celebrating beats standing and tucking', () => {
    expect(wants({ cheer: true, grade: 0.12 })).toMatchObject({ cheer: 1, stand: 0 })
    expect(wants({ cheer: true, power: 0, speed: 15, grade: -0.08 })).toMatchObject({
      cheer: 1,
      tuck: 0,
    })
  })
  it('leans into the bend, more with speed, never past the limit', () => {
    expect(bendLean(10, 0)).toBe(0)
    expect(bendLean(10, 1 / 40)).toBeGreaterThan(bendLean(5, 1 / 40))
    expect(bendLean(10, -1 / 40)).toBe(-bendLean(10, 1 / 40))
    expect(bendLean(22, 1 / 5)).toBe(P.maxLean)
  })
  it('levels the cranks at the nearest half turn', () => {
    expect(levelPhase(0.2)).toBe(0)
    expect(levelPhase(3)).toBeCloseTo(Math.PI)
    expect(levelPhase(-2.9)).toBeCloseTo(-Math.PI)
  })
})

describe('camera extras stay small', () => {
  it('shakes only on fast descents, and never more than fully', () => {
    expect(shakeAmount(5, -0.08)).toBe(0)
    expect(shakeAmount(20, 0)).toBe(0)
    expect(shakeAmount(20, 0.05)).toBe(0)
    expect(shakeAmount(15, -0.08)).toBeGreaterThan(0)
    expect(shakeAmount(15, -0.08)).toBeLessThan(1)
    expect(shakeAmount(40, -0.2)).toBe(1)
  })
  it('keeps the comfortable limits: a few centimetres, a few degrees', () => {
    expect(C.shake).toBeLessThanOrEqual(0.05)
    expect(C.leanMax).toBeLessThanOrEqual(0.1)
    expect(C.fovKick).toBeLessThanOrEqual(10)
    expect(C.calm).toBe(0)
  })
  it('widens the view with speed up to the cap', () => {
    expect(fovKick(0)).toBe(0)
    expect(fovKick(C.fovKickAt / 2)).toBeCloseTo(C.fovKick / 2)
    expect(fovKick(50)).toBe(C.fovKick)
  })
  it('rolls a share of the lean, the same way, capped', () => {
    expect(camRoll(0.1)).toBeCloseTo(0.1 * C.lean)
    expect(camRoll(-0.45)).toBe(-C.leanMax)
  })
})

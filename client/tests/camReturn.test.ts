import { describe, expect, it } from 'vitest'
import { bindCamInput } from '../src/scene/camInput'
import { CamOrbit } from '../src/scene/camOrbit'
import { CAM } from '../src/scene/camVis'

/** Steps the orbit's clock `secs` seconds in 1/60 s frames. */
const run = (o: CamOrbit, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) o.tick(1 / 60)
}

describe('camera auto-return', () => {
  it('holds the player view until the wait is up, then eases back', () => {
    const o = new CamOrbit()
    o.drag(100, 40)
    o.zoomBy(2)
    run(o, CAM.returnS - 0.2)
    expect(o.yaw).toBeCloseTo(-30)
    expect(o.zoom).toBe(2)
    run(o, 0.2 + CAM.returnEaseS / 2)
    expect(Math.abs(o.yaw)).toBeGreaterThan(0)
    expect(Math.abs(o.yaw)).toBeLessThan(30)
    run(o, CAM.returnEaseS)
    expect(o.active).toBe(false)
  })

  it('starts the wait again on any new input, even halfway back', () => {
    const o = new CamOrbit()
    o.drag(100, 0)
    run(o, CAM.returnS + CAM.returnEaseS / 2)
    o.drag(10, 0)
    run(o, CAM.returnS - 0.5)
    expect(o.active).toBe(true)
  })

  it('stays put in photo mode', () => {
    const o = new CamOrbit()
    o.free = true
    o.drag(100, 0)
    run(o, CAM.returnS * 3)
    expect(o.yaw).toBeCloseTo(-30)
  })
})

describe('camera input', () => {
  /** A stand-in canvas that keeps its listeners so the test can press on it. */
  const fakeCanvas = () => {
    const on: Record<string, (e: unknown) => void> = {}
    const el = {
      style: {} as Record<string, string>,
      addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f),
      removeEventListener: () => {},
    }
    const press = (x: number, y: number, to = { x, y }, id = 1) => {
      on.pointerdown({ pointerId: id, clientX: x, clientY: y })
      on.pointermove({ pointerId: id, clientX: to.x, clientY: to.y })
      on.pointerup({ pointerId: id, clientX: to.x, clientY: to.y })
    }
    return { el: el as unknown as HTMLElement, on, press }
  }

  it('drags to orbit and snaps back on a double tap', () => {
    const o = new CamOrbit()
    const c = fakeCanvas()
    bindCamInput(c.el, o, () => false)
    expect(c.el.style.touchAction).toBe('none')
    c.press(100, 100, { x: 200, y: 100 })
    expect(o.yaw).toBeCloseTo(-30)
    c.press(300, 300)
    c.press(300, 300)
    expect(o.active).toBe(false)
  })

  it('lets a cinematic eat the press', () => {
    const o = new CamOrbit()
    const c = fakeCanvas()
    let skipped = 0
    bindCamInput(c.el, o, () => (skipped++, true))
    c.press(100, 100, { x: 200, y: 100 })
    expect(skipped).toBe(1)
    expect(o.active).toBe(false)
  })
})

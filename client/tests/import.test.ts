import { describe, expect, it } from 'vitest'
import { parsePlan, planTotal } from '../src/core/plan'
import { importWorkout } from '../src/core/workoutImport'

const ZWO = `<workout_file><author>x</author><name>Test Session</name><description>Hard  one</description>
<workout>
  <Warmup Duration="600" PowerLow="0.5" PowerHigh="0.75"/>
  <IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="1.1" OffPower="0.5"/>
  <SteadyState Duration="300" Power="0.9"/>
  <MaxEffort Duration="10"/>
  <FreeRide Duration="120"/>
  <Cooldown Duration="300" PowerLow="0.6" PowerHigh="0.4"/>
</workout></workout_file>`

const MRC = `[COURSE HEADER]
DESCRIPTION = Two by ten
MINUTES PERCENT
[END COURSE HEADER]
[COURSE DATA]
0 50
5 70
5 95
15 95
15 50
20 50
[END COURSE DATA]`

describe('workout import', () => {
  it('reads a .zwo file', () => {
    const p = importWorkout('x.zwo', ZWO, 200)
    expect(p.id).toBe('my-test-session')
    expect(p.desc).toBe('Hard one')
    const flat = parsePlan(p).blocks
    expect(flat.map((b) => b.type)).toEqual([
      'ramp',
      'steady',
      'steady',
      'steady',
      'steady',
      'steady',
      'steady',
      'steady',
      'sprint',
      'free',
      'ramp',
    ])
    expect(planTotal(flat)).toBe(600 + 3 * 180 + 300 + 10 + 120 + 300)
    expect(flat[1].pct).toBe(110)
  })
  it('reads .mrc percent and .erg watts', () => {
    const p = importWorkout('two.mrc', MRC, 200)
    expect(p.name).toBe('Two by ten')
    expect(p.blocks).toEqual([
      { type: 'ramp', dur: 300, pct: [50, 70] },
      { type: 'steady', dur: 600, pct: 95 },
      { type: 'steady', dur: 300, pct: 50 },
    ])
    const erg = MRC.replace('MINUTES PERCENT', 'FTP = 250\nMINUTES WATTS').replace(/ 95/g, ' 250')
    expect(importWorkout('e.erg', erg, 200).blocks[1]).toEqual({
      type: 'steady',
      dur: 600,
      pct: 100,
    })
  })
  it('caps power at 150% and rejects junk', () => {
    expect(
      importWorkout(
        'a.zwo',
        '<workout_file><workout><SteadyState Duration="60" Power="2.5"/></workout></workout_file>',
        200,
      ).blocks[0].pct,
    ).toBe(150)
    expect(() => importWorkout('a.txt', 'hello', 200)).toThrow(/Not a/)
    expect(() =>
      importWorkout('a.zwo', '<workout_file><workout></workout></workout_file>', 200),
    ).toThrow(/No intervals/)
  })
})

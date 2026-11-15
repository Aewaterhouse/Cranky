import { describe, expect, it } from 'vitest'
import { passwordProblem, usernameProblem } from '../src/ui/password'

describe('a new password', () => {
  it('needs 8 characters, not the rider’s name, typed the same twice', () => {
    expect(passwordProblem('short', 'short', 'luke')).toMatch(/8 characters/)
    expect(passwordProblem('  LUKE  ', '  LUKE  ', 'luke')).toMatch(/Not your name/)
    expect(passwordProblem('pedal-power', 'pedal-powr', 'luke')).toMatch(/match/)
    expect(passwordProblem('pedal-power', 'pedal-power', 'luke')).toBe('')
  })
})

describe('a username', () => {
  it('is 3 to 24 letters, numbers, spaces, - and _', () => {
    for (const ok of ['Kat', 'Vee Rides_1', 'a-b', 'x'.repeat(24)])
      expect(usernameProblem(ok)).toBe('')
    for (const bad of ['ab', 'x'.repeat(25), 'no!good', 'émile', '   '])
      expect(usernameProblem(bad)).not.toBe('')
  })
})

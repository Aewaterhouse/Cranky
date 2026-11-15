import { describe, expect, it } from 'vitest'
import { passwordProblem } from '../src/ui/password'

describe('a new password', () => {
  it('needs 8 characters, not the rider’s name, typed the same twice', () => {
    expect(passwordProblem('short', 'short', 'luke')).toMatch(/8 characters/)
    expect(passwordProblem('  LUKE  ', '  LUKE  ', 'luke')).toMatch(/Not your name/)
    expect(passwordProblem('pedal-power', 'pedal-powr', 'luke')).toMatch(/match/)
    expect(passwordProblem('pedal-power', 'pedal-power', 'luke')).toBe('')
  })
})

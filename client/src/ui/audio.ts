import { settings } from '../core/settings'

let ctx: AudioContext | null = null
const ac = () => (ctx ??= new AudioContext())

export function beep(
  freq: number,
  dur = 0.12,
  type: OscillatorType = 'square',
  gain = 0.08,
  at = 0,
) {
  try {
    const c = ac()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    const t = c.currentTime + at
    g.gain.setValueAtTime(Math.max(0.0001, gain * settings.volume), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + dur)
  } catch {
    /* no audio */
  }
}
const seq = (notes: number[], step = 0.1, type: OscillatorType = 'square') =>
  notes.forEach((n, i) => beep(n, step * 1.4, type, 0.08, i * step))

export const SFX = {
  block: () => seq([660, 880], 0.08),
  countdown: () => beep(440, 0.15),
  go: () => beep(880, 0.4),
  hit: () => (beep(80, 0.4, 'sawtooth', 0.2), beep(55, 0.5, 'square', 0.15, 0.05)),
  grab: () => seq([220, 180, 140], 0.07, 'sawtooth'),
  shake: () => seq([300, 500, 700], 0.06),
  FAIL: () => seq([200, 150, 100], 0.15, 'sawtooth'),
  HIT: () => seq([520, 660], 0.08),
  GREAT: () => seq([520, 660, 880], 0.08),
  MEGA: () => seq([523, 659, 784, 1047, 1319], 0.08),
  LEGEND: () => seq([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.1, 'sawtooth'),
  cue: () => (beep(784, 0.5, 'sine', 0.05), beep(1047, 0.7, 'sine', 0.05, 0.15)),
  scrap: () => seq([1200, 1600], 0.05, 'triangle'),
}

/** Low drone that shifts with the event mood. */
let drone: { o: OscillatorNode; g: GainNode } | null = null
const MOOD_HZ: Record<string, number> = {
  drill: 0,
  longhaul: 55,
  rampup: 62,
  surge: 73,
  roadblock: 49,
  servo: 0,
  finish: 0,
}
export function mood(m: string) {
  try {
    const c = ac()
    if (!drone) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sawtooth'
      g.gain.value = 0
      o.connect(g).connect(c.destination)
      o.start()
      drone = { o, g }
    }
    const hz = MOOD_HZ[m] ?? 0
    if (hz) drone.o.frequency.setTargetAtTime(hz, c.currentTime, 0.5)
    drone.g.gain.setTargetAtTime(hz ? 0.025 * settings.volume : 0, c.currentTime, 0.8)
  } catch {
    /* no audio */
  }
}
export const stopAudio = () => mood('drill')

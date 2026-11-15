import { hash } from '../math'
import { FUN } from './funVis'

const L = FUN.life

/** Where a flock bird is drawn and how: body yaw and pitch, and its wings `beat` radians above level. */
export type BirdPose = { x: number; y: number; z: number; yaw: number; pitch: number; beat: number }
export const newBird = (): BirdPose => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, beat: 0 })

/**
 * A flock bird before the rider sets it off (no three.js). On the ground it pecks, turns and hops now and then,
 * wings folded; a looping flock flies round and round above its spot, flapping. Never a bird hanging still in
 * mid-air: anything off the ground is on the move. `x`, `y`, `z` and `yaw` are its own spot, ground height and
 * heading; `cx`, `cz` the middle of the flock; `u` its own random number in 0 to 1.
 */
export function idleBird(
  out: BirdPose,
  loop: boolean,
  x: number,
  y: number,
  z: number,
  yaw: number,
  cx: number,
  cz: number,
  u: number,
  t: number,
) {
  if (loop) return loopBird(out, cx, y, cz, u, t)
  const every = L.hopEveryS * (0.7 + u * 0.6)
  const p = (t + u * every * 7) / every
  const n = Math.floor(p)
  const f = (p - n) * every
  // A short hop at the start of each cycle (and a new way to face), pecking the rest of the time.
  const hop = f < L.hopS ? Math.sin((Math.PI * f) / L.hopS) : 0
  out.x = x
  out.z = z
  out.y = y + 0.2 + hop * L.idleHopH
  out.yaw = yaw + (hash(u * 31 + n) - 0.5) * 2.4
  out.pitch = hop ? -0.2 : Math.max(0, Math.sin(t * 3 + u * 40)) * 0.7
  out.beat = hop ? -0.3 : -1.35
  return out
}

/** A looping bird: its own circle round the flock's middle, rising and falling a little, wings going. */
export function loopBird(out: BirdPose, cx: number, y: number, cz: number, u: number, t: number) {
  const r = L.loopR * (0.6 + u * 0.8)
  const a = (t * L.loopMs) / r + u * 40
  out.x = cx + Math.cos(a) * r
  out.z = cz + Math.sin(a) * r
  out.y = y + L.loopH * (0.7 + 0.6 * hash(u * 9)) + Math.sin(t * 0.9 + u * 20) * 0.8
  out.yaw = -a
  out.pitch = 0
  // Flap a few beats, glide a beat.
  out.beat = Math.sin(t * 16 + u * 30) * (Math.sin(t * 1.3 + u * 11) > -0.4 ? 0.9 : 0.15)
  return out
}

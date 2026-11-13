import { CFG } from '../config'
import { settings } from '../core/settings'
import {
  beds,
  freehubHz,
  tyreGain,
  tyreHz,
  windGain,
  windHz,
  type Beds,
  type Place,
} from '../core/soundMix'
import { audioCtx } from './audio'

const S = CFG.sound.ride
const L = S.level
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** What the ride sounds need to know each tick. */
export interface RideSoundState {
  /** m/s */
  speed: number
  coasting: boolean
  paused: boolean
  /** m/s, a tailwind negative. */
  headwind: number
  place: Place
  mood: string
}

/**
 * The sounds of a free ride, all synthesised: freehub, wind, tyres, gear clunks, and the birds, cicadas, surf,
 * gulls, mountain wind or traffic of the place. Returns undefined when the browser has no audio. Call `update`
 * every tick; nothing is heard until the page has had a click or a key (the browser insists).
 */
export function rideSound() {
  let c: AudioContext
  try {
    c = audioCtx()
  } catch {
    return undefined
  }
  const master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)
  // Two buses under the master: the bike (freehub, wind, tyres, gears) and the place (birds, surf, traffic).
  const bike = c.createGain()
  const place = c.createGain()
  bike.connect(master)
  place.connect(master)
  const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  // One freehub click: a few milliseconds of bright, fast-fading rattle.
  const click = c.createBuffer(1, Math.ceil(c.sampleRate * S.freehub.clickS), c.sampleRate)
  const cd = click.getChannelData(0)
  for (let i = 0; i < cd.length; i++) {
    const t = i / c.sampleRate
    const ring = Math.sin(2 * Math.PI * S.freehub.ringHz * t)
    cd[i] = (0.6 * ring + 0.4 * (Math.random() * 2 - 1)) * Math.exp((-t / S.freehub.clickS) * 6)
  }
  const running: AudioScheduledSourceNode[] = []

  /** A bed of filtered noise at zero gain, its loudness swelling slowly if `lfoHz` is given. */
  const bed = (
    out: AudioNode,
    type: BiquadFilterType,
    hz: number,
    q: number,
    lfoHz = 0,
    depth = 0,
  ) => {
    const src = c.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.loopStart = Math.random()
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.frequency.value = hz
    filter.Q.value = q
    const swell = c.createGain()
    const gain = c.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(swell).connect(gain).connect(out)
    src.start()
    running.push(src)
    if (lfoHz) {
      const lfo = c.createOscillator()
      const amount = c.createGain()
      lfo.frequency.value = lfoHz
      amount.gain.value = depth
      swell.gain.value = 1 - depth
      lfo.connect(amount).connect(swell.gain)
      lfo.start()
      running.push(lfo)
    }
    return { filter, gain }
  }
  const B = S.bed
  const wind = bed(bike, 'bandpass', S.wind.hz, S.wind.q)
  const tyre = bed(bike, 'lowpass', S.tyre.hz, S.tyre.q)
  const amb: Record<'cicadas' | 'highWind' | 'surf' | 'traffic', ReturnType<typeof bed>> = {
    cicadas: bed(place, 'bandpass', B.cicadas[0], B.cicadas[1], B.cicadas[2], B.cicadas[3]),
    highWind: bed(place, 'bandpass', B.highWind[0], B.highWind[1], B.highWind[2], B.highWind[3]),
    surf: bed(place, 'lowpass', B.surf[0], B.surf[1], B.surf[2], B.surf[3]),
    traffic: bed(place, 'lowpass', B.traffic[0], B.traffic[1], B.traffic[2], B.traffic[3]),
  }

  /** One short note sliding from `f0` to `f1` Hz. */
  const note = (
    at: number,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    type: OscillatorType = 'sine',
    out: AudioNode = place,
  ) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + dur)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + dur * 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + dur + 0.02)
  }
  /** A burst of the click buffer at `at`. */
  const tick = (at: number, gain: number, rate = 1) => {
    const s = c.createBufferSource()
    const g = c.createGain()
    s.buffer = click
    s.playbackRate.value = rate
    g.gain.value = gain
    s.connect(g).connect(bike)
    s.start(at)
  }
  /** A few quick notes from a small bird somewhere in the trees. */
  const birdsong = (level: number) => {
    const [lo, hi] = S.bird.hz
    const base = rnd(lo, hi)
    let at = c.currentTime + 0.05
    for (let n = Math.round(rnd(S.bird.notes[0], S.bird.notes[1])); n > 0; n--) {
      const dur = rnd(S.bird.noteS[0], S.bird.noteS[1])
      const f = base * rnd(0.85, 1.2)
      note(at, f, f * rnd(0.7, 1.4), dur, L.birds * level * rnd(0.5, 1))
      at += dur + rnd(0.03, 0.09)
    }
  }
  /** A gull: a handful of falling cries. */
  const gull = (level: number) => {
    let at = c.currentTime + 0.05
    for (let n = Math.round(rnd(S.gull.cries[0], S.gull.cries[1])); n > 0; n--) {
      const f = rnd(S.gull.hz[0], S.gull.hz[1])
      note(at, f, f * S.gull.fall, S.gull.cryS, L.gulls * level * rnd(0.5, 1), 'triangle')
      at += S.gull.cryS + rnd(0.06, 0.2)
    }
  }

  let nextTick = 0
  let lastAt = c.currentTime
  let stopped = false
  const set = (p: AudioParam, v: number, tau: number = S.easeS) =>
    p.setTargetAtTime(v, c.currentTime, tau)

  return {
    update(s: RideSoundState) {
      if (stopped) return
      if (c.state === 'suspended') void c.resume().catch(() => {})
      const now = c.currentTime
      const dt = Math.min(1, now - lastAt)
      lastAt = now
      set(master.gain, settings.rideSounds ? settings.volume * L.master : 0)
      set(bike.gain, settings.mixRide)
      set(place.gain, settings.mixAmbience)
      const v = s.paused ? 0 : s.speed
      set(wind.gain.gain, windGain(v, s.headwind) * L.wind)
      set(wind.filter.frequency, windHz(v, s.headwind))
      set(tyre.gain.gain, tyreGain(v) * L.tyre)
      set(tyre.filter.frequency, tyreHz(v))
      const mix: Beds = beds(s.place, s.mood)
      for (const k of ['cicadas', 'highWind', 'surf', 'traffic'] as const)
        set(amb[k].gain.gain, mix[k] * L[k], S.bedEaseS)
      if (Math.random() < mix.birds * S.bird.perS * dt) birdsong(mix.birds)
      if (Math.random() < mix.gulls * S.gull.perS * dt) gull(mix.gulls)
      // Freehub: clicks are booked a little ahead so they stay even between ticks of the ride.
      const hz = freehubHz(v, s.coasting)
      if (!hz) nextTick = 0
      else {
        if (nextTick < now) nextTick = now + 0.02
        for (; nextTick < now + S.freehub.aheadS; nextTick += 1 / hz)
          tick(nextTick, L.freehub * rnd(0.8, 1))
      }
    },
    /** A virtual gear change: the chain drops onto the next sprocket. */
    clunk() {
      if (stopped || !settings.rideSounds) return
      const at = c.currentTime + 0.01
      note(at, S.clunk.hz, S.clunk.hz * 0.45, S.clunk.thunkS, L.clunk, 'sine', bike)
      tick(at, L.clunk * 0.9, 0.6)
      tick(at + S.clunk.settleS, L.clunk * 0.5, 0.8)
    },
    stop() {
      if (stopped) return
      stopped = true
      master.gain.setTargetAtTime(0, c.currentTime, 0.1)
      setTimeout(() => {
        for (const n of running) n.stop()
        master.disconnect()
      }, 600)
    },
  }
}

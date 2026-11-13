import { CFG } from '../../config'
import { settings } from '../../core/settings'
import { QUIP_LINES, type QuipLine } from '../../fun/quipLines'

const Q = CFG.freeRide.quips

/** What the commentator can see of the ride. */
export interface QuipState {
  /** Wall-clock seconds, for the rate limits, and seconds spent riding. */
  now: number
  t: number
  /** Metres ridden and the route's length. */
  dist: number
  total: number
  /** Road gradient in %, speed in m/s, power as a percentage of FTP. */
  grade: number
  speed: number
  ftpPct: number
  stopped: boolean
  /** The top of the route has just been reached. */
  summit?: boolean
  /** What is beside the road or in the air right now: an oddity, landmark or animal kind. */
  near?: string
}

/** Lines by tag, shuffled once; each tag goes right round before repeating. */
function dealer(pool: readonly QuipLine[], rand: () => number) {
  const by = new Map<string, string[]>()
  for (const [text, tag] of pool) by.set(tag, [...(by.get(tag) ?? []), text])
  for (const list of by.values())
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  const used = new Map<string, number>()
  return {
    has: (tag: string) => by.has(tag),
    deal(tag: string) {
      const list = by.get(tag)
      const n = used.get(tag) ?? 0
      used.set(tag, n + 1)
      return list?.[n % list.length]
    },
  }
}

/** The tag for something nearby, if there are words for it: its own, or the shared one for big things. */
export const nearTag = (near: string, has: (tag: string) => boolean) =>
  [`near:${near}`, `near:${near.replace(/^big.*/, 'big')}`].find(has)

/**
 * The free-ride commentator: call `next` every tick and now and then it hands back a dry remark that suits
 * where the rider is and how they are going. At most one a minute; above a hard effort only a word of
 * encouragement; once-a-ride remarks at the start, halfway, the summit and the last kilometre.
 */
export class Quipper {
  private last = -Infinity
  private ambientDue: number | undefined
  private done = new Set<string>()
  private nearWas: string | undefined
  private stoppedAt: number | undefined
  private lines: ReturnType<typeof dealer>

  constructor(
    private rand: () => number = Math.random,
    pool: readonly QuipLine[] = QUIP_LINES,
  ) {
    this.lines = dealer(pool, rand)
  }

  next(s: QuipState): string | undefined {
    const tag = this.pick(s)
    if (!tag) return undefined
    this.last = s.now
    this.ambientDue = s.now + Q.ambientS * (0.7 + this.rand() * 0.6)
    return this.lines.deal(tag)
  }

  private once(tag: string, when: boolean) {
    if (!when || this.done.has(tag)) return false
    this.done.add(tag)
    return true
  }

  private pick(s: QuipState): string | undefined {
    const since = s.now - this.last
    this.ambientDue ??= s.now + Q.ambientS * this.rand()
    // Things noticed while the commentator has to keep quiet are let go, not saved up for later.
    const fresh = s.near !== this.nearWas ? s.near : undefined
    this.nearWas = s.near
    if (!s.stopped) this.stoppedAt = undefined
    else this.stoppedAt ??= s.now
    if (s.ftpPct > Q.hardPct) return since >= Q.hardGapS ? 'hard' : undefined
    if (since >= Q.milestoneGapS) {
      if (this.once('summit', !!s.summit)) return 'summit'
      if (this.once('togo', s.total >= Q.togoMinM && s.total - s.dist < 1000)) return 'togo'
      if (this.once('halfway', s.total >= Q.halfMinM && s.dist > s.total / 2)) return 'halfway'
      if (this.once('start', s.t > Q.startS && s.t < Q.startS * 5)) return 'start'
    }
    if (since < Q.gapS) return undefined
    if (s.stopped) {
      const waited = s.now - (this.stoppedAt ?? s.now)
      return this.once(`stop${this.stoppedAt}`, waited > Q.stoppedS) ? 'stopped' : undefined
    }
    const near = fresh && nearTag(fresh, this.lines.has)
    if (near && this.rand() < Q.nearChance) return near
    if (s.now < this.ambientDue) return undefined
    if (s.grade <= Q.descentPct) return s.speed > Q.fastMs ? 'fast' : 'descent'
    if (s.grade >= Q.climbPct)
      return s.speed < Q.slowMs ? 'slow' : s.grade >= Q.steepPct ? 'steep' : 'climb'
    if (s.ftpPct < Q.easyPct && s.speed > 1) return 'easy'
    const u = this.rand()
    if (s.t > Q.longS && u < 0.3) return 'long'
    return Math.abs(s.grade) < Q.flatPct && u > 0.7 ? 'flat' : 'any'
  }
}

/** Power over the last few seconds (the newest reading included) as a % of FTP: how hard it is right now. */
export const recentPct = (recorded: number[], now: number, ftp: number) =>
  (100 * recorded.slice(-5).reduce((a, b) => a + b, now)) / (Math.min(5, recorded.length) + 1) / ftp

/** Says a remark out loud when the announcer is on and the device can speak. */
export function speak(text: string) {
  if (!settings.announcer || !settings.volume || !('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    const vs = speechSynthesis.getVoices()
    const v = vs.find((x) => x.lang === 'en-AU') ?? vs.find((x) => x.lang.startsWith('en'))
    if (v) u.voice = v
    u.pitch = 0.85
    u.volume = settings.volume * settings.mixVoice
    speechSynthesis.speak(u)
  } catch {
    /* no speech on this device */
  }
}

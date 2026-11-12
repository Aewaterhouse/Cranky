import { settings } from '../core/settings'

/** A dry Australian voice-over for the bus, using the browser's speech synthesis. */
const LINES: Record<string, string[]> = {
  longhaul: ['Long haul. Settle in.', 'Long haul. Find your rhythm and stay there.'],
  surge: ['Horde surge. Hold your overs.', 'Here they come. Clean overs shake them off.'],
  rampup: ['It only goes up from here.', 'Ramp up. Out of the valley we go.'],
  roadblock: ['Roadblock ahead. Sprint on my mark.', 'Roadblock. Give it everything.'],
  servo: ['Servo stop. Grab a pie.', 'Servo stop. Shop is open, legs are closed.'],
  hit: ['They are on the bus.', 'That will buff out.', 'Armour is not a renewable resource.'],
  grab: ['Zombies on the back door.'],
  shake: ['Shook them off. Lovely.'],
  smash: ['Roadblock smashed. Beautiful.', 'Straight through. Textbook.'],
  crash: ['Well. We got through it.', 'Subtle.'],
  fell: ['{name} has left the bus.', '{name} is going for a little run.'],
  hauled: ['{name} is back aboard. Barely.'],
  tune: ['Engine is purring.', 'In tune. Listen to that.'],
  nitro: ['Nitro. Hold on to something.', 'Afterburner. Lovely riding.'],
  repel: ['Repellent. Money well spent.'],
  slowmo: ['{name}. Mega.'],
  FAIL: ['Was that a sprint?', 'We will call that a warm-up.'],
  HIT: ['That will do.'],
  GREAT: ['Not bad at all.', 'Good sprint.'],
  MEGA: ['Now we are talking.', 'Ripper.'],
  LEGEND: ['Strewth. All-time best.', 'Legend. Bolt a trophy on the bus.'],
}
const MIN_GAP_MS = 3500
let last = 0

function voice() {
  const vs = speechSynthesis.getVoices()
  return (
    vs.find((v) => v.lang === 'en-AU') ??
    vs.find((v) => v.lang === 'en-GB') ??
    vs.find((v) => v.lang.startsWith('en'))
  )
}

/** Speaks a line for an event kind, at most one every few seconds. Important kinds jump the queue. */
export function announce(kind: string, name = 'Someone') {
  const lines = LINES[kind]
  if (!lines || !settings.announcer || !settings.volume || !('speechSynthesis' in window)) return
  const urgent = ['roadblock', 'fell', 'LEGEND', 'MEGA'].includes(kind)
  const now = performance.now()
  if (!urgent && now - last < MIN_GAP_MS) return
  last = now
  try {
    if (urgent) speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(
      lines[Math.floor(Math.random() * lines.length)].replace('{name}', name),
    )
    const v = voice()
    if (v) u.voice = v
    u.rate = 1.05
    u.pitch = 0.85
    u.volume = settings.volume
    speechSynthesis.speak(u)
  } catch {
    /* no speech on this device */
  }
}

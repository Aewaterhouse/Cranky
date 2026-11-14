import { sharedPos, syncStep, videoId, type Shared } from './core/watchSync'
import { ytPlayer } from './ui/ytPlayer'

/**
 * Dev page: two YouTube players following one made-up room clock, as two riders would. Pause, play, seek and
 * change video as the host; drag one player's own scrubber away and it should jump back within a second or two.
 * `v=<link or id>` picks the first video.
 */
const q = new URLSearchParams(location.search)
const now = () => performance.now() / 1000
const room: Shared = {
  vid: videoId(q.get('v') ?? '') ?? 'aqz-KE-bpKQ',
  playing: false,
  pos: 0,
  at: now(),
}
const log = document.getElementById('log')!
const players = ['a', 'b'].map((id) =>
  ytPlayer(
    document.getElementById(id)!,
    (c) => (log.textContent = `player ${id}: YouTube error ${c}`),
  ),
)
const set = (o: Partial<Shared>) =>
  Object.assign(room, { pos: sharedPos(room, now()), at: now() }, o)
const btn = (label: string, f: () => void) => {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = f
  return b
}
const input = document.createElement('input')
input.placeholder = 'Paste a YouTube link'
document.getElementById('bar')!.append(
  btn('Play', () => set({ playing: true })),
  btn('Pause', () => set({ playing: false })),
  btn('+30 s', () => set({ pos: sharedPos(room, now()) + 30 })),
  input,
  btn('Load', () => {
    const v = videoId(input.value)
    if (v) set({ vid: v, pos: 0 })
  }),
)
setInterval(() => {
  const lines = players.map((p, i) => {
    const me = p.local()
    if (!me) return `${'ab'[i]}: loading`
    const s = syncStep(room, me, now())
    p.apply(s)
    return `${'ab'[i]}: state ${me.state} at ${me.time.toFixed(1)} s ${s ? `-> ${s.k}` : ''}`
  })
  if (!log.textContent?.includes('error'))
    log.textContent = [
      `room: ${room.vid} ${room.playing ? 'playing' : 'paused'} at ${sharedPos(room, now()).toFixed(1)} s`,
      ...lines,
    ].join('\n')
}, 500)

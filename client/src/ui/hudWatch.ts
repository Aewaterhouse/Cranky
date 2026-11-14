import '../hudWatch.css'
import { sourceName, videoSource } from '../core/watchSync'
import type { Tick, WatchState } from '../net/protocol'
import { h } from './dom'
import type { GamePanel } from './hudOpts'
import { set } from './hudKit'

/** Watch party panel: what's on, the queue, a box to add a video and (for the driver) the remote. */
export function makeWatchPanel(
  act: (k: string, v: string) => void,
  host: () => boolean,
): GamePanel {
  const now = h('div', { class: 'wp-now' })
  const queue = h('div', { class: 'dt-table' })
  const input = h('input', {
    placeholder: 'Paste a YouTube or Twitch link',
    class: 'wp-in',
  }) as HTMLInputElement
  const note = h('small', { class: 'wp-note' })
  const add = () => {
    const v = videoSource(input.value)
    set(note, v ? 'Added.' : 'Paste a YouTube or Twitch link, or a link to a video file.')
    if (v) {
      act('add', v)
      input.value = ''
    }
  }
  input.onkeydown = (e) => e.key === 'Enter' && (e.stopPropagation(), add())
  const btn = (label: string, k: string, v = '') => h('button', { onclick: () => act(k, v) }, label)
  const playBtn = btn('⏯ Play', 'play')
  const remote = h(
    'div',
    { class: 'wp-remote' },
    btn('⏪ 30 s', 'seek', '-30'),
    playBtn,
    btn('30 s ⏩', 'seek', '30'),
    btn('⏭ Next', 'next'),
  )
  const EMOJI = ['😂', '🔥', '😱', '👏', '🥵', '💀']
  const tray = h(
    'div',
    { class: 'dt-tray' },
    ...EMOJI.map((e) => h('button', { onclick: () => act('emoji', e) }, e)),
  )
  const float = h('div', { class: 'wp-float' })
  const root = h(
    'section',
    { class: 'hud-glass am wp' },
    h('div', { class: 'bs-head' }, h('label', {}, 'WATCH PARTY')),
    now,
    remote,
    h('div', { class: 'wp-add' }, input, h('button', { onclick: add }, 'Add')),
    note,
    queue,
    tray,
  )
  let queueKey = ''
  return {
    root,
    update(m: Tick) {
      const g = m.game as unknown as WatchState | null | undefined
      if (g?.g !== 'watch') return
      set(
        now,
        g.vid
          ? `${g.playing ? '▶' : '⏸'} ${g.title ?? sourceName(g.vid)}`
          : 'Nothing on. Paste a link to start the show.',
      )
      remote.hidden = !host()
      set(playBtn, g.playing ? '⏸ Pause' : '▶ Play')
      playBtn.onclick = () => act(g.playing ? 'pause' : 'play', '')
      const key = JSON.stringify([g.queue, host()])
      if (key !== queueKey) {
        queueKey = key
        queue.replaceChildren(
          ...g.queue
            .slice(0, 6)
            .map((q, n) =>
              h(
                'div',
                { class: 'dt-row wp-q' },
                h('span', {}, `${n + 1}. ${q.title ?? sourceName(q.vid)}`),
                host()
                  ? h(
                      'span',
                      {},
                      n
                        ? h('button', { title: 'Move up', onclick: () => act('up', q.vid) }, '↑')
                        : '',
                      h('button', { title: 'Remove', onclick: () => act('drop', q.vid) }, '✕'),
                    )
                  : h('small', {}, q.by),
              ),
            ),
        )
      }
    },
    fx(fx) {
      if (fx.k !== 'emoji' || !fx.text) return
      // A reaction floats up the right of the screen and fades.
      const e = h('i', {}, fx.text)
      e.style.setProperty('--x', `${Math.random() * 18}vw`)
      // The HUD is zoomed, so the layer lives on the page itself to float over the right of the screen.
      if (!float.isConnected) document.body.append(float)
      float.append(e)
      if (!root.isConnected) float.remove()
      setTimeout(() => e.remove(), 3200)
    },
  }
}

import '../hudWatch.css'
import { videoId } from '../core/watchSync'
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
    placeholder: 'Paste a YouTube link',
    class: 'wp-in',
  }) as HTMLInputElement
  const note = h('small', { class: 'wp-note' })
  const add = () => {
    const v = videoId(input.value)
    set(note, v ? 'Added.' : 'That doesn’t look like a YouTube link.')
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
  const root = h(
    'section',
    { class: 'hud-glass am wp' },
    h('div', { class: 'bs-head' }, h('label', {}, 'WATCH PARTY')),
    now,
    remote,
    h('div', { class: 'wp-add' }, input, h('button', { onclick: add }, 'Add')),
    note,
    queue,
  )
  return {
    root,
    update(m: Tick) {
      const g = m.game as unknown as WatchState | null | undefined
      if (g?.g !== 'watch') return
      set(
        now,
        g.vid
          ? `${g.playing ? '▶' : '⏸'} ${g.title ?? g.vid}`
          : 'Nothing on. Paste a link to start the show.',
      )
      remote.hidden = !host()
      set(playBtn, g.playing ? '⏸ Pause' : '▶ Play')
      playBtn.onclick = () => act(g.playing ? 'pause' : 'play', '')
      queue.replaceChildren(
        ...g.queue
          .slice(0, 5)
          .map((q, i) =>
            h(
              'div',
              { class: 'dt-row' },
              h('span', {}, `${i + 1}. ${q.title ?? q.vid}`),
              h('small', {}, q.by),
            ),
          ),
      )
    },
  }
}

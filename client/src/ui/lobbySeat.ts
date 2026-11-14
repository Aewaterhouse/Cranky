import type { Lobby } from '../net/protocol'
import { TIER_NAME } from '../types'
import { avatar, h } from './dom'

/** One lobby seat: who is in it (name, titles, ready, tier, FTP, bot or ERG, the driver), or an empty one. */
export const seat = (meId: string, r?: Lobby['riders'][number], host?: string) =>
  r
    ? h(
        'div',
        { class: `seat${r.connected ? '' : ' away'}${r.id === meId ? ' me' : ''}` },
        h('i', {
          class: `dot${r.connected ? ' on' : ''}`,
          title: r.connected ? 'Connected' : 'Away',
        }),
        avatar(r.name, 'lg'),
        h(
          'b',
          {},
          r.name,
          r.ready && r.id !== host ? h('span', { class: 'ready-tick', title: 'Ready' }, ' ✓') : '',
        ),
        ...(r.titles ?? []).map((t) => h('small', { class: 'seat-title' }, t)),
        h('span', { class: `tier-badge ${r.tier}` }, TIER_NAME[r.tier]),
        h('small', {}, `${r.ftp} W`),
        r.bot ? h('span', { class: 'bot-badge', title: 'Bot rider' }, '🤖') : '',
        r.bot
          ? ''
          : h(
              'span',
              { class: 'erg-badge', title: r.erg === false ? 'ERG off, on gears' : 'ERG on' },
              r.erg === false ? '⚙ Gears' : 'ERG',
            ),
        r.id === host ? h('span', { class: 'driver' }, 'Driver') : '',
      )
    : h(
        'div',
        { class: 'seat vacant' },
        h('span', { class: 'ghost-ava' }, '?'),
        h('small', {}, 'waiting…'),
      )

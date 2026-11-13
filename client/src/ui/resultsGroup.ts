import { fmt, h, pctStr } from './dom'
import type { GroupSummary } from './results'

const TROPHY =
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M7 3h10v6a5 5 0 0 1-10 0V3z"/><path d="M3 4h4v2H5a2 2 0 0 0 2 3v2a4 4 0 0 1-4-4V4zm18 0h-4v2h2a2 2 0 0 1-2 3v2a4 4 0 0 0 4-4V4z"/><rect x="11" y="14" width="2" height="4"/><rect x="8" y="18" width="8" height="3" rx="1"/></svg>'

const tile = (label: string, value: string, cls = '') =>
  h('div', { class: `res-tile ${cls}` }, h('span', {}, label), h('b', {}, value))

/** Bus-ride extras: score, distance, armour, sync, award trophies and the crew table. */
export function groupSection(g: GroupSummary, myId: string) {
  const trophy = (a: GroupSummary['awards'][number]) => {
    const icon = h('span', { class: 'res-trophy' })
    icon.innerHTML = TROPHY
    return h(
      'div',
      { class: `res-award${a.id === myId ? ' mine' : ''}` },
      icon,
      h('b', {}, a.award),
      h('div', { class: 'who' }, a.name),
      h('div', { class: 'dim' }, a.why),
    )
  }
  const mad = g.mode === 'madness'
  return h(
    'div',
    { class: 'res-group' },
    h(
      'div',
      { class: 'res-bus card' },
      h(
        'div',
        { class: 'res-score' },
        h('span', {}, mad ? 'Pack effort points' : 'Bus score'),
        h('b', {}, g.score.toLocaleString()),
      ),
      tile('Distance', `${(g.distance / 1000).toFixed(1)} km`),
      ...(mad
        ? []
        : [
            tile('Armour', String(Math.round(g.armour))),
            tile('Sync', `${Math.round(g.syncPct)}%`),
            tile('Scrap', String(g.scrap)),
          ]),
    ),
    g.awards.length
      ? h(
          'div',
          { class: 'card' },
          h('h2', {}, 'Awards'),
          h('div', { class: 'res-awards' }, ...g.awards.map(trophy)),
        )
      : '',
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'Crew'),
      h(
        'table',
        {},
        h(
          'tr',
          {},
          ...[
            'Rider',
            'Compliance',
            'Time in zone',
            mad ? 'Points · in the red' : 'Falls',
            'Sprints',
          ].map((x) => h('th', {}, x)),
        ),
        ...g.riders.map((r) =>
          h(
            'tr',
            { class: r.id === myId ? 'me' : '' },
            h('td', {}, r.name),
            h('td', {}, pctStr(r.compliance)),
            h('td', {}, fmt(r.inBandSecs)),
            h('td', {}, mad ? `${r.points ?? 0} · ${r.redSecs ?? 0} s` : String(r.falls)),
            h('td', {}, r.sprints.join(' ') || '–'),
          ),
        ),
      ),
    ),
  )
}

/** Composes the end-of-ride scene snapshot with the crew's numbers and downloads a PNG for the group chat. */
export async function postcard(g: GroupSummary, planName: string) {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 800
  const x = c.getContext('2d')!
  x.fillStyle = '#15161a'
  x.fillRect(0, 0, 1200, 800)
  if (g.postcard) {
    const img = new Image()
    img.src = g.postcard
    await img.decode().catch(() => {})
    const s = Math.max(1200 / img.width, 520 / img.height)
    x.drawImage(img, (1200 - img.width * s) / 2, 0, img.width * s, img.height * s)
  }
  x.fillStyle = 'rgba(0,0,0,0.75)'
  x.fillRect(0, 470, 1200, 330)
  x.fillStyle = '#f2b705'
  x.font = '900 64px system-ui'
  x.fillText('ZOMBIE BUS', 40, 80)
  x.font = 'bold 40px system-ui'
  x.fillText(`Score ${g.score}`, 40, 530)
  x.fillStyle = '#eee'
  x.font = '28px system-ui'
  x.fillText(
    `${planName} · ${(g.distance / 1000).toFixed(1)} km · armour ${Math.round(g.armour)} · sync ${Math.round(g.syncPct)}% · ${g.scrap} scrap`,
    40,
    580,
  )
  x.fillText(`Crew: ${g.riders.map((r) => r.name).join(', ')}`, 40, 625)
  x.font = '24px system-ui'
  g.awards
    .slice(0, 5)
    .forEach((a, i) =>
      x.fillText(
        `🏆 ${a.award}: ${a.name} (${a.why})`,
        40 + (i % 2) * 580,
        680 + Math.floor(i / 2) * 36,
      ),
    )
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `zombie-bus-${new Date().toISOString().slice(0, 10)}.png`
  a.click()
}

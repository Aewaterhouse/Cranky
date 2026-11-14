import type { Game } from '../net/protocol'
import { GAMES } from '../modes/crew/games'
import { fmt, h, pctStr } from './dom'
import { VIEWS, mvpLine, tile } from './resultsViews'
import type { GroupSummary } from './results'
import { savePng } from './ridePostcard'

const TROPHY =
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M7 3h10v6a5 5 0 0 1-10 0V3z"/><path d="M3 4h4v2H5a2 2 0 0 0 2 3v2a4 4 0 0 1-4-4V4zm18 0h-4v2h2a2 2 0 0 1-2 3v2a4 4 0 0 0 4-4V4z"/><rect x="11" y="14" width="2" height="4"/><rect x="8" y="18" width="8" height="3" rx="1"/></svg>'

/** Bus-ride extras: score, distance, armour, sync, award trophies and the crew table. */
export function groupSection(g: GroupSummary, myId: string, context = '') {
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
  const view = VIEWS[g.mode ?? 'bus'] ?? VIEWS.bus
  return h(
    'div',
    { class: 'res-group' },
    h(
      'div',
      { class: 'res-bus card' },
      h(
        'div',
        { class: 'res-score' },
        h('span', {}, GAMES[(g.mode ?? 'bus') as Game].score),
        h('b', {}, g.score.toLocaleString()),
        context ? h('small', {}, context) : '',
      ),
      tile('Distance', `${(g.distance / 1000).toFixed(1)} km`),
      ...view.tiles(g),
    ),
    view.extra?.(g) ?? '',
    g.awards.length
      ? h(
          'div',
          { class: 'card' },
          h('h2', {}, 'Awards'),
          h('div', { class: 'res-awards' }, ...g.awards.map(trophy)),
          ...(g.titles ?? []).map((t) => h('p', { class: 'res-title' }, t)),
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
          ...['Rider', 'Compliance', 'Time in zone', view.col, 'Sprints'].map((x) =>
            h('th', {}, x),
          ),
        ),
        ...g.riders.map((r) =>
          h(
            'tr',
            { class: r.id === myId ? 'me' : '' },
            h('td', {}, r.name, h('small', { class: 'mvp' }, mvpLine(r, g.riders))),
            h('td', {}, pctStr(r.compliance)),
            h('td', {}, fmt(r.inBandSecs)),
            h('td', {}, view.cell(r)),
            h('td', {}, r.sprints.join(' ') || '–'),
          ),
        ),
      ),
    ),
  )
}

/** Composes the end-of-ride scene snapshot with the crew's numbers and downloads a PNG for the group chat. */
/** Saves the bus postcard as a PNG. */
export const postcard = async (
  g: GroupSummary,
  planName: string,
  date = new Date().toISOString(),
) =>
  savePng(
    await busCard(g, planName),
    `${GAMES[(g.mode ?? 'bus') as Game].name.toLowerCase().replace(/\W+/g, '-')}-${new Date(date).toLocaleDateString('en-CA')}`,
  )

/** The bus postcard: the scene still (when there is one), the score, the crew and the awards. */
export async function busCard(g: GroupSummary, planName: string) {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 800
  const x = c.getContext('2d')!
  // the sky the free-ride card uses, for a card rebuilt in History with no scene still
  const sky = x.createLinearGradient(0, 0, 0, 520)
  sky.addColorStop(0, '#2b3a55')
  sky.addColorStop(1, '#e8a86b')
  x.fillStyle = sky
  x.fillRect(0, 0, 1200, 800)
  if (!g.postcard) {
    // No scene still (rebuilt in History, or the renderer would not give one): a cartoon road under the game's icon.
    x.fillStyle = '#3d5a3a'
    x.beginPath()
    x.ellipse(300, 520, 520, 200, 0, Math.PI, 0)
    x.ellipse(950, 520, 480, 160, 0, Math.PI, 0)
    x.fill()
    x.fillStyle = '#4a4f5a'
    x.beginPath()
    x.moveTo(560, 520)
    x.lineTo(640, 520)
    x.lineTo(900, 800)
    x.lineTo(300, 800)
    x.fill()
    x.font = '200px system-ui'
    x.textAlign = 'center'
    x.fillText(GAMES[(g.mode ?? 'bus') as Game].icon, 600, 400)
    x.textAlign = 'start'
  } else {
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
  x.fillText(GAMES[(g.mode ?? 'bus') as Game].name.toUpperCase(), 40, 80)
  x.font = 'bold 40px system-ui'
  x.fillText(`Score ${g.score}`, 40, 530)
  x.fillStyle = '#eee'
  x.font = '28px system-ui'
  x.fillText(
    `${planName} · ${(g.distance / 1000).toFixed(1)} km${(g.mode ?? 'bus') === 'bus' ? ` · armour ${Math.round(g.armour)}` : ''} · sync ${Math.round(g.syncPct)}% · ${g.scrap} scrap`,
    40,
    580,
  )
  x.fillText(`Crew: ${g.riders.map((r) => r.name).join(', ')}`, 40, 625)
  x.font = '24px system-ui'
  g.awards.slice(0, 6).forEach((a, i) => {
    // Each award keeps to its own column, cut short with an ellipsis rather than running into the next.
    let t = `🏆 ${a.award}: ${a.name} (${a.why})`
    while (x.measureText(t).width > 550 && t.length > 4) t = t.slice(0, -2).trimEnd() + '…'
    x.fillText(t, 40 + (i % 2) * 580, 680 + Math.floor(i / 2) * 36)
  })
  return c
}

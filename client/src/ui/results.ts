import { bankScrap } from '../core/cosmetics'
import { applyRide, ftpSuggestion, type Profile } from '../core/curve'
import { postRide, saveProfile } from '../core/profile'
import type { RideSummary } from '../core/ride'
import { fmt, h, pctStr, show } from './dom'

export interface GroupSummary {
  distance: number
  armour: number
  syncPct: number
  scrap: number
  score: number
  riders: {
    id: string
    name: string
    compliance: number
    inBandSecs: number
    sprints: string[]
    falls: number
  }[]
  awards: { award: string; id: string; name: string; why: string }[]
  postcard?: string
}

const DUR_LABEL: Record<string, string> = {
  1: '1 s',
  5: '5 s',
  15: '15 s',
  30: '30 s',
  60: '1 min',
  120: '2 min',
  300: '5 min',
  600: '10 min',
  1200: '20 min',
  3600: '60 min',
}

/** Applies the ride to the profile, saves it and shows the summary screen. */
export function finishRide(
  profile: Profile,
  s: RideSummary,
  onDone: (p: Profile) => void,
  group?: GroupSummary,
  doneLabel = 'Back to garage',
) {
  const before = profile.allTime
  let p = s.record.secs >= 30 ? applyRide(profile, s.record) : profile
  const myAwards = group?.awards.filter((a) => a.id === profile.id).length ?? 0
  const banked = group ? bankScrap(group.scrap, myAwards) : 0
  if (banked) p = { ...p, scrap: p.scrap + banked }
  saveProfile(p)
  if (s.record.secs >= 30) postRide(s)
  const prs =
    p === profile
      ? []
      : Object.entries(s.record.best).filter(([d, w]) => !before[+d] || w > before[+d].w)
  const sug = ftpSuggestion(p)
  const exportJson = () => {
    const a = h('a', {
      href: URL.createObjectURL(
        new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
      ),
      download: `ride-${s.record.date.slice(0, 16)}.json`,
    })
    a.click()
  }
  const table = (head: string[], rows: (string | number)[][]) =>
    h(
      'table',
      {},
      h('tr', {}, ...head.map((x) => h('th', {}, x))),
      ...rows.map((r) => h('tr', {}, ...r.map((x) => h('td', {}, String(x))))),
    )
  const ftpBox = h('div')
  if (sug)
    ftpBox.append(
      h(
        'div',
        { class: 'card hl' },
        `Your 20 min best suggests an FTP of ${sug} W (currently ${p.ftp} W). `,
        h(
          'button',
          {
            onclick: () => {
              p = { ...p, ftp: sug }
              saveProfile(p)
              ftpBox.replaceChildren(h('div', { class: 'card' }, `FTP updated to ${sug} W.`))
            },
          },
          'Update FTP',
        ),
      ),
    )
  show(
    h(
      'div',
      { class: 'page' },
      h('h1', {}, group ? 'Made it!' : 'Ride done'),
      h(
        'p',
        {},
        `${s.planName} · ${fmt(s.record.secs)} · ${s.avgPower} W avg · ${s.record.kj} kJ · compliance ${pctStr(s.compliance)}`,
      ),
      ...(group
        ? [
            h(
              'div',
              { class: 'card' },
              h('h2', {}, 'The bus'),
              `Score ${group.score} · Distance ${(group.distance / 1000).toFixed(1)} km · Armour ${Math.round(group.armour)} · Sync ${Math.round(group.syncPct)}% · Scrap ${group.scrap}`,
            ),
            h(
              'div',
              { class: 'card' },
              h('h2', {}, 'Awards'),
              ...group.awards.map((a) =>
                h(
                  'div',
                  { class: 'award' },
                  h('b', {}, a.award),
                  ` ${a.name} `,
                  h('span', { class: 'dim' }, a.why),
                ),
              ),
            ),
            h(
              'div',
              { class: 'card' },
              h('h2', {}, 'Crew'),
              table(
                ['Rider', 'Compliance', 'Time in zone', 'Falls', 'Sprints'],
                group.riders.map((r) => [
                  r.name,
                  pctStr(r.compliance),
                  fmt(r.inBandSecs),
                  r.falls,
                  r.sprints.join(' ') || '–',
                ]),
              ),
            ),
          ]
        : []),
      banked
        ? h(
            'div',
            { class: 'card hl' },
            `+${banked} scrap banked${myAwards ? ` (incl. ${myAwards} award bonus)` : ''}. Balance: ${p.scrap}. Spend it in the garage.`,
          )
        : '',
      ftpBox,
      prs.length
        ? h(
            'div',
            { class: 'card hl' },
            h('h2', {}, 'New PRs'),
            ...prs.map(([d, w]) =>
              h(
                'div',
                {},
                `${DUR_LABEL[d]}: ${w} W${before[+d] ? ` (was ${before[+d].w} W)` : ''}`,
              ),
            ),
          )
        : '',
      s.sprints.length
        ? h(
            'div',
            { class: 'card' },
            h('h2', {}, 'Sprints'),
            table(
              ['#', 'Grade', 'Avg', '% of 90-day best'],
              s.sprints.map((x, i) => [i + 1, x.grade, `${x.avg} W`, pctStr(x.pct)]),
            ),
          )
        : '',
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Blocks'),
        table(
          ['Block', 'Time', 'Target', 'Avg', 'Compliance', 'In zone'],
          s.blocks.map((b) => [
            b.label,
            fmt(b.secs),
            b.avgTarget ? `${b.avgTarget} W` : '–',
            `${b.avgPower} W`,
            b.type === 'sprint' || b.type === 'free' ? '–' : pctStr(b.compliance),
            fmt(b.inBandSecs),
          ]),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { onclick: exportJson }, 'Export JSON'),
        group ? h('button', { onclick: () => postcard(group, s.planName) }, 'Postcard') : '',
        h('button', { class: 'primary', onclick: () => onDone(p) }, doneLabel),
      ),
    ),
  )
}

/** Composes the end-of-ride scene snapshot with the crew's numbers and downloads a PNG for the group chat. */
async function postcard(g: GroupSummary, planName: string) {
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

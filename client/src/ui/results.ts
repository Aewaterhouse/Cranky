import '../results.css'
import { bankScrap } from '../core/cosmetics'
import { applyRide, ftpSuggestion, recordFtp, rideRecord, type Profile } from '../core/curve'
import { stampRide } from '../core/passport'
import { postRide, saveProfile } from '../core/profile'
import type { RideSummary } from '../core/ride'
import { fmt, h, pctStr, show } from './dom'
import { ZONE_COLOURS } from './planGraph'
import { groupSection, postcard } from './resultsGroup'
import { downloadFit, downloadJson } from './rideExport'
import { roadSection } from './roadResults'
import type { RoadSummary } from '../net/protocol'
import { segmentSection } from './segResults'
import { segsFromSeries } from './soloSegs'
import { workoutChart } from './workoutChart'

export interface GroupSummary {
  /** Set to 'madness' for a VO2 Madness ride; absent for the bus. */
  mode?: string
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
    /** VO2 Madness: effort points and seconds over 90% of max heart rate. */
    points?: number
    redSecs?: number
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
const ZONE_NAMES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 max', 'Anaerobic', 'Sprint']

const tile = (label: string, value: string, sub = '', cls = '') =>
  h(
    'div',
    { class: `res-tile ${cls}` },
    h('span', {}, label),
    h('b', {}, value),
    sub ? h('small', {}, sub) : '',
  )

/** Applies the ride to the profile, saves it and shows the summary screen. */
export function finishRide(
  profile: Profile,
  s: RideSummary,
  onDone: (p: Profile) => void,
  group?: GroupSummary,
  doneLabel = 'Done',
  road?: RoadSummary,
) {
  const before = profile.allTime
  let p = s.record.secs >= 30 ? applyRide(profile, rideRecord(s)) : profile
  const myAwards = group?.awards.filter((a) => a.id === profile.id).length ?? 0
  const banked = group ? bankScrap(group.scrap, myAwards) : 0
  if (banked) p = { ...p, scrap: p.scrap + banked }
  // A free ride goes in the passport.
  p = stampRide(p, s)
  saveProfile(p)
  if (s.record.secs >= 30) postRide({ ...s, crew: !!group || !!road })
  const prs =
    p === profile
      ? []
      : Object.entries(s.record.best).filter(([d, w]) => !before[+d] || w > before[+d].w)
  const sug = ftpSuggestion(p)
  const ftpBox = h('div')
  if (sug)
    ftpBox.append(
      h(
        'div',
        { class: 'card hl res-ftp' },
        h(
          'span',
          {},
          `Your 20 min best suggests an FTP of `,
          h('b', {}, `${sug} W`),
          ` (currently ${p.ftp} W). `,
        ),
        h(
          'button',
          {
            class: 'primary',
            onclick: () => {
              p = { ...p }
              recordFtp(p, sug)
              saveProfile(p)
              ftpBox.replaceChildren(h('div', { class: 'card' }, `FTP updated to ${sug} W.`))
            },
          },
          'Update FTP',
        ),
      ),
    )

  const when = new Date(s.record.date).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const zoneRow = (secs: number, i: number) =>
    h(
      'div',
      { class: 'res-zrow' },
      h('span', {}, `Z${i + 1}`, h('small', {}, ZONE_NAMES[i])),
      h(
        'div',
        { class: 'res-zbar' },
        h('i', {
          style: `width:${(secs / Math.max(1, ...s.zones)) * 100}%;background:${ZONE_COLOURS[i]}`,
        }),
      ),
      h('em', {}, fmt(secs)),
      h('small', {}, `${Math.round((secs / Math.max(1, s.record.secs)) * 100)}%`),
    )
  const types = s.blocks.flatMap((b) => Array<string>(b.secs).fill(b.type))
  const chart = workoutChart(s.ftp)
  const chartBox = h('div', { class: 'res-chart' }, chart.el)
  if (s.power.length > 1)
    chart.set({
      segs: segsFromSeries(s.target, types, s.ftp),
      total: s.power.length,
      power: s.power,
      cadence: [],
      hr: s.hr,
      showHr: s.avgHr != null,
    })
  else chartBox.hidden = true

  show(
    h(
      'div',
      { class: 'page res' },
      h(
        'div',
        { class: 'res-hero' },
        h('h1', {}, group ? 'Made it!' : 'Ride done'),
        h('p', {}, h('b', {}, s.planName), ` · ${when}`),
      ),
      h(
        'div',
        { class: 'res-tiles' },
        tile('Duration', fmt(s.record.secs), '', 'wide'),
        tile('Avg power', `${s.avgPower} W`),
        tile('Normalised', `${s.np} W`, 'weighted average'),
        tile('Intensity', s.if.toFixed(2), 'IF'),
        tile('TSS', String(s.tss), 'training stress'),
        tile('Energy', `${s.record.kj} kJ`),
        tile('Avg cadence', `${s.avgCadence} rpm`),
        ...(s.avgHr == null
          ? []
          : [tile('Avg HR', `${s.avgHr} bpm`), tile('Max HR', `${s.maxHr} bpm`)]),
        ...(s.distance == null
          ? [
              tile(
                'Compliance',
                pctStr(s.compliance),
                `FTP ${s.ftp} W`,
                s.compliance >= 0.9 ? 'good' : '',
              ),
            ]
          : [
              tile('Distance', `${(s.distance / 1000).toFixed(1)} km`),
              tile('Climbed', `${s.ascent ?? 0} m`),
            ]),
      ),
      prs.length
        ? h(
            'div',
            { class: 'card hl res-prs' },
            h('h2', {}, 'New power bests'),
            h(
              'div',
              { class: 'res-prlist' },
              ...prs.map(([d, w]) =>
                h(
                  'div',
                  { class: 'res-pr' },
                  h('span', { class: 'flag' }, 'PR'),
                  h('b', {}, `${w} W`),
                  h('span', {}, DUR_LABEL[d]),
                  before[+d]
                    ? h('small', {}, `was ${before[+d].w} W`)
                    : h('small', {}, 'first time'),
                ),
              ),
            ),
          )
        : '',
      group ? groupSection(group, profile.id) : '',
      road ? roadSection(road, profile.id) : '',
      segmentSection(s.segments),
      ftpBox,
      h('div', { class: 'card' }, h('h2', {}, 'Power vs target'), chartBox),
      h(
        'div',
        { class: 'res-two' },
        h(
          'div',
          { class: 'card' },
          h('h2', {}, 'Time in zone'),
          ...s.zones.map((z, i) => zoneRow(z, i)),
        ),
        s.sprints.length
          ? h(
              'div',
              { class: 'card' },
              h('h2', {}, 'Sprints'),
              h(
                'div',
                { class: 'res-sprints' },
                ...s.sprints.map((x, i) =>
                  h(
                    'div',
                    { class: `res-spr grade-${x.grade}` },
                    h('small', {}, `#${i + 1}`),
                    h('b', {}, x.grade),
                    h('span', {}, `${x.avg} W`),
                    h('small', {}, pctStr(x.pct)),
                  ),
                ),
              ),
              h('p', { class: 'dim' }, 'Percent is of your 90-day best for that length.'),
            )
          : '',
      ),
      banked
        ? h(
            'div',
            { class: 'card hl res-scrap' },
            h('b', {}, `+${banked} scrap`),
            ` banked${myAwards ? ` (incl. ${myAwards} award bonus)` : ''}. Balance: ${p.scrap}. Spend it in the garage.`,
          )
        : '',
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Blocks'),
        h(
          'table',
          {},
          h(
            'tr',
            {},
            ...['Block', 'Time', 'Target', 'Avg', 'Compliance', 'In zone'].map((x) =>
              h('th', {}, x),
            ),
          ),
          ...s.blocks.map((b) => {
            const scored = b.type !== 'sprint' && b.type !== 'free'
            return h(
              'tr',
              {},
              h('td', {}, b.label),
              h('td', {}, fmt(b.secs)),
              h('td', {}, b.avgTarget ? `${b.avgTarget} W` : '–'),
              h('td', {}, `${b.avgPower} W`),
              h(
                'td',
                {},
                scored
                  ? h(
                      'span',
                      { class: `res-comp ${b.compliance >= 0.85 ? 'good' : 'miss'}` },
                      h('i', { style: `width:${b.compliance * 100}%` }),
                      pctStr(b.compliance),
                    )
                  : '–',
              ),
              h('td', {}, fmt(b.inBandSecs)),
            )
          }),
        ),
      ),
      h(
        'div',
        { class: 'row res-actions' },
        h('button', { onclick: () => void downloadFit(s) }, 'Download .fit'),
        h('button', { onclick: () => downloadJson(s) }, 'Export JSON'),
        group ? h('button', { onclick: () => postcard(group, s.planName) }, 'Postcard') : '',
        h('button', { class: 'primary', onclick: () => onDone(p) }, doneLabel),
      ),
    ),
  )
}

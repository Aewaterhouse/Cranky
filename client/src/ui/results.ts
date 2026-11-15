import { moreNumbers } from './moreNumbers'
import '../results.css'
import { CFG } from '../config'
import { GAMES } from '../modes/crew/games'
import type { Game } from '../net/protocol'
import { badgeCard, headline, lastTime, nextUp, scoreContext } from './resultsTop'
import { ftpSuggestion, level, recordFtp, type Profile } from '../core/curve'
import { rideRewards } from './resultsRewards'
import { saveProfile } from '../core/profile'
import { postRide } from '../core/rideQueue'
import { dropEfforts } from '../core/efforts'
import { takeEndChoice } from '../core/keepRide'
import { keepBar } from './keepBar'
import { toast } from './toast'
import { settings } from '../core/settings'
import type { RideSummary } from '../core/ride'
import { fmt, h, pctStr, show } from './dom'
import { ZONE_COLOURS } from './planGraph'
import { GRADE_WORD } from '../types'
import { groupSection, postcard } from './resultsGroup'
import { stravaCardButton } from './strava'
import { blocksCard } from './resultsBlocks'
import { downloadFit, downloadJson } from './rideExport'
import { ridePostcard, savePng } from './ridePostcard'
import { roadSection } from './roadResults'
import type { RoadSummary } from '../net/protocol'
import { segmentSection } from './segResults'
import { UNIT } from './units'
import { segsFromSeries } from './soloSegs'
import { workoutChart } from './workoutChart'

import type { GroupSummary } from './resultsViews'

export type { GroupSummary } from './resultsViews'

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
  still?: string,
  /** A crew ride: a second way out, back to the home screen, beside the 'ride again' button. */
  menu?: (p: Profile) => void,
) {
  const choice = takeEndChoice()
  // Binned at the end-ride confirm: nothing is saved, queued, counted or posted.
  if (choice === 'bin') {
    dropEfforts(profile.id, s.record.date)
    toast('Ride binned. Nothing was saved.')
    return onDone(profile)
  }
  const before = profile.allTime
  const { p: earned, unlocked, banked, myAwards, week } = rideRewards(profile, s, group)
  let p = earned
  saveProfile(p)
  // The crew's result rides along (without the scene still) so History can rebuild the bus postcard.
  const crew = group && { ...group, postcard: undefined }
  const race = !!road?.game && road.game !== 'ride'
  const prs =
    p === profile
      ? []
      : Object.entries(s.record.best).filter(
          // New bests at the familiar durations only: the curve's in-between ones would crowd the row.
          ([d, w]) => d in DUR_LABEL && (!before[+d] || w > before[+d].w),
        )
  // The new bests ride along, so the crew feed can say so.
  // Held on this device until the rider leaves this screen (or bins it); see `keepBar`.
  const queued = s.record.secs >= 30
  if (queued)
    void postRide(profile.id, { ...s, crew: !!group || !!road, group: crew, prs: prs.length }, true)
  const keep = keepBar({
    rider: profile.id,
    s,
    queued,
    noPost: choice === 'noPost',
    restore: () => saveProfile(profile),
    leave: () => onDone(profile),
  })
  const sug = s.test ? null : ftpSuggestion(p)
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
        h('h1', {}, headline(profile.id, group, road)),
        h(
          'p',
          {},
          // A crew game leads with its name; the workout underneath it is the detail.
          group?.mode && group.mode !== 'bus' && GAMES[group.mode as Game]
            ? h('b', {}, `${GAMES[group.mode as Game].icon} ${GAMES[group.mode as Game].name}`)
            : '',
          group?.mode && group.mode !== 'bus' ? ` · ${s.planName}` : h('b', {}, s.planName),
          ` · ${when}`,
        ),
      ),
      // What you earned leads, then the game's story, then the training numbers.
      s.record.secs < 30
        ? h('div', { class: 'card' }, 'Under 30 s, so this one is not saved to your History.')
        : s.test
          ? h(
              'div',
              { class: 'card test-ride' },
              h('b', {}, 'Test ride (simulator). '),
              'It is in your History, but it counts for nothing: no bests, streaks, scrap, badges, ladder or Strava.',
            )
          : '',
      level(p).n > level(profile).n
        ? h(
            'div',
            { class: 'card hl' },
            h('b', {}, `⬆ Level ${level(p).n}!`),
            ' Every ride counts towards the next one.',
          )
        : '',
      ...unlocked.map(badgeCard),
      banked
        ? h(
            'div',
            { class: 'card hl res-scrap' },
            h('b', {}, `+${banked} scrap`),
            ` earned${myAwards ? ` (incl. ${myAwards} award bonus)` : ''}. You have ${p.scrap}. `,
            h('a', { href: '#garage' }, 'Spend it in the Garage →'),
          )
        : '',
      // The weekly streak, the same count home shows, so it is one number everywhere.
      p !== profile && p.stats.streak > 1
        ? h(
            'div',
            { class: 'card hl res-streak' },
            `🔥 ${p.stats.streak} week streak. Ride again next week to keep it.` +
              (p.stats.freezes
                ? ` 🧊 ${p.stats.freezes} freeze${p.stats.freezes > 1 ? 's' : ''} banked for a missed week.`
                : ''),
          )
        : '',
      // The game's outcome is the story of a crew ride: it comes before the training numbers.
      group
        ? groupSection(group, profile.id, s.test ? undefined : scoreContext(profile.id, group))
        : '',
      race ? roadSection(road!, profile.id) : '',
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
                'On target',
                pctStr(s.compliance),
                `FTP ${s.ftp} W`,
                s.compliance >= 0.9 ? 'good' : '',
              ),
            ]
          : [tile('Distance', UNIT.dist(s.distance)), tile('Climbed', UNIT.climb(s.ascent ?? 0))]),
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
      road && !race ? roadSection(road, profile.id) : '',
      segmentSection(s.segments),
      ...week.won.map((w) =>
        h(
          'div',
          { class: 'card hl res-scrap' },
          h('b', {}, `+${w.scrap} scrap`),
          ` ${w.text}. Balance: ${p.scrap}.`,
        ),
      ),
      ftpBox,
      p === profile ? '' : nextUp(p),
      lastTime(profile, s),
      // A crew ride's story is the game: its training numbers fold away. A solo workout shows them open.
      h(
        'details',
        { class: 'res-more', open: !group && !road },
        h('summary', {}, 'Training details'),
        h('div', { class: 'card' }, h('h2', {}, 'Power vs target'), chartBox),
        moreNumbers(s.power, s.hr, s.cadence, s.ftp),
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
                      h('b', {}, GRADE_WORD[x.grade]),
                      h('span', {}, `${x.avg} W`),
                      h('small', {}, pctStr(x.pct)),
                    ),
                  ),
                ),
                h('p', { class: 'dim' }, 'Percent is of your 90-day best for that length.'),
              )
            : '',
        ),
        blocksCard(s),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'ghost', onclick: () => void downloadFit(s) }, 'Download .fit'),
          h('button', { class: 'ghost', onclick: () => downloadJson(s) }, 'Export JSON'),
        ),
      ),
      h(
        'div',
        { class: 'row res-actions' },
        group ? h('button', { onclick: () => postcard(group, s.planName) }, 'Postcard') : '',
        s.route
          ? h(
              'button',
              {
                title: 'A PNG of the ride for the group chat',
                onclick: async () =>
                  savePng(
                    await ridePostcard(
                      s,
                      p.weightKg || CFG.freeRide.defaultKg,
                      still,
                      settings.units,
                    ),
                    `cranky-${s.route!.id}-${new Date(s.record.date).toLocaleDateString('en-CA')}`,
                  ),
              },
              'Save postcard',
            )
          : '',
        s.test ? '' : stravaCardButton(p, s, group, still),
        menu ? h('button', { onclick: () => (keep.keep(), menu(p)) }, '⌂ Main menu') : '',
        h('button', { class: 'primary', onclick: () => (keep.keep(), onDone(p)) }, doneLabel),
      ),
      keep.el,
    ),
  )
}

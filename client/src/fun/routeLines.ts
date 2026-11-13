/**
 * One dry line per bundled route for the loading card and the flyover. Kept safe and general on purpose: no
 * dates, records or history that could be wrong. A test fails if a bundled route has no line.
 */
export const ROUTE_LINES: Record<string, string> = {
  'mount-coot-tha':
    'Brisbane’s local hill. Everyone in town has a time up it and an excuse for it.',
  'mount-coot-tha-back': 'The back of Coot-tha, lap after lap. The hill does not get shorter.',
  'ben-lomond': 'Home of Jacob’s Ladder, a stack of hairpins that looks like a typo on the map.',
  'mount-buffalo': 'A long, steady climb to a granite plateau. Steady is not the same as easy.',
  'falls-creek':
    'Uphill all the way to a ski village. Bring a jacket you will not need on a trainer.',
  'mount-hotham': 'The high one. The last few kilometres are above the trees and beneath contempt.',
  'mount-wellington':
    'kunanyi stands over Hobart. Up top it is windy, cold and worth it, in that order.',
  'willunga-hill': 'Three kilometres that have settled a lot of bike races. Today, yours.',
  'akuna-bay':
    'Bushland, water views and rolling roads north of Sydney. Flat sections sold separately.',
  'great-ocean-road':
    'Ocean on one side, hills on the other, and a corner every hundred metres to keep you honest.',
  'beach-road': 'Melbourne’s morning bunch ride. Flat, fast and full of opinions.',
  mondo: 'A Brisbane loop with more climbing than the name lets on.',
  'full-gas-friday': 'The Friday bunch ride. The name is a warning, not a suggestion.',
  'darren-smith':
    'A road-race circuit. Somebody always attacks on the rise. Today it is you or nobody.',
  'metros-road-race': 'Club road-race laps. The bunch gets smaller every time round.',
  'nundah-crit': 'A bit over a kilometre, dead flat. Keep turning until told otherwise.',
}

const SPARE = [
  'Your own road. We know nothing about it, which has never stopped the commentary.',
  'An imported route. Whatever happens out there is between you and the GPX file.',
  'Unknown territory. The gradient signs are as surprised as you are.',
]

/** The line for a route; an imported route gets one of the spare ones, the same one every time. */
export const routeLine = (id: string) =>
  ROUTE_LINES[id] ?? SPARE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % SPARE.length]

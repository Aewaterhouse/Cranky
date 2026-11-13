/** Dry lines for segment results. Picked from the time itself, so the same result always says the same thing. */
export const SEG_LINES = {
  first: [
    "First go, so it's the PR. Enjoy that while it lasts.",
    'A time on the board. The bar is officially somewhere.',
    'Nothing to beat, and you beat it.',
  ],
  pr: [
    'The old you has been dropped.',
    'Faster than you have ever been. Mildly alarming.',
    'Somebody ate their Weet-Bix.',
    'Your past self would like a word.',
    'Not bad. Not bad at all.',
  ],
  crew: [
    'Top of the crew. Expect a group chat about it.',
    'Somebody is not going to take this well.',
    'Fastest of the lot. Buy your own coffee anyway.',
  ],
  miss: ['Close enough to be annoying.', 'The PR lives to fight another day.', 'Next time.'],
} as const

export const segLine = (kind: keyof typeof SEG_LINES, secs: number) =>
  SEG_LINES[kind][Math.round(secs * 10) % SEG_LINES[kind].length]

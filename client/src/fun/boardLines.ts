/** Dry lines under the leader of a segment board. `{name}` is the leader. */
export const BOARD_LINES = {
  mate: [
    '{name} holds the top step and will bring it up at the cafe.',
    '{name} is in front. Nobody is happy for them.',
    'Property of {name}, for now.',
    '{name} leads. Suspiciously fresh legs that day.',
  ],
  me: [
    'You lead. Act like you have been here before.',
    'Top of the board. Screenshot it before somebody ruins it.',
    'Yours, until a mate has a good day.',
  ],
  alone: [
    'The only time on the board. Technically a course record.',
    'Unchallenged. Also unaccompanied.',
    'First of one. Still counts.',
  ],
} as const

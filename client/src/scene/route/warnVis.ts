/**
 * Heads-up for the sprints and KOMs ahead in free ride (`core/segWarn.ts`, `ui/segCues.ts`): banners at each of
 * `stagesM` metres short of the start line, each up for `bannerS`, then a 3-2-1 over the last `countS` seconds.
 * Colours for the bands on the gradient strip and the map. Shown in the debug panel as `VIS.route.warn`.
 */
export const WARN = {
  stagesM: [1000, 500, 200],
  bannerS: 6,
  countS: 3,
  /** No countdown below this speed (m/s): standing still, it would sit on 3. */
  countMinMs: 1,
  sprint: '#3fbf5f',
  kom: '#e0453a',
  dot: '#ffffff',
  bandAlpha: 0.38,
}

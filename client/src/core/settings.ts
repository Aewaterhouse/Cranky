import { CFG } from '../config'
import { setZonePalette } from '../ui/planGraph'
import { setGradePalette } from './hud'
import type { Units } from './units'

export interface Settings {
  /** Master volume 0..1 for effects and the mood drone. */
  volume: number
  /** Graphics quality for the 3D scene. */
  gfx: 'auto' | 'lowpower' | 'potato' | 'low' | 'medium' | 'high'
  /** In-ride HUD size multiplier; 0 means automatic (bigger on big screens). */
  hudScale: number
  /** Colour-blind-friendly zone and gradient colours. */
  colourBlind: boolean
  /** Spoken commentary during bus rides. */
  announcer: boolean
  /** Zombie Bus: false rides without ERG (a gradient you set yourself); targets are then only scored. */
  busErg: boolean
  /** Dry remarks during free rides. */
  quips: boolean
  /** Free ride as the 3D road world, or the flat charts-and-map layout. */
  freeRideView: '3d' | '2d'
  /** Chainring teeth on the bike on the trainer (with a 14T Zwift Cog), for virtual gears. */
  chainring: number
  /** Free ride: wind along the road (off unless asked for). */
  wind: 'off' | 'breeze' | 'blowy'
  /** Free ride: a steady camera with no shake, lean, tuck or widening view. */
  calmCamera: boolean
  /** Free ride: freehub, wind, tyres, gear clunks and the sounds of the place. */
  rideSounds: boolean
  /** Speed, distance, climb and weight as shown; everything is stored in metric. */
  units: Units
  /** Free ride: how far back the camera sits. */
  camDist: 'near' | 'standard' | 'far'
  /** Less motion: no camera shake, flourishes, flyover or confetti. Auto follows the device's own setting. */
  reducedMotion: 'auto' | 'on' | 'off'
  /** Sound mix, 0..1 each, under the master volume: the bike, the place and the voice. */
  mixRide: number
  mixAmbience: number
  mixVoice: number
  /** Multiplies how much each virtual gear changes the trainer gradient (0.5 to 3). */
  shiftStrength: number
}

const KEY = 'cranky.settings'
const DEFAULTS: Settings = {
  volume: 1,
  gfx: 'auto',
  hudScale: 0,
  colourBlind: false,
  announcer: true,
  busErg: true,
  quips: true,
  freeRideView: '3d',
  chainring: CFG.gears.chainring,
  wind: 'off',
  calmCamera: false,
  rideSounds: true,
  units: 'metric',
  camDist: 'standard',
  reducedMotion: 'auto',
  mixRide: 1,
  mixAmbience: 1,
  mixVoice: 1,
  shiftStrength: CFG.gears.strength.start,
}

export const settings: Settings = { ...DEFAULTS, ...read() }

function read(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** Whether to hold the motion back, from the setting and what the device asks for. */
export const wantsLessMotion = (setting: Settings['reducedMotion'], devicePrefers: boolean) =>
  setting === 'on' || (setting === 'auto' && devicePrefers)

/** Less motion right now on this device. */
export const lessMotion = () =>
  wantsLessMotion(
    settings.reducedMotion,
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

/** Pushes the settings into the page: CSS variable, zone palette and the scene's quality key. */
export function applySettings() {
  const root = document.documentElement.style
  if (settings.hudScale) root.setProperty('--hud-scale', String(settings.hudScale))
  else root.removeProperty('--hud-scale')
  setZonePalette(settings.colourBlind)
  setGradePalette(settings.colourBlind)
  document.documentElement.classList.toggle('cb', settings.colourBlind)
  document.documentElement.classList.toggle('reduced-motion', lessMotion())
  localStorage.setItem('cranky.gfx', settings.gfx)
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch)
  localStorage.setItem(KEY, JSON.stringify(settings))
  applySettings()
}

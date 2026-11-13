import { CFG } from '../config'
import { setZonePalette } from '../ui/planGraph'

export interface Settings {
  /** Master volume 0..1 for effects and the mood drone. */
  volume: number
  /** Graphics quality for the 3D scene. */
  gfx: 'auto' | 'potato' | 'low' | 'medium' | 'high'
  /** In-ride HUD size multiplier; 0 means automatic (bigger on big screens). */
  hudScale: number
  /** Colour-blind-friendly zone colours. */
  colourBlind: boolean
  /** Spoken commentary during bus rides. */
  announcer: boolean
  /** Chainring teeth on the bike on the trainer (with a 14T Zwift Cog), for virtual gears. */
  chainring: number
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
  chainring: CFG.gears.chainring,
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

/** Pushes the settings into the page: CSS variable, zone palette and the scene's quality key. */
export function applySettings() {
  const root = document.documentElement.style
  if (settings.hudScale) root.setProperty('--hud-scale', String(settings.hudScale))
  else root.removeProperty('--hud-scale')
  setZonePalette(settings.colourBlind)
  localStorage.setItem('cranky.gfx', settings.gfx)
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch)
  localStorage.setItem(KEY, JSON.stringify(settings))
  applySettings()
}

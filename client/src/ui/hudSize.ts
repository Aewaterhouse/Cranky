import { saveSettings, settings } from '../core/settings'
import { h, seg } from './dom'

export const HUD_SIZES: [string, string][] = [
  ['0', 'Auto'],
  ['0.85', 'Small'],
  ['1', 'Normal'],
  ['1.3', 'Large'],
  ['1.6', 'Huge'],
]

/** The in-ride display size control: the Settings screen's row, and the same thing in the ride menu. */
export const hudSizeSeg = () =>
  seg(HUD_SIZES, String(settings.hudScale), (v) => saveSettings({ hudScale: +v }), 'hud-size')

export const hudSizeRow = () => h('label', { class: 'menu-size' }, 'Display size', hudSizeSeg())

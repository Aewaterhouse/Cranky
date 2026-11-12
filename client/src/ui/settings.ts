import { saveSettings, settings, type Settings } from '../core/settings'
import { SFX } from './audio'
import { h, seg } from './dom'
import { ZONE_COLOURS } from './planGraph'

/** Per-device preferences: sound, graphics, HUD size, colours. */
export function settingsTab() {
  const row = (title: string, note: string, control: Node) =>
    h(
      'div',
      { class: 'set-row' },
      h('div', {}, h('b', {}, title), h('p', { class: 'dim' }, note)),
      control,
    )
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.volume })
  vol.addEventListener('change', () => {
    saveSettings({ volume: +vol.value })
    SFX.GREAT()
  })
  const swatches = h('div', { class: 'set-zones' })
  const paint = () =>
    swatches.replaceChildren(
      ...ZONE_COLOURS.map((c, i) => h('i', { style: `background:${c}`, title: `Zone ${i + 1}` })),
    )
  paint()
  return h(
    'div',
    { class: 'settings' },
    h('h1', {}, 'Settings'),
    h('p', { class: 'lede' }, 'These stay on this device.'),
    h(
      'section',
      { class: 'card' },
      row('Sound', 'Beeps, splashes and the event drone.', vol),
      row(
        'Graphics',
        'Auto drops the quality if the bus scene runs slowly.',
        seg<Settings['gfx']>(
          [
            ['auto', 'Auto'],
            ['potato', 'Potato'],
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ],
          settings.gfx,
          (gfx) => saveSettings({ gfx }),
        ),
      ),
      row(
        'In-ride display size',
        'How big the numbers are during a bus ride.',
        seg(
          [
            ['0', 'Auto'],
            ['0.85', 'Small'],
            ['1', 'Normal'],
            ['1.3', 'Large'],
            ['1.6', 'Huge'],
          ],
          String(settings.hudScale),
          (v) => saveSettings({ hudScale: +v }),
        ),
      ),
      row(
        'Zone colours',
        'A palette that is easier to tell apart with colour blindness.',
        h(
          'div',
          { class: 'set-cb' },
          seg(
            [
              ['off', 'Standard'],
              ['on', 'Colour-blind'],
            ],
            settings.colourBlind ? 'on' : 'off',
            (v) => (saveSettings({ colourBlind: v === 'on' }), paint()),
          ),
          swatches,
        ),
      ),
    ),
  )
}

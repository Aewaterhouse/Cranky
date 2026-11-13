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
  const ring = h('input', { type: 'number', min: 20, max: 60, step: 1, value: settings.chainring })
  ring.addEventListener('change', () => {
    const v = Math.round(+ring.value)
    if (v >= 20 && v <= 60) saveSettings({ chainring: v })
    else ring.value = String(settings.chainring)
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
        'Announcer',
        'A dry voice calling the action on bus rides.',
        seg(
          [
            ['on', 'On'],
            ['off', 'Off'],
          ],
          settings.announcer ? 'on' : 'off',
          (v) => saveSettings({ announcer: v === 'on' }),
        ),
      ),
      row(
        'Graphics',
        'Auto drops the quality if the 3D scene runs slowly.',
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
        'Free ride view',
        '3D rides the road in a low-poly world. Charts is the flat layout, used anyway if this device cannot draw 3D.',
        seg<Settings['freeRideView']>(
          [
            ['3d', '3D world'],
            ['2d', 'Charts'],
          ],
          settings.freeRideView,
          (freeRideView) => saveSettings({ freeRideView }),
        ),
      ),
      row(
        'In-ride display size',
        'How big the numbers are during a ride. Auto suits most screens; go Large or Huge if the telly is across the room.',
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
        'Chainring (teeth)',
        'The front ring on the bike on your trainer, with a 14T Zwift Cog. Virtual gears use it.',
        ring,
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

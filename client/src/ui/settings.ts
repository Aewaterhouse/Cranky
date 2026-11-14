import { gradeColour } from '../core/hud'
import { saveSettings, settings, type Settings } from '../core/settings'
import { SFX } from './audio'
import { h, seg } from './dom'
import { strengthSlider } from './gearTile'
import { hudSizeSeg } from './hudSize'
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
  const onOff = (on: boolean, set: (on: boolean) => void) =>
    seg(
      [
        ['on', 'On'],
        ['off', 'Off'],
      ],
      on ? 'on' : 'off',
      (v) => set(v === 'on'),
    )
  /** One slider of the sound mix. */
  const mix = (label: string, key: 'mixRide' | 'mixAmbience' | 'mixVoice') => {
    const i = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings[key] })
    i.setAttribute('aria-label', label)
    i.addEventListener('change', () => saveSettings({ [key]: +i.value }))
    return h('label', {}, h('span', {}, label), i)
  }
  const swatches = h('div', { class: 'set-zones' })
  // Zones, then the gradient bands with their numerals: colour is never the only signal.
  const paint = () =>
    swatches.replaceChildren(
      ...ZONE_COLOURS.map((c, i) => h('i', { style: `background:${c}`, title: `Zone ${i + 1}` })),
      h('span', { class: 'set-gap' }),
      ...[-5, 0, 3, 6, 9, 13, 16].map((g) =>
        h('i', { class: 'grade', style: `background:${gradeColour(g)}` }, `${g}%`),
      ),
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
      row('Sound', 'Master volume: beeps, splashes, the event drone and everything below.', vol),
      row(
        'Sound mix',
        'Free ride, under the master volume: the bike (freehub, wind, tyres, gears), the place (birds, surf, traffic) and the voice.',
        h(
          'div',
          { class: 'set-mix' },
          mix('Ride sounds', 'mixRide'),
          mix('Ambience', 'mixAmbience'),
          mix('Voice', 'mixVoice'),
        ),
      ),
      row(
        'Units',
        'Speed, distance, climb and weight as shown. Everything is stored in metric either way.',
        seg<Settings['units']>(
          [
            ['metric', 'km · m · kg'],
            ['imperial', 'mi · ft · lb'],
          ],
          settings.units,
          (units) => saveSettings({ units }),
        ),
      ),
      row(
        'Announcer',
        'A dry voice calling the action on bus rides.',
        onOff(settings.announcer, (announcer) => saveSettings({ announcer })),
      ),
      row(
        'Free ride remarks',
        'Dry comments about the road, the wildlife and your riding. Spoken too when the announcer is on.',
        onOff(settings.quips, (quips) => saveSettings({ quips })),
      ),
      row(
        'Graphics',
        'Auto drops the quality if the 3D scene runs slowly, and remembers where it settled. Low power is the floor: little scenery, a short view, for a struggling device.',
        seg<Settings['gfx']>(
          [
            ['auto', 'Auto'],
            ['lowpower', 'Low power'],
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
        'Free ride sounds',
        'Freehub, wind, tyres, gear clunks and the birds, surf or traffic of the place. All made up on the spot, no recordings.',
        onOff(settings.rideSounds, (rideSounds) => saveSettings({ rideSounds })),
      ),
      row(
        'Cinematics',
        'On the bus, a short letterboxed shot of each air strike and supply drop, and a title when the gunship arrives. Skip one with C or a tap. Off keeps your own view (the gunship still takes over).',
        onOff(settings.cinematics, (cinematics) => saveSettings({ cinematics })),
      ),
      row(
        'Free ride camera',
        'How far back the camera sits, and Calm for a steady one: no shake, lean, tuck or widening view.',
        h(
          'div',
          { class: 'set-cb' },
          seg<Settings['camDist']>(
            [
              ['near', 'Near'],
              ['standard', 'Standard'],
              ['far', 'Far'],
            ],
            settings.camDist,
            (camDist) => saveSettings({ camDist }),
          ),
          h(
            'label',
            { class: 'set-check' },
            h('input', {
              type: 'checkbox',
              checked: settings.calmCamera,
              onchange: (e: Event) =>
                saveSettings({ calmCamera: (e.target as HTMLInputElement).checked }),
            }),
            'Calm camera',
          ),
        ),
      ),
      row(
        'Reduced motion',
        'No camera shake, no flyover or turn round the rider, no confetti. Auto follows this device\'s own "reduce motion" setting.',
        seg<Settings['reducedMotion']>(
          [
            ['auto', 'Auto'],
            ['on', 'On'],
            ['off', 'Off'],
          ],
          settings.reducedMotion,
          (reducedMotion) => saveSettings({ reducedMotion }),
        ),
      ),
      row(
        'Free ride wind',
        'A headwind or tailwind that depends on which way the road points. It changes with the route, the day and the weather.',
        seg<Settings['wind']>(
          [
            ['off', 'Off'],
            ['breeze', 'Breeze'],
            ['blowy', 'Blowy'],
          ],
          settings.wind,
          (wind) => saveSettings({ wind }),
        ),
      ),
      row(
        'In-ride display size',
        'How big the numbers are during a ride. Auto suits most screens; go Large or Huge if the telly is across the room. Also in the ride menu (☰).',
        hudSizeSeg(),
      ),
      row(
        'Chainring (teeth)',
        'The front ring on the bike on your trainer, with a 14T Zwift Cog. Virtual gears use it.',
        ring,
      ),
      row(
        'Shift strength',
        'How much each virtual gear changes the trainer gradient. 100% matches a real gear.',
        strengthSlider(),
      ),
      row(
        'Zone and gradient colours',
        'A second palette that is easier to tell apart with colour blindness, for power zones and for the gradient colours of the elevation strip and climb panel. The numbers are always there too.',
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

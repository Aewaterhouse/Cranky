import { CFG } from '../config'
import '../body.css'
import {
  BODY_FIELDS,
  BODY_PRESETS,
  BODY_TABS,
  bodyOf,
  defaultBody,
  encodeBody,
  presetBody,
  randomBody,
  withBody,
  type Body,
  type BodyField,
} from '../core/body'
import type { Profile } from '../core/curve'
import { saveProfile } from '../core/profile'
import { bodyPreview } from './bodyPreview'
import { h } from './dom'
import { toast } from './toast'

/** Undo keeps this many steps. */
const UNDO = 60
/** Tabs that are about the head: the preview moves in for a close-up. */
const HEAD_TABS = ['Skin', 'Hair', 'Face']

/** One option's control: a slider, a row of choices, colour swatches or a tick box. */
function control(f: BodyField, value: number, set: (v: number) => void) {
  if (f.type === 'slider') {
    const input = h('input', { type: 'range', min: 0, max: f.max, value, 'aria-label': f.label })
    input.addEventListener('input', () => set(+input.value))
    return h(
      'label',
      { class: 'bc-field' },
      h('span', { class: 'bc-name' }, f.label),
      h(
        'span',
        { class: 'bc-slide' },
        h('small', {}, f.lo ?? ''),
        input,
        h('small', {}, f.hi ?? ''),
      ),
    )
  }
  if (f.type === 'toggle') {
    const box = h('input', {
      type: 'checkbox',
      checked: !!value,
      onchange: () => set(+box.checked),
    })
    return h('label', { class: 'bc-field bc-tick' }, box, h('span', { class: 'bc-name' }, f.label))
  }
  return h(
    'div',
    { class: 'bc-field' },
    h('span', { class: 'bc-name' }, `${f.label}: ${f.opts![value]}`),
    h(
      'div',
      {
        class: `bc-picks${f.colours ? ' swatches' : ''}`,
        role: 'radiogroup',
        'aria-label': f.label,
      },
      ...f.opts!.map((name, v) =>
        h(
          'button',
          {
            role: 'radio',
            class: v === value ? 'on' : '',
            'aria-checked': String(v === value),
            title: name,
            'aria-label': name,
            style: f.colours ? `--sw:${f.colours[v]}` : '',
            onclick: () => set(v),
          },
          f.colours ? '' : name,
        ),
      ),
    ),
  )
}

/** Rider → Body: the free character creator. Saves the body into the rider's look. */
export function bodyCreator(p: Profile) {
  let saved = encodeBody(bodyOf(p.id, p.look))
  let body = bodyOf(p.id, p.look)
  const history: Body[] = []
  let tab = BODY_TABS[0]
  let bare = false
  const view = bodyPreview(
    p,
    () => body,
    () => bare,
  )
  const panel = h('div', { class: 'bc-panel' })
  const tabs = h('nav', { class: 'subtabs bc-tabs', role: 'tablist' })
  const undo = h('button', { onclick: () => apply(history.pop()!, false) }, 'Undo')
  const save = h('button', { class: 'primary' }, 'Save')
  /** Takes `next` as the body (remembering the old one for Undo) and redraws. */
  const apply = (next: Body, remember = true) => {
    if (remember) history.push(body) > UNDO && history.shift()
    body = next
    view.refresh()
    draw()
  }
  const set = (key: string, v: number) => {
    // A slider being dragged makes one Undo step, not one per pixel.
    const sliding = (document.activeElement as HTMLInputElement | null)?.type === 'range'
    if (!sliding || lastKey !== key) history.push(body) > UNDO && history.shift()
    lastKey = sliding ? key : ''
    body = { ...body, [key]: v }
    view.refresh()
    if (sliding) buttons()
    else draw()
  }
  let lastKey = ''
  // Like Settings, the creator saves itself a moment after each change, so leaving the tab never loses work.
  let timer = 0
  const buttons = () => {
    undo.disabled = !history.length
    save.disabled = encodeBody(body) === saved
    save.textContent = save.disabled ? 'Saved ✓' : 'Saving…'
    clearTimeout(timer)
    if (!save.disabled) timer = window.setTimeout(store, CFG.bodySaveMs)
  }
  const store = () => {
    clearTimeout(timer)
    if (encodeBody(body) === saved) return
    p.look = withBody(p.look, body)
    saveProfile(p)
    saved = encodeBody(body)
    buttons()
  }
  const fun = () =>
    h(
      'div',
      {},
      h('p', { class: 'dim' }, 'One tap and you are someone else. Undo brings you back.'),
      h(
        'div',
        { class: 'bc-picks' },
        ...BODY_PRESETS.map((x) =>
          h('button', { onclick: () => apply(presetBody(x.name)) }, x.name),
        ),
      ),
      h('button', { class: 'bc-random', onclick: () => apply(randomBody()) }, '🎲 Randomise'),
    )
  const draw = () => {
    lastKey = ''
    tabs.replaceChildren(
      ...[...BODY_TABS, 'Fun'].map((t) =>
        h(
          'button',
          {
            role: 'tab',
            class: t === tab ? 'on' : '',
            onclick: () => ((tab = t), view.focus(HEAD_TABS.includes(t)), draw()),
          },
          t,
        ),
      ),
    )
    panel.replaceChildren(
      ...(tab === 'Fun'
        ? [fun()]
        : BODY_FIELDS.filter((f) => f.tab === tab).map((f) =>
            control(f, body[f.key], (v) => set(f.key, v)),
          )),
    )
    buttons()
  }
  save.onclick = () => (store(), toast('Body saved. That is you on every ride now.', 'good'))
  const helmet = h('input', {
    type: 'checkbox',
    checked: true,
    onchange: () => ((bare = !helmet.checked), view.refresh()),
  })
  view.refresh()
  draw()
  return h(
    'div',
    { class: 'bc' },
    h(
      'div',
      { class: 'bc-stage panel' },
      view.canvas,
      h('p', { class: 'dim bc-hint' }, 'Drag to turn. Pinch or scroll to zoom.'),
      h(
        'label',
        { class: 'bc-tick' },
        helmet,
        ' Helmet on (riders always wear one, or a Garage hat)',
      ),
    ),
    h(
      'div',
      { class: 'bc-side panel' },
      tabs,
      panel,
      h(
        'div',
        { class: 'row bc-actions' },
        undo,
        h('button', { onclick: () => apply(defaultBody(p.id)) }, 'Reset'),
        h('button', { onclick: () => apply(randomBody()) }, '🎲'),
        save,
      ),
    ),
  )
}

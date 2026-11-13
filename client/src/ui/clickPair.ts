import { BleClick, clickSource, onClickChange, setClick } from '../trainer/zwiftClick'
import { h } from './dom'
import { toast } from './toast'

async function connectClick() {
  if (!navigator.bluetooth) return toast('Web Bluetooth needs Chrome or Edge over HTTPS.', 'bad')
  try {
    const c = new BleClick()
    await c.connect()
    setClick(c)
  } catch (e) {
    const msg = (e as Error).message
    if (!/cancel/i.test(msg)) toast(`Could not connect the Click: ${msg}`, 'bad')
  }
}

/** Optional Zwift Click section of the trainer modal, with a status readout. */
export function clickSection() {
  const sec = h('section', { class: 'hr-sec' })
  const draw = () => {
    if (sec.dataset.drawn && !sec.isConnected) return void off()
    sec.dataset.drawn = '1'
    const c = clickSource()
    const ok = c?.status === 'connected'
    sec.replaceChildren(
      h('h3', {}, 'Zwift Click (optional)'),
      c
        ? h(
            'div',
            { class: 'readout' },
            h('i', { class: `dot${ok ? ' on' : ''}` }),
            h('b', {}, c.name),
            h('span', { class: 'num' }, ok ? 'connected' : 'reconnecting…'),
          )
        : h(
            'p',
            {},
            'Pair a Zwift Click to shift virtual gears in free ride and Slope mode, change intensity in ERG mode and step the level in Resistance mode. Press a button on the Click so it shows up.',
          ),
      h(
        'div',
        { class: 'row' },
        c
          ? h('button', { onclick: () => setClick(null) }, 'Disconnect')
          : h('button', { onclick: () => void connectClick() }, 'Connect Click'),
      ),
    )
  }
  const off = onClickChange(draw)
  draw()
  return sec
}

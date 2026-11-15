import { CFG } from '../config'
import { type ChartLines, toggleLine } from '../core/chartLines'
import { h } from './dom'

const buttons: [HTMLElement, keyof ChartLines][] = []

/** A button that turns one chart line on or off; every button for that line (menu, legend) follows. */
export function lineButton(l: ChartLines, k: keyof ChartLines, ...label: (Node | string)[]) {
  const b = h(
    'button',
    {
      onclick: () => {
        const on = toggleLine(l, k)
        // Buttons from rides gone by are off the page: forget them.
        for (let i = buttons.length; i--;)
          if (!buttons[i][0].isConnected) buttons.splice(i, 1)
          else if (buttons[i][1] === k) buttons[i][0].classList.toggle('on', on)
      },
    },
    ...label,
  )
  b.classList.toggle('on', l[k])
  buttons.push([b, k])
  return b
}

const swatch = (c: string) => h('i', { style: `background:${c}` })

/** The close-up chart's legend: power, and cadence and heart rate that tap on and off. */
export function chartLegend(l: ChartLines) {
  const C = CFG.chartLines
  const hr = lineButton(l, 'hr', swatch(C.hrColour), 'Heart rate')
  return {
    el: h(
      'div',
      { class: 'wlegend', onclick: (e: Event) => e.stopPropagation() },
      h('span', {}, swatch('#fff'), 'Power'),
      lineButton(l, 'cadence', swatch(C.cadColour), 'Cadence'),
      hr,
    ),
    /** Heart rate shows only with a strap paired. */
    strap: (on: boolean) => (hr.hidden = !on),
  }
}

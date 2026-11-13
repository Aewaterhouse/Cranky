import { saveMyPlan } from '../content'
import {
  buildPlan,
  clampBlock,
  duplicate,
  KINDS,
  move,
  newBlock,
  remove,
  stats,
  validate,
} from '../core/builder'
import type { BuilderBlock, Plan } from '../types'
import { fmt, h } from './dom'
import { planGraph } from './planGraph'
import { toast } from './toast'

const LABEL: Record<BuilderBlock['kind'], string> = {
  steady: 'Steady',
  ramp: 'Ramp',
  intervals: 'Intervals',
  sprint: 'Sprint',
  free: 'Free ride',
}

/** Full-screen workout editor. Saves to My workouts and calls `onSave` with the plan. */
export function openBuilder(existing: Plan | null, onSave: (p: Plan) => void) {
  let name = existing?.name ?? ''
  let list: BuilderBlock[] = existing?.edit ? structuredClone(existing.edit) : []
  let dragFrom = -1
  const id = existing?.id
  const nameIn = h('input', {
    class: 'bld-name',
    placeholder: 'Workout name',
    value: name,
    maxLength: 60,
  })
  nameIn.addEventListener('input', () => (name = nameIn.value))
  const rows = h('div', { class: 'bld-rows' })
  const preview = h('div', { class: 'bld-preview' })
  const summary = h('div', { class: 'bld-sum' })
  const root = h('div', { class: 'bld', role: 'dialog', 'aria-label': 'Workout builder' })

  const num = (
    label: string,
    get: () => number,
    set: (n: number) => void,
    unit: string,
    step = 1,
  ) => {
    const i = h('input', { type: 'number', value: get(), step, min: 0 })
    i.addEventListener('change', () => {
      set(+i.value)
      list = list.map(clampBlock)
      render()
    })
    return h('label', {}, label, i, h('small', {}, unit))
  }
  const fields = (b: BuilderBlock) => {
    const f: HTMLElement[] = []
    const dur = (l = 'Time', get = () => b.dur, set = (n: number) => (b.dur = n)) =>
      f.push(num(l, get, set, 's', 5))
    if (b.kind === 'intervals') {
      f.push(
        num(
          'Reps',
          () => b.reps!,
          (n) => (b.reps = n),
          'x',
        ),
      )
      dur('On time')
      f.push(
        num(
          'On',
          () => b.pct!,
          (n) => (b.pct = n),
          '% FTP',
          5,
        ),
      )
      dur(
        'Off time',
        () => b.offDur!,
        (n) => (b.offDur = n),
      )
      f.push(
        num(
          'Off',
          () => b.offPct!,
          (n) => (b.offPct = n),
          '% FTP',
          5,
        ),
      )
    } else {
      dur()
      if (b.kind === 'steady' || b.kind === 'ramp')
        f.push(
          num(
            b.kind === 'ramp' ? 'Start' : 'Target',
            () => b.pct!,
            (n) => (b.pct = n),
            '% FTP',
            5,
          ),
        )
      if (b.kind === 'ramp')
        f.push(
          num(
            'End',
            () => b.pct2!,
            (n) => (b.pct2 = n),
            '% FTP',
            5,
          ),
        )
    }
    if (b.kind !== 'sprint' && b.kind !== 'free') {
      const c = h('input', { type: 'checkbox', checked: !!b.cad })
      c.addEventListener('change', () => {
        b.cad = c.checked ? [85, 95] : undefined
        render()
      })
      f.push(h('label', {}, 'Cadence', c))
      if (b.cad) {
        f.push(
          num(
            'Low',
            () => b.cad![0],
            (n) => (b.cad![0] = n),
            'rpm',
          ),
        )
        f.push(
          num(
            'High',
            () => b.cad![1],
            (n) => (b.cad![1] = n),
            'rpm',
          ),
        )
      }
    }
    const cue = h('input', {
      class: 'bld-cue',
      placeholder: 'Coach cue (optional)',
      value: b.cue ?? '',
      maxLength: 80,
    })
    cue.addEventListener('change', () => {
      b.cue = cue.value
      render()
    })
    return [...f, cue]
  }

  const row = (b: BuilderBlock, i: number) => {
    const btn = (t: string, title: string, fn: () => void, off = false) => {
      const x = h('button', { class: 'bld-btn', title, 'aria-label': title, disabled: off }, t)
      x.addEventListener('click', () => {
        fn()
        render()
      })
      return x
    }
    const el = h(
      'div',
      { class: 'bld-row', draggable: true },
      h('span', { class: 'bld-grip', title: 'Drag to reorder' }, '⠿'),
      h('b', {}, `${i + 1}. ${LABEL[b.kind]}`),
      h('div', { class: 'bld-fields' }, ...fields(b)),
      h(
        'div',
        { class: 'bld-acts' },
        btn('↑', 'Move up', () => (list = move(list, i, i - 1)), i === 0),
        btn('↓', 'Move down', () => (list = move(list, i, i + 1)), i === list.length - 1),
        btn('⧉', 'Duplicate', () => (list = duplicate(list, i))),
        btn('✕', 'Delete', () => (list = remove(list, i))),
      ),
    )
    el.addEventListener('dragstart', () => (dragFrom = i))
    el.addEventListener('dragover', (e) => {
      e.preventDefault()
      el.classList.add('over')
    })
    el.addEventListener('dragleave', () => el.classList.remove('over'))
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      list = move(list, dragFrom, i)
      render()
    })
    el.addEventListener('dragend', () => (dragFrom = -1))
    return el
  }

  const render = () => {
    rows.replaceChildren(...list.map(row))
    preview.replaceChildren(
      list.length
        ? planGraph(buildPlan('x', list).blocks)
        : h('p', { class: 'bld-empty' }, 'Add a block to start'),
    )
    const s = stats(list)
    summary.textContent = list.length
      ? `${fmt(s.total)} total · IF ${s.intensity.toFixed(2)} · TSS ${Math.round(s.tss)}`
      : ''
  }

  const save = () => {
    const err = validate(name, list)
    if (err) return toast(err, 'bad')
    const plan = buildPlan(name, list, id)
    saveMyPlan(plan)
    root.remove()
    onSave(plan)
    toast(`Saved ${plan.name}`, 'good')
  }
  root.append(
    h(
      'div',
      { class: 'bld-head' },
      h('h2', {}, existing ? 'Edit workout' : 'Build a workout'),
      nameIn,
    ),
    preview,
    summary,
    rows,
    h(
      'div',
      { class: 'bld-add' },
      ...KINDS.map((k) => {
        const x = h('button', { class: 'bld-btn' }, `+ ${LABEL[k]}`)
        x.addEventListener('click', () => {
          list = [...list, newBlock(k)]
          render()
        })
        return x
      }),
    ),
    h(
      'div',
      { class: 'bld-foot' },
      h('button', { class: 'bld-btn', onclick: () => root.remove() }, 'Cancel'),
      h('button', { class: 'bld-btn go', onclick: save }, 'Save workout'),
    ),
  )
  render()
  document.body.append(root)
  nameIn.focus()
}

import { CFG } from '../config'
import type { Block, Plan } from '../types'
import { parsePlan } from './plan'

const pct = (f: number) => Math.round(Math.min(CFG.erg.capPct, Math.max(0, f)) * 100)
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workout'

/** Zwift .zwo: XML elements with power as a fraction of FTP. */
function fromZwo(text: string): { name?: string; desc?: string; blocks: Block[] } {
  const tag = (t: string) => text.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i'))?.[1].trim()
  const body = text.match(/<workout>([\s\S]*?)<\/workout>/i)?.[1] ?? ''
  const blocks: Block[] = []
  for (const m of body.matchAll(/<(\w+)\b([^>]*?)\/?>/g)) {
    const a: Record<string, number> = {}
    for (const kv of m[2].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) a[kv[1].toLowerCase()] = +kv[2]
    const dur = Math.round(a.duration)
    const steady = (d: number, f: number, label?: string): Block => ({
      type: 'steady',
      dur: Math.round(d),
      pct: pct(f),
      label,
    })
    switch (m[1].toLowerCase()) {
      case 'warmup':
        blocks.push({
          type: 'ramp',
          dur,
          pct: [pct(a.powerlow), pct(a.powerhigh)],
          label: 'Warm-up',
        })
        break
      case 'cooldown':
        blocks.push({
          type: 'ramp',
          dur,
          pct: [pct(a.powerlow), pct(a.powerhigh)],
          label: 'Cool-down',
        })
        break
      case 'ramp':
        blocks.push({ type: 'ramp', dur, pct: [pct(a.powerlow), pct(a.powerhigh)], label: 'Ramp' })
        break
      case 'steadystate':
        blocks.push(steady(dur, a.power))
        break
      case 'intervalst':
        blocks.push({
          type: 'set',
          dur: 0,
          rep: a.repeat || 1,
          blocks: [steady(a.onduration, a.onpower, 'On'), steady(a.offduration, a.offpower, 'Off')],
        })
        break
      case 'freeride':
        blocks.push({ type: 'free', dur, label: 'Free ride' })
        break
      case 'maxeffort':
        blocks.push(
          dur >= CFG.sprintDur.min && dur <= CFG.sprintDur.max
            ? { type: 'sprint', dur, label: 'Sprint' }
            : steady(dur, CFG.erg.capPct, 'Max effort'),
        )
        break
    }
  }
  return { name: tag('name'), desc: tag('description'), blocks }
}

/** .erg (watts) and .mrc (% FTP): "minutes value" points; equal neighbours are steady, otherwise a ramp. */
function fromErg(text: string, ftp: number): { name?: string; desc?: string; blocks: Block[] } {
  const head = (k: string) => text.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)$`, 'im'))?.[1].trim()
  const watts = /MINUTES\s+WATTS/i.test(text)
  const base = watts ? +(head('FTP') ?? ftp) || ftp : 100
  const data = text.match(/\[COURSE DATA\]([\s\S]*?)\[END COURSE DATA\]/i)?.[1] ?? ''
  const pts = [...data.matchAll(/^\s*([\d.]+)\s+([\d.]+)\s*$/gm)].map(
    (m) => [+m[1] * 60, +m[2] / base] as const,
  )
  const blocks: Block[] = []
  for (let i = 1; i < pts.length; i++) {
    const [[t0, a], [t1, b]] = [pts[i - 1], pts[i]]
    const dur = Math.round(t1 - t0)
    if (dur <= 0) continue
    blocks.push(
      Math.abs(a - b) < 0.005
        ? { type: 'steady', dur, pct: pct(a) }
        : { type: 'ramp', dur, pct: [pct(a), pct(b)] },
    )
  }
  return { name: head('DESCRIPTION') ?? head('FILE NAME'), blocks }
}

/** Parses a .zwo, .erg or .mrc file into a Plan. Throws with a readable message if it can't. */
export function importWorkout(fileName: string, text: string, ftp: number): Plan {
  const r = /<workout_file/i.test(text)
    ? fromZwo(text)
    : /\[COURSE DATA\]/i.test(text)
      ? fromErg(text, ftp)
      : null
  if (!r) throw new Error('Not a .zwo, .erg or .mrc workout file')
  if (!r.blocks.length) throw new Error('No intervals found in that file')
  const name = (r.name || fileName.replace(/\.\w+$/, '')).slice(0, 60)
  const plan: Plan = {
    id: `my-${slug(name)}`,
    name,
    desc: (r.desc ?? 'Imported workout').replace(/\s+/g, ' ').slice(0, 140),
    blocks: r.blocks,
  }
  parsePlan(plan)
  return plan
}

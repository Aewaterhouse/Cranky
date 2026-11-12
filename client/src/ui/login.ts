import { login, riders, type Me } from '../core/api'
import { avatar, h, show } from './dom'

const LAST = 'zombiebus.lastRider'

export const logo = (big = false) =>
  h(
    'div',
    { class: `logo${big ? ' big' : ''}` },
    h('span', { class: 'bus' }, '🚌'),
    h('span', {}, 'Zombie', h('em', {}, 'Bus')),
  )

/** Pick your rider tile, then type the password. */
export async function showLogin(enter: (u: Me) => void) {
  const list = await riders().catch(() => [] as Me[])
  let pick = list.find((r) => r.id === localStorage.getItem(LAST)) ?? null
  const pw = h('input', {
    type: 'password',
    placeholder: 'Password',
    autocomplete: 'current-password',
  })
  const err = h('p', { class: 'err', role: 'alert' })
  const who = h('span')
  const form = h(
    'form',
    { class: 'pw', onsubmit: (e) => go(e) },
    h('label', {}, who, pw),
    h('button', { class: 'primary' }, 'Get on the bus'),
    err,
  )
  const tiles = list.map((r) =>
    h(
      'button',
      { class: 'tile', type: 'button', onclick: () => select(r) },
      avatar(r.name, 'xl'),
      h('b', {}, r.name),
    ),
  )
  const select = (r: Me) => {
    pick = r
    tiles.forEach((t, i) => t.classList.toggle('on', list[i] === r))
    who.textContent = `Password for ${r.name}`
    err.textContent = ''
    form.hidden = false
    pw.value = ''
    pw.focus()
  }
  const go = async (e: Event) => {
    e.preventDefault()
    if (!pick) return
    try {
      const u = await login(pick.id, pw.value)
      localStorage.setItem(LAST, pick.id)
      enter(u)
    } catch (x) {
      err.textContent = (x as Error).message
      pw.select()
    }
  }
  form.hidden = true
  show(
    h(
      'main',
      { class: 'login' },
      logo(true),
      h('p', { class: 'tag' }, 'Pedal together. Outrun the horde.'),
      h('h2', {}, 'Who’s riding?'),
      list.length
        ? h('div', { class: 'tiles' }, ...tiles)
        : h('p', { class: 'err' }, 'Can’t reach the server. Is it running?'),
      form,
    ),
  )
  if (pick) select(pick)
}

import { login, type Me } from '../core/api'
import { h, show } from './dom'

const LAST = 'zombiebus.lastRider'

export const logo = (big = false) =>
  h(
    'div',
    { class: `logo${big ? ' big' : ''}` },
    h('img', { class: 'mark', src: '/icon.svg', alt: '' }),
    h('span', {}, 'Crank', h('em', {}, 'y')),
  )

/** A password box with a Show/Hide button. */
export function secret(placeholder: string, autocomplete: string) {
  const input = h('input', { type: 'password', placeholder, autocomplete })
  input.setAttribute('aria-label', placeholder)
  const flip = h(
    'button',
    {
      type: 'button',
      class: 'ghost pw-eye',
      onclick: () => {
        const hidden = input.type === 'password'
        input.type = hidden ? 'text' : 'password'
        flip.textContent = hidden ? 'Hide' : 'Show'
        input.focus()
      },
    },
    'Show',
  )
  return { input, box: h('div', { class: 'pw-box' }, input, flip) }
}

/** Username and password. Lists nobody: a visitor sees no names or faces. */
export function showLogin(enter: (u: Me) => void) {
  const user = h('input', {
    placeholder: 'Username',
    autocomplete: 'username',
    autocapitalize: 'off',
    spellcheck: false,
    value: localStorage.getItem(LAST) ?? '',
  })
  user.setAttribute('aria-label', 'Username')
  const pw = secret('Password', 'current-password')
  const err = h('p', { class: 'err', role: 'alert' })
  const go = async (e: Event) => {
    e.preventDefault()
    if (!user.value.trim() || !pw.input.value)
      return (err.textContent = 'Type your username and password.')
    try {
      const u = await login(user.value.trim(), pw.input.value)
      localStorage.setItem(LAST, user.value.trim())
      enter(u)
    } catch (x) {
      err.textContent = (x as Error).message
      pw.input.select()
    }
  }
  show(
    h(
      'main',
      { class: 'login' },
      logo(true),
      h('p', { class: 'tag' }, 'Pedal together. Outrun the horde.'),
      h(
        'form',
        { class: 'pw pw-set', onsubmit: go },
        user,
        pw.box,
        h('button', { class: 'primary' }, 'Log in'),
        err,
      ),
      h('p', { class: 'dim' }, 'First time? Your username and password are both your name.'),
    ),
  )
  ;(user.value ? pw.input : user).focus()
}

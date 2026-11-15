import { CFG } from '../config'
import { api, type Me } from '../core/api'
import { h, show } from './dom'
import { logo, secret } from './login'
import { modal, toast } from './toast'

/** Why a new password won't do, or '' when it will (the server checks the same). */
export function passwordProblem(pw: string, again: string, id: string) {
  if (pw.length < CFG.account.passwordMin) return `At least ${CFG.account.passwordMin} characters.`
  if (pw.trim().toLowerCase() === id) return 'Not your name: that’s the one everyone knows.'
  if (pw !== again) return 'The two don’t match.'
  return ''
}

/** Why a username won't do, or '' (the server checks the same, and for clashes). */
export const usernameProblem = (name: string) =>
  CFG.account.username.test(name.trim())
    ? ''
    : '3 to 24 characters: letters, numbers, spaces, - and _.'

/** Dialog to change what a rider logs in with (their own, or any rider's for an admin). */
export function changeUsername(id: string, current: string, done: (name: string) => void) {
  const input = h('input', { value: current, autocomplete: 'username', autocapitalize: 'off' })
  input.setAttribute('aria-label', 'New username')
  const err = h('p', { class: 'err', role: 'alert' })
  const form = h(
    'form',
    {
      class: 'pw pw-set',
      onsubmit: (e) => {
        e.preventDefault()
        const name = input.value.trim()
        err.textContent = usernameProblem(name)
        if (err.textContent) return
        api<{ username: string }>(`/api/riders/${id}/username`, {
          method: 'POST',
          body: JSON.stringify({ username: name }),
        }).then(
          (r) => (close(), toast(`Username is now ${r.username}.`, 'good'), done(r.username)),
          (x: Error) => (err.textContent = x.message),
        )
      },
    },
    h('p', { class: 'dim' }, 'Used to log in, in any case. Your name on rides stays the same.'),
    input,
    h('button', { class: 'primary' }, 'Save username'),
    err,
  )
  const close = modal('Change username', form)
  input.select()
}

/** New password typed twice (and the current one when changing it); `done` runs once the server takes it. */
function passwordForm(id: string, current: boolean, button: string, done: () => void) {
  const now = secret('Current password', 'current-password')
  const pw = secret(`New password (${CFG.account.passwordMin}+ characters)`, 'new-password')
  const again = secret('New password again', 'new-password')
  const err = h('p', { class: 'err', role: 'alert' })
  const form = h(
    'form',
    {
      class: 'pw pw-set',
      onsubmit: (e) => {
        e.preventDefault()
        err.textContent = passwordProblem(pw.input.value, again.input.value, id)
        if (err.textContent) return
        const body = { password: pw.input.value, ...(current ? { current: now.input.value } : {}) }
        api(`/api/riders/${id}/password`, { method: 'POST', body: JSON.stringify(body) }).then(
          done,
          (x: Error) => (err.textContent = x.message),
        )
      },
    },
    current ? now.box : '',
    pw.box,
    again.box,
    h('button', { class: 'primary' }, button),
    err,
  )
  return { form, first: current ? now.input : pw.input }
}

/** First login on the default password (their name): nothing else until they set their own. */
export function setPasswordScreen(u: Me, next: () => void) {
  const { form, first } = passwordForm(u.id, false, 'Save and ride', next)
  show(
    h(
      'main',
      { class: 'login' },
      logo(true),
      h('p', { class: 'tag' }, `G’day ${u.name}. One thing before you ride.`),
      h('h2', {}, 'Set your password'),
      h(
        'p',
        { class: 'dim' },
        'Yours is still your name, which the whole crew knows. Pick your own.',
      ),
      form,
    ),
  )
  first.focus()
}

/** Dialog for a rider to change their own password. */
export function changeMyPassword(id: string) {
  const { form, first } = passwordForm(id, true, 'Change password', () => {
    close()
    toast('Password changed.', 'good')
  })
  const close = modal('Change my password', form)
  first.focus()
}

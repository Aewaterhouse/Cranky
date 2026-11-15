import { CFG } from '../config'
import { api, type Me } from '../core/api'
import { h, show } from './dom'
import { logo } from './login'
import { modal, toast } from './toast'

/** Why a new password won't do, or '' when it will (the server checks the same). */
export function passwordProblem(pw: string, again: string, id: string) {
  if (pw.length < CFG.account.passwordMin) return `At least ${CFG.account.passwordMin} characters.`
  if (pw.trim().toLowerCase() === id) return 'Not your name: that’s the one everyone knows.'
  if (pw !== again) return 'The two don’t match.'
  return ''
}

/** New password typed twice (and the current one when changing it); `done` runs once the server takes it. */
function passwordForm(id: string, current: boolean, button: string, done: () => void) {
  const field = (placeholder: string, autocomplete: string) =>
    h('input', { type: 'password', placeholder, autocomplete })
  const now = field('Current password', 'current-password')
  const pw = field(`New password (${CFG.account.passwordMin}+ characters)`, 'new-password')
  const again = field('New password again', 'new-password')
  const err = h('p', { class: 'err', role: 'alert' })
  const form = h(
    'form',
    {
      class: 'pw pw-set',
      onsubmit: (e) => {
        e.preventDefault()
        err.textContent = passwordProblem(pw.value, again.value, id)
        if (err.textContent) return
        const body = { password: pw.value, ...(current ? { current: now.value } : {}) }
        api(`/api/riders/${id}/password`, { method: 'POST', body: JSON.stringify(body) }).then(
          done,
          (x: Error) => (err.textContent = x.message),
        )
      },
    },
    current ? now : '',
    pw,
    again,
    h('button', { class: 'primary' }, button),
    err,
  )
  return { form, first: current ? now : pw }
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

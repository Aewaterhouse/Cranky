import '../admin.css'
import { api, riders, type Me } from '../core/api'
import { avatar, h } from './dom'
import { modal, toast } from './toast'

const post = (path: string, body: object, method = 'POST') =>
  api(path, { method, body: JSON.stringify(body) })
const fail = (e: unknown) => toast((e as Error).message, 'bad')

/** Small dialog asking for a new password; calls `done(password)` on submit. */
function askPassword(title: string, done: (pw: string) => Promise<void>) {
  const pw = h('input', {
    type: 'password',
    placeholder: 'New password',
    autocomplete: 'new-password',
  })
  const form = h(
    'form',
    {
      class: 'adm-form',
      onsubmit: (e) => {
        e.preventDefault()
        if (!pw.value.trim()) return toast('Type a password first.', 'bad')
        done(pw.value).then(close, fail)
      },
    },
    pw,
    h('button', { class: 'primary' }, 'Save'),
  )
  const close = modal(title, form)
  pw.focus()
}

/** Dialog for any rider to change their own password. */
export const changeMyPassword = (id: string) =>
  askPassword('Change my password', async (pw) => {
    await post(`/api/riders/${id}/password`, { password: pw })
    toast('Password changed.', 'good')
  })

const confirmBox = (title: string, text: string, label: string, go: () => Promise<void>) => {
  const close = modal(
    title,
    h('p', {}, text),
    h(
      'div',
      { class: 'adm-form' },
      h('button', { class: 'ghost', onclick: () => close() }, 'Cancel'),
      h('button', { class: 'primary danger', onclick: () => go().then(close, fail) }, label),
    ),
  )
}

/** Admin screen: list riders, add one, reset a password, remove one. */
export function adminTab(self: string) {
  const list = h('ul', { class: 'adm-list' })
  const load = () =>
    riders().then((rs: Me[]) =>
      list.replaceChildren(
        ...rs.map((r) =>
          h(
            'li',
            {},
            avatar(r.name),
            h('b', {}, r.name),
            r.id === self ? h('span', { class: 'dim' }, 'you') : '',
            h('span', { class: 'grow' }),
            h(
              'button',
              {
                class: 'ghost',
                onclick: () =>
                  askPassword(`Reset password for ${r.name}`, async (pw) => {
                    await post(`/api/riders/${r.id}/password`, { password: pw })
                    toast(`${r.name}'s password is reset.`, 'good')
                  }),
              },
              'Reset password',
            ),
            h(
              'button',
              {
                class: 'ghost danger',
                disabled: r.id === self,
                onclick: () =>
                  confirmBox(
                    `Remove ${r.name}?`,
                    'They can no longer log in. Their profile and rides are kept.',
                    'Remove',
                    async () => {
                      await post(`/api/riders/${r.id}`, {}, 'DELETE')
                      toast(`${r.name} removed.`, 'good')
                      await load()
                    },
                  ),
              },
              'Remove',
            ),
          ),
        ),
      ),
    )
  const name = h('input', { placeholder: 'Name', maxlength: 20, autocomplete: 'off' })
  const form = h(
    'form',
    {
      class: 'adm-form',
      onsubmit: (e) => {
        e.preventDefault()
        const n = name.value.trim()
        if (!n) return toast('Type a name first.', 'bad')
        post('/api/riders', { name: n })
          .then(() => {
            toast(`${n} added. Their password is their name.`, 'good')
            name.value = ''
            return load()
          })
          .catch(fail)
      },
    },
    name,
    h('button', { class: 'primary' }, 'Add rider'),
  )
  load().catch(fail)
  return h(
    'div',
    { class: 'adm' },
    h('h1', {}, 'Riders'),
    h('section', { class: 'panel' }, h('h2', {}, 'Add a rider'), form),
    h('section', { class: 'panel' }, h('h2', {}, 'Crew'), list),
  )
}

import '../admin.css'
import { api, riders, type Me } from '../core/api'
import { avatar, h } from './dom'
import { changeUsername } from './password'
import { modal, toast } from './toast'

const post = (path: string, body: object, method = 'POST') =>
  api(path, { method, body: JSON.stringify(body) })
const fail = (e: unknown) => toast((e as Error).message, 'bad')

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
            h('span', { class: 'dim' }, `@${r.username ?? r.id}${r.id === self ? ' · you' : ''}`),
            h('span', { class: 'grow' }),
            h(
              'button',
              {
                class: 'ghost',
                onclick: () => changeUsername(r.id, r.username ?? '', () => load()),
              },
              'Username',
            ),
            h(
              'button',
              {
                class: 'ghost',
                disabled: r.id === self,
                onclick: () =>
                  confirmBox(
                    `Reset ${r.name}'s password?`,
                    `It goes back to their name. They pick a new one when they next log in.`,
                    'Reset',
                    async () => {
                      await post(`/api/riders/${r.id}/reset`, {})
                      toast(`${r.name}'s password is their name again.`, 'good')
                    },
                  ),
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
            toast(`${n} added. They log in with their name, then pick a password.`, 'good')
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

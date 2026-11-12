import './style.css'
import { login, me, riders, type Me } from './core/api'
import type { Profile } from './core/curve'
import { loadProfile, syncProfile } from './core/profile'
import { runDrill } from './modes/drill/drill'
import { crew } from './modes/zombieBus/crew'
import { h, show } from './ui/dom'
import { currentTrainer, showHome } from './ui/home'

let profile: Profile

function home(p: Profile = profile) {
  profile = p
  showHome(profile, {
    drill: (plan) => runDrill(plan, profile, currentTrainer()!, home),
    create: () => crew(null, profile, currentTrainer()!, home),
    join: (code) => crew(code, profile, currentTrainer()!, home),
  })
}

async function enter(u: Me) {
  profile = loadProfile(u)
  home()
  const p = await syncProfile(profile)
  if (p !== profile) home(p)
}

async function loginScreen() {
  const list = await riders().catch(() => [] as Me[])
  const name = h('select', {}, ...list.map((r) => h('option', { value: r.id }, r.name)))
  const pw = h('input', { type: 'password', placeholder: 'Password' })
  const err = h('p', { class: 'dim' })
  const go = async (e: Event) => {
    e.preventDefault()
    try {
      await enter(await login(name.value, pw.value))
    } catch (x) {
      err.textContent = (x as Error).message
    }
  }
  show(h('div', { class: 'page' }, h('h1', {}, '🧟 Zombie Bus'), h('form', { class: 'card row', onsubmit: go }, name, pw, h('button', { class: 'primary' }, 'Log in')), err))
}

addEventListener('keydown', (e) => e.key === '`' && import('./scene/world').then((m) => m.debugPanel()))

me().then(enter, loginScreen)

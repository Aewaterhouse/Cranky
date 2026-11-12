import '@fontsource/bungee/latin-400.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-800.css'
import './style.css'
import './ui.css'
import './screens.css'
import { logout, me, type Me } from './core/api'
import type { Profile } from './core/curve'
import { loadProfile, syncProfile } from './core/profile'
import { runDrill } from './modes/drill/drill'
import { crew } from './modes/zombieBus/crew'
import { showLogin } from './ui/login'
import { showHome } from './ui/shell'
import { currentTrainer } from './ui/trainer'

let profile: Profile

function home(p: Profile = profile) {
  profile = p
  showHome(profile, {
    drill: (plan) => runDrill(plan, profile, currentTrainer()!, home),
    create: () => crew(null, profile, currentTrainer()!, home),
    join: (code) => crew(code, profile, currentTrainer()!, home),
    logout: () => {
      logout()
      showLogin(enter)
    },
  })
}

async function enter(u: Me) {
  profile = loadProfile(u)
  home()
  const p = await syncProfile(profile)
  if (p !== profile) home(p)
}

addEventListener(
  'keydown',
  (e) => e.key === '`' && import('./scene/world').then((m) => m.debugPanel()),
)

me().then(enter, () => showLogin(enter))

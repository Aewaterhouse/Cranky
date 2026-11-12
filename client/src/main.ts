import './style.css'
import type { Profile } from './core/curve'
import { loadProfile, syncProfile } from './core/profile'
import { runDrill } from './modes/drill/drill'
import { crew } from './modes/zombieBus/crew'
import { currentTrainer, showHome } from './ui/home'

let profile: Profile = loadProfile()

function home(p: Profile = profile) {
  profile = p
  showHome(profile, {
    drill: (plan) => runDrill(plan, profile, currentTrainer()!, home),
    create: () => crew(null, profile, currentTrainer()!, home),
    join: (code) => crew(code, profile, currentTrainer()!, home),
  })
}

home()
syncProfile(profile).then((p) => p !== profile && home(p))

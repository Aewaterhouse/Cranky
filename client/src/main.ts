import '@fontsource/bungee/latin-400.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-800.css'
import './style.css'
import { maybeWelcome } from './ui/onboarding'
import { applySettings } from './core/settings'
import './ui.css'
import './screens.css'
import './setup.css'
import './builder.css'
import './plans.css'
import './touch.css'
import { logout, me, type Me } from './core/api'
import type { Profile } from './core/curve'
import type { RideSummary } from './core/ride'
import { flushEfforts } from './core/efforts'
import { flushRides, onRideSaved } from './core/rideQueue'
import { loadProfile, syncProfile } from './core/profile'
import { runDrill } from './modes/drill/drill'
import { keepAwake as stayAwake } from './ui/wakeLock'
import { lockZoom } from './ui/noZoom'
import { diagOverlay } from './ui/diag'
import { runFreeRide } from './modes/freeRide/freeRide'
import { groupRide } from './modes/freeRide/group'
import { crew } from './modes/zombieBus/crew'
import { spectate } from './modes/zombieBus/spectate'
import { showLogin } from './ui/login'
import { showHome } from './ui/shell'
import { currentTrainer } from './ui/trainer'
import { openRiderSettings } from './ui/rider'
import { autoStrava, stravaReturn } from './ui/strava'

let profile: Profile
/** A ride (or its lobby) keeps the screen on and stops the page zooming. */
const keepAwake = (on: boolean) => (stayAwake(on), lockZoom(on))

function home(p: Profile = profile) {
  keepAwake(false)
  profile = p
  showHome(profile, {
    drill: (plan) => (keepAwake(true), runDrill(plan, profile, currentTrainer()!, home)),
    freeRide: (r, ghosts) => (
      keepAwake(true),
      runFreeRide(r, profile, currentTrainer()!, home, undefined, ghosts)
    ),
    groupRide: (route, laps) => (
      keepAwake(true),
      groupRide(null, { route, laps }, profile, currentTrainer()!, home)
    ),
    resume: (s) => (keepAwake(true), runDrill(s.plan, profile, currentTrainer()!, home, s)),
    create: (game) => (keepAwake(true), crew(null, profile, currentTrainer()!, home, game)),
    join: (code) => (keepAwake(true), crew(code, profile, currentTrainer()!, home)),
    watch: (code) => (lockZoom(true), spectate(code, () => home())),
    logout: () => {
      logout()
      showLogin(enter)
    },
  })
}

async function enter(u: Me) {
  profile = loadProfile(u)
  const watch = new URLSearchParams(location.search).get('watch')?.trim().toUpperCase()
  if (watch?.length === 4) return (lockZoom(true), spectate(watch, () => home()))
  if (stravaReturn()) openRiderSettings()
  onRideSaved<RideSummary>((s, n) => autoStrava(profile, s, n))
  home()
  // Anything ridden while the server was out of reach goes up now, and again whenever the network returns.
  const sync = () => (void flushEfforts(u.id), void flushRides(u.id))
  sync()
  addEventListener('online', sync)
  const p = await syncProfile(profile)
  if (p !== profile) home(p)
  maybeWelcome(profile, () => home())
}

addEventListener(
  'keydown',
  (e) => e.key === '`' && import('./scene/world').then((m) => m.debugPanel()),
)

applySettings()
diagOverlay()
me().then(enter, () => showLogin(enter))

if (import.meta.env.PROD && 'serviceWorker' in navigator)
  navigator.serviceWorker.register('/sw.js').catch(() => {})

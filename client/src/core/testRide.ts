import type { Trainer } from '../types'

let simOn = false

/** The app's trainer changed (the trainer modal says): remembers whether it is the simulated trainer. */
export const noteTrainer = (t: Trainer | null) => void (simOn = !!t?.sim)

/** True while the simulated trainer is the app's trainer. */
export const simConnected = () => simOn

/** The simulator is in use: the ride's own trainer is it, or the app has switched to it. */
export const usesSim = (t?: Trainer | null) => !!t?.sim || simOn

/** The note shown in lobbies and on the ride HUD while the simulator is connected. */
export const SIM_NOTE = "Simulator: this ride won't count"

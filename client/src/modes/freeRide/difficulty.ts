import { CFG } from '../../config'

const KEY = 'cranky.trainerDifficulty'

/** The trainer difficulty (0..1) this device used last, or the default. */
export function loadDifficulty() {
  try {
    const v = parseFloat(localStorage.getItem(KEY) ?? '')
    if (v >= 0 && v <= 1) return v
  } catch {
    /* no storage */
  }
  return CFG.freeRide.difficulty
}

export function saveDifficulty(v: number) {
  try {
    localStorage.setItem(KEY, String(v))
  } catch {
    /* no storage */
  }
}

import { describe, expect, it } from 'vitest'
import { sharedPos, syncStep, videoId, type Shared } from '../src/core/watchSync'

const room: Shared = { vid: 'dQw4w9WgXcQ', playing: true, pos: 30, at: 100 }

describe('watch party sync', () => {
  it('works out where the room is', () => {
    expect(sharedPos(room, 110)).toBe(40)
    expect(sharedPos({ ...room, playing: false }, 110)).toBe(30)
  })
  it('loads the room video at the right spot for a late joiner', () => {
    expect(syncStep(room, { vid: null, state: -1, time: 0 }, 160)).toEqual({
      k: 'load',
      vid: room.vid,
      at: 90,
      play: true,
    })
  })
  it('leaves a player alone when it is close, and pulls it back when it drifts', () => {
    expect(syncStep(room, { vid: room.vid, state: 1, time: 39 }, 110)).toBeNull()
    expect(syncStep(room, { vid: room.vid, state: 1, time: 20 }, 110)).toEqual({
      k: 'seek',
      at: 40,
    })
  })
  it('does not fight an ad or a buffer, then catches up after it', () => {
    expect(syncStep(room, { vid: room.vid, state: 3, time: 30 }, 130)).toBeNull()
    expect(syncStep(room, { vid: room.vid, state: -1, time: 30 }, 130)).toBeNull()
    expect(syncStep(room, { vid: room.vid, state: 1, time: 30 }, 130)).toEqual({
      k: 'seek',
      at: 60,
    })
  })
  it('follows the host pausing and playing', () => {
    const paused = { ...room, playing: false }
    expect(syncStep(paused, { vid: room.vid, state: 1, time: 30 }, 110)).toEqual({ k: 'pause' })
    expect(syncStep(paused, { vid: room.vid, state: 2, time: 30.5 }, 110)).toBeNull()
    expect(syncStep(room, { vid: room.vid, state: 2, time: 40 }, 110)).toEqual({ k: 'play' })
  })
  it('stops when the room has no video', () => {
    expect(syncStep({ ...room, vid: null }, { vid: room.vid, state: 1, time: 5 }, 110)).toEqual({
      k: 'pause',
    })
  })
  it('reads video ids from the links people paste', () => {
    const id = 'dQw4w9WgXcQ'
    for (const t of [
      id,
      `https://www.youtube.com/watch?v=${id}&t=3`,
      `https://youtu.be/${id}?si=x`,
      `https://m.youtube.com/shorts/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
    ])
      expect(videoId(t)).toBe(id)
    expect(videoId('https://vimeo.com/123')).toBeNull()
    expect(videoId('not a link')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { embedUrl } from '../src/ui/soloMedia'

describe('media links', () => {
  const yt = 'https://www.youtube-nocookie.com/embed'
  it('embeds YouTube videos, short links and playlists', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=abc123XYZ_-', 'x')).toBe(
      `${yt}/abc123XYZ_-?autoplay=1`,
    )
    expect(embedUrl('https://youtu.be/abc123', 'x')).toBe(`${yt}/abc123?autoplay=1`)
    expect(embedUrl('https://www.youtube.com/watch?v=abc&list=PL1', 'x')).toBe(
      `${yt}/abc?autoplay=1&list=PL1`,
    )
    expect(embedUrl('https://www.youtube.com/playlist?list=PL1', 'x')).toBe(
      `${yt}/videoseries?list=PL1&autoplay=1`,
    )
    expect(embedUrl('https://www.youtube.com/live/abc', 'x')).toBe(`${yt}/abc?autoplay=1`)
  })
  it('embeds Twitch channels and rejects the rest', () => {
    expect(embedUrl('https://www.twitch.tv/gcn', 'cranky.local')).toBe(
      'https://player.twitch.tv/?channel=gcn&parent=cranky.local',
    )
    expect(embedUrl('https://www.netflix.com/watch/1', 'x')).toBeNull()
    expect(embedUrl('not a link', 'x')).toBeNull()
  })
})

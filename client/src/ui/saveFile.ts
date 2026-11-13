import { api } from '../core/api'
import { h } from './dom'
import { modal, toast } from './toast'

/**
 * Saves a file built on this device from a ride. It goes up to the server and comes back as a real link, which
 * iPad browsers like Bluefy can save or share where a blob link does nothing. A mouse and keyboard get the
 * download straight away; a touch screen gets a sheet to tap, since the tap is what lets iOS open it.
 */
export async function saveFile(blob: Blob, name: string) {
  let url: string
  try {
    url = (
      await api<{ url: string }>(`/api/rides/files/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: blob,
        headers: { 'content-type': blob.type || 'application/octet-stream' },
      })
    ).url
  } catch {
    // offline or the server said no: the old in-browser download still works on a desktop
    return h('a', { href: URL.createObjectURL(blob), download: name }).click()
  }
  if (!matchMedia('(pointer: coarse)').matches) return location.assign(url)
  const full = new URL(url, location.href).href
  const copy = h('button', {}, 'Copy link')
  copy.onclick = () =>
    navigator.clipboard
      .writeText(full)
      .then(() => toast('Link copied. Paste it into Safari to save the file.', 'good'))
      .catch(() => (copy.replaceWith(h('code', { class: 'file-link' }, full)), undefined))
  const png = name.endsWith('.png')
  modal(
    'Your file is ready',
    png ? h('img', { class: 'file-preview', src: `${url}?inline=1`, alt: name }) : '',
    h(
      'p',
      {},
      png
        ? 'Tap Save, or press and hold the picture and pick Save to Photos.'
        : 'Tap Save, then Download or Share. If nothing happens, copy the link and open it in Safari.',
    ),
    h(
      'div',
      { class: 'row' },
      h(
        'a',
        { class: 'button primary', href: url, target: '_blank', rel: 'noopener' },
        `Save ${name}`,
      ),
      copy,
    ),
  )
}

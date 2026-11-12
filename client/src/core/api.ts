const TOKEN = 'zombiebus.token'

export const token = () => localStorage.getItem(TOKEN) ?? ''

/** fetch with the login token; throws on non-2xx with the server's message. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token()}`,
      ...init.headers,
    },
  })
  if (!r.ok)
    throw Object.assign(new Error((await r.json().catch(() => ({}))).detail ?? r.statusText), {
      status: r.status,
    })
  return r.json()
}

export interface Me {
  id: string
  name: string
  admin?: boolean
}

export async function login(name: string, password: string): Promise<Me> {
  const r = await api<Me & { token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  })
  localStorage.setItem(TOKEN, r.token)
  return { id: r.id, name: r.name }
}

export const logout = () => localStorage.removeItem(TOKEN)
const ME = 'cranky.me'

/** Who is logged in. Offline, falls back to the last rider seen on this device so solo rides still work. */
export async function me(): Promise<Me> {
  try {
    const m = await api<Me>('/api/me')
    localStorage.setItem(ME, JSON.stringify(m))
    return m
  } catch (e) {
    const cached = localStorage.getItem(ME)
    if ((e as { status?: number }).status === undefined && cached && token())
      return JSON.parse(cached)
    throw e
  }
}
export const riders = () => api<Me[]>('/api/riders')

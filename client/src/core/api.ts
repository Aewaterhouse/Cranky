const TOKEN = 'zombiebus.token'

export const token = () => localStorage.getItem(TOKEN) ?? ''

/** fetch with the login token; throws on non-2xx with the server's message. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}`, ...init.headers },
  })
  if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).detail ?? r.statusText), { status: r.status })
  return r.json()
}

export interface Me { id: string; name: string }

export async function login(name: string, password: string): Promise<Me> {
  const r = await api<Me & { token: string }>('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) })
  localStorage.setItem(TOKEN, r.token)
  return { id: r.id, name: r.name }
}

export const logout = () => localStorage.removeItem(TOKEN)
export const me = () => api<Me>('/api/me')
export const riders = () => api<Me[]>('/api/riders')

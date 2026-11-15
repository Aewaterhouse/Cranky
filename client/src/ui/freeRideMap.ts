import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { routeAt, type Route } from '../core/route'
import { rideMarks } from '../core/segWarn'
import { VIS } from '../scene/params'

/** Leaflet map with the route line and a moving rider dot. Throws when there is nothing to show. */
export function routeMap(box: HTMLElement, route: Route) {
  const line: L.LatLngTuple[] = route.points
    .filter((p) => p.lat !== undefined)
    .map((p) => [p.lat!, p.lon!])
  if (line.length < 2) throw new Error('no coordinates')
  const map = L.map(box, { zoomControl: false, attributionControl: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors',
  }).addTo(map)
  const whole = L.polyline(line, { color: '#9c998f', weight: 5, opacity: 0.9 }).addTo(map)
  const done = L.polyline([], { color: '#f2b705', weight: 5 }).addTo(map)
  // Sprints green, KOMs red dots on white, each with its start marked (one lap's worth on a lap ride).
  const W = VIS.route.warn
  const lapM = (route.lapOf ?? route).distance
  for (const m of rideMarks(route).filter((m) => m.start < lapM)) {
    const part = route.points
      .filter((p) => p.lat !== undefined && p.d >= m.start && p.d <= m.end)
      .map((p): L.LatLngTuple => [p.lat!, p.lon!])
    if (part.length < 2) continue
    const kom = m.kind === 'climb'
    L.polyline(part, { color: kom ? W.dot : W.sprint, weight: 7, opacity: 0.95 }).addTo(map)
    if (kom)
      L.polyline(part, { color: W.kom, weight: 6, dashArray: '1 9', lineCap: 'round' }).addTo(map)
    L.circleMarker(part[0], {
      radius: 6,
      color: kom ? W.kom : W.sprint,
      weight: 3,
      fillColor: W.dot,
      fillOpacity: 1,
    })
      .bindTooltip(`${kom ? '⛰ KOM' : '⚡ Sprint'}: ${m.name}`)
      .addTo(map)
  }
  const me = L.circleMarker(line[0], {
    radius: 8,
    color: '#f2b705',
    weight: 3,
    fillColor: '#fff',
    fillOpacity: 1,
  }).addTo(map)
  const dots: L.CircleMarker[] = []
  let fitted = false
  const step = route.points[1].d - route.points[0].d
  return {
    map,
    /** `others` are the distances of everyone else on the road, each drawn as a small dot. */
    update(d: number, others: number[] = []) {
      if (!fitted) return
      const p = routeAt(route, d)
      const at: L.LatLngTuple = [p.lat!, p.lon!]
      while (dots.length > others.length) dots.pop()!.remove()
      others.forEach((od, i) => {
        const q = routeAt(route, od)
        dots[i] ??= L.circleMarker(at, {
          radius: 5,
          color: '#1d2b33',
          weight: 2,
          fillColor: '#5ec8f2',
          fillOpacity: 1,
        }).addTo(map)
        dots[i].setLatLng([q.lat!, q.lon!])
      })
      me.bringToFront()
      me.setLatLng(at)
      done.setLatLngs([...line.slice(0, Math.floor(d / step) + 1), at])
      if (!map.getBounds().pad(-0.2).contains(at)) map.panTo(at)
    },
    /** Call after the box changes size. */
    resize() {
      map.invalidateSize()
      if (!fitted && box.clientWidth) {
        fitted = true
        map.fitBounds(whole.getBounds(), { padding: [24, 24] })
      }
    },
  }
}

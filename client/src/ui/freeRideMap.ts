import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { routeAt, type Route } from '../core/route'

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
  const me = L.circleMarker(line[0], {
    radius: 8,
    color: '#f2b705',
    weight: 3,
    fillColor: '#fff',
    fillOpacity: 1,
  }).addTo(map)
  let fitted = false
  const step = route.points[1].d - route.points[0].d
  return {
    map,
    update(d: number) {
      if (!fitted) return
      const p = routeAt(route, d)
      const at: L.LatLngTuple = [p.lat!, p.lon!]
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

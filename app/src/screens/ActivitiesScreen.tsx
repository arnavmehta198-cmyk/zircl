import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AppLayout, NotificationsButton } from '../components/Shell'
import NotificationsSheet from '../components/NotificationsSheet'
import { useUID } from '../context/AppContext'
import { getUser } from '../services/users'
import { hasNearbySupport, nearbyForHobbies, type NearbyPlace } from '../services/places'

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749] // lon, lat — San Francisco
const DEFAULT_ZOOM = 13

// One marker color per hobby so a multi-hobby map stays legible; cycles if
// someone has more than five hobbies with mapped venues.
const HOBBY_COLORS = ['#1866DE', '#17945F', '#C9861B', '#8B5CF6', '#DB2777']

// Raster OSM tiles softened to the app's warm light palette — a full vector
// basemap needs a tile provider key, and the tinted raster reads on-brand
// without one.
const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#F5F8F6' } },
    {
      id: 'osm-light',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-saturation': -0.65,
        'raster-contrast': -0.08,
        'raster-brightness-min': 0.08,
        'raster-opacity': 0.92,
      },
    },
  ],
}

/** Azure dot with a soft pulse — the "you" marker. */
function meMarkerEl(): HTMLElement {
  const root = document.createElement('div')
  root.style.cssText = 'position:relative;width:14px;height:14px;'
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.innerHTML = `
    ${reduce ? '' : `<div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(24,102,222,0.35);
      animation:pulsering 2s ease-out infinite;"></div>`}
    <div style="position:absolute;inset:0;border-radius:50%;background:#1866DE;
      border:3px solid #FFFFFF;box-sizing:content-box;margin:-3px;"></div>`
  return root
}

type VenueStatus =
  | { kind: 'no-hobby' }
  | { kind: 'loading' }
  | { kind: 'done'; perHobby: { hobby: string; count: number }[] }
  | { kind: 'error' }

/**
 * Shows the signed-in user's own location — no other members' pins — plus
 * nearby venues for every one of their hobbies that Overpass can map.
 */
export default function ActivitiesScreen() {
  const uid = useUID()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const venueMarkersRef = useRef<maplibregl.Marker[]>([])

  const [notifications, setNotifications] = useState(false)
  const [venueStatus, setVenueStatus] = useState<VenueStatus>({ kind: 'no-hobby' })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const map = new maplibregl.Map({
      container: el,
      style: LIGHT_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    return () => {
      markerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    let alive = true

    const place = (lat: number, lon: number) => {
      const map = mapRef.current
      if (!map || !alive) return
      map.setCenter([lon, lat])
      markerRef.current?.remove()
      markerRef.current = new maplibregl.Marker({ element: meMarkerEl() })
        .setLngLat([lon, lat])
        .addTo(map)
    }

    const geolocate = (): Promise<[number, number] | null> => new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve([p.coords.latitude, p.coords.longitude]),
        () => resolve(null),
        { timeout: 8000 },
      )
    })

    // One azure-ish-per-hobby marker per venue. Popup links straight into
    // Schedule with the hobby and location pre-filled via query params.
    const dropVenue = (v: NearbyPlace, hobby: string, color: string) => {
      const map = mapRef.current
      if (!map || !alive) return null
      const el = document.createElement('div')
      el.style.cssText = `width:16px;height:16px;border-radius:50%;background:#FFFFFF;
        border:2.5px solid ${color};box-shadow:0 1px 4px rgba(21,34,25,0.3);cursor:pointer;`
      const scheduleHref = `/schedule?hobby=${encodeURIComponent(hobby)}`
        + `&location=${encodeURIComponent(v.address ? `${v.name}, ${v.address}` : v.name)}`
      const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-family:Inter,sans-serif;padding:2px 2px 4px;min-width:150px">
           <div style="font-weight:600;font-size:13px;color:#152219">${v.name.replace(/</g, '&lt;')}</div>
           <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5D6F63;margin-top:2px">
             ${hobby.toUpperCase()} · ${v.distanceMiles < 1 ? '&lt; 1' : v.distanceMiles.toFixed(1)} MI
           </div>
           <a href="${scheduleHref}" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:600;
              color:#0E4FB6;text-decoration:underline">Schedule here</a>
         </div>`,
      )
      return new maplibregl.Marker({ element: el }).setLngLat([v.lon, v.lat]).setPopup(popup).addTo(map)
    }

    void (async () => {
      let coords: [number, number] | null = null
      let hobbies: string[] = []

      if (uid) {
        const u = await getUser(uid)
        if (u) {
          if (typeof u.latitude === 'number' && typeof u.longitude === 'number') coords = [u.latitude, u.longitude]
          hobbies = u.hobbies.filter(hasNearbySupport)
        }
      }

      if (!coords) coords = await geolocate()
      if (!coords) coords = [DEFAULT_CENTER[1], DEFAULT_CENTER[0]]
      if (!alive) return
      place(coords[0], coords[1])

      if (hobbies.length === 0) {
        setVenueStatus({ kind: 'no-hobby' })
        return
      }

      setVenueStatus({ kind: 'loading' })
      try {
        // One batched request for every hobby — the free Overpass instance
        // rate-limits concurrent requests, so this must not fan out per hobby.
        const byHobby = await nearbyForHobbies(hobbies, coords[0], coords[1])
        if (!alive) return

        const map = mapRef.current
        const bounds = new maplibregl.LngLatBounds([coords[1], coords[0]], [coords[1], coords[0]])
        let placed = 0
        hobbies.forEach((hobby, i) => {
          const color = HOBBY_COLORS[i % HOBBY_COLORS.length]
          for (const v of byHobby[hobby] ?? []) {
            const m = dropVenue(v, hobby, color)
            if (m) {
              venueMarkersRef.current.push(m)
              bounds.extend([v.lon, v.lat])
              placed++
            }
          }
        })
        if (map && placed > 0) map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 600 })
        setVenueStatus({
          kind: 'done',
          perHobby: hobbies.map((hobby) => ({ hobby, count: byHobby[hobby]?.length ?? 0 })),
        })
      } catch (e) {
        console.warn('[Map] Venue lookup failed.', e)
        if (alive) setVenueStatus({ kind: 'error' })
      }
    })()

    return () => {
      alive = false
      venueMarkersRef.current.forEach((m) => m.remove())
      venueMarkersRef.current = []
    }
  }, [uid, retryKey])

  const statusText = (() => {
    switch (venueStatus.kind) {
      case 'no-hobby':
        return 'ADD A HOBBY IN YOUR PROFILE TO SEE NEARBY SPOTS'
      case 'loading':
        return 'SCANNING NEARBY…'
      case 'error':
        return 'COULD NOT LOAD NEARBY SPOTS — TRY AGAIN LATER'
      case 'done': {
        const found = venueStatus.perHobby.filter((h) => h.count > 0)
        if (found.length === 0) {
          const names = venueStatus.perHobby.map((h) => h.hobby.toUpperCase()).join(', ')
          return `NO SPOTS FOUND NEARBY FOR ${names}`
        }
        return found.map((h) => `${h.count} ${h.hobby.toUpperCase()}`).join(' · ') + ' NEARBY'
      }
    }
  })()

  return (
    <AppLayout
      bleed
      title="Map"
      actions={<NotificationsButton onClick={() => setNotifications(true)} />}
    >
      <div className="absolute inset-0">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] bg-surface border border-line
                        rounded-xl px-3.5 py-2.5 flex items-center gap-3 max-w-[calc(100%-32px)] shadow-pop">
          <span className="font-mono text-[12px] text-ink-2 whitespace-nowrap overflow-hidden text-ellipsis">
            {statusText}
          </span>
          {venueStatus.kind === 'error' && (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="font-mono text-[12px] font-semibold text-azure whitespace-nowrap shrink-0 hover:text-azure-hover"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      <NotificationsSheet open={notifications} onClose={() => setNotifications(false)} uid={uid} />
    </AppLayout>
  )
}

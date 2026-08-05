import { milesBetween } from '../lib/format'

// Real nearby-venue search via Overpass (OpenStreetMap's free query API, no
// key required) instead of a plain global text search — results are queried
// within a radius of the user's own location and sorted by distance.
//
// NOTE: Overpass has no ratings/reviews data. That needs a commercial Places
// API (Google Places or Foursquare), which requires an API key tied to a
// billing account on your end — not something addable from here. This gets
// "nearby, not from anywhere in the world" and "how far" working now; ratings
// stay a follow-up once you decide which provider and get a key.

export interface NearbyPlace {
  id: string
  name: string
  address: string
  lat: number
  lon: number
  distanceMiles: number
}

interface TagFilter { key: string; value: string }

/** Maps a hobby to OSM tag filters. Order = priority; first match wins when classifying results. */
const HOBBY_TAGS: Record<string, TagFilter[]> = {
  Tennis: [{ key: 'sport', value: 'tennis' }],
  Pickleball: [{ key: 'sport', value: 'pickleball' }, { key: 'sport', value: 'tennis' }],
  Surfing: [{ key: 'natural', value: 'beach' }],
  Basketball: [{ key: 'sport', value: 'basketball' }],
  Cycling: [{ key: 'shop', value: 'bicycle' }],
  Climbing: [{ key: 'sport', value: 'climbing' }],
  Art: [{ key: 'amenity', value: 'arts_centre' }, { key: 'tourism', value: 'gallery' }],
  'Escape Rooms': [{ key: 'leisure', value: 'escape_game' }],
  'Board Games': [{ key: 'amenity', value: 'cafe' }],
  Movies: [{ key: 'amenity', value: 'cinema' }],
  Hiking: [{ key: 'leisure', value: 'park' }, { key: 'natural', value: 'peak' }],
  Running: [{ key: 'leisure', value: 'track' }, { key: 'leisure', value: 'park' }],
  Volleyball: [{ key: 'sport', value: 'volleyball' }],
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const RADIUS_METERS = 12_000 // ~7.5 miles
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 900

interface OverpassElement {
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function addressOf(tags: Record<string, string> | undefined): string {
  if (!tags) return ''
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean)
  return parts.join(' ')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Runs a raw Overpass query, retrying once on a rate-limit/server-busy
 * response (the free public instance 429s/504s under concurrent load —
 * common when several hobbies are queried close together).
 */
async function runQuery(query: string, signal?: AbortSignal): Promise<{ elements?: OverpassElement[] }> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      })
      if (res.status === 429 || res.status === 504) throw new Error(`Overpass busy (${res.status})`)
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      return (await res.json()) as { elements?: OverpassElement[] }
    } catch (e) {
      lastError = e
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt)
    }
  }
  throw lastError
}

function toPlace(el: OverpassElement, lat: number, lon: number): NearbyPlace | null {
  const plat = el.lat ?? el.center?.lat
  const plon = el.lon ?? el.center?.lon
  const name = el.tags?.name
  if (typeof plat !== 'number' || typeof plon !== 'number' || !name) return null
  return {
    id: String(el.id),
    name,
    address: addressOf(el.tags),
    lat: plat,
    lon: plon,
    distanceMiles: milesBetween(lat, lon, plat, plon),
  }
}

/**
 * Nearby venues for MULTIPLE hobbies in a single Overpass request — avoids
 * firing one concurrent request per hobby, which is what triggers the free
 * instance's rate limiting. Returns a map of hobby -> places, nearest first.
 */
export async function nearbyForHobbies(
  hobbies: string[], lat: number, lon: number, signal?: AbortSignal,
): Promise<Record<string, NearbyPlace[]>> {
  const supported = hobbies.filter((h) => h in HOBBY_TAGS)
  const result: Record<string, NearbyPlace[]> = {}
  for (const h of supported) result[h] = []
  if (supported.length === 0) return result

  const clauses = supported
    .flatMap((h) => HOBBY_TAGS[h].map((f) => `nwr["${f.key}"="${f.value}"](around:${RADIUS_METERS},${lat},${lon});`))
    .join('\n      ')
  // Cap scales with hobby count so one dense hobby (e.g. tennis courts)
  // can't crowd out the results budget for the others.
  const cap = Math.max(60, supported.length * 40)
  const query = `[out:json][timeout:25];(\n      ${clauses}\n    );out center ${cap};`

  const json = await runQuery(query, signal)
  const elements = json.elements ?? []

  for (const el of elements) {
    const place = toPlace(el, lat, lon)
    if (!place) continue
    // Assign to the first requested hobby whose tag filter this element matches.
    const hobby = supported.find((h) => HOBBY_TAGS[h].some((f) => el.tags?.[f.key] === f.value))
    if (!hobby) continue
    if (result[hobby].some((p) => p.id === place.id)) continue
    result[hobby].push(place)
  }

  for (const h of supported) {
    result[h].sort((a, b) => a.distanceMiles - b.distanceMiles)
    result[h] = result[h].slice(0, 12)
  }
  return result
}

/** Nearby venues matching a single hobby, within RADIUS_METERS of (lat, lon), nearest first. */
export async function nearbyForHobby(
  hobby: string, lat: number, lon: number, signal?: AbortSignal,
): Promise<NearbyPlace[]> {
  const result = await nearbyForHobbies([hobby], lat, lon, signal)
  return result[hobby] ?? []
}

export function hasNearbySupport(hobby: string | null): boolean {
  return !!hobby && hobby in HOBBY_TAGS
}

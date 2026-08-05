/** Whole years between a birth date and now — matches the Swift age math. */
export function ageFrom(dob: Date | null | undefined): number {
  if (!dob) return 18
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

/**
 * Distance in miles between two lat/lon pairs (haversine). CLLocation uses a
 * great-circle distance too, so results line up closely with the iOS app.
 */
export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000 // metres, matches CLLocation's earth radius
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const metres = 2 * R * Math.asin(Math.sqrt(a))
  return Math.max(0.1, metres / 1609.34)
}

/** Deliberately coarse — the iOS app never shows a precise distance. */
export function distanceText(miles: number): string {
  const rounded = Math.max(1, Math.ceil(miles))
  return `${rounded} ${rounded === 1 ? 'mile' : 'miles'} away`
}

export function timeOnly(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function shortDateTime(d: Date): string {
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** yyyy-MM-dd in device-local time — the usage-tracker day key. */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** yyyy-MM in device-local time — the usage-tracker month key. */
export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

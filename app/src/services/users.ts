import { supabase } from '../lib/supabase'
import type { PlanTier, UserProfile } from '../lib/types'

export interface UserRecord extends UserProfile {
  id: string
  /** Server-computed, present only for OTHER users (see publicProfiles).
   *  Their latitude/longitude and dateOfBirth are never sent to the client,
   *  so these are the only distance/age available for anyone but yourself. */
  serverAge?: number | null
  serverDistanceMiles?: number | null
}

interface Row {
  id: string
  name: string
  date_of_birth: string | null
  bio: string | null
  photo_url: string | null
  hobbies: string[] | null
  latitude: number | null
  longitude: number | null
  notifications_enabled: boolean
  onboarding_complete: boolean
  plan: PlanTier
  created_at: string
}

function fromRow(r: Row): UserRecord {
  return {
    id: r.id,
    name: r.name,
    dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth) : new Date(0),
    bio: r.bio ?? '',
    photoURL: r.photo_url,
    hobbies: r.hobbies ?? [],
    latitude: r.latitude,
    longitude: r.longitude,
    notificationsEnabled: r.notifications_enabled,
    onboardingComplete: r.onboarding_complete,
    createdAt: new Date(r.created_at),
    plan: r.plan,
  }
}

/** Shape returned by the public_profiles() RPC — deliberately has no
 *  latitude, longitude or date_of_birth. Distance and age are computed in
 *  Postgres so the raw values never leave the database. */
interface PublicRow {
  id: string
  name: string
  bio: string | null
  photo_url: string | null
  hobbies: string[] | null
  age: number | null
  distance_miles: number | null
  onboarding_complete: boolean
  plan: PlanTier
  created_at: string
}

function fromPublicRow(r: PublicRow): UserRecord {
  return {
    id: r.id,
    name: r.name,
    // Not known for other users, and intentionally so. Anything rendering an
    // age must read serverAge; anything rendering a distance, serverDistanceMiles.
    dateOfBirth: new Date(0),
    bio: r.bio ?? '',
    photoURL: r.photo_url,
    hobbies: r.hobbies ?? [],
    latitude: null,
    longitude: null,
    notificationsEnabled: false,
    onboardingComplete: r.onboarding_complete,
    createdAt: new Date(r.created_at),
    plan: r.plan,
    serverAge: r.age,
    serverDistanceMiles: r.distance_miles,
  }
}

async function publicProfiles(
  ids: string[] | null, cursor: string | null, limit: number,
): Promise<UserRecord[]> {
  const { data, error } = await supabase.rpc('public_profiles', {
    p_ids: ids, p_cursor: cursor, p_limit: limit,
  })
  if (error || !data) return []
  return (data as PublicRow[]).map(fromPublicRow)
}

/** Your own row comes back in full; RLS hides everyone else's, so for other
 *  people we fall through to the sanitised RPC. Callers don't need to know
 *  which of the two they're getting. */
export async function getUser(uid: string): Promise<UserRecord | null> {
  const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle()
  if (data) return fromRow(data as Row)
  const [row] = await publicProfiles([uid], null, 1)
  return row ?? null
}

export async function getUsers(uids: string[]): Promise<UserRecord[]> {
  if (uids.length === 0) return []
  return publicProfiles(uids, null, Math.max(uids.length, 1))
}

export async function createUser(uid: string, fields: {
  name: string
  dateOfBirth: Date
  bio: string
  photoURL: string | null
  hobbies: string[]
  latitude: number | null
  longitude: number | null
  notificationsEnabled: boolean
}): Promise<void> {
  const { error } = await supabase.from('users').insert({
    id: uid,
    name: fields.name,
    date_of_birth: fields.dateOfBirth.toISOString().slice(0, 10),
    bio: fields.bio,
    photo_url: fields.photoURL,
    hobbies: fields.hobbies,
    latitude: fields.latitude,
    longitude: fields.longitude,
    notifications_enabled: fields.notificationsEnabled,
    onboarding_complete: true,
  })
  if (error) throw error
}

export async function updateUser(uid: string, patch: Partial<{
  hobbies: string[]
  photoURL: string | null
  plan: PlanTier
}>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.hobbies !== undefined) row.hobbies = patch.hobbies
  if (patch.photoURL !== undefined) row.photo_url = patch.photoURL
  if (patch.plan !== undefined) row.plan = patch.plan
  const { error } = await supabase.from('users').update(row).eq('id', uid)
  if (error) throw error
}

export async function deleteUserRow(uid: string): Promise<void> {
  await supabase.from('users').delete().eq('id', uid)
}

/** Cursor-paginated, newest first — feed.ts's real-user page source. */
export async function listUsersPage(
  cursor: string | null, n: number,
): Promise<{ rows: UserRecord[]; nextCursor: string | null }> {
  // Browsing other people goes through the RPC — this is the call that used
  // to hand out the whole user base's coordinates a page at a time.
  const rows = await publicProfiles(null, cursor, n)
  if (rows.length === 0) return { rows: [], nextCursor: null }
  const nextCursor = rows.length === n
    ? rows[rows.length - 1].createdAt.toISOString()
    : null
  return { rows, nextCursor }
}

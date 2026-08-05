import { supabase } from '../lib/supabase'
import type { PlanTier, UserProfile } from '../lib/types'

export interface UserRecord extends UserProfile { id: string }

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

export async function getUser(uid: string): Promise<UserRecord | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle()
  if (error || !data) return null
  return fromRow(data as Row)
}

export async function getUsers(uids: string[]): Promise<UserRecord[]> {
  if (uids.length === 0) return []
  const { data, error } = await supabase.from('users').select('*').in('id', uids)
  if (error || !data) return []
  return (data as Row[]).map(fromRow)
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
  let q = supabase.from('users').select('*').order('created_at', { ascending: false }).limit(n)
  if (cursor) q = q.lt('created_at', cursor)
  const { data, error } = await q
  if (error || !data || data.length === 0) return { rows: [], nextCursor: null }
  const rows = (data as Row[]).map(fromRow)
  const nextCursor = data.length === n ? (data[data.length - 1] as Row).created_at : null
  return { rows, nextCursor }
}

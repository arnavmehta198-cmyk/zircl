import { supabase } from '../lib/supabase'
import type { Club, ClubMember } from '../lib/types'
import { friendIDs } from './friendship'
import { getUser, getUsers } from './users'

interface ClubRow {
  id: string
  name: string
  hobby: string
  creator_id: string
  created_at: string
  is_admin_controlled: boolean
}

interface MemberRow {
  club_id: string
  user_id: string
  role: 'member' | 'admin'
  banned: boolean
}

function decode(row: ClubRow, members: MemberRow[]): Club {
  const active = members.filter((m) => !m.banned)
  return {
    id: row.id,
    name: row.name,
    hobby: row.hobby,
    creatorID: row.creator_id,
    memberIDs: active.map((m) => m.user_id),
    createdAt: new Date(row.created_at),
    isAdminControlled: row.is_admin_controlled,
    adminIDs: active.filter((m) => m.role === 'admin').map((m) => m.user_id),
    bannedIDs: members.filter((m) => m.banned).map((m) => m.user_id),
  }
}

export async function fetchAll(max = 200): Promise<Club[]> {
  const { data: clubRows } = await supabase
    .from('clubs').select('*').order('created_at', { ascending: false }).limit(max)
  const rows = (clubRows ?? []) as ClubRow[]
  if (rows.length === 0) return []

  const { data: memberRows } = await supabase
    .from('club_members').select('*').in('club_id', rows.map((r) => r.id))
  const members = (memberRows ?? []) as MemberRow[]
  const byClub = new Map<string, MemberRow[]>()
  for (const m of members) (byClub.get(m.club_id) ?? byClub.set(m.club_id, []).get(m.club_id)!).push(m)

  return rows.map((r) => decode(r, byClub.get(r.id) ?? []))
}

export function listenToClub(clubID: string, cb: (c: Club | null) => void) {
  async function load() {
    const { data: row } = await supabase.from('clubs').select('*').eq('id', clubID).maybeSingle()
    if (!row) { cb(null); return }
    const { data: memberRows } = await supabase.from('club_members').select('*').eq('club_id', clubID)
    cb(decode(row as ClubRow, (memberRows ?? []) as MemberRow[]))
  }
  void load()

  const channel = supabase
    .channel(`club:${clubID}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs', filter: `id=eq.${clubID}` }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${clubID}` }, load)
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}

export async function createClub(opts: {
  name: string; hobby: string; creatorID: string; isAdminControlled: boolean
}): Promise<string> {
  const { data, error } = await supabase.from('clubs').insert({
    name: opts.name.trim(), hobby: opts.hobby, creator_id: opts.creatorID,
    is_admin_controlled: opts.isAdminControlled,
  }).select('id').single()
  if (error || !data) throw error ?? new Error('Could not create club')
  await supabase.from('club_members').insert({ club_id: data.id, user_id: opts.creatorID, role: 'admin' })
  return data.id as string
}

export async function join(clubID: string, uid: string): Promise<void> {
  await supabase.from('club_members').upsert({ club_id: clubID, user_id: uid, role: 'member', banned: false })
}

export async function leave(clubID: string, uid: string): Promise<void> {
  await supabase.from('club_members').delete().eq('club_id', clubID).eq('user_id', uid)
}

export const kick = leave // identical behaviour in the iOS app

export async function ban(clubID: string, uid: string): Promise<void> {
  await supabase.from('club_members').upsert({ club_id: clubID, user_id: uid, banned: true, role: 'member' })
}

export async function fetchMembers(uids: string[]): Promise<ClubMember[]> {
  const users = await getUsers(uids)
  return users.map((u) => ({
    id: u.id,
    // Legacy rows exist with name: "" — treat blank as missing so the UI
    // never renders an empty sender label.
    name: (u.name ?? '').trim() || 'Someone',
    photoURL: u.photoURL,
  }))
}

/**
 * Port of ClubRecommender. Score = hobby match + friends who are members +
 * a small popularity tiebreak; anything scoring 0 is dropped.
 */
export async function recommend(uid: string, all: Club[], prioritizeHobbies: boolean): Promise<Club[]> {
  const user = await getUser(uid)
  const hobbies = new Set(user?.hobbies ?? [])
  const friends = new Set(await friendIDs(uid))

  const hobbyWeight = prioritizeHobbies ? 6 : 2
  const friendWeight = 3

  return all
    .filter((c) => !c.memberIDs.includes(uid))
    .map((club) => {
      let score = 0
      if (hobbies.has(club.hobby)) score += hobbyWeight
      score += club.memberIDs.filter((m) => friends.has(m)).length * friendWeight
      score += Math.min(club.memberIDs.length, 10) * 0.1
      return { club, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.club)
}

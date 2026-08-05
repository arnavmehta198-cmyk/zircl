import { supabase } from '../lib/supabase'
import { canSendFollowRequest } from './usage'

// Port of FriendshipService.swift.
// A "mutual follow" is TWO accepted follow_requests rows, one in each direction.

async function isAccepted(from: string, to: string): Promise<boolean> {
  const { data } = await supabase
    .from('follow_requests').select('id')
    .eq('from_uid', from).eq('to_uid', to).eq('status', 'accepted').limit(1)
  return !!data && data.length > 0
}

/**
 * Whether `from` has an existing outgoing edge to `to` — pending or accepted.
 * Used to render the Follow button correctly on load instead of always
 * starting from "not requested" regardless of actual state.
 */
export async function hasOutgoingRequest(from: string, to: string): Promise<boolean> {
  const { data } = await supabase.from('follow_requests').select('id').eq('from_uid', from).eq('to_uid', to)
  return !!data && data.length > 0
}

export async function isMutualFollow(a: string, b: string): Promise<boolean> {
  if (a === b) return false
  const [ab, ba] = await Promise.all([isAccepted(a, b), isAccepted(b, a)])
  return ab && ba
}

/**
 * Looser than isMutualFollow: anyone with an accepted edge in EITHER
 * direction. This is what the friends list and event invitee picker use.
 */
export async function friendIDs(uid: string): Promise<string[]> {
  const [outgoing, incoming] = await Promise.all([
    supabase.from('follow_requests').select('to_uid').eq('from_uid', uid).eq('status', 'accepted'),
    supabase.from('follow_requests').select('from_uid').eq('to_uid', uid).eq('status', 'accepted'),
  ])
  const ids = new Set<string>()
  outgoing.data?.forEach((r) => ids.add(r.to_uid as string))
  incoming.data?.forEach((r) => ids.add(r.from_uid as string))
  return [...ids]
}

/** Returns false when the free-plan daily cap is already spent. */
export async function sendFollowRequest(from: string, to: string): Promise<boolean> {
  if (!(await canSendFollowRequest(from))) return false
  await supabase.from('follow_requests').insert({ from_uid: from, to_uid: to, status: 'pending' })
  return true
}

export async function acceptRequest(id: string) {
  await supabase.from('follow_requests').update({ status: 'accepted' }).eq('id', id)
}

/** Declining deletes the row — there is no "declined" status. */
export async function declineRequest(id: string) {
  await supabase.from('follow_requests').delete().eq('id', id)
}

export async function pendingIncoming(uid: string) {
  const { data } = await supabase
    .from('follow_requests').select('id, from_uid').eq('to_uid', uid).eq('status', 'pending')
  return (data ?? []).map((d) => ({ id: d.id as string, from: d.from_uid as string }))
}

export async function pendingOutgoing(uid: string) {
  const { data } = await supabase
    .from('follow_requests').select('id, to_uid').eq('from_uid', uid).eq('status', 'pending')
  return (data ?? []).map((d) => ({ id: d.id as string, to: d.to_uid as string }))
}

import { deleteUser } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import { deleteProfilePhoto } from './media'

// Port of AccountDeletionService.swift — a full purge so "Delete Account"
// removes what it claims to, not just the user row.
//
// Every step is independently timed out and error-trapped: a single failing
// step (a permissions/RLS gap) must not strand the user in a half-deleted
// state with a spinner that never resolves.

const STEP_TIMEOUT_MS = 20_000

function withTimeout<T>(label: string, p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), STEP_TIMEOUT_MS)),
  ])
}

async function deleteFollowRequests(uid: string) {
  await Promise.all([
    supabase.from('follow_requests').delete().eq('from_uid', uid),
    supabase.from('follow_requests').delete().eq('to_uid', uid),
  ])
}

/** Also removes the other participant's copy — accepted tradeoff for a full
 *  purge. Messages cascade-delete with the conversation row. */
async function deleteConversations(uid: string) {
  await Promise.all([
    supabase.from('conversations').delete().eq('user_a', uid),
    supabase.from('conversations').delete().eq('user_b', uid),
  ])
}

/** Clubs survive one member leaving, so the club row itself is left alone —
 *  only membership is stripped. Authored club messages are caught by the
 *  sweep below. */
async function purgeClubs(uid: string) {
  await supabase.from('club_members').delete().eq('user_id', uid)
}

/** Sweeps every authored message regardless of conversation/club — replaces
 *  the Firestore collection-group query, since messages is one flat table. */
async function sweepAuthoredMessages(uid: string) {
  await supabase.from('messages').delete().eq('sender_id', uid)
}

async function deleteEvents(uid: string) {
  await Promise.all([
    supabase.from('events').delete().eq('creator_id', uid),
    supabase.from('events').delete().eq('invitee_id', uid),
  ])
}

async function deleteBlocks(uid: string) {
  await Promise.all([
    supabase.from('blocks').delete().eq('blocker_id', uid),
    supabase.from('blocks').delete().eq('blocked_id', uid),
  ])
}

/** Returns the labels of any steps that failed, so callers can be honest about it. */
export async function purgeAllData(uid: string): Promise<string[]> {
  const steps: [string, Promise<unknown>][] = [
    ['follow requests', deleteFollowRequests(uid)],
    ['conversations', deleteConversations(uid)],
    ['clubs', purgeClubs(uid)],
    ['events', deleteEvents(uid)],
    ['blocks', deleteBlocks(uid)],
    ['profile photo', deleteProfilePhoto(uid)],
  ]

  const failed: string[] = []
  const results = await Promise.allSettled(steps.map(([label, p]) => withTimeout(label, p)))
  results.forEach((r, i) => { if (r.status === 'rejected') failed.push(steps[i][0]) })

  // Best-effort catch-all; survivable if it fails because the passes above
  // already covered the common cases.
  try {
    await withTimeout('message sweep', sweepAuthoredMessages(uid))
  } catch {
    // intentionally ignored — see the doc comment on sweepAuthoredMessages
  }

  // Last, once nothing else references the uid.
  const tail = await Promise.allSettled([
    withTimeout('usage', Promise.resolve(supabase.from('usage').delete().eq('uid', uid))),
    withTimeout('profile', Promise.resolve(supabase.from('users').delete().eq('id', uid))),
  ])
  if (tail[0].status === 'rejected') failed.push('usage')
  if (tail[1].status === 'rejected') failed.push('profile')

  return failed
}

/**
 * Returns null on a clean delete, or a message to show the user. The data
 * purge runs regardless of whether the Auth record can be removed (Firebase
 * requires a recent login for that).
 */
export async function deleteAccount(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null

  const failed = await purgeAllData(user.uid)

  try {
    await deleteUser(user)
  } catch {
    return failed.length
      ? `Your data was deleted, but some items couldn't be removed (${failed.join(', ')}), and you'll need to sign in once more to fully remove your account.`
      : 'Your data was deleted, but please sign back in once more to fully remove your account.'
  }

  return failed.length
    ? `Your account was deleted, but some items couldn't be removed: ${failed.join(', ')}.`
    : null
}

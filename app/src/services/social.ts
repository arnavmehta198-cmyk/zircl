import { supabase } from '../lib/supabase'
import type { ReportReason } from '../lib/types'

// Port of BlockService.swift / ReportService.swift.

export async function block(blockerID: string, blockedID: string) {
  await supabase.from('blocks').upsert({ blocker_id: blockerID, blocked_id: blockedID })

  // Blocking severs the follow relationship in both directions, which is what
  // actually locks messaging (mutual-follow stops being satisfiable).
  await Promise.all([
    supabase.from('follow_requests').delete().eq('from_uid', blockerID).eq('to_uid', blockedID),
    supabase.from('follow_requests').delete().eq('from_uid', blockedID).eq('to_uid', blockerID),
  ])
}

export async function unblock(blockerID: string, blockedID: string) {
  await supabase.from('blocks').delete().eq('blocker_id', blockerID).eq('blocked_id', blockedID)
}

export async function isBlocked(blockerID: string, blockedID: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocks').select('blocker_id').eq('blocker_id', blockerID).eq('blocked_id', blockedID).maybeSingle()
  return !!data
}

/** Blocking is symmetric in effect — either direction hides the pair. */
export async function blockedEitherDirection(uid: string): Promise<Set<string>> {
  const [mine, theirs] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', uid),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', uid),
  ])
  const ids = new Set<string>()
  mine.data?.forEach((r) => ids.add(r.blocked_id as string))
  theirs.data?.forEach((r) => ids.add(r.blocker_id as string))
  return ids
}

export async function submitReport(opts: {
  reporterID: string
  reportedID: string
  reason: ReportReason
  context: string
  details: string
}) {
  await supabase.from('reports').insert({
    reporter_id: opts.reporterID,
    reported_id: opts.reportedID,
    reason: opts.reason,
    context: opts.context,
    details: opts.details,
    status: 'open',
  })
}

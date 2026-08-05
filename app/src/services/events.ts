import { supabase } from '../lib/supabase'
import type { ScheduledEvent } from '../lib/types'
import { canScheduleEvent } from './usage'

interface Row {
  id: string
  creator_id: string
  creator_first_name: string | null
  creator_last_name: string | null
  creator_email: string | null
  creator_phone: string | null
  invitee_id: string
  invitee_name: string | null
  hobby: string
  location_name: string
  date: string
  status: ScheduledEvent['status']
  created_at: string
}

function decode(r: Row): ScheduledEvent {
  return {
    id: r.id,
    creatorID: r.creator_id,
    creatorFirstName: r.creator_first_name ?? '',
    creatorLastName: r.creator_last_name ?? '',
    creatorEmail: r.creator_email ?? '',
    creatorPhone: r.creator_phone ?? '',
    inviteeID: r.invitee_id,
    inviteeName: r.invitee_name ?? 'Someone',
    hobby: r.hobby,
    locationName: r.location_name,
    date: new Date(r.date),
    status: r.status,
    createdAt: new Date(r.created_at),
  }
}

/** Returns false when the free-plan monthly cap is already spent. */
export async function createEvent(opts: {
  creatorID: string; creatorFirstName: string; creatorLastName: string
  creatorEmail: string; creatorPhone: string
  inviteeID: string; inviteeName: string
  hobby: string; locationName: string; date: Date
}): Promise<boolean> {
  if (!(await canScheduleEvent(opts.creatorID))) return false
  await supabase.from('events').insert({
    creator_id: opts.creatorID,
    creator_first_name: opts.creatorFirstName.trim(),
    creator_last_name: opts.creatorLastName.trim(),
    creator_email: opts.creatorEmail.trim(),
    creator_phone: opts.creatorPhone.trim(),
    invitee_id: opts.inviteeID,
    invitee_name: opts.inviteeName,
    hobby: opts.hobby,
    location_name: opts.locationName.trim(),
    date: opts.date.toISOString(),
    status: 'pending',
  })
  return true
}

/** Union of events I created and events I was invited to, deduped by id. */
export async function fetchAll(uid: string): Promise<ScheduledEvent[]> {
  const [mine, invited] = await Promise.all([
    supabase.from('events').select('*').eq('creator_id', uid),
    supabase.from('events').select('*').eq('invitee_id', uid),
  ])
  const byID = new Map<string, ScheduledEvent>()
  for (const r of [...(mine.data ?? []), ...(invited.data ?? [])] as Row[]) {
    byID.set(r.id, decode(r))
  }
  return [...byID.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

export async function respond(eventID: string, accept: boolean) {
  await supabase.from('events').update({ status: accept ? 'accepted' : 'declined' }).eq('id', eventID)
}

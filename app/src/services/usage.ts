import { supabase } from '../lib/supabase'
import { FreePlanLimits } from '../lib/types'
import { dayKey, monthKey } from '../lib/format'
import { getUser, updateUser } from './users'

// Port of UsageTracker.swift. The counter is a row in usage(uid, metric,
// period, count) — the period column plays the same role the Firestore
// "{field}Period" string did: if it doesn't match the current period, the
// count reads as 0 and gets overwritten. No scheduled reset needed.

type Field = 'messages' | 'followRequests' | 'events'

export async function isPremium(uid: string): Promise<boolean> {
  const u = await getUser(uid)
  return u?.plan === 'premium'
}

async function currentCount(uid: string, field: Field, period: string): Promise<number> {
  const { data } = await supabase
    .from('usage').select('count, period').eq('uid', uid).eq('metric', field).eq('period', period)
    .maybeSingle()
  return data?.count ?? 0
}

async function consume(uid: string, field: Field, limit: number, period: string): Promise<boolean> {
  if (await isPremium(uid)) return true // premium never touches the counter

  const current = await currentCount(uid, field, period)
  if (current >= limit) return false

  await supabase.from('usage').upsert(
    { uid, metric: field, period, count: current + 1 },
    { onConflict: 'uid,metric,period' },
  )
  return true
}

export const canSendMessage = (uid: string) =>
  consume(uid, 'messages', FreePlanLimits.dailyMessages, dayKey())

export const canSendFollowRequest = (uid: string) =>
  consume(uid, 'followRequests', FreePlanLimits.dailyFollowRequests, dayKey())

export const canScheduleEvent = (uid: string) =>
  consume(uid, 'events', FreePlanLimits.monthlyEvents, monthKey())

/** null means unlimited (premium). */
async function remaining(uid: string, field: Field, limit: number, period: string): Promise<number | null> {
  if (await isPremium(uid)) return null
  const used = await currentCount(uid, field, period)
  return Math.max(0, limit - used)
}

export const remainingMessagesToday = (uid: string) =>
  remaining(uid, 'messages', FreePlanLimits.dailyMessages, dayKey())
export const remainingFollowRequestsToday = (uid: string) =>
  remaining(uid, 'followRequests', FreePlanLimits.dailyFollowRequests, dayKey())
export const remainingEventsThisMonth = (uid: string) =>
  remaining(uid, 'events', FreePlanLimits.monthlyEvents, monthKey())

export async function setPlan(uid: string, plan: 'free' | 'premium') {
  await updateUser(uid, { plan })
}

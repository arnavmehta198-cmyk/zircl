import { supabase } from '../lib/supabase'
import type { ChatMessage, Conversation, MessageKind, ReplyRef } from '../lib/types'
import { canSendMessage } from './usage'

/** Deterministic and order-independent — matches Conversation.makeID. */
export function conversationID(a: string, b: string): string {
  return [a, b].sort().join('_')
}

// ---------- path parsing (kept so call sites read the same as before) ----------
// A "path" is `conversations/{id}/messages` or `clubs/{id}/messages`.
// A "parentPath" is `conversations/{id}` or `clubs/{id}`.

function parseMessagesPath(path: string): { column: 'conversation_id' | 'club_id'; id: string } {
  const [kind, id] = path.split('/')
  return { column: kind === 'clubs' ? 'club_id' : 'conversation_id', id }
}

function parseParentPath(path: string): { table: 'conversations' | 'clubs'; id: string } {
  const [kind, id] = path.split('/')
  return { table: kind === 'clubs' ? 'clubs' : 'conversations', id }
}

// ---------- message row <-> ChatMessage ----------

interface MessageRow {
  id: string
  sender_id: string
  text: string | null
  kind: MessageKind
  photo_url: string | null
  gif_url: string | null
  sticker: string | null
  video_url: string | null
  file_name: string | null
  file_size: number | null
  file_url: string | null
  audio_url: string | null
  audio_duration_sec: number | null
  poll_options: string[] | null
  event_title: string | null
  event_location: string | null
  event_date: string | null
  reply_sender_id: string | null
  reply_sender_name: string | null
  reply_preview: string | null
  reply_to_message_id: string | null
  created_at: string
  message_reactions: { uid: string; emoji: string }[]
  message_poll_votes: { uid: string; option: string }[]
  message_event_attendance: { uid: string; status: string }[]
}

const MESSAGE_SELECT = `
  id, sender_id, text, kind, photo_url, gif_url, sticker, video_url, file_name, file_size, file_url,
  audio_url, audio_duration_sec, poll_options, event_title, event_location, event_date,
  reply_sender_id, reply_sender_name, reply_preview, reply_to_message_id, created_at,
  message_reactions ( uid, emoji ),
  message_poll_votes ( uid, option ),
  message_event_attendance ( uid, status )
`

function decode(r: MessageRow): ChatMessage {
  const reactions: Record<string, string[]> = {}
  for (const { uid, emoji } of r.message_reactions) (reactions[emoji] ??= []).push(uid)
  const pollVotes: Record<string, string> = {}
  for (const { uid, option } of r.message_poll_votes) pollVotes[uid] = option
  const eventAttendance: Record<string, string> = {}
  for (const { uid, status } of r.message_event_attendance) eventAttendance[uid] = status

  return {
    id: r.id,
    senderID: r.sender_id,
    text: r.text ?? '',
    timestamp: new Date(r.created_at),
    kind: r.kind,
    photoURL: r.photo_url,
    gifURL: r.gif_url,
    sticker: r.sticker,
    pollOptions: r.poll_options ?? [],
    pollVotes,
    videoURL: r.video_url,
    eventTitle: r.event_title,
    eventLocation: r.event_location,
    eventDate: r.event_date ? new Date(r.event_date) : null,
    eventAttendance,
    reactions,
    replyTo: r.reply_to_message_id
      ? { id: r.reply_to_message_id, senderID: r.reply_sender_id ?? '', senderName: r.reply_sender_name ?? '', preview: r.reply_preview ?? '' }
      : null,
    fileName: r.file_name,
    fileSize: r.file_size,
    fileURL: r.file_url,
    audioURL: r.audio_url,
    audioDurationSec: r.audio_duration_sec,
  }
}

/**
 * Scheduled messages are written immediately and hidden client-side until due.
 * The sender always sees their own pending message.
 */
export function applySchedule(raw: ChatMessage[], myUID: string): ChatMessage[] {
  const now = Date.now()
  return raw.filter((m) => !m.scheduledFor || m.scheduledFor.getTime() <= now || m.senderID === myUID)
}

export function isPending(m: ChatMessage): boolean {
  return !!m.scheduledFor && m.scheduledFor.getTime() > Date.now()
}

// ---------- messages ----------

export function listenToMessages(path: string, cb: (msgs: ChatMessage[]) => void) {
  const { column, id } = parseMessagesPath(path)
  if (!id) return () => {}

  async function load() {
    const { data } = await supabase.from('messages').select(MESSAGE_SELECT).eq(column, id).order('created_at')
    cb(((data ?? []) as unknown as MessageRow[]).map(decode))
  }
  void load()

  const channel = supabase
    .channel(`messages:${path}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `${column}=eq.${id}` }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_poll_votes' }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_event_attendance' }, load)
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}

interface ConversationRow {
  id: string
  user_a: string
  user_b: string
  last_message: string | null
  last_sender_id: string | null
  last_message_at: string | null
  user_a_last_read_at: string | null
  user_b_last_read_at: string | null
}

export function listenToConversations(uid: string, blocked: Set<string>, cb: (c: Conversation[]) => void) {
  async function load() {
    const [a, b] = await Promise.all([
      supabase.from('conversations').select('*').eq('user_a', uid),
      supabase.from('conversations').select('*').eq('user_b', uid),
    ])
    const rows = [...(a.data ?? []), ...(b.data ?? [])] as ConversationRow[]
    const otherIDs = rows.map((r) => (r.user_a === uid ? r.user_b : r.user_a)).filter((id) => !blocked.has(id))
    const { data: others } = otherIDs.length
      ? await supabase.from('users').select('id, name, photo_url').in('id', otherIDs)
      : { data: [] }
    const byID = new Map((others ?? []).map((u) => [u.id as string, u as { name: string; photo_url: string | null }]))

    const items: Conversation[] = []
    for (const r of rows) {
      const otherID = r.user_a === uid ? r.user_b : r.user_a
      if (blocked.has(otherID)) continue
      const other = byID.get(otherID)
      const lastTimestamp = r.last_message_at ? new Date(r.last_message_at) : new Date(0)
      const myLastRead = (r.user_a === uid ? r.user_a_last_read_at : r.user_b_last_read_at)
      const myLastReadDate = myLastRead ? new Date(myLastRead) : null
      items.push({
        id: r.id,
        otherID,
        otherName: other?.name ?? 'Someone',
        otherPhotoURL: other?.photo_url || null,
        lastMessage: r.last_message ?? '',
        lastTimestamp,
        isUnread: !!r.last_sender_id && r.last_sender_id !== uid && (!myLastReadDate || myLastReadDate < lastTimestamp),
      })
    }
    // Unread float to the top, then most recent first within each group.
    items.sort((x, y) =>
      x.isUnread !== y.isUnread
        ? (x.isUnread ? -1 : 1)
        : y.lastTimestamp.getTime() - x.lastTimestamp.getTime())
    cb(items)
  }
  void load()

  const channel = supabase
    .channel(`conversations:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_a=eq.${uid}` }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_b=eq.${uid}` }, load)
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}

export async function markRead(convoID: string, uid: string) {
  const { data } = await supabase.from('conversations').select('user_a, user_b').eq('id', convoID).maybeSingle()
  if (!data) return
  const column = data.user_a === uid ? 'user_a_last_read_at' : 'user_b_last_read_at'
  await supabase.from('conversations').update({ [column]: new Date().toISOString() }).eq('id', convoID)
}

interface SendCtx {
  myUID: string
  myName: string
  myPhotoURL: string | null
  otherID: string
  otherName: string
  otherPhotoURL: string | null
}

/** Returns 'ok' | 'limit'. Quota is spent on the attempt. */
export async function sendDirect(
  ctx: SendCtx,
  fields: Record<string, unknown>,
  preview: string,
  scheduledFor: Date | null,
): Promise<'ok' | 'limit'> {
  if (!(await canSendMessage(ctx.myUID))) return 'limit'

  const id = conversationID(ctx.myUID, ctx.otherID)
  const now = new Date().toISOString()
  const [userA, userB] = [ctx.myUID, ctx.otherID].sort()

  const upsertResult = await supabase.from('conversations').upsert({
    id, user_a: userA, user_b: userB,
    last_message: preview, last_message_at: now, last_sender_id: ctx.myUID,
  })
  if (upsertResult.error) throw upsertResult.error

  const payload: Record<string, unknown> = { ...fields, conversation_id: id, sender_id: ctx.myUID }
  if (scheduledFor) payload.created_at = scheduledFor.toISOString()
  const insertResult = await supabase.from('messages').insert(payload)
  if (insertResult.error) throw insertResult.error
  return 'ok'
}

/** Club sends are NOT metered — matches ClubChatViewModel, which skips the quota. */
export async function sendClub(
  clubID: string,
  myUID: string,
  fields: Record<string, unknown>,
  preview: string,
  scheduledFor: Date | null,
) {
  const updateResult = await supabase.from('clubs')
    .update({ last_message: preview, last_sender_id: myUID }).eq('id', clubID)
  if (updateResult.error) throw updateResult.error

  const payload: Record<string, unknown> = { ...fields, club_id: clubID, sender_id: myUID }
  if (scheduledFor) payload.created_at = scheduledFor.toISOString()
  const insertResult = await supabase.from('messages').insert(payload)
  if (insertResult.error) throw insertResult.error
}

// ---------- message payload builders (shared by 1:1 and clubs) ----------

/** Every payload optionally carries a reply quote — spread `replyTo` in when the composer is replying. */
function withReply(fields: Record<string, unknown>, replyTo?: ReplyRef | null) {
  return replyTo
    ? {
        ...fields,
        reply_to_message_id: replyTo.id,
        reply_sender_id: replyTo.senderID,
        reply_sender_name: replyTo.senderName,
        reply_preview: replyTo.preview,
      }
    : fields
}

export const payloads = {
  text: (t: string, replyTo?: ReplyRef | null) => ({
    fields: withReply({ kind: 'text', text: t }, replyTo), preview: t,
  }),
  sticker: (s: string) => ({ fields: { kind: 'sticker', sticker: s, text: s }, preview: s }),
  gif: (url: string) => ({ fields: { kind: 'gif', gif_url: url, text: 'GIF' }, preview: 'GIF' }),
  photo: (url: string, fileName?: string, fileSize?: number) => ({
    fields: { kind: 'photo', photo_url: url, text: 'Photo', file_name: fileName ?? null, file_size: fileSize ?? null },
    preview: 'Photo',
  }),
  video: (url: string) => ({ fields: { kind: 'video', video_url: url, text: 'Video' }, preview: 'Video' }),
  file: (url: string, fileName: string, fileSize: number) => ({
    fields: { kind: 'file', file_url: url, file_name: fileName, file_size: fileSize, text: fileName },
    preview: `File: ${fileName}`,
  }),
  audio: (url: string, durationSec: number) => ({
    fields: { kind: 'audio', audio_url: url, audio_duration_sec: durationSec, text: 'Voice message' },
    preview: 'Voice message',
  }),
  poll: (q: string, options: string[]) => ({
    fields: { kind: 'poll', text: q, poll_options: options },
    preview: `Poll: ${q}`,
  }),
  event: (title: string, location: string, date: Date) => ({
    fields: {
      kind: 'event', text: title, event_title: title, event_location: location,
      event_date: date.toISOString(),
    },
    preview: `Event: ${title}`,
  }),
}

// ---------- interactions ----------

export async function votePoll(_path: string, messageID: string, uid: string, option: string) {
  await supabase.from('message_poll_votes').upsert(
    { message_id: messageID, uid, option },
    { onConflict: 'message_id,uid' },
  )
}

export async function rsvp(_path: string, messageID: string, uid: string, attending: boolean) {
  await supabase.from('message_event_attendance').upsert(
    { message_id: messageID, uid, status: attending ? 'yes' : 'no' },
    { onConflict: 'message_id,uid' },
  )
}

/**
 * One active reaction per person: tapping your current emoji clears it,
 * tapping a different one moves your reaction there.
 */
export async function toggleReaction(_path: string, messageID: string, uid: string, emoji: string) {
  const { data } = await supabase
    .from('message_reactions').select('emoji').eq('message_id', messageID).eq('uid', uid).maybeSingle()
  await supabase.from('message_reactions').delete().eq('message_id', messageID).eq('uid', uid)
  if (data?.emoji !== emoji) {
    await supabase.from('message_reactions').insert({ message_id: messageID, uid, emoji })
  }
}

export async function deleteMessage(_path: string, messageID: string) {
  await supabase.from('messages').delete().eq('id', messageID)
}

// ---------- typing (Supabase Realtime Presence — ephemeral, never persisted) ----------
// Realtime throws if you call .on() on a channel that's already .subscribe()d,
// so the channel that SENDS presence (track/untrack only, no .on()) is kept
// separate from the channel that LISTENS (needs .on() before subscribing).
// Both channels share the same topic name, so they see the same presence set.

const sendChannels = new Map<string, ReturnType<typeof supabase.channel>>()
function sendChannel(parentPath: string) {
  let ch = sendChannels.get(parentPath)
  if (!ch) {
    ch = supabase.channel(`typing:${parentPath}`)
    ch.subscribe()
    sendChannels.set(parentPath, ch)
  }
  return ch
}

export async function setTyping(parentPath: string, uid: string, typing: boolean) {
  const ch = sendChannel(parentPath)
  if (typing) await ch.track({ uid })
  else await ch.untrack()
}

export function listenToTyping(parentPath: string, myUID: string, cb: (typingUIDs: string[]) => void) {
  const ch = supabase.channel(`typing:${parentPath}`)
  const handler = () => {
    const state = ch.presenceState() as Record<string, { uid: string }[]>
    const uids = Object.values(state).flat().map((p) => p.uid).filter((u) => u && u !== myUID)
    cb([...new Set(uids)])
  }
  ch.on('presence', { event: 'sync' }, handler)
  ch.subscribe()
  handler()
  return () => { void supabase.removeChannel(ch) }
}

export async function loadIdentity(uid: string) {
  const { data } = await supabase.from('users').select('name, photo_url').eq('id', uid).maybeSingle()
  return { name: data?.name ?? 'Someone', photoURL: data?.photo_url || null }
}

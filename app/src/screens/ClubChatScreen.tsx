import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../components/Shell'
import { AlertDialog, Menu, ProfileAvatar, Sheet, Spinner, StatusPill } from '../components/ui'
import { Icon } from '../components/icons'
import MessageBubble from '../components/chat/MessageBubble'
import Composer from '../components/chat/Composer'
import ReportSheet from '../components/ReportSheet'
import { useApp, useUID } from '../context/AppContext'
import { FreePlanLimits, type ChatMessage, type Club, type ClubMember, type ReplyRef, type ReportReason } from '../lib/types'
import {
  applySchedule, deleteMessage, listenToMessages, listenToTyping, rsvp, sendClub, setTyping,
  toggleReaction, votePoll,
} from '../services/messaging'
import { ban, fetchMembers, kick, listenToClub } from '../services/clubs'
import { block, submitReport } from '../services/social'
import { downloadICS } from '../services/calendar'

export default function ClubChatScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const uid = useUID()
  const { isPremium } = useApp()

  const [club, setClub] = useState<Club | null>(null)
  const [raw, setRaw] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<ClubMember[]>([])
  const [tick, setTick] = useState(0)

  const [showMembers, setShowMembers] = useState(false)
  const [blockTarget, setBlockTarget] = useState<ClubMember | null>(null)
  const [reportTarget, setReportTarget] = useState<ClubMember | null>(null)
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null)
  const [typingUIDs, setTypingUIDs] = useState<string[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    try {
      return listenToClub(id, setClub)
    } catch {
      setClub(null)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    try {
      return listenToMessages(`clubs/${id}/messages`, setRaw)
    } catch {
      setRaw([])
    }
  }, [id])

  useEffect(() => {
    if (!id || !uid) return
    return listenToTyping(`clubs/${id}`, uid, setTypingUIDs)
  }, [id, uid])

  const memberIDsKey = club?.memberIDs.join(',') ?? ''
  useEffect(() => {
    if (!memberIDsKey) { setMembers([]); return }
    let alive = true
    fetchMembers(memberIDsKey.split(','))
      .then((m) => { if (alive) setMembers(m) })
      .catch(() => { if (alive) setMembers([]) })
    return () => { alive = false }
  }, [memberIDsKey])

  // Scheduled messages become visible when due, so re-filter on a timer.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  const visible = useMemo(
    () => applySchedule(raw, uid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, uid, tick],
  )

  const capped = !isPremium && visible.length > FreePlanLimits.clubMessageHistory
  const shown = capped ? visible.slice(-FreePlanLimits.clubMessageHistory) : visible

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [shown.length])

  const isMember = !!club && club.memberIDs.includes(uid)
  const isAdmin = !!club && club.adminIDs.includes(uid)
  const canSend = isMember && (!club?.isAdminControlled || isAdmin)
  const lockedText = !isMember
    ? 'Join this club to see and send messages.'
    : 'This is an admin-controlled club — only admins can post.'

  const senderName = (senderID: string) => members.find((m) => m.id === senderID)?.name ?? 'Someone'

  async function handleSend(fields: Record<string, unknown>, preview: string, scheduledFor: Date | null) {
    if (!id) return
    // Club messages are deliberately not metered against the free-plan quota.
    try {
      await sendClub(id, uid, fields, preview, scheduledFor)
    } catch {
      // swallow — the listener reflects whatever actually landed
    }
  }

  async function handleVote(m: ChatMessage, option: string) {
    try { await votePoll(`clubs/${id}/messages`, m.id, uid, option) } catch { /* ignore */ }
  }

  async function handleRSVP(m: ChatMessage, attending: boolean) {
    try { await rsvp(`clubs/${id}/messages`, m.id, uid, attending) } catch { /* ignore */ }
    if (attending && m.eventDate) downloadICS(m.eventTitle ?? 'Event', m.eventLocation ?? '', m.eventDate)
  }

  async function handleReact(m: ChatMessage, emoji: string) {
    try { await toggleReaction(`clubs/${id}/messages`, m.id, uid, emoji) } catch { /* ignore */ }
  }

  function handleReply(m: ChatMessage) {
    setReplyingTo({
      id: m.id, senderID: m.senderID,
      senderName: m.senderID === uid ? 'You' : senderName(m.senderID),
      preview: m.text || m.kind,
    })
  }

  async function handleDelete(m: ChatMessage) {
    try { await deleteMessage(`clubs/${id}/messages`, m.id) } catch { /* ignore */ }
  }

  function memberActions(m: ClubMember) {
    const items: { label: string; icon?: ReactNode; destructive?: boolean; onClick: () => void }[] = []
    if (isAdmin) {
      items.push({
        label: 'Kick', icon: <Icon.Logout size={16} />, destructive: true,
        onClick: () => { void kick(id, m.id).catch(() => {}) },
      })
      items.push({
        label: 'Ban', icon: <Icon.Ban size={16} />, destructive: true,
        onClick: () => { void ban(id, m.id).catch(() => {}) },
      })
    }
    items.push({ label: 'Block', icon: <Icon.Shield size={16} />, onClick: () => setBlockTarget(m) })
    items.push({ label: 'Report', icon: <Icon.Flag size={16} />, onClick: () => setReportTarget(m) })
    return items
  }

  async function confirmBlock() {
    const target = blockTarget
    setBlockTarget(null)
    if (!target) return
    try { await block(uid, target.id) } catch { /* ignore */ }
  }

  async function handleReport(reason: ReportReason, details: string) {
    const target = reportTarget
    setReportTarget(null)
    if (!target || !club) return
    try {
      await submitReport({
        reporterID: uid,
        reportedID: target.id,
        reason,
        context: `club:${club.name}`,
        details,
      })
    } catch { /* ignore */ }
  }

  return (
    <AppLayout bleed>
      <div className="absolute inset-0 flex flex-col">
        <header className="shrink-0 h-14 border-b border-line bg-dusk-900/85 backdrop-blur">
          <div className="h-full max-w-[820px] mx-auto px-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (id ? navigate(`/clubs/${id}`) : navigate(-1))}
              aria-label="Back to club"
              className="w-8 h-8 -ml-1.5 shrink-0 grid place-items-center rounded-lg text-ink-2
                         hover:bg-ink/[0.05] hover:text-ink transition-colors"
            >
              <Icon.ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-display font-medium">{club?.name ?? 'Club'}</h1>
              {club && <div className="font-mono text-[11px] text-ink-3">{club.memberIDs.length} members</div>}
            </div>
            <button
              type="button"
              onClick={() => setShowMembers(true)}
              aria-label="Members"
              className="w-8 h-8 grid place-items-center rounded-lg text-ink-2
                         hover:bg-ink/[0.05] hover:text-ink transition-colors"
            >
              <Icon.Users size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-4 py-4">
          <div className="max-w-[820px] mx-auto space-y-2">
            {capped && (
              <div className="border border-line rounded-field px-3.5 py-2.5 bg-dusk-900 flex items-start gap-2.5 mb-3">
                <Icon.History size={16} className="text-ink-3 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-medium text-ink">Free plan shows the last 15 messages</div>
                  <div className="text-[12.5px] text-ink-2 mt-0.5">
                    Upgrade to Premium to see this club's full message history.
                  </div>
                </div>
              </div>
            )}
            {!club ? (
              <div className="flex justify-center py-10"><Spinner className="text-azure" /></div>
            ) : (
              shown.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  myUID={uid}
                  onVote={handleVote}
                  onRSVP={handleRSVP}
                  onReact={handleReact}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  senderLabel={senderName(m.senderID)}
                />
              ))
            )}
            {typingUIDs.length > 0 && (
              <div className="flex items-center gap-2 px-0.5">
                <div className="font-mono text-[11px] text-ink-3">
                  {typingUIDs.map((u) => senderName(u)).join(', ')}
                </div>
                <div className="flex items-center gap-1 bg-dusk-800 rounded-full px-3 py-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-pulse"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0">
          {canSend ? (
            <Composer
              onSend={handleSend}
              videoPathPrefix={`club_${id}`}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onTyping={(typing) => { if (id) void setTyping(`clubs/${id}`, uid, typing) }}
            />
          ) : (
            <div className="border-t border-line px-4 py-3">
              <div className="max-w-[820px] mx-auto rounded-field border border-dashed border-line bg-dusk-900 px-3.5 py-2.5 flex items-center gap-2.5">
                <Icon.Lock size={16} className="text-ink-3 shrink-0" />
                <span className="text-[13.5px] text-ink-2">{lockedText}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={showMembers} onClose={() => setShowMembers(false)} title="Members">
        {members.length === 0 ? (
          <p className="text-[14px] text-ink-2">No members yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {members.map((m) => {
              const isMe = m.id === uid
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <ProfileAvatar photoURL={m.photoURL} size={32} name={m.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-display font-medium text-ink truncate">{m.name}</span>
                      {club?.adminIDs.includes(m.id) && <StatusPill tone="muted" label="Admin" />}
                    </div>
                    {isMe && <div className="font-mono text-[11px] text-ink-3 mt-0.5">You</div>}
                  </div>
                  {!isMe && (
                    <Menu
                      trigger={
                        <span className="w-8 h-8 grid place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.05] hover:text-ink transition-colors">
                          <Icon.More size={18} />
                        </span>
                      }
                      items={memberActions(m)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Sheet>

      <AlertDialog
        open={!!blockTarget}
        title={`Block ${blockTarget?.name ?? ''}?`}
        message="You won't see each other in the feed, messages, or clubs anymore."
        confirmLabel="Block"
        destructive
        onConfirm={confirmBlock}
        onCancel={() => setBlockTarget(null)}
      />

      <ReportSheet
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        reportedName={reportTarget?.name ?? ''}
        onSubmit={handleReport}
      />
    </AppLayout>
  )
}

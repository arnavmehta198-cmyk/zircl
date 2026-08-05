import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getUser } from '../services/users'
import { AppLayout } from '../components/Shell'
import { AlertDialog, Menu, ProfileAvatar, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import MessageBubble from '../components/chat/MessageBubble'
import Composer from '../components/chat/Composer'
import ReportSheet from '../components/ReportSheet'
import { useUID } from '../context/AppContext'
import {
  applySchedule, conversationID, deleteMessage, listenToMessages, listenToTyping, loadIdentity,
  markRead, rsvp, sendDirect, setTyping, toggleReaction, votePoll,
} from '../services/messaging'
import { isMutualFollow } from '../services/friendship'
import { block, submitReport } from '../services/social'
import { downloadICS } from '../services/calendar'
import type { ChatMessage, ReplyRef, ReportReason } from '../lib/types'

export default function ChatScreen() {
  const uid = useUID()
  const navigate = useNavigate()
  const { otherID = '' } = useParams()

  const convoID = useMemo(() => (uid && otherID ? conversationID(uid, otherID) : ''), [uid, otherID])
  const path = convoID ? `conversations/${convoID}/messages` : ''

  const [other, setOther] = useState({ name: 'Chat', photoURL: null as string | null })
  const [raw, setRaw] = useState<ChatMessage[]>([])
  const [visible, setVisible] = useState<ChatMessage[]>([])
  const [canMessage, setCanMessage] = useState<boolean | null>(null)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [limitHit, setLimitHit] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)

  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!otherID) return
    let cancelled = false
    getUser(otherID)
      .then((u) => {
        if (cancelled) return
        setOther({ name: u?.name ?? 'Someone', photoURL: u?.photoURL ?? null })
      })
    return () => { cancelled = true }
  }, [otherID])

  useEffect(() => {
    if (!uid || !otherID) return
    let cancelled = false
    isMutualFollow(uid, otherID)
      .then((ok) => { if (!cancelled) setCanMessage(ok) })
      .catch(() => { if (!cancelled) setCanMessage(false) })
    return () => { cancelled = true }
  }, [uid, otherID])

  useEffect(() => {
    if (!path) return
    return listenToMessages(path, setRaw)
  }, [path])

  useEffect(() => {
    if (!convoID || !uid) return
    return listenToTyping(`conversations/${convoID}`, uid, (uids) => setOtherTyping(uids.length > 0))
  }, [convoID, uid])

  // Scheduled messages become visible when due, so re-filter on a timer.
  useEffect(() => {
    if (!uid) return
    setVisible(applySchedule(raw, uid))
    const t = setInterval(() => setVisible(applySchedule(raw, uid)), 5000)
    return () => clearInterval(t)
  }, [raw, uid])

  useEffect(() => {
    if (!convoID || !uid) return
    markRead(convoID, uid).catch(() => { /* non-fatal */ })
  }, [convoID, uid])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [visible.length])

  const handleSend = useCallback(async (
    fields: Record<string, unknown>, preview: string, scheduledFor: Date | null,
  ) => {
    if (!uid || !otherID) return
    const me = await loadIdentity(uid)
    const result = await sendDirect(
      {
        myUID: uid, myName: me.name, myPhotoURL: me.photoURL,
        otherID, otherName: other.name, otherPhotoURL: other.photoURL,
      },
      fields, preview, scheduledFor,
    )
    if (result === 'limit') setLimitHit(true)
  }, [uid, otherID, other.name, other.photoURL])

  const onVote = (m: ChatMessage, option: string) => {
    if (path) votePoll(path, m.id, uid, option).catch(() => { /* ignore */ })
  }

  const onRSVP = (m: ChatMessage, attending: boolean) => {
    if (path) rsvp(path, m.id, uid, attending).catch(() => { /* ignore */ })
    if (attending && m.eventDate) downloadICS(m.eventTitle ?? 'Event', m.eventLocation ?? '', m.eventDate)
  }

  const onReact = (m: ChatMessage, emoji: string) => {
    if (path) toggleReaction(path, m.id, uid, emoji).catch(() => { /* ignore */ })
  }

  const onReply = (m: ChatMessage) => {
    setReplyingTo({ id: m.id, senderID: m.senderID, senderName: m.senderID === uid ? 'You' : other.name, preview: m.text || m.kind })
  }

  const onDelete = (m: ChatMessage) => {
    if (path) deleteMessage(path, m.id).catch(() => { /* ignore */ })
  }

  const onReport = (reason: ReportReason, details: string) => {
    submitReport({ reporterID: uid, reportedID: otherID, reason, context: 'conversation', details })
      .catch(() => { /* ignore */ })
  }

  return (
    <AppLayout bleed>
      <div className="absolute inset-0 flex flex-col">
        <header className="shrink-0 h-14 border-b border-line bg-dusk-900/85 backdrop-blur">
          <div className="h-full max-w-[820px] mx-auto px-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/messages')}
              aria-label="Back to messages"
              className="w-8 h-8 -ml-1.5 shrink-0 grid place-items-center rounded-lg text-ink-2
                         hover:bg-ink/[0.05] hover:text-ink transition-colors"
            >
              <Icon.ChevronLeft size={18} />
            </button>
            <ProfileAvatar photoURL={other.photoURL} size={32} name={other.name} />
            <h1 className="flex-1 min-w-0 truncate text-[15px] font-display font-medium">{other.name}</h1>
            <Menu
              trigger={
                <span className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink transition-colors">
                  <Icon.More size={18} />
                </span>
              }
              items={[
                {
                  label: `Block ${other.name}`,
                  icon: <Icon.Ban size={17} />,
                  destructive: true,
                  onClick: () => setConfirmBlock(true),
                },
                {
                  label: `Report ${other.name}`,
                  icon: <Icon.Flag size={17} />,
                  destructive: true,
                  onClick: () => setReporting(true),
                },
              ]}
            />
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll">
          <div className="max-w-[820px] mx-auto px-4 py-6 flex flex-col gap-3">
            {visible.map((m) => (
              <MessageBubble
                key={m.id} message={m} myUID={uid} onVote={onVote} onRSVP={onRSVP}
                onReact={onReact} onReply={onReply} onDelete={onDelete}
              />
            ))}
            {otherTyping && (
              <div className="flex items-center gap-2 px-0.5">
                <ProfileAvatar photoURL={other.photoURL} size={22} name={other.name} />
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
            <div ref={bottom} />
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-dusk-950">
          <div className="max-w-[820px] mx-auto px-4 py-3">
            {canMessage === null ? (
              <div className="flex justify-center py-3"><Spinner className="text-azure" /></div>
            ) : canMessage ? (
              <Composer
                onSend={handleSend}
                videoPathPrefix={convoID}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                onTyping={(typing) => { if (convoID) void setTyping(`conversations/${convoID}`, uid, typing) }}
              />
            ) : (
              <div className="rounded-card border border-dashed border-line bg-dusk-900 flex flex-col items-center text-center gap-2 px-6 py-8">
                <Icon.Lock size={24} className="text-ink-3" />
                <p className="text-[14px] text-ink-2">You can only message people who follow you back.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/person/${otherID}`)}
                  className="text-[13.5px] font-semibold text-ink underline underline-offset-2 hover:text-azure-hover"
                >
                  View profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmBlock}
        title={`Block ${other.name}?`}
        message="They won't be able to message you, and you won't see each other in the app."
        confirmLabel="Block"
        destructive
        onCancel={() => setConfirmBlock(false)}
        onConfirm={() => {
          setConfirmBlock(false)
          block(uid, otherID).catch(() => { /* ignore */ }).finally(() => navigate('/messages'))
        }}
      />

      <ReportSheet
        open={reporting}
        onClose={() => setReporting(false)}
        reportedName={other.name}
        onSubmit={onReport}
      />

      <AlertDialog
        open={limitHit}
        title="Daily limit reached"
        message="Free plan is limited to 5 private messages a day. Upgrade to Premium for unlimited messaging."
        confirmLabel="See Premium"
        cancelLabel="Not now"
        onConfirm={() => { setLimitHit(false); navigate('/premium') }}
        onCancel={() => setLimitHit(false)}
      />
    </AppLayout>
  )
}

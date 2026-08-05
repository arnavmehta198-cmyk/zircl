import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SubPage } from '../components/Shell'
import { Button, ProfileAvatar, Spinner, StatusPill } from '../components/ui'
import { Icon } from '../components/icons'
import { useUID } from '../context/AppContext'
import type { ChatMessage, Club, ClubMember } from '../lib/types'
import { hobbyIcon } from '../lib/hobbies'
import { join, leave, listenToClub, fetchMembers } from '../services/clubs'
import { applySchedule, listenToMessages } from '../services/messaging'
import { timeOnly } from '../lib/format'

const KIND_PREVIEW: Partial<Record<ChatMessage['kind'], string>> = {
  photo: 'Sent a photo', gif: 'Sent a GIF', sticker: 'Sent a sticker', video: 'Sent a video',
  file: 'Sent an attachment', audio: 'Sent a voice message', poll: 'Started a poll',
}

/** Read-only, live-scrolling preview of the club's group chat — sits on the right on desktop. */
function ChatPreview({ clubID, members, uid }: { clubID: string; members: ClubMember[]; uid: string }) {
  const navigate = useNavigate()
  const [raw, setRaw] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clubID) return
    try {
      return listenToMessages(`clubs/${clubID}/messages`, setRaw)
    } catch {
      setRaw([])
    }
  }, [clubID])

  const visible = useMemo(() => applySchedule(raw, uid), [raw, uid])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length])

  const nameFor = (senderID: string) => members.find((m) => m.id === senderID)?.name ?? 'Someone'
  const photoFor = (senderID: string) => members.find((m) => m.id === senderID)?.photoURL ?? null

  return (
    <div className="card flex flex-col h-[560px] overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Icon.Messages size={16} className="text-ink-2" />
          <span className="text-[14px] font-display font-medium">Group chat</span>
        </div>
        <span className="font-mono text-[11px] text-ink-3">LIVE</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-4 py-3 space-y-3">
        {visible.length === 0 ? (
          <div className="h-full grid place-items-center text-center px-4">
            <div>
              <Icon.Messages size={22} className="text-ink-3 mx-auto" />
              <p className="text-[13px] text-ink-2 mt-2">No messages yet — be the first to say hi.</p>
            </div>
          </div>
        ) : (
          visible.slice(-40).map((m) => (
            <div key={m.id} className="flex items-start gap-2">
              <ProfileAvatar photoURL={photoFor(m.senderID)} size={26} name={nameFor(m.senderID)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[12.5px] font-medium text-ink truncate">{nameFor(m.senderID)}</span>
                  <span className="font-mono text-[10.5px] text-ink-3 shrink-0">{timeOnly(m.timestamp)}</span>
                </div>
                <div className="text-[13px] text-ink-2 truncate">
                  {KIND_PREVIEW[m.kind] ?? m.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-line shrink-0">
        <Button
          variant="secondary" fullWidth size="sm"
          icon={<Icon.Messages size={15} />}
          onClick={() => navigate(`/clubs/${clubID}/chat`)}
        >
          Open full chat
        </Button>
      </div>
    </div>
  )
}

export default function ClubDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const uid = useUID()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    try {
      return listenToClub(id, setClub)
    } catch {
      setClub(null)
    }
  }, [id])

  const memberIDsKey = club?.memberIDs.join(',') ?? ''
  useEffect(() => {
    if (!memberIDsKey) { setMembers([]); return }
    let alive = true
    fetchMembers(memberIDsKey.split(','))
      .then((m) => { if (alive) setMembers(m) })
      .catch(() => { if (alive) setMembers([]) })
    return () => { alive = false }
  }, [memberIDsKey])

  const isMember = !!club && club.memberIDs.includes(uid)
  const isBanned = !!club && club.bannedIDs.includes(uid)

  async function toggleMembership() {
    if (!club || busy) return
    setBusy(true)
    try {
      if (isMember) await leave(club.id, uid)
      else await join(club.id, uid)
    } catch {
      // live listener keeps the UI truthful if the write failed
    } finally {
      setBusy(false)
    }
  }

  if (!club) {
    return (
      <SubPage title="Club" wide>
        <div className="flex justify-center py-12"><Spinner className="text-azure" /></div>
      </SubPage>
    )
  }

  return (
    <SubPage title={club.name} wide>
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-card bg-dusk-800 border border-line grid place-items-center text-ink-2 shrink-0"
              aria-hidden
            >
              {hobbyIcon(club.hobby, 24)}
            </div>
            <div className="min-w-0">
              <h3 className="text-[20px] font-display font-medium truncate">{club.hobby}</h3>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="font-mono text-[13px] text-ink-2">
                  {club.memberIDs.length} members
                </span>
                <StatusPill
                  tone={club.isAdminControlled ? 'muted' : 'azure'}
                  label={club.isAdminControlled ? 'Admin controlled' : 'Free for all'}
                />
              </div>
            </div>
          </div>

          {isBanned ? (
            <div className="rounded-card border border-line bg-danger/[0.08] p-5 flex items-start gap-3">
              <Icon.Ban size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-[14.5px] text-ink-2">You've been banned from this club.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="lg"
                variant={isMember ? 'secondary' : 'primary'}
                onClick={toggleMembership}
                isLoading={busy}
                icon={isMember ? <Icon.Check size={17} /> : undefined}
              >
                {isMember ? 'Joined' : 'Join club'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                icon={<Icon.Messages size={17} />}
                onClick={() => navigate(`/clubs/${club.id}/chat`)}
              >
                Open group chat
              </Button>
            </div>
          )}
        </div>

        {!isBanned && (
          <div className="lg:sticky lg:top-6">
            <ChatPreview clubID={club.id} members={members} uid={uid} />
          </div>
        )}
      </div>
    </SubPage>
  )
}

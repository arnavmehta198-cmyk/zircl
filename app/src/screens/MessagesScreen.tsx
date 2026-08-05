import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AppLayout, SearchInput } from '../components/Shell'
import { Button, EASE, PaletteEmptyState, ProfileAvatar, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import { NoMutualState } from '../components/NoMutualState'
import { useUID } from '../context/AppContext'
import { listenToConversations } from '../services/messaging'
import { blockedEitherDirection } from '../services/social'
import { timeOnly } from '../lib/format'
import type { Conversation } from '../lib/types'

function NoMessagesState({ onGoToFeed }: { onGoToFeed: () => void }) {
  return (
    <div className="rounded-card border border-line bg-ivory shadow-card py-14 px-6 flex justify-center">
      <NoMutualState
        title="No messages yet"
        description="Follow people from the Feed — once they follow back, you can message each other."
        action={<Button variant="rose" onClick={onGoToFeed}>Go to Feed</Button>}
      />
    </div>
  )
}

export default function MessagesScreen() {
  const uid = useUID()
  const navigate = useNavigate()
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!uid) return
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const blocked = await blockedEitherDirection(uid)
      if (cancelled) return
      unsub = listenToConversations(uid, blocked, (c) => { setConvos(c); setLoading(false) })
    })()
    return () => { cancelled = true; unsub?.() }
  }, [uid])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return convos
    return convos.filter((c) =>
      (c.otherName ?? '').toLowerCase().includes(q) || (c.lastMessage ?? '').toLowerCase().includes(q))
  }, [convos, query])

  return (
    <AppLayout
      title="Messages"
      wide
      actions={
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search conversations"
          className="w-[220px] lg:w-[280px]"
        />
      }
    >
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-azure w-7 h-7" /></div>
      ) : convos.length === 0 ? (
        <NoMessagesState onGoToFeed={() => navigate('/feed')} />
      ) : filtered.length === 0 ? (
        <PaletteEmptyState
          icon={<Icon.Search size={28} />}
          title="No matches found"
          description={`Your search "${query.trim()}" didn't match any conversations. Please try again.`}
          action={<Button variant="plum-outline" onClick={() => setQuery('')}>Clear search</Button>}
        />
      ) : (
        <div className="card overflow-hidden divide-y divide-line">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }}
            >
              <button
                type="button"
                onClick={() => navigate(`/chat/${c.otherID}`)}
                className="w-full h-[72px] text-left flex items-center gap-3 px-4 hover:bg-dusk-800 transition-colors duration-150"
              >
                <ProfileAvatar photoURL={c.otherPhotoURL} size={40} name={c.otherName} />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[16px] text-ink truncate font-medium">
                    {c.otherName}
                  </div>
                  <div className="text-[13.5px] text-ink-2 truncate mt-0.5">{c.lastMessage}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-ink-3">{timeOnly(c.lastTimestamp)}</span>
                  {c.isUnread && <span className="w-2 h-2 rounded-full bg-azure" aria-label="Unread" />}
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}

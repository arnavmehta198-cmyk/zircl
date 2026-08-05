import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform,
} from 'motion/react'
import { AppLayout, NotificationsButton, SearchInput } from '../components/Shell'
import { AlertDialog, Button, PaletteEmptyState, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import MatchCard from '../components/MatchCard'
import NotificationsSheet from '../components/NotificationsSheet'
import { useUID } from '../context/AppContext'
import type { FeedUser } from '../lib/types'
import { FeedDeck, filterDeck } from '../services/feed'
import { sendFollowRequest } from '../services/friendship'
import { recordViewed } from '../services/prefs'

const COMMIT_DISTANCE = 120
const COMMIT_VELOCITY = 500
const EXIT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }

/** Rotated mono stamp that fades in with drag distance. */
function Stamp({ label, tone, side, opacity }: {
  label: string; tone: 'signal' | 'muted'; side: 'left' | 'right'
  opacity: ReturnType<typeof useTransform<number, number>>
}) {
  return (
    <motion.div
      style={{ opacity }}
      className={`absolute top-8 ${side === 'left' ? 'left-6 -rotate-[8deg]' : 'right-6 rotate-[8deg]'}
                  font-mono font-medium text-[26px] tracking-[0.08em] px-3.5 py-1 rounded-lg border-2 pointer-events-none
                  bg-deep/40 backdrop-blur-sm
                  ${tone === 'signal' ? 'text-signal border-signal' : 'text-white/80 border-white/60'}`}
    >
      {label}
    </motion.div>
  )
}

function SwipeCard({ user, onCommit, shouldIgnoreTap, exitDir }: {
  user: FeedUser
  onCommit: (liked: boolean) => void
  shouldIgnoreTap: () => boolean
  exitDir: React.MutableRefObject<1 | -1>
}) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], reduce ? [0, 0] : [-6, 6])
  const followOpacity = useTransform(x, [60, 160], [0, 1])
  const passOpacity = useTransform(x, [-60, -160], [0, 1])

  return (
    <motion.div
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      style={{ x, rotate }}
      initial={{ scale: 0.97, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1, transition: { duration: 0.15 } }}
      exit={{
        x: exitDir.current * 600,
        opacity: 0,
        transition: reduce ? { duration: 0.15 } : EXIT_SPRING,
      }}
      onDragEnd={(_, info) => {
        const gone = Math.abs(info.offset.x) > COMMIT_DISTANCE || Math.abs(info.velocity.x) > COMMIT_VELOCITY
        if (gone) onCommit(info.offset.x > 0 || (info.offset.x === 0 && info.velocity.x > 0))
      }}
    >
      <MatchCard
        user={user}
        shouldIgnoreTap={shouldIgnoreTap}
        onPass={() => onCommit(false)}
        onFollow={() => onCommit(true)}
      />
      <Stamp label="FOLLOW" tone="signal" side="left" opacity={followOpacity} />
      <Stamp label="PASS" tone="muted" side="right" opacity={passOpacity} />
    </motion.div>
  )
}

export default function FeedScreen() {
  const uid = useUID()
  const navigate = useNavigate()
  const deckRef = useRef<FeedDeck | null>(null)
  const [deck, setDeck] = useState<FeedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [notifications, setNotifications] = useState(false)
  const [limitAlert, setLimitAlert] = useState(false)

  const exitDir = useRef<1 | -1>(1)
  const draggedRef = useRef(false)
  const viewStart = useRef<Date>(new Date())
  const busy = useRef(false)

  useEffect(() => {
    if (!uid) return
    let alive = true
    const d = new FeedDeck(uid)
    deckRef.current = d
    void (async () => {
      try { await d.bootstrap() } catch { /* degrade to whatever bootstrap salvaged */ }
      if (!alive) return
      setDeck([...d.deck])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [uid])

  const visibleDeck = useMemo(() => filterDeck(deck, search), [deck, search])
  const top = visibleDeck[0] ?? null
  const second = visibleDeck[1] ?? null
  const third = visibleDeck[2] ?? null

  // Fresh dwell clock + recently-viewed entry every time a new card surfaces.
  useEffect(() => {
    if (!top) return
    viewStart.current = new Date()
    if (!uid) return
    recordViewed(uid, {
      id: top.id,
      name: top.name,
      age: top.age,
      photoURL: top.imageURLs[0] ?? null,
      bio: top.bio,
      hobbies: top.hobbies,
    })
  }, [top?.id, uid])

  const commit = useCallback((user: FeedUser, liked: boolean) => {
    if (busy.current) return
    busy.current = true
    exitDir.current = liked ? 1 : -1

    const dwell = Math.max(0, (Date.now() - viewStart.current.getTime()) / 1000)

    // Pop immediately — AnimatePresence animates the removed card off-screen.
    const d = deckRef.current
    if (d) {
      d.pop(user, dwell, liked)
      setDeck([...d.deck])
    }

    if (liked) {
      void sendFollowRequest(uid, user.id)
        .then((ok) => {
          if (ok) return
          // Daily limit hit — the follow was never sent, so the person must
          // not be lost. Put the card back on top of the deck (undoing the
          // optimistic pop; AnimatePresence animates it back in) and explain.
          const dk = deckRef.current
          if (dk) {
            dk.deck = [user, ...dk.deck.filter((u) => u.id !== user.id)]
            setDeck([...dk.deck])
          }
          setLimitAlert(true)
        })
        .catch(() => {})
    }

    window.setTimeout(() => { busy.current = false }, 200)
  }, [uid])

  // Click handlers inside the card must not fire when the pointer-up ended a drag.
  const shouldIgnoreTap = useCallback(() => {
    const dragged = draggedRef.current
    draggedRef.current = false
    return dragged || busy.current
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return // arrows move the search caret
      if (!top || busy.current) return
      if (e.key === 'ArrowLeft') commit(top, false)
      else if (e.key === 'ArrowRight') commit(top, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [top, commit])

  const actions = (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search people"
        className="w-[180px] sm:w-[260px]"
      />
      <NotificationsButton onClick={() => setNotifications(true)} />
    </>
  )

  return (
    <AppLayout
      title="Feed"
      description="Swipe right to send a follow request."
      wide
      ambient
      actions={actions}
    >
      {loading ? (
        <div className="py-24 flex justify-center">
          <Spinner className="text-azure w-8 h-8" />
        </div>
      ) : !top ? (
        search.trim() ? (
          <PaletteEmptyState
            icon={<Icon.Search size={28} />}
            title="No matches found"
            description={`Your search "${search.trim()}" didn't match anyone nearby. Try a different name, hobby, or location.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="plum-outline" onClick={() => setSearch('')}>Clear search</Button>
                <Button variant="plum-outline" icon={<Icon.Sliders size={16} />} onClick={() => navigate('/profile/algorithm')}>
                  Adjust algorithm
                </Button>
              </div>
            }
          />
        ) : (
          <PaletteEmptyState
            icon={<Icon.Users size={28} />}
            title="You're all caught up"
            description="Check back soon for new people near you."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="rose" onClick={() => navigate('/clubs')}>Browse clubs</Button>
                <Button variant="plum-outline" onClick={() => navigate('/profile/algorithm')}>
                  Adjust algorithm
                </Button>
              </div>
            }
          />
        )
      ) : (
        <div className="w-full max-w-[900px] mx-auto">
          <div
            className="relative w-full h-[min(680px,calc(100dvh-260px))] min-h-[420px] lg:h-[520px]"
            onPointerMove={() => { draggedRef.current = true }}
            onPointerDown={() => { draggedRef.current = false }}
          >
            {/* Stacked deck behind the top card */}
            {third && (
              <div className="absolute inset-0 scale-[0.96] translate-y-4 pointer-events-none opacity-70">
                <MatchCard key={third.id} user={third} interactive={false} />
              </div>
            )}
            {second && (
              <div className="absolute inset-0 scale-[0.98] translate-y-2 pointer-events-none opacity-85">
                <MatchCard key={second.id} user={second} interactive={false} />
              </div>
            )}

            <AnimatePresence>
              <SwipeCard
                key={top.id}
                user={top}
                exitDir={exitDir}
                shouldIgnoreTap={shouldIgnoreTap}
                onCommit={(liked) => commit(top, liked)}
              />
            </AnimatePresence>
          </div>

          {/* Arrow-key hint only makes sense where a keyboard is likely present. */}
          <p className="hidden [@media(pointer:fine)]:block font-mono text-[12px] text-ink-3 mt-4 text-center lg:text-left">
            TIP: ← AND → ALSO WORK
          </p>
        </div>
      )}

      <NotificationsSheet open={notifications} onClose={() => setNotifications(false)} uid={uid} />

      <AlertDialog
        open={limitAlert}
        title="Daily limit reached"
        message="Free plan is limited to 3 follow requests a day. Upgrade to Premium for unlimited follows."
        confirmLabel="See Premium"
        onConfirm={() => { setLimitAlert(false); navigate('/premium') }}
        cancelLabel="Not now"
        onCancel={() => setLimitAlert(false)}
      />
    </AppLayout>
  )
}

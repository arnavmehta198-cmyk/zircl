import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { SubPage } from '../components/Shell'
import { AccentBadge, ProfileAvatar, Spinner } from '../components/ui'
import { NoMutualState } from '../components/NoMutualState'
import { Icon } from '../components/icons'
import { useUID } from '../context/AppContext'
import { getUsers } from '../services/users'
import { friendIDs, pendingOutgoing } from '../services/friendship'

interface Person { id: string; name: string; photoURL: string | null }

async function hydrate(ids: string[]): Promise<Person[]> {
  const users = await getUsers(ids)
  const byID = new Map(users.map((u) => [u.id, u]))
  return ids.map((id) => {
    const u = byID.get(id)
    return { id, name: u?.name || 'Zircl user', photoURL: u?.photoURL ?? null }
  })
}

function PersonRow({ person, index = 0, pending = false, onClick }: {
  person: Person; index?: number; pending?: boolean; onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="w-full text-left flex items-center gap-3.5 px-4 h-[72px] hover:bg-blush/30 transition-colors"
    >
      <ProfileAvatar photoURL={person.photoURL} size={44} name={person.name} />
      <span className="text-[14.5px] font-medium text-plum truncate flex-1">{person.name}</span>
      {pending && <AccentBadge label="Pending" />}
      <Icon.ChevronRight size={16} className="text-plum/30 shrink-0" />
    </motion.button>
  )
}

function Section({ title, count, emptyState, children }: {
  title: string; count: number; emptyState: ReactNode; children: ReactNode
}) {
  return (
    <section>
      <h3 className="text-[15px] font-display font-extrabold text-plum mb-3">
        {title} <span className="text-plum/40 font-medium">({count})</span>
      </h3>
      {count === 0 ? (
        <div className="rounded-card border border-plum/15 bg-ivory shadow-card py-10 px-6 flex justify-center">
          {emptyState}
        </div>
      ) : (
        <div className="rounded-card border border-plum/15 bg-ivory shadow-card overflow-hidden divide-y divide-plum/10">
          {children}
        </div>
      )}
    </section>
  )
}

export default function FriendsScreen() {
  const navigate = useNavigate()
  const uid = useUID()

  const [friends, setFriends] = useState<Person[]>([])
  const [outgoing, setOutgoing] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [ids, pending] = await Promise.all([
          friendIDs(uid).catch(() => [] as string[]),
          pendingOutgoing(uid).catch(() => [] as { id: string; to: string }[]),
        ])
        const [f, o] = await Promise.all([hydrate(ids), hydrate(pending.map((p) => p.to))])
        if (!cancelled) { setFriends(f); setOutgoing(o) }
      } catch {
        if (!cancelled) { setFriends([]); setOutgoing([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [uid])

  return (
    <SubPage title="Friends" wide backTo="/profile">
      {loading ? (
        <div className="py-16 flex justify-center"><Spinner className="text-rose w-7 h-7" /></div>
      ) : (
        <div className="space-y-8">
          <Section
            title="Friends"
            count={friends.length}
            emptyState={
              <NoMutualState
                title="No friends yet"
                description="People you both follow show up here."
              />
            }
          >
            {friends.map((p, i) => (
              <PersonRow key={p.id} person={p} index={i} onClick={() => navigate(`/person/${p.id}`)} />
            ))}
          </Section>

          <Section
            title="Requests you sent"
            count={outgoing.length}
            emptyState={<p className="text-[13.5px] text-plum/50">No pending requests right now.</p>}
          >
            {outgoing.map((p, i) => (
              <PersonRow key={p.id} person={p} index={i} pending onClick={() => navigate(`/person/${p.id}`)} />
            ))}
          </Section>
        </div>
      )}
    </SubPage>
  )
}

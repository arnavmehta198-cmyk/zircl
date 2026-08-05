import { useEffect, useState } from 'react'
import { getUser } from '../services/users'
import { Button, PaletteSheet, ProfileAvatar, Spinner } from './ui'
import { Icon } from './icons'
import { acceptRequest, declineRequest, pendingIncoming } from '../services/friendship'

interface Row { id: string; from: string; name: string; photoURL: string | null }

/** A quiet bell in a blush circle — "nothing waiting for you" isn't the same
 *  concept as NoMutualState's "you two aren't connected yet", so it gets its
 *  own illustration rather than reusing that one. */
function NoNotificationsState() {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-20 h-20 rounded-full bg-blush grid place-items-center">
        <Icon.Bell size={28} className="text-rose/70" />
      </div>
      <h3 className="text-[17px] font-display font-extrabold text-plum mt-4">No notifications</h3>
      <p className="text-[14px] text-plum/60 mt-1.5">Friend requests will show up here.</p>
    </div>
  )
}

export default function NotificationsSheet({ open, onClose, uid }: {
  open: boolean; onClose: () => void; uid: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !uid) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const pending = await pendingIncoming(uid)
        const hydrated = await Promise.all(pending.map(async (p): Promise<Row> => {
          const u = await getUser(p.from)
          return { id: p.id, from: p.from, name: u?.name ?? 'Someone', photoURL: u?.photoURL ?? null }
        }))
        if (!cancelled) setRows(hydrated)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, uid])

  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  return (
    <PaletteSheet open={open} onClose={onClose} title="Notifications">
      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="text-rose" /></div>
      ) : rows.length === 0 ? (
        <NoNotificationsState />
      ) : (
        <div className="rounded-card border border-plum/10 bg-white overflow-hidden divide-y divide-plum/10">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blush/30 transition-colors">
              <ProfileAvatar photoURL={r.photoURL} size={40} name={r.name} />
              <div className="flex-1 min-w-0 text-[14.5px] font-medium text-plum truncate">{r.name}</div>
              <Button
                variant="rose"
                size="sm"
                onClick={() => { void acceptRequest(r.id); remove(r.id) }}
                className="shrink-0"
              >
                Accept
              </Button>
              <Button
                variant="plum-outline"
                size="sm"
                onClick={() => { void declineRequest(r.id); remove(r.id) }}
                icon={<Icon.Close size={16} />}
                ariaLabel="Decline"
                className="shrink-0 px-2"
              />
            </div>
          ))}
        </div>
      )}
    </PaletteSheet>
  )
}

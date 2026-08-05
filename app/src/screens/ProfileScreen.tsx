import { useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout, NotificationsButton } from '../components/Shell'
import { AlertDialog, Button, HobbyTag, ProfileAvatar, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import NotificationsSheet from '../components/NotificationsSheet'
import { useApp, useUID } from '../context/AppContext'
import { deleteAccount } from '../services/account'

interface RowIconProps { className?: string; size?: number }

function SettingsRow({
  icon: I, label, onClick, destructive = false,
}: { icon: ComponentType<RowIconProps>; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 h-[52px] transition-colors
                  ${destructive ? 'hover:bg-danger/[0.08]' : 'hover:bg-blush/40'}`}
    >
      <I size={18} className={destructive ? 'text-danger' : 'text-plum/60'} />
      <span className={`text-[14.5px] font-medium flex-1 ${destructive ? 'text-danger' : 'text-plum'}`}>
        {label}
      </span>
      <Icon.ChevronRight size={16} className="text-plum/30 shrink-0" />
    </button>
  )
}

/** Blush/rose fallback for the hero avatar when there's no photo and no name
 *  to derive an initial from — more personality than a bare gray person icon. */
function EmptyAvatar({ size }: { size: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-blush ring-1 ring-rose/20 grid place-items-center"
    >
      <Icon.Profile size={size * 0.42} className="text-rose/70" />
    </div>
  )
}

export default function ProfileScreen() {
  const navigate = useNavigate()
  const uid = useUID()
  const { profile, signOut } = useApp()

  const [showNotifications, setShowNotifications] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // deleteAccount() resolves to a string when the Auth record itself survived.
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  async function runDelete() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const notice = await deleteAccount()
      if (notice) setDeleteNotice(notice)
    } catch {
      setDeleteNotice('Something went wrong deleting your account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout title="Profile" wide actions={<NotificationsButton onClick={() => setShowNotifications(true)} />}>
      <div className="space-y-5">
        <div className="rounded-card border border-plum/15 bg-ivory shadow-card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {profile.photoURL || profile.name ? (
            <ProfileAvatar photoURL={profile.photoURL} size={88} name={profile.name ?? undefined} />
          ) : (
            <EmptyAvatar size={88} />
          )}
          <div className="min-w-0">
            <h3 className="text-[22px] font-display font-extrabold text-plum truncate">
              {profile.name ?? 'Your profile'}
            </h3>
            {profile.hobbies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.hobbies.map((h) => (
                  <HobbyTag key={h} label={h} />
                ))}
              </div>
            )}
          </div>
          <Button
            variant="rose"
            size="md"
            onClick={() => navigate('/profile/edit')}
            className="sm:ml-auto shrink-0 self-start sm:self-center"
          >
            Edit profile
          </Button>
        </div>

        <div className="rounded-card border border-plum/15 bg-ivory shadow-card overflow-hidden divide-y divide-plum/10">
          <SettingsRow icon={Icon.Profile} label="Edit profile & hobbies" onClick={() => navigate('/profile/edit')} />
          <SettingsRow icon={Icon.Sliders} label="Customize algorithm" onClick={() => navigate('/profile/algorithm')} />
          <SettingsRow icon={Icon.History} label="Recently viewed" onClick={() => navigate('/profile/recent')} />
          <SettingsRow icon={Icon.Users} label="Friends & requests" onClick={() => navigate('/profile/friends')} />
          <SettingsRow icon={Icon.Schedule} label="Schedule an event" onClick={() => navigate('/schedule')} />
          <SettingsRow icon={Icon.Activities} label="Map" onClick={() => navigate('/activities')} />
          <SettingsRow icon={Icon.Premium} label="Premium" onClick={() => navigate('/premium')} />
          <SettingsRow icon={Icon.Shield} label="Privacy policy" onClick={() => navigate('/privacy')} />
          <SettingsRow icon={Icon.Logout} label="Sign out" onClick={() => { void signOut() }} />
          <SettingsRow icon={Icon.Trash} label="Delete account" destructive onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <AlertDialog
        open={confirmDelete}
        title="Delete account?"
        message="This permanently deletes your Zircl account and profile. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { void runDelete() }}
        onCancel={() => setConfirmDelete(false)}
      />

      <AlertDialog
        open={deleteNotice !== null}
        title="Almost done"
        message={deleteNotice ?? undefined}
        confirmLabel="OK"
        onConfirm={() => setDeleteNotice(null)}
      />

      {deleting && (
        <div className="fixed inset-0 z-[80] bg-page/90 flex flex-col items-center justify-center gap-4">
          <Spinner className="text-rose w-8 h-8" />
          <p className="text-[15px] text-ink-2">Deleting your account…</p>
        </div>
      )}

      <NotificationsSheet open={showNotifications} onClose={() => setShowNotifications(false)} uid={uid} />
    </AppLayout>
  )
}

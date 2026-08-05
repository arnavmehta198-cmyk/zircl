import { type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useApp } from '../context/AppContext'
import { ProfileAvatar, OrbitMark, EASE } from './ui'
import { Icon } from './icons'
import StaggeredMenu, { type StaggeredMenuItem } from './StaggeredMenu'
import { RevealHeading, RevealSub } from './RevealText'

export const TABS = [
  { path: '/feed', title: 'Feed', Icon: Icon.Feed },
  { path: '/clubs', title: 'Clubs', Icon: Icon.Clubs },
  { path: '/messages', title: 'Messages', Icon: Icon.Messages },
  { path: '/schedule', title: 'Schedule', Icon: Icon.Schedule },
  { path: '/calendar', title: 'Calendar', Icon: Icon.Calendar },
  { path: '/activities', title: 'Map', Icon: Icon.Activities },
  { path: '/profile', title: 'Profile', Icon: Icon.Profile },
  { path: '/premium', title: 'Premium', Icon: Icon.Premium },
] as const

// The 5 items that fit a phone-width tab bar; the rest (/schedule, /activities,
// /premium) are reachable on phones via navigation rows on the Profile screen.
const MOBILE_TABS = TABS.filter((t) =>
  ['/feed', '/clubs', '/messages', '/calendar', '/profile'].includes(t.path))

const STAGGERED_ITEMS: StaggeredMenuItem[] = TABS.map((t) => ({
  label: t.title,
  ariaLabel: `Go to ${t.title}`,
  link: t.path,
}))

function Wordmark() {
  return (
    <Link to="/feed" className="flex items-center gap-2.5 group">
      <OrbitMark size={28} />
      <span className="text-[18px] font-display font-extrabold tracking-tight">Zircl</span>
    </Link>
  )
}


/** Profile + sign-out row shown at the foot of the staggered menu panel. */
function MenuFooter() {
  const { profile, signOut } = useApp()
  return (
    <div className="flex items-center gap-2.5">
      <ProfileAvatar photoURL={profile.photoURL} size={36} name={profile.name ?? undefined} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink truncate">{profile.name ?? 'Your profile'}</div>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className="w-9 h-9 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors"
      >
        <Icon.Logout size={18} />
      </button>
    </div>
  )
}

/** Bottom tab bar, phones only. */
function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav className="sm:hidden shrink-0 min-h-16 pb-[env(safe-area-inset-bottom)] bg-dusk-900 border-t border-line flex items-stretch">
      {MOBILE_TABS.map(({ path, title, Icon: I }) => {
        const active = pathname === path || pathname.startsWith(path + '/')
        return (
          <Link
            key={path}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium
              ${active ? 'text-azure' : 'text-ink-3'}`}
          >
            <I size={20} />
            {title}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * App chrome. `wide` opts a page out of the reading-width container (the map
 * and chat threads want the full column).
 */
export function AppLayout({
  title, description, actions, children, wide = false, bleed = false, ambient = false,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
  bleed?: boolean
  ambient?: boolean
}) {
  const { pathname } = useLocation()

  return (
    <div className="h-full flex">
      {/* StaggeredMenu is the single nav trigger from `sm` up (phones get the
          bottom tab bar instead — see TabBar). It used to only mount at `lg`,
          with a second, separate hamburger+drawer covering the sm-lg gap;
          that was two different menu controls for two ranges. StaggeredMenu's
          own CSS already had a sub-640px layout (an unused code path), so
          widening its range to `sm` removes the duplicate control instead of
          reinventing one. */}
      <div className="hidden sm:block">
        <StaggeredMenu
          isFixed
          position="right"
          items={STAGGERED_ITEMS}
          displayItemNumbering
          menuButtonColor="#152219"
          openMenuButtonColor="#1866DE"
          changeMenuColorOnOpen
          colors={['#EAF0EC', '#1866DE']}
          accentColor="#1866DE"
          logo={<Wordmark />}
          headerExtra={actions}
          footer={<MenuFooter />}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Phones only — StaggeredMenu carries the logo/actions from `sm` up. */}
        <header className="sm:hidden min-h-14 shrink-0 border-b border-line bg-dusk-900/80 backdrop-blur flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <Wordmark />
          <div className="flex-1" />
          {actions}
        </header>

        <main className={`flex-1 min-h-0 sm:pt-[calc(64px+env(safe-area-inset-top))] ${bleed ? 'relative' : 'overflow-y-auto'} ${ambient ? 'ambient' : ''}`}>
          {bleed ? children : (
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className={`px-4 lg:px-8 py-6 lg:py-8 mx-auto ${wide ? 'max-w-[1200px]' : 'max-w-[760px]'}`}
            >
              {title && (
                <div className="mb-6 lg:mb-8">
                  <h2 className="text-[28px] font-display font-extrabold tracking-[-0.01em] leading-[1.15]">
                    <RevealHeading>{title}</RevealHeading>
                  </h2>
                  {description && (
                    <RevealSub className="text-[15px] text-ink-2 mt-2 max-w-[62ch] leading-relaxed">
                      {description}
                    </RevealSub>
                  )}
                </div>
              )}
              {children}
            </motion.div>
          )}
        </main>

        <TabBar />
      </div>
    </div>
  )
}

/** Sub-page chrome: a real "Back" affordance, not a bare iOS chevron. */
export function SubPage({
  title, description, children, backTo, wide = false, hideTitle = false,
}: {
  title: string; description?: string; children: ReactNode; backTo?: string; wide?: boolean
  /** The destination screen carries its own name treatment (e.g. overlaid on a photo) — skip the page's own h2. */
  hideTitle?: boolean
}) {
  const navigate = useNavigate()
  return (
    <AppLayout wide={wide}>
      <button
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        className="inline-flex items-center gap-1 h-9 px-2 -ml-2 rounded-lg text-[13.5px] font-medium text-ink-2
                   hover:text-ink hover:bg-ink/[0.04] transition-colors mb-5"
      >
        <Icon.ChevronLeft size={16} /> Back
      </button>
      {!hideTitle && (
        <div className="mb-6 lg:mb-8">
          <h2 className="text-[28px] font-display font-extrabold tracking-[-0.01em] leading-[1.15]">
            <RevealHeading>{title}</RevealHeading>
          </h2>
          {description && (
            <RevealSub className="text-[15px] text-ink-2 mt-1.5 max-w-[62ch] leading-relaxed">
              {description}
            </RevealSub>
          )}
        </div>
      )}
      {children}
    </AppLayout>
  )
}

/** Inline search input for page toolbars. */
export function SearchInput({
  value, onChange, placeholder = 'Search…', className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-3 rounded-field border border-line bg-dusk-800 text-[14px] text-ink
                   placeholder:text-ink-3 outline-none focus:border-azure focus:ring-[3px] focus:ring-azure-dim transition"
      />
    </div>
  )
}

export function NotificationsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Notifications"
      className="w-9 h-9 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink transition-colors"
    >
      <Icon.Bell size={19} />
    </button>
  )
}

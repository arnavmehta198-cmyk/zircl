import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { SubPage } from '../components/Shell'
import { PaletteEmptyState, ProfileAvatar } from '../components/ui'
import { Icon } from '../components/icons'
import { useUID } from '../context/AppContext'
import { loadRecentlyViewed } from '../services/prefs'

export default function RecentlyViewedScreen() {
  const navigate = useNavigate()
  const uid = useUID()
  const people = useMemo(() => (uid ? loadRecentlyViewed(uid) : []), [uid])

  return (
    <SubPage title="Recently viewed" wide backTo="/profile">
      {people.length === 0 ? (
        <PaletteEmptyState
          icon={<Icon.History size={28} />}
          title="Nothing yet"
          description="Profiles you view in your feed show up here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <button
                type="button"
                onClick={() => navigate(`/person/${p.id}`)}
                className="w-full rounded-card border border-plum/15 bg-ivory shadow-card
                           p-3.5 flex items-center gap-3 text-left transition-colors
                           hover:bg-blush/30 active:bg-blush/50"
              >
                <ProfileAvatar photoURL={p.photoURL} size={40} name={p.name} />
                <span className="text-[14.5px] font-medium text-plum truncate flex-1">
                  {p.name}<span className="text-plum/50">, {p.age}</span>
                </span>
                <Icon.ChevronRight size={16} className="text-plum/30 shrink-0" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </SubPage>
  )
}

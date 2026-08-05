import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AppLayout, NotificationsButton, SearchInput } from '../components/Shell'
import { AccentBadge, Button, Chip, EASE, PaletteEmptyState, SectionCard, Sheet, Spinner, TextField } from '../components/ui'
import { Icon } from '../components/icons'
import NotificationsSheet from '../components/NotificationsSheet'
import { useUID } from '../context/AppContext'
import { HOBBIES, type Club } from '../lib/types'
import { hobbyIcon } from '../lib/hobbies'
import { loadAlgorithmSettings } from '../services/prefs'
import { createClub, fetchAll, recommend } from '../services/clubs'

function ClubCard({ club, index, onClick }: { club: Club; index: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: EASE }}
      className="text-left rounded-card border border-line bg-ivory p-4 flex items-start gap-3
                 shadow-card transition-shadow duration-150 hover:shadow-pop"
    >
      <div
        className="w-10 h-10 rounded-full bg-blush grid place-items-center text-blush-text shrink-0"
        aria-hidden
      >
        {hobbyIcon(club.hobby, 18)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start flex-wrap gap-x-2 gap-y-1.5">
          <div className="font-display font-extrabold text-[16px] text-plum min-w-0 break-words flex-1">{club.name}</div>
          {!club.isAdminControlled && <AccentBadge label="Free for all" />}
        </div>
        <div className="font-mono text-[12.5px] text-plum/60 truncate mt-1">
          {club.hobby} · {club.memberIDs.length} {club.memberIDs.length === 1 ? 'member' : 'members'}
        </div>
      </div>
    </motion.button>
  )
}

/** Shown appended to a sparse grid so a short list still reads as intentional. */
function FindMoreCard({ onClick, index }: { onClick: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: EASE }}
      className="text-left rounded-card border border-dashed border-rose/40 bg-rose/[0.04] p-4 flex items-center gap-3
                 transition-colors duration-150 hover:bg-rose/[0.08]"
    >
      <div className="w-10 h-10 rounded-full bg-rose/15 grid place-items-center text-rose shrink-0" aria-hidden>
        <Icon.Plus size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-extrabold text-[16px] text-rose">Find more clubs</div>
        <div className="font-mono text-[12.5px] text-plum/60 mt-1">Start one around your own hobby</div>
      </div>
    </motion.button>
  )
}

function ClubGrid({ clubs, onOpen, onCreate, prompt = false }: {
  clubs: Club[]; onOpen: (id: string) => void; onCreate: () => void; prompt?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {clubs.map((c, i) => (
        <ClubCard key={c.id} club={c} index={i} onClick={() => onOpen(c.id)} />
      ))}
      {prompt && clubs.length < 4 && <FindMoreCard index={clubs.length} onClick={onCreate} />}
    </div>
  )
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="eyebrow">{title}</h3>
      {count !== undefined && <span className="font-mono text-[11px] text-ink-3">{count}</span>}
    </div>
  )
}

export default function ClubsScreen() {
  const navigate = useNavigate()
  const uid = useUID()

  const [search, setSearch] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [clubs, setClubs] = useState<Club[]>([])
  const [recommended, setRecommended] = useState<Club[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [hobby, setHobby] = useState<string | null>(null)
  const [adminControlled, setAdminControlled] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!uid) return
    setLoadingRecs(true)
    try {
      const all = await fetchAll()
      setClubs(all)
      try {
        setRecommended(await recommend(uid, all, loadAlgorithmSettings().prioritizeHobbies))
      } catch {
        setRecommended([])
      }
    } catch {
      setClubs([])
      setRecommended([])
    } finally {
      setLoadingRecs(false)
    }
  }, [uid])

  useEffect(() => { void load() }, [load])

  const query = search.trim().toLowerCase()
  const results = query
    ? clubs.filter((c) => c.name.toLowerCase().includes(query) || c.hobby.toLowerCase().includes(query))
    : []

  const canCreate = name.trim().length > 0 && !!hobby

  async function submit() {
    if (!canCreate || !hobby || saving) return
    setSaving(true)
    try {
      const id = await createClub({ name, hobby, creatorID: uid, isAdminControlled: adminControlled })
      setCreating(false)
      setName('')
      setHobby(null)
      setAdminControlled(false)
      void load()
      navigate(`/clubs/${id}`)
    } catch {
      // a failed write leaves the sheet open so the user can retry
    } finally {
      setSaving(false)
    }
  }

  const openClub = (id: string) => navigate(`/clubs/${id}`)

  return (
    <AppLayout
      title="Clubs"
      description="Groups built around a shared hobby."
      wide
      actions={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search clubs"
            className="w-[150px] sm:w-[180px] lg:w-[260px]"
          />
          {/* Icon-only below sm — "New club" + the search field + bell don't
              all fit alongside a text label at phone widths. */}
          <Button icon={<Icon.Plus size={16} />} onClick={() => setCreating(true)} ariaLabel="New club">
            <span className="hidden sm:inline">New club</span>
          </Button>
          <NotificationsButton onClick={() => setShowNotifications(true)} />
        </>
      }
    >
      {query ? (
        <section>
          <SectionHeading title="Results" count={results.length} />
          {results.length === 0 ? (
            <PaletteEmptyState
              icon={<Icon.Search size={28} />}
              title="No clubs found"
              description={`Your search "${search.trim()}" did not match any clubs. Please try again.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="plum-outline" onClick={() => setSearch('')}>Clear search</Button>
                  <Button variant="rose" icon={<Icon.Plus size={16} />} onClick={() => setCreating(true)}>New club</Button>
                </div>
              }
            />
          ) : (
            <ClubGrid clubs={results} onOpen={openClub} onCreate={() => setCreating(true)} />
          )}
        </section>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeading title="All clubs" count={clubs.length} />
            {clubs.length === 0 ? (
              <PaletteEmptyState
                icon={<Icon.Clubs size={28} />}
                title="No clubs yet"
                description="Be the first to create one."
                action={
                  <Button variant="rose" icon={<Icon.Plus size={16} />} onClick={() => setCreating(true)}>
                    New club
                  </Button>
                }
              />
            ) : (
              <ClubGrid clubs={clubs} onOpen={openClub} onCreate={() => setCreating(true)} prompt />
            )}
          </section>

          <section>
            <SectionHeading title="Recommended for you" count={loadingRecs ? undefined : recommended.length} />
            {loadingRecs ? (
              <div className="py-8 flex justify-center"><Spinner className="text-azure" /></div>
            ) : recommended.length === 0 ? (
              <PaletteEmptyState
                icon={<Icon.Premium size={28} />}
                title="Nothing to recommend yet"
                description="Join a few hobbies and follow friends to get personalized club picks."
              />
            ) : (
              <ClubGrid clubs={recommended} onOpen={openClub} onCreate={() => setCreating(true)} />
            )}
          </section>
        </div>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New club"
        footer={
          <Button size="sm" onClick={submit} disabled={!canCreate} isLoading={saving}>
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          <SectionCard title="Club name">
            <TextField value={name} onChange={setName} placeholder="e.g. Sunset Tennis Crew" />
          </SectionCard>

          <SectionCard title="What’s it about?" subtitle="Pick the hobby this club is centered on.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HOBBIES.map((h) => (
                <Chip
                  key={h}
                  label={h}
                  icon={hobbyIcon(h)}
                  selected={hobby === h}
                  onClick={() => setHobby(h)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Group chat" subtitle="Choose who can post in the club’s group chat.">
            <div className="flex gap-1 bg-dusk-950 border border-line rounded-field p-1">
              {[
                { label: 'Free for all', value: false },
                { label: 'Admin controlled', value: true },
              ].map((opt) => {
                const on = adminControlled === opt.value
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setAdminControlled(opt.value)}
                    aria-pressed={on}
                    className={`flex-1 h-8 rounded-[8px] text-[13.5px] font-medium transition-colors duration-150
                      ${on ? 'bg-dusk-800 text-ink' : 'text-ink-2 hover:text-ink'}`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[12.5px] text-ink-3 mt-2">
              {adminControlled
                ? 'Only you (the creator) can post. Great for announcements.'
                : 'Everyone in the club can post messages.'}
            </p>
          </SectionCard>
        </div>
      </Sheet>

      <NotificationsSheet open={showNotifications} onClose={() => setShowNotifications(false)} uid={uid} />
    </AppLayout>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Flame } from 'lucide-react'
import { AppLayout } from '../components/Shell'
import {
  AlertDialog, Button, Chip, EASE, Field, PaletteSheet, ProfileAvatar,
  SectionCard, Sheet, Spinner, TextField, Toast,
} from '../components/ui'
import { Icon } from '../components/icons'
import { useUID } from '../context/AppContext'
import { auth } from '../lib/firebase'
import { getUser, getUsers } from '../services/users'
import { HOBBIES } from '../lib/types'
import { hobbyIcon } from '../lib/hobbies'
import { friendIDs } from '../services/friendship'
import { createEvent } from '../services/events'
import { hasNearbySupport, nearbyForHobby, type NearbyPlace } from '../services/places'
import { milesBetween } from '../lib/format'
import DateTimePicker from '../components/DateTimePicker'
import SpecularButton from '../components/SpecularButton'
import { NoMutualState } from '../components/NoMutualState'

const STEP_LABELS = ['Your info', 'Hobby', 'Location', 'When', 'Invite'] as const

/** Word-by-word reveal for a step's question. Fast (~320ms total), reduced-motion collapses to instant. */
function StepReveal({ text }: { text: string }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  return (
    <h3 className="text-[22px] sm:text-[24px] font-display font-extrabold text-ink leading-snug">
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-1 mr-[0.28em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.32, delay: i * 0.035, ease: EASE }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </h3>
  )
}

/** Thin bar + step count — the wizard's progress indicator. */
function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-3">
          Step {step + 1} of {total}
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-3">
          {STEP_LABELS[step]}
        </span>
      </div>
      <div className="h-1 rounded-full bg-dusk-800 overflow-hidden">
        <motion.div
          className="h-full bg-rose rounded-full"
          animate={{ width: `${((step + 1) / total) * 100}%` }}
          transition={{ duration: 0.25, ease: EASE }}
        />
      </div>
    </div>
  )
}

interface Friend { id: string; name: string; photoURL: string | null }

interface Place { id: string; label: string; distanceMiles: number | null }

/** Shared entrance for result/suggestion panels. */
const PANEL_MOTION = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.15, ease: EASE },
} as const

const ROW = `w-full text-left rounded-field border border-line bg-dusk-900 hover:bg-dusk-800
             p-3 transition-colors duration-150`

function PickerRow({ placeholder, value, onClick }: {
  placeholder: string; value: string | null; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-11 px-3.5 rounded-field border border-line bg-dusk-800 text-left
                 flex items-center gap-2 transition-colors hover:border-line-hi"
    >
      <span className={`text-[14.5px] truncate flex-1 ${value ? 'text-ink' : 'text-ink-3'}`}>
        {value ?? placeholder}
      </span>
      <Icon.ChevronRight size={16} className="text-ink-3 shrink-0" />
    </button>
  )
}

function ResultButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ROW} text-[14px] leading-snug`}
    >
      {children}
    </button>
  )
}

function NearbyRow({ place, onClick }: { place: NearbyPlace; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ROW} flex items-center justify-between gap-3`}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink truncate">{place.name}</div>
        {place.address && <div className="text-[12.5px] text-ink-2 truncate mt-0.5">{place.address}</div>}
      </div>
      <div className="shrink-0 font-mono text-[12.5px] text-azure whitespace-nowrap">
        {place.distanceMiles < 1 ? '< 1 MI' : `${place.distanceMiles.toFixed(1)} MI`}
      </div>
    </button>
  )
}

function LocationSheet({ open, onClose, onPick, hobby, userCoords }: {
  open: boolean; onClose: () => void; onPick: (name: string) => void
  hobby: string | null
  userCoords: { lat: number; lon: number } | null
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)

  const [nearby, setNearby] = useState<NearbyPlace[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyFailed, setNearbyFailed] = useState(false)

  // Nearby suggestions for the chosen hobby, centred on the user's own
  // location — fetched once when the sheet opens, not on every keystroke.
  useEffect(() => {
    if (!open || !hobby || !userCoords) { setNearby([]); return }
    if (!hasNearbySupport(hobby)) { setNearby([]); return }
    let alive = true
    const ctl = new AbortController()
    setNearbyLoading(true)
    setNearbyFailed(false)
    nearbyForHobby(hobby, userCoords.lat, userCoords.lon, ctl.signal)
      .then((places) => { if (alive) setNearby(places) })
      .catch((e) => {
        if (!alive || (e as { name?: string }).name === 'AbortError') return
        setNearbyFailed(true)
      })
      .finally(() => { if (alive) setNearbyLoading(false) })
    return () => { alive = false; ctl.abort() }
  }, [open, hobby, userCoords])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); setSearching(false); setFailed(false); return }

    const ctl = new AbortController()
    setSearching(true)
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          // Prefer results near the user, but don't hard-exclude everything
          // else — `bounded=1` would drop a query like "tennis courts in san
          // diego" entirely when the user isn't near San Diego. Omitting it
          // keeps viewbox as a ranking bias, not a filter.
          const viewboxParams = userCoords
            ? `&viewbox=${userCoords.lon - 0.3},${userCoords.lat + 0.3},${userCoords.lon + 0.3},${userCoords.lat - 0.3}`
            : ''
          // Nominatim's query parser silently returns zero results for
          // natural-language connectors like " in "/" near "/" at " (e.g.
          // "tennis courts in san diego" — drop them and it finds "Tennis
          // Courts, San Diego" fine).
          const cleanedTerm = term.replace(/\s+(in|near|at)\s+/gi, ' ')
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(cleanedTerm)}${viewboxParams}`,
            { signal: ctl.signal, headers: { Accept: 'application/json' } },
          )
          if (!res.ok) throw new Error(String(res.status))
          const json: unknown = await res.json()
          const rows = Array.isArray(json) ? json : []
          setResults(rows.map((r, i) => {
            const o = r as { place_id?: number | string; display_name?: string; lat?: string; lon?: string }
            return {
              id: String(o.place_id ?? i),
              label: String(o.display_name ?? ''),
              distanceMiles: userCoords && o.lat && o.lon
                ? milesBetween(userCoords.lat, userCoords.lon, Number(o.lat), Number(o.lon))
                : null,
            }
          }).filter((p) => p.label))
          setFailed(false)
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') return
          setResults([])
          setFailed(true)
        } finally {
          setSearching(false)
        }
      })()
    }, 400)

    return () => { ctl.abort(); window.clearTimeout(t) }
  }, [q, userCoords])

  const choose = (name: string) => {
    onPick(name)
    setQ('')
    setResults([])
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Location">
      <div className="space-y-4">
        <TextField
          value={q}
          onChange={setQ}
          placeholder="Or search for a specific place"
          icon={<Icon.Search size={16} />}
        />

        {!q.trim() && (
          <div className="space-y-2">
            {!userCoords ? (
              <p className="text-[13px] text-ink-2">
                Turn on location in your profile to get nearby suggestions — search for a place instead.
              </p>
            ) : !hobby ? (
              <p className="text-[13px] text-ink-2">Pick a hobby above to see nearby suggestions.</p>
            ) : !hasNearbySupport(hobby) ? (
              <p className="text-[13px] text-ink-2">Search for a place — nearby suggestions aren’t set up for {hobby} yet.</p>
            ) : nearbyLoading ? (
              <div className="flex justify-center py-6"><Spinner className="text-azure" /></div>
            ) : nearbyFailed ? (
              <p className="text-[13px] text-ink-2">Couldn’t load nearby places — search for one instead.</p>
            ) : nearby.length === 0 ? (
              <p className="text-[13px] text-ink-2">No {hobby.toLowerCase()} spots found nearby — search for a place instead.</p>
            ) : (
              <motion.div {...PANEL_MOTION} className="space-y-2">
                <div className="eyebrow">[ Nearby — for {hobby} ]</div>
                <div className="flex flex-col gap-2">
                  {nearby.map((p) => (
                    <NearbyRow key={p.id} place={p} onClick={() => choose(p.address ? `${p.name}, ${p.address}` : p.name)} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {q.trim() && (
          failed ? (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-2">
                Couldn’t search right now — type a place name instead
              </p>
              <ResultButton onClick={() => choose(q.trim())}>Use “{q.trim()}”</ResultButton>
            </div>
          ) : searching ? (
            <div className="flex justify-center py-6"><Spinner className="text-azure" /></div>
          ) : results.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-2">No places found.</p>
              <ResultButton onClick={() => choose(q.trim())}>Use “{q.trim()}”</ResultButton>
            </div>
          ) : (
            <motion.div {...PANEL_MOTION} className="flex flex-col gap-2">
              {results.map((p) => (
                <ResultButton key={p.id} onClick={() => choose(p.label)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-ink">{p.label}</span>
                    {p.distanceMiles !== null && (
                      <span className="shrink-0 font-mono text-[12.5px] text-azure whitespace-nowrap">
                        {p.distanceMiles < 1 ? '< 1 MI' : `${p.distanceMiles.toFixed(1)} MI`}
                      </span>
                    )}
                  </div>
                </ResultButton>
              ))}
            </motion.div>
          )
        )}
      </div>
    </Sheet>
  )
}

function FriendSheet({ open, onClose, uid, onPick }: {
  open: boolean; onClose: () => void; uid: string; onPick: (f: Friend) => void
}) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open || !uid) return
    let alive = true
    setLoading(true)
    void (async () => {
      try {
        const ids = await friendIDs(uid)
        const users = await getUsers(ids)
        if (!alive) return
        setFriends(
          users.map((u) => ({ id: u.id, name: u.name || 'Someone', photoURL: u.photoURL }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      } catch {
        if (alive) setFriends([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open, uid])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return term ? friends.filter((f) => f.name.toLowerCase().includes(term)) : friends
  }, [friends, q])

  return (
    <PaletteSheet open={open} onClose={onClose} title="Who’s going?">
      {loading ? (
            <div className="flex justify-center py-8"><Spinner className="text-rose" /></div>
          ) : friends.length === 0 ? (
            <NoMutualState
              title="No friends yet"
              description="Follow each other with someone before scheduling an event."
            />
          ) : (
            <div className="space-y-3">
              <TextField value={q} onChange={setQ} placeholder="Search friends" icon={<Icon.Search size={16} />} />
              {visible.length === 0 ? (
                <p className="text-[13px] text-plum/60">No friends match that name.</p>
              ) : (
                <motion.div {...PANEL_MOTION} className="rounded-card border border-plum/10 bg-white overflow-hidden divide-y divide-plum/10">
                  {visible.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { onPick(f); setQ(''); onClose() }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                 hover:bg-blush/40 active:bg-blush/70"
                    >
                      <ProfileAvatar photoURL={f.photoURL} size={36} name={f.name} />
                      <span className="text-[14.5px] font-medium text-plum truncate">{f.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          )}
    </PaletteSheet>
  )
}

export default function ScheduleScreen() {
  const uid = useUID()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  // Deep-linked from the Map's "Schedule here" — hobby and location arrive
  // pre-picked; date/time, phone, and the friend to invite still need you.
  const [hobby, setHobby] = useState<string | null>(() => {
    const h = searchParams.get('hobby')
    return h && (HOBBIES as readonly string[]).includes(h) ? h : null
  })
  const [location, setLocation] = useState<string | null>(() => searchParams.get('location'))
  const [invitee, setInvitee] = useState<Friend | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)

  const [step, setStep] = useState(0)
  const stepContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!uid) return
    void (async () => {
      const d = await getUser(uid)
      if (d?.latitude != null && d?.longitude != null) {
        setUserCoords({ lat: d.latitude, lon: d.longitude })
      }
      // Prefill from the profile — only fields the user hasn't touched yet.
      const fullName = (d?.name ?? '').trim()
      if (fullName) {
        const spaceAt = fullName.indexOf(' ')
        const first = spaceAt === -1 ? fullName : fullName.slice(0, spaceAt)
        const last = spaceAt === -1 ? '' : fullName.slice(spaceAt + 1).trim()
        setFirstName((cur) => cur || first)
        if (last) setLastName((cur) => cur || last)
      }
      const authEmail = auth.currentUser?.email
      if (authEmail) setEmail((cur) => cur || authEmail)
    })()
  }, [uid])

  const defaultWhen = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(18, 0, 0, 0) // tomorrow at 6:00 PM — a plausible default meetup time
    return d
  }, [])

  const [eventWhen, setEventWhen] = useState(defaultWhen)

  const [locationSheet, setLocationSheet] = useState(false)
  const [friendSheet, setFriendSheet] = useState(false)
  const [sending, setSending] = useState(false)
  const [limitAlert, setLimitAlert] = useState(false)
  const [errorAlert, setErrorAlert] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(false), 2000)
    return () => window.clearTimeout(t)
  }, [toast])

  const ready = Boolean(
    firstName.trim() && lastName.trim() && email.trim() && phone.trim() &&
    hobby && location && invitee,
  )

  // Per-step validation — replaces the old single combined "Add your info, a
  // hobby, a location, and a friend" message with a message scoped to
  // whichever step is actually on screen.
  const infoComplete = Boolean(firstName.trim() && lastName.trim() && email.trim() && phone.trim())
  const stepValid = [infoComplete, !!hobby, !!location, true, !!invitee]
  const stepMessage = [
    'Add your name, email, and phone',
    'Choose a hobby',
    'Choose a location',
    '',
    'Choose a friend to invite',
  ]

  const lastStep = STEP_LABELS.length - 1
  const onContinue = () => {
    if (!stepValid[step]) return
    if (step === lastStep) { void submit(); return }
    setStep((s) => Math.min(s + 1, lastStep))
  }

  // Auto-focus the step's first input/button once its reveal animation starts.
  useEffect(() => {
    const t = window.setTimeout(() => {
      stepContentRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    }, 80)
    return () => window.clearTimeout(t)
  }, [step])

  const submit = async () => {
    if (!ready || !hobby || !location || !invitee || sending) return
    const when = eventWhen
    setSending(true)
    try {
      const ok = await createEvent({
        creatorID: uid,
        creatorFirstName: firstName,
        creatorLastName: lastName,
        creatorEmail: email,
        creatorPhone: phone,
        inviteeID: invitee.id,
        inviteeName: invitee.name,
        hobby,
        locationName: location,
        date: when,
      })
      if (!ok) { setLimitAlert(true); return }
      setHobby(null)
      setLocation(null)
      setInvitee(null)
      setStep(0)
      setToast(true)
    } catch {
      setErrorAlert(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout
      title="Schedule an event"
      description="Send an invite — accepted events land on both calendars."
      wide
    >
      <div className="max-w-[560px] mx-auto">
        <StepProgress step={step} total={STEP_LABELS.length} />

        <div className="flex items-center gap-1 mb-4 h-7">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg text-[13px] font-medium text-ink-2
                         hover:text-ink hover:bg-ink/[0.04] transition-colors"
            >
              <Icon.ChevronLeft size={15} /> Back
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            ref={stepContentRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {step === 0 && (
              <SectionCard title="Your info" icon={<Icon.Profile size={18} />}>
                <div className="flex flex-col gap-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextField label="First name" value={firstName} onChange={setFirstName} placeholder="Alex" autoComplete="given-name" />
                    <TextField label="Last name" value={lastName} onChange={setLastName} placeholder="Rivera" autoComplete="family-name" />
                  </div>
                  <TextField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
                  <TextField label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" type="tel" inputMode="tel" autoComplete="tel" />
                </div>
              </SectionCard>
            )}

            {step === 1 && (
              <div>
                <StepReveal text="What’s the hobby?" />
                <div className="flex items-center gap-2 mt-1 mb-4 text-ink-2">
                  {hobby ? hobbyIcon(hobby, 16) : <Flame size={16} strokeWidth={1.75} aria-hidden />}
                  <span className="text-[13.5px]">Pick the activity for this event.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HOBBIES.map((h) => (
                    <Chip
                      key={h}
                      label={h}
                      icon={hobbyIcon(h)}
                      selected={hobby === h}
                      onClick={() => setHobby(h)}
                      accent="rose"
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <StepReveal text="Where should you meet?" />
                <div className="mt-4">
                  <PickerRow
                    placeholder="Choose a mutual location"
                    value={location}
                    onClick={() => setLocationSheet(true)}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <StepReveal text="When works?" />
                <div className="mt-4">
                  <DateTimePicker value={eventWhen} onChange={setEventWhen} minDate={new Date()} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <StepReveal text="Who do you want to invite?" />
                <div className="mt-4">
                  <PickerRow
                    placeholder="Choose a friend"
                    value={invitee?.name ?? null}
                    onClick={() => setFriendSheet(true)}
                  />
                </div>

                <div className="mt-5 rounded-card border border-line bg-dusk-800 px-4 py-3.5 flex flex-col gap-1.5">
                  <div className="eyebrow mb-1">Summary</div>
                  <div className="text-[13.5px] text-ink-2 flex items-center gap-2">
                    {hobby ? hobbyIcon(hobby, 14) : <Flame size={14} strokeWidth={1.75} aria-hidden />}
                    {hobby ?? '—'}
                  </div>
                  <div className="text-[13.5px] text-ink-2 flex items-center gap-2">
                    <Icon.Pin size={14} className="shrink-0" />
                    <span className="truncate">{location ?? '—'}</span>
                  </div>
                  <div className="text-[13.5px] text-ink-2 flex items-center gap-2">
                    <Icon.Clock size={14} className="shrink-0" />
                    {eventWhen.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                    {eventWhen.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center gap-3">
          <SpecularButton onClick={onContinue} disabled={!stepValid[step] || (step === lastStep && sending)}>
            {sending && step === lastStep ? 'Sending…' : step === lastStep ? 'Send invite' : 'Continue'}
          </SpecularButton>
          {!stepValid[step] && stepMessage[step] && (
            <span className="text-[13px] text-ink-2">{stepMessage[step]}</span>
          )}
        </div>
      </div>

      <LocationSheet
        open={locationSheet}
        onClose={() => setLocationSheet(false)}
        onPick={setLocation}
        hobby={hobby}
        userCoords={userCoords}
      />

      <FriendSheet
        open={friendSheet}
        onClose={() => setFriendSheet(false)}
        uid={uid}
        onPick={setInvitee}
      />

      <AlertDialog
        open={limitAlert}
        title="Monthly limit reached"
        message="Free plan is limited to 2 scheduled events a month. Upgrade to Premium for unlimited scheduling."
        confirmLabel="See Premium"
        cancelLabel="Not now"
        onConfirm={() => { setLimitAlert(false); navigate('/premium') }}
        onCancel={() => setLimitAlert(false)}
      />

      <AlertDialog
        open={errorAlert}
        title="Couldn’t send invite"
        message="Something went wrong. Please try again."
        onConfirm={() => setErrorAlert(false)}
      />

      <AnimatePresence>
        {toast && <Toast message="Invite sent!" />}
      </AnimatePresence>
    </AppLayout>
  )
}

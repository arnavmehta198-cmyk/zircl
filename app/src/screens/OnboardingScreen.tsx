import { useMemo, useRef, useState } from 'react'
import { createUser } from '../services/users'
import { useApp } from '../context/AppContext'
import { HOBBIES } from '../lib/types'
import { hobbyIcon } from '../lib/hobbies'
import { ageFrom } from '../lib/format'
import { resizeForUpload, uploadProfilePhoto } from '../services/media'
import { requestNotificationPermission } from '../services/calendar'
import { Button, Chip, Field, Spinner, TextArea, TextField } from '../components/ui'
import { Icon } from '../components/icons'

type Step = 'ageGate' | 'underage' | 'profileSetup' | 'hobbies' | 'location' | 'notifications'

/** The forward order of the flow — used to derive the Back target. */
const STEP_ORDER: Step[] = ['ageGate', 'profileSetup', 'hobbies', 'location', 'notifications']

const STEP_NUMBER: Record<Step, number> = {
  ageGate: 1,
  underage: 0,
  profileSetup: 2,
  hobbies: 3,
  location: 4,
  notifications: 5,
}

/** yyyy-MM-dd for a native date input, in local time. */
function dateInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Parse a yyyy-MM-dd input value as a local date (not UTC midnight). */
function parseDateInput(v: string): Date {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const dateInputClass =
  'w-full h-11 px-3.5 rounded-field border border-line bg-dusk-800 text-[15px] text-ink outline-none transition ' +
  'focus:border-azure focus:ring-[3px] focus:ring-azure-dim'

const STEPPER_STEPS: { title: string; subtitle: string }[] = [
  { title: 'Birthday', subtitle: 'Confirm your age' },
  { title: 'Profile', subtitle: 'Name and photo' },
  { title: 'Hobbies', subtitle: 'What you’re into' },
  { title: 'Location', subtitle: 'Find people nearby' },
  { title: 'Notifications', subtitle: 'Stay in the loop' },
]

/** Numbered checkpoint stepper — done (check), current (ringed dot), upcoming (plain dot). */
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-start">
      {STEPPER_STEPS.map((s, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={s.title} className={`flex flex-col items-center ${n > 1 ? 'flex-1' : ''}`}>
            <div className="flex items-center w-full">
              {n > 1 && (
                <div className={`h-px flex-1 ${done || active ? 'bg-azure' : 'bg-line'}`} />
              )}
              <span
                className={`shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors
                  ${done
                    ? 'bg-azure text-white'
                    : active
                      ? 'bg-surface ring-4 ring-azure-dim border-2 border-azure'
                      : 'bg-surface border-2 border-line'}`}
              >
                {done ? <Icon.Check size={15} /> : (
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-azure' : 'bg-ink-3'}`} />
                )}
              </span>
            </div>
            <div className="mt-2 text-center px-1 max-sm:hidden">
              <div className={`text-[13px] font-medium ${active || done ? 'text-ink' : 'text-ink-3'}`}>{s.title}</div>
              <div className={`text-[12px] ${active ? 'text-azure' : 'text-ink-3'}`}>{s.subtitle}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const HEADINGS: Record<Step, { title: string; description: string }> = {
  ageGate: {
    title: "When's your birthday?",
    description: 'We use this to confirm you meet our minimum age requirement.',
  },
  underage: { title: 'You must be 18 or older', description: '' },
  profileSetup: {
    title: 'Set up your profile',
    description: 'This is how others will see you on Zircl.',
  },
  hobbies: {
    title: 'What are you into?',
    description: 'Pick at least 3 — we use these to suggest clubs and people near you.',
  },
  location: {
    title: 'Enable location',
    description: 'Zircl uses your location to show you people and events nearby.',
  },
  notifications: {
    title: 'Stay in the loop',
    description: 'Turn on notifications so you never miss a message or update.',
  },
}

export default function OnboardingScreen() {
  const { user, signOut, refreshOnboarding } = useApp()
  const uid = user?.uid ?? ''

  const today = useMemo(() => new Date(), [])
  const defaultDOB = useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d
  }, [])

  const [step, setStep] = useState<Step>('ageGate')
  const [dob, setDob] = useState(dateInputValue(defaultDOB))
  const [name, setName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function toggle(h: string) {
    setSelected((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]))
  }

  function pickPhoto(f: File | undefined) {
    if (!f) return
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  function requestLocation() {
    if (!navigator.geolocation) { setStep('notifications'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setStep('notifications')
      },
      () => setStep('notifications'),
      { timeout: 10_000 },
    )
  }

  async function finish(notificationsEnabled: boolean) {
    if (!uid) return
    setError('')
    setSaving(true)
    try {
      let photoURL: string | null = null
      if (photo) {
        try {
          const blob = await resizeForUpload(photo)
          photoURL = await uploadProfilePhoto(uid, blob)
        } catch {
          photoURL = null // a failed upload must not block onboarding
        }
      }

      await createUser(uid, {
        name: name.trim(),
        dateOfBirth: parseDateInput(dob),
        bio: bio.trim(),
        photoURL,
        hobbies: selected,
        latitude: coords?.lat ?? null,
        longitude: coords?.lon ?? null,
        notificationsEnabled,
      })

      refreshOnboarding()
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not finish setting up your account.')
      setSaving(false)
    }
  }

  async function enableNotifications() {
    let granted = false
    try {
      granted = await requestNotificationPermission()
    } catch {
      granted = false
    }
    await finish(granted)
  }

  if (saving) {
    return (
      <div className="min-h-full grid place-items-center px-5 py-12">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="text-azure w-8 h-8" />
          <p className="text-[14.5px] text-ink-2">Setting up your profile…</p>
        </div>
      </div>
    )
  }

  if (step === 'underage') {
    return (
      <div className="min-h-full grid place-items-center px-5 py-12">
        <div className="w-full max-w-[560px] card p-8">
          <span className="w-11 h-11 rounded-field bg-azure-dim text-azure grid place-items-center">
            <Icon.Shield size={22} />
          </span>
          <h2 className="mt-5 text-[22px] font-display font-extrabold tracking-[-0.01em]">You must be 18 or older</h2>
          <p className="text-[14.5px] text-ink-2 mt-2 leading-relaxed max-w-[56ch]">
            You need to be at least 18 years old to use Zircl. Please come back once you meet our
            minimum age requirement.
          </p>
          <div className="mt-8 pt-5 border-t border-line flex justify-end">
            <Button variant="secondary" size="lg" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = HEADINGS[step]

  return (
    <div className="min-h-full grid place-items-center px-5 py-12">
      <div className="w-full max-w-[640px] card p-8">
        <Stepper current={STEP_NUMBER[step]} />

        <h2 className="mt-7 text-[22px] font-display font-extrabold tracking-[-0.01em] leading-tight">{heading.title}</h2>
        <p className="text-[14.5px] text-ink-2 mt-1.5 leading-relaxed max-w-[56ch]">
          {heading.description}
        </p>

        <div className="mt-7">
          {step === 'ageGate' && (
            <Field label="Date of birth">
              <input
                type="date"
                value={dob}
                max={dateInputValue(today)}
                onChange={(e) => setDob(e.target.value)}
                className={dateInputClass}
              />
            </Field>
          )}

          {step === 'profileSetup' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Choose a profile photo"
                  className="group relative w-24 h-24 rounded-full overflow-hidden bg-dusk-800
                             border border-dashed border-line-hi grid place-items-center text-ink-3
                             transition-colors hover:text-ink-2"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <Icon.ImagePlus size={24} />
                  )}
                  <span
                    className="absolute inset-0 bg-deep/60 text-white grid place-items-center
                               opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
                  >
                    <Icon.ImagePlus size={22} />
                  </span>
                </button>
                <div className="text-[13px] text-ink-2 leading-relaxed">
                  {photoPreview ? 'Looking good.' : 'Add a profile photo.'}
                  <br />
                  <span className="text-ink-3">Optional — you can change it later.</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </div>

              <TextField label="Name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />

              <TextArea
                label="Bio"
                value={bio}
                onChange={setBio}
                rows={4}
                placeholder="Tell people a bit about yourself"
              />
            </div>
          )}

          {step === 'hobbies' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HOBBIES.map((h) => (
                  <Chip
                    key={h}
                    label={h}
                    icon={hobbyIcon(h)}
                    selected={selected.includes(h)}
                    onClick={() => toggle(h)}
                  />
                ))}
              </div>
              <p className="meta mt-3">
                {selected.length < 3 ? `${selected.length}/3 selected` : `${selected.length} selected`}
              </p>
            </>
          )}

          {step === 'location' && (
            <div className="rounded-card border border-line bg-dusk-800 p-5 flex items-start gap-3.5">
              <span className="w-10 h-10 shrink-0 rounded-field bg-azure-dim text-azure grid place-items-center">
                <Icon.Pin size={20} />
              </span>
              <p className="text-[14px] text-ink-2 leading-relaxed">
                We only use your coordinates to rank clubs, activities and people by distance. Your
                exact location is never shown to anyone, and you can skip this step.
              </p>
            </div>
          )}

          {step === 'notifications' && (
            <>
              <div className="rounded-card border border-line bg-dusk-800 p-5 flex items-start gap-3.5">
                <span className="w-10 h-10 shrink-0 rounded-field bg-azure-dim text-azure grid place-items-center">
                  <Icon.Bell size={20} />
                </span>
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  Get notified about new messages, club invites and events you've RSVP'd to. You can
                  change this any time in Settings.
                </p>
              </div>
              {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
            </>
          )}
        </div>

        {/* footer */}
        <div className="mt-8 pt-5 border-t border-line flex items-center justify-between gap-3">
          <div>
            {step === 'location' && (
              <Button variant="ghost" onClick={() => { setCoords(null); setStep('notifications') }}>
                Not now
              </Button>
            )}
            {step === 'notifications' && (
              <Button variant="ghost" onClick={() => void finish(false)}>
                Not now
              </Button>
            )}
          </div>

          {step === 'ageGate' && (
            <Button
              size="lg"
              onClick={() => setStep(ageFrom(parseDateInput(dob)) >= 18 ? 'profileSetup' : 'underage')}
            >
              Continue
            </Button>
          )}
          {step === 'profileSetup' && (
            <Button size="lg" disabled={name.trim().length === 0} onClick={() => setStep('hobbies')}>
              Continue
            </Button>
          )}
          {step === 'hobbies' && (
            <Button size="lg" disabled={selected.length < 3} onClick={() => setStep('location')}>
              Continue
            </Button>
          )}
          {step === 'location' && (
            <Button size="lg" onClick={requestLocation}>
              Allow location access
            </Button>
          )}
          {step === 'notifications' && (
            <Button size="lg" onClick={() => void enableNotifications()}>
              Enable notifications
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

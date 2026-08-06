import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SubPage } from '../components/Shell'
import { AlertDialog, Button, HobbyTag, Menu, PaletteEmptyState, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import PhotoCarousel from '../components/PhotoCarousel'
import ReportSheet from '../components/ReportSheet'
import { useUID } from '../context/AppContext'
import { getUser } from '../services/users'
import { ageFrom, distanceText, milesBetween } from '../lib/format'
import type { FeedUser, ReportReason } from '../lib/types'
import { hasOutgoingRequest, isMutualFollow, sendFollowRequest } from '../services/friendship'
import { block, submitReport } from '../services/social'
import { loadRecentlyViewed } from '../services/prefs'

export default function PersonProfileScreen() {
  const { id = '' } = useParams()
  const currentUID = useUID()
  const navigate = useNavigate()

  const [person, setPerson] = useState<FeedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const [mutual, setMutual] = useState(false)
  const [checkingMutual, setCheckingMutual] = useState(false)
  const [requested, setRequested] = useState(false)

  const [limitAlert, setLimitAlert] = useState(false)
  const [lockedAlert, setLockedAlert] = useState(false)
  const [blockAlert, setBlockAlert] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      const fromCache = (): FeedUser | null => {
        const hit = loadRecentlyViewed(currentUID).find((p) => p.id === id)
        if (!hit) return null
        return {
          id: hit.id, name: hit.name, age: hit.age, gender: 'unknown',
          distanceMiles: 1, bio: hit.bio, hobbies: hit.hobbies, matchScore: 80,
          imageURLs: hit.photoURL ? [hit.photoURL] : [],
        }
      }

      // Generated filler profiles have no Firestore doc — recover them from
      // the recently-viewed cache the feed just wrote.
      if (id.startsWith('gen-')) {
        if (alive) { setPerson(fromCache()); setLoading(false) }
        return
      }

      const [target, own] = await Promise.all([
        getUser(id),
        currentUID ? getUser(currentUID) : Promise.resolve(null),
      ])
      if (!alive) return
      if (!target) { setPerson(fromCache()); setLoading(false); return }

      // Another user's coordinates and birth date are no longer sent to the
      // client; Postgres derives distance and age (see public_profiles). The
      // client-side branch remains only for rows that still carry raw fields.
      let distance = 1
      if (typeof target.serverDistanceMiles === 'number') {
        distance = target.serverDistanceMiles
      } else if (typeof target.latitude === 'number' && typeof target.longitude === 'number'
          && typeof own?.latitude === 'number' && typeof own?.longitude === 'number') {
        distance = milesBetween(own.latitude, own.longitude, target.latitude, target.longitude)
      }

      setPerson({
        id: target.id,
        name: target.name ?? 'Someone',
        age: typeof target.serverAge === 'number' ? target.serverAge : ageFrom(target.dateOfBirth),
        gender: 'unknown',
        distanceMiles: distance,
        bio: target.bio ?? '',
        hobbies: target.hobbies,
        matchScore: 80,
        imageURLs: target.photoURL ? [target.photoURL] : [],
      })
      setLoading(false)
    })()
    return () => { alive = false }
  }, [id, currentUID])

  useEffect(() => {
    if (!currentUID || !id) return
    let alive = true
    void isMutualFollow(currentUID, id)
      .then((m) => { if (alive) setMutual(m) })
      .catch(() => {})
    // Reflect an already-sent (pending or accepted) request instead of always
    // rendering the button as if Follow was never tapped.
    void hasOutgoingRequest(currentUID, id)
      .then((sent) => { if (alive && sent) setRequested(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [currentUID, id])

  const name = person?.name ?? 'this person'

  const onFollow = async () => {
    if (requested || !person) return
    setRequested(true)
    try {
      const ok = await sendFollowRequest(currentUID, person.id)
      if (!ok) { setRequested(false); setLimitAlert(true) }
    } catch {
      setRequested(false)
    }
  }

  // Deliberately re-checked on every tap: the follow-back may have landed
  // after this screen mounted, and a stale lock is worse than a slow one.
  const onMessage = async () => {
    if (!person || checkingMutual) return
    setCheckingMutual(true)
    try {
      const fresh = await isMutualFollow(currentUID, person.id)
      setMutual(fresh)
      if (fresh) navigate(`/chat/${person.id}`)
      else setLockedAlert(true)
    } catch {
      setLockedAlert(true)
    } finally {
      setCheckingMutual(false)
    }
  }

  const onBlock = async () => {
    setBlockAlert(false)
    try { await block(currentUID, id) } catch { /* leaving anyway */ }
    navigate(-1)
  }

  const onReport = async (reason: ReportReason, details: string) => {
    setReportOpen(false)
    try {
      await submitReport({ reporterID: currentUID, reportedID: id, reason, context: 'profile', details })
    } catch { /* reporting is fire-and-forget from the user's perspective */ }
  }

  return (
    <SubPage title={person?.name ?? 'Profile'} wide hideTitle>
      {loading ? (
        <div className="py-24 flex justify-center">
          <Spinner className="text-azure w-8 h-8" />
        </div>
      ) : !person ? (
        <PaletteEmptyState
          icon={<Icon.Profile size={28} />}
          title="Profile unavailable"
          description="This profile can't be opened right now."
        />
      ) : (
        <div className="max-w-[900px]">
          <div className="rounded-card overflow-hidden border border-line bg-ivory shadow-card
                          flex flex-col lg:grid lg:grid-cols-[1fr_1.05fr] h-[680px] lg:h-[520px]">
            {/* ---- photo, name overlaid — the one place the name lives now ---- */}
            <div className="relative w-full h-[320px] shrink-0 lg:h-full">
              <PhotoCarousel
                photos={person.imageURLs}
                name={person.name}
                overlay={
                  <div>
                    <h3 className="text-[26px] font-display font-extrabold text-white leading-[1.15]">
                      {person.name}, {person.age}
                    </h3>
                    <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] text-white/80">
                      <Icon.Pin size={14} className="text-white/60" />
                      {distanceText(person.distanceMiles)}
                    </div>
                  </div>
                }
                topRightAction={
                  <div className="absolute top-4 right-4">
                    <Menu
                      trigger={
                        <span className="w-8 h-8 grid place-items-center rounded-full bg-plum/50 backdrop-blur-xs
                                         text-white hover:bg-plum/70 transition-colors">
                          <Icon.More size={17} />
                        </span>
                      }
                      items={[
                        { label: `Block ${name}`, icon: <Icon.Ban size={17} />, destructive: true, onClick: () => setBlockAlert(true) },
                        { label: `Report ${name}`, icon: <Icon.Flag size={17} />, destructive: true, onClick: () => setReportOpen(true) },
                      ]}
                    />
                  </div>
                }
              />
            </div>

            {/* ---- details ---- */}
            <div className="flex flex-col flex-1 min-h-0 lg:h-full">
              <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-6 py-5">
                {person.bio.trim() && (
                  <p className="text-[14.5px] text-plum/70 leading-[1.6] max-w-[46ch]">{person.bio}</p>
                )}

                {person.hobbies.length > 0 && (
                  <div className="mt-5">
                    <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-rose font-medium mb-2.5">
                      Hobbies
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {person.hobbies.map((h) => <HobbyTag key={h} label={h} />)}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions docked to the card — same language as the feed card's bottom bar. */}
              <div className="shrink-0 flex flex-col gap-2.5 px-6 py-4 border-t border-line/70">
                <div className="flex gap-2.5">
                  <Button
                    fullWidth
                    variant={requested ? 'plum-outline' : 'rose'}
                    icon={requested ? <Icon.Check size={17} /> : <Icon.Heart size={17} />}
                    onClick={() => void onFollow()}
                    disabled={requested}
                  >
                    {mutual ? 'Following' : requested ? 'Request sent' : 'Follow'}
                  </Button>
                  <Button
                    fullWidth
                    variant="plum-outline"
                    isLoading={checkingMutual}
                    icon={mutual ? <Icon.Messages size={17} /> : <Icon.Lock size={17} />}
                    onClick={() => void onMessage()}
                  >
                    Message
                  </Button>
                </div>

                {!mutual && (
                  <p className="text-[12.5px] text-plum/60 flex items-center gap-1.5">
                    <Icon.Lock size={13} />
                    You can only message people who follow you back.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={limitAlert}
        title="Daily limit reached"
        message="Free plan is limited to 3 follow requests a day. Upgrade to Premium for unlimited follows."
        onConfirm={() => setLimitAlert(false)}
      />
      <AlertDialog
        open={lockedAlert}
        title="Follow each other to chat"
        message={`You can only message ${name} once you both follow each other.`}
        onConfirm={() => setLockedAlert(false)}
      />
      <AlertDialog
        open={blockAlert}
        title={`Block ${name}?`}
        message="You won't see each other in the feed, messages, or clubs anymore."
        confirmLabel="Block"
        destructive
        onConfirm={() => void onBlock()}
        onCancel={() => setBlockAlert(false)}
      />
      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedName={name}
        onSubmit={(reason, details) => void onReport(reason, details)}
      />
    </SubPage>
  )
}

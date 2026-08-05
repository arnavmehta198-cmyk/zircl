import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../components/Shell'
import { Button, Card, PaletteEmptyState, Spinner } from '../components/ui'
import { Icon } from '../components/icons'
import { useUID } from '../context/AppContext'
import { hobbyIcon } from '../lib/hobbies'
import { shortDateTime } from '../lib/format'
import type { ScheduledEvent } from '../lib/types'
import { fetchAll, respond } from '../services/events'
import { downloadICS, googleCalendarURL } from '../services/calendar'

function EventCard({ event, uid, onAccept, onDecline, busy }: {
  event: ScheduledEvent
  uid: string
  onAccept?: (e: ScheduledEvent) => void
  onDecline?: (e: ScheduledEvent) => void
  busy?: boolean
}) {
  const iAmCreator = event.creatorID === uid
  const who = iAmCreator
    ? `With ${event.inviteeName}`
    : `From ${event.creatorFirstName} ${event.creatorLastName}`.trim()

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-dusk-800 border border-line rounded-field grid place-items-center text-ink-2 shrink-0">
          {hobbyIcon(event.hobby, 18)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium text-ink truncate">{event.hobby}</div>
          <div className="text-[13px] text-ink-2 truncate">{event.locationName}</div>
          <div className="meta mt-0.5">{shortDateTime(event.date)}</div>
          <div className="text-[12.5px] text-ink-3 truncate mt-0.5">{who}</div>
        </div>
      </div>

      {(onAccept || onDecline) && (
        <div className="flex gap-2 mt-4">
          {onAccept && (
            <Button size="sm" disabled={busy} onClick={() => onAccept(event)}>Accept</Button>
          )}
          {onDecline && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onDecline(event)}>
              Decline
            </Button>
          )}
        </div>
      )}

      {event.status === 'accepted' && (
        <div className="flex items-center gap-4 mt-3">
          <a
            href={googleCalendarURL(event.hobby, event.locationName, event.date)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] text-azure font-medium hover:underline"
          >
            Add to Google Calendar
          </a>
          <button
            type="button"
            onClick={() => downloadICS(event.hobby, event.locationName, event.date)}
            className="text-[12.5px] text-azure font-medium hover:underline"
          >
            Download .ics
          </button>
        </div>
      )}
    </Card>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOT_TONES = ['bg-azure', 'bg-signal', 'bg-warn']

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function toneFor(hobby: string): string {
  let h = 0
  for (const ch of hobby) h = (h * 31 + ch.charCodeAt(0)) % 997
  return DOT_TONES[h % DOT_TONES.length]
}

/** Untitled UI's month-view grid — a browsing aid; the sections below still carry the actionable cards. */
function MonthCalendar({ events, onPickDay }: { events: ScheduledEvent[]; onPickDay: (d: Date) => void }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const leadingBlanks = firstOfMonth.getDay()
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
        <span className="text-[15px] font-display font-medium">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </Button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] transition-colors"
          >
            <Icon.ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] transition-colors"
          >
            <Icon.ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[84px] border-b border-r border-line last:border-r-0 bg-dusk-800/40" />
          const dayEvents = events.filter((e) => sameDay(e.date, day))
          const shown = dayEvents.slice(0, 2)
          const overflow = dayEvents.length - shown.length
          const isToday = sameDay(day, today)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPickDay(day)}
              className="min-h-[84px] p-1.5 border-b border-r border-line last:border-r-0 text-left
                         hover:bg-dusk-800/60 transition-colors flex flex-col gap-1"
            >
              <span
                className={`text-[12px] w-6 h-6 grid place-items-center rounded-full shrink-0
                  ${isToday ? 'bg-azure text-white font-medium' : 'text-ink-2'}`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                {shown.map((e) => (
                  <span
                    key={e.id}
                    className="flex items-center gap-1 text-[10.5px] text-ink-2 truncate px-1 py-[1px] rounded bg-dusk-800"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneFor(e.hobby)}`} />
                    <span className="truncate">{e.hobby}</span>
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[10.5px] text-ink-3 px-1">{overflow} more…</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="eyebrow">{title}</h3>
        <span className="font-mono text-[11px] text-ink-3">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

export default function CalendarScreen() {
  const uid = useUID()
  const navigate = useNavigate()
  const [events, setEvents] = useState<ScheduledEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busyID, setBusyID] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    try {
      setEvents(await fetchAll(uid))
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => { void load() }, [load])

  const { invites, upcoming, sent, accepted } = useMemo(() => {
    const now = Date.now()
    return {
      invites: events.filter((e) => e.inviteeID === uid && e.status === 'pending'),
      upcoming: events
        .filter((e) => e.status === 'accepted' && e.date.getTime() > now)
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
      sent: events.filter((e) => e.creatorID === uid && e.status === 'pending'),
      accepted: events.filter((e) => e.status === 'accepted'),
    }
  }, [events, uid])

  const accept = async (e: ScheduledEvent) => {
    setBusyID(e.id)
    try {
      await respond(e.id, true)
      // No silent auto-download — the accepted card offers explicit
      // "Add to Google Calendar" / "Download .ics" actions instead.
    } catch { /* the reload below will show the true state */ }
    setBusyID(null)
    await load()
  }

  const decline = async (e: ScheduledEvent) => {
    setBusyID(e.id)
    try {
      await respond(e.id, false)
    } catch { /* ignore */ }
    setBusyID(null)
    await load()
  }

  const allEmpty = invites.length === 0 && upcoming.length === 0 && sent.length === 0

  return (
    <AppLayout
      title="Calendar"
      wide
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-azure w-8 h-8" /></div>
      ) : allEmpty ? (
        <div className="space-y-8">
          <MonthCalendar events={[]} onPickDay={() => navigate('/schedule')} />
          <PaletteEmptyState
            icon={<Icon.Calendar size={28} />}
            title="No events yet"
            description="Schedule one with a friend from the Schedule tab."
            action={<Button variant="rose" onClick={() => navigate('/schedule')}>Go to Schedule</Button>}
          />
        </div>
      ) : (
        <div className="space-y-8">
          <MonthCalendar events={accepted} onPickDay={() => navigate('/schedule')} />

          {invites.length > 0 && (
            <Section title="Invites for you" count={invites.length}>
              {invites.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  uid={uid}
                  busy={busyID === e.id}
                  onAccept={(x) => void accept(x)}
                  onDecline={(x) => void decline(x)}
                />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Upcoming events" count={upcoming.length}>
              {upcoming.map((e) => <EventCard key={e.id} event={e} uid={uid} />)}
            </Section>
          )}

          {sent.length > 0 && (
            <Section title="Sent invites" count={sent.length}>
              {sent.map((e) => <EventCard key={e.id} event={e} uid={uid} />)}
            </Section>
          )}
        </div>
      )}
    </AppLayout>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Icon } from './icons'
import { Button, EASE } from './ui'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** 9:00 AM to 10:00 PM in 30-minute steps — matches the untitledui reference. */
const TIME_SLOTS = Array.from({ length: 27 }, (_, i) => {
  const totalMinutes = 9 * 60 + i * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const period = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return { id: `${hour}:${minute}`, hour, minute, label: `${h12}:${String(minute).padStart(2, '0')} ${period}` }
})

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timeFmt = (d: Date) => {
  const h = d.getHours(), m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Untitled UI's calendar-card date+time picker, ported without the
 * react-aria-components / @internationalized/date dependency chain — plain
 * Date math, same shape: month grid on the left, a scroll-snapped time rail
 * on the right, Today jump, Cancel/Apply footer.
 *
 * The panel is portaled to document.body (so it isn't clipped by the step's
 * overflow) but deliberately NOT wrapped in its own <AnimatePresence>. When
 * this component sits inside the schedule wizard's own
 * `<AnimatePresence mode="wait">` (one per step), a nested AnimatePresence
 * around a portaled child never actually mounted the portal — `open` flipped
 * to true, effects ran, but the portal's ref stayed null and nothing
 * appeared. Plain conditional render + `initial`/`animate` still gets the
 * entrance animation; the trade-off is an instant (non-animated) close
 * instead of an exit fade, which is a fine trade for "the picker actually
 * opens."
 */
export default function DateTimePicker({
  value, onChange, minDate,
}: { value: Date; onChange: (d: Date) => void; minDate?: Date }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1))
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timeRailRef = useRef<HTMLDivElement>(null)
  const activeSlotRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1))
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      // Panel width mirrors the CSS: w-[calc(100vw-24px)] max-w-[540px].
      // Clamp left into [0, innerWidth - panelWidth] — the old
      // `Math.min(r.left, innerWidth - 560)` assumed a fixed 560px panel and
      // went negative (pushing the panel off the left edge) on any viewport
      // narrower than that, which is every phone.
      const panelWidth = Math.min(window.innerWidth - 24, 540)
      const maxLeft = Math.max(0, window.innerWidth - panelWidth)
      setPos({ top: r.bottom + 6, left: Math.min(Math.max(r.left, 0), maxLeft) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // Scroll the time rail so the currently-selected slot is in view the
  // moment the panel opens, instead of always starting at 9:00 AM.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      activeSlotRef.current?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const leadingBlanks = firstOfMonth.getDay()
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ]

  function pickDay(day: Date) {
    const next = new Date(draft)
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
    setDraft(next)
  }

  function pickTime(hour: number, minute: number) {
    const next = new Date(draft)
    next.setHours(hour, minute, 0, 0)
    setDraft(next)
  }

  function jumpToday() {
    const t = new Date()
    const next = new Date(draft)
    next.setFullYear(t.getFullYear(), t.getMonth(), t.getDate())
    setDraft(next)
    setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1))
  }

  function apply() {
    onChange(draft)
    setOpen(false)
  }

  const activeSlot = `${draft.getHours()}:${draft.getMinutes()}`

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-11 px-3.5 rounded-field border border-plum/15 bg-white text-left
                   flex items-center gap-2 transition-colors hover:border-plum/30"
      >
        <Icon.Calendar size={16} className="text-plum/50 shrink-0" />
        <span className="text-[14.5px] text-plum truncate flex-1">
          {dateFmt(value)} <span className="text-plum/50">{timeFmt(value)}</span>
        </span>
      </button>

      {open && createPortal(
        <motion.div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15, ease: EASE }}
          className="z-[70] w-[calc(100vw-24px)] max-w-[540px] bg-ivory border border-plum/15 rounded-card shadow-pop overflow-hidden"
        >
          <div className="flex max-sm:flex-col">
            {/* month calendar */}
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="w-7 h-7 grid place-items-center rounded-lg text-plum/60 hover:bg-plum/[0.06] transition-colors"
                >
                  <Icon.ChevronLeft size={16} />
                </button>
                <span className="text-[13.5px] font-medium text-plum">
                  {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="w-7 h-7 grid place-items-center rounded-lg text-plum/60 hover:bg-plum/[0.06] transition-colors"
                >
                  <Icon.ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-1 text-center">
                {WEEKDAYS.map((w, i) => (
                  <span key={i} className="font-mono text-[10.5px] text-plum/40 h-7 grid place-items-center">{w}</span>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <span key={i} />
                  const disabled = !!minDay && day < minDay
                  const selected = sameDay(day, draft)
                  const isToday = sameDay(day, new Date())
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(day)}
                      className={`h-8 w-8 mx-auto grid place-items-center rounded-full text-[13px] transition-colors
                        ${selected ? 'bg-rose text-white font-medium' : disabled ? 'text-plum/25 cursor-not-allowed' : 'text-plum hover:bg-blush'}
                        ${isToday && !selected ? 'ring-1 ring-rose/50' : ''}`}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* time rail — scroll-snapped, auto-centers the active slot on open */}
            <div className="w-full sm:w-[168px] border-t sm:border-t-0 sm:border-l border-plum/10 flex flex-col">
              <div className="px-4 pt-4 pb-2.5 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-plum/40">
                Available times
              </div>
              <div
                ref={timeRailRef}
                className="flex-1 max-h-[260px] overflow-y-auto thin-scroll px-3 pb-3 flex flex-col gap-1 snap-y snap-mandatory"
              >
                {TIME_SLOTS.map((slot) => {
                  const active = activeSlot === slot.id
                  return (
                    <button
                      key={slot.id}
                      ref={active ? activeSlotRef : undefined}
                      type="button"
                      onClick={() => pickTime(slot.hour, slot.minute)}
                      className={`h-9 rounded-field text-[13px] font-medium transition-colors shrink-0 snap-center
                        ${active
                          ? 'bg-rose text-white'
                          : 'bg-white text-plum/70 hover:bg-blush/50 border border-plum/10'}`}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-plum/10 p-3">
            <Button variant="plum-outline" size="sm" onClick={jumpToday}>Today</Button>
            <div className="flex-1" />
            <Button variant="plum-outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="rose" size="sm" onClick={apply}>Apply</Button>
          </div>
        </motion.div>,
        document.body,
      )}
    </>
  )
}

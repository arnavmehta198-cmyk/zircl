import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X, Check, User, Info } from 'lucide-react'
import { hobbyIcon } from '../lib/hobbies'

// "Orbit" control set. Dark surfaces, hairline borders, one azure accent used
// sparingly, and two motion families: spring for anything physical, a soft
// ease-out curve for opacity/position reveals.

export const SPRING = { type: 'spring' as const, stiffness: 400, damping: 24 }
export const BTN_SPRING = { type: 'spring' as const, stiffness: 420, damping: 26 }
export const EASE = [0.22, 1, 0.36, 1] as const

type BtnSize = 'sm' | 'md' | 'lg'
const SIZES: Record<BtnSize, string> = {
  sm: 'h-9 px-3.5 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[15px]',
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', isLoading = false,
  disabled = false, fullWidth = false, icon, type = 'button', className = '', ariaLabel,
}: {
  children?: ReactNode; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose' | 'plum-outline'
  size?: BtnSize; isLoading?: boolean; disabled?: boolean; fullWidth?: boolean
  icon?: ReactNode; type?: 'button' | 'submit'; className?: string
  /** For icon-only buttons (empty/hidden children) — otherwise omit and let the visible label speak. */
  ariaLabel?: string
}) {
  const off = isLoading || disabled
  const reduce = useReducedMotion()
  const variants = {
    // White on chart-blue — 4.6:1 at semibold sizes.
    primary: 'bg-azure text-white shadow-inset hover:bg-azure-hover',
    secondary: 'bg-transparent text-ink border border-line hover:border-line-hi hover:bg-dusk-800',
    ghost: 'text-ink-2 hover:text-ink hover:bg-ink/[0.04]',
    danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/[0.08]',
    // Rose/plum world only — feed match card, profile screen, messages empty
    // state. Real variants instead of `!`-overriding secondary/primary.
    rose: 'bg-rose text-white shadow-inset hover:bg-rose-hover',
    'plum-outline': 'bg-transparent text-plum border border-plum/15 hover:bg-plum/[0.04]',
  }
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={off}
      aria-label={ariaLabel}
      whileHover={off || reduce ? undefined : { scale: variant === 'primary' ? 1.03 : 1 }}
      whileTap={off || reduce ? undefined : { scale: 0.96 }}
      transition={BTN_SPRING}
      className={`inline-flex items-center justify-center gap-2 rounded-field font-semibold whitespace-nowrap
                  transition-colors duration-150 select-none ${SIZES[size]} ${variants[variant]}
                  ${fullWidth ? 'w-full' : ''}
                  ${off ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      {isLoading ? <Spinner className="w-4 h-4" /> : icon}
      {children}
    </motion.button>
  )
}

/** The brand mark — a gray "Z" with nine orbiting people-dots around it. */
export function OrbitMark({ size = 32 }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <rect x="4" y="4" width="92" height="24" fill="#9A9A9A" />
      <rect x="4" y="72" width="92" height="24" fill="#9A9A9A" />
      <polygon points="92,16 74,16 8,84 26,84" fill="#9A9A9A" />

      <circle cx="20" cy="16" r="9" fill="#2E6191" stroke="#fff" strokeWidth="3" />
      <circle cx="50" cy="16" r="9" fill="#5EB3E4" stroke="#fff" strokeWidth="3" />
      <circle cx="80" cy="16" r="9" fill="#A6CB3C" stroke="#fff" strokeWidth="3" />

      <circle cx="14" cy="50" r="9" fill="#C2185B" stroke="#fff" strokeWidth="3" />
      <circle cx="50" cy="50" r="9" fill="#F4CE2A" stroke="#fff" strokeWidth="3" />
      <circle cx="86" cy="50" r="9" fill="#C1642E" stroke="#fff" strokeWidth="3" />

      <circle cx="20" cy="84" r="9" fill="#A85CA8" stroke="#fff" strokeWidth="3" />
      <circle cx="50" cy="84" r="9" fill="#3C8D52" stroke="#fff" strokeWidth="3" />
      <circle cx="80" cy="84" r="9" fill="#8B5E3C" stroke="#fff" strokeWidth="3" />
    </svg>
  )
}

/** Oversized, near-invisible orbit motif behind empty states. */
export function OrbitWatermark({ size = 500 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none"
    >
      <circle cx="16" cy="16" r="15" stroke="#152219" strokeWidth="0.5" />
      <circle cx="16" cy="16" r="11" stroke="#152219" strokeWidth="0.5" />
      <circle cx="16" cy="16" r="6" stroke="#152219" strokeWidth="0.5" />
      <circle cx="16" cy="5" r="2" fill="#1866DE" />
    </svg>
  )
}

export function Field({ label, hint, error, required, children }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[13px] font-medium text-ink-2 mb-1.5">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-[12.5px] text-danger mt-1.5">{error}</span>
      ) : hint ? (
        <span className="block text-[12.5px] text-ink-3 mt-1.5">{hint}</span>
      ) : null}
    </label>
  )
}

// Untitled UI's input pattern: fully pill-shaped, a trailing status glyph
// slot (info tooltip normally, an alert icon when invalid), red border+ring
// on error instead of azure.
const INPUT_BASE = `w-full h-11 px-4 border border-line bg-dusk-800 text-[15px] text-ink
               placeholder:text-ink-3 outline-none transition
               focus:border-azure focus:ring-[3px] focus:ring-azure-dim`
const INPUT = `${INPUT_BASE} rounded-full`
const INPUT_ERROR = `border-danger focus:border-danger focus:ring-danger/15`

export function TextField({
  value, onChange, placeholder, type = 'text', inputMode, autoComplete, label, hint, error, required, icon,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; inputMode?: 'text' | 'email' | 'tel' | 'numeric'; autoComplete?: string
  label?: string; hint?: string; error?: string; required?: boolean; icon?: ReactNode
}) {
  const input = (
    <div className="relative">
      {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{icon}</span>}
      <input
        type={type} value={value} inputMode={inputMode} autoComplete={autoComplete}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`${INPUT} ${icon ? 'pl-10' : ''} ${error ? INPUT_ERROR : ''} ${error ? 'pr-10' : ''}`}
      />
      {error && (
        <Info size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-danger pointer-events-none" />
      )}
    </div>
  )
  return label || hint || error ? (
    <Field label={label} hint={hint} error={error} required={required}>{input}</Field>
  ) : input
}

export function TextArea({
  value, onChange, placeholder, rows = 4, label,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; label?: string }) {
  const ta = (
    <textarea
      value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      className={`${INPUT_BASE} rounded-card h-auto py-3 resize-y leading-relaxed`}
    />
  )
  return label ? <Field label={label}>{ta}</Field> : ta
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

export function ProfileAvatar({ photoURL, size = 34, name }: { photoURL?: string | null; size?: number; name?: string }) {
  const [failed, setFailed] = useState(false)
  const show = photoURL && !failed
  const initial = name?.trim()?.[0]?.toUpperCase()
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full overflow-hidden bg-dusk-800 ring-1 ring-line grid place-items-center"
    >
      {show ? (
        <img src={photoURL} alt="" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : initial ? (
        <span style={{ fontSize: size * 0.38 }} className="font-display font-medium text-ink-2 select-none">
          {initial}
        </span>
      ) : (
        <User size={size * 0.44} className="text-ink-3" />
      )}
    </div>
  )
}

export function Card({ children, className = '', hover = false, as = 'div', onClick }: {
  children: ReactNode; className?: string; hover?: boolean; as?: 'div' | 'button'; onClick?: () => void
}) {
  const cls = `card ${hover ? 'card-hover' : ''} ${className}`
  if (as === 'button') {
    return <button onClick={onClick} className={`${cls} text-left w-full`}>{children}</button>
  }
  return <div className={cls}>{children}</div>
}

export function SectionCard({ title, subtitle, children, icon, kicker }: {
  title: string; subtitle?: string; children: ReactNode; icon?: ReactNode; kicker?: string
}) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-3 mb-4">
        {icon && <span className="text-ink-2 mt-0.5">{icon}</span>}
        <div>
          {kicker && <div className="eyebrow mb-1.5">{kicker}</div>}
          <h3 className="text-[16px] font-display font-medium">{title}</h3>
          {subtitle && <p className="text-[14px] text-ink-2 mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description: string; action?: ReactNode
}) {
  return (
    <div className="relative card overflow-hidden flex flex-col items-center text-center px-6 py-20 gap-3">
      <OrbitWatermark size={420} />
      {icon && <div className="text-ink-3 relative">{icon}</div>}
      <h3 className="text-[20px] font-display font-medium relative">{title}</h3>
      <p className="text-[15px] text-ink-2 max-w-[46ch] leading-relaxed relative">{description}</p>
      {action && <div className="mt-4 relative">{action}</div>}
    </div>
  )
}

/** Ivory/plum/rose drop-in for `EmptyState` — same prop shape, blush-circle
 *  icon treatment instead of the gray OrbitWatermark rings. */
export function PaletteEmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description: string; action?: ReactNode
}) {
  return (
    <div className="rounded-card border border-plum/15 bg-ivory shadow-card overflow-hidden
                    flex flex-col items-center text-center px-6 py-14">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-blush grid place-items-center text-rose/70 mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-[19px] font-display font-extrabold text-plum">{title}</h3>
      <p className="text-[14.5px] text-plum/60 max-w-[46ch] leading-relaxed mt-1.5">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Hobby pill. `selected` marks a shared hobby. `accent="rose"` opts a screen
 *  into the rose/plum palette's selection color instead of the app-default azure. */
export function Chip({ label, icon, selected = false, onClick, tone = 'select', accent = 'azure' }: {
  label: string; icon?: ReactNode; selected?: boolean; onClick?: () => void
  tone?: 'select' | 'tag'; accent?: 'azure' | 'rose'
}) {
  const base = `inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[13px] font-medium
                whitespace-nowrap border transition-colors duration-150`
  const selectedLook = accent === 'rose' ? 'border-rose bg-rose/[0.1] text-rose' : 'border-azure bg-azure-dim text-azure'
  const look = selected ? selectedLook : 'border-line bg-dusk-800 text-ink hover:border-line-hi'
  const iconLook = selected ? (accent === 'rose' ? 'text-rose' : 'text-azure') : 'text-ink-2'

  if (tone === 'tag' || !onClick) {
    return (
      <span className={`${base} ${look}`}>
        {icon && <span className={iconLook}>{icon}</span>}{label}
      </span>
    )
  }
  return (
    <motion.button
      type="button" onClick={onClick} aria-pressed={selected}
      whileTap={{ scale: 0.94 }} transition={BTN_SPRING}
      className={`${base} ${look}`}
    >
      {icon && <span className={iconLook}>{icon}</span>}{label}
    </motion.button>
  )
}

/** Back-compat alias for screens still importing HobbyChip. */
export function HobbyChip({ label, icon, selected, onClick, variant = 'select' }: {
  label: string; icon?: ReactNode; selected?: boolean; onClick?: () => void; variant?: 'select' | 'amber'
}) {
  return <Chip label={label} icon={icon} selected={selected} onClick={onClick} tone={variant === 'amber' ? 'tag' : 'select'} />
}

export function StatusPill({ label, tone = 'warn' }: { label: string; tone?: 'warn' | 'signal' | 'azure' | 'muted' }) {
  const tones = {
    warn: 'text-warn bg-warn/[0.12]',
    signal: 'text-signal bg-signal/[0.12]',
    azure: 'text-azure bg-azure-dim',
    muted: 'text-ink-2 bg-dusk-800',
  }
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full font-mono text-[11px] font-medium ${tones[tone]}`}>
      {label}
    </span>
  )
}

/** Blush hobby tag — the rose/plum palette's chip language (first used on the
 *  feed match card and full profile screen), promoted here so it doesn't drift. */
export function HobbyTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full bg-blush text-blush-text text-[13px] font-medium">
      <span className="w-5 h-5 rounded-full bg-white/70 grid place-items-center text-blush-text">
        {hobbyIcon(label, 12)}
      </span>
      {label}
    </span>
  )
}

/** Gold dot+label badge — the rose/plum palette's badge language (first used
 *  for Clubs' "Free for all"), promoted here so it doesn't drift per screen. */
export function AccentBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-gold/15 font-mono text-[11px] font-medium tracking-[0.04em] uppercase text-gold whitespace-nowrap shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
      {label}
    </span>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-10 h-[22px] rounded-full p-[2px] shrink-0 transition-colors duration-200
                  ${checked ? 'bg-rose' : 'bg-dusk-800 border border-line'}`}
    >
      <motion.span
        layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`block w-[18px] h-[18px] rounded-full ${checked ? 'bg-white ml-auto' : 'bg-ink-3'}`}
      />
    </button>
  )
}

export function Slider({ value, min, max, step = 1, onChange, format }: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="relative pt-7">
      <div
        className="absolute top-0 -translate-x-1/2 font-mono text-[12px] text-ink px-2 py-0.5 rounded bg-dusk-800 border border-line"
        style={{ left: `${pct}%` }}
      >
        {format ? format(value) : value}
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-line" />
        <div className="absolute h-1 rounded-full bg-rose" style={{ width: `${pct}%` }} />
        <div
          className="absolute w-4 h-4 rounded-full bg-rose ring-[3px] ring-surface -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full h-4 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
}

// ---------- overlays ----------

/** Centred dialog on desktop, bottom sheet on phones. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className="relative w-full sm:max-w-lg bg-dusk-900 rounded-t-card sm:rounded-card
                       max-h-[88vh] sm:max-h-[80vh] flex flex-col border border-line"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line shrink-0">
              <h2 className="text-[16px] font-display font-medium">{title}</h2>
              <button
                onClick={onClose} aria-label="Close"
                className="w-8 h-8 grid place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.05] hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto thin-scroll p-5 pb-[env(safe-area-inset-bottom)]">{children}</div>
            {footer && (
              <div className="px-5 py-4 pb-[env(safe-area-inset-bottom)] border-t border-line shrink-0 flex justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Same shape as `Sheet`, on the rose/plum palette — the wizard's friend
 *  picker and the notifications sheet both needed this; kept as one shared
 *  component instead of a second local copy. */
export function PaletteSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-plum/40 backdrop-blur-[3px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className="relative w-full sm:max-w-lg bg-ivory rounded-t-card sm:rounded-card
                       max-h-[88vh] sm:max-h-[80vh] flex flex-col border border-plum/15"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-plum/10 shrink-0">
              <h2 className="text-[16px] font-display font-extrabold text-plum">{title}</h2>
              <button
                onClick={onClose} aria-label="Close"
                className="w-8 h-8 grid place-items-center rounded-lg text-plum/50 hover:bg-plum/[0.06] hover:text-plum transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto thin-scroll p-5 pb-[env(safe-area-inset-bottom)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function AlertDialog({
  open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message?: string; confirmLabel?: string; cancelLabel?: string
  destructive?: boolean; onConfirm: () => void; onCancel?: () => void
}) {
  useEffect(() => {
    if (!open || !onCancel) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-6">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" onClick={onCancel}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          />
          <motion.div
            role="alertdialog" aria-modal="true"
            className="relative bg-dusk-900 rounded-card max-w-sm w-full p-6 border border-line"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <h3 className="text-[18px] font-display font-medium">{title}</h3>
            {message && <p className="text-[14.5px] text-ink-2 mt-2 leading-relaxed">{message}</p>}
            <div className="flex justify-end gap-2 mt-6">
              {onCancel && <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>}
              <Button variant={destructive ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  /** Trailing hint text — a keyboard shortcut, a count, etc. */
  addon?: string
  destructive?: boolean
  onClick: () => void
  /** Consecutive items sharing a section render as one group; a new section value inserts a divider before it. */
  section?: string
}

export function Menu({ trigger, items, align = 'right' }: {
  trigger: ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Rendered into document.body via a portal and positioned with fixed
  // coordinates from the trigger's own rect — any ancestor's overflow-y-auto
  // (a Sheet's scrollable body, a chat thread, ...) would otherwise clip an
  // absolutely-positioned dropdown that tries to escape upward past it.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const openUp = r.top > window.innerHeight - r.bottom
      const next: typeof pos = {}
      if (openUp) next.bottom = window.innerHeight - r.top + 6
      else next.top = r.bottom + 6
      if (align === 'left') next.left = r.left
      else next.right = window.innerWidth - r.right
      setPos(next)
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </button>
      {/* Not wrapped in <AnimatePresence> — nesting it around a createPortal
          call never mounts the portal in this framer-motion version (state
          flips correctly but no DOM node appears; see DateTimePicker.tsx for
          the same failure signature). Plain conditional render + initial/animate
          still gets the entrance animation; the trade-off is an instant close
          instead of an exit fade. */}
      {open && createPortal(
        <motion.div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', ...pos }}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15, ease: EASE }}
          className="z-[100] min-w-[196px] bg-surface shadow-pop rounded-xl border border-line overflow-hidden py-1"
        >
          {items.map((it, i) => (
            <div key={it.label}>
              {i > 0 && it.section !== undefined && it.section !== items[i - 1].section && (
                <div className="h-px bg-line my-1" />
              )}
              <button
                role="menuitem"
                onClick={() => { setOpen(false); it.onClick() }}
                className={`w-full text-left px-3.5 h-10 text-[14px] flex items-center gap-2.5 transition-colors
                            hover:bg-ink/[0.05] ${it.destructive ? 'text-danger' : 'text-ink'}`}
              >
                {it.icon && <span className={it.destructive ? 'text-danger' : 'text-ink-2'}>{it.icon}</span>}
                <span className="flex-1 truncate">{it.label}</span>
                {it.addon && <span className="font-mono text-[11px] text-ink-3 shrink-0">{it.addon}</span>}
              </button>
            </div>
          ))}
        </motion.div>,
        document.body,
      )}
    </>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-dusk-800 border border-line text-ink
                 px-4 py-2.5 rounded-field text-[14px] font-medium flex items-center gap-2"
    >
      <Check size={16} className="text-signal" />{message}
    </motion.div>
  )
}

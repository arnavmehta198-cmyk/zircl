import { useState } from 'react'
import { Icon } from '../icons'

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙌']

/**
 * The "advanced" hover action bar: react / reply / copy, plus delete for
 * your own messages. Sits above the bubble, revealed on hover (desktop) —
 * mirrors Untitled UI's message-action-advanced pattern.
 */
export default function MessageActions({
  mine, onReact, onReply, onCopy, onDelete, align,
}: {
  mine: boolean
  onReact: (emoji: string) => void
  onReply: () => void
  onCopy: () => void
  onDelete?: () => void
  align: 'start' | 'end'
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div
      className={`relative flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100
                 transition-opacity ${align === 'end' ? 'order-first' : ''}`}
    >
      {pickerOpen && (
        <div
          className="absolute bottom-full mb-1.5 left-0 z-20 flex items-center gap-0.5 bg-surface border border-line
                     rounded-full shadow-pop px-1.5 py-1"
          onMouseLeave={() => setPickerOpen(false)}
        >
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onReact(e); setPickerOpen(false) }}
              className="w-7 h-7 grid place-items-center text-[16px] rounded-full hover:bg-dusk-800 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="React"
        onClick={() => setPickerOpen((v) => !v)}
        className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-ink/[0.06] transition-colors"
      >
        <Icon.Smile size={15} />
      </button>
      <button
        type="button"
        aria-label="Reply"
        onClick={onReply}
        className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-ink/[0.06] transition-colors"
      >
        <Icon.Reply size={15} />
      </button>
      <button
        type="button"
        aria-label="Copy"
        onClick={onCopy}
        className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-ink/[0.06] transition-colors"
      >
        <Icon.Copy size={14} />
      </button>
      {mine && onDelete && (
        <button
          type="button"
          aria-label="Delete"
          onClick={onDelete}
          className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:text-danger hover:bg-danger/[0.08] transition-colors"
        >
          <Icon.Trash size={14} />
        </button>
      )}
    </div>
  )
}

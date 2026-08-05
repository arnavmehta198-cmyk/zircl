import { motion } from 'motion/react'
import type { ChatMessage } from '../../lib/types'
import { isPending } from '../../services/messaging'
import { shortDateTime, timeOnly } from '../../lib/format'
import { Icon } from '../icons'
import MessageActions from './MessageActions'
import LinkPreview, { firstURL } from './LinkPreview'

interface Props {
  message: ChatMessage
  myUID: string
  onVote: (m: ChatMessage, option: string) => void
  onRSVP: (m: ChatMessage, attending: boolean) => void
  onReact: (m: ChatMessage, emoji: string) => void
  onReply: (m: ChatMessage) => void
  onDelete: (m: ChatMessage) => void
  /** Shown above incoming bubbles in group chats. */
  senderLabel?: string
}

function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessageBubble({
  message, myUID, onVote, onRSVP, onReact, onReply, onDelete, senderLabel,
}: Props) {
  const mine = message.senderID === myUID
  // A subtly flattened corner on the sender side reads as a tail without the
  // iMessage bubble-tail cartoon.
  const corner = mine ? 'rounded-2xl rounded-br-[4px]' : 'rounded-2xl rounded-bl-[4px]'
  const bubbleTone = mine
    ? 'bg-azure text-white'
    : 'bg-dusk-800 text-ink'

  const url = message.kind === 'text' ? firstURL(message.text) : null

  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[min(560px,72%)] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {senderLabel && !mine && (
          <div className="font-mono text-[11px] text-ink-3 mb-1 px-0.5">{senderLabel}</div>
        )}

        {/* Reply quote block — Untitled UI's message-reply pattern */}
        {message.replyTo && (
          <div
            className={`mb-1 max-w-full flex items-start gap-1.5 pl-2 border-l-2 border-line-hi
                        text-[12.5px] text-ink-3 ${mine ? 'flex-row-reverse text-right pl-0 pr-2 border-l-0 border-r-2' : ''}`}
          >
            <div className="min-w-0">
              <div className="font-medium text-ink-2">{message.replyTo.senderName}</div>
              <div className="truncate max-w-[280px]">{message.replyTo.preview}</div>
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-1.5 group/bubble">
          <MessageActions
            mine={mine}
            align={mine ? 'end' : 'start'}
            onReact={(emoji) => onReact(message, emoji)}
            onReply={() => onReply(message)}
            onCopy={() => { void navigator.clipboard?.writeText(message.text) }}
            onDelete={mine ? () => onDelete(message) : undefined}
          />
          <div className="min-w-0">
            {body()}
            {url && <LinkPreview url={url} />}
          </div>
        </div>

        {/* Reactions row — tap to add/switch your own reaction */}
        {Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 px-0.5 ${mine ? 'justify-end' : ''}`}>
            {Object.entries(message.reactions).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message, emoji)}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[12px] transition-colors
                           ${uids.includes(myUID) ? 'border-azure bg-azure-dim text-azure' : 'border-line bg-surface text-ink-2 hover:border-line-hi'}`}
              >
                <span className="text-[13px] leading-none">{emoji}</span>
                {uids.length > 1 && <span className="font-mono">{uids.length}</span>}
              </button>
            ))}
          </div>
        )}

        <div className={`mt-1 px-0.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-3 ${mine ? 'justify-end' : ''}`}>
          <span>{timeOnly(message.timestamp)}</span>
          {isPending(message) && message.scheduledFor && (
            <span className="inline-flex items-center gap-1">
              <Icon.Clock size={12} />
              Scheduled {timeOnly(message.scheduledFor)}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  function body() {
    switch (message.kind) {
      case 'sticker':
        return <div className="text-[56px] leading-none select-none">{message.sticker ?? message.text}</div>

      case 'photo':
        return message.photoURL ? (
          <figure className="m-0">
            <img
              src={message.photoURL}
              alt="Photo"
              className={`w-[260px] h-[260px] object-cover border border-line ${corner}`}
            />
            {message.fileName && (
              <figcaption className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-ink-3">
                <span className="truncate">{message.fileName}</span>
                {message.fileSize != null && <span className="shrink-0">{fileSizeText(message.fileSize)}</span>}
              </figcaption>
            )}
          </figure>
        ) : null

      case 'gif':
        return message.gifURL ? (
          <img
            src={message.gifURL}
            alt="GIF"
            className={`w-[260px] h-[200px] object-cover border border-line ${corner}`}
          />
        ) : null

      case 'video':
        return message.videoURL ? (
          <video controls src={message.videoURL} className={`w-[300px] border border-line ${corner}`} />
        ) : null

      case 'file':
        return fileAttachment()

      case 'audio':
        return audioMessage()

      case 'poll':
        return poll()

      case 'event':
        return event()

      default:
        return (
          <div className={`px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${corner} ${bubbleTone}`}>
            {message.text}
          </div>
        )
    }
  }

  function fileAttachment() {
    if (!message.fileURL) return null
    return (
      <a
        href={message.fileURL}
        download={message.fileName ?? 'attachment'}
        className={`flex items-center gap-3 w-[280px] p-3 border ${corner} transition-colors
                   ${mine ? 'bg-azure text-white border-azure/60 hover:bg-azure-hover' : 'bg-dusk-800 text-ink border-line hover:border-line-hi'}`}
      >
        <span className={`w-9 h-9 rounded-field grid place-items-center shrink-0 ${mine ? 'bg-white/15' : 'bg-dusk-900'}`}>
          <Icon.Attach size={17} className={mine ? 'text-white' : 'text-ink-2'} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium truncate">{message.fileName ?? 'Attachment'}</div>
          {message.fileSize != null && (
            <div className={`text-[12px] font-mono ${mine ? 'text-white/70' : 'text-ink-3'}`}>
              {fileSizeText(message.fileSize)}
            </div>
          )}
        </div>
        <Icon.Download size={16} className={mine ? 'text-white/80' : 'text-ink-3'} />
      </a>
    )
  }

  function audioMessage() {
    if (!message.audioURL) return null
    const dur = message.audioDurationSec ?? 0
    const mm = Math.floor(dur / 60)
    const ss = String(Math.round(dur % 60)).padStart(2, '0')
    return (
      <div
        className={`flex items-center gap-3 w-[260px] px-3.5 py-3 border ${corner} ${bubbleTone}`}
      >
        <Icon.Mic size={16} className={mine ? 'text-white/85' : 'text-ink-2'} />
        <audio controls src={message.audioURL} className="h-8 flex-1 min-w-0" />
        <span className="font-mono text-[12px] shrink-0">{mm}:{ss}</span>
      </div>
    )
  }

  function poll() {
    const votes = message.pollVotes ?? {}
    const total = Math.max(Object.keys(votes).length, 1)
    const myVote = votes[myUID]
    return (
      <div className="w-[280px] p-3.5 bg-dusk-900 rounded-card border border-line">
        <div className="flex items-center gap-2 mb-3">
          <Icon.Poll size={15} className="text-ink-2 shrink-0" />
          <div className="text-[14.5px] font-display font-medium text-ink">{message.text}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {message.pollOptions.map((option, i) => {
            const count = Object.values(votes).filter((v) => v === option).length
            const fraction = count / total
            const chosen = myVote === option
            return (
              <button
                key={`${option}-${i}`}
                type="button"
                onClick={() => onVote(message, option)}
                className={`relative h-9 rounded-field px-2.5 w-full overflow-hidden text-left border transition-colors duration-150
                            ${chosen ? 'border-azure/45' : 'border-line hover:border-line-hi'}`}
              >
                <motion.div
                  style={{ originX: 0, width: `${fraction * 100}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 bg-azure-dim"
                />
                <div className="relative flex items-center justify-between h-full gap-2">
                  <span className={`text-[13px] truncate font-medium ${chosen ? 'text-azure' : 'text-ink'}`}>
                    {option}
                  </span>
                  <span className="font-mono text-[12px] text-ink-2 text-right shrink-0">{count}</span>
                </div>
              </button>
            )
          })}
        </div>
        <div className="font-mono text-[11px] text-ink-3 mt-2.5">{Object.keys(votes).length} votes</div>
      </div>
    )
  }

  function event() {
    const attendance = message.eventAttendance ?? {}
    const mySelection = attendance[myUID]
    const going = Object.values(attendance).filter((v) => v === 'yes').length
    const pill = (selected: boolean) =>
      `flex-1 h-8 text-[13px] rounded-field font-medium border transition-colors duration-150 ${
        selected
          ? 'bg-azure border-azure text-white'
          : 'bg-dusk-800 border-line text-ink-2 hover:border-line-hi hover:text-ink'
      }`
    return (
      <div className="w-[280px] p-3.5 bg-dusk-900 rounded-card border border-line">
        <div className="flex items-center gap-2">
          <Icon.Calendar size={15} className="text-ink-2 shrink-0" />
          <div className="text-[14.5px] font-display font-medium text-ink">{message.eventTitle ?? message.text}</div>
        </div>
        {message.eventLocation && (
          <div className="flex items-center gap-2 mt-2 font-mono text-[13px] text-ink-2">
            <Icon.Pin size={14} className="text-ink-3 shrink-0" />
            {message.eventLocation}
          </div>
        )}
        {message.eventDate && (
          <div className="flex items-center gap-2 mt-1 font-mono text-[13px] text-ink-2">
            <Icon.Clock size={14} className="text-ink-3 shrink-0" />
            {shortDateTime(message.eventDate)}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => onRSVP(message, true)} className={pill(mySelection === 'yes')}>
            Attending
          </button>
          <button type="button" onClick={() => onRSVP(message, false)} className={pill(mySelection === 'no')}>
            Not Attending
          </button>
        </div>
        <div className="font-mono text-[11px] text-ink-3 mt-2.5">{going} attending</div>
      </div>
    )
  }
}

import { useEffect, useRef, useState } from 'react'
import { Button, Menu, Sheet, Spinner, TextField } from '../ui'
import { Icon } from '../icons'
import { payloads } from '../../services/messaging'
import { resizeForUpload, uploadChatAudio, uploadChatFile, uploadChatPhoto, uploadVideo } from '../../services/media'
import { shortDateTime } from '../../lib/format'
import type { ReplyRef } from '../../lib/types'

interface Props {
  onSend: (fields: Record<string, unknown>, preview: string, scheduledFor: Date | null) => void | Promise<void>
  /** Conversation id, or `club_${clubID}`. */
  videoPathPrefix: string
  disabled?: boolean
  /** The message being replied to, if any — shown as a cancellable banner above the input. */
  replyingTo?: ReplyRef | null
  onCancelReply?: () => void
  /** Called on every keystroke (typing started) and ~2.5s after the last one (typing stopped). */
  onTyping?: (typing: boolean) => void
}

const STICKERS = [
  '😀', '😂', '🥳', '😍', '🤝', '👍', '🔥', '🎾', '🏀', '🎬',
  '🍕', '☕️', '🏔️', '🎉', '💯', '👀', '🙌', '🐶', '🌊', '⭐️',
]

const GIF_BASE = 'https://media.giphy.com/media'
const GIFS = [
  `${GIF_BASE}/3o7abKhOpu0NwenH3O/giphy.gif`,
  `${GIF_BASE}/l0MYt5jPR6QX5pnqM/giphy.gif`,
  `${GIF_BASE}/26ufdipQqU2lhNA4g/giphy.gif`,
  `${GIF_BASE}/xT9IgDEI1iZyb2wqo8/giphy.gif`,
  `${GIF_BASE}/l4FGuhL4U2WyjdkaY/giphy.gif`,
  `${GIF_BASE}/3oEjI6SIIHBdRxXI40/giphy.gif`,
]

/** datetime-local wants a local (not UTC) `yyyy-MM-ddTHH:mm` string. */
function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const DATETIME_INPUT = `w-full h-10 px-3 rounded-field border border-line bg-dusk-800 text-[14.5px] text-ink
                        outline-none transition focus:border-azure focus:ring-[3px] focus:ring-azure-dim`

type SheetName = 'sticker' | 'gif' | 'poll' | 'event' | 'later' | null

export default function Composer({
  onSend, videoPathPrefix, disabled = false, replyingTo, onCancelReply, onTyping,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState<SheetName>(null)
  const [schedule, setSchedule] = useState<Date | null>(null)
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState('')

  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunks = useRef<Blob[]>([])
  const recordTimer = useRef<number | null>(null)

  const typingTimer = useRef<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  const [eventTitle, setEventTitle] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDate, setEventDate] = useState(() => localInputValue(new Date(Date.now() + 3_600_000)))

  const [customLater, setCustomLater] = useState('')

  const photoInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea up to roughly four rows.
  useEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [draft])

  useEffect(() => () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    if (recordTimer.current) window.clearInterval(recordTimer.current)
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  /** The schedule (and any active reply) applies to exactly one send, then clears. */
  async function push(built: { fields: Record<string, unknown>; preview: string }) {
    const when = schedule
    setSchedule(null)
    onCancelReply?.()
    stopTyping()
    await onSend(built.fields, built.preview, when)
  }

  function handleDraftChange(v: string) {
    setDraft(v)
    if (!onTyping) return
    onTyping(true)
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => onTyping(false), 2500)
  }

  function stopTyping() {
    if (typingTimer.current) { window.clearTimeout(typingTimer.current); typingTimer.current = null }
    onTyping?.(false)
  }

  async function sendText() {
    const t = draft.trim()
    if (!t || disabled) return
    setDraft('')
    await push(payloads.text(t, replyingTo))
  }

  async function onPhoto(file: File) {
    setUploading(true)
    try {
      const blob = await resizeForUpload(file)
      const url = await uploadChatPhoto(videoPathPrefix, blob)
      await push(payloads.photo(url, file.name, file.size))
    } catch { /* upload failed — nothing to send */ } finally {
      setUploading(false)
    }
  }

  async function onVideo(file: File) {
    setUploading(true)
    try {
      const url = await uploadVideo(videoPathPrefix, file)
      await push(payloads.video(url))
    } catch { /* upload failed */ } finally {
      setUploading(false)
    }
  }

  async function onAttachFile(file: File) {
    setAttachError('')
    setUploading(true)
    try {
      const url = await uploadChatFile(videoPathPrefix, file)
      await push(payloads.file(url, file.name, file.size))
    } catch (e) {
      setAttachError((e as { message?: string })?.message ?? 'Could not attach that file.')
    } finally {
      setUploading(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordChunks.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.current.push(e.data) }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setRecordSecs(0)
      recordTimer.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000)
    } catch {
      setAttachError('Microphone access was denied.')
    }
  }

  async function stopRecording(send: boolean) {
    const recorder = recorderRef.current
    if (!recorder) return
    const durationSec = recordSecs
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())
    if (recordTimer.current) { window.clearInterval(recordTimer.current); recordTimer.current = null }
    setRecording(false)
    recorderRef.current = null
    await stopped
    if (!send) return
    setUploading(true)
    try {
      const blob = new Blob(recordChunks.current, { type: 'audio/webm' })
      const url = await uploadChatAudio(videoPathPrefix, blob)
      await push(payloads.audio(url, durationSec))
    } catch (e) {
      setAttachError((e as { message?: string })?.message ?? 'Could not send voice message.')
    } finally {
      setUploading(false)
    }
  }

  function closeSheet() { setSheet(null) }

  const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean)
  const pollReady = pollQuestion.trim().length > 0 && cleanOptions.length >= 2
  const eventReady = eventTitle.trim().length > 0
  const nowValue = localInputValue(new Date())

  const menuItems = (disabled ? [] : [
    { label: 'Photo', icon: <Icon.Image size={17} />, onClick: () => photoInput.current?.click() },
    { label: 'Video', icon: <Icon.Video size={17} />, onClick: () => videoInput.current?.click() },
    { label: 'Attach file', icon: <Icon.Attach size={17} />, onClick: () => fileInput.current?.click() },
    { label: 'Sticker', icon: <Icon.Smile size={17} />, onClick: () => setSheet('sticker') },
    { label: 'GIF', icon: <Icon.Gif size={17} />, onClick: () => setSheet('gif') },
    { label: 'Poll', icon: <Icon.Poll size={17} />, onClick: () => setSheet('poll') },
    { label: 'Event', icon: <Icon.Calendar size={17} />, onClick: () => setSheet('event') },
    { label: 'Send Later', icon: <Icon.Clock size={17} />, onClick: () => { setCustomLater(''); setSheet('later') } },
  ])

  return (
    <div className="shrink-0">
      {replyingTo && (
        <div className="mb-2 rounded-field border border-line bg-dusk-900 pl-3 pr-2 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0 border-l-2 border-azure pl-2.5">
            <div className="text-[12.5px] font-medium text-azure">Replying to {replyingTo.senderName}</div>
            <div className="text-[13px] text-ink-2 truncate">{replyingTo.preview}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="w-7 h-7 shrink-0 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors"
          >
            <Icon.Close size={15} />
          </button>
        </div>
      )}

      {attachError && (
        <div className="mb-2 rounded-field border border-danger/30 bg-danger/[0.06] px-3 py-1.5 text-[13px] text-danger">
          {attachError}
        </div>
      )}

      {schedule && (
        <div className="mb-2 rounded-field border border-line bg-azure-dim px-3 py-1.5 flex items-center justify-between gap-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <Icon.Clock size={14} className="text-azure" />
            Sending at {shortDateTime(schedule)}
          </span>
          <button
            type="button"
            onClick={() => setSchedule(null)}
            className="text-azure font-medium hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {uploading && (
        <div className="mb-2 rounded-field border border-line bg-dusk-900 px-3 py-1.5 flex items-center gap-2 text-[13px] text-ink-2">
          <Spinner className="text-azure w-4 h-4" />
          Uploading video…
        </div>
      )}

      {recording ? (
        <div className="bg-dusk-900 border border-line rounded-card px-3.5 py-2.5 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse shrink-0" />
          <span className="font-mono text-[14px] text-ink flex-1">
            Recording… {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void stopRecording(false)}>Cancel</Button>
          <Button size="sm" icon={<Icon.Send size={15} />} onClick={() => void stopRecording(true)}>Send</Button>
        </div>
      ) : (
        <div className="bg-dusk-900 border border-line rounded-card px-2 py-2 flex gap-2 items-end">
          <Menu
            trigger={
              <span className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink transition-colors">
                <Icon.Plus size={18} />
              </span>
            }
            items={menuItems}
            align="left"
          />

          <textarea
            ref={textarea}
            rows={1}
            value={draft}
            disabled={disabled}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={stopTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendText() }
            }}
            placeholder="Write a message…"
            className="flex-1 min-w-0 resize-none bg-transparent border-0 px-1 py-1.5 text-[15px] text-ink leading-relaxed
                       outline-none focus:outline-none placeholder:text-ink-3 max-h-32 thin-scroll"
          />

          {!draft.trim() && !disabled && (
            <button
              type="button"
              aria-label="Record a voice message"
              onClick={() => void startRecording()}
              className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink transition-colors"
            >
              <Icon.Mic size={18} />
            </button>
          )}

          <Button
            size="sm"
            onClick={() => void sendText()}
            disabled={disabled || !draft.trim()}
            icon={<Icon.Send size={16} />}
            className="shrink-0"
          >
            Send
          </Button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onAttachFile(f)
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onPhoto(f)
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onVideo(f)
        }}
      />

      <Sheet open={sheet === 'sticker'} onClose={closeSheet} title="Stickers">
        <div className="grid grid-cols-5 gap-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              type="button"
              className="aspect-square grid place-items-center text-[34px] leading-none rounded-field
                         hover:bg-dusk-800 border border-transparent hover:border-line transition-colors duration-150"
              onClick={() => { closeSheet(); void push(payloads.sticker(s)) }}
            >
              {s}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'gif'} onClose={closeSheet} title="GIFs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GIFS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => { closeSheet(); void push(payloads.gif(url)) }}
              className="rounded-field overflow-hidden border border-line hover:border-line-hi transition-colors duration-150"
            >
              <img src={url} alt="GIF" className="w-full h-[110px] object-cover" />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'poll'}
        onClose={closeSheet}
        title="New poll"
        footer={
          <Button
            size="sm"
            disabled={!pollReady}
            onClick={() => {
              closeSheet()
              void push(payloads.poll(pollQuestion.trim(), cleanOptions))
              setPollQuestion(''); setPollOptions(['', ''])
            }}
          >
            Send
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField value={pollQuestion} onChange={setPollQuestion} placeholder="Question" label="Question" />
          {pollOptions.map((opt, i) => (
            <TextField
              key={i}
              value={opt}
              onChange={(v) => setPollOptions((prev) => prev.map((o, j) => (j === i ? v : o)))}
              placeholder={`Option ${i + 1}`}
            />
          ))}
          {pollOptions.length < 5 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon.Plus size={15} />}
                onClick={() => setPollOptions((p) => [...p, ''])}
              >
                Add option
              </Button>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'event'}
        onClose={closeSheet}
        title="New event"
        footer={
          <Button
            size="sm"
            disabled={!eventReady}
            onClick={() => {
              closeSheet()
              void push(payloads.event(eventTitle.trim(), eventLocation.trim(), new Date(eventDate)))
              setEventTitle(''); setEventLocation('')
              setEventDate(localInputValue(new Date(Date.now() + 3_600_000)))
            }}
          >
            Post
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            value={eventTitle}
            onChange={setEventTitle}
            placeholder="e.g. Tennis meetup"
            label="Title"
          />
          <TextField value={eventLocation} onChange={setEventLocation} placeholder="Where" label="Location" />
          <label className="block">
            <span className="block text-[13px] font-medium text-ink-2 mb-1.5">Date and time</span>
            <input
              type="datetime-local"
              value={eventDate}
              min={nowValue}
              onChange={(e) => setEventDate(e.target.value)}
              className={DATETIME_INPUT}
            />
          </label>
        </div>
      </Sheet>

      <Sheet open={sheet === 'later'} onClose={closeSheet} title="Send later">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {([
              ['In 1 minute', 60],
              ['In 1 hour', 3600],
              ['Tomorrow', 86400],
            ] as const).map(([label, secs]) => (
              <Button
                key={label}
                variant="secondary"
                onClick={() => { setSchedule(new Date(Date.now() + secs * 1000)); closeSheet() }}
              >
                {label}
              </Button>
            ))}
          </div>
          <label className="block pt-1">
            <span className="block text-[13px] font-medium text-ink-2 mb-1.5">Or pick a time</span>
            <input
              type="datetime-local"
              value={customLater}
              min={nowValue}
              onChange={(e) => {
                setCustomLater(e.target.value)
                if (e.target.value) { setSchedule(new Date(e.target.value)); closeSheet() }
              }}
              className={DATETIME_INPUT}
            />
          </label>
        </div>
      </Sheet>
    </div>
  )
}

import { useState } from 'react'
import { Button, Field, Sheet, TextArea } from './ui'
import { REPORT_REASONS, type ReportReason } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  reportedName: string
  onSubmit: (reason: ReportReason, details: string) => void
}

export default function ReportSheet({ open, onClose, reportedName, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason>('Spam')
  const [details, setDetails] = useState('')

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Report"
      footer={
        <Button
          size="sm"
          variant="danger"
          onClick={() => { onSubmit(reason, details.trim()); onClose() }}
        >
          Submit
        </Button>
      }
    >
      <p className="text-[14px] text-ink-2 mb-3">Why are you reporting {reportedName}?</p>

      <div className="card overflow-hidden divide-y divide-line" role="radiogroup" aria-label="Report reason">
        {REPORT_REASONS.map((r) => (
          <label
            key={r}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-dusk-800 transition-colors"
          >
            <input
              type="radio"
              name="report-reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="accent-azure w-4 h-4 shrink-0"
            />
            <span className={`text-[14.5px] ${reason === r ? 'font-medium text-ink' : 'text-ink-2'}`}>{r}</span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <Field label="Details" hint="Optional — anything that helps us review this faster.">
          <TextArea
            value={details}
            onChange={setDetails}
            rows={4}
            placeholder="Anything else we should know…"
          />
        </Field>
      </div>
    </Sheet>
  )
}

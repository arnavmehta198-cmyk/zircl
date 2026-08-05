import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '../components/Shell'
import { Button } from '../components/ui'
import { Icon } from '../components/icons'
import { useApp, useUID } from '../context/AppContext'
import { FreePlanLimits } from '../lib/types'
import {
  remainingEventsThisMonth, remainingFollowRequestsToday, remainingMessagesToday, setPlan,
} from '../services/usage'

interface Usage { messages: number | null; follows: number | null; events: number | null }

function UsageRow({ title, remaining, limit, period }: {
  title: string; remaining: number | null; limit: number; period: string
}) {
  const unlimited = remaining === null
  const pct = unlimited ? 100 : Math.max(0, Math.min(100, (remaining / limit) * 100))
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-medium text-ink">{title}</span>
        <span className="meta shrink-0">
          {unlimited ? 'Unlimited' : `${remaining} of ${limit} left ${period}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-line mt-2.5 overflow-hidden">
        <div className="h-full rounded-full bg-azure transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ComparisonRow({ title, free, premium }: { title: string; free: string; premium: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3">
      <span className="text-[14.5px] font-medium text-plum">{title}</span>
      <span className="font-mono text-[13px] text-plum/40 text-right w-[92px]">{free}</span>
      <span className="font-mono text-[13px] text-rose text-right w-[92px]">{premium}</span>
    </div>
  )
}

export default function PremiumScreen() {
  const uid = useUID()
  const { isPremium } = useApp()

  const [usage, setUsage] = useState<Usage>({ messages: null, follows: null, events: null })
  const [working, setWorking] = useState(false)

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      const [messages, follows, events] = await Promise.all([
        remainingMessagesToday(uid),
        remainingFollowRequestsToday(uid),
        remainingEventsThisMonth(uid),
      ])
      setUsage({ messages, follows, events })
    } catch {
      setUsage({ messages: null, follows: null, events: null })
    }
  }, [uid])

  useEffect(() => { void refresh() }, [refresh, isPremium])

  // DEV-only local toggle — lets you test premium gating without any billing hooked up.
  async function devTogglePlan() {
    if (!uid || working) return
    setWorking(true)
    try {
      await setPlan(uid, isPremium ? 'free' : 'premium')
      await refresh()
    } catch {
      // leave the button available so the user can retry
    } finally {
      setWorking(false)
    }
  }

  return (
    <AppLayout
      title="Premium"
      description={
        isPremium
          ? 'Unlimited messaging, follow requests, club history, and event scheduling.'
          : 'The free plan limits how much you can message, follow, and schedule each period.'
      }
      wide
    >
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          {!isPremium ? (
            <section className="card overflow-hidden">
              <div className="px-4 py-3 bg-dusk-800 border-b border-line">
                <h3 className="text-[15px] font-display font-medium">Today &amp; this month</h3>
                <p className="text-[13px] text-ink-2 mt-0.5">What's left on your free plan.</p>
              </div>
              <div className="divide-y divide-line">
                <UsageRow
                  title="Private messages"
                  remaining={usage.messages}
                  limit={FreePlanLimits.dailyMessages}
                  period="today"
                />
                <UsageRow
                  title="Follow requests"
                  remaining={usage.follows}
                  limit={FreePlanLimits.dailyFollowRequests}
                  period="today"
                />
                <UsageRow
                  title="Scheduled events"
                  remaining={usage.events}
                  limit={FreePlanLimits.monthlyEvents}
                  period="this month"
                />
              </div>
            </section>
          ) : (
            <section className="bg-ivory border-l-[3px] border-rose rounded-card p-5">
              <div className="flex items-start gap-2.5">
                <Icon.Premium size={20} className="text-rose mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-[15px] font-display font-extrabold text-plum">You're on Premium</h3>
                  <p className="text-[13px] text-plum/60 mt-1 leading-relaxed">
                    No caps on messages, follow requests, club history, or event scheduling.
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-col items-start gap-2.5">
            {!isPremium && (
              <p className="text-[13px] text-ink-2">Upgrading isn't available yet — check back soon.</p>
            )}

            {import.meta.env.DEV && (
              <Button size="sm" variant="secondary" onClick={() => { void devTogglePlan() }} isLoading={working}>
                DEV: flip plan without billing
              </Button>
            )}
          </div>
        </div>

        <section className="rounded-card border border-plum/15 bg-ivory shadow-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 bg-blush/40 border-b border-plum/10">
            <h3 className="text-[15px] font-display font-extrabold text-plum">Plan comparison</h3>
            <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-plum/40 text-right w-[92px]">Free</span>
            <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-rose text-right w-[92px]">Premium</span>
          </div>
          <div className="divide-y divide-plum/10">
            <ComparisonRow
              title="Private messages"
              free={`${FreePlanLimits.dailyMessages}/day`}
              premium="Unlimited"
            />
            <ComparisonRow
              title="Follow requests"
              free={`${FreePlanLimits.dailyFollowRequests}/day`}
              premium="Unlimited"
            />
            <ComparisonRow
              title="Club message history"
              free={`Last ${FreePlanLimits.clubMessageHistory}`}
              premium="Full history"
            />
            <ComparisonRow
              title="Event scheduling"
              free={`${FreePlanLimits.monthlyEvents}/month`}
              premium="Unlimited"
            />
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

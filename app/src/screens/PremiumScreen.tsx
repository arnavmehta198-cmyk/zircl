import { AppLayout } from '../components/Shell'
import { Icon } from '../components/icons'

export default function PremiumScreen() {
  return (
    <AppLayout
      title="Premium"
      description="Every account currently has full access — messaging, follow requests, club history, and event scheduling, with no caps."
      wide
    >
      <div className="max-w-[560px] mx-auto">
        <section className="rounded-card border border-dashed border-line bg-dusk-900 p-8 flex flex-col items-center text-center gap-2.5">
          <Icon.Premium size={28} className="text-ink-3" />
          <h3 className="text-[16px] font-display font-medium text-ink">Paid plans — Coming Soon</h3>
          <p className="text-[13.5px] text-ink-2 max-w-[360px]">
            Everyone gets the full feature set for free right now. We're not taking payments yet — check
            back soon.
          </p>
        </section>
      </div>
    </AppLayout>
  )
}

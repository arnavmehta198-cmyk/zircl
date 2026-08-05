import { useState } from 'react'
import { SubPage } from '../components/Shell'
import { Slider, Switch } from '../components/ui'
import { Icon } from '../components/icons'
import {
  loadAlgorithmSettings, saveAlgorithmSettings, type AlgorithmSettings,
} from '../services/prefs'

function ToggleRow({ title, description, on, onChange }: {
  title: string; description: string; on: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium text-ink">{title}</div>
        <p className="text-[13px] text-ink-2 mt-0.5">{description}</p>
      </div>
      <Switch checked={on} onChange={onChange} label={title} />
    </div>
  )
}

export default function AlgorithmSettingsScreen() {
  const [settings, setSettings] = useState<AlgorithmSettings>(() => loadAlgorithmSettings())

  function update(patch: Partial<AlgorithmSettings>) {
    setSettings((cur) => {
      const next = { ...cur, ...patch }
      saveAlgorithmSettings(next)
      return next
    })
  }

  return (
    <SubPage
      title="Customize algorithm"
      description="These preferences shape who appears in your feed and in what order."
      backTo="/profile"
    >
      <div className="space-y-5">
        <div className="card overflow-hidden divide-y divide-line">
          <ToggleRow
            title="Prioritize shared hobbies"
            description="People who share hobbies with you rank higher in the feed."
            on={settings.prioritizeHobbies}
            onChange={(v) => update({ prioritizeHobbies: v })}
          />
          <ToggleRow
            title="Prioritize people nearby"
            description="Closer profiles come first when location is available."
            on={settings.prioritizeNearby}
            onChange={(v) => update({ prioritizeNearby: v })}
          />
        </div>

        <section className="card p-5">
          <h3 className="text-[15px] font-display font-medium">Maximum distance</h3>
          <div className="mt-3">
            <Slider
              min={1}
              max={100}
              step={1}
              value={settings.maxDistance}
              onChange={(v) => update({ maxDistance: v })}
              format={(v) => `${v} mi`}
            />
          </div>
          {/* prioritizeNearby / maxDistance are stored but the feed never reads them yet. */}
          <div className="border-l-2 border-gold bg-gold/[0.08] rounded-r-lg px-3 py-2.5 flex gap-2 mt-5">
            <Icon.Info size={16} className="text-gold shrink-0 mt-px" />
            <p className="text-[13px] text-ink-2">
              Distance filtering isn't applied to the feed yet — this preference is saved but not used.
            </p>
          </div>
        </section>
      </div>
    </SubPage>
  )
}

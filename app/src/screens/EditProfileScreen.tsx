import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SubPage } from '../components/Shell'
import { Button, Chip } from '../components/ui'
import { Icon } from '../components/icons'
import { useApp, useUID } from '../context/AppContext'
import { updateUser } from '../services/users'
import { HOBBIES } from '../lib/types'
import { hobbyIcon } from '../lib/hobbies'
import { resizeForUpload, uploadProfilePhoto } from '../services/media'

export default function EditProfileScreen() {
  const navigate = useNavigate()
  const uid = useUID()
  const { profile } = useApp()

  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [hobbies, setHobbies] = useState<string[]>(profile.hobbies)
  const [saving, setSaving] = useState(false)

  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const preview = localPreview ?? profile.photoURL

  useEffect(() => {
    if (!file) { setLocalPreview(null); return }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function toggle(h: string) {
    setHobbies((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]))
  }

  async function save() {
    if (!uid || saving) return
    setSaving(true)
    try {
      let photoURL = profile.photoURL ?? ''
      if (file) {
        const blob = await resizeForUpload(file)
        photoURL = await uploadProfilePhoto(uid, blob)
      }
      await updateUser(uid, { hobbies, photoURL: photoURL || null })
      navigate(-1)
    } catch {
      setSaving(false)
    }
  }

  return (
    <SubPage title="Edit profile" backTo="/profile">
      <div className="space-y-8">
        <section>
          <div className="eyebrow mb-3">Photo</div>
          {/* The one dashed border in the app — marks the drop-in upload zone. */}
          <div
            className="border border-dashed border-rose/30 bg-blush/20 rounded-card px-6 py-8
                       flex flex-col items-center text-center gap-3"
          >
            {preview ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Change profile photo"
                className="w-24 h-24 rounded-full overflow-hidden bg-dusk-800 ring-1 ring-line shrink-0"
              >
                <img src={preview} alt="" className="w-full h-full object-cover" />
              </button>
            ) : (
              <Icon.ImagePlus size={28} className="text-rose/60" />
            )}
            <Button variant="plum-outline" size="sm" onClick={() => fileInput.current?.click()}>
              Change photo
            </Button>
            <p className="text-[12.5px] text-ink-3">JPG or PNG, square works best.</p>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </section>

        <section>
          <div className="eyebrow mb-3">Your hobbies</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HOBBIES.map((h) => (
              <Chip
                key={h}
                label={h}
                icon={hobbyIcon(h)}
                selected={hobbies.includes(h)}
                onClick={() => toggle(h)}
                accent="rose"
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end items-center gap-2 pt-2 border-t border-line">
          <Button variant="ghost" size="md" onClick={() => navigate(-1)} className="mt-4">
            Cancel
          </Button>
          <Button variant="rose" size="md" onClick={() => { void save() }} isLoading={saving} className="mt-4">
            Save
          </Button>
        </div>
      </div>
    </SubPage>
  )
}

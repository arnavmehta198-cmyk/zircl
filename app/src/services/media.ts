import { supabase } from '../lib/supabase'

/**
 * Downscale to a given long edge and return RAW base64 (no data: prefix) —
 * used internally to produce a resized Blob before upload.
 */
export function downscaleToBase64(file: File | Blob, maxSide = 700, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataURL = canvas.toDataURL('image/jpeg', quality)
      resolve(dataURL.split(',')[1]) // strip the data: prefix
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')) }
    img.src = url
  })
}

export async function uploadProfilePhoto(uid: string, file: File | Blob): Promise<string> {
  const path = `${uid}.jpg`
  const { error } = await supabase.storage.from('profile-photos')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl
}

export async function deleteProfilePhoto(uid: string) {
  await supabase.storage.from('profile-photos').remove([`${uid}.jpg`])
}

/** `pathPrefix` is the conversation id, or `club_{clubID}` for club chats. */
export async function uploadVideo(pathPrefix: string, file: File): Promise<string> {
  const path = `${pathPrefix}/${crypto.randomUUID()}.mov`
  const { error } = await supabase.storage.from('message-media')
    .upload(path, file, { contentType: 'video/quicktime' })
  if (error) throw error
  return supabase.storage.from('message-media').getPublicUrl(path).data.publicUrl
}

export async function uploadChatPhoto(pathPrefix: string, blob: Blob): Promise<string> {
  const path = `${pathPrefix}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('message-media')
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('message-media').getPublicUrl(path).data.publicUrl
}

export async function uploadChatFile(pathPrefix: string, file: File): Promise<string> {
  const path = `${pathPrefix}/${crypto.randomUUID()}_${file.name}`
  const { error } = await supabase.storage.from('message-media').upload(path, file)
  if (error) throw error
  return supabase.storage.from('message-media').getPublicUrl(path).data.publicUrl
}

export async function uploadChatAudio(pathPrefix: string, blob: Blob): Promise<string> {
  const path = `${pathPrefix}/${crypto.randomUUID()}.webm`
  const { error } = await supabase.storage.from('message-media')
    .upload(path, blob, { contentType: 'audio/webm' })
  if (error) throw error
  return supabase.storage.from('message-media').getPublicUrl(path).data.publicUrl
}

/** Resize a profile photo before upload so we aren't storing 12MP originals. */
export async function resizeForUpload(file: File, maxSide = 1000, quality = 0.85): Promise<Blob> {
  const b64 = await downscaleToBase64(file, maxSide, quality)
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: 'image/jpeg' })
}

// EventKit has no web equivalent, so accepting an event offers a calendar
// file / link instead of writing silently to the device calendar.
// Duration matches CalendarSync.addEvent's 90-minute default.

const DURATION_MINUTES = 90

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function buildICS(title: string, location: string, start: Date): string {
  const end = new Date(start.getTime() + DURATION_MINUTES * 60_000)
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zircl//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@zircl`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location ? `LOCATION:${esc(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

/** Triggers a .ics download the user can open in any calendar app. */
export function downloadICS(title: string, location: string, start: Date) {
  const blob = new Blob([buildICS(title, location, start)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^\w -]/g, '') || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function googleCalendarURL(title: string, location: string, start: Date): string {
  const end = new Date(start.getTime() + DURATION_MINUTES * 60_000)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    location,
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/** Browser notifications — the closest thing to the iOS local notifications. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try { new Notification(title, { body, icon: '/icon-192.png' }) } catch { /* ignore */ }
}

// Pure client-side link preview: no backend proxy exists to scrape Open
// Graph data from arbitrary sites (most block cross-origin fetches anyway),
// so this shows what's honestly available without one — the URL, its
// hostname, and a real favicon via Google's public, CORS-friendly favicon
// service — rather than faking a screenshot/description that isn't there.
const URL_RE = /https?:\/\/[^\s<]+[^\s<.,)]/i

export function firstURL(text: string): string | null {
  const m = URL_RE.exec(text)
  return m ? m[0] : null
}

export default function LinkPreview({ url }: { url: string }) {
  let hostname = url
  try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch { /* keep raw url */ }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2.5 rounded-field border border-line bg-surface
                 px-3 py-2.5 hover:border-line-hi transition-colors max-w-[320px]"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`}
        alt=""
        className="w-8 h-8 rounded-md shrink-0 bg-dusk-800"
        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
      />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink truncate">{hostname}</div>
        <div className="text-[12px] text-ink-2 truncate">{url}</div>
      </div>
    </a>
  )
}

# Zircl

One site, one domain (zircl.org), two apps:

| Path | What | Source |
|---|---|---|
| `/` | Marketing landing page | `src/` |
| `/app` | The Zircl product | `app/` |

Zircl helps you find people nearby who share your sports and hobbies.

The landing page is React 19 + Vite: WebGL aurora hero, scroll-driven animations, a
frame-by-frame scrubbed video, and a waitlist backed by Supabase. The app is a separate
React 18 + TypeScript project (Firebase auth, Supabase data, maplibre maps) that builds
into `dist/app` and is served from the same domain.

## Stack

- **React 19 + Vite** — no router, single page
- **[ogl](https://github.com/oframe/ogl)** — WebGL aurora background
- **[gsap](https://gsap.com/)** — typing/scroll effects
- **[lucide-react](https://lucide.dev/)** — icons
- **Supabase** — waitlist storage, RLS-protected, writes go through a rate-limited Edge Function (not a direct table insert)

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project's URL + anon key
npm run dev
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | oxlint |

## Waitlist backend

The waitlist table has RLS enabled with **no direct-insert policy** — the anon key alone cannot write to it. Signups go through a Supabase Edge Function that enforces a per-IP rate limit before inserting. Setup:

1. Run `supabase/migrations/002_waitlist_rate_limit.sql` in the Supabase SQL editor.
2. Deploy the function:
   ```bash
   supabase functions deploy join-waitlist --no-verify-jwt
   supabase secrets set ALLOWED_ORIGINS=https://zircl.org,https://www.zircl.org,http://localhost:5173
   ```

Until both steps are done, the waitlist form will show a generic error on submit. `ALLOWED_ORIGINS` is a comma-separated CORS allowlist — update it any time the deployed domain changes.

## Environment variables

See `.env.example`. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required — both are safe to expose client-side (that's what Supabase's anon key + RLS are designed for). No secret keys are used anywhere in this repo.

## The app at `/app`

`npm run build` builds both: the landing page to `dist/`, then the app into `dist/app`.
The app is already set up for the sub-path — `app/vite.config.ts` sets `base: '/app/'`
and `app/src/main.tsx` sets the router `basename` to `/app`, both only in production so
`npm --prefix app run dev` still works at the root.

Three things here are load-bearing. Changing any of them breaks the app in ways that are
easy to miss because the landing page keeps working fine:

**1. The two apps use different Supabase projects under the same variable name.**
Both read `VITE_SUPABASE_URL`, but the landing page means the waitlist project and the
app means the product project. They build in one process, and Vite lets `process.env`
win over `.env` files, so the landing page's value would silently override the app's.
`scripts/build-app.sh` clears the inherited vars and re-supplies the app's own from
`APP_SUPABASE_URL` / `APP_SUPABASE_PUBLISHABLE_KEY`. Set those two on the host; do **not**
set the app's values into `VITE_SUPABASE_URL`, or the live waitlist starts writing to the
wrong project.

**2. `/app` must be excluded from the site-wide header rule.** A browser handed two
`Content-Security-Policy` headers enforces their *intersection*, so if both rules matched,
the app would be clamped to the landing page's much stricter policy and Firebase auth,
map tiles, and realtime would all fail. Hence the `"/((?!app$|app/).*)"` source in
`vercel.json`. Verify after any change — each path must return exactly one:

```bash
curl -sI https://zircl.org/    | grep -ci content-security-policy   # 1
curl -sI https://zircl.org/app | grep -ci content-security-policy   # 1
```

**3. The `/app` policy needs more than it looks.** Every entry below was added because
something broke without it, and each failure is silent — the page still renders:

- `script-src https://apis.google.com` — Firebase's `signInWithPopup` loads
  `apis.google.com/js/api.js` to broker the popup. Without it the "Continue with Google"
  button does nothing at all, with no user-visible error.
- `frame-src https://apis.google.com` + `https://*.firebaseapp.com` — the auth iframe at
  `<authDomain>/__/auth/iframe`.
- `wss://*.supabase.co` — Supabase Realtime. Chat and live updates die silently without it.
- `worker-src` / `child-src blob:` — maplibre's workers.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` — `signInWithPopup` needs
  `window.opener` to survive; plain `same-origin` severs it and the popup can never hand
  the result back. No `COEP` on `/app` for the same reason.

To re-check after changing the policy, load `/app/login`, click "Continue with Google",
and confirm no `securitypolicyviolation` fires.

Assets under `/app` must be referenced as `/app/...`; a bare `/spirals.webp` resolves
against the landing page root and 404s.

## Deploying

Set on the host, scoped to Preview **and** Production:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — landing page (waitlist)
- `APP_SUPABASE_URL`, `APP_SUPABASE_PUBLISHABLE_KEY` — the app
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

Google sign-in also needs the deployed domain listed under Firebase console → project
`zircl-27869` → Authentication → Settings → Authorized domains. Without it, sign-in fails
with `auth/unauthorized-domain` even though everything else works.

## Project structure

```
src/                — landing page
  components/       — one component + co-located CSS per section
  lib/supabase.js   — waitlist signup (calls the Edge Function)
app/                — the Zircl product app, served at /app
  src/screens/      — 23 screens (feed, chat, clubs, activities, profile…)
  src/services/     — data layer over Supabase + Firebase
  functions/        — Firebase Cloud Functions
  supabase/         — the app's own migrations
scripts/
  build-app.sh      — builds app/ with its own Supabase env (see above)
public/
  zircl-frames/     — 380 JPEG frames for the scroll-scrubbed video section
supabase/
  migrations/       — SQL for the waitlist table + rate limiting
  functions/        — the join-waitlist Edge Function
```

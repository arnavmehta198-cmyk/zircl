# Zircl — Landing Page

Marketing landing page for [Zircl](https://zircl-27869.web.app), an app for finding people nearby who share your sports and hobbies.

Built with React + Vite. WebGL aurora hero, scroll-driven animations, a frame-by-frame scrubbed video, live activity stats, and a waitlist backed by Supabase.

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
   supabase secrets set ALLOWED_ORIGINS=https://your-domain.com
   ```

Until both steps are done, the waitlist form will show a generic error on submit.

## Environment variables

See `.env.example`. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required — both are safe to expose client-side (that's what Supabase's anon key + RLS are designed for). No secret keys are used anywhere in this repo.

## Project structure

```
src/
  components/     — one component + co-located CSS per section
  lib/supabase.js — waitlist signup (calls the Edge Function)
public/
  zircl-frames/   — 380 JPEG frames for the scroll-scrubbed video section
supabase/
  migrations/     — SQL for the waitlist table + rate limiting
  functions/      — the join-waitlist Edge Function
```

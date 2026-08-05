#!/bin/sh
# Builds the Zircl app (app/) for deployment under /app.
#
# WHY THIS EXISTS: the landing page and the app both read VITE_SUPABASE_URL,
# but they point at DIFFERENT Supabase projects:
#   landing -> waitlist project
#   app     -> the product's own project
#
# They are built in one process, so the landing page's env would otherwise
# leak into the app's build. Vite deliberately lets process.env win over
# .env files, so an inherited (or empty) VITE_SUPABASE_URL silently
# overrides app/.env and the app ends up pointing at the wrong database --
# or none at all.
#
# So: clear the inherited Supabase vars, then re-supply the app's own from
# APP_*. Locally APP_* are usually unset and app/.env fills them in; on
# Vercel, set APP_SUPABASE_URL and APP_SUPABASE_PUBLISHABLE_KEY.
set -e

unset VITE_SUPABASE_URL
unset VITE_SUPABASE_ANON_KEY
unset VITE_SUPABASE_PUBLISHABLE_KEY

if [ -n "$APP_SUPABASE_URL" ]; then
  export VITE_SUPABASE_URL="$APP_SUPABASE_URL"
fi
if [ -n "$APP_SUPABASE_PUBLISHABLE_KEY" ]; then
  export VITE_SUPABASE_PUBLISHABLE_KEY="$APP_SUPABASE_PUBLISHABLE_KEY"
fi

npm --prefix app run build

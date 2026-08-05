# Zircl Web

Web rebuild of the Zircl iOS app, running against the **same Firebase project**
(`zircl-27869`) — the same collections, the same documents, the same accounts.
Existing iOS users can sign in here and see their data.

Vite + React 18 + TypeScript + Tailwind + Firebase v10 + Leaflet. Installable
as a PWA (add to home screen).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run typecheck
```

Firebase config lives in `.env` (values derived from the iOS
`GoogleService-Info.plist`; the API key is accepted from browser origins).

## Deploy — Firebase Hosting (free tier, same project)

```bash
npm i -g firebase-tools
firebase login
firebase init hosting     # public dir: dist   |   single-page app: yes
npm run build
firebase deploy --only hosting
```

Because it's a single-page app, Hosting **must** rewrite all routes to
`/index.html` or deep links like `/clubs/abc` will 404 on refresh.

## Required Firestore indexes

`firestore.indexes.json` lists every composite index the app's queries need.
Deploy them with:

```bash
firebase deploy --only firestore:indexes
```

⚠️ **The `messages` collection-group index on `senderID` has never existed in
this project.** Account deletion sweeps authored messages with a
`collectionGroup` query that silently fails without it — on iOS the error was
swallowed by `try?`, so deletion has been quietly incomplete. The web app works
around this by deleting club messages per-club, but deploying the index is the
proper fix.

## Architecture

```
src/
  lib/         firebase init, shared types (mirror the Firestore schema), formatting
  services/    all business logic, ported 1:1 from the Swift view models
  context/     AppContext — auth + profile + plan, one live listener on users/{uid}
  components/  UI kit (ui.tsx), nav shell (Shell.tsx), chat widgets
  screens/     one file per screen, routed in App.tsx
```

`CONTRACT.md` documents the primitives and the business rules that must hold.

## Behaviour ported from iOS

- Free plan: 5 private messages/day, 3 follow requests/day, 2 events/month,
  club history capped at the last 15 messages. Club chat is **not** metered.
- Messaging requires a mutual follow (two accepted `followRequests` docs).
- Scheduled messages are written immediately and hidden client-side until due.
- Chat photos are raw base64 (700px, q0.5) inside the message document.
- Distance is always rounded up to whole miles.
- 18+ age gate; onboarding needs at least 3 hobbies.

## Deliberate differences from iOS

| iOS | Web |
|---|---|
| EventKit writes to the device calendar | `.ics` download + Google Calendar link (90-min duration) |
| Local notifications via `UNUserNotificationCenter` | Web Notifications; nothing fires while the tab is closed |
| MapKit | Leaflet + OpenStreetMap tiles |
| MapKit place search | Nominatim geocoding |
| Sign in with Apple | Not needed — no App Store review, so guideline 4.8 doesn't apply |
| StoreKit for Premium | Stripe is viable on the web; billing is still not wired up |

## Not wired up

- **Billing.** The Premium toggle flips `users/{uid}.plan` directly. No payment
  is taken. Wire Stripe Checkout before charging anyone.
- **Push notifications.** Only in-tab notifications work today.
- `AlgorithmSettings.prioritizeNearby` and `maxDistance` are stored but not
  applied to the feed — same as the iOS app, and the UI now says so.

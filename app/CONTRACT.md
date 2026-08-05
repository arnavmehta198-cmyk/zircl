# Zircl Web — build contract

Rebuild of the Zircl iOS SwiftUI app as a React web app against the **same
Firebase project**. Field names and business rules must match the iOS app
exactly — real user data already exists in these collections.

Stack: **Vite + React 18 + TypeScript + Tailwind + react-router-dom v6 + Firebase v10 JS SDK.**
**Do not add dependencies.** Only `firebase`, `react`, `react-dom`, `react-router-dom`, `leaflet` are installed.

Every screen file default-exports a React component taking no props.

## Theme (ported from ZirclTheme.swift — use these Tailwind classes)

| Token | Class | Value |
|---|---|---|
| accent (blue) | `bg-accent` `text-accent` `border-accent` | `#2f6fed` |
| amber | `bg-amber` | `#e8a838` |
| page background | `bg-page` | `#faf5de` warm cream — **every screen** |
| card surface | `bg-card` | `#fffae8` cream, deliberately NOT white |
| iOS system gray | `bg-sysgray` | `#f2f2f7` (chat input, incoming bubbles) |
| corner radius 14 | `rounded-zircl` | |
| field height 50 | `h-field` | |
| shadows | `card-shadow` / `card-shadow-md` / `card-shadow-lg` | |
| frosted material | `material` / `material-dark` | backdrop blur |

Spacing scale: 8 / 16 / 32 / 48. Cards use `rounded-2xl` (16px) for list rows,
`rounded-zircl` (14px) for form sections. **Never use white backgrounds** —
the user specifically disliked white; use `bg-card`.

Layout: mobile-first, but must look right on desktop — center content with
`max-w-md mx-auto` (or `max-w-2xl` for wide screens) rather than stretching.

## Available primitives

### `src/components/ui.tsx`
`PrimaryButton({title,onClick,isLoading,disabled,className})` — full-width accent, h-50
`SecondaryButton({title,onClick,icon,className})` — outlined accent, h-52
`TextField({value,onChange,placeholder,type,inputMode,autoComplete})`
`Spinner({className})`
`ProfileAvatar({photoURL,size,name})` — circular, falls back to initial
`Card({children,className})` — cream surface + shadow
`SectionCard({title,icon,subtitle,children})` — form section card w/ accent header
`EmptyState({icon,title,description})` — emoji + title + description
`HobbyChip({label,icon,selected,onClick,variant})` — `variant="select"` pill | `"amber"` tag
`Sheet({open,onClose,title,children,footer})` — bottom sheet on mobile, modal on desktop; `footer` is the confirm button
`AlertDialog({open,title,message,confirmLabel,destructive,onConfirm,onCancel})`
`Menu({trigger,items})` — items: `{label,icon?,destructive?,onClick}`; opens upward
`Toast({message})` — green pill, fixed top

### `src/components/Shell.tsx`
`Screen({children})` — render-prop wrapper providing page bg + sidebar:
```tsx
<Screen>{({ openMenu }) => ( ...your screen... )}</Screen>
```
`ZirclHeader({search,onSearch,onMenu,onNotifications,showAvatar})` — search + bell + avatar row
`TopBar({title,onMenu,trailing})` — hamburger + centered title
`BackBar({title,trailing})` — back chevron + centered title (for pushed screens)
`TABS` — the 8 sidebar destinations

### `src/context/AppContext.tsx`
`useApp()` → `{ user, loadingAuth, hasCompletedOnboarding, profile:{name,photoURL,hobbies}, plan, isPremium, signOut, refreshOnboarding }`
`useUID()` → current uid string

### `src/lib/`
`types.ts` — `HOBBIES` (13 strings), `Hobby`, `MessageKind`, `REPORT_REASONS`, `FreePlanLimits`, and interfaces `UserProfile FeedUser Conversation ChatMessage Club ClubMember ScheduledEvent ViewedPerson`
`hobbies.ts` — `hobbyIcon(hobby): string` (emoji)
`format.ts` — `ageFrom(dob)`, `milesBetween(lat1,lon1,lat2,lon2)`, `distanceText(miles)`, `timeOnly(d)`, `shortDateTime(d)`, `dayKey()`, `monthKey()`
`firebase.ts` — `auth db storage googleProvider app`

### `src/services/`
`usage.ts` — `isPremium canSendMessage canSendFollowRequest canScheduleEvent remainingMessagesToday remainingFollowRequestsToday remainingEventsThisMonth setPlan`
  (the `canX` fns CONSUME the quota and return false when exhausted)
`friendship.ts` — `isMutualFollow friendIDs sendFollowRequest acceptRequest declineRequest pendingIncoming pendingOutgoing`
`social.ts` — `block unblock isBlocked blockedEitherDirection submitReport`
`messaging.ts` — `conversationID decodeMessage applySchedule isPending listenToMessages listenToConversations markRead sendDirect sendClub payloads votePoll rsvp loadIdentity`
`clubs.ts` — `fetchAll listenToClub createClub join leave kick ban fetchMembers recommend`
`events.ts` — `createEvent fetchAll respond`
`feed.ts` — `FeedDeck` class (`bootstrap() replenish() pop(user,dwell,liked) deck tracker`), `filterDeck`
`media.ts` — `downscaleToBase64 base64Src uploadProfilePhoto deleteProfilePhoto uploadVideo resizeForUpload`
`prefs.ts` — `loadAlgorithmSettings saveAlgorithmSettings loadRecentlyViewed recordViewed`
`calendar.ts` — `downloadICS googleCalendarURL requestNotificationPermission notify buildICS`
`account.ts` — `deleteAccount purgeAllData`

## Shared chat components (owned by the messaging batch; others import)

`src/components/chat/MessageBubble.tsx`
```ts
export default function MessageBubble(props: {
  message: ChatMessage; myUID: string
  onVote: (m: ChatMessage, option: string) => void
  onRSVP: (m: ChatMessage, attending: boolean) => void
  senderLabel?: string            // shown above incoming bubbles in group chats
}): JSX.Element
```
`src/components/chat/Composer.tsx`
```ts
export default function Composer(props: {
  onSend: (fields: Record<string, unknown>, preview: string, scheduledFor: Date | null) => void | Promise<void>
  videoPathPrefix: string          // conversation id, or `club_${clubID}`
  disabled?: boolean
}): JSX.Element
```
Composer owns the "+" menu (Photo, Video, Sticker, GIF, Poll, Event, Send Later),
all picker sheets, the schedule banner, the text input and send button.

`src/components/ReportSheet.tsx`
```ts
export default function ReportSheet(props: {
  open: boolean; onClose: () => void; reportedName: string
  onSubmit: (reason: ReportReason, details: string) => void
}): JSX.Element
```
`src/components/NotificationsSheet.tsx`
```ts
export default function NotificationsSheet(props: { open: boolean; onClose: () => void; uid: string }): JSX.Element
```

## Business rules that MUST be preserved

- **Free plan**: 5 private messages/day, 3 follow requests/day, 2 events/month, club history capped at last 15 messages. Club chat messages are **NOT** metered.
- **Messaging requires a mutual follow** (two accepted `followRequests` docs, one each way). Otherwise show the locked banner: "You can only message people who follow you back."
- **Club posting**: `canSend = isMember && (!isAdminControlled || isAdmin)`. Locked copy: "Join this club to see and send messages." / "This is an admin-controlled club — only admins can post."
- **Scheduled messages** are written immediately with `scheduledFor` and hidden client-side until due (`applySchedule`); the sender always sees their own, labelled "Scheduled h:mm". Re-filter on a 5s interval.
- **Chat photos** are raw base64 in the message doc (no `data:` prefix) — render with `base64Src()`.
- **Distance is always rounded up** to whole miles — never show a precise distance.
- **Age gate**: 18+. Under 18 is a terminal dead-end whose only action is Sign Out.
- **Onboarding requires ≥3 hobbies.**
- EventKit doesn't exist on web: accepting an event offers `downloadICS()` / `googleCalendarURL()` instead.

## Conventions

- `import { ... } from '../lib/types'` (relative paths, no path alias).
- Strict TypeScript — no `any` unless unavoidable.
- Guard every Firestore call; a failed read should degrade gracefully, not crash.
- Comment only where intent is non-obvious (a quirk, a ported rule). No narrating comments.
- Empty states matter — every list needs one.

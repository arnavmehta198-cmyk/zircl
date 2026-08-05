# Zircl Web — redesign contract (v2)

Goal: stop looking like an iOS app in a browser. Desktop-first layout, real
information density, hover/focus states, multi-column where it helps.

## What changed (breaking)

`Screen`, `ZirclHeader`, `TopBar`, `BackBar`, `Sidebar`, `MenuButton` are **gone**.

### `components/Shell.tsx`
```tsx
<AppLayout title="Clubs" description="optional subtitle" actions={<…>} wide bleed>…</AppLayout>
<SubPage title="Edit profile" description="…" backTo="/profile" wide>…</SubPage>
<SearchInput value={q} onChange={setQ} placeholder="Search clubs" className="w-[260px]" />
<NotificationsButton onClick={…} />
TABS  // [{ path, title, Icon }]
```
- `AppLayout` renders the permanent sidebar (desktop) / drawer (mobile), the top
  bar, the `<h2>` page title + description, and a content container.
- `wide` → 1200px container (grids, maps). Default → 760px (reading width).
- `bleed` → no container/padding at all, page fills the pane (map, chat).
- `actions` sits on the right of the top bar — put `SearchInput`,
  `NotificationsButton`, primary CTA buttons there.
- **Do not** add your own back chevron; `SubPage` provides "‹ Back".

### `components/ui.tsx`
```tsx
<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" icon={<Icon.Plus/>} isLoading fullWidth>Label</Button>
<TextField value onChange placeholder label hint type inputMode autoComplete />
<TextArea value onChange placeholder rows label />
<Field label hint>{custom input}</Field>
<Card hover as="button" onClick className>…</Card>
<SectionCard title subtitle icon={<Icon.Clock/>}>…</SectionCard>
<EmptyState icon={<Icon.Messages size={28}/>} title description action={<Button…/>} />
<Chip label selected onClick tone="select|tag" icon />
<Sheet open onClose title footer={<Button size="sm">Save</Button>}>…</Sheet>
<AlertDialog open title message confirmLabel destructive onConfirm onCancel />
<Menu trigger={<Icon.More/>} items={[{label, icon, destructive, onClick}]} align="left|right" />
<Toast message /> <Spinner /> <ProfileAvatar photoURL size name />
```
`PrimaryButton`, `SecondaryButton`, `HobbyChip` still exist as thin aliases.

### `components/icons.tsx`
`import { Icon } from '../components/icons'` → `<Icon.Feed size={18} className="text-ink-3" />`
Available: Feed Clubs Messages Schedule Calendar Activities Profile Premium Menu
Bell Search ChevronLeft ChevronRight Plus Close Send More Lock Pin Heart Check
Camera Trash Shield Sliders Clock Logout Flag Ban Image Video Smile Poll Gif Users History

**No emoji in UI chrome** — nav, buttons, section headers, empty states, menus all
use `Icon.*`. Emoji stays ONLY for hobby glyphs (`hobbyIcon()`) and chat stickers.

## Tokens

| Use | Class |
|---|---|
| app background | `bg-page` (#f7f4ec) |
| cards / bars | `bg-surface` (#fffdf7), hover `bg-raised` |
| borders | `border-line` (#e7e1d3) — **borders, not shadows**, carry the structure |
| text | `text-ink` / `text-ink-2` (secondary) / `text-ink-3` (tertiary) |
| brand | `bg-accent` `text-accent` `bg-accent-soft` |
| hobby accent | `bg-amber` `bg-amber-soft` |
| shadows | `shadow-card` (rest), `shadow-pop` (overlays) — nothing heavier |
| radius | `rounded-lg` controls, `rounded-xl` cards |

Type scale: page `<h2>` 26/30px bold (AppLayout renders it), section 15px semibold,
body 14–14.5px, secondary 13px, meta 12.5px. Line-height relaxed on paragraphs.

## Layout rules — these are the anti-iOS rules

1. **Use the width.** Lists of peers (clubs, friends, recently viewed, calendar
   events, conversations) go in a responsive grid: `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`
   with `wide` on `AppLayout`. A single 375px column stranded in a 1440px window is
   the #1 tell.
2. **Left-align.** Page titles, section headers, empty states inside cards. Centred
   nav titles are an iOS convention.
3. **Hover + focus on every interactive element.** `card-hover`, `hover:bg-black/[0.05]`,
   `transition-colors`. Phones have no hover; the web does, and its absence is felt.
4. **Borders over shadows.** One hairline `border-line` beats a drop shadow.
5. **No full-width stacked CTAs on desktop.** `fullWidth` only under `sm:`; otherwise
   `size="md"` buttons sized to their label, right-aligned in a row.
6. **Rows, not cards, for dense lists.** Conversation/member/friend rows work as
   `divide-y divide-line` inside ONE card, not N floating cards.
7. **Tap targets ≥36px but not 58px.** iOS row heights look enormous on a monitor.
8. Empty states get an `Icon`, a heading, a sentence, and usually an action button.

## Keep unchanged

Every business rule, Firestore field name, and service call. This is a
presentation-layer change only. Do not touch `src/services/**` or `src/lib/**`.

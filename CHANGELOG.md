# Changelog

All notable changes to mysetlists.net are documented here.

---

## [4.0.0] — 2026-04-20

### Overview
Version 4.0 is a full design-system overhaul. Every screen has been rebuilt on a unified set of UI primitives, a consistent token-based Tailwind theme, and a new layout shell — while preserving all live data fetching, Firebase auth, and routing behaviour from v3.

---

### New: UI Primitive Library (`components/ui/`)

17 composable primitives replace one-off inline patterns throughout the codebase:

| Component | Purpose |
|-----------|---------|
| `Avatar` | User/artist avatar with fallback initials |
| `Badge` | Status and count badges |
| `Button` | Primary / secondary / ghost / danger variants |
| `Card` | Surface card with hover and active states |
| `Divider` | Horizontal rule with optional label |
| `EmptyState` | Illustrated empty-list placeholder |
| `Input` | Text input with label, error, and icon slots |
| `Modal` | Accessible dialog with backdrop dismiss |
| `PageHeader` | Page title + subtitle + action slot |
| `RatingStars` | Interactive 1–5 star rating |
| `SearchField` | Debounced search input |
| `SectionHeader` | Section heading with optional action |
| `Select` | Styled native select |
| `Skeleton` | Loading placeholder blocks |
| `Spinner` | Animated loading indicator |
| `StatTile` | KPI tile (value + label + trend) |
| `Tabs` | Horizontal tab bar |
| `Tag` | Pill label for genres/tags |
| `Textarea` | Multi-line input |
| `Tooltip` | Hover tooltip |

All primitives are exported from `components/ui/index.js` for single-import convenience.

---

### New: App Shell & Layout (`components/layout/`)

- **`AppShell`** — Root layout wrapper; wires sidebar (desktop) and mobile header/tab-bar together
- **`Sidebar`** — Collapsible desktop navigation with brand mark, nav links, and user avatar
- **`MobileHeader`** — Top bar for mobile with logo and notification slot
- **`MobileTabBar`** — Bottom tab bar for mobile (Shows / Stats / Search / Friends / Profile)
- **`AppFooter`** — Minimal footer with version and links

---

### New: Feature Components

**Shows**
- `ShowCard` — Grid card with cover art, artist, venue, date, and rating
- `ShowRow` — Compact list row variant
- `ShowHero` — Full-bleed hero for the show detail view
- `ShowCover` — Responsive cover image with gradient overlay
- `SetlistView` — Segmented setlist display with song numbers and encore marker
- `SideCard` — Sidebar related-show card

**Stats**
- `TopList` — Ranked list with bar-chart visualisation
- `YearHeatmap` — GitHub-style activity heatmap by year

**Profile**
- `ProfileHero` — User cover + avatar + display name header
- `AchievementCard` — Badge/milestone card

**Friends**
- `FriendCard` — Friend avatar, name, mutual-shows count, and action buttons

**Search**
- `SearchBox` — Full search UI with instant results
- `ResultRow` — Unified result row for artists, venues, and shows

**Upcoming**
- `UpcomingItem` — Upcoming-show list item with ticket-link CTA

---

### New: Brand Components (`components/brand/`)

- `LogoMark` — SVG pin icon, scalable
- `Wordmark` — "mysetlists.net" lockup (green + orange + gray)
- `Pick` — Standalone location-pin icon component

---

### Updated: App Pages

All pages in `app/` now import from the design system instead of ad-hoc markup:

- `app/shows/page.jsx` — Rebuilt with `ShowCard`, `PageHeader`, `AppShell`
- `app/stats/page.jsx` — Rebuilt with `StatTile`, `TopList`, `YearHeatmap`, `Tabs`
- `app/friends/page.jsx` — Rebuilt with `FriendCard`, `EmptyState`
- `app/profile/page.jsx` — Rebuilt with `ProfileHero`, `AchievementCard`, `StatTile`
- `app/search/page.jsx` — Rebuilt with `SearchBox`, `ResultRow`
- `app/upcoming/page.jsx` — Rebuilt with `UpcomingItem`, `EmptyState`

Real Firebase/API data fetching is **unchanged** — only presentation layer swapped.

---

### Updated: Tailwind Design Tokens

`tailwind.config.js` now maps CSS custom properties to semantic token names:

```
brand.DEFAULT / brand.light / brand.subtle   → green palette
amber.DEFAULT / amber.light / amber.subtle   → orange palette
base / surface / elevated / hover / sidebar  → background layers
subtle / active                              → border strengths
primary / secondary / muted                  → text hierarchy
success / danger                             → semantic states
theme-sm / theme-md / theme-lg / theme-xl   → shadow scale
```

---

### Updated: Streaming Links

- New `components/StreamingLinks.jsx` — renders Spotify, Apple Music, YouTube, and Bandcamp links from `lib/streamingPlatforms.js`
- `lib/streamingPlatforms.js` — platform metadata and deep-link helpers

---

### Other Changes

- `components/LandingPage.jsx` — Refreshed with new brand components and design tokens
- `components/SetlistEditor.jsx`, `ShowForm.jsx`, `TagFriendsModal.jsx` — Refactored to use UI primitives
- `components/WhatsNewModal.jsx` — Updated to surface v4.0 release notes in-app
- `e2e/` smoke tests updated for new component selectors

---

## [3.17.0] and earlier

See git history for previous release details.

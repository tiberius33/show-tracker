# Changelog

All notable changes to mysetlists.net are documented here.

---

## [5.26.0] — 2026-08-31

### Changed: Bust-Out Severity
- Severity now weighs both shows and time since a song was last played, taking whichever band it clears first: minor at 50+ shows or 1+ year, major at 100+ shows or 2+ years, epic at 5+ years (no show-count band for epic).
- `netlify/functions/get-artist-song-stats.js` now also returns `showDates` (every distinct date the artist played across the fetched setlists) so "shows since" can be counted, not just days elapsed.
- The Profile setting is now a Sensitivity multiplier (`userProfiles/{uid}.bustOutSensitivity`, replacing `bustOutThresholdDays`) that scales both dimensions of every band together.

### New: Wishlist Last-Played
- The Wishlist column on `/wishlist` now shows how long it's been since each starred song was last played live, computed from the same setlist.fm catalog data already fetched for that page — no new call.

### Technical
- `lib/utils.js` gains `humanizeGapDuration` (moved out of `SongDetailView.jsx`, now shared with `WishlistView.jsx`).
- `hooks/useBustOutThreshold.js` replaced by `hooks/useBustOutSensitivity.js`.

---

## [5.25.0] — 2026-08-31

### New: Bust-Out Detection
- Setlists automatically flag bust-outs — songs returning after a significant absence — directly on the song name, no manual tagging required.
- Severity bands: 🔥 minor (90–180 days), 🔥🔥 major (180–365 days), 🔥🔥🔥 epic (1+ year). Tapping a badge expands the previous performance's date/venue with a link to it.
- User-configurable threshold (30/60/90/180/365 days) at Profile → Bust-Out Threshold, stored on `userProfiles/{uid}.bustOutThresholdDays`.
- Show detail pages get a "This show featured N bust-outs" sidebar card; song pages show the user's own personal bust-out status via their existing gap data.

### Technical
- `lib/bustOuts.js` computes bust-outs on demand from an artist's setlist.fm play history (reuses `get-artist-song-stats`, sharing its existing `song_stats_${mbid}` cache) merged with the user's own logged performances — no new Firestore collection, Cloud Function, or background job. This also means historical shows get bust-out flags immediately on first view, with no batch backfill needed.
- New: `hooks/useBustOutAnalysis.js`, `hooks/useBustOutThreshold.js`, `components/profile/BustOutSettings.jsx`.
- Unit tests: `lib/__tests__/bustOuts.test.js`.

---

## [5.24.0] — 2026-08-31

### New: Venue Bucket List
- Add a venue (not a specific show) to your Bucket List — a new "Venues" tab on `/bucket-list`, and an "Add to Bucket List" button on every venue page.
- Daily scheduled job (`netlify/functions/venue-bucket-list-notifications.js`) cross-references favorite artists' upcoming Ticketmaster listings against every user's bucket-list venues and sends a `venue_bucket_list_match` notification (push/email/both, configurable in Profile → Notifications) on a hit.
- New Firestore collection: `bucketListVenues`. Requires `npm run deploy:rules`.

---

## [5.23.0] — 2026-08-31

### New: Venue Verification
- Venue owners/managers apply to verify a venue (proof of ownership/management upload); reviewed in a new admin dashboard at `/admin/venue-verifications`.
- Verified venues show a blue checkmark, get a Venue Management Dashboard (`/venue-dashboard/[venueKey]`) to edit info, upload official photos, and post announcements.
- Users can report unverified venues claiming to be official, duplicates, or inaccurate listings.
- Introduces the app's first real Venue entity (`venues` collection + `/venues/[venueKey]` page) — previously venues only existed as denormalized text on each show.

### New: Year in Review
- Automatic annual concert recap (top artist, favorite venue, most-heard song, top-rated shows, achievements/milestones) at `/year-in-review/[userId]/[year]`, surfaced via a home-page banner mid-December through February.
- Shareable as a downloadable image (canvas-rendered), native share sheet, Twitter, email, or a public link with a per-year privacy toggle.

### Technical
- New Firestore collections: `venues`, `venueVerificationApplications`, `venueAnnouncements`, `venuePhotos`, `venueReports`, `yearInReviews`.
- New Storage paths: `venueVerificationDocs/`, `venuePhotos/`.
- Requires `npm run deploy:rules` before these features work in production.

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

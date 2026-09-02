# Changelog

All notable changes to mysetlists.net are documented here.

---

## [5.29.1] — 2026-09-02

### Changed: Festival Lineup Search Uses the Festival's Own City and Dates
- The lineup search no longer asks you to type anything. A festival already knows its name, location and date range, so the search just uses them — the modal shows what it's searching and you press one button.
- **How it finds a lineup now:** setlist.fm has no festival entity *and no date-range parameter* — only an exact `date` and a `year`. A festival is therefore reconstructed as "everything logged in this city on these days", querying one exact date per festival day. This matters: a year-scoped city query returns that city's whole year newest-first, so for anywhere busier than a small town the festival's dates fall off the end long before the page cap. The per-day query returns the festival and nothing else.
- City is now the primary key rather than the venue, because a festival's setlist.fm venue is its grounds, not its name — BottleRock is logged at "Napa Valley Expo", Bonnaroo at "Great Stage Park". Searching the city on the right days finds those without having to know either. Venue-name resolution, and a year-scoped venue/tour-name search, remain as fallbacks when a festival has no location set.
- **New "By artist" mode** — for a festival setlist.fm covers thinly, type just the band you saw; the dates and city are already filled in from the festival. Same bulk-select, same dedup, same one-action add.
- A festival with no location gets a note explaining that adding its city sharpens the search, rather than silently returning worse results.

### Technical
- `netlify/functions/search-festival-lineup.js` reworked around day-scoped queries: `daysInWindow` enumerates the festival's days in UTC (so month/year boundaries are exact and no local timezone shifts a day, capped at 10), and each day's query is issued in parallel rather than in series. Strategy order is now city+date → venue+date → venue+year → tour/venue-name, with the chosen one reported back as `strategy` for debugging. New `artist` parameter drives the single-artist mode.
- Unit tests: 11 new cases in `lib/__tests__/festivalLineup.test.js` covering day enumeration (multi-day, single-day, month and year boundaries, the cap, malformed and reversed windows) and location parsing.

---

## [5.29.0] — 2026-09-02

### Fixed: Festivals You'd Already Created Didn't Open
- Root cause: 5.28.0 moved a festival's detail page onto a `/festivals/<id>` dynamic route. This app is a static export (`output: 'export'`), where a dynamic segment only ever serves the exact paths listed in `generateStaticParams` — in practice just the `_` placeholder. Every real festival id fell through `netlify.toml`'s `/* → /index.html` catch-all, which boots the app on the My Shows page: clicking one of your festivals silently dumped you somewhere else, so festivals you'd created looked like they'd vanished. (The same constraint is why `/songs`, `/runs` and `/tours` all use query params.)
- Festival detail now lives at `/festivals/?festival=<id>`, the form 5.28.0 had been *redirecting away from*. Old `/festivals/<id>` links 301 to the new URL.
- The list also shows a loading state on first paint instead of the "no festivals yet" empty state, and a festival read that Firestore rejects now says so rather than looking like an empty account.
- Fixed a related crash: every error path in the app calls `setToast({ message, type })`, but the toast rendered its value directly as a React child — an object, which throws and takes the whole page down. So a failed festival write showed a blank screen instead of an error. Toasts now render the message (in red for errors).
- The create/edit festival form no longer keeps the previous festival's values the next time it's opened.

### New: Search a Festival's Lineup and Bulk-Add the Bands You Saw
- Adding shows to a festival no longer means picking one at a time from shows you'd already logged. "Search lineup" on a festival looks the event up on setlist.fm and returns every band that played it inside the festival's own dates, as one checkbox list — tick everyone you actually saw, add them all in one action.
- Each pick does double duty: it's logged as one of your shows (with its full setlist, same as a normal setlist.fm import) *and* attached to the festival.
- Anything you'd already logged is detected and attached rather than duplicated, using the same artist + venue + date check the manual add and setlist.fm import already run. Already-logged results are labelled as such in the list.
- A set that's already in a *different* festival is reported instead of being moved silently, with a "move it here anyway" confirmation — same behaviour as the existing picker.
- If setlist.fm has no lineup for what you typed, the search says so and points you back at the "pick from my own shows" flow. Festival creation never depends on the search succeeding.

### New: Tours Filtering, Favorites, and First-Timers
- The Tours list gains filters for year, artist, and favorites, plus a text filter, and now sorts by the number of stops you caught by default (the tour you followed hardest first) — with Recent / Artist / Rating as alternatives.
- Tours can be starred as favorites, from either the list or a tour's page. Same star convention as the Wishlist.
- A tour's page gains "New songs on this tour": every song whose first-ever performance in *your* logged history landed on one of that tour's stops, with the date and venue you first heard it and a link to the song's page. A tour with no first-timers gets a proper empty state.
- Everything on a tour's page that represents something else now links to it: each stop opens that show, the artist and each stop's venue drill into your shows there, and every new song opens its song page — with the same chevrons and hover states as the rest of the app.
- A show's tour name is now a link to that tour, on both the show detail header and the Show Stats card. Shows whose tour name doesn't resolve to a tour in your history stay plain text rather than linking somewhere empty.

### Changed: Wishlist Page Order
- The per-artist Wishlist now reads, top to bottom: **Songs I want to see** (your starred songs), **All songs**, then **The songs I've seen** — stacked full-width rather than side-by-side columns, so it reads the same way on a phone.
- "All songs" is new: setlist.fm's full live catalog for that artist unioned with everything you've logged, so seen, unseen and starred songs are all in one list, all starrable, with play counts and a "you've seen this N×" marker. It replaces the old "songs you haven't seen" list rather than adding a fourth section.
- Star toggles, play counts and persistence are unchanged.

### Technical
- New `lib/favoriteTours.js` + `hooks/useFavoriteTours.js` — one `favoriteTours/{uid}` doc holding a map of starred tour keys. Top-level collection + owner-uid field, the same shape (and for the same security-rule reason) as `wishlists`; `firestore.rules` gains a matching owner-only block including the `resource == null` read clause.
- New `netlify/functions/search-festival-lineup.js`. setlist.fm has no festival entity and no date-range parameter, so a festival lookup resolves the typed name to venues via `/search/venues`, pages that venue's `/search/setlists` for the year, filters to the festival's window client-side, and collapses to one entry per artist/date (keeping the fuller setlist when an artist played twice in a day). Caches into the existing `setlistCache` collection under a `festival_` key prefix.
- New `importShowsToFestival` in `context/AppContext.jsx`: one batched Firestore write for the new shows, then the existing `attachShowsToFestival` for all of them, so there's still only one attach path. It doesn't loop `addShow`, which derives its doc id from `Date.now()` and closes over the current `shows` array — N calls in a row would collide ids and clobber state.
- `lib/runIndex.js` gains `tourHref`, per-tour `years`, and `newSongsOnTour` (cross-references a tour's stops against `lib/songIndex.js`'s existing `firstSeen`, rather than aggregating performances a second time). `lib/festivalGrouping.js` gains `festivalHref`, now the single source for festival links.
- Removed `app/festivals/[festivalId]/`; `app/festivals/page.jsx` serves both list and detail.
- Unit tests: 7 new cases in `lib/__tests__/runIndex.test.js`, new `lib/__tests__/festivalLineup.test.js` (8 cases).

---

## [5.28.0] — 2026-09-01

### New: Create & Manage Festivals
- Festivals are now something you create, not something the app guesses at: give one a name, a date range, an optional location and notes, then attach any of your existing shows to it from a searchable picker (defaults to shows within the festival's dates, but you can search outside that range too).
- The Festival detail page groups your attached shows by day, lists every artist you caught (each linking to that artist's shows), and shows attended / distinct artists / days / your average rating across the festival.
- Shows attached to a festival get a small badge on the Shows list and on the show detail page (alongside the "Night N of M" run badge when both apply — a show can be part of a run and a festival at the same time).
- A show can only belong to one festival at a time — trying to attach a show that's already in a different one surfaces that instead of silently double-attaching, so you can choose to move it.
- Deleting a festival only removes the grouping — the shows in it are never touched.
- **Known limitation:** festivals are private to the account that creates them (same per-user storage as the rest of your data) — they aren't shared or deduplicated across users yet. Two friends at the same festival each create and maintain their own copy. A cross-user festival directory is a possible future migration, not part of this release.

### Changed: Tours Get Their Own Page; Notifications & Activity Move Under Profile
- Tours moves out from a tab on the Shows page into its own sidebar entry at `/tours`, with a proper landing list (sorted most-recent-first) in addition to the existing per-tour detail view.
- Notifications and Activity are no longer top-level sidebar entries — they're now reached from the Profile page (same pattern as the existing Friends link), at their same URLs (`/notifications`, `/activity`). Profile's sidebar badge now combines pending friend requests/invites and unread notifications, since it's the one place that count surfaces now.

### Removed: Auto-Detected Festivals
- The 5.27.0 "Tag a Show as a Festival" auto-detection/tagging feature (`lib/festivalIndex.js`, the `isFestival`/`festivalName` fields on Show, the "Tag as festival" control on the show detail page) is fully replaced by the explicit model above. Old tagged shows keep their `isFestival`/`festivalName` fields in Firestore as harmless orphaned data — the app simply no longer reads them.

### Technical
- New per-user Firestore subcollection `users/{uid}/festivals/{festivalId}` — `{ name, startDate, endDate, location, notes, createdAt, updatedAt }`. The link to a show is `festivalId` on the Show doc (not `showIds` on the Festival) since shows are already loaded in full into `AppContext`, making a client-side filter by festivalId cheap and always in sync.
- `context/AppContext.jsx` gains Festival CRUD (`createFestival`, `updateFestivalData`, `deleteFestival`) plus `attachShowsToFestival` (single batch write, enforces one-festival-per-show) and `detachShowsFromFestival`.
- New `lib/festivalGrouping.js` (pure day-grouping/stats over a festival's attached shows, reusing `formatDate`/`parseDate` so a festival spanning a year boundary groups correctly) wrapped by `hooks/useFestivalShows.js`, mirroring the existing `lib/runIndex.js` / `hooks/useRunIndex.js` pattern.
- New dynamic route `app/festivals/[festivalId]/`, following the same pattern as `app/shows/[id]/`; the old `/festivals/?festival=` query-param form now redirects to it.
- `firestore.rules` gains an owner-only rule for the new `festivals` subcollection; no new composite index was needed since all festival reads run client-side against the already-loaded `shows` array.
- Also includes the one-time changelog popup shown after login, shipped just after 5.27.0 but not previously called out here.

---

## [5.27.0] — 2026-08-31

### New: Tag a Show as a Festival
- Show detail pages get a "Tag as festival" control — name it (e.g. "Bonnaroo 2023") and it now shows up under the Festivals tab, even if you only logged one artist's set there.
- Festival grouping (`lib/festivalIndex.js`) previously only auto-detected a festival when 2+ distinct artists shared the same tour name — the common case of logging just your own artist's set at a festival was invisible to it. A manually tagged show now forms (or merges into) a festival group on its own.
- Tagged and auto-detected shows for the same event name merge into a single festival rather than splitting into two.

### Technical
- `Show` documents gain optional `isFestival` (boolean) and `festivalName` (string) fields, written via the existing generic `updateShowData`.
- Unit tests: 4 new cases in `lib/__tests__/festivalIndex.test.js`.

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

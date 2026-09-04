# Changelog

All notable changes to mysetlists.net are documented here.

---

## [Unreleased]

### Fixed: The Cookie Banner Never Unmounts, and the Authenticated Tests Hung on It
- With sign-in finally working, all 8 `smoke-auth` tests failed in `beforeEach` with a 30s timeout in `dismissCookieBanner`. The call log shows it waiting on `…filter({ hasText: /cookie|accept/i }).getByRole('button').first()` — the container matched, the button never resolved.
- `CookieConsentBanner` stays mounted by design (a freshly-inserted fixed element counts toward Cumulative Layout Shift; a transform on an existing one does not). Dismissed, it keeps its `fixed bottom-0` classes and slides away with `translate-y-full pointer-events-none`, setting `aria-hidden="true"`.
- Playwright's two notions of "there" then disagree. `isVisible()` is layout-based: a translated element still has a non-empty bounding box, so the dismissed banner answers **true**. `getByRole()` reads the accessibility tree, where an `aria-hidden` subtree has no buttons. The guard passed and the click waited out the whole test timeout for a button that could not appear.
- Only the authenticated specs were affected, which is why #287 didn't catch it: they restore the storage state `auth.setup.js` captures *after* accepting the banner, so they start with `cookie-consent` already set and the banner already hidden. A signed-out test gets a fresh context and sees the real banner.
- The helper now anchors on the button rather than the container, so both halves agree — no accessible button means dismissed, and it falls through in 2s. The click is bounded to 5s so any future variant costs seconds rather than the full timeout, and the post-click wait watches the button leave the accessibility tree instead of waiting for a container that never goes away.

### Fixed: The Smoke Tests Were Rate-Limiting Themselves Out of Existence
- Every authenticated smoke test signed in for itself: four standalone calls in `auth.smoke.spec.js`, a `beforeEach` across the five tests in `shows.smoke.spec.js`, and a deliberate wrong-password attempt. Ten Firebase sign-ins per run, twenty with `retries: 1`, all from one CI IP against one account. Firebase throttles exactly that, and the block outlives the run — so the suite failed with `auth/too-many-requests` ("Too many attempts. Please try again later.") and stayed failed. The tests were not detecting a broken app or bad credentials; they were breaking themselves.
- New `e2e/auth.setup.js` signs in **once** per run as a Playwright setup project and saves the session; the authenticated specs opt into it with `test.use({ storageState })`. Only the two tests that exercise the sign-in flow itself still authenticate for real, so a run makes **2 sign-in attempts instead of 10** (4 instead of 20 with retries).
- `indexedDB: true` on `context.storageState()` is load-bearing and not optional: Firebase Auth keeps its session in IndexedDB, not cookies or localStorage, so a state captured without it restores nothing and every dependent test silently starts logged out. Playwright's own docs name Firebase for this option. Needs Playwright ≥ 1.51; the repo is on 1.58.
- The wrong-password test now uses an address that cannot exist rather than the real `TEST_EMAIL`. Firebase weighs *failed* attempts most heavily, so spending one every run against the account every other test signs in with was a meaningful part of the problem. It exercises the same rejected-credentials path at no cost to the real account.
- The authenticated specs run as their own `smoke-auth` project, which is the only thing that depends on the setup project. My first attempt made the *whole* smoke project depend on it, and CI showed exactly why that was wrong: a still-throttled account failed setup and reported `1 failed, 36 did not run` — the two dozen tests that never touch authentication (API health, email endpoints, legal pages, guest mode) stopped reporting at all. That is strictly worse signal than the problem being fixed. Now a sign-in outage costs only the nine tests that genuinely need a session; verified by forcing setup to fail and confirming the other 28 still run.
- The signed-in tests that don't exercise signing in moved into `e2e/smoke/session.smoke.spec.js`, because Playwright selects projects by file and `auth.smoke.spec.js` holds both signed-out and signed-in cases. Storage state is configured once on the `smoke-auth` project rather than per file.
- `test:smoke` / `test:all` and the workflow now run `--project=smoke --project=smoke-auth`. `e2e/.auth/` is gitignored — it holds a live session.

### Fixed: A Guest-Mode Test Asserted a Sidebar Link That Has Never Existed
- `core.smoke.spec.js` walked the guest sidebar clicking `/stats/`, "Search for a Show" and **`/roadmap/`**. There is no Roadmap link in `Sidebar.jsx`, `MobileHeader.jsx` or `Footer.jsx` — it exists only as a page and some cards — so that step could never pass. It was masked for a long time behind the sign-in failure above.
- The walk now uses links a guest actually has: Stats, "Search for a show", Upcoming and "How to Use". `Sidebar.jsx` hides Tours, Wishlist, Bucket List, Festivals, Profile and Setlist Photos behind `!isGuest`. "Support" is deliberately excluded — it is an external `<a>` to buymeacoffee.com, and clicking it would navigate the test off the site entirely.

### Fixed: The Guest-Mode Walk Still Failed, Now on the Cookie Banner
- The fix above swapped `/roadmap/` for links a guest really has, ending with "How to Use" — but that link sits at the bottom of the sidebar, underneath the cookie-consent banner. The banner is `fixed bottom-0 left-0 right-0 z-50`, so Playwright reports `<div …> intercepts pointer events`, retries for the full 30s and times out. Same test, same red, one link further along.
- Verified against a local build of `main`: `enter guest mode and navigate pages` still fails there, on `/how to use/i` rather than `/roadmap/i`.
- The banner is dismissed before the walk instead of dropping "How to Use" from it, so the link keeps its coverage. The sibling test `exit guest mode returns to landing` already had to do this — "Exit Guest Mode" is under the banner too — and its inline copy is now the same helper.
- That helper, `dismissCookieBanner`, is factored out of `dismissOverlays` in `e2e/utils/test-helpers.js` (which already contained this exact block) and exported, so there is one definition rather than a third copy. `dismissOverlays` calls it; behaviour there is unchanged. It no-ops when the banner is absent, so it is safe to call unconditionally.
- After: `enter guest mode and navigate pages` goes from a 30s timeout to passing in 4.8s, and `core.smoke.spec.js` runs 15 passed / 3 failed. The three are the API Health checks, which need Netlify functions a static local server cannot route to; they pass in CI.

Nothing user-facing — CI and test-harness only, so there is no version bump
and no Release Notes entry. A patch bump would restamp the service worker
and needlessly invalidate every user's cache for a change that ships no app
code.

---

## [5.30.4] — 2026-09-04

### Fixed: A Mistyped Year Could Merge Two Different Festival Editions
- Found in production, by the shared-festival migration itself. One record's `startDate` had been typed `0011-08-12` instead of `2011-08-12`. Year 11 AD parses perfectly well — four digits is four digits — so that record carried a **~2001-year-wide** date window that overlapped every festival in the catalog. Its name ("Outside Lands") is contained by another edition's ("Outside Lands Music & Arts Festival"), so the name gate passed too, and a 2011 festival was merged into a 2008 one. That is precisely the edition collapse the date gate exists to prevent.
- `lib/festivalMatch.js` now bounds both ends of the problem: a year outside `MIN_FESTIVAL_YEAR`–`MAX_FESTIVAL_YEAR` (1900–2100) is not a date, and a window wider than `MAX_FESTIVAL_DAYS` (30) is a mistyped year rather than a range. Either way the record matches **nothing** instead of everything — the worst outcome here is a wrong merge, so a record that can't be dated confidently is left to stand alone. The same bounds are mirrored into the rule ported inside `admin-migrate-festivals.js`.
- Five regression tests, including the exact production pair, both corruption directions (bad start, bad end), the range boundaries, and a check that the record still matches its own true edition once the date is corrected.

### Added: `admin-repair-festival-split`
- The rule fix prevents recurrence but cannot undo a merge that already happened — the migration is idempotent and re-running it will not un-merge anything. This admin-only function moves one user's attendance record off a canonical festival it was wrongly merged into and onto the right one, reusing a matching canonical if one exists.
- `action: "inspect"` lists a user's attendance records joined to their canonical festivals (read-only). `action: "split"` does the repair, dry-run by default.
- It never touches a show (shows link by attendance id, which never changes), never deletes notes or a rating, and never edits the canonical being left, since other users are still attending it. Corrected dates are validated against the same bounds the match rule uses, so the typo that caused the problem cannot be re-entered through the repair.
- This is the admin moderation tooling previously noted as "where it would go, but not built" — built now because it was needed, not for tidiness.

### Fixed: The Migration's Conflict List Omitted the Document Id
- `AdminView` rendered conflicts as `festival · uid`, dropping the `docId` the function already returns. That is the one field a repair needs to address the record, which made a real mis-merge materially harder to fix. Conflicts now read `users/{uid}/festivals/{docId}`.

### Fixed: Smoke Tests on a Pull Request Tested Production, Not the Pull Request
- `TEST_BASE_URL` was `${{ inputs.base_url || 'https://mysetlists.net' }}` for every event. `inputs` only exists on `workflow_dispatch`, so both `push` and `pull_request` fell through to production — a PR run exercised the live site and said nothing whatsoever about the branch under review. This is why the v5.30.0 tour-browse crash (fixed in v5.30.2) shipped past a workflow that had "run" on its PR.
- A pull request now runs against its own Netlify deploy preview; `push` still targets production; `workflow_dispatch` still honours its input.
- The run waits for **this commit's** deploy rather than sleeping. On a PR it polls the Netlify check runs posted against the head SHA, because the deploy-preview URL keeps serving the *previous* build until the new one is ready — polling for HTTP 200 alone would cheerfully test stale code on any re-push. Netlify posts those checks only for previews, not for production, so a push to main instead waits until `/service-worker.js` names the version being released (`scripts/stamp-service-worker.js` writes it on every build). Not every push bumps the version, so that one warns rather than fails. Replaces a blind `sleep 90`/`sleep 120`.
- Added a `concurrency` group so a second push to a PR cancels the superseded run instead of racing it and reporting on a preview that has already been replaced.
- `ENVIRONMENT` is reported as `deploy-preview` for PR runs so results logged to Notion aren't mistaken for production runs.
- `integration-tests.yml` is deliberately unchanged: it already skips pull requests and is *supposed* to exercise the live site's Netlify functions with real secrets.

### Fixed: A Failed Sign-in in the Smoke Tests Gave No Reason
- Every authenticated smoke test funnels through `loginUser`, so when sign-in breaks, ten tests fail on one line with `expect(locator).toBeVisible() failed ... element(s) not found`. Bad credentials, a disabled account, Firebase being unreachable and a real app regression all produced that identical, undiagnosable output.
- The wait now races the signed-in sidebar against the login form's own error message and reports whichever arrives, so a rejected sign-in fails with Firebase's actual reason. Verified by driving the built export in Chromium with deliberately bad credentials.

---

## [5.30.3] — 2026-09-04

### Added: Expand a Song on Stats → Songs to See Every Show You Heard It At
- Clicking a song row on `/stats/songs` now expands it in place, listing every performance of that song in the user's own logged shows — date, venue and city, set label and position within the set, segue markers, and the user's rating of that specific performance. Clicking again collapses it. No navigation, no modal, no drawer.
- Toggles are **independent**, not an accordion: comparing two songs' histories side by side is the obvious next thing to do on this page, and nothing about the list makes several open panels awkward.
- Each expanded row is itself a link to that show, opening it the same way every other list in the app does (`setSelectedShow` + `/shows/`) rather than a per-id URL, which static export can't serve.
- The row is a real `<button>`: it takes focus, toggles on Enter and Space, shows the same focus ring the rest of the page uses, and carries `aria-expanded` plus an `aria-controls` pointing at the panel. The chevron is the same `ChevronDown` + `rotate-180` affordance already used for expandable rows on My Shows and the legacy Stats tables.
- The row previously navigated straight to the song page; that link is preserved as a "Song page →" link inside the expansion, so nothing that was reachable before became unreachable.

### Technical
- `components/songs/SongPerformanceRow.jsx` is the performance row, extracted verbatim from `components/songs/SongDetailView.jsx` where it was inlined. Both the song page and the new expansion render it; a `compact` prop swaps only the wrapper's padding and chrome, never the content, so the two can't drift into two implementations of the same timeline. The song page's rendering is byte-for-byte what it was.
- Both use the same `lib/songIndex.js` — one normalizer (`normalizeSongTitle`), keyed `artistSlug:normalizedTitle`, so `"Ashes//Dust"`, `"Ashes // Dust"` and `"ASHES//DUST"` collapse into one expansion while a title two different artists both play stays on two.
- Expansion causes **no Firestore reads**. It renders from `hooks/useSongIndex`, which is memoized on the `shows` array already in `AppContext`. Verified in a real browser with 550 shows / 12,100 setlist entries: the index is built exactly once and stays at one build across 22 expand/collapse toggles and a sort change; zero backend requests are issued while toggling; expand latency stayed under 100ms including the test driver's own round-trip.
- `segueIn` added to each indexed performance. Segues are stored one-directionally (`tape` on a song means it ran into the next one, which is what the show detail setlist renders as its `> segue` line), so a song's segue-*in* is the previous song's flag. Rendered with the same `>` and "segue" vocabulary the show detail view uses.
- Missing set data still degrades to no set label rather than `Set undefined`/`Set null`, and a manually-added song renders identically to a setlist.fm-sourced one (with the existing "added by you" badge). Both are covered by tests.
- Six new cases in `lib/__tests__/songIndex.test.js` cover performance ordering, completeness and de-duplication, the single-performance case, the "no song can have zero performances" invariant, a song played twice in one show, and segue in/out direction. 14 tests pass.
- Fixed in passing: the numeric columns on this page were fixed-width `w-24` at every breakpoint, which left the song title roughly 20px wide on a 390px phone — unreadable before this change and worse with a chevron added. They are now `w-16 sm:w-24`, restoring a readable title column on mobile.

---

## [5.30.2] — 2026-09-04

### Fixed: Opening a Tour from "Add shows from a tour" Crashed the Page
- Picking any tour with a dozen or more shows blanked the page with "Application error: a client-side exception has occurred". Since most real tours are longer than that, the feature was effectively unusable.
- Root cause: `components/tours/TourBrowseModal.jsx` imported lucide-react's icon named `Map`. That import shadows the global `Map` constructor for the whole module, so the `new Map()` that groups a long tour's shows by month threw `Map is not a constructor`. The icon is now imported as `MapIcon`.
- Why nothing caught it: the shadowing is valid JavaScript, so it built cleanly and the deploy preview rendered fine — the throw only happens once a tour's show list crosses the twelve-show month-grouping threshold, which no build-time or unit check ever reached. Reproduced in a real browser against the built export before fixing.
- Also fixed in the same flow: when a setlist.fm function returned HTML instead of JSON (what the SPA catch-all serves if a function isn't deployed), the raw parser error `Unexpected token '<', "<!DOCTYPE "...` was shown to the user as though it were an explanation. All three lookups now report a readable message.

### Technical
- New `lib/__tests__/iconShadowing.test.js` scans `app/`, `components/`, `lib/` and `hooks/` for any module that imports a lucide icon whose name shadows a global constructor (`Map`, `Set`, `Image`, `Text`, `File`, …) *and* calls `new <Name>(`. lucide exports a lot of these names, and this repo's icon imports span multiple lines, so the scan is multi-line aware and strips comments from the whole import block before splitting on commas — doing that in the other order lets a comma inside a comment glue prose onto the next name, which made the first version of this scan pass on the very bug it was written for. It carries self-checks so it fails loudly rather than vacuously.

---

## [5.30.1] — 2026-09-02

### Fixed: Creating a Festival Failed With a Permission Error
- 5.30.0 split a festival into a shared canonical record (`festivals/{id}`) plus a private attendance record. `firestore.rules` gained a rule for that new collection — but **rules are not deployed by any build**, so in production the new collection had no rule at all, and Firestore denies every path it has no matching rule for. Creation died on its very first write.
- The rule itself was correct all along. **The fix is to deploy it** (`npm run deploy:rules`, or the workflow in #280); the changes below stop this class of failure from being invisible next time.
- A permission denial no longer says "Please try again" — retrying can never clear a rules denial. It now names what was actually refused.
- Festival names are validated against the same 120-character limit the rule enforces, as a form error naming the field. `normalizeFestivalName` expands `&` into ` and `, so a name comfortably under the limit could produce a normalized form over it and be rejected by Firestore with nothing pointing at the cause.
- Create now writes the user's own attendance record before the shared canonical one. Both writes can't be atomic (different collections, one of them shared), so one must fail second — and the orders are not equivalent. Canonical-first stranded a festival in the shared catalog that nobody attends, and `festivals` has `allow delete: if false`, so no client could ever remove it and it would surface forever in other users' join suggestions. Failing the other way leaves a record private to that user, already rendered as "Unavailable festival", which they can simply leave.

### Fixed: Security Rules Now Deploy Themselves
- The root cause above is not specific to festivals: security rules live in this repo but nothing deployed them. Netlify's build runs `test:pre-deploy && next build` and never touches Firebase, so `firestore.rules` only reached production when someone remembered `npm run deploy:rules` by hand. It broke favoriting a tour in 5.29.0 and creating a festival in 5.30.0, and would have broken the next rule change too.
- New `.github/workflows/deploy-firestore-rules.yml` deploys the same three targets as the local script (`firestore:rules`, `firestore:indexes`, `storage`) on any push to `main` that touches them, plus a manual trigger for deploying rules already on main.
- Authenticates with the `FIREBASE_SERVICE_ACCOUNT_JSON` repo secret the integration-test workflow already uses — no new credential to mint. The credentials file is written to the runner's temp directory rather than the workspace so it can't be swept into an artifact upload, and is removed even when the deploy fails.
- **Requires the service account to hold `roles/firebaserules.admin` and `roles/datastore.indexAdmin`.** The existing account was provisioned for Admin SDK reads and may not have them; the workflow fails with the IAM error naming the missing role if so.

### Technical
- `lib/festivalMatch.js` gains `FESTIVAL_NAME_MAX` and `festivalNameProblem`, so the form and the security rule state the same limit in one place.
- Unit tests: 5 new cases in `lib/__tests__/festivalMatch.test.js` covering the raw limit, the normalized-longer-than-raw case, and whitespace.

---

## [5.30.0] — 2026-09-02

### New: Add Every Show You Caught on a Tour, in One Go
- People don't remember their history one show at a time — they remember "I did five stops on Goose's Summer Tour 2025". **Add shows from a tour** on the Tours page does exactly that: pick the artist, pick the tour, tick the nights you were at, add them all in one action.
- Typing the whole thing at once works too — `Goose Summer Tour 2025` in the search box goes straight to that tour's show list. If it can't tell for certain where the artist name ends or which tour you meant, it drops you on the picker with what it did work out already filled in, rather than guessing and opening the wrong tour.
- Every show on the tour is listed in date order with its venue, city and whether a setlist exists yet — grouped by month for a long tour, filterable by city or venue, with select all / clear all and a live count on the button.
- **Shows you already have are marked and can't be re-added**, so this can't duplicate your history. A night at the same venue on the same date that you'd added by hand is caught even if you spelled the venue differently; one that's close but not certain is flagged as "may already have" and left for you to decide.
- A night with no setlist filed yet is still addable, flagged as setlist pending.
- Adding shows the progress as it goes. If some fail, the ones that worked are kept, the ones that didn't are named with the reason, and you can retry just those — it never claims success for a batch that partly failed, and never rolls the successes back. You can close the modal and it keeps going.
- Bulk-added shows are ordinary shows: full setlist, venue, artist, tour name, the lot. They appear on Tours, in runs, and in festivals exactly as hand-added ones do.
- A tour you already have shows from gets **Add more shows** on its own page, jumping straight to that tour's list with the nights you have already ticked off.

### Changed: Festivals Are Shared Now
- Festivals used to be private to whoever created them, so two friends who both went to Bonnaroo 2026 kept two unrelated copies. Now there's one festival, and each of you keeps your own shows and notes against it.
- **If someone's already added the festival you went to, you'll see it while you're typing** — name, dates, location — and joining it is one tap. Creating your own anyway is still one click, with the match still on screen; nothing is ever joined on your behalf, and nothing blocks you from creating.
- Different years never match each other. Bonnaroo 2025 and Bonnaroo 2026 are different festivals however identically they're spelled.
- Two festivals with the same name in different cities are both offered rather than one being picked for you.
- **Joining creates only your own record.** Your notes, your rating and the shows you attach are yours — invisible to everyone else at the same festival.
- The person who created a festival can edit its name, dates and location, and their changes show up for everyone. Everyone else edits their own notes, and the form says so plainly instead of showing greyed-out boxes.
- **Leaving** replaces deleting. It removes the festival from your list and keeps every show you'd attached — they go back to being ordinary shows in your history. It never affects anyone else's copy, not even if you're the one who created the festival.

### Fixed
- Firestore rules for starred tours (added in 5.29.0) checked only the `userId` field and not the document id, so a signed-in user could overwrite another user's starred tours. Landed on `main` after the 5.29.1 notes went out; documented here.

### Technical
- **setlist.fm still has no tours endpoint** — verified against the current 1.0 resource list (artist, setlist, venue, city, country, search, user; `tour` is a filter on `/search/setlists`, not a resource). Tour discovery therefore aggregates distinct `tour.name` values off an artist's setlists. `netlify/functions/get-artist-tours.js` is reworked for it: the 8 most recent pages walked *serially* with a 200 ms gap and an 8 s budget (the old version fired 3 pages in parallel, exactly the burst that earns a 429), results cached 24 h in the existing `setlistCache` collection under a `tours_` prefix, and 404 / 429 / timeout each surfaced distinctly — a failed request never renders as an empty tour list. Tour groups are keyed by normalized name *plus year*, so a name reused across years stays two entries.
- New `netlify/functions/get-tour-shows.js` pages `/search/setlists?artistMbid=&tourName=` for one tour's full show list, same paging discipline, cached 12 h under `tourshows_`.
- New `lib/tourBrowse.js` (+ 24 unit tests): tour-name normalization, the conservative free-text parse (leading tokens tried as an artist name, capped at three, resolved only on an exact name match), and the already-added rule — `setlistfmId` first, then artist + date + `venuesFuzzyMatch`, with a same-artist-same-date-different-venue case reported as a weaker signal rather than folded into either answer.
- `addShow` was not safe to call in a loop: it derives its doc id from `Date.now()` and closes over the render's `shows` array. Its document construction and Firestore write are now `buildShowDoc`/`writeShowDoc`, ids come from a monotonic counter, and the new `addShowsFromTour` writes through the same pair — so there is one add path, not two. It writes one document at a time rather than as a batch, because a batch is all-or-nothing and partial failure is the normal case here. Aggregates (profile, community stats, rank, artist image) run once at the end instead of per show.
- **Festivals are now two documents.** `festivals/{id}` is the shared canonical record (`name`, `nameNormalized`, `startDate`, `endDate`, `location`, `edition`, `createdBy`, timestamps) and holds nothing personal; `users/{uid}/festivals/{id}` keeps its existing path and id and now holds `festivalId` plus the user's own notes and rating. No canonical field is copied onto the attendance record — that duplication is exactly the drift being removed, and it's why a creator's date correction is immediately visible to everyone who joined. `loadFestivals` joins the two at read time.
- A show's `festivalId` still points at the **attendance** record, not the canonical festival, so no show document had to be rewritten and pre-5.30.0 `/festivals/?festival=<id>` links still resolve.
- New `lib/festivalMatch.js` (+ 24 unit tests) holds the match rule with named constants, the way the run rule is defined: `MAX_START_DATE_GAP_DAYS = 3`, `MIN_NAME_SIMILARITY = 0.6` (token-overlap/Jaccard, chosen over edit distance because festival names differ by whole words), `MIN_NAME_LENGTH = 3`. Names are normalized (lowercase, punctuation and leading articles stripped, whitespace collapsed, trailing year dropped); the date test is a hard gate that no name similarity can override, which is what keeps Bonnaroo 2025 and Bonnaroo 2026 apart; location is a ranking tiebreaker and never rejects a candidate on its own.
- The dedup lookup is two bounded queries, both single-field ranges served by Firestore's automatic single-field indexes — a `nameNormalized` prefix range and a `startDate` window — unioned and then run through the real rule client-side. No composite index is needed, so `firestore.indexes.json` is unchanged.
- `firestore.rules` gains one collection, `festivals`, modelled on the existing `venues` block: readable by any signed-in user, creatable by any signed-in user with field validation (required keys present, no extra keys, name 1–120 chars, both dates `yyyy-MM-dd`, end not before start), updatable only by `createdBy` or the admin account with `createdBy` pinned, and **never deletable by a client**. The per-user rule is unchanged. This is the only place anything became readable to more people — festival names, dates and locations, which is the entire point of the change; no personal field did.
- New `netlify/functions/admin-migrate-festivals.js`, dry-run by default, following the `admin-cleanup-duplicates` conventions. Groups every user's existing festivals by the same match rule (ported into the function, since it's CommonJS with no `@/lib` resolution), creates one canonical per group with the earliest-created record winning every field, and repoints each user's record in place. It reads and writes no shows, deletes no notes or ratings, logs every disagreement between group members instead of silently picking, and leaves any record that fails to write exactly as it was — which still renders on that user's Festivals page. Idempotent in both directions: it seeds its grouping from the canonical festivals already in the catalog, so a rerun reuses them and a record that failed the first time joins the canonical the first run created. `scripts/festival-migration-dryrun.js` exercises the planner offline against fixtures covering the merge, the edition guard, same-name-different-city, single-day, and year-boundary cases.
- `DeleteFestivalModal` becomes `LeaveFestivalModal`.

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

'use client';

import React from 'react';
import { Check } from 'lucide-react';

function ReleaseNotesView() {
  const releases = [
    {
      version: '3.4.0',
      date: 'March 20, 2026',
      title: 'UI Polish & Copy Fixes',
      changes: [
        'Fix: Tooltip "Got it" button is now clearly visible with white text and underline on amber background',
        'Fix: Upcoming Shows now displays the number of upcoming events on sale instead of historical attendance count',
        'Removed wristband scanning references from landing page, ticket scanner, and feature announcements',
      ]
    },
    {
      version: '3.2.0',
      date: 'March 19, 2026',
      title: 'Polish & Consistency',
      changes: [
        'Refreshed UI with new color scheme based on MySetlists brand colors (green + amber from the logo)',
        'New sidebar design with dark navy background',
        'Updated browser tab title to "MySetlists | Your Show History"',
        'Fixed favicon to show correct green logo',
        'Scan / Import and Find Missing Setlists buttons updated to match Search for a Show styling',
        'Consistent button and input styling throughout the app',
      ]
    },
    {
      version: '3.1.0',
      date: 'March 19, 2026',
      title: 'Brand Refresh — Light Theme with Logo Colors',
      changes: [
        'New: Light, airy theme built from the MySetlists logo color palette — green primary (#4bc86a) and amber accent (#f5a623)',
        'New: Soft blue-gray page background (#f4f6f9) with white card surfaces for a clean, modern feel',
        'New: Dark navy sidebar (#1e2538) matching the logo background — high contrast against the light content area',
        'New: Plus Jakarta Sans typography throughout for a friendly, contemporary UI',
        'New: Search-as-input in the sidebar — always visible, styled as a search field',
        'Redesigned: Primary buttons in brand green, secondary in amber, ghost buttons with green hover borders',
        'Redesigned: Star ratings in amber, tab indicators in amber, stat highlights in green/amber',
        'Redesigned: Modals with soft blur backdrop and white elevated surfaces',
        'Redesigned: Landing page keeps dark navy background with gradient amber-to-green CTA button',
        'Technical: CSS variable system updated for light backgrounds, new shadow scale, and semantic color tokens',
        'Technical: Tailwind config extended with brand/amber color scales and themed box-shadow utilities',
      ]
    },
    {
      version: '3.0.0',
      date: 'March 19, 2026',
      title: 'Concert Venue Theme — Complete Visual Redesign',
      changes: [
        'New: Dark, moody concert venue aesthetic — near-black backgrounds with warm amber and electric teal accents',
        'New: Custom color system with CSS variables for consistent theming across every screen',
        'New: Stage-lighting background effect — subtle radial gradients suggesting amber and teal stage lights',
        'New: DM Serif Display headings paired with DM Sans body text for a vinyl-sleeve, gig-poster feel',
        'New: Themed scrollbars, amber-glow hover states, and teal secondary accents throughout',
        'Redesigned: Sidebar navigation with left accent bars, amber active states, and muted bottom items',
        'Redesigned: Cards and show entries with subtle borders, amber hover glow, and serif titles',
        'Redesigned: Buttons — amber primary CTAs with dark text, ghost secondary with teal hover',
        'Redesigned: Modals with blurred backdrop, elevated surface backgrounds, and subtle borders',
        'Redesigned: Form inputs with void background, amber focus rings, and muted placeholders',
        'Redesigned: Star ratings with amber fill and glow effect',
        'Redesigned: Stats badges, pill tags, and count indicators in the new color system',
        'Technical: All hardcoded Tailwind color classes replaced with CSS variable-backed theme tokens',
        'Technical: Tailwind config extended with semantic color names (void, surface, elevated, etc.)',
      ]
    },
    {
      version: '2.4.0',
      date: 'March 18, 2026',
      title: 'Bug Fixes: Login, Upcoming Shows & Admin Panel',
      changes: [
        'Fix: Login modal now auto-closes after successful Google or Apple sign-in',
        'Fix: Upcoming Shows page is now reachable from the sidebar navigation (was linking to a 404)',
        'Fix: Upcoming Shows green indicator dots now display correctly for artists with cached events',
        'Fix: Admin panel tabs are now horizontally scrollable on mobile — all tabs accessible on iPhone',
      ]
    },
    {
      version: '3.0.0',
      date: 'March 15, 2026',
      title: 'Native iOS App with Capacitor',
      changes: [
        'New: MySetlists is now available as a native iOS app via Capacitor — same great web app, native App Store experience',
        'New: Sign in with Apple — required by the App Store and now available on both web and iOS',
        'New: Native Google Sign-In on iOS — uses the system sign-in sheet instead of a web popup',
        'New: Native camera support for ticket scanning — choose camera or photo library on iOS',
        'New: Spotify OAuth uses in-app browser on iOS with custom URL scheme (mysetlists://) callback',
        'Improved: Tailwind CSS migrated from CDN to build-time — ~20KB purged CSS vs 300KB+ CDN, works offline',
        'Improved: All API calls route through centralized apiUrl() helper for native/web compatibility',
        'Improved: iOS safe area support — content respects the notch, Dynamic Island, and home indicator',
        'Improved: StatusBar, Keyboard tracking, and SplashScreen configured for native iOS polish',
        'Technical: Next.js static export (output: \'export\') generates pre-rendered HTML for all 21 routes',
        'Technical: PWA install prompt automatically hidden when running as a native app',
      ]
    },
    {
      version: '2.3.1',
      date: 'March 15, 2026',
      title: 'Landing Page Restored',
      changes: [
        'Fix: Logged-out users now see a full landing page with hero section, feature showcase, and community stats instead of a bare login screen',
        'Landing page highlights all major features: show tracking, ticket scanning, CSV import, playlist creation, stats, and social features',
        '"How it works" section walks new visitors through the 3-step onboarding flow',
        'Community leaderboards visible to logged-out visitors to showcase the active user base',
        '"Try it First" guest mode button lets visitors explore the app without signing up',
      ]
    },
    {
      version: '2.3.0',
      date: 'March 15, 2026',
      title: 'What\'s New Announcements & Feature Tooltips',
      changes: [
        'New: "What\'s New" modal highlights recent features for returning users — playlist creation, ticket scanning, CSV import, and more',
        'New: Playlist creation tooltip appears on the setlist view to introduce the Spotify/Apple Music playlist button',
        'Each announcement links directly to the relevant feature (e.g., "Try Scan / Import →")',
        'Announcements show once per release and are tracked in localStorage — won\'t pester you',
        'Tooltips dismiss on tap and won\'t reappear after dismissal',
      ]
    },
    {
      version: '2.2.1',
      date: 'March 14, 2026',
      title: 'Playlist Creation Bug Fix',
      changes: [
        'Fixed: Spotify playlist creation no longer fails with "Missing playlistId or trackUris" error',
        'Improved: Spotify API proxy now properly handles and surfaces non-success responses',
        'Added: Defensive validation for playlist ID before attempting to add tracks',
      ]
    },
    {
      version: '2.2.0',
      date: 'March 14, 2026',
      title: 'Create Playlists on Spotify & Apple Music',
      changes: [
        'New: "Create Playlist" button in show detail view — turn any setlist into a streaming playlist',
        'New: Spotify integration with secure OAuth login — creates a playlist with your setlist songs in one tap',
        'New: Apple Music integration via MusicKit — add setlist playlists directly to your library',
        'Smart song matching handles covers, jam annotations, and song name variations',
        'Results screen shows matched/unmatched songs with a direct link to your new playlist',
        'Playlist auto-named "[Artist] - [Venue] [Date]" with show details in the description',
      ]
    },
    {
      version: '2.1.0',
      date: 'March 14, 2026',
      title: 'Artist & Venue Info from Wikipedia',
      changes: [
        'New: "About [Artist]" collapsible panel in show detail view — see Wikipedia summary, image, and link',
        'New: "About [Venue]" collapsible panel with city disambiguation for accurate results',
        'New: Netlify function proxies Wikipedia API with 7-day Firestore cache',
        'Info panels load lazily — only fetches when you expand, and caches for instant re-access',
        'Graceful handling when no Wikipedia article exists',
      ]
    },
    {
      version: '2.0.0',
      date: 'March 14, 2026',
      title: 'Next.js 14 Migration',
      changes: [
        'Migrated from Create React App to Next.js 14 App Router with file-based routing',
        'Real URL routes replace query-parameter navigation (e.g., /stats, /friends, /search)',
        'Native SEO metadata on every page via Next.js metadata API',
        'New: Shareable collection links at /shared/[id] with server-rendered previews and JSON-LD structured data',
        'New: Dynamic artist page metadata for better search engine previews',
        'Updated sitemap.xml and robots.txt for improved crawlability',
        'PWA support preserved — install prompt, manifest, and service worker continue to work',
      ]
    },
    {
      version: '1.0.34',
      date: 'March 14, 2026',
      title: 'SEO & Discoverability Improvements',
      changes: [
        'New: Reusable SEOHead component for consistent meta tags across all pages',
        'New: Dynamic page titles and Open Graph tags on show detail views',
        'New: JSON-LD MusicEvent structured data on show detail views (schema.org)',
        'New: Netlify _headers file to allow indexing on public pages and block on private routes',
        'New: Google Search Console verification placeholder in index.html',
        'Updated: Default homepage title and description for better search visibility',
        'Updated: sitemap.xml now includes /roadmap route',
        'Updated: robots.txt with explicit allow/disallow rules and /.netlify/ exclusion',
        'Updated: Twitter Card and Open Graph fallback tags in index.html',
      ]
    },
    {
      version: '1.0.33',
      date: 'March 12, 2026',
      title: 'Admin Bulk Import for User Profiles',
      changes: [
        'New: Admins can now bulk-import shows into any user\'s profile via CSV or Excel upload',
        'New: "Bulk Import" tab in Admin panel with full multi-step wizard',
        'Step-by-step flow: select user \u2192 upload file \u2192 map columns \u2192 preview \u2192 import',
        'Auto-detects column headers (Artist, Venue, Date, City, Rating, Comment, Tour)',
        'Preview table shows validation errors and flags duplicate shows before import',
        'Server-side duplicate detection prevents duplicates even on concurrent imports',
        'Imported shows are marked with importedByAdmin field for traceability',
        'Admin audit log records every bulk import with who, for whom, and how many shows',
        'Maximum 500 shows per import to stay within serverless function limits',
      ]
    },
    {
      version: '1.0.32',
      date: 'March 12, 2026',
      title: 'Friend Notes Visible on Shared Shows',
      changes: [
        'Fix: Friends can now see each other\'s notes and ratings when viewing tagged/shared shows',
        'When you open a show you were tagged in, the tagger\'s comments and song ratings appear in violet alongside yours',
        'When you open a show you tagged friends in, their notes appear once they\'ve added them',
        'Works for show-level comments, song-level comments, and ratings \u2014 all displayed with clear attribution',
        'Tagged friend UIDs are now saved on the tagger\'s show for fast bidirectional lookups',
        'Friend annotations also appear for shows both users independently added (matched by artist + venue + date)',
      ]
    },
    {
      version: '1.0.31',
      date: 'March 11, 2026',
      title: 'Invitation & Referral Tracking in Admin',
      changes: [
        'New: Referrals tab in Admin portal \u2014 see all users who joined via invitation with inviter details',
        'New: Inviter Leaderboard \u2014 ranked list of top inviters with sent/accepted counts, conversion rate, and invitee activity',
        'New: "Invited" badge on user rows in the Users tab with blue envelope icon',
        'New: "Invited Only" filter toggle to quickly find users who joined via referral',
        'New: Invitation & Referral details panel on user profile \u2014 who invited them, who they\'ve invited, and invitee metrics',
        'New: Export referral data to CSV with one click',
        'Sortable invited users list by join date, name, or inviter',
        'Invite acceptance now saves inviter data directly on user profile for fast admin lookups',
        'Referral stats cards: total invites sent, accepted, acceptance rate, active inviters',
      ]
    },
    {
      version: '1.0.30',
      date: 'March 11, 2026',
      title: 'Guest Conversion Tracking in Admin',
      changes: [
        'New: Conversions tab in Admin portal \u2014 see all users who converted from guest accounts',
        'Conversion details include name, email, conversion date, guest shows added, and total shows',
        'New: "Converted" badge on user rows in the Users tab with amber sparkle icon',
        'New: "Converted Only" filter toggle to quickly find converted users',
        'New: Conversion details panel on user profile \u2014 guest start date, conversion date, shows before/after, session ID',
        'New: Export converted users to CSV with one click',
        'Sortable converted users list by conversion date, name, or email',
        'Guest-to-user conversion now saves tracking data directly on user profile for fast lookups',
      ]
    },
    {
      version: '1.0.29',
      date: 'March 11, 2026',
      title: 'Interactive Shows Together & Friend Annotations',
      changes: [
        'New: Shows in "Shows Together" are now fully interactive \u2014 click to expand inline with full setlist, ratings, and comments',
        'New: See your friend\'s show ratings and comments right alongside your own on shared shows',
        'New: Friend song-level ratings and notes displayed inline on every song in the setlist',
        'New: Open the full show editor directly from Shows Together \u2014 rate songs, add notes, tag friends, and more',
        'New: Friend annotations appear in the full show editor with violet badges to distinguish from your own notes',
        'Visual: Friend comments marked with purple avatar/badges, your own in green \u2014 easy to tell apart at a glance',
        'Your and friend\'s overall show ratings shown side-by-side on each show card',
      ]
    },
    {
      version: '1.0.28',
      date: 'March 10, 2026',
      title: 'Bulk Accept, Unified Scan/Import, Sidebar Refresh',
      changes: [
        'New: Bulk accept pending show tags and suggestions \u2014 accept all at once or per friend',
        'New: Scan Tickets and Import File merged into a single "Scan / Import" tabbed view',
        'Sidebar: Search pinned at top, Invite & Feedback pinned at bottom, everything else scrolls',
        'Sidebar reordered for better flow \u2014 Friends and Community moved up, Upcoming Shows follows Stats',
        'Simplified onboarding: single tooltip for the unified Scan / Import button',
      ]
    },
    {
      version: '1.0.27',
      date: 'March 9, 2026',
      title: 'Mobile-Friendly Tooltips',
      changes: [
        'Fixed: Onboarding tooltips no longer get cut off on iPhone and small screens',
        'Mobile: onboarding tooltips now appear below buttons instead of to the left, staying fully visible',
        'All button tooltips (Rate Venue, Tag Friends, Share, etc.) now work on touch devices via tap',
        'Desktop: hover tooltips continue to work as before',
        'Tooltips auto-adjust to stay within screen boundaries with proper edge padding',
      ]
    },
    {
      version: '1.0.26',
      date: 'March 9, 2026',
      title: 'Onboarding Tooltips & Ticket Scanner',
      changes: [
        'New: Onboarding tooltips guide first-time users through Import File and Scan Tickets features',
        'Tooltips appear sequentially with a gentle animation and dismiss with "Got it"',
        'New: Scan Tickets \u2014 upload photos of physical ticket stubs, wristbands, or digital tickets',
        'AI reads artist, venue, date, and city from ticket images, even old or worn stubs',
        'Automatically searches setlist.fm for matching setlists after scanning',
        'Batch scanning: upload multiple tickets at once and process them all together',
        'Emerald green favicon now matches the site logo',
      ]
    },
    {
      version: '1.0.24',
      date: 'March 4, 2026',
      title: 'Public Roadmap & Voting',
      changes: [
        "New: Public roadmap at mysetlists.net/roadmap \u2014 see what\u2019s Up Next, In Progress, and Shipped",
        'Vote on features you want most \u2014 top 3 most-voted items get a \u201cMost Requested\u201d badge',
        'Votes update in real time \u2014 no refresh needed',
        'Feature requests now save to a feedback queue and automatically create draft roadmap items',
        'Admin: new Roadmap tab for reviewing drafts, publishing items, creating items manually, and moving items between columns',
        'Get an in-app notification when your feature request makes it to the roadmap',
      ]
    },
    {
      version: '1.0.23',
      date: 'March 4, 2026',
      title: 'Pending Invites Dashboard',
      changes: [
        'New: See all pending email invites in Friends \u2192 Invites tab',
        'Resend any pending invite with one tap (limited to once per 24 hours to prevent spam)',
        'Cancel invites you no longer want to send',
        'Invites older than 30 days are marked Expired \u2014 resending resets the expiry clock',
        'Invite summary shows how many people you\u2019ve invited and how many have joined',
        'Duplicate invite guard: warns you if you try to invite someone who already has a pending invite',
        'Pending invite count now appears in the Friends badge in the sidebar',
      ]
    },
    {
      version: '1.0.22',
      date: 'March 4, 2026',
      title: 'Friend Show Suggestions, Shared Memories & SEO',
      changes: [
        'New: MySetlists now suggests when you and a friend may have been at the same show \u2014 confirm or decline from the Friends tab',
        'New: Share memories on any confirmed shared show \u2014 add, edit, and delete comments visible only to you and that friend',
        'New: Public artist pages at mysetlists.net/artist/[name] with community stats (shows tracked, fans, top songs, recent venues)',
        'New: Dynamic page titles and meta tags for better search engine visibility and sharing',
        'Improved: Notification badge now includes pending show-together suggestions',
      ]
    },
    {
      version: '1.0.21',
      date: 'March 4, 2026',
      title: 'Bug Fixes',
      changes: [
        'Fixed: Rate Venue button now opens the rating modal correctly from any page',
        'Fixed: Rate Venue modal now works when accessed from the Stats page as well as setlist view',
      ]
    },
    {
      version: '1.0.20',
      date: 'March 4, 2026',
      title: 'Venue Ratings, Social Tagging & Navigation',
      changes: [
        'Rate venues with 1\u20135 stars and optional sub-ratings (Sound, Sightlines, Atmosphere, Accessibility, Food & Drinks)',
        'See aggregate venue ratings and top-rated venues in your Stats page',
        'Tag multiple friends at a show in one tap with instant batch confirmation',
        'Tag friends when adding new shows, not just from existing setlists',
        'See all the shows you\'ve attended with a specific friend from their profile',
        'Browser back/forward buttons now work correctly throughout the app',
      ]
    },
    {
      version: '1.0.19',
      date: 'March 4, 2026',
      title: 'Email Invites, Show Tagging & Admin Tools',
      changes: [
        'Invite emails are now sent directly from mysetlists.net \u2014 no more opening your mail app',
        'Friends who join via your invite are automatically connected with a welcome message',
        'Tag friends at shows even if they haven\'t joined yet \u2014 they\'ll get an invite email with the show details',
        'New users who were tagged in shows see a "Shows your friends tagged you in" screen on first login',
        'Confirmed tags notify the friend who tagged you so they know you\'re officially show buddies',
        'Admin: full user deletion removes their account, shows, friend connections, and tags permanently',
      ]
    },
    {
      version: '1.0.18',
      date: 'February 20, 2026',
      title: 'Interactive Summary Stats',
      changes: [
        'Stat boxes are now ~50% smaller for a cleaner, less cluttered home screen',
        'Tap any stat box to jump directly to its detailed stats view (Songs, Artists, Venues, or Top Shows)',
        'User rank box now links to the Community page',
      ]
    },
    {
      version: '1.0.17',
      date: 'February 10, 2026',
      title: 'Notifications & Alerts',
      changes: [
        'Notification banner on the Shows page alerts you to pending friend requests and show tags',
        'Clicking the notification banner takes you directly to the Friends Requests tab',
        'Red badge on the Requests tab shows the number of pending friend requests and show tags',
      ]
    },
    {
      version: '1.0.16',
      date: 'February 9, 2026',
      title: 'Setlist Scanning & Onboarding',
      changes: [
        'Find Missing Setlists button scans your shows without setlists and fetches them from setlist.fm',
        'Improved setlist matching with artist name variations (e.g., "Dead & Company" vs "Dead and Company")',
        'Shows are refreshed when navigating back from Import to ensure imported shows appear immediately',
        'Setlist scanning preserves your existing ratings and comments',
        'New first-time user experience with import options: screenshot, CSV/Excel, and setlist.fm search',
      ]
    },
    {
      version: '1.0.15',
      date: 'February 9, 2026',
      title: 'Screenshot Import',
      changes: [
        'Upload a screenshot from Ticketmaster, AXS, or any ticket platform to import shows',
        'AI-powered image analysis identifies artists, venues, dates, and cities',
        'Detected shows are previewed for review before importing',
        'Setlists are automatically fetched from setlist.fm for screenshot-imported shows',
        'Supports PNG, JPG, and WebP image formats',
      ]
    },
    {
      version: '1.0.14',
      date: 'February 9, 2026',
      title: 'Sidebar Redesign',
      changes: [
        'Reorganized sidebar navigation for a cleaner layout',
        'Restored Invite option to the sidebar',
        'Moved Feedback and Release Notes below Community and Invite',
        'Hidden profile section from sidebar for a streamlined look',
      ]
    },
    {
      version: '1.0.13',
      date: 'February 9, 2026',
      title: 'Invite Auto-Friendship',
      changes: [
        'Users who join via an invite link are now automatically friends with the person who invited them',
        'Invite links now include a referral code so the app knows who sent the invitation',
        'No friend request needed \u2014 the friendship is created instantly when the invited user signs up',
      ]
    },
    {
      version: '1.0.12',
      date: 'February 9, 2026',
      title: 'Bug Fixes & Improvements',
      changes: [
        'Fixed community stats not updating \u2014 leaderboards now show all users correctly',
        'Fixed community song and venue aggregation failing due to Firestore permissions',
        'Removed duplicate years list on the Stats page',
      ]
    },
    {
      version: '1.0.11',
      date: 'February 9, 2026',
      title: 'Auto-Fetch Setlists on Import',
      changes: [
        'Imported shows now automatically search setlist.fm for matching setlists',
        'Setlists are matched by artist name and exact date',
        'Found setlists include full song lists with set breaks and encore markers',
        'Tour information is also pulled when available from setlist.fm',
        'Progress indicator shows setlist fetch status during import',
        'Import completion screen shows how many setlists were found',
      ]
    },
    {
      version: '1.0.10',
      date: 'February 8, 2026',
      title: 'Friends & Show Tagging',
      changes: [
        'Add friends by email or directly from the Community leaderboard',
        'Friend requests require acceptance \u2014 mutual friendship only',
        'Tag friends at shows you attended together',
        'Tagged shows require friend approval before importing to their collection',
        'Approved tags copy the full setlist (without your ratings or comments)',
        'Real-time notification badge for pending requests and show tags',
        'New Friends page with My Friends, Requests, and Find Friends tabs',
      ]
    },
    {
      version: '1.0.9',
      date: 'February 8, 2026',
      title: 'Admin User Support',
      changes: [
        'Admins can click any user to view their shows in the Admin Portal',
        'User show detail view with search, sort, and setlist inspection',
        'On-demand show loading for efficient data access',
      ]
    },
    {
      version: '1.0.8',
      date: 'February 7, 2026',
      title: 'File Import',
      changes: [
        'Import shows from CSV, Excel, or Google Sheets files',
        'Smart column detection \u2014 automatically maps your headers',
        'Preview and validate data before importing',
        'Duplicate detection warns about shows already in your collection',
        'Drag-and-drop or browse to upload files',
      ]
    },
    {
      version: '1.0.7',
      date: 'February 7, 2026',
      title: 'Artist Stats Upgrade',
      changes: [
        'Expandable artist rows in the Stats Artists tab \u2014 click to see all shows for that artist',
        'Double-click any show under an artist to open full show details',
      ]
    },
    {
      version: '1.0.6',
      date: 'February 7, 2026',
      title: 'Legal Pages & Stats Improvements',
      changes: [
        'Added Privacy Policy, Terms of Service, and Cookie Policy pages',
        'New site-wide footer with links to all legal pages',
        'Cookie consent banner on first visit with Accept/Decline options',
        'Terms & Privacy consent language on the signup screen',
        'Redesigned Years tab with expandable accordion view',
        'Double-click any show in the Years view to open full show details',
        'Fixed duplicate Years tab in Stats navigation',
      ]
    },
    {
      version: '1.0.5',
      date: 'February 6, 2026',
      title: 'Guest Mode & Stats Improvements',
      changes: [
        'Try the app without creating an account - shows saved locally',
        'Click shows in Stats view to edit them (same as Shows page)',
        'New Years tab in Stats to browse shows by year',
        'Prompt to create account after adding first show in guest mode',
        'Guest shows automatically migrate when you create an account',
      ]
    },
    {
      version: '1.0.4',
      date: 'February 5, 2026',
      title: 'PWA & Authentication Updates',
      changes: [
        'Install as an app on your phone or desktop (PWA support)',
        'Email/password authentication option added',
        'Profile page with your concert statistics',
        'Community leaderboards showing top show-goers',
        'Invite friends via email',
        'New sidebar navigation for easier access',
      ]
    },
    {
      version: '1.0.3',
      date: 'February 4, 2026',
      title: 'Enhanced Stats & Filtering',
      changes: [
        'Filter songs by artist, venue, or year in Stats',
        'Expandable venue details showing shows by year',
        'Top rated shows leaderboard',
        'Average song ratings displayed per show',
        'Improved mobile responsiveness',
      ]
    },
    {
      version: '1.0.2',
      date: 'February 3, 2026',
      title: 'Setlist Editing & Notes',
      changes: [
        'Add missing songs to any setlist',
        'Rate individual songs (1-10 scale)',
        'Add personal notes to songs',
        'Add notes to entire shows',
        'Batch rate all unrated songs at once',
        'Delete songs from setlists',
      ]
    },
    {
      version: '1.0.1',
      date: 'February 2, 2026',
      title: 'Search & Import',
      changes: [
        'Search setlist.fm for shows by artist',
        'Filter by year, venue, or city',
        'One-click import of setlists',
        'Manual show entry option',
        'Show rating system (1-10)',
      ]
    },
    {
      version: '1.0',
      date: 'February 1, 2026',
      title: 'Initial Release',
      changes: [
        'Track your concert history',
        'Google sign-in authentication',
        'Cloud sync across devices',
        'Basic statistics (shows, songs, artists)',
        'Share your collection stats',
      ]
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-primary mb-2">Release Notes</h1>
      <p className="text-secondary mb-8">What's new in Setlist Tracker</p>

      <div className="space-y-6">
        {releases.map((release, index) => (
          <div
            key={release.version}
            className={`bg-hover backdrop-blur-xl rounded-2xl border border-subtle p-6 ${
              index === 0 ? 'ring-2 ring-brand/30' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-bold text-primary">v{release.version}</span>
                  {index === 0 && (
                    <span className="px-2 py-0.5 bg-brand-subtle text-brand rounded-full text-xs font-semibold">
                      Latest
                    </span>
                  )}
                </div>
                <h3 className="text-brand font-medium">{release.title}</h3>
              </div>
              <span className="text-muted text-sm">{release.date}</span>
            </div>
            <ul className="space-y-2">
              {release.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-3 text-secondary">
                  <Check className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReleaseNotesView;

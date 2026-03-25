/**
 * App-wide constants — extracted from App.js.
 */

export const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];

export const VALID_VIEWS = [
  'shows', 'stats', 'search', 'friends', 'invite', 'feedback',
  'release-notes', 'scan-import', 'community', 'profile', 'admin',
  'upcoming-shows', 'roadmap',
];

// Roadmap feature categories — used in FeedbackView, RoadmapView, PublicRoadmapPage, AdminView
export const ROADMAP_CATEGORIES = {
  ui: 'UI/Design',
  social: 'Social',
  data: 'Data & Stats',
  search: 'Search',
  other: 'Other',
};

// Roadmap column definitions — order and display for the three public columns
export const ROADMAP_COLUMNS = [
  { key: 'upnext',     label: 'Up Next',      emoji: '\uD83D\uDD1C', headerColor: 'text-amber',  border: 'border-amber/30'  },
  { key: 'inprogress', label: 'In Progress',   emoji: '\uD83D\uDEE0\uFE0F', headerColor: 'text-brand',   border: 'border-brand/30'   },
  { key: 'shipped',    label: 'Shipped',        emoji: '\u2705', headerColor: 'text-success', border: 'border-success/30' },
];

// Shared import field definitions (used by ImportView and admin bulk import)
export const IMPORT_FIELDS = [
  { key: 'artist', label: 'Artist', required: true },
  { key: 'venue', label: 'Venue', required: true },
  { key: 'date', label: 'Date', required: true },
  { key: 'city', label: 'City', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'rating', label: 'Rating', required: false },
  { key: 'comment', label: 'Comment', required: false },
  { key: 'tour', label: 'Tour', required: false },
];

// Ticket event cache TTL
export const TICKET_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

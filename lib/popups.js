/**
 * Popup Registry — centralized definitions for all app popups.
 *
 * id format:  popup-{feature}-v{version}
 *
 * targetAudience:
 *   'all'             — every user
 *   'newUsers'        — users with 0 shows
 *   'returningUsers'  — users with ≥1 show
 *   'admin'           — admin-only
 */

export const POPUPS = [
  {
    id: 'popup-song-history-v3.16',
    title: 'Song Play Counts & History',
    content: `See how many times you've heard each song! Toggle play counts on any setlist, and click a song name to view every show where you've heard it — with dates, venues, ratings, and notes.`,
    variant: 'feature',
    releaseVersion: '3.16.0',
    targetAudience: 'returningUsers',
  },
  {
    id: 'popup-popup-system-v3.17',
    title: 'One-Time Popup System',
    content: `We now show helpful announcements when new features launch. Each popup appears once and won't bother you again for 12 months. You can manage popups in Admin > Popups.`,
    variant: 'announcement',
    releaseVersion: '3.17.0',
    targetAudience: 'all',
  },
  {
    id: 'popup-welcome-onboarding-v1',
    title: 'Welcome to MySetlists!',
    content: `Start by adding your first show — search for an artist and date, and we'll pull in the setlist automatically. Track your concert history, rate songs, and see stats across all your shows.`,
    variant: 'info',
    releaseVersion: '1.0.0',
    targetAudience: 'newUsers',
  },
  {
    id: 'popup-ios-app-v1',
    title: 'MySetlists on iOS',
    content: `MySetlists is available as a native iOS app! Add shows on the go, scan tickets to import, and get push notifications when friends attend shows. Download from the App Store.`,
    variant: 'announcement',
    releaseVersion: '3.10.0',
    targetAudience: 'all',
    learnMoreUrl: 'https://apps.apple.com',
    learnMoreLabel: 'App Store',
  },
  {
    id: 'popup-maintenance-template-v1',
    title: 'Scheduled Maintenance',
    content: `We're performing scheduled maintenance to improve performance. Some features may be temporarily unavailable. Thank you for your patience!`,
    variant: 'warning',
    releaseVersion: '3.0.0',
    targetAudience: 'all',
    // Set enabled: false to keep as a template that isn't shown by default
    enabled: false,
  },
  {
    id: 'popup-admin-bulk-import-v3.12',
    title: 'Admin: Bulk Import Wizard',
    content: `The new bulk import tool lets you import shows from CSV files for any user. Access it from Admin > Bulk Import tab.`,
    variant: 'feature',
    releaseVersion: '3.12.0',
    targetAudience: 'admin',
  },
];

/**
 * Filter popups that should potentially be shown to a given user.
 *
 * @param {object} opts
 * @param {boolean} opts.isAdmin
 * @param {number}  opts.showCount — number of shows the user has
 * @returns {object[]} — popup definitions the user is eligible for
 */
export function getPopupsForUser({ isAdmin = false, showCount = 0 } = {}) {
  return POPUPS.filter((popup) => {
    // Skip disabled popups (templates)
    if (popup.enabled === false) return false;

    switch (popup.targetAudience) {
      case 'all':
        return true;
      case 'newUsers':
        return showCount === 0;
      case 'returningUsers':
        return showCount > 0;
      case 'admin':
        return isAdmin;
      default:
        return true;
    }
  });
}

/**
 * Get a single popup definition by ID.
 */
export function getPopupById(id) {
  return POPUPS.find((p) => p.id === id) || null;
}

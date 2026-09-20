/**
 * Helper for navigating to a show detail view.
 * Uses the query-param pattern: /shows/?show=<id>
 * This is the only correct way to navigate to a show in this app.
 */
export function showHref(id) {
  return `/shows/?show=${encodeURIComponent(id)}`;
}

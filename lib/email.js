/**
 * Browser-side email sending. Every app-initiated email (tags, invites,
 * friend-joined, replies/likes, venue verification, admin messages) goes
 * through here to /api/send-email.
 *
 * Deliberately thin since 5.38. The opt-out decision, the recipient's
 * signed unsubscribe link and the List-Unsubscribe headers are all the
 * server's job (netlify/functions/send-email.js): the browser can't sign
 * tokens, and an opt-out check that runs in the recipient's absence on
 * someone else's device was never a reliable one.
 */

import { auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';

/**
 * sendEmailIfAllowed({ to, subject, html }, { type })
 *   type — short name for this kind of email ('tag', 'invite', …); it
 *          shows up in the admin Unsubscribes view as where an
 *          unsubscribe came from.
 * Resolves to the fetch Response (or undefined if nobody is signed in).
 * The server answers 200 { skipped: true } when the recipient opted out.
 */
export async function sendEmailIfAllowed({ to, subject, html }, { type = 'general' } = {}) {
  const user = auth.currentUser;
  if (!user || !to) return undefined;
  const idToken = await user.getIdToken();
  return fetch(apiUrl('/api/send-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ to, subject, html, type }),
  });
}

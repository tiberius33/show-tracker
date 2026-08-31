/**
 * Shared transactional-email sending helper. Extracted from
 * context/AppContext.jsx (where it originated and is still used for
 * friend-tagging/invite emails) so lib/notifications.js can send the new
 * "immediate" engagement notification emails through the same
 * opt-out-respecting path, instead of duplicating the opt-out check.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';

// Send email only if the recipient hasn't opted out (userProfiles.emailOptOut).
export async function sendEmailIfAllowed(recipientUidOrEmail, emailPayload) {
  // If we have a UID, check the profile's emailOptOut flag
  if (recipientUidOrEmail && !recipientUidOrEmail.includes('@')) {
    try {
      const profileSnap = await getDoc(doc(db, 'userProfiles', recipientUidOrEmail));
      if (profileSnap.exists() && profileSnap.data().emailOptOut) {
        return; // User has opted out of emails
      }
    } catch {
      // If we can't check, proceed with sending
    }
  }
  // If we have an email address (non-registered user), check if any profile with that email opted out
  if (recipientUidOrEmail && recipientUidOrEmail.includes('@')) {
    try {
      const q = query(collection(db, 'userProfiles'), where('email', '==', recipientUidOrEmail.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].data().emailOptOut) {
        return; // User has opted out
      }
    } catch {
      // If we can't check, proceed with sending
    }
  }
  return fetch(apiUrl('/api/send-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload),
  });
}

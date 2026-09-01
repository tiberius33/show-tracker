// netlify/functions/venue-bucket-list-notifications.js
//
// Daily scheduled function: for every user with at least one venue on
// their "venue bucket list" (lib/bucketListVenues.js — a venue they want
// to see *any* show at, distinct from lib/bucketList.js's specific
// artist+venue+date entries), checks their favorite artists' upcoming
// Ticketmaster events for a match against one of those venues, and
// creates a `venue_bucket_list_match` notification on a hit — respecting
// userProfiles/{uid}.notificationPrefs.venueBucketList (default: enabled,
// both push and email).
//
// Same admin-SDK scheduled-function shape as
// netlify/functions/anniversary-notifications.js (this repo's only other
// scheduled job) — self-contained rather than importing the client-SDK
// lib/venues.js or lib/notifications.js, which aren't usable from this
// CommonJS/admin-SDK context. Registered in netlify.toml.
//
// Rather than looking up each user's favorite artists individually, this
// batches by *distinct favorite artist name* across all users who have a
// bucket-list venue — so an artist favorited by 5 users only costs one
// Ticketmaster call, not 5 — then fans matched events back out to
// whichever of those users also has the matching venue on their list.

const https = require('https');

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'MySetlistsApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error(`Failed to parse Ticketmaster response: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Same key shape as lib/venues.js's venueKeyFor — kept in sync manually
// since this function can't import that ESM client module.
function venueKeyFor(name, city) {
  const key = `${(name || '').trim().toLowerCase()}::${(city || '').trim().toLowerCase()}`;
  return key === '::' ? null : key;
}

function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Promise.resolve(false);
  const payload = JSON.stringify({ from: 'Phillip <phillip@mysetlists.net>', to, subject, html });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function matchEmailHtml({ artist, venue, city, date, ticketUrl, venueUrl }) {
  const a = escapeHtml(artist);
  const v = escapeHtml(venue);
  const loc = city ? `, ${escapeHtml(city)}` : '';
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="padding:24px 32px 16px;text-align:center;border-bottom:1px solid #e5e7eb">
          <img src="https://mysetlists.net/logo.svg" alt="MySetlists" width="160" style="display:inline-block;max-width:160px;height:auto" />
        </td></tr>
        <tr><td style="padding:28px 32px;color:#374151;font-size:15px;line-height:1.6">
          <h2 style="color:#059669;margin:0 0 16px;font-size:22px">Bucket list match! 🎯</h2>
          <p style="margin:0 0 16px"><strong style="color:#111827">${a}</strong> is playing at <strong style="color:#111827">${v}</strong>${loc} — a venue on your bucket list.</p>
          <div style="border:1px solid #e5e7eb;border-left:4px solid #34D399;border-radius:8px;padding:16px 20px;margin:16px 0;background:#f9fafb">
            <p style="margin:0;font-weight:700;color:#111827;font-size:17px">${a}</p>
            <p style="margin:4px 0 0;color:#6b7280;font-size:14px">${v}${loc}</p>
            <p style="margin:4px 0 0;color:#6b7280;font-size:14px">${escapeHtml(date)}</p>
          </div>
          <p style="margin:24px 0;text-align:center">
            <a href="${ticketUrl || venueUrl}" style="background:#34D399;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:15px">
              ${ticketUrl ? 'Get Tickets &rarr;' : 'View Venue &rarr;'}
            </a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #e5e7eb;background:#f9fafb">
          <p style="color:#9ca3af;font-size:12px;margin:0">
            <a href="https://mysetlists.net" style="color:#9ca3af;text-decoration:none">mysetlists.net</a> &mdash; track every show you've ever been to
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function fetchArtistEvents(artistName, apiKey, affiliateId) {
  const today = new Date().toISOString().split('T')[0];
  const normalizedSearch = artistName.trim().toLowerCase();
  const params = new URLSearchParams({
    keyword: artistName,
    apikey: apiKey,
    classificationName: 'music',
    size: '20',
    sort: 'date,asc',
    startDateTime: `${today}T00:00:00Z`,
  });
  try {
    const { body } = await httpsGet(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    const rawEvents = (body?._embedded?.events || []).filter((e) => {
      const attractions = e?._embedded?.attractions || [];
      return attractions.some((a) => a.name.trim().toLowerCase() === normalizedSearch);
    });
    return rawEvents.map((e) => {
      const venue = e._embedded?.venues?.[0] || {};
      let url = e.url || '';
      if (url && affiliateId) url += (url.includes('?') ? '&' : '?') + `camefrom=${encodeURIComponent(affiliateId)}`;
      return {
        id: e.id,
        date: e.dates?.start?.localDate || null,
        venue: venue.name || null,
        city: venue.city?.name || null,
        url,
      };
    });
  } catch (err) {
    console.warn('[venueBucketList] Ticketmaster lookup failed for', artistName, err.message);
    return [];
  }
}

exports.handler = async function () {
  initFirebase();
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const db = getFirestore();

  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'Ticketmaster API key not configured' }) };
  }
  const affiliateId = process.env.TICKETMASTER_AFFILIATE_ID;

  // 1. Every user's bucket-list venues, grouped by uid.
  const bucketSnap = await db.collection('bucketListVenues').get();
  const venuesByUid = new Map(); // uid -> Set(venueKey)
  bucketSnap.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d.userId || !d.venueKey) return;
    if (!venuesByUid.has(d.userId)) venuesByUid.set(d.userId, new Set());
    venuesByUid.get(d.userId).add(d.venueKey);
  });

  if (venuesByUid.size === 0) {
    return { statusCode: 200, body: JSON.stringify({ processed: 0, notified: 0 }) };
  }

  const uids = Array.from(venuesByUid.keys());
  const profiles = new Map();
  await Promise.all(uids.map(async (uid) => {
    const snap = await db.collection('userProfiles').doc(uid).get();
    profiles.set(uid, snap.exists ? snap.data() : {});
  }));

  // 2. Distinct favorite artists across those users, mapped back to which
  // uids favorited them (only uids that have a bucket-list venue at all).
  const uidsByArtist = new Map(); // artistNameLower -> Set(uid)
  uids.forEach((uid) => {
    const favorites = profiles.get(uid)?.favoriteArtists || [];
    favorites.forEach((fav) => {
      const key = (fav?.name || '').trim().toLowerCase();
      if (!key) return;
      if (!uidsByArtist.has(key)) uidsByArtist.set(key, new Set());
      uidsByArtist.get(key).add(uid);
    });
  });

  if (uidsByArtist.size === 0) {
    return { statusCode: 200, body: JSON.stringify({ processed: 0, notified: 0, note: 'no favorite artists among bucket-list-venue users' }) };
  }

  let notified = 0;
  const artistNames = Array.from(uidsByArtist.keys());

  for (const artistKeyLower of artistNames) {
    // Use the display-cased name from whichever favoriting user has it, for the TM keyword search.
    const interestedUids = uidsByArtist.get(artistKeyLower);
    const sampleUid = interestedUids.values().next().value;
    const displayName = (profiles.get(sampleUid)?.favoriteArtists || [])
      .find((f) => (f.name || '').trim().toLowerCase() === artistKeyLower)?.name || artistKeyLower;

    const events = await fetchArtistEvents(displayName, apiKey, affiliateId);
    await sleep(250); // stay well under Ticketmaster's rate limit

    for (const event of events) {
      const venueKey = venueKeyFor(event.venue, event.city);
      if (!venueKey) continue;

      for (const uid of interestedUids) {
        if (!venuesByUid.get(uid)?.has(venueKey)) continue;

        const profile = profiles.get(uid) || {};
        const prefs = profile.notificationPrefs?.venueBucketList;
        const enabled = prefs?.enabled !== false; // default on
        if (!enabled) continue;
        const method = prefs?.method || 'both';

        const message = `${displayName} is playing at ${event.venue} on ${event.date} — on your bucket list!`;
        const notifId = `venueMatch_${uid}_${event.id}`;

        try {
          await db.collection('notifications').doc(notifId).set({
            uid,
            type: 'venue_bucket_list_match',
            message,
            venueKey,
            artist: displayName,
            venue: event.venue,
            date: event.date,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          notified++;
        } catch (err) {
          console.error('[venueBucketList] failed to write notification for', uid, event.id, err.message);
          continue;
        }

        if ((method === 'email' || method === 'both') && profile.email && profile.emailOptOut !== true) {
          sendEmail({
            to: profile.email,
            subject: `${displayName} is playing at ${event.venue} — on your bucket list!`,
            html: matchEmailHtml({
              artist: displayName, venue: event.venue, city: event.city, date: event.date,
              ticketUrl: event.url, venueUrl: `https://mysetlists.net/venues/${encodeURIComponent(venueKey)}/`,
            }),
          }).catch((err) => console.warn('[venueBucketList] email send failed for', uid, err.message));
        }

        if ((method === 'push' || method === 'both') && profile.fcmToken) {
          try {
            const { getMessaging } = require('firebase-admin/messaging');
            await getMessaging().send({
              token: profile.fcmToken,
              notification: { title: 'Bucket list match!', body: message },
            });
          } catch (err) {
            console.warn('[venueBucketList] push send failed for', uid, err.message);
          }
        }
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ artistsChecked: artistNames.length, notified }) };
};

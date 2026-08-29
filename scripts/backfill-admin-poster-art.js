// @ts-check
'use strict';

/**
 * One-time full (quick + deep) poster-art backfill for the admin account only
 * (phillip.leonard@gmail.com — see lib/constants.js ADMIN_EMAILS).
 *
 * This is deliberately NOT wired into the app. Every other account gets
 * posters gradually — the cheap Ticketmaster/SeatGeek check runs lazily in
 * the background, and the AI-judgment steps (band website + Reddit) only run
 * when a user clicks "Look for poster art" on a specific show. This script
 * exists to run the FULL waterfall, including the AI steps, across the
 * admin's own existing show history in one pass, so we can gauge real-world
 * hit rate and Claude cost before ever considering a wider backfill.
 *
 * Calls the deployed find-show-poster / find-show-poster-deep Netlify
 * functions over HTTPS (same endpoints the client calls) rather than
 * reimplementing their logic — so this must be run against a deployment
 * where this feature has already shipped.
 *
 * Usage:
 *   BASE_URL=https://mysetlists.net node scripts/backfill-admin-poster-art.js
 *
 * Requires Firebase Admin credentials in the environment — either
 * FIREBASE_SERVICE_ACCOUNT_JSON + FIREBASE_PROJECT_ID, or the split
 * FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID
 * (whichever you already have set for local Netlify function testing).
 *
 * Safe to re-run: shows that already have posterCheckedDeep are skipped.
 */

const https = require('https');

const ADMIN_EMAIL = 'phillip.leonard@gmail.com';
const BASE_URL = process.env.BASE_URL || 'https://mysetlists.net';
const DELAY_BETWEEN_SHOWS_MS = 3000;

function getDb() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
      initializeApp({ credential: cert(JSON.parse(json)), projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!privateKey || !clientEmail || !projectId) {
        throw new Error('Missing Firebase Admin credentials — set FIREBASE_SERVICE_ACCOUNT_JSON+FIREBASE_PROJECT_ID or FIREBASE_PRIVATE_KEY+FIREBASE_CLIENT_EMAIL+FIREBASE_PROJECT_ID');
      }
      initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
    }
  }
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore();
}

function getAuth() {
  const { getAuth: getAdminAuth } = require('firebase-admin/auth');
  return getAdminAuth();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function lookupPoster(show) {
  const quickParams = new URLSearchParams({
    artist: show.artist || '', venue: show.venue || '', date: show.date || '', city: show.city || '',
  });
  const quick = await fetchJson(`${BASE_URL}/.netlify/functions/find-show-poster?${quickParams}`).catch(() => ({ found: false }));
  if (quick.found) return { ...quick, checkedQuick: true, checkedDeep: false };

  const deepParams = new URLSearchParams({
    artist: show.artist || '', venue: show.venue || '', date: show.date || '', tour: show.tour || '',
  });
  const deep = await fetchJson(`${BASE_URL}/.netlify/functions/find-show-poster-deep?${deepParams}`).catch(() => ({ found: false }));
  return { ...deep, checkedQuick: true, checkedDeep: true };
}

async function main() {
  const db = getDb();
  const auth = getAuth();

  console.log(`Looking up admin account: ${ADMIN_EMAIL}`);
  const adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  const uid = adminUser.uid;
  console.log(`Found uid: ${uid}`);

  const showsSnap = await db.collection('users').doc(uid).collection('shows').get();
  const shows = showsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const pending = shows.filter((s) => !s.posterCheckedDeep);

  console.log(`${shows.length} total shows, ${pending.length} not yet fully checked.`);

  let foundCount = 0;
  let bySource = {};

  for (let i = 0; i < pending.length; i++) {
    const show = pending[i];
    process.stdout.write(`[${i + 1}/${pending.length}] ${show.artist} @ ${show.venue || '?'} (${show.date}) ... `);
    try {
      const result = await lookupPoster(show);
      const updates = {
        posterCheckedQuick: true,
        ...(result.checkedDeep ? { posterCheckedDeep: true } : {}),
        ...(result.found ? { posterUrl: result.posterUrl, posterSource: result.posterSource, posterSourceUrl: result.posterSourceUrl || null } : {}),
      };
      await db.collection('users').doc(uid).collection('shows').doc(show.id).update(updates);
      if (result.found) {
        foundCount++;
        bySource[result.posterSource] = (bySource[result.posterSource] || 0) + 1;
        console.log(`found (${result.posterSource})`);
      } else {
        console.log('not found');
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
    }
    await sleep(DELAY_BETWEEN_SHOWS_MS);
  }

  console.log('\n--- Summary ---');
  console.log(`Checked: ${pending.length}`);
  console.log(`Found: ${foundCount}`);
  console.log('By source:', bySource);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

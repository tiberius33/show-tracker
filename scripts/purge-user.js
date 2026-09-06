#!/usr/bin/env node
'use strict';

/**
 * Purge every trace of a uid, using the same engine as account deletion.
 *
 * The case this exists for: someone deletes a user in the Firebase console.
 * That removes the Authentication record and nothing else — every document
 * that user ever wrote stays in Firestore, orphaned under a uid that no longer
 * resolves to anyone, along with other people's friend edges pointing at it.
 * The console gives no warning about this.
 *
 * Runs netlify/functions/lib/userDataPurge.js, so it stays correct as the
 * schema grows: the same map, the same tombstoning of moderation records, the
 * same Storage cleanup.
 *
 *   node scripts/purge-user.js <uid>            # dry run, lists what it finds
 *   node scripts/purge-user.js <uid> --yes      # actually delete
 *
 * Credentials come from .env, same as the seed script.
 */

(function loadDotEnv() {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { purgeUserData, findRemainingTraces } = require('../netlify/functions/lib/userDataPurge');

const uid = process.argv[2];
const WRITE = process.argv.includes('--yes');

if (!uid || uid.startsWith('--')) {
  console.error('Usage: node scripts/purge-user.js <uid> [--yes]');
  process.exit(1);
}

const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'show-tracker-d7a4d.firebasestorage.app';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      projectId: process.env.FIREBASE_PROJECT_ID,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  });
}

const db = getFirestore();
const auth = getAuth();

(async () => {
  console.log(`\nuid: ${uid}`);

  const traces = await findRemainingTraces({ db }, uid);
  if (!traces.length) {
    console.log('Nothing references this uid. Nothing to do.\n');
    return;
  }

  console.log(`\n${traces.length} place(s) still reference it:\n`);
  for (const t of traces) console.log(`  ${t}`);

  if (!WRITE) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --yes to purge.\n');
    return;
  }

  let bucket = null;
  try { bucket = getStorage().bucket(); }
  catch (e) { console.warn('Storage unavailable; files will not be removed:', e.message); }

  console.log('\nPurging...');
  const report = await purgeUserData({ db, auth, bucket }, uid);
  console.log('  deleted    ', JSON.stringify(report.deleted));
  console.log('  tombstoned ', JSON.stringify(report.tombstoned));
  console.log('  storage    ', JSON.stringify(report.storage));
  if (report.errors.length) console.log('  warnings   ', JSON.stringify(report.errors));

  const left = await findRemainingTraces({ db }, uid);
  console.log(left.length ? `\nStill referenced in ${left.length} place(s):\n  ${left.join('\n  ')}\n`
                          : '\nClean — nothing references this uid.\n');
})().catch(e => { console.error(e); process.exit(1); });

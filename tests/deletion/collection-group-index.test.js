#!/usr/bin/env node
/**
 * collection-group-index — every filtered collectionGroup() query in a Netlify
 * function must have a COLLECTION_GROUP fieldOverride in firestore.indexes.json.
 *
 * Why this test exists:
 *
 * Firestore creates single-field indexes automatically, but only at COLLECTION
 * scope. A collection-group query filtered on a field needs an explicit
 * COLLECTION_GROUP index, or it throws FAILED_PRECONDITION the first time it
 * runs against real Firestore — and never in any in-memory or emulator harness
 * that does not enforce indexes.
 *
 * That is exactly how account deletion broke: userDataPurge step 9 runs
 *   db.collectionGroup('friends').where('friendUid', '==', uid)
 * with no override in place. It threw *after* the account had been disabled
 * and the refresh tokens revoked, so the user was locked out of an account
 * that still existed with all of its data — an App Store Guideline 5.1.1(v)
 * failure that only showed up in production.
 *
 * A query with no .where() (a full collectionGroup scan) needs no index and is
 * ignored here.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Find `collectionGroup('X')` followed by `.where('field', ...)`. */
function findFilteredCollectionGroupQueries(source, file) {
  const found = [];
  const re = /collectionGroup\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)([\s\S]{0,200})/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const [, collection, tail] = m;
    const whereMatch = /^\s*\.where\(\s*['"]([A-Za-z0-9_.]+)['"]/.exec(tail);
    if (whereMatch) {
      found.push({ collection, field: whereMatch[1], file: path.relative(ROOT, file) });
    }
  }
  return found;
}

const indexes = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'));

function hasCollectionGroupIndex(collection, field) {
  const override = (indexes.fieldOverrides || []).find(
    o => o.collectionGroup === collection && o.fieldPath === field
  );
  if (override) {
    return (override.indexes || []).some(i => i.queryScope === 'COLLECTION_GROUP');
  }
  // A composite index scoped to COLLECTION_GROUP whose first field matches
  // also satisfies a single-field equality filter.
  return (indexes.indexes || []).some(
    idx =>
      idx.collectionGroup === collection &&
      idx.queryScope === 'COLLECTION_GROUP' &&
      idx.fields &&
      idx.fields[0] &&
      idx.fields[0].fieldPath === field
  );
}

const queries = [];
for (const file of walk(FUNCTIONS_DIR)) {
  queries.push(...findFilteredCollectionGroupQueries(fs.readFileSync(file, 'utf8'), file));
}

console.log('\ncollection-group indexes');

check('at least one filtered collectionGroup query was found to check', () => {
  if (queries.length === 0) {
    throw new Error(
      'The scanner found none. Either the regex broke or the queries moved — ' +
      'either way this test is no longer protecting anything.'
    );
  }
});

const seen = new Set();
for (const q of queries) {
  const key = `${q.collection}.${q.field}`;
  if (seen.has(key)) continue;
  seen.add(key);
  check(`${key} has a COLLECTION_GROUP index (${q.file})`, () => {
    if (!hasCollectionGroupIndex(q.collection, q.field)) {
      throw new Error(
        `collectionGroup('${q.collection}').where('${q.field}', ...) will throw ` +
        `FAILED_PRECONDITION in production.\n      Add to firestore.indexes.json fieldOverrides:\n` +
        `      { "collectionGroup": "${q.collection}", "fieldPath": "${q.field}", "indexes": [\n` +
        `          { "order": "ASCENDING", "queryScope": "COLLECTION" },\n` +
        `          { "order": "DESCENDING", "queryScope": "COLLECTION" },\n` +
        `          { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" } ] }\n` +
        `      then deploy them: firebase deploy --only firestore:indexes`
      );
    }
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

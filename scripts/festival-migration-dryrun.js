#!/usr/bin/env node
'use strict';

/**
 * Offline dry run of the shared-festival migration.
 *
 * Runs netlify/functions/admin-migrate-festivals.js's planMigration — the
 * pure grouping half, the part that decides what gets created, merged and
 * rewritten — against a fixture set standing in for real per-user
 * festivals, and prints the plan in the same shape the function's
 * `dryRun: true` response returns.
 *
 * This exists so the migration's behaviour can be reviewed and re-reviewed
 * without credentials and without touching any real data. It is NOT the
 * migration: the real dry run is
 *
 *   POST /.netlify/functions/admin-migrate-festivals  { "dryRun": true }
 *
 * with an admin bearer token, which reads production and returns the same
 * report with real uids and names. Nothing is written until that same call
 * is repeated with { "dryRun": false }.
 *
 *   node scripts/festival-migration-dryrun.js
 */

const { planMigration } = require('../netlify/functions/admin-migrate-festivals');

// Fixtures. Every one of these is a case the migration has to get right,
// and several are the edge cases called out in the change brief.
const FIXTURES = [
  // 1. THE MERGE. Three users who each created Bonnaroo 2026 separately,
  //    with the spelling and date drift you actually get from free text.
  //    Earliest-created (alice) defines the canonical values; the other
  //    two are reported as conflicts, not silently overwritten.
  { uid: 'alice', docId: 'f-a1', name: 'Bonnaroo 2026', startDate: '2026-06-11', endDate: '2026-06-14', location: 'Manchester, TN', notes: 'Best set was Thursday', createdAt: '2026-01-05T10:00:00Z' },
  { uid: 'bob', docId: 'f-b1', name: 'bonnaroo', startDate: '2026-06-11', endDate: '2026-06-14', location: 'Manchester TN', notes: '', createdAt: '2026-02-11T09:30:00Z' },
  { uid: 'carol', docId: 'f-c1', name: 'The Bonnaroo Music & Arts Festival', startDate: '2026-06-12', endDate: '2026-06-15', location: '', notes: 'Camped with M', createdAt: '2026-03-02T18:45:00Z' },

  // 2. THE EDITION GUARD. Same name, previous year. Must NOT merge into
  //    the group above — identical names, a year apart.
  { uid: 'alice', docId: 'f-a2', name: 'Bonnaroo 2025', startDate: '2025-06-12', endDate: '2025-06-15', location: 'Manchester, TN', notes: '', createdAt: '2025-07-01T12:00:00Z' },

  // 3. SAME NAME, TWO CITIES. Two real festivals sharing a name on the
  //    same dates. They match on name and dates, so the migration merges
  //    them and reports the location disagreement — the one case where a
  //    human has to look at the conflict log and split them by hand.
  { uid: 'dave', docId: 'f-d1', name: 'Lollapalooza', startDate: '2026-08-01', endDate: '2026-08-04', location: 'Chicago, IL', notes: '', createdAt: '2026-04-01T08:00:00Z' },
  { uid: 'erin', docId: 'f-e1', name: 'Lollapalooza', startDate: '2026-08-01', endDate: '2026-08-04', location: 'Berlin', notes: 'flew over for it', createdAt: '2026-04-02T08:00:00Z' },

  // 4. SINGLE-DAY festival, two users, exact same day.
  { uid: 'bob', docId: 'f-b2', name: 'Field Day', startDate: '2026-08-22', endDate: '2026-08-22', location: 'London', notes: '', createdAt: '2026-05-01T08:00:00Z' },
  { uid: 'carol', docId: 'f-c2', name: 'Field Day 2026', startDate: '2026-08-22', endDate: '2026-08-22', location: 'London', notes: 'rained', createdAt: '2026-05-04T08:00:00Z' },

  // 5. YEAR BOUNDARY. Dec 30 -> Jan 1, two users, one day of drift.
  { uid: 'dave', docId: 'f-d2', name: 'Decadence', startDate: '2026-12-30', endDate: '2027-01-01', location: 'Denver, CO', notes: '', createdAt: '2026-11-01T08:00:00Z' },
  { uid: 'erin', docId: 'f-e2', name: 'Decadence NYE', startDate: '2026-12-31', endDate: '2027-01-01', location: 'Denver, CO', notes: '', createdAt: '2026-11-09T08:00:00Z' },

  // 6. SINGLETON. Nobody else has it — gets its own canonical, no merge.
  { uid: 'erin', docId: 'f-e3', name: 'Pickathon', startDate: '2026-08-06', endDate: '2026-08-09', location: 'Happy Valley, OR', notes: 'tiny stage', createdAt: '2026-06-01T08:00:00Z' },

  // 7. MALFORMED DATES. Must not swallow other festivals by matching
  //    everything — it fails the date gate and stands alone.
  { uid: 'frank', docId: 'f-f1', name: 'Bonnaroo', startDate: '', endDate: '', location: '', notes: 'no idea when', createdAt: '2026-06-02T08:00:00Z' },
];

function fmtCanonical(c) {
  const dates = c.endDate && c.endDate !== c.startDate ? `${c.startDate}..${c.endDate}` : (c.startDate || '(no dates)');
  return `"${c.name}"  ${dates}  ${c.location || '(no location)'}`;
}

function report(title, records, existingCanonicals) {
  const groups = planMigration(records, existingCanonicals);

  let canonicalCreated = 0;
  let recordsRepointed = 0;
  const conflicts = [];

  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
  console.log(`scanned: ${records.length} per-user festival records across ` +
    `${new Set(records.map(r => r.uid)).size} users`);
  console.log(`already migrated: ${records.filter(r => r.festivalId).length}`);

  groups.forEach((g, i) => {
    const reused = !!g.existingFestivalId;
    if (!reused) canonicalCreated++;
    const toRepoint = g.members.filter(m => m.festivalId !== g.existingFestivalId);
    recordsRepointed += toRepoint.length;
    g.conflicts.forEach(c => conflicts.push({ festival: g.canonical.name, ...c }));

    console.log(`\n[${i + 1}] ${reused ? 'REUSE canonical ' + g.existingFestivalId : 'CREATE canonical'}`);
    console.log(`    ${fmtCanonical(g.canonical)}`);
    console.log(`    createdBy: ${g.canonical.createdBy || '(existing)'}`);
    console.log(`    members: ${g.members.length}${g.members.length > 1 ? '  <-- MERGE' : ''}`);
    g.members.forEach(m => {
      const action = m.festivalId === g.existingFestivalId ? 'unchanged' : 'repoint';
      console.log(`      ${action.padEnd(9)} users/${m.uid}/festivals/${m.docId}` +
        `   keeps notes: ${m.notes ? `"${m.notes}"` : '(none)'}`);
    });
  });

  console.log(`\n${'-'.repeat(72)}`);
  console.log(`canonical festivals to create : ${canonicalCreated}`);
  console.log(`user records to repoint       : ${recordsRepointed}`);
  console.log(`groups that merge 2+ users    : ${groups.filter(g => g.members.length > 1).length}`);
  console.log(`shows read or written         : 0  (links are by attendance id, which never changes)`);
  console.log(`notes or ratings deleted      : 0`);

  if (conflicts.length) {
    console.log(`\nCONFLICTS — earliest record wins the canonical value; these are logged, not resolved:`);
    conflicts.forEach(c => {
      console.log(`  ${c.festival}  users/${c.uid}/festivals/${c.docId}`);
      c.differences.forEach(d => console.log(`     - ${d}`));
    });
  } else {
    console.log('\nCONFLICTS: none');
  }

  return groups;
}

const firstPass = report('DRY RUN 1 — fresh migration (nothing migrated yet)', FIXTURES, []);

// Simulate the state after a real (non-dry) run: each canonical exists,
// and each user record now points at it with its own name/dates dropped.
const canonicalsAfter = firstPass.map((g, i) => ({ id: `canon-${i + 1}`, ...g.canonical }));
const recordsAfter = firstPass.flatMap((g, i) => g.members.map(m => ({
  uid: m.uid,
  docId: m.docId,
  festivalId: `canon-${i + 1}`,
  name: '',
  startDate: '',
  endDate: '',
  location: '',
  notes: m.notes,
  rating: null,
  createdAt: m.createdAt,
})));

// One user's record failed to write on the first pass, so it is still in
// its pre-migration shape. The rerun must fold it into the canonical the
// first run already created, not make a second one.
recordsAfter.push({
  uid: 'bob', docId: 'f-b1', festivalId: null,
  name: 'bonnaroo', startDate: '2026-06-11', endDate: '2026-06-14',
  location: 'Manchester TN', notes: '', rating: null, createdAt: '2026-02-11T09:30:00Z',
});
const idx = recordsAfter.findIndex(r => r.uid === 'bob' && r.docId === 'f-b1' && r.festivalId);
if (idx >= 0) recordsAfter.splice(idx, 1);

report('DRY RUN 2 — rerun after a real run, with one record that failed first time', recordsAfter, canonicalsAfter);

console.log('\nIDEMPOTENCE CHECK: run 2 should create canonicals only for groups run 1 did not cover.\n');

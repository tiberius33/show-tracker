/**
 * The 24-hour review commitment in the Community Guidelines is the part
 * of Guideline 1.2 that is a promise rather than a feature, and
 * netlify/functions/moderation-sla-reminder.js is the only thing keeping
 * it. Its eligibility rule is the whole of its logic, and it is the kind
 * of rule that is easy to get subtly wrong in a direction nobody notices
 * — too eager and the admin inbox becomes noise that gets filtered, too
 * lazy and a report quietly ages past the deadline.
 */

const assert = require('node:assert');
const {
  isDueForReminder, REMINDER_AFTER_HOURS, MIN_HOURS_BETWEEN_REMINDERS,
} = require('../../netlify/functions/moderation-sla-reminder.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

const NOW = Date.UTC(2026, 8, 17, 12, 0, 0);
const hoursAgo = (h) => ({ toMillis: () => NOW - h * 3_600_000 });

console.log('\nmoderation SLA reminders');

test('a fresh report is left alone', () => {
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: hoursAgo(1) }, NOW), false);
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: hoursAgo(11.9) }, NOW), false);
});

test('a report past the half-life is reminded', () => {
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: hoursAgo(REMINDER_AFTER_HOURS) }, NOW), true);
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: hoursAgo(30) }, NOW), true);
});

test('the half-life is half the 24-hour commitment', () => {
  // If the commitment in the Terms ever changes, this is what should
  // fail first. A reminder at the deadline is a post-mortem.
  assert.strictEqual(REMINDER_AFTER_HOURS, 12);
});

test('a resolved report is never reminded, however old', () => {
  assert.strictEqual(isDueForReminder({ status: 'actioned', createdAt: hoursAgo(200) }, NOW), false);
  assert.strictEqual(isDueForReminder({ status: 'dismissed', createdAt: hoursAgo(200) }, NOW), false);
});

test('a recently reminded report is not reminded again', () => {
  // The schedule is every four hours; without this a stubborn report
  // would generate six emails a day and train the admin to ignore them.
  assert.strictEqual(isDueForReminder({
    status: 'open', createdAt: hoursAgo(40), lastRemindedAt: hoursAgo(1),
  }, NOW), false);
});

test('a report reminded long enough ago is reminded again', () => {
  assert.strictEqual(isDueForReminder({
    status: 'open', createdAt: hoursAgo(40), lastRemindedAt: hoursAgo(MIN_HOURS_BETWEEN_REMINDERS),
  }, NOW), true);
});

test('never having been reminded is not the same as reminded at epoch', () => {
  // An absent lastRemindedAt must read as "infinitely long ago", not 0 —
  // the bug that would suppress the FIRST reminder for every report.
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: hoursAgo(13) }, NOW), true);
  assert.strictEqual(isDueForReminder({
    status: 'open', createdAt: hoursAgo(13), lastRemindedAt: null,
  }, NOW), true);
});

test('a missing createdAt does not spam', () => {
  // hoursSince returns 0 for an unreadable timestamp, which must read as
  // "too new to remind" rather than "infinitely old".
  assert.strictEqual(isDueForReminder({ status: 'open' }, NOW), false);
  assert.strictEqual(isDueForReminder({ status: 'open', createdAt: null }, NOW), false);
});

test('the JSON timestamp shape works too', () => {
  // A Timestamp that has crossed a JSON boundary arrives as {_seconds}.
  assert.strictEqual(isDueForReminder({
    status: 'open', createdAt: { _seconds: (NOW - 20 * 3_600_000) / 1000 },
  }, NOW), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

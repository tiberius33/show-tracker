/**
 * The same tiny test runner the repo's other node tests use, made async,
 * plus the environment every email test needs.
 */

process.env.UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET_TEST || 'test-secret-that-is-long-enough-for-hmac-0123456789';
process.env.RESEND_API_KEY = 're_test_key';
process.env.MAILING_ADDRESS = 'PO Box 123, Nashville, TN 37201';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

async function run(title) {
  let passed = 0;
  let failed = 0;
  console.log(`\n${title}`);
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${t.name}\n    ${e.stack || e.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

module.exports = { test, run };

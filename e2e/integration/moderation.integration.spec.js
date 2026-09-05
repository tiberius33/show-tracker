// @ts-check
/**
 * Moderation integration tests — the full App Store Guideline 1.2 loop:
 * post → filter → report → auto-hide at three reports → admin dismiss.
 *
 * Requires:
 *   TEST_EMAIL   / TEST_PASSWORD    — the author, who posts the comment
 *   TEST_EMAIL_2 / TEST_PASSWORD_2  — reporter 1
 *   TEST_EMAIL_3 / TEST_PASSWORD_3  — reporter 2
 *   TEST_EMAIL_4 / TEST_PASSWORD_4  — reporter 3
 *   ADMIN_EMAIL  / ADMIN_PASSWORD   — the admin account, to dismiss
 *
 * WHY IT NEEDS FOUR ACCOUNTS AND SKIPS WITHOUT THEM. The auto-hide
 * threshold counts DISTINCT reporters, enforced by a deterministic report
 * id of `${contentId}_${reporterId}` — which is the property worth
 * testing, and it cannot be exercised by one account reporting three
 * times. A test that faked it would be testing nothing. The suite skips
 * rather than degrading into a weaker check, so a green run without these
 * credentials is honest about what it did not cover.
 *
 * WHY IT IS NOT IN THE SMOKE SUITE. Smoke runs against production on
 * every push to main. This spec files real reports and hides real content;
 * running it there would auto-hide a comment on the live site on every
 * push. Integration runs on demand against a preview.
 *
 * All content posted here carries the RUN_ID so a failed run leaves
 * something identifiable behind rather than anonymous debris.
 */
const { test, expect } = require('@playwright/test');
const { loginUser, logoutUser, dismissOverlays } = require('../utils/test-helpers');

const AUTHOR = { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD };
const REPORTERS = [
  { email: process.env.TEST_EMAIL_2, password: process.env.TEST_PASSWORD_2 },
  { email: process.env.TEST_EMAIL_3, password: process.env.TEST_PASSWORD_3 },
  { email: process.env.TEST_EMAIL_4, password: process.env.TEST_PASSWORD_4 },
];
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };

// A show every account can reach. Comments are keyed by concert identity
// (see lib/comments.js), not by anyone's private show record, so all five
// accounts see the same thread without each needing to log the show.
const SHOW_PATH = process.env.MODERATION_TEST_SHOW_PATH;

const RUN_ID = Date.now();
const MARKER = `moderation-e2e-${RUN_ID}`;

const haveAll = [AUTHOR, ...REPORTERS, ADMIN].every((a) => a.email && a.password) && !!SHOW_PATH;

test.describe('Guideline 1.2 — the full report loop', () => {
  test.skip(
    !haveAll,
    'Skipping: needs TEST_EMAIL(_2.._4), ADMIN_EMAIL/ADMIN_PASSWORD and MODERATION_TEST_SHOW_PATH',
  );

  // Serial: each step depends on the state the previous one left behind.
  test.describe.configure({ mode: 'serial' });

  /** The comment box on a show page. */
  const composer = (page) => page.getByPlaceholder(/share your thoughts on this show/i);

  test('the filter rejects a blocked term client-side, before any write', async ({ page }) => {
    await loginUser(page, AUTHOR.email, AUTHOR.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    await composer(page).fill(`${MARKER} what the fuck was that`);
    await page.getByRole('button', { name: /^post$/i }).click();

    // Inline under the box, in the form-error style — never a native
    // alert, which is what the requirement in the brief was reacting to.
    await expect(page.getByText(/language we don.t allow/i)).toBeVisible();
    // And nothing was published.
    await expect(page.locator('body')).not.toContainText(`${MARKER} what the`);
  });

  test('a clean comment posts', async ({ page }) => {
    await loginUser(page, AUTHOR.email, AUTHOR.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    await composer(page).fill(`${MARKER} genuinely one of the best nights`);
    await page.getByRole('button', { name: /^post$/i }).click();

    await expect(page.getByText(MARKER).first()).toBeVisible({ timeout: 15000 });
  });

  test('three distinct reporters auto-hide it', async ({ browser }) => {
    for (const [i, reporter] of REPORTERS.entries()) {
      // A fresh context per reporter — the distinct-reporter count is the
      // thing under test, so they must not share a session.
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginUser(page, reporter.email, reporter.password);
      await dismissOverlays(page);
      await page.goto(SHOW_PATH, { waitUntil: 'load' });

      const row = page.locator('div').filter({ hasText: MARKER }).last();
      await row.getByRole('button', { name: /report/i }).first().click();

      await page.getByRole('dialog').getByText(/harassment or hate/i).click();
      await page.getByRole('button', { name: /send report/i }).click();

      // Hidden for the reporter immediately, before the threshold is
      // reached — that is the local-hide half of ReportModal.
      await expect(page.getByText(MARKER)).toHaveCount(0, { timeout: 15000 });

      await logoutUser(page);
      await context.close();

      if (i === REPORTERS.length - 1) {
        // The third report crosses AUTO_HIDE_THRESHOLD, which pulls the
        // comment out of showComments entirely. Check with an account
        // that never reported it, so a pass cannot be the reporter's own
        // local hide.
        const other = await browser.newContext();
        const otherPage = await other.newPage();
        await loginUser(otherPage, AUTHOR.email, AUTHOR.password);
        await dismissOverlays(otherPage);
        await otherPage.goto(SHOW_PATH, { waitUntil: 'load' });
        await expect(otherPage.getByText(MARKER)).toHaveCount(0, { timeout: 20000 });
        await other.close();
      }
    }
  });

  test('the admin sees it in the queue and can dismiss it', async ({ page }) => {
    await loginUser(page, ADMIN.email, ADMIN.password);
    await dismissOverlays(page);
    await page.goto('/admin', { waitUntil: 'load' });

    await page.getByRole('button', { name: /moderation/i }).click();

    // The snapshot is what makes the queue usable after auto-hide — the
    // comment document no longer exists at this point.
    await expect(page.getByText(MARKER).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/auto-hidden/i).first()).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /^dismiss$/i }).first().click();

    await expect(page.getByText(/the content is visible again/i)).toBeVisible({ timeout: 20000 });
  });

  test('dismissing put the comment back where it was', async ({ page }) => {
    await loginUser(page, AUTHOR.email, AUTHOR.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    // Restored under its original document id, so replies and links to it
    // still resolve — see the dismiss branch of moderate-report.js.
    await expect(page.getByText(MARKER).first()).toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async ({ browser }) => {
    if (!haveAll) return;
    // Best effort: leave the thread as it was found.
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginUser(page, AUTHOR.email, AUTHOR.password);
      await page.goto(SHOW_PATH, { waitUntil: 'load' });
      const row = page.locator('div').filter({ hasText: MARKER }).last();
      page.once('dialog', (d) => d.accept());
      await row.getByRole('button', { name: /delete/i }).first().click();
      await context.close();
    } catch {
      console.warn(`[moderation] Could not clean up ${MARKER} — remove it by hand.`);
    }
  });
});

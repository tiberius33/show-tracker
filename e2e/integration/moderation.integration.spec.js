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
const { loginUser, logoutUser, dismissOverlays, acceptTerms } = require('../utils/test-helpers');

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

// ---------------------------------------------------------------------------
// Blocking (Guideline 1.2, requirement 4)
// ---------------------------------------------------------------------------
//
// Apple asks for three things here and the third is the one that is easy
// to claim and hard to do: blocking must remove the blocked user's content
// from the blocker's feed INSTANTLY, and it must notify the developer.
// Both are asserted below, and "instantly" is asserted the only way that
// means anything — by never reloading the page.
test.describe('Guideline 1.2 — blocking', () => {
  const BLOCKER = { email: process.env.TEST_EMAIL_2, password: process.env.TEST_PASSWORD_2 };

  const haveBlock = AUTHOR.email && AUTHOR.password
    && BLOCKER.email && BLOCKER.password
    && ADMIN.email && ADMIN.password && !!SHOW_PATH;

  test.skip(!haveBlock, 'Skipping: needs TEST_EMAIL, TEST_EMAIL_2, ADMIN_EMAIL and MODERATION_TEST_SHOW_PATH');
  test.describe.configure({ mode: 'serial' });

  const BLOCK_MARKER = `block-e2e-${RUN_ID}`;

  test('the author posts something for the blocker to see', async ({ page }) => {
    await loginUser(page, AUTHOR.email, AUTHOR.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    await page.getByPlaceholder(/share your thoughts on this show/i)
      .fill(`${BLOCK_MARKER} see you at the next one`);
    await page.getByRole('button', { name: /^post$/i }).click();
    await expect(page.getByText(BLOCK_MARKER).first()).toBeVisible({ timeout: 15000 });
  });

  test('blocking from the profile sheet removes their content with no reload', async ({ page }) => {
    await loginUser(page, BLOCKER.email, BLOCKER.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    const comment = page.getByText(BLOCK_MARKER).first();
    await expect(comment).toBeVisible({ timeout: 15000 });

    // Open the author's profile by tapping their name on the comment —
    // the path a reviewer takes, and the one that did not exist before
    // v5.36.2. Blocking used to be reachable only from the friends grid.
    await page.getByRole('button', { name: /view .*profile/i }).first().click();
    await expect(page.getByTestId('user-profile-sheet')).toBeVisible();

    await page.getByTestId('block-user').click();
    await expect(page.getByTestId('block-confirm')).toBeVisible();
    await page.getByTestId('block-confirm-yes').click();

    // THE ASSERTION THAT MATTERS. No goto, no reload — if this passes
    // only after a refresh, the requirement is not met. AppContext sets
    // blockedUserIds optimistically on the same tick, and every selector
    // filters on it.
    await expect(page.getByText(BLOCK_MARKER)).toHaveCount(0, { timeout: 10000 });
  });

  test('the block survives a reload, and is listed in Settings', async ({ page }) => {
    await loginUser(page, BLOCKER.email, BLOCKER.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });
    await expect(page.getByText(BLOCK_MARKER)).toHaveCount(0, { timeout: 15000 });

    // Guideline 1.2 wants blocking undoable, and a block with no visible
    // list and no way back is a trap rather than a control.
    await page.goto('/profile', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /blocked accounts/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /unblock/i }).first()).toBeVisible();
  });

  test('the admin was notified — the block is in the queue', async ({ page }) => {
    await loginUser(page, ADMIN.email, ADMIN.password);
    await dismissOverlays(page);
    await page.goto('/admin', { waitUntil: 'load' });
    await page.getByRole('button', { name: /moderation/i }).click();

    // notify-block.js files it as a report with reason 'blocked', so it
    // lands in the same queue on the same 24-hour clock. A separate
    // collection would have needed its own screen to be looked at.
    await expect(page.getByText(/user blocked them/i).first())
      .toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async ({ browser }) => {
    if (!haveBlock) return;
    // Unblock, so the next run starts from a clean pair — a leftover
    // block would hide the content the next run posts.
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginUser(page, BLOCKER.email, BLOCKER.password);
      await page.goto('/profile', { waitUntil: 'load' });
      await page.getByRole('button', { name: /unblock/i }).first().click();
      await context.close();
    } catch {
      console.warn('[moderation] Could not unblock — clear it by hand before the next run.');
    }
  });
});

// ---------------------------------------------------------------------------
// Ejection (Guideline 1.2, requirement 5)
// ---------------------------------------------------------------------------
//
// "…with the developer removing the offending content and ejecting the
// user who provided the offending content." Before v5.36.2 the ban action
// set a flag and stopped there: the user could still sign in, still read,
// and everything they had posted stayed up. This asserts the version that
// actually ejects.
//
// ── THIS TEST DESTROYS AN ACCOUNT ───────────────────────────────────────
//
// Ejection disables the Firebase Auth account, and there is no un-eject
// in the admin UI — reversing it means firebase-admin, by hand. So this
// deliberately will NOT run against TEST_EMAIL or any other account the
// rest of the suite depends on. It requires its own credentials in
// EJECT_TEST_EMAIL / EJECT_TEST_PASSWORD and skips without them, and the
// account it is pointed at should be considered spent afterwards.
//
// Create a fresh one per run, or re-enable it in the Firebase console
// between runs. There is no cleanup hook here because there is nothing
// Playwright can do to undo it.
test.describe('Guideline 1.2 — ejection', () => {
  const DOOMED = {
    email: process.env.EJECT_TEST_EMAIL,
    password: process.env.EJECT_TEST_PASSWORD,
  };

  // AUTHOR and REPORTERS[0] are used below too — as the account that
  // files the report, and as a third party who never reported, to prove
  // the sweep removed the content for everyone rather than just hiding it
  // locally for the reporter. Without them the last two assertions would
  // run against undefined credentials and fail for the wrong reason.
  const haveEject = DOOMED.email && DOOMED.password
    && ADMIN.email && ADMIN.password
    && AUTHOR.email && AUTHOR.password
    && REPORTERS[0].email && REPORTERS[0].password
    && !!SHOW_PATH;

  test.skip(
    !haveEject,
    'Skipping: needs EJECT_TEST_EMAIL / EJECT_TEST_PASSWORD (a disposable account — ejection cannot be undone from the app), plus TEST_EMAIL, TEST_EMAIL_2 and ADMIN_EMAIL',
  );
  test.describe.configure({ mode: 'serial' });

  const EJECT_MARKER = `eject-e2e-${RUN_ID}`;

  test('the doomed account posts, and can sign in beforehand', async ({ page }) => {
    await loginUser(page, DOOMED.email, DOOMED.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    await page.getByPlaceholder(/share your thoughts on this show/i)
      .fill(`${EJECT_MARKER} this account is about to be ejected`);
    await page.getByRole('button', { name: /^post$/i }).click();
    await expect(page.getByText(EJECT_MARKER).first()).toBeVisible({ timeout: 15000 });
  });

  test('a reporter flags it, and it disappears for them immediately', async ({ page }) => {
    await loginUser(page, REPORTERS[0].email, REPORTERS[0].password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });

    const row = page.locator('div').filter({ hasText: EJECT_MARKER }).last();
    await row.getByRole('button', { name: /report/i }).first().click();
    await page.getByRole('dialog').getByText(/harassment or hate/i).click();
    await page.getByRole('button', { name: /send report/i }).click();

    await expect(page.getByText(EJECT_MARKER)).toHaveCount(0, { timeout: 15000 });
    // The 24-hour commitment, stated back to the reporter.
    await expect(page.getByText(/within 24 hours/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('the admin ejects the author', async ({ page }) => {
    await loginUser(page, ADMIN.email, ADMIN.password);
    await dismissOverlays(page);
    await page.goto('/admin', { waitUntil: 'load' });
    await page.getByRole('button', { name: /moderation/i }).click();

    const row = page.locator('li').filter({ hasText: EJECT_MARKER }).first();
    await expect(row).toBeVisible({ timeout: 20000 });

    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete \+ eject|eject user/i }).first().click();

    await expect(page.getByText(/ejected|banned/i).first()).toBeVisible({ timeout: 25000 });
  });

  test('the ejected account cannot sign back in', async ({ page }) => {
    // The whole point. Firebase rejects a disabled account with
    // auth/user-disabled, which LoginForm maps to this copy.
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /log in/i }).first().click();
    await acceptTerms(page);
    await page.getByPlaceholder('Email address').fill(DOOMED.email);
    await page.getByPlaceholder('Password').fill(DOOMED.password);
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/account has been disabled/i)).toBeVisible({ timeout: 20000 });
    // And it never reached the app.
    await expect(page.getByTestId('terms-agreement')).toBeVisible();
  });

  test('their content is gone for everyone, not just the reporter', async ({ page }) => {
    // The sweep in ejectUser() moves every comment, meetup message and
    // photo the account posted into moderationHidden. Checked with an
    // account that never reported it, so a pass cannot be the reporter's
    // own local hide.
    await loginUser(page, AUTHOR.email, AUTHOR.password);
    await dismissOverlays(page);
    await page.goto(SHOW_PATH, { waitUntil: 'load' });
    await expect(page.getByText(EJECT_MARKER)).toHaveCount(0, { timeout: 20000 });
  });
});

// @ts-check
'use strict';

const path = require('node:path');
const { expect } = require('@playwright/test');

// Where e2e/auth.setup.js saves the one signed-in session per run, and
// where the authenticated specs opt into it. Declared once here so the
// setup file and every consumer cannot drift apart.
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'user.json');

const LOGIN_TIMEOUT_MS = 20000;

/**
 * Sign in via the email/password form.
 * Returns once the main authenticated sidebar is visible.
 *
 * Every authenticated smoke test funnels through here, so when sign-in
 * stops working this is the single line that fails — ten times over, all
 * reading `expect(locator).toBeVisible() failed ... element(s) not found`,
 * which says nothing about *why*. It could be bad credentials, a rejected
 * account, Firebase being down, or a genuine app regression, and the
 * report looked identical for all of them.
 *
 * So the wait races the signed-in sidebar against the login form's own
 * error message (components/auth/LoginForm.js renders it as
 * `<p class="text-danger">`) and reports whichever arrives. A rejected
 * sign-in now fails with Firebase's actual reason instead of a bare
 * locator timeout.
 */
async function loginUser(page, email, password) {
  await page.goto('/', { waitUntil: 'load' });
  // Landing page uses "Log in" (updated from "Sign in" in the v2 design)
  await page.getByRole('button', { name: /log in/i }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  // Auth modal submit still says "Sign In"
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  const sidebar = page.locator('[class*="bg-sidebar"]').getByText(/shows/i).first();
  const authError = page.locator('form').locator('p.text-danger').first();

  // A locator that times out must not win the race — otherwise whichever
  // rejects first decides the outcome. Losing branches park forever and
  // the explicit timer below is the only thing that reports "neither".
  const never = () => new Promise(() => {});
  const outcome = await Promise.race([
    sidebar.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS + 5000 }).then(() => 'signed-in').catch(never),
    authError.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS + 5000 }).then(() => 'auth-error').catch(never),
    new Promise(resolve => setTimeout(() => resolve('timeout'), LOGIN_TIMEOUT_MS)),
  ]);

  if (outcome === 'auth-error') {
    const message = ((await authError.textContent()) || '').trim();
    throw new Error(
      `Sign-in was rejected for ${email}: "${message}". ` +
      'The page worked; the sign-in did not. Most often that is the TEST_EMAIL / ' +
      'TEST_PASSWORD repository secrets, but the message above is the real reason — ' +
      'auth/network-request-failed, for instance, means Firebase was unreachable.'
    );
  }

  if (outcome === 'timeout') {
    throw new Error(
      `Sign-in neither completed nor reported an error within ${LOGIN_TIMEOUT_MS}ms at ${page.url()}. ` +
      'The signed-in sidebar never rendered and the login form showed no message.'
    );
  }

  await expect(sidebar).toBeVisible();
}

/**
 * Dismiss any overlay modals/banners that appear after login.
 * These can block subsequent clicks if not handled.
 *
 * The "What's New" modal often appears 200-500ms after the sidebar renders,
 * so we wait up to 5s for it rather than giving up after 2s.
 */
async function dismissOverlays(page) {
  // "What's New" modal — wait generously since it can appear after a short delay
  const whatsNew = page.getByRole('button', { name: 'Got it' });
  if (await whatsNew.isVisible({ timeout: 5000 }).catch(() => false)) {
    await whatsNew.click();
    // Wait until the modal heading is fully gone before proceeding
    await page
      .getByRole('heading', { name: "What's New" })
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {});
  }

  // Onboarding tooltip (shares the same "Got it" text, check again briefly)
  const tooltip = page.getByRole('button', { name: /got it/i });
  if (await tooltip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await tooltip.click();
  }

  await dismissCookieBanner(page);
}

/**
 * Dismiss the cookie-consent banner, if it is showing.
 *
 * Worth its own helper because the banner is `fixed bottom-0 left-0 right-0
 * z-50`: it sits on top of whatever is at the bottom of the viewport, which
 * in this app is the bottom of the sidebar — "How to Use", the Support link
 * and "Exit Guest Mode". Playwright reports those as
 * `<div …> intercepts pointer events` and burns the whole test timeout
 * retrying, so any test that clicks down there has to clear it first.
 *
 * Safe to call unconditionally: it no-ops when the banner is dismissed
 * (already accepted, or a context that never showed it).
 *
 * ANCHOR ON THE BUTTON, NOT THE CONTAINER. CookieConsentBanner never
 * unmounts — see the comment in components/CookieConsentBanner.jsx, which
 * keeps the node mounted on purpose so its first appearance doesn't count
 * toward Cumulative Layout Shift. Once dismissed it keeps its
 * `fixed bottom-0` classes and slides away with
 * `translate-y-full pointer-events-none`, setting `aria-hidden="true"`.
 *
 * That breaks a container-first check, because Playwright's two notions of
 * "there" disagree about it:
 *   - `isVisible()` is layout-based. A translated element still has a
 *     non-empty bounding box and is not `display:none`, so the dismissed
 *     banner answers **true**.
 *   - `getByRole()` reads the accessibility tree, where an `aria-hidden`
 *     subtree contains no buttons at all, so the click target never
 *     resolves.
 * The guard therefore passed and the click then waited out the entire 30s
 * test timeout for a button that could not appear. It only bit the
 * authenticated specs: they restore the storage state captured by
 * e2e/auth.setup.js *after* it accepted the banner, so they start with
 * `cookie-consent` already in localStorage and the banner already hidden.
 * A signed-out test gets a fresh context, sees the real banner, and passes —
 * which is why this survived the guest-mode fix in #287.
 *
 * Anchoring on the button makes both halves agree: no accessible button
 * means dismissed, and the guard falls through in 2s instead of 30s.
 */
async function dismissCookieBanner(page) {
  const acceptButton = page
    .locator('[class*="fixed bottom-0"]')
    .filter({ hasText: /cookie|accept/i })
    .getByRole('button')
    .first();

  if (!(await acceptButton.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }

  // Bounded so a future variant of this problem costs seconds, not the
  // whole test timeout.
  await acceptButton.click({ timeout: 5000 }).catch(() => {});
  // Waiting for the container to go `hidden` would never resolve — it stays
  // mounted. The button leaving the accessibility tree is the real signal.
  await acceptButton.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Full authenticated session setup: navigate, sign in, dismiss overlays.
 */
async function setupAuthenticatedSession(page, email, password) {
  await loginUser(page, email, password);
  await dismissOverlays(page);
}

/**
 * Sign out via the Logout button.
 */
async function logoutUser(page) {
  await page.getByText('Logout').click({ force: true });
  // Landing page CTA is "Start tracking" (updated from "Get started" in v2 design)
  await expect(
    page.getByRole('button', { name: /start tracking/i }).first()
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Navigate to a page via the sidebar link by its label.
 */
async function navigateSidebar(page, label) {
  await page.getByRole('link', { name: new RegExp(label, 'i') }).first().click();
  await expect(page.locator('body')).not.toContainText('Application error');
}

module.exports = {
  AUTH_FILE,
  loginUser,
  dismissOverlays,
  dismissCookieBanner,
  setupAuthenticatedSession,
  logoutUser,
  navigateSidebar,
};

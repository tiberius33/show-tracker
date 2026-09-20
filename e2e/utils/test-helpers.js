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
/**
 * Tick the Guideline 1.2 terms agreement in the auth modal.
 *
 * Idempotent and tolerant of the agreement not being present: the modal
 * shows it for the login and signup modes but not for password reset, and
 * a spec that lands on the wrong one should fail on its own assertion
 * rather than here.
 */
async function acceptTerms(page) {
  const box = page.getByTestId('terms-agree-checkbox');
  // waitFor(), never count(). AuthModal is a dynamic import, so on a fast
  // machine count() runs before the modal has rendered, returns 0, and the
  // tolerant guard below silently skips the tick — leaving the submit
  // button disabled and the caller's click to time out with no clue why.
  // waitFor() auto-waits; count() does not.
  try {
    await box.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    // Genuinely absent: the modal is in a mode that is not gated, e.g.
    // password reset. The caller's own assertions decide whether that is
    // a problem.
    return;
  }
  if (!(await box.isChecked())) await box.check();
}

async function loginUser(page, email, password) {
  await page.goto('/', { waitUntil: 'load' });
  // Landing page uses "Log in" (updated from "Sign in" in the v2 design)
  await page.getByRole('button', { name: /log in/i }).click();

  // Guideline 1.2: every sign-in control is disabled until the terms
  // agreement is ticked, so this is now a required step of signing in
  // rather than test scaffolding — a real user does exactly this. Without
  // it the submit button below is disabled and the click times out.
  await acceptTerms(page);

  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  // Auth modal submit still says "Sign In"
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  const sidebar = page.locator('[class*="bg-sidebar"]').getByText(/shows/i).first();
  const authError = page.locator('form').locator('p.text-danger').first();
  // The launch gate for an account whose stored acceptance is behind
  // TERMS_VERSION. Ticking the box above should have flushed acceptance to
  // the profile, so seeing this means that write did not land — raced here
  // rather than left to time out, because "sidebar never appeared" is a
  // uselessly vague way to report it.
  const termsGate = page.getByTestId('terms-gate');

  // A locator that times out must not win the race — otherwise whichever
  // rejects first decides the outcome. Losing branches park forever and
  // the explicit timer below is the only thing that reports "neither".
  const never = () => new Promise(() => {});
  const outcome = await Promise.race([
    sidebar.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS + 5000 }).then(() => 'signed-in').catch(never),
    authError.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS + 5000 }).then(() => 'auth-error').catch(never),
    termsGate.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS + 5000 }).then(() => 'terms-gate').catch(never),
    new Promise(resolve => setTimeout(() => resolve('timeout'), LOGIN_TIMEOUT_MS)),
  ]);

  if (outcome === 'terms-gate') {
    throw new Error(
      `Signed in as ${email}, but the terms gate appeared instead of the app. ` +
      'The agreement was ticked before sign-in, so the flush to ' +
      'userProfiles/{uid}.termsAcceptedVersion did not land — check the ' +
      'Firestore write in AppContext\'s auth listener.'
    );
  }

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
  acceptTerms,
  dismissOverlays,
  setupAuthenticatedSession,
  logoutUser,
  navigateSidebar,
};

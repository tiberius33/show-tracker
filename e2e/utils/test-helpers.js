// @ts-check
'use strict';

const { expect } = require('@playwright/test');

/**
 * Sign in via the email/password form.
 * Returns once the main authenticated sidebar is visible.
 */
async function loginUser(page, email, password) {
  await page.goto('/', { waitUntil: 'load' });
  // Landing page uses "Log in" (updated from "Sign in" in the v2 design)
  await page.getByRole('button', { name: /log in/i }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  // Auth modal submit still says "Sign In"
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  // Wait for the sidebar nav link to appear — confirms auth + render
  await expect(
    page.locator('[class*="bg-sidebar"]').getByText(/shows/i).first()
  ).toBeVisible({ timeout: 20000 });
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

  // Cookie consent banner
  const cookieBanner = page
    .locator('[class*="fixed bottom-0"]')
    .filter({ hasText: /cookie|accept/i });
  if (await cookieBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBanner.getByRole('button').first().click();
    await cookieBanner
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => {});
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
  loginUser,
  dismissOverlays,
  setupAuthenticatedSession,
  logoutUser,
  navigateSidebar,
};

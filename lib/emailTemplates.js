/**
 * Email templates for MySetlists notifications.
 * Light, professional design with MySetlists branding.
 *
 * Brand colors:
 *   Green  #34D399 — primary buttons, highlights
 *   Orange #FB923C — "setlists" accent, secondary highlights
 *
 * Templates are pure functions that return { subject, html } objects.
 */

const LOGO_URL = 'https://mysetlists.net/logo.svg';
const APP_URL = 'https://mysetlists.net';
const GREEN = '#34D399';
const GREEN_DARK = '#059669'; // darker green for button text contrast
const ORANGE = '#FB923C';

/**
 * Encode a user UID into a base64url token for the unsubscribe link.
 */
function encodeUnsubscribeToken(uid) {
  try {
    return Buffer.from(uid).toString('base64url');
  } catch {
    // Browser fallback (Buffer polyfill may not support base64url)
    return btoa(uid).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// ── Shared layout wrapper ────────────────────────────────────────────
function wrap(content, { uid } = {}) {
  const unsubscribeLink = uid
    ? `<p style="font-size:12px;margin:8px 0 0">
        <a href="${APP_URL}/api/unsubscribe?token=${encodeUnsubscribeToken(uid)}" style="color:#9ca3af;text-decoration:underline">Unsubscribe from emails</a>
      </p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <!-- Header with logo -->
        <tr><td style="padding:24px 32px 16px;text-align:center;border-bottom:1px solid #e5e7eb;background:#ffffff">
          <img src="${LOGO_URL}" alt="MySetlists" width="160" style="display:inline-block;max-width:160px;height:auto" />
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;color:#374151;font-size:15px;line-height:1.6">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #e5e7eb;background:#f9fafb">
          <p style="color:#9ca3af;font-size:12px;margin:0">
            <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none">my<span style="color:${ORANGE}">setlists</span>.net</a> &mdash; track every show you've ever been to
          </p>
          ${unsubscribeLink}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text, url) {
  return `
  <p style="margin:24px 0;text-align:center">
    <a href="${url}" style="background:${GREEN};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:15px">
      ${text}
    </a>
  </p>`;
}

function showCard(artist, venue, date) {
  return `
  <div style="border:1px solid #e5e7eb;border-left:4px solid ${GREEN};border-radius:8px;padding:16px 20px;margin:16px 0;background:#f9fafb">
    <p style="margin:0;font-weight:700;color:#111827;font-size:17px">${artist}</p>
    ${venue ? `<p style="margin:4px 0 0;color:#6b7280;font-size:14px">${venue}</p>` : ''}
    ${date ? `<p style="margin:4px 0 0;color:#6b7280;font-size:14px">${date}</p>` : ''}
  </div>`;
}

// ── Template: Invite Email ───────────────────────────────────────────
// Sent when a user invites a friend to join MySetlists
export function inviteEmail({ inviterName, inviteUrl, uid }) {
  const subject = `${inviterName} invited you to MySetlists!`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">You're invited!</h2>
    <p style="margin:0 0 12px"><strong style="color:#111827">${inviterName}</strong> has been tracking all their concerts on MySetlists — saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
    <p style="margin:0 0 4px">Here's what you can do:</p>
    <ul style="color:#4b5563;padding-left:20px;margin:8px 0 16px">
      <li>Log every show you've ever been to</li>
      <li>Import shows from Spotify listening history</li>
      <li>See stats like total shows, top artists, and top venues</li>
      <li>Share shows with friends and compare concert histories</li>
    </ul>
    ${button('Join MySetlists &rarr;', inviteUrl)}
    <p style="color:#6b7280;font-size:13px;text-align:center;margin:0">When you sign up, you and ${inviterName} will automatically be friends on the app.</p>
  `, { uid });
  return { subject, html };
}

// ── Template: Friend Joined ──────────────────────────────────────────
// Sent to the inviter when their friend signs up
export function friendJoinedEmail({ inviterName, newUserName, uid }) {
  const subject = `${newUserName} joined MySetlists via your invite!`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">Your invite worked!</h2>
    <p style="margin:0 0 16px"><strong style="color:#111827">${newUserName}</strong> just joined MySetlists via your invite link — you're now friends on the app!</p>
    <p style="margin:0 0 16px">Head over to MySetlists to check out their profile and see which shows you've both been to.</p>
    ${button('Go to MySetlists &rarr;', APP_URL)}
  `, { uid });
  return { subject, html };
}

// ── Template: Tag Notification (email invite) ────────────────────────
// Sent to a non-registered user when they're tagged in a show
export function tagByEmailNotification({ taggerName, artist, venue, date, personalMessage, signupUrl, uid }) {
  const subject = `${taggerName} tagged you in a show on MySetlists!`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">${taggerName} tagged you in a show!</h2>
    <p style="margin:0 0 8px"><strong style="color:#111827">${taggerName}</strong> tagged you in a show you attended together:</p>
    ${showCard(artist, venue, date)}
    ${personalMessage ? `<blockquote style="border-left:3px solid ${ORANGE};padding:12px 16px;color:#4b5563;font-style:italic;margin:16px 0;background:#fff7ed;border-radius:0 8px 8px 0">"${personalMessage}"</blockquote>` : ''}
    <p style="margin:0 0 4px">Join MySetlists to confirm the show and start tracking your concert history:</p>
    ${button('Join MySetlists &rarr;', signupUrl)}
  `, { uid });
  return { subject, html };
}

// ── Template: Tag Notification (existing user) ──────────────────────
// Sent to an existing user when a friend tags them in a show
export function showTagNotification({ taggerName, artist, venue, date, uid }) {
  const subject = `${taggerName} tagged you in a show on MySetlists!`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">${taggerName} tagged you in a show!</h2>
    <p style="margin:0 0 8px"><strong style="color:#111827">${taggerName}</strong> tagged you in a show you attended together:</p>
    ${showCard(artist, venue, date)}
    <p style="margin:0 0 16px">Open MySetlists to confirm or dismiss this tag.</p>
    ${button('Open MySetlists &rarr;', `${APP_URL}/friends?tab=requests`)}
  `, { uid });
  return { subject, html };
}

// ── Template: Tag Accepted / Confirmed ───────────────────────────────
// Sent to the tagger when their friend confirms a shared show
export function tagAcceptedEmail({ confirmerName, artist, venue, date, uid }) {
  const subject = `${confirmerName} confirmed they were at ${artist} with you!`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">They were there!</h2>
    <p style="margin:0 0 8px"><strong style="color:#111827">${confirmerName}</strong> just confirmed they were at this show with you:</p>
    ${showCard(artist, venue, date)}
    <p style="margin:0 0 16px">The show has been added to their setlist history on MySetlists.</p>
    ${button('View on MySetlists &rarr;', `${APP_URL}/friends`)}
  `, { uid });
  return { subject, html };
}

// ── Template: Show Suggestion Nudge ──────────────────────────────────
// Sent when one friend confirms a suggestion and the other hasn't responded
export function suggestionNudgeEmail({ fromName, friendName, artist, venue, date, uid }) {
  const subject = `${fromName} thinks you were both at ${artist}!`;
  const html = wrap(`
    <h2 style="color:${ORANGE};margin:0 0 16px;font-size:22px">Were you there?</h2>
    <p style="margin:0 0 8px"><strong style="color:#111827">${fromName}</strong> confirmed they were at this show and thinks you might have been there too:</p>
    ${showCard(artist, venue, date)}
    <p style="margin:0 0 4px">Were you there together? Head to MySetlists to confirm or dismiss:</p>
    ${button('Check it out &rarr;', `${APP_URL}/friends`)}
  `, { uid });
  return { subject, html };
}

// ── Template: Shared Memory Comment ──────────────────────────────────
// Sent when a friend adds a comment to a shared show memory
export function sharedMemoryEmail({ commenterName, artist, date, uid }) {
  const subject = `${commenterName} added a memory from ${artist}`;
  const html = wrap(`
    <h2 style="color:${GREEN_DARK};margin:0 0 16px;font-size:22px">New shared memory</h2>
    <p style="margin:0 0 16px"><strong style="color:#111827">${commenterName}</strong> added a comment to your shared memory of <strong style="color:#111827">${artist}</strong>${date ? ` (${date})` : ''}.</p>
    <p style="margin:0 0 4px">Head to MySetlists to see what they said and reply:</p>
    ${button('See &amp; Reply &rarr;', `${APP_URL}/friends`)}
  `, { uid });
  return { subject, html };
}

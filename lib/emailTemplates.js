/**
 * Email templates for MySetlists notifications.
 * All emails use branded design with the MySetlists logo,
 * green (#4bc86a) and amber (#f5a623) accent colors.
 *
 * Templates are pure functions that return { subject, html } objects.
 */

const LOGO_URL = 'https://mysetlists.net/logo.svg';
const APP_URL = 'https://mysetlists.net';
const GREEN = '#4bc86a';
const AMBER = '#f5a623';

// ── Shared layout wrapper ────────────────────────────────────────────
function wrap(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#1e293b;border-radius:12px;overflow:hidden">
        <!-- Header with logo -->
        <tr><td style="padding:24px 32px 16px;text-align:center;border-bottom:1px solid #334155">
          <img src="${LOGO_URL}" alt="MySetlists" width="160" style="display:inline-block;max-width:160px;height:auto" />
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;color:#e2e8f0;font-size:15px;line-height:1.6">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #334155">
          <p style="color:#64748b;font-size:12px;margin:0">
            <a href="${APP_URL}" style="color:#64748b;text-decoration:none">mysetlists.net</a> — track every show you've ever been to
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text, url, color = GREEN) {
  return `
  <p style="margin:24px 0;text-align:center">
    <a href="${url}" style="background:${color};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:15px">
      ${text}
    </a>
  </p>`;
}

function showCard(artist, venue, date) {
  const parts = [artist];
  if (venue) parts.push(`at ${venue}`);
  if (date) parts.push(`on ${date}`);
  return `
  <div style="background:#0f172a;border-left:4px solid ${GREEN};border-radius:8px;padding:16px 20px;margin:16px 0">
    <p style="margin:0;font-weight:600;color:#f1f5f9;font-size:16px">${artist}</p>
    ${venue ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:14px">${venue}</p>` : ''}
    ${date ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:14px">${date}</p>` : ''}
  </div>`;
}

// ── Template: Invite Email ───────────────────────────────────────────
// Sent when a user invites a friend to join MySetlists
export function inviteEmail({ inviterName, inviteUrl }) {
  const subject = `${inviterName} invited you to MySetlists!`;
  const html = wrap(`
    <h2 style="color:${GREEN};margin:0 0 16px;font-size:22px">You're invited! 🎶</h2>
    <p style="margin:0 0 12px"><strong style="color:#f1f5f9">${inviterName}</strong> has been tracking all their concerts on MySetlists — saving setlists, rating songs, and seeing their all-time stats. They think you'd love it too.</p>
    <p style="margin:0 0 4px">Here's what you can do:</p>
    <ul style="color:#cbd5e1;padding-left:20px;margin:8px 0 16px">
      <li>Log every show you've ever been to</li>
      <li>Import shows from Spotify listening history</li>
      <li>See stats like total shows, top artists, and top venues</li>
      <li>Share shows with friends and compare concert histories</li>
    </ul>
    ${button('Join MySetlists →', inviteUrl)}
    <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0">When you sign up, you and ${inviterName} will automatically be friends on the app.</p>
  `);
  return { subject, html };
}

// ── Template: Friend Joined ──────────────────────────────────────────
// Sent to the inviter when their friend signs up
export function friendJoinedEmail({ inviterName, newUserName }) {
  const subject = `${newUserName} joined MySetlists via your invite! 🎉`;
  const html = wrap(`
    <h2 style="color:${GREEN};margin:0 0 16px;font-size:22px">Your invite worked! 🎉</h2>
    <p style="margin:0 0 16px"><strong style="color:#f1f5f9">${newUserName}</strong> just joined MySetlists via your invite link — you're now friends on the app!</p>
    <p style="margin:0 0 16px">Head over to MySetlists to check out their profile and see which shows you've both been to.</p>
    ${button('Go to MySetlists →', APP_URL)}
  `);
  return { subject, html };
}

// ── Template: Tag Notification (email invite) ────────────────────────
// Sent to a non-registered user when they're tagged in a show
export function tagByEmailNotification({ taggerName, artist, venue, date, personalMessage, signupUrl }) {
  const subject = `${taggerName} tagged you in a show on MySetlists!`;
  const html = wrap(`
    <h2 style="color:${GREEN};margin:0 0 16px;font-size:22px">${taggerName} tagged you in a show!</h2>
    <p style="margin:0 0 8px"><strong style="color:#f1f5f9">${taggerName}</strong> thinks you were at this show:</p>
    ${showCard(artist, venue, date)}
    ${personalMessage ? `<blockquote style="border-left:3px solid ${AMBER};padding:12px 16px;color:#cbd5e1;font-style:italic;margin:16px 0;background:#0f172a;border-radius:0 8px 8px 0">"${personalMessage}"</blockquote>` : ''}
    <p style="margin:0 0 4px">Join MySetlists to confirm the show and start tracking your concert history:</p>
    ${button('Join MySetlists →', signupUrl)}
  `);
  return { subject, html };
}

// ── Template: Tag Accepted / Confirmed ───────────────────────────────
// Sent to the tagger when their friend confirms a shared show
export function tagAcceptedEmail({ confirmerName, artist, venue, date }) {
  const subject = `${confirmerName} confirmed they were at ${artist} with you! 🎶`;
  const html = wrap(`
    <h2 style="color:${GREEN};margin:0 0 16px;font-size:22px">They were there! 🎶</h2>
    <p style="margin:0 0 8px"><strong style="color:#f1f5f9">${confirmerName}</strong> just confirmed they were at this show with you:</p>
    ${showCard(artist, venue, date)}
    <p style="margin:0 0 16px">The show has been added to their setlist history on MySetlists.</p>
    ${button('View on MySetlists →', APP_URL)}
  `);
  return { subject, html };
}

// ── Template: Show Suggestion Nudge ──────────────────────────────────
// Sent when one friend confirms a suggestion and the other hasn't responded
export function suggestionNudgeEmail({ fromName, friendName, artist, venue, date }) {
  const subject = `${fromName} thinks you were both at ${artist}!`;
  const html = wrap(`
    <h2 style="color:${AMBER};margin:0 0 16px;font-size:22px">Were you there? 🤔</h2>
    <p style="margin:0 0 8px"><strong style="color:#f1f5f9">${fromName}</strong> confirmed they were at this show and thinks you might have been there too:</p>
    ${showCard(artist, venue, date)}
    <p style="margin:0 0 4px">Were you there together? Head to MySetlists to confirm or dismiss:</p>
    ${button('Check it out →', `${APP_URL}/friends`)}
  `);
  return { subject, html };
}

// ── Template: Shared Memory Comment ──────────────────────────────────
// Sent when a friend adds a comment to a shared show memory
export function sharedMemoryEmail({ commenterName, artist, date }) {
  const subject = `${commenterName} added a memory from ${artist}`;
  const html = wrap(`
    <h2 style="color:${GREEN};margin:0 0 16px;font-size:22px">New shared memory 💬</h2>
    <p style="margin:0 0 16px"><strong style="color:#f1f5f9">${commenterName}</strong> added a comment to your shared memory of <strong style="color:#f1f5f9">${artist}</strong>${date ? ` (${date})` : ''}.</p>
    <p style="margin:0 0 4px">Head to MySetlists to see what they said and reply:</p>
    ${button('See & Reply →', `${APP_URL}/friends`)}
  `);
  return { subject, html };
}

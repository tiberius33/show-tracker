/**
 * announcementRecipients — who an announcement goes to. Pure, so the
 * rules can be tested without Firestore.
 *
 *   profiles      [{ uid, email, emailOptOut, announcementsOptOut }]
 *   extraEmails   free-form strings from the admin's textarea
 *   suppressions  Map(emailHash → 'all' | 'announcements')
 *
 * Every address is lowercased and trimmed, validated, and deduped. An
 * extra address that belongs to an account is treated as that account
 * (its opt-outs apply, and it's counted as a user, not an extra). Then
 * each one goes through the same decideCanEmail() that canEmail() uses.
 */

const { normalizeEmail, hashEmail, isValidEmail } = require('./unsubscribeToken');
const { decideCanEmail } = require('./emailPolicy');

/** "a@x.com, b@y.com\nc@z.com" → ['a@x.com', 'b@y.com', 'c@z.com'] */
function splitEmailList(input) {
  const parts = Array.isArray(input) ? input : [input];
  return parts
    .flatMap((p) => String(p == null ? '' : p).split(/[\s,;]+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildAnnouncementRecipients({ profiles = [], extraEmails = [], suppressions = new Map() }) {
  const byEmail = new Map(); // email → { email, uid, profile, fromExtra }
  let invalid = 0;
  const invalidSamples = [];
  let duplicates = 0;

  for (const p of profiles) {
    const email = normalizeEmail(p.email);
    if (!email) continue;
    if (!isValidEmail(email)) { invalid++; if (invalidSamples.length < 20) invalidSamples.push(email); continue; }
    if (byEmail.has(email)) { duplicates++; continue; }
    byEmail.set(email, { email, uid: p.uid, profile: p, fromExtra: false });
  }

  for (const raw of splitEmailList(extraEmails)) {
    const email = normalizeEmail(raw);
    if (!isValidEmail(email)) { invalid++; if (invalidSamples.length < 20) invalidSamples.push(raw); continue; }
    if (byEmail.has(email)) { duplicates++; continue; }
    byEmail.set(email, { email, uid: null, profile: null, fromExtra: true });
  }

  const recipients = [];
  let excluded = 0;
  for (const r of byEmail.values()) {
    const hash = hashEmail(r.email);
    const ok = decideCanEmail({
      profile: r.profile,
      suppressionScope: suppressions.get(hash) || null,
      category: 'announcement',
    });
    if (!ok) { excluded++; continue; }
    recipients.push({ email: r.email, uid: r.uid || null, hash });
  }

  const users = recipients.filter((r) => r.uid).length;
  return {
    recipients,
    counts: {
      total: recipients.length,
      users,
      extras: recipients.length - users,
      excluded,
      invalid,
      duplicates,
    },
    invalidSamples,
  };
}

module.exports = { buildAnnouncementRecipients, splitEmailList };

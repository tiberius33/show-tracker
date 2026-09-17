// netlify/functions/moderation-sla-reminder.js
//
// Scheduled function: re-sends the admin notification for any report that
// has been open longer than REMINDER_AFTER_HOURS.
//
// WHY THIS EXISTS. The Community Guidelines commit to reviewing every
// report within 24 hours, and Apple's Guideline 1.2 checks that
// commitment. Everything else in the moderation feature gets a report in
// front of a human once — report-content.js and notify-block.js each send
// one email at the moment of filing. If that email is missed, buried, or
// arrives at 3am, nothing ever mentions it again and the 24-hour promise
// is broken silently.
//
// WHY 12 HOURS AND NOT 24. A reminder that fires at the deadline is not a
// reminder, it is a post-mortem. Half the window leaves time to act.
//
// WHY IT RUNS EVERY FOUR HOURS. The reminder needs to land well inside
// the remaining twelve, and a report filed just after a run should not
// wait long for its first reminder. Four is frequent enough that the
// worst case is 16 hours open at first reminder, with eight to spare.
//
// IT DOES NOT ESCALATE OR AUTO-ACTION. Nothing here deletes content,
// bans anyone, or changes a report's status. A missed deadline is a
// person problem and the fix is telling the person again — an automated
// action taken because nobody looked is exactly the kind of moderation
// decision that should never be automatic.

const https = require('https');

const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];

// Half the 24-hour commitment in the Community Guidelines.
const REMINDER_AFTER_HOURS = 12;

// Don't re-send more than once per run cycle for the same report: the
// function runs every four hours, so this makes each open report generate
// at most one reminder per four hours no matter how long it stays open.
const MIN_HOURS_BETWEEN_REMINDERS = 4;

// A cap, so a backlog cannot turn one run into a hundred emails.
const MAX_REMINDERS_PER_RUN = 25;

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sendEmail({ subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[sla-reminder] RESEND_API_KEY not set — no reminder sent.');
    return Promise.resolve(false);
  }

  const payload = JSON.stringify({
    from: 'MySetlists Moderation <phillip@mysetlists.net>',
    to: ADMIN_EMAILS,
    subject,
    html,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', (err) => {
      console.error('[sla-reminder] Reminder failed:', err.message);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Firestore hands back a Timestamp from the Admin SDK and a plain
 * `{_seconds}` shape from anything that has crossed a JSON boundary, so
 * both are accepted. `nowMs` is a parameter rather than a Date.now() call
 * because the eligibility rule below is the only real logic in this file
 * and it has to be testable without waiting twelve hours.
 */
function hoursSince(timestamp, nowMs = Date.now()) {
  const ms = timestamp?.toMillis?.() ?? (timestamp?._seconds ? timestamp._seconds * 1000 : null);
  if (!ms) return 0;
  return (nowMs - ms) / 3_600_000;
}

/**
 * Should this open report generate a reminder on this run?
 *
 * Two conditions, and the second is what stops the every-four-hours
 * schedule turning one stubborn report into six emails a day: it must be
 * older than the SLA half-life, AND not have been reminded about
 * recently. A report with no `lastRemindedAt` has never been reminded,
 * which is why the absent case reads as Infinity rather than 0.
 */
function isDueForReminder(report, nowMs = Date.now()) {
  if (!report || report.status !== 'open') return false;
  if (hoursSince(report.createdAt, nowMs) < REMINDER_AFTER_HOURS) return false;
  const sinceLast = report.lastRemindedAt
    ? hoursSince(report.lastRemindedAt, nowMs)
    : Infinity;
  return sinceLast >= MIN_HOURS_BETWEEN_REMINDERS;
}

exports.handler = async function () {
  try {
    initFirebase();
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    const db = getFirestore();

    // Oldest first, same order the admin queue uses — if the cap below
    // trims anything, it trims the least urgent.
    const snap = await db.collection('reports')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'asc')
      .get();

    const now = Date.now();
    const due = snap.docs.filter((d) => isDueForReminder({ ...d.data(), status: 'open' }, now));

    if (due.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ open: snap.size, due: 0, sent: 0 }) };
    }

    const batchToSend = due.slice(0, MAX_REMINDERS_PER_RUN);

    // One email for the whole backlog rather than one per report. An
    // inbox with twenty identical-looking reminders in it is a worse
    // prompt to act than a single list, and the list is also the thing
    // that shows the shape of the backlog.
    const rows = batchToSend.map((d) => {
      const r = d.data();
      const age = Math.floor(hoursSince(r.createdAt));
      const overdue = age >= 24;
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${overdue ? '#b00' : '#444'}">
            <strong>${age}h</strong>${overdue ? ' — past SLA' : ''}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">
            ${escapeHtml(r.contentType === 'blockNotice' ? 'Block notice' : r.contentType || 'report')}
            &middot; ${escapeHtml(r.reason || '')}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">
            ${escapeHtml(String(r.contentSnapshot || '').slice(0, 120)) || '<em>(no text)</em>'}
          </td>
        </tr>`;
    }).join('');

    const oldest = Math.floor(hoursSince(batchToSend[0].data().createdAt));
    const anyOverdue = oldest >= 24;

    await sendEmail({
      subject: `[MySetlists] ${batchToSend.length} moderation report${batchToSend.length === 1 ? '' : 's'} still open — oldest ${oldest}h${anyOverdue ? ' (PAST SLA)' : ''}`,
      html: `
        <p>${batchToSend.length} report${batchToSend.length === 1 ? ' has' : 's have'} been open for more than ${REMINDER_AFTER_HOURS} hours.</p>
        ${anyOverdue ? '<p style="color:#b00"><strong>At least one is past the 24-hour commitment in the Community Guidelines.</strong></p>' : ''}
        <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
          <tr>
            <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Age</th>
            <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Type</th>
            <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Content</th>
          </tr>
          ${rows}
        </table>
        ${due.length > batchToSend.length ? `<p>…and ${due.length - batchToSend.length} more.</p>` : ''}
        <p>Clear them in the Moderation tab: <a href="https://mysetlists.net/admin">mysetlists.net/admin</a></p>
      `,
    });

    // Stamped whether or not the send succeeded. A Resend outage that
    // left this unset would make every subsequent run re-send the same
    // backlog at full rate once it recovered.
    const writes = db.batch();
    batchToSend.forEach((d) => {
      writes.update(d.ref, {
        lastRemindedAt: FieldValue.serverTimestamp(),
        reminderCount: FieldValue.increment(1),
      });
    });
    await writes.commit();

    return {
      statusCode: 200,
      body: JSON.stringify({ open: snap.size, due: due.length, sent: batchToSend.length }),
    };
  } catch (e) {
    console.error('[sla-reminder] Failed:', e.message, e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

// Exported for lib/__tests__/moderationSla.test.js. The handler above is
// the only other consumer.
module.exports.isDueForReminder = isDueForReminder;
module.exports.REMINDER_AFTER_HOURS = REMINDER_AFTER_HOURS;
module.exports.MIN_HOURS_BETWEEN_REMINDERS = MIN_HOURS_BETWEEN_REMINDERS;

/**
 * Terms of Use agreement — the first of App Store Guideline 1.2's five
 * requirements, and the one this app shipped none of.
 *
 * Apple's wording is "terms (EULA) that users must agree to before
 * registering or logging in", and the 2026-09-17 rejection of 3.1 (31)
 * turned on exactly that: the Terms existed at /terms and said all the
 * right things, but nobody ever agreed to them. A Terms page that is
 * merely reachable is not an agreement.
 *
 * ── WHERE THE AGREEMENT IS TAKEN ────────────────────────────────────────
 *
 * Two places, because there are two populations:
 *
 *   components/auth/TermsAgreement.jsx — inside AuthModal, above the
 *     provider buttons. Every sign-in control (Apple, Google, email) is
 *     disabled until the checkbox is ticked. This is the path a new user
 *     and a returning signed-out user both take.
 *
 *   components/auth/TermsGate.jsx — a full-screen gate for someone who is
 *     ALREADY signed in but whose stored acceptance is missing or behind
 *     TERMS_VERSION. Every existing account is in this bucket the first
 *     time it launches build 32, which is what makes the requirement
 *     retroactive rather than new-users-only.
 *
 * ── WHY ACCEPTANCE IS HELD LOCALLY FIRST ────────────────────────────────
 *
 * The agreement has to happen BEFORE registering, so at the moment the
 * box is ticked there is no uid and no document to write to. So the tick
 * is parked in localStorage under TERMS_PENDING and flushed to
 * `userProfiles/{uid}` by AppContext's auth listener once sign-in
 * completes. If the user abandons sign-in the pending value is harmless;
 * if they complete it on a different device later, the gate in
 * TermsGate.jsx catches them there.
 *
 * `userProfiles` rather than a new collection because the profile
 * document already exists for every user, is already owner-writable
 * (see firestore.rules — the only field a user may not touch is
 * `banned`), and is already read at launch.
 *
 * ── WHY THE VERSION IS AN INTEGER ───────────────────────────────────────
 *
 * `termsAcceptedVersion >= TERMS_VERSION` is the whole check. Bumping the
 * constant re-gates every user on their next launch, which is what the
 * brief asks for and what a material change to the Community Guidelines
 * should do. A date string would compare lexically and work, but invites
 * the question of what "before" means across timezones; an integer does
 * not.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { storage, STORAGE_KEYS } from '@/lib/storage';

/**
 * Bump this when the Community Guidelines in components/TermsOfService.jsx
 * change materially. Every user is asked to agree again on next launch.
 *
 *   1 — 2026-09-17. First version to be agreed to at all. Community
 *       Guidelines restated for Guideline 1.2: zero tolerance, flag and
 *       block, 24-hour review, offending accounts removed from the
 *       service.
 */
export const TERMS_VERSION = 1;

/**
 * True when this profile's stored acceptance covers the current version.
 *
 * Takes the profile DATA rather than a uid so the caller that has already
 * read the document (AppContext, at launch) does not pay for a second
 * read. A missing field reads as 0, which is what makes every pre-v32
 * account fail this check and see the gate.
 */
export function hasAcceptedTerms(profileData) {
  const accepted = Number(profileData?.termsAcceptedVersion || 0);
  return accepted >= TERMS_VERSION;
}

/** The locally parked tick, taken before an account exists. */
export function getPendingAcceptance() {
  return Number(storage.get(STORAGE_KEYS.TERMS_PENDING) || 0);
}

export function setPendingAcceptance(version = TERMS_VERSION) {
  storage.set(STORAGE_KEYS.TERMS_PENDING, String(version));
}

export function clearPendingAcceptance() {
  storage.remove(STORAGE_KEYS.TERMS_PENDING);
}

/**
 * Write the agreement to the user's profile.
 *
 * `merge: true` because this may be the very first write to a profile
 * that does not exist yet (a brand new Apple/Google sign-in), and must
 * not clobber one that does. The rules permit it: the owner may write any
 * field on their own profile except `banned`, which this never touches.
 */
export async function recordTermsAcceptance(uid, version = TERMS_VERSION) {
  if (!uid) return;
  await setDoc(
    doc(db, 'userProfiles', uid),
    {
      termsAcceptedVersion: version,
      termsAcceptedAt: serverTimestamp(),
    },
    { merge: true },
  );
  clearPendingAcceptance();
}

/**
 * Has this uid accepted the current version? Reads the profile.
 *
 * Used by the launch check in AppContext, which has a uid but not yet the
 * profile document. A read failure resolves to `false` — showing the gate
 * to someone who has already agreed is a moment's annoyance, where
 * skipping it on a read error is the rejection all over again.
 */
export async function fetchTermsAcceptance(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    return snap.exists() ? hasAcceptedTerms(snap.data()) : false;
  } catch (err) {
    console.error('[terms] Could not read acceptance:', err.code || err.message);
    return false;
  }
}

/**
 * The plain-language summary shown on both agreement surfaces.
 *
 * One exported constant so the gate, the modal and the Terms page cannot
 * drift — every claim here is restated in §4 of
 * components/TermsOfService.jsx, and the reply to App Review points at
 * both. Wording is deliberately concrete: "we remove it and we remove the
 * account" is what Apple asks an app to commit to, and "we review within
 * 24 hours" is the commitment they check against.
 */
export const TERMS_SUMMARY = [
  {
    title: 'Zero tolerance for objectionable content',
    body: 'No slurs, harassment, hate, sexual content, threats or impersonation. Post any of it and it is removed.',
  },
  {
    title: 'Zero tolerance for abusive users',
    body: 'Accounts that post objectionable content are removed from MySetlists.',
  },
  {
    title: 'You can flag anything',
    body: 'Every comment, photo, video, meetup message and profile carries a flag icon.',
  },
  {
    title: 'You can block anyone',
    body: 'Their content disappears from your app immediately, and you stop appearing to each other.',
  },
  {
    title: 'We review reports within 24 hours',
    body: 'We remove content that breaks these rules and remove the account that posted it.',
  },
];

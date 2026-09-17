// components/auth/TermsAgreement.jsx
//
// The agreement block that sits above every sign-in control in AuthModal.
// Guideline 1.2 wants the terms agreed to BEFORE registering or logging
// in, and Apple's reviewer has to be able to see that happen in a screen
// recording — so this is a visible, unchecked checkbox with the
// zero-tolerance summary above it, not a "by continuing you agree" line
// underneath the buttons.
//
// The disabling is done by the parent (AuthModal passes `agreed` down to
// LoginForm/SignupForm, which pass it to OAuthButtons and their own submit
// button). Doing it there rather than here is what covers Sign in with
// Apple and Google as well as email — all three read the same flag.

'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { TERMS_SUMMARY } from '@/lib/terms';

export default function TermsAgreement({ agreed, onChange, disabled = false }) {
  return (
    <div className="mb-5" data-testid="terms-agreement">
      <div className="flex items-center gap-2 mb-2.5">
        <ShieldCheck size={16} className="text-brand flex-shrink-0" />
        <h3 className="text-[15px] font-semibold text-primary">
          Our community rules
        </h3>
      </div>

      <ul className="list-none p-0 m-0 space-y-2 mb-4">
        {TERMS_SUMMARY.map((item) => (
          <li key={item.title} className="text-[13px] leading-snug">
            <span className="block font-semibold text-primary">{item.title}</span>
            <span className="block text-secondary">{item.body}</span>
          </li>
        ))}
      </ul>

      {/* Minimum 44pt touch target: the label is the hit area, and the
          py-3 keeps it there on a phone. A checkbox alone is ~16pt. */}
      <label
        className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors ${
          agreed ? 'border-brand bg-brand-subtle' : 'border-subtle hover:border-active'
        }`}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="accent-brand mt-0.5 w-[18px] h-[18px] flex-shrink-0"
          data-testid="terms-agree-checkbox"
        />
        <span className="text-[14px] text-primary leading-snug">
          I agree to the{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline"
            onClick={(e) => e.stopPropagation()}
          >
            Terms of Use
          </a>{' '}
          and these community rules.
        </span>
      </label>

      {!agreed && (
        <p className="text-xs text-muted mt-2" data-testid="terms-agree-hint">
          Agree to continue — sign-in is disabled until you do.
        </p>
      )}
    </div>
  );
}

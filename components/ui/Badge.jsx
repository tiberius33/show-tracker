// Small label for meta/status info. Use Tag for interactive chips.
//
// Tones: neutral / green / amber / navy / red / beta
// Sizes: sm / md

import React from 'react';

const TONES = {
  neutral: 'bg-hover text-secondary',
  green:   'bg-brand-subtle text-[#2a8a47]',
  amber:   'bg-amber-subtle text-[#a0680f]',
  navy:    'bg-[#eaecf2] text-sidebar',
  red:     'bg-[#fdecec] text-danger',
  beta:    'bg-amber-subtle text-[#a0680f] border border-amber/20',
};

const SIZES = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded',
  md: 'text-[11px] px-2 py-0.5 rounded-md',
};

export default function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  uppercase = true,
  dot = false,
  className = '',
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-bold whitespace-nowrap',
        uppercase && 'tracking-[0.08em] uppercase',
        TONES[tone] || TONES.neutral,
        SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

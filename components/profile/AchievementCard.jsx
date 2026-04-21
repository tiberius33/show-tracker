// components/profile/AchievementCard.jsx
//
// Single achievement tile. Use in a responsive grid of 2–4 columns on /profile.

import React from 'react';

const TONES = {
  amber:  'text-amber',
  green:  'text-brand',
  purple: 'text-[#a78bfa]',
  blue:   'text-[#60a5fa]',
  red:    'text-danger',
};

export default function AchievementCard({
  icon: Icon,
  emoji,
  name,
  description,
  tone = 'amber',
  locked = false,
}) {
  return (
    <div className={`p-5 rounded-2xl text-center bg-surface border border-subtle ${locked ? 'opacity-50' : ''}`}>
      <div className={`text-[32px] mb-2 ${TONES[tone] || ''}`}>
        {Icon ? <Icon size={36} strokeWidth={1.8} className="mx-auto" /> : emoji}
      </div>
      <div className="text-[13px] font-extrabold tracking-[-0.005em]">{name}</div>
      {description && <div className="text-[11px] text-muted mt-1">{description}</div>}
    </div>
  );
}

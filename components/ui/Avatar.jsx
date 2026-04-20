// Circle user avatar. Falls back to colored gradient + initials.
// Size in px: sm(28) md(40) lg(56) xl(80).

import React from 'react';

const SIZES = { sm: 28, md: 40, lg: 56, xl: 80 };

const GRADIENTS = [
  'from-amber-light to-amber',
  'from-brand-light to-brand',
  'from-[#667eea] to-[#5568d3]',
  'from-[#f093a5] to-danger',
  'from-[#a78bfa] to-[#7c3aed]',
  'from-[#60a5fa] to-[#2563eb]',
];

function hashPick(key, arr) {
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export default function Avatar({ src, name = '', size = 'md', className = '', ring = false }) {
  const px = SIZES[size] || size;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  const ringCls = ring ? 'ring-2 ring-surface ring-offset-0' : '';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        style={{ width: px, height: px }}
        className={`rounded-full object-cover ${ringCls} ${className}`}
      />
    );
  }

  const gradient = hashPick(name, GRADIENTS);

  return (
    <div
      style={{ width: px, height: px, fontSize: Math.max(11, px / 2.6) }}
      className={`rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br ${gradient} ${ringCls} ${className}`}
      aria-label={name || 'avatar'}
    >
      {initials || '?'}
    </div>
  );
}

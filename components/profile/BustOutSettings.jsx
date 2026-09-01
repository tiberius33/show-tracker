// components/profile/BustOutSettings.jsx
//
// Lets the user scale how eagerly songs get flagged as bust-outs. A
// bust-out is normally 50+ shows or 1+ year since a song was last played
// (major: 100+ shows / 2+ years; epic: 5+ years) — this sensitivity value
// multiplies all of those bands up or down together. Persists to
// userProfiles/{uid}.bustOutSensitivity via useBustOutSensitivity.

'use client';

import { Flame } from 'lucide-react';
import useBustOutSensitivity from '@/hooks/useBustOutSensitivity';
import { BUSTOUT_SENSITIVITY_OPTIONS } from '@/lib/bustOuts';

export default function BustOutSettings({ userId }) {
  const { sensitivity, updateSensitivity } = useBustOutSensitivity(userId);

  return (
    <div className="bg-hover border border-subtle rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
        <Flame className="w-5 h-5 text-amber" />
        Bust-Out Sensitivity
      </h3>
      <p className="text-secondary text-sm mb-4">
        A bust-out is a song that's been out of rotation for a while — 50+ shows or a year since it was last played (100+ shows / 2 years for a major bust-out, 5+ years for epic). This setting scales those numbers up or down.
      </p>
      <select
        value={sensitivity}
        onChange={(e) => updateSensitivity(Number(e.target.value))}
        className="text-sm bg-hover border border-active rounded-lg px-2.5 py-1.5 text-primary focus:ring-2 focus:ring-brand/50 focus:outline-none"
      >
        {BUSTOUT_SENSITIVITY_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

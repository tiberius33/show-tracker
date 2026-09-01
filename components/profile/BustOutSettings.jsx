// components/profile/BustOutSettings.jsx
//
// Lets the user customize the minimum gap (days since a song was last
// played) required before it's flagged as a bust-out on setlists. Persists
// to userProfiles/{uid}.bustOutThresholdDays via useBustOutThreshold.

'use client';

import { Flame } from 'lucide-react';
import useBustOutThreshold from '@/hooks/useBustOutThreshold';
import { BUSTOUT_THRESHOLD_OPTIONS } from '@/lib/bustOuts';

export default function BustOutSettings({ userId }) {
  const { thresholdDays, updateThreshold } = useBustOutThreshold(userId);

  return (
    <div className="bg-hover border border-subtle rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
        <Flame className="w-5 h-5 text-amber" />
        Bust-Out Threshold
      </h3>
      <p className="text-secondary text-sm mb-4">
        Songs are flagged as a bust-out once it's been this long since they were last played. Severity still scales up automatically — 180+ days is major, 365+ is epic.
      </p>
      <select
        value={thresholdDays}
        onChange={(e) => updateThreshold(Number(e.target.value))}
        className="text-sm bg-hover border border-active rounded-lg px-2.5 py-1.5 text-primary focus:ring-2 focus:ring-brand/50 focus:outline-none"
      >
        {BUSTOUT_THRESHOLD_OPTIONS.map(days => (
          <option key={days} value={days}>
            {days >= 365 ? `${Math.round(days / 365)} year${days >= 730 ? 's' : ''}` : `${days} days`}
          </option>
        ))}
      </select>
    </div>
  );
}

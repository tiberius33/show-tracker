// components/stats/StatsSubNav.jsx
//
// Pill nav between the Stats overview and its subpages. Same active/inactive
// pill styling as the "Detailed breakdown" tab bar in StatsView, just backed
// by real routes instead of local tab state.

import Link from 'next/link';

const TABS = [
  { id: 'overview', label: 'Overview', href: '/stats' },
  { id: 'top-artists', label: 'Top Artists', href: '/stats/top-artists' },
  { id: 'top-venues', label: 'Top Venues', href: '/stats/top-venues' },
];

export default function StatsSubNav({ active }) {
  return (
    <nav className="flex gap-2 mb-6 flex-wrap" aria-label="Stats sections">
      {TABS.map(({ id, label, href }) => (
        <Link
          key={id}
          href={href}
          className={[
            'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
            id === active
              ? 'bg-gradient-to-r from-brand to-amber text-on-dark shadow-lg shadow-brand/20'
              : 'border border-subtle text-secondary hover:border-active hover:text-primary',
          ].join(' ')}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

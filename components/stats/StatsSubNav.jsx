// components/stats/StatsSubNav.jsx
//
// Route-backed sub-nav between the Stats overview and its subpages. Uses the
// shared Tabs component (same underline + brand-bar pattern as Shows page).

import { Tabs } from '@/components/ui';

const TABS = [
  { id: 'overview', label: 'Overview', href: '/stats' },
  { id: 'top-artists', label: 'Top Artists', href: '/stats/top-artists' },
  { id: 'top-venues', label: 'Top Venues', href: '/stats/top-venues' },
];

export default function StatsSubNav({ active }) {
  return <Tabs tabs={TABS} value={active} className="mb-6" />;
}

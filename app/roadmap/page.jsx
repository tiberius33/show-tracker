'use client';

import RoadmapView from '@/components/RoadmapView';
import { useApp } from '@/context/AppContext';

export default function RoadmapPage() {
  const { user } = useApp();

  return <RoadmapView user={user} />;
}

'use client';

import AdminView from '@/components/AdminView';
import { useApp } from '@/context/AppContext';

export default function AdminPage() {
  const { isAdmin } = useApp();

  if (!isAdmin) return null;

  return <AdminView />;
}

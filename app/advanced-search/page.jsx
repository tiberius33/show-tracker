'use client';

import { Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import AdvancedSearchView from '@/components/search/AdvancedSearchView';
import { Button, PageHeader, EmptyState } from '@/components/ui';

export default function AdvancedSearchPage() {
  const { user, guestMode, openAuthModal } = useApp();

  if (guestMode || !user) {
    return (
      <>
        <PageHeader eyebrow="Search" title="Advanced search" />
        <EmptyState
          icon={Search}
          tone="brand"
          title="Sign in to search your shows"
          body="Advanced search filters your own logged shows, so create a free account to use it."
          action={<Button onClick={() => openAuthModal('signup')}>Create account</Button>}
        />
      </>
    );
  }

  return <AdvancedSearchView />;
}

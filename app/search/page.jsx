'use client';

import SearchView from '@/components/SearchView';
import { PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function SearchPage() {
  const { addShow, importedIds, setShowForm } = useApp();

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Search"
        subtitle="Find a show on setlist.fm and add it to your history."
      />
      <SearchView
        onImport={addShow}
        importedIds={importedIds}
        onAddManually={() => setShowForm(true)}
      />
    </>
  );
}

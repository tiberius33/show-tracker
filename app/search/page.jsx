'use client';

import SearchView from '@/components/SearchView';
import { useApp } from '@/context/AppContext';

export default function SearchPage() {
  const { addShow, importedIds, setShowForm } = useApp();

  return (
    <SearchView
      onImport={addShow}
      importedIds={importedIds}
      onAddManually={() => setShowForm(true)}
    />
  );
}

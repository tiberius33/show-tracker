'use client';

import ScanImportView from '@/components/ScanImportView';
import { useApp } from '@/context/AppContext';

export default function ScanImportPage() {
  const { addShow, updateShowData, shows, importedIds, navigateTo, user, guestMode, loadShows } = useApp();

  return (
    <ScanImportView
      onImport={addShow}
      onUpdateShow={updateShowData}
      existingShows={shows}
      importedIds={importedIds}
      onNavigate={(view) => {
        navigateTo(view);
        if (view === 'shows' && user && !guestMode) {
          loadShows(user.uid);
        }
      }}
    />
  );
}

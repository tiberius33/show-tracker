'use client';

import React, { useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import TicketScanner from '@/components/TicketScanner';
import ImportView from '@/components/ImportView';
import { Tabs } from '@/components/ui';

function ScanImportView({ onImport, onUpdateShow, existingShows, importedIds, onNavigate }) {
  const [activeTab, setActiveTab] = useState('scan');

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        className="mb-6"
        tabs={[
          { id: 'scan', label: 'Scan Tickets', icon: Camera },
          { id: 'import', label: 'Import File', icon: Upload },
        ]}
      />

      {activeTab === 'scan' && (
        <TicketScanner onImport={onImport} importedIds={importedIds} existingShows={existingShows} />
      )}
      {activeTab === 'import' && (
        <ImportView onImport={onImport} onUpdateShow={onUpdateShow} existingShows={existingShows} onNavigate={onNavigate} />
      )}
    </div>
  );
}

export default ScanImportView;

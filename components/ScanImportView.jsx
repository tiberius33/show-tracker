'use client';

import React, { useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import TicketScanner from '@/components/TicketScanner';
import ImportView from '@/components/ImportView';

function ScanImportView({ onImport, onUpdateShow, existingShows, importedIds, onNavigate }) {
  const [activeTab, setActiveTab] = useState('scan');

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Scan / Import Tickets</h1>
      <p className="text-white/60 mb-6">Add shows by scanning ticket stubs or importing a file</p>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'scan', label: 'Scan Tickets', icon: Camera },
          { id: 'import', label: 'Import File', icon: Upload },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

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

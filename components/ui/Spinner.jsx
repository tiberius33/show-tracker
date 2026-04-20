// Indeterminate loading spinner. Use for async states.

import React from 'react';
import { Loader2 } from 'lucide-react';

const SIZES = { sm: 16, md: 22, lg: 36, xl: 48 };

export default function Spinner({ size = 'md', label, className = '' }) {
  const px = SIZES[size] || size;
  return (
    <div className={`inline-flex items-center gap-2.5 text-muted ${className}`} role="status">
      <Loader2 size={px} className="animate-spin text-brand" strokeWidth={2.4} />
      {label && <span className="text-sm">{label}</span>}
      {!label && <span className="sr-only">Loading</span>}
    </div>
  );
}

export function SpinnerBlock({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <Spinner size="lg" label={label} />
    </div>
  );
}

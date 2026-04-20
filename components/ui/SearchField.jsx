// Pre-styled search input. Wraps Input with keyboard affordance.
//
//   <SearchField value={q} onChange={setQ} placeholder="Search your 87 shows…" />

import React from 'react';
import { Search } from 'lucide-react';
import Input from './Input';

export default function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  shortcut = null,
  className = '',
  ...rest
}) {
  return (
    <Input
      icon={Search}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      containerClassName={className}
      rightElement={
        shortcut ? (
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-semibold text-muted bg-base border border-subtle rounded-md">
            {shortcut}
          </kbd>
        ) : null
      }
      {...rest}
    />
  );
}

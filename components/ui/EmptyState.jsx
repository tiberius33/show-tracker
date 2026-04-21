// components/ui/EmptyState.jsx
//
// Friendly zero-state. Pass a lucide icon, a title, body copy, and a CTA.
//
// Usage:
//   <EmptyState
//     icon={Music}
//     title="No shows yet"
//     body="Add your first show to start building your history."
//     action={<Button icon={Plus}>Add a show</Button>}
//   />

import React from 'react';

export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'default',
  className = '',
}) {
  const iconTone = tone === 'brand' ? 'text-brand bg-brand-subtle' : 'text-muted bg-hover';

  return (
    <div className={`text-center py-14 px-6 ${className}`}>
      {Icon && (
        <div
          className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${iconTone}`}
        >
          <Icon size={28} strokeWidth={1.8} />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-bold text-primary mb-1.5 tracking-[-0.01em]">{title}</h3>
      )}
      {body && (
        <p className="text-sm text-secondary max-w-sm mx-auto leading-[1.55]">{body}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

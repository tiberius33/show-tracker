// Multi-line input. Same visual language as Input.

import React, { forwardRef } from 'react';

const Textarea = forwardRef(function Textarea(
  { label, error, hint, rows = 4, className = '', containerClassName = '', id, ...rest },
  ref,
) {
  const inputId = id || (label ? `ta-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        className={[
          'bg-surface border rounded-xl px-3.5 py-2.5 text-[15px] text-primary',
          'placeholder:text-muted outline-none transition-colors resize-y',
          error
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
            : 'border-subtle focus:border-brand focus:ring-2 focus:ring-brand/15',
          className,
        ].join(' ')}
        {...rest}
      />
      {(error || hint) && (
        <span className={`text-xs ${error ? 'text-danger' : 'text-muted'}`}>{error || hint}</span>
      )}
    </div>
  );
});

export default Textarea;

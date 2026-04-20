// Text input with optional left icon, right affix, error state, label.
//
// Usage:
//   <Input label="Email" type="email" value={v} onChange={e => setV(e.target.value)} />
//   <Input icon={Search} placeholder="Search shows…" />

import React, { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, icon: Icon, rightElement, className = '', containerClassName = '', id, ...rest },
  ref,
) {
  const inputId = id || (label ? `in-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-secondary">
          {label}
        </label>
      )}
      <div
        className={[
          'relative flex items-center bg-surface border rounded-xl transition-colors',
          error
            ? 'border-danger focus-within:border-danger'
            : 'border-subtle focus-within:border-brand',
          'focus-within:ring-2',
          error ? 'focus-within:ring-danger/20' : 'focus-within:ring-brand/15',
        ].join(' ')}
      >
        {Icon && <Icon size={18} strokeWidth={2} className="ml-3.5 text-muted flex-shrink-0" />}
        <input
          id={inputId}
          ref={ref}
          className={[
            'flex-1 bg-transparent text-[15px] text-primary placeholder:text-muted',
            'outline-none py-2.5',
            Icon ? 'pl-2.5 pr-3.5' : 'px-3.5',
            rightElement ? 'pr-2' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {rightElement && <div className="mr-2 flex-shrink-0">{rightElement}</div>}
      </div>
      {(error || hint) && (
        <span className={`text-xs ${error ? 'text-danger' : 'text-muted'}`}>{error || hint}</span>
      )}
    </div>
  );
});

export default Input;

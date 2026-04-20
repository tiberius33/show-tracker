// Base surface for grouped content.
//
// Variants: default / elevated / inset / dark
// Padding: none / sm / md / lg
// interactive — adds hover lift + pointer cursor

import React from 'react';

const VARIANTS = {
  default:  'bg-surface border border-subtle',
  elevated: 'bg-surface shadow-theme-md',
  inset:    'bg-base border border-subtle',
  dark:     'bg-sidebar text-on-dark',
};

const PAD = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

const INTERACTIVE =
  'cursor-pointer transition-all hover:border-active hover:-translate-y-0.5 hover:shadow-theme-md';

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  as: As = 'div',
  ...rest
}) {
  return (
    <As
      className={[
        'rounded-2xl',
        VARIANTS[variant],
        PAD[padding],
        interactive && INTERACTIVE,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </As>
  );
}

// components/profile/ProfileHero.jsx
//
// Top card on /profile. Big avatar + name/handle + 4 stat numerals + actions.

import React from 'react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

export default function ProfileHero({
  name,
  handle,
  location,
  memberSince,
  stats = [],       // [{ value, label }]
  actions,          // React node — usually two <Button>s
}) {
  return (
    <section className="bg-surface border border-subtle rounded-3xl p-6 md:p-10 grid grid-cols-[auto_1fr] md:grid-cols-[140px_1fr_auto] gap-6 md:gap-8 items-center mb-6">
      <div className="col-span-2 md:col-span-1">
        <Avatar name={name} size={140} className="mx-auto md:mx-0" />
      </div>
      <div className="col-span-2 md:col-span-1">
        <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-[-0.025em] m-0">{name}</h1>
        <p className="text-[15px] text-secondary mt-1 mb-4">
          {handle && <>@{handle.replace(/^@/, '')}</>}
          {location && <> · {location}</>}
          {memberSince && <> · Member since {memberSince}</>}
        </p>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[22px] font-extrabold tracking-[-0.02em]">{s.value}</div>
              <div className="text-[11px] text-muted font-semibold tracking-[0.08em] uppercase">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {actions && (
        <div className="col-span-2 md:col-span-1 flex md:flex-col gap-2 md:self-start">
          {actions}
        </div>
      )}
    </section>
  );
}

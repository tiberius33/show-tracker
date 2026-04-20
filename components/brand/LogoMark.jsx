// Pick + Wordmark as a linked logo. Default link = "/".

import React from 'react';
import Link from 'next/link';
import Pick from './Pick';
import Wordmark from './Wordmark';

export default function LogoMark({
  href = '/',
  size = 32,
  wordmarkSize = 18,
  inverse = false,
  showTld = false,
  className = '',
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 outline-none focus-visible:opacity-80 ${className}`}
      aria-label="MySetlists home"
    >
      <Pick size={size} />
      <Wordmark size={wordmarkSize} inverse={inverse} showTld={showTld} />
    </Link>
  );
}

'use client';

// ==============================================================================
// DDC THEME WRAPPER — Client Component
// ==============================================================================
// Reads usePathname() and sets data-ddc-accent="green" (pousada) or "blue"
// (airbnb) on the wrapping div. The font variable comes from the Server
// Component layout.tsx (next/font/google only works in Server Components).
// ==============================================================================

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

interface DDCThemeWrapperProps {
  fontClassName: string;
  children: ReactNode;
}

export function DDCThemeWrapper({ fontClassName, children }: DDCThemeWrapperProps) {
  const pathname = usePathname() || '';
  const accent = pathname.startsWith('/ddc/airbnb') ? 'blue' : 'green';

  return (
    <div
      data-ddc-theme="terminal"
      data-ddc-accent={accent}
      className={fontClassName}
      style={{ minHeight: '100vh' }}
    >
      {children}
    </div>
  );
}

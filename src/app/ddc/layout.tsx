'use client';

// ==============================================================================
// DDC LAYOUT — applies Hallmark Option 08 (Terminal) theme to ALL /ddc/* routes
// ==============================================================================
// - Loads JetBrains Mono via next/font/google (terminal-grade typography)
// - Imports ddc-terminal.css (CRT scanlines, sharp edges, phosphor glow)
// - Wraps children in <div data-ddc-theme="terminal" data-ddc-accent="...">
//   where accent is "green" for /ddc/pousada and "blue" for /ddc/airbnb,
//   determined by usePathname() at runtime.
// ==============================================================================

import { usePathname } from 'next/navigation';
import { JetBrains_Mono } from 'next/font/google';
import './ddc-terminal.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ddc-font-mono',
  weight: ['400', '500', '600', '700', '800'],
});

export default function DDCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const accent = pathname.startsWith('/ddc/airbnb') ? 'blue' : 'green';

  return (
    <div
      data-ddc-theme="terminal"
      data-ddc-accent={accent}
      className={jetbrainsMono.variable}
      style={{ minHeight: '100vh' }}
    >
      {children}
    </div>
  );
}

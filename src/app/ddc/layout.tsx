// ==============================================================================
// DDC LAYOUT — Hallmark Option 08 (Terminal) — Server Component
// ==============================================================================
// - Server Component (NO 'use client' — required for next/font/google to work)
// - Loads JetBrains Mono via next/font/google (terminal-grade typography)
// - Imports ddc-terminal.css (CRT scanlines, sharp edges, phosphor glow)
// - Wraps children in <DDCThemeWrapper> (client) which reads usePathname()
//   and sets data-ddc-accent="green" (pousada) or "blue" (airbnb)
// ==============================================================================

import { JetBrains_Mono } from 'next/font/google';
import './ddc-terminal.css';
import { DDCThemeWrapper } from './DDCThemeWrapper';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ddc-font-mono',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'DDC — Zélla Terminal',
  description: 'Dashboard do Cliente — Hallmark Terminal Theme',
};

export default function DDCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DDCThemeWrapper fontClassName={jetbrainsMono.variable}>
      {children}
    </DDCThemeWrapper>
  );
}

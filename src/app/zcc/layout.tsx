// =============================================================================
// ZCC LAYOUT — Monolith shell wrapper
// =============================================================================
// Wraps all /zcc routes with:
//   1. JetBrains Mono font (loaded via next/font — zero layout shift)
//   2. data-theme="dark" on .zcc-shell (phosphor terminal default)
//   3. zcc-monolith.css imports (5 themes + sharp edges + mono font)
//
// This file ONLY affects /zcc routes. Landing page, DDCs, login, etc. continue
// using the root layout's Inter font and original globals.css.
//
// Theme switching: ZCCShell mounts a ThemeToggle that updates data-theme attr
// on this wrapper via localStorage + DOM mutation.
// =============================================================================

import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './zcc-monolith.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ZCC — Zélla Central Control',
  description: 'Mission Control — Operator Console for Zélla AI agents',
  robots: { index: false, follow: false },
};

export default function ZCCLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`zcc-shell ${jetbrains.variable}`}
      data-theme="dark"
      data-zcc-shell="1"
      style={{ minHeight: '100vh' }}
    >
      {children}
    </div>
  );
}

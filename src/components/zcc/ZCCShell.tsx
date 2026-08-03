'use client';

// ==============================================================================
// ZCC SHELL — New application shell for Zélla Central Control
// ==============================================================================
// Wraps all 12 ZCC tabs in a modern dashboard shell with:
//   - Persistent collapsible sidebar (ZCCSidebar)
//   - Sticky topbar with breadcrumb + search + status pills (ZCCTopbar)
//   - Command palette ⌘K (ZCCCommandPalette)
//   - Mobile drawer navigation
//
// IMPORTANT: This is NON-BREAKING. All 25 existing ZCC panels continue to be
// imported and rendered exactly as before — only the shell around them changes.
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { ZCCSidebar, ZCCMobileNav, type ZCCTabId } from './ZCCSidebar';
import { ZCCTopbar } from './ZCCTopbar';
import { ZCCCommandPalette } from './ZCCCommandPalette';
import { MonolithThemeToggle } from './MonolithThemeToggle';

interface ZCCShellProps {
  activeTab: ZCCTabId;
  onTabChange: (tab: ZCCTabId) => void;
  totalMRR: number;
  totalClients: number;
  containersOnline?: number;
  containersTotal?: number;
  children: React.ReactNode;
}

export function ZCCShell({
  activeTab,
  onTabChange,
  totalMRR,
  totalClients,
  containersOnline = 6,
  containersTotal = 6,
  children,
}: ZCCShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zcc:sidebar-collapsed');
      if (stored !== null) setSidebarCollapsed(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('zcc:sidebar-collapsed', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K → open command palette
  // ⌘\ / Ctrl+\ → toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }
      // ⌘\ or Ctrl+\
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // ESC closes mobile nav and command palette
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  return (
    <div
      className="min-h-screen flex flex-col zcc-mission-grid"
      style={{ background: 'var(--zcc-mission-bg)' }}
    >
      {/* Top bar */}
      <ZCCTopbar
        activeTab={activeTab}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        totalMRR={totalMRR}
        totalClients={totalClients}
        containersOnline={containersOnline}
        containersTotal={containersTotal}
      />

      {/* Body: sidebar + content */}
      <div className="flex-1 flex">
        <ZCCSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Mobile drawer */}
        <ZCCMobileNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer */}
      <footer
        className="mt-auto border-t py-3 px-4"
        style={{
          borderColor: 'var(--zcc-hairline)',
          background: 'rgba(10,15,28,0.9)',
        }}
      >
        <div className="max-w-[1920px] mx-auto flex items-center justify-between text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
          <span>
            ZÉLLA Central Control v3.1 · Mission Control · {new Date().getFullYear()}
          </span>
          <span className="hidden sm:inline">
            MODO DEUS · Acesso restrito · ⌘K para comandos
          </span>
        </div>
      </footer>

      {/* Command palette */}
      <ZCCCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={onTabChange}
        onToggleSidebar={toggleSidebar}
      />

      {/* Monolith theme toggle (floating, bottom-right) */}
      <MonolithThemeToggle />
    </div>
  );
}

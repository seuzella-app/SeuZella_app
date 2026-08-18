'use client';

// ==============================================================================
// MOBILE BOTTOM NAV — 1-thumb control for DDC on mobile
// ==============================================================================
// Upgraded: now accepts navItems prop to ensure tab IDs match the active DDC.
// Previously had hardcoded IDs ('visao-geral', 'entregas-zella', etc.) that
// didn't match either Pousada or Airbnb tab IDs — clicking them did nothing.
// ==============================================================================

import { motion } from 'framer-motion';
import { Home, Power, MoreHorizontal } from 'lucide-react';
import type { NicheType } from '@/contexts/NicheContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { DDCSidebar, type NavItem, NICHE_THEME } from './DDCShell';

interface MobileBottomNavProps {
  niche: NicheType;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  aiActive: boolean;
  onToggleAI: () => void;
  navItems: NavItem[];
}

export function MobileBottomNav({
  niche,
  activeTab,
  onTabChange,
  aiActive,
  onToggleAI,
  navItems,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const theme = NICHE_THEME[niche];

  // Show first 3 nav items + a "More" button that opens a sheet with all items
  const primaryItems = navItems.slice(0, 3);

  const activeClass = niche === 'pousada'
    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
    : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border-blue-500/40 shadow-lg shadow-blue-500/20';

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060913]/95 backdrop-blur-2xl border-t border-white/[0.12] px-2 py-1.5 shadow-2xl shadow-black/90">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {primaryItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? activeClass
                    : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/[0.04]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={isActive ? theme.sidebarActiveText : 'text-zinc-400'}>
                  {item.icon}
                </span>
                <span className="text-[9px] font-semibold tracking-wide mt-0.5 line-clamp-1">
                  {item.label.length > 12 ? item.label.slice(0, 10) + '...' : item.label}
                </span>
              </motion.button>
            );
          })}

          {/* More button — opens sheet with all nav items */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border transition-all duration-200 ${
              !primaryItems.some(i => i.id === activeTab)
                ? activeClass
                : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/[0.04]'
            }`}
            aria-label="Mais opções"
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold tracking-wide">Mais</span>
          </motion.button>

          {/* 1-Tap AI Kill Switch */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={onToggleAI}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border transition-all duration-200 shadow-md ${
              aiActive
                ? 'bg-gradient-to-r from-emerald-500/25 to-emerald-600/25 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-rose-500/25 to-rose-600/25 border-rose-500/50 text-rose-300 shadow-rose-500/20'
            }`}
            title={aiActive ? 'IA Ativa (Toque para pausar)' : 'IA Pausada (Toque para ativar)'}
          >
            <div className="relative">
              <Power className="w-5 h-5 mb-0.5" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  aiActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                }`}
              />
            </div>
            <span className="text-[9px] font-extrabold tracking-wider uppercase">
              {aiActive ? 'IA ON' : 'IA OFF'}
            </span>
          </motion.button>
        </div>
      </div>

      {/* "More" sheet — full nav list */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-[60vh] p-0 bg-[#0d0d14] border-white/[0.06]">
          <SheetHeader className="sr-only">
            <SheetTitle>Todas as opções</SheetTitle>
          </SheetHeader>
          <DDCSidebar
            niche={niche}
            navItems={navItems}
            activeTab={activeTab}
            onTabChange={(id) => {
              onTabChange(id);
              setMoreOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// Suppress unused import warning — Home is kept for future use
void Home;

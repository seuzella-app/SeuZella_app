'use client';

import { motion } from 'framer-motion';
import { Home, MessageSquare, Calendar, Settings, Power } from 'lucide-react';
import type { NicheType } from '@/contexts/NicheContext';

interface MobileBottomNavProps {
  niche: NicheType;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  aiActive: boolean;
  onToggleAI: () => void;
}

export function MobileBottomNav({
  niche,
  activeTab,
  onTabChange,
  aiActive,
  onToggleAI,
}: MobileBottomNavProps) {
  const accentColor = niche === 'pousada' ? 'emerald' : 'blue';
  const activeClass =
    accentColor === 'emerald'
      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20'
      : 'text-blue-400 bg-blue-500/15 border-blue-500/20';

  const navItems = [
    { id: 'visao-geral', label: 'Início', icon: Home },
    { id: 'entregas-zella', label: 'Conversas', icon: MessageSquare },
    { id: 'sync-ical', label: 'Calendário', icon: Calendar },
    { id: 'guia-hospedes', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0f19]/95 backdrop-blur-xl border-t border-white/[0.08] px-3 py-2">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive ? activeClass : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </button>
          );
        })}

        {/* 1-Tap Kill Switch Button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onToggleAI}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl border transition-all duration-200 ${
            aiActive
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
          }`}
          title={aiActive ? 'IA Ativa (Toque para pausar)' : 'IA Pausada (Toque para ativar)'}
        >
          <Power className="w-5 h-5 mb-0.5 animate-pulse" />
          <span className="text-[9px] font-bold tracking-wider uppercase">
            {aiActive ? 'IA ON' : 'IA OFF'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}

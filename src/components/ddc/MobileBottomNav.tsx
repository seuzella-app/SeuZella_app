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
  const isPousada = niche === 'pousada';
  const activeClass = isPousada
    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
    : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-lg shadow-cyan-500/20';

  const navItems = [
    { id: 'visao-geral', label: 'Início', icon: Home },
    { id: 'entregas-zella', label: 'Conversas', icon: MessageSquare },
    { id: 'sync-ical', label: 'Calendário', icon: Calendar },
    { id: 'guia-hospedes', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060913]/90 backdrop-blur-2xl border-t border-white/[0.12] px-3 py-2 shadow-2xl shadow-black/90">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border transition-all duration-200 ${
                isActive
                  ? activeClass
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? (isPousada ? 'text-emerald-400' : 'text-cyan-400') : ''}`} />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </motion.button>
          );
        })}

        {/* 1-Tap Kill Switch Button (Stitch MCP Celestial Commander Style) */}
        <motion.button
          whileTap={{ scale: 0.90 }}
          onClick={onToggleAI}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border transition-all duration-200 shadow-md ${
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
  );
}

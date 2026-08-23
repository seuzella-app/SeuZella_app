'use client';

// ==============================================================================
// DDC COMMAND PALETTE — ⌘K quick navigation for Dashboard do Cliente
// ==============================================================================
// Provides cmdk-powered fuzzy search across all DDC tabs + quick actions.
// Mirrors the ZCC command palette UX but adapted for pousada/airbnb context.
// ==============================================================================

import { useEffect } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import {
  LayoutDashboard,
  Users,
  Brain,
  MessageSquare,
  Calendar,
  TrendingUp,
  Settings,
  Home,
  Gift,
  BarChart3,
  Building2,
  Smartphone,
  Link as LinkIcon,
  QrCode,
  Globe,
  Zap,
  Power,
  LogOut,
  Search,
} from 'lucide-react';
import type { NicheType } from '@/contexts/NicheContext';

export interface DDCCommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  group: 'navigate' | 'actions' | 'account';
  onSelect: () => void;
}

interface DDCCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  niche: NicheType;
  propertyName: string;
  navItems: { id: string; label: string; icon?: React.ReactNode }[];
  onNavigate: (tabId: string) => void;
  onToggleAI?: () => void;
  onLogout?: () => void;
}

export function DDCCommandPalette({
  isOpen,
  onClose,
  niche,
  propertyName,
  navItems,
  onNavigate,
  onToggleAI,
  onLogout,
}: DDCCommandPaletteProps) {
  // ESC closes (cmdk handles this internally too, but we make it explicit)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build navigate items from navItems, extracting lucide icon by display name
  const navigateItems: DDCCommandItem[] = navItems.map((item) => {
    // Try to match common icons by id — fallback to LayoutDashboard
    const iconMap: Record<string, React.ElementType> = {
      financeiro: niche === 'pousada' ? LayoutDashboard : TrendingUp,
      hospedes: Users,
      cerebro: Brain,
      simulador: MessageSquare,
      whatsapp: Smartphone,
      linkinbio: LinkIcon,
      guia: QrCode,
      integracoes: Globe,
      config: Settings,
      propriedades: Building2,
      sincronizacao: Calendar,
      automacao: Zap,
      indications: Gift,
      bi: BarChart3,
      properties: Home,
    };
    const Icon = iconMap[item.id] || LayoutDashboard;
    return {
      id: item.id,
      label: item.label,
      hint: propertyName,
      icon: Icon,
      group: 'navigate',
      onSelect: () => {
        onNavigate(item.id);
        onClose();
      },
    };
  });

  const actionItems: DDCCommandItem[] = [
    {
      id: 'toggle-ai',
      label: 'Alternar IA Zélla',
      hint: 'Pausar / retomar atendimento',
      icon: Power,
      group: 'actions',
      onSelect: () => {
        onToggleAI?.();
        onClose();
      },
    },
    {
      id: 'refresh',
      label: 'Atualizar dashboard',
      hint: 'Recarregar dados',
      icon: Zap,
      group: 'actions',
      onSelect: () => {
        window.location.reload();
        onClose();
      },
    },
  ];

  const accountItems: DDCCommandItem[] = [
    {
      id: 'logout',
      label: 'Sair da conta',
      hint: 'Encerrar sessão',
      icon: LogOut,
      group: 'account',
      onSelect: () => {
        onLogout?.();
        onClose();
      },
    },
  ];

  const grouped: { group: DDCCommandItem['group']; label: string; items: DDCCommandItem[] }[] = [
    { group: 'navigate', label: 'Navegação', items: navigateItems },
    { group: 'actions', label: 'Ações rápidas', items: actionItems },
    { group: 'account', label: 'Conta', items: accountItems },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command palette container */}
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0d0d14]">
        {/* Header / search input */}
        <CommandPrimitive loop className="flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <Search className="w-4 h-4 text-white/40" />
            <CommandPrimitive.Input
              autoFocus
              placeholder={`Buscar em ${propertyName}...`}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/40"
            />
            <kbd className="text-[9px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06]">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2">
            <CommandPrimitive.Empty>
              <div className="py-12 text-center">
                <Search className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">Nenhum resultado encontrado</p>
              </div>
            </CommandPrimitive.Empty>

            {grouped.map(({ group, label, items }) => (
              <CommandPrimitive.Group
                key={group}
                heading={label}
                className="mb-2"
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandPrimitive.Item
                      key={item.id}
                      value={`${item.label} ${item.hint || ''}`}
                      onSelect={() => item.onSelect()}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer aria-selected:bg-white/[0.06] aria-selected:text-white text-white/70 transition-colors group"
                    >
                      <Icon className="w-4 h-4 text-white/40 group-aria-selected:text-emerald-400 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white/90">{item.label}</div>
                        {item.hint && (
                          <div className="text-[10px] text-white/40 truncate">{item.hint}</div>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-white/20 opacity-0 group-aria-selected:opacity-100 transition-opacity">
                        ↵
                      </span>
                    </CommandPrimitive.Item>
                  );
                })}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-white/30">
            <span>{niche === 'pousada' ? 'POUSADA' : 'AIRBNB'} · DDC</span>
            <span>↑↓ navegar · ↵ selecionar · ESC fechar</span>
          </div>
        </CommandPrimitive>
      </div>
    </div>
  );
}

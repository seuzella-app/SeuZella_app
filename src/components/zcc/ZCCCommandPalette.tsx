'use client';

// ==============================================================================
// ZCC COMMAND PALETTE — ⌘K universal search + quick actions
// ==============================================================================
// Opens with ⌘K (Mac) or Ctrl+K (Windows/Linux). Provides:
//   - Search across all 12 ZCC tabs (fuzzy match)
//   - Quick actions (refresh metrics, toggle sidebar, jump to site)
//   - Recent items (last 3 visited tabs — stored in localStorage)
//   - Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
// ==============================================================================

import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, Clock, Zap, Command as CmdIcon,
  Building2, Activity, Brain, Code, FlaskConical, DollarSign,
  Home, Flame, Users, Key, Globe, BarChart3, RefreshCw, PanelLeftClose, Bot,
} from 'lucide-react';
import type { ZCCTabId } from './ZCCSidebar';

interface ZCCCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: ZCCTabId) => void;
  onToggleSidebar?: () => void;
  onRefresh?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  group: 'Navegação' | 'Ações' | 'Recentes';
  action: () => void;
  keywords?: string;
}

const TAB_ICONS: Record<ZCCTabId, React.ElementType> = {
  overview: CmdIcon,
  agents: Bot,
  pulse: Activity,
  cerebro: Brain,
  refactors: Code,
  sandbox: FlaskConical,
  financeiro: DollarSign,
  airbnb: Home,
  pousadas: Home,
  burnrate: Flame,
  tenants: Users,
  tokens: Key,
  geo: Globe,
  financial: BarChart3,
  'cerebro-tests': Brain,
};

const TAB_LABELS: Record<ZCCTabId, string> = {
  overview: 'Visão Geral',
  agents: 'Agentes Vivos',
  pulse: 'Pulse Check',
  cerebro: 'Cérebro',
  refactors: 'Refactors',
  sandbox: 'Sandbox',
  financeiro: 'Financeiro',
  airbnb: 'Airbnb',
  pousadas: 'Pousadas',
  burnrate: 'Burn Rate',
  tenants: 'Tenants',
  tokens: 'Tokens & IA',
  geo: 'Geo',
  financial: 'Breakdown',
  'cerebro-tests': 'Testes Cérebro',
};

const TAB_DESCS: Record<ZCCTabId, string> = {
  overview: 'Command Center',
  agents: '12 agentes com LLM real',
  pulse: 'Telemetria & Infra',
  cerebro: 'IA em tempo real',
  refactors: 'Auto-aprendizado',
  sandbox: 'Z-Lab Simulação',
  financeiro: 'Receitas & Pagamentos',
  airbnb: 'Anfitriões & Imóveis',
  pousadas: 'Gestão de Pousadas',
  burnrate: 'Custos API WhatsApp',
  tenants: 'Raio-X & Kill Switch',
  tokens: 'LLMs & API Keys',
  geo: 'Métricas Geográficas',
  financial: 'Detalhamento Financeiro',
  'cerebro-tests': 'Suíte de Testes ML',
};

const ALL_TAB_IDS: ZCCTabId[] = [
  'overview', 'agents', 'pulse', 'cerebro', 'refactors', 'sandbox', 'financeiro',
  'airbnb', 'pousadas', 'burnrate', 'tenants', 'tokens', 'geo', 'financial', 'cerebro-tests'
];

export function ZCCCommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onToggleSidebar,
  onRefresh,
}: ZCCCommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<ZCCTabId[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zcc:recent');
      if (stored) setRecent(JSON.parse(stored).slice(0, 3));
    } catch {
      /* ignore */
    }
  }, []);

  // Save to recent when navigating
  const navigateTo = useCallback((tab: ZCCTabId) => {
    setRecent(prev => {
      const next = [tab, ...prev.filter(t => t !== tab)].slice(0, 3);
      try {
        localStorage.setItem('zcc:recent', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    onNavigate(tab);
    onClose();
    setSearch('');
  }, [onNavigate, onClose]);

  // Build command items
  const items: CommandItem[] = [
    // Recent items (bubbled to top)
    ...recent.map(tab => ({
      id: `recent-${tab}`,
      label: TAB_LABELS[tab],
      desc: `${TAB_DESCS[tab]} · acessado recentemente`,
      icon: Clock,
      group: 'Recentes' as const,
      action: () => navigateTo(tab),
      keywords: `${TAB_LABELS[tab]} ${TAB_DESCS[tab]} recent`,
    })),

    // Navigation items
    ...ALL_TAB_IDS.map(tab => ({
      id: `nav-${tab}`,
      label: TAB_LABELS[tab],
      desc: TAB_DESCS[tab],
      icon: TAB_ICONS[tab],
      group: 'Navegação' as const,
      action: () => navigateTo(tab),
      keywords: `${TAB_LABELS[tab]} ${TAB_DESCS[tab]} ${tab}`,
    })),

    // Quick actions
    ...(onRefresh ? [{
      id: 'action-refresh',
      label: 'Atualizar métricas',
      desc: 'Forçar refresh dos dados do ZCC',
      icon: RefreshCw,
      group: 'Ações' as const,
      action: () => {
        onRefresh();
        onClose();
      },
      keywords: 'refresh reload update metrics',
    }] : []),
    ...(onToggleSidebar ? [{
      id: 'action-toggle-sidebar',
      label: 'Toggle sidebar',
      desc: 'Expandir/colapsar sidebar lateral',
      icon: PanelLeftClose,
      group: 'Ações' as const,
      action: () => {
        onToggleSidebar();
        onClose();
      },
      keywords: 'sidebar toggle collapse expand menu',
    }] : []),
    {
      id: 'action-site',
      label: 'Ir para Landing Page',
      desc: 'Abrir seuzella.com.br',
      icon: Building2,
      group: 'Ações' as const,
      action: () => {
        window.location.href = '/';
      },
      keywords: 'site home landing seuzella',
    },
  ];

  // Group items
  const groups = ['Recentes', 'Navegação', 'Ações'] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-xl pointer-events-auto zcc-panel"
              style={{
                padding: 0,
                background: 'var(--zcc-lacquer-raised)',
                borderColor: 'var(--zcc-hairline-strong)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--zcc-hairline)',
              }}
            >
              <Command
                label="ZCC Command Palette"
                className="flex flex-col"
                shouldFilter
              >
                {/* Search input */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 border-b"
                  style={{ borderColor: 'var(--zcc-hairline)' }}
                >
                  <Search className="w-4 h-4" style={{ color: 'var(--zcc-text-muted)' }} />
                  <Command.Input
                    autoFocus
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Buscar módulos, ações, comandos..."
                    className="flex-1 bg-transparent outline-none text-sm font-mono"
                    style={{ color: 'var(--zcc-champagne)' }}
                  />
                  <kbd
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'var(--zcc-lacquer-sunken)',
                      borderColor: 'var(--zcc-hairline)',
                      color: 'var(--zcc-text-muted)',
                    }}
                  >
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <Command.List
                  className="max-h-[400px] overflow-y-auto zcc-scroll py-1"
                >
                  <Command.Empty
                    className="px-3 py-8 text-center text-[11px] font-mono"
                    style={{ color: 'var(--zcc-text-muted)' }}
                  >
                    Nenhum resultado para &quot;{search}&quot;
                  </Command.Empty>

                  {groups.map(group => {
                    const groupItems = items.filter(i => i.group === group);
                    if (groupItems.length === 0) return null;
                    return (
                      <Command.Group
                        key={group}
                        heading={group}
                        className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase"
                      >
                        {groupItems.map(item => {
                          const Icon = item.icon;
                          return (
                            <Command.Item
                              key={item.id}
                              value={`${item.label} ${item.desc} ${item.keywords ?? ''}`}
                              onSelect={() => item.action()}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer aria-selected:bg-white/[0.04] transition-colors"
                            >
                              <Icon
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: 'var(--zcc-kinpaku)' }}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-[11px] font-mono font-medium truncate"
                                  style={{ color: 'var(--zcc-champagne)' }}
                                >
                                  {item.label}
                                </div>
                                <div
                                  className="text-[9px] font-mono truncate"
                                  style={{ color: 'var(--zcc-text-muted)' }}
                                >
                                  {item.desc}
                                </div>
                              </div>
                              <ArrowRight
                                className="w-3 h-3 opacity-0 aria-selected:opacity-100 shrink-0"
                                style={{ color: 'var(--zcc-text-muted)' }}
                              />
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    );
                  })}
                </Command.List>

                {/* Footer */}
                <div
                  className="px-3 py-2 border-t flex items-center justify-between text-[9px] font-mono"
                  style={{
                    borderColor: 'var(--zcc-hairline)',
                    color: 'var(--zcc-text-muted)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3" style={{ color: 'var(--zcc-kinpaku)' }} />
                    <span>ZCC Command Palette</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>↑↓ navegar</span>
                    <span>↵ selecionar</span>
                  </div>
                </div>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

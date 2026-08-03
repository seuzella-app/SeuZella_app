'use client';

// ==============================================================================
// ZCC SIDEBAR — Persistent collapsible navigation
// ==============================================================================
// Replaces the horizontal tab bar with a vertical sidebar that:
//   - Groups 12 tabs into 3 sections (Core / Ops / Config)
//   - Can be collapsed to icon-only (60px) for small screens
//   - Highlights the active tab
//   - Shows a "favoritos" star on hover (top 3 starred bubble to top)
//   - Persists collapsed state in localStorage
// ==============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Command, Activity, Brain, Code, FlaskConical, DollarSign,
  Home, Flame, Users, Key, Globe, BarChart3, ChevronLeft,
  Star, ChevronRight, Bot, Building2, TestTube,
} from 'lucide-react';

export type ZCCTabId =
  | 'overview' | 'pulse' | 'cerebro' | 'cerebro-tests' | 'refactors' | 'sandbox'
  | 'financeiro' | 'airbnb' | 'pousadas' | 'burnrate' | 'tenants'
  | 'tokens' | 'geo' | 'financial' | 'agents';

interface TabDef {
  id: ZCCTabId;
  label: string;
  icon: React.ElementType;
  desc: string;
  group: 'core' | 'ops' | 'config';
}

const ALL_TABS: TabDef[] = [
  { id: 'overview', label: 'Visão Geral', icon: Command, desc: 'Command Center', group: 'core' },
  { id: 'agents', label: 'Agentes Vivos', icon: Bot, desc: '12 agentes com LLM real', group: 'core' },
  { id: 'pulse', label: 'Pulse Check', icon: Activity, desc: 'Telemetria & Infra', group: 'core' },
  { id: 'cerebro', label: 'Cérebro', icon: Brain, desc: 'IA em tempo real', group: 'core' },
  { id: 'cerebro-tests', label: 'Testes Cérebro', icon: TestTube, desc: 'Score 0-100% · 6 subsistemas', group: 'core' },
  { id: 'refactors', label: 'Refactors', icon: Code, desc: 'Auto-aprendizado', group: 'core' },
  { id: 'sandbox', label: 'Sandbox', icon: FlaskConical, desc: 'Z-Lab Simulação', group: 'core' },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign, desc: 'Receitas & Pagamentos', group: 'core' },
  { id: 'financial', label: 'Breakdown', icon: BarChart3, desc: 'Detalhamento Financeiro', group: 'core' },
  { id: 'airbnb', label: 'Airbnb', icon: Home, desc: 'Anfitriões & Imóveis', group: 'ops' },
  { id: 'pousadas', label: 'Pousadas', icon: Building2, desc: 'Hotelaria & Recepção', group: 'ops' },
  { id: 'burnrate', label: 'Burn Rate', icon: Flame, desc: 'Custos API WhatsApp', group: 'ops' },
  { id: 'tenants', label: 'Tenants', icon: Users, desc: 'Raio-X & Kill Switch', group: 'ops' },
  { id: 'geo', label: 'Geo', icon: Globe, desc: 'Métricas Geográficas', group: 'ops' },
  { id: 'tokens', label: 'Tokens & IA', icon: Key, desc: 'LLMs & API Keys', group: 'config' },
];

const GROUP_LABELS: Record<TabDef['group'], string> = {
  core: 'Núcleo',
  ops: 'Operação',
  config: 'Configuração',
};

const GROUP_ORDER: TabDef['group'][] = ['core', 'ops', 'config'];

interface ZCCSidebarProps {
  activeTab: ZCCTabId;
  onTabChange: (tab: ZCCTabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ZCCSidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: ZCCSidebarProps) {
  const [favorites, setFavorites] = useState<ZCCTabId[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zcc:favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorite = (tabId: ZCCTabId) => {
    setFavorites(prev => {
      const next = prev.includes(tabId)
        ? prev.filter(t => t !== tabId)
        : [...prev, tabId].slice(-3); // top 3 favorites
      try {
        localStorage.setItem('zcc:favorites', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Group tabs by section, with favorites bubbled to top of Core
  const grouped = GROUP_ORDER.map(group => ({
    group,
    label: GROUP_LABELS[group],
    tabs: ALL_TABS.filter(t => t.group === group),
  }));

  // If collapsed, render icon-only rail
  if (collapsed) {
    return (
      <aside
        className="hidden lg:flex flex-col items-center py-3 px-2 border-r zcc-sidebar-collapsed"
        style={{
          width: 60,
          background: 'var(--zcc-lacquer-sunken)',
          borderColor: 'var(--zcc-hairline)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onToggleCollapse}
          className="mb-4 p-2 rounded transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--zcc-text-muted)' }}
          aria-label="Expandir sidebar"
          title="Expandir (⌘\)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {ALL_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative p-2 rounded mb-1 transition-all ${isActive ? 'zcc-tab-active' : 'hover:bg-white/[0.04]'}`}
              title={`${tab.label} — ${tab.desc}`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: isActive ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)' }}
              />
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
                  style={{ background: 'var(--zcc-kinpaku)' }}
                />
              )}
            </button>
          );
        })}
      </aside>
    );
  }

  // Expanded sidebar
  return (
    <aside
      className="hidden lg:flex flex-col zcc-sidebar-expanded"
      style={{
        width: 240,
        background: 'var(--zcc-lacquer-sunken)',
        borderRight: '1px solid var(--zcc-hairline)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Sidebar header */}
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--zcc-hairline)' }}>
        <div className="flex items-center gap-2">
          <Command className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
          <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--zcc-champagne)' }}>
            ZCC Modules
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--zcc-text-muted)' }}
          aria-label="Colapsar sidebar"
          title="Colapsar (⌘\)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Favorites section (only if user has starred any) */}
      {favorites.length > 0 && (
        <div className="px-2 py-2 border-b" style={{ borderColor: 'var(--zcc-hairline)' }}>
          <div className="px-2 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3" style={{ color: 'var(--zcc-kinpaku)' }} />
            <span className="font-mono text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--zcc-text-muted)' }}>
              Favoritos
            </span>
          </div>
          {favorites.map(favId => {
            const tab = ALL_TABS.find(t => t.id === favId);
            if (!tab) return null;
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <SidebarItem
                key={favId}
                tab={tab}
                Icon={Icon}
                isActive={isActive}
                isFavorite
                onClick={() => onTabChange(tab.id)}
                onToggleFavorite={() => toggleFavorite(tab.id)}
              />
            );
          })}
        </div>
      )}

      {/* Grouped sections */}
      <nav className="flex-1 py-2">
        {grouped.map(section => (
          <div key={section.group} className="mb-3">
            <div className="px-4 mb-1">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--zcc-text-muted)' }}>
                {section.label}
              </span>
            </div>
            {section.tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isFavorite = favorites.includes(tab.id);
              return (
                <SidebarItem
                  key={tab.id}
                  tab={tab}
                  Icon={Icon}
                  isActive={isActive}
                  isFavorite={isFavorite}
                  onClick={() => onTabChange(tab.id)}
                  onToggleFavorite={() => toggleFavorite(tab.id)}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: shortcuts hint */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--zcc-hairline)' }}>
        <div className="flex items-center justify-between text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
          <span>Atalhos</span>
          <span>⌘K · ⌘\</span>
        </div>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  tab: TabDef;
  Icon: React.ElementType;
  isActive: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
}

function SidebarItem({ tab, Icon, isActive, isFavorite, onClick, onToggleFavorite }: SidebarItemProps) {
  return (
    <div className="group relative px-2">
      <button
        onClick={onClick}
        className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-[11px] font-mono font-medium transition-all ${
          isActive ? 'zcc-tab-active' : 'hover:bg-white/[0.03]'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: isActive ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)' }}
        />
        <span className="flex-1 text-left truncate" style={{ color: isActive ? 'var(--zcc-champagne)' : 'var(--zcc-text-secondary)' }}>
          {tab.label}
        </span>
        {isActive && (
          <motion.div
            layoutId="sidebar-active-bar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
            style={{ background: 'var(--zcc-kinpaku)' }}
          />
        )}
      </button>
      {/* Favorite star — appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: isFavorite ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)' }}
        aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}

// ── Mobile sidebar (drawer) ─────────────────────────────────────────────────
// On screens below lg, sidebar becomes a slide-out drawer triggered by a hamburger button.

interface ZCCMobileNavProps {
  activeTab: ZCCTabId;
  onTabChange: (tab: ZCCTabId) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ZCCMobileNav({ activeTab, onTabChange, isOpen, onClose }: ZCCMobileNavProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[260px] overflow-y-auto lg:hidden"
            style={{
              background: 'var(--zcc-lacquer-sunken)',
              borderRight: '1px solid var(--zcc-hairline)',
            }}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--zcc-hairline)' }}>
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--zcc-champagne)' }}>
                  ZCC Módulos
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-white/[0.04]"
                style={{ color: 'var(--zcc-text-muted)' }}
                aria-label="Fechar menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <nav className="py-2">
              {GROUP_ORDER.map(group => (
                <div key={group} className="mb-3">
                  <div className="px-4 mb-1">
                    <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--zcc-text-muted)' }}>
                      {GROUP_LABELS[group]}
                    </span>
                  </div>
                  {ALL_TABS.filter(t => t.group === group).map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          onTabChange(tab.id);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-mono font-medium transition-all ${
                          isActive ? 'zcc-tab-active' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)' }} />
                        <span className="flex-1 text-left truncate" style={{ color: isActive ? 'var(--zcc-champagne)' : 'var(--zcc-text-secondary)' }}>
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export { ALL_TABS as ZCC_TABS };

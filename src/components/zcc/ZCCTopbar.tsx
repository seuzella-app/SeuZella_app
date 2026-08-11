'use client';

// ==============================================================================
// ZCC TOPBAR — Persistent top bar with breadcrumb, search, status, avatar
// ==============================================================================
// Replaces the previous inline header. Provides:
//   - Hamburger (mobile) + back to site
//   - Breadcrumb: ZCC / [Active Tab Label] / [Module desc]
//   - Global search trigger (opens command palette via ⌘K)
//   - Persistent status pills (MRR + containers) — visible on ALL tabs
//   - Theme toggle (dark/light via next-themes)
//   - Avatar with dropdown menu (logout, switch tenant, settings)
// ==============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Menu, Search, Bell, DollarSign,
  ChevronDown, Settings, LogOut, User, Building2,
  Sun, Moon, Activity,
} from 'lucide-react';
import type { ZCCTabId } from './ZCCSidebar';
import { ZCC_TABS } from './ZCCSidebar';

interface ZCCTopbarProps {
  activeTab: ZCCTabId;
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  totalMRR: number;
  totalClients: number;
  containersOnline: number;
  containersTotal: number;
}

export function ZCCTopbar({
  activeTab,
  onOpenMobileNav,
  onOpenCommandPalette,
  totalMRR,
  totalClients,
  containersOnline,
  containersTotal,
}: ZCCTopbarProps) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);

  const activeTabDef = ZCC_TABS.find(t => t.id === activeTab);
  const breadcrumb = activeTabDef
    ? { label: activeTabDef.label, desc: activeTabDef.desc }
    : { label: 'ZCC', desc: 'Central Control' };

  return (
    <header
      className="zcc-header sticky top-0 z-30"
      style={{ background: 'rgba(10,15,28,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 gap-3">
        {/* Left: Mobile hamburger + Back + Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-1.5 rounded transition-colors hover:bg-white/[0.04]"
            style={{ color: 'var(--zcc-text-muted)' }}
            aria-label="Abrir navegação"
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link
            href="/"
            className="p-1.5 rounded transition-colors hover:bg-white/[0.04] shrink-0"
            style={{ color: 'var(--zcc-text-muted)' }}
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Breadcrumb with Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity">
              <img
                src="/SeuZella_Logo_site.png"
                alt="Seu Zélla"
                className="h-6 sm:h-7 w-auto object-contain"
              />
              <span className="text-xs font-mono hidden sm:inline text-slate-500">/</span>
            </Link>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm sm:text-base font-mono font-bold truncate" style={{ color: 'var(--zcc-kinpaku)' }}>
                {breadcrumb.label}
              </span>
              <span className="text-xs font-mono hidden md:inline truncate" style={{ color: 'var(--zcc-text-muted)' }}>
                · {breadcrumb.desc}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search trigger (click opens command palette) */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded transition-colors hover:bg-white/[0.03] border min-w-[200px] lg:min-w-[280px]"
          style={{
            background: 'var(--zcc-lacquer-sunken)',
            borderColor: 'var(--zcc-hairline)',
          }}
          aria-label="Buscar (⌘K)"
        >
          <Search className="w-3 h-3" style={{ color: 'var(--zcc-text-muted)' }} />
          <span className="text-[11px] font-mono flex-1 text-left" style={{ color: 'var(--zcc-text-muted)' }}>
            Buscar módulos, ações...
          </span>
          <kbd
            className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
            style={{
              background: 'var(--zcc-lacquer)',
              borderColor: 'var(--zcc-hairline)',
              color: 'var(--zcc-text-muted)',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Right: Status pills + Notifications + Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* MRR pill — visible on all tabs (sm+) */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded"
            style={{
              background: 'rgba(212,168,67,0.06)',
              border: '1px solid rgba(212,168,67,0.12)',
            }}
            title="MRR Total"
          >
            <DollarSign className="w-3 h-3" style={{ color: 'var(--zcc-kinpaku)' }} />
            <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>
              R$ {totalMRR.toLocaleString('pt-BR')}
            </span>
          </div>

          {/* Containers status — visible on all tabs (md+) */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded"
            style={{
              background: containersOnline === containersTotal
                ? 'rgba(16,185,129,0.06)'
                : 'rgba(245,158,11,0.06)',
              border: containersOnline === containersTotal
                ? '1px solid rgba(16,185,129,0.12)'
                : '1px solid rgba(245,158,11,0.12)',
            }}
            title={`${containersOnline}/${containersTotal} containers online`}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: containersOnline === containersTotal ? '#10b981' : '#f59e0b',
              }}
            />
            <span
              className="text-[10px] font-mono"
              style={{ color: containersOnline === containersTotal ? '#10b981' : '#f59e0b' }}
            >
              {containersOnline}/{containersTotal}
            </span>
          </div>

          {/* Clients online */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded"
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.12)',
            }}
            title="Clientes ativos"
          >
            <Activity className="w-3 h-3" style={{ color: '#10b981' }} />
            <span className="text-[10px] font-mono" style={{ color: '#10b981' }}>
              {totalClients}
            </span>
          </div>

          {/* Theme toggle (placeholder — wired when next-themes provider is added) */}
          <ThemeToggle />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifMenuOpen(!notifMenuOpen);
                setAvatarMenuOpen(false);
              }}
              className="relative p-1.5 rounded transition-colors hover:bg-white/[0.04]"
              style={{ color: 'var(--zcc-text-muted)' }}
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--zcc-kinpaku)' }}
              />
            </button>
            <AnimatePresence>
              {notifMenuOpen && (
                <NotifDropdown onClose={() => setNotifMenuOpen(false)} />
              )}
            </AnimatePresence>
          </div>

          {/* Avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setAvatarMenuOpen(!avatarMenuOpen);
                setNotifMenuOpen(false);
              }}
              className="flex items-center gap-1.5 p-1 rounded transition-colors hover:bg-white/[0.04]"
              aria-label="Menu do usuário"
              aria-expanded={avatarMenuOpen}
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center font-mono text-[9px] font-bold"
                style={{
                  background: 'var(--zcc-kinpaku-dim)',
                  color: 'var(--zcc-kinpaku)',
                  border: '1px solid var(--zcc-hairline)',
                }}
              >
                ZA
              </div>
              <ChevronDown className="w-3 h-3 hidden sm:block" style={{ color: 'var(--zcc-text-muted)' }} />
            </button>
            <AnimatePresence>
              {avatarMenuOpen && (
                <AvatarDropdown onClose={() => setAvatarMenuOpen(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Theme Toggle (placeholder for now — wired when next-themes is plugged in) ─
function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-1.5 rounded transition-colors hover:bg-white/[0.04]"
      style={{ color: 'var(--zcc-text-muted)' }}
      aria-label="Alternar tema"
      title="Tema: em breve (light mode planejado Sprint 3)"
    >
      {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Notifications dropdown ───────────────────────────────────────────────────
function NotifDropdown({ onClose }: { onClose: () => void }) {
  const notifs = [
    { id: 1, severity: 'warning', title: 'Burn rate acima da média', desc: 'Custo API WhatsApp +18% nos últimos 7 dias', time: '5 min' },
    { id: 2, severity: 'info', title: 'Novo tenant cadastrado', desc: 'Pousada Recanto dos Lagos — Plano PRO', time: '23 min' },
    { id: 3, severity: 'critical', title: 'Anomalia detectada', desc: 'Cérebro Zélla: pico de erro 5xx no /api/brain', time: '1 h' },
    { id: 4, severity: 'success', title: 'MRR atualizado', desc: 'Meta mensal atingida — R$ 47.250', time: '2 h' },
  ];

  const colorMap: Record<string, string> = {
    warning: '#f59e0b',
    info: '#4a9a9a',
    critical: '#c45454',
    success: '#5a9a6a',
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 mt-2 w-80 z-50 zcc-panel"
        style={{ padding: 0, background: 'var(--zcc-lacquer-raised)' }}
      >
        <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--zcc-hairline)' }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--zcc-champagne)' }}>
            Notificações
          </span>
          <button className="text-[10px] font-mono hover:underline" style={{ color: 'var(--zcc-text-muted)' }}>
            Marcar todas
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto zcc-scroll">
          {notifs.map(n => (
            <div
              key={n.id}
              className="px-3 py-2.5 border-b last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
              style={{ borderColor: 'var(--zcc-hairline)' }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: colorMap[n.severity] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--zcc-champagne)' }}>
                      {n.title}
                    </span>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--zcc-text-muted)' }}>
                      {n.time}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--zcc-text-secondary)' }}>
                    {n.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--zcc-hairline)' }}>
          <button className="text-[10px] font-mono hover:underline" style={{ color: 'var(--zcc-kinpaku)' }}>
            Ver todas →
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Avatar dropdown ──────────────────────────────────────────────────────────
function AvatarDropdown({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: User, label: 'Perfil', desc: 'Gerenciar conta' },
    { icon: Building2, label: 'Trocar Tenant', desc: 'Selecionar propriedade' },
    { icon: Settings, label: 'Configurações', desc: 'Preferências do ZCC' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 mt-2 w-64 z-50 zcc-panel"
        style={{ padding: 0, background: 'var(--zcc-lacquer-raised)' }}
      >
        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--zcc-hairline)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded flex items-center justify-center font-mono text-[10px] font-bold"
              style={{
                background: 'var(--zcc-kinpaku-dim)',
                color: 'var(--zcc-kinpaku)',
                border: '1px solid var(--zcc-hairline)',
              }}
            >
              ZA
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold truncate" style={{ color: 'var(--zcc-champagne)' }}>
                Zélla Admin
              </div>
              <div className="text-[9px] font-mono truncate" style={{ color: 'var(--zcc-text-muted)' }}>
                admin@seuzella.com
              </div>
            </div>
          </div>
        </div>
        <div className="py-1">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.03] transition-colors text-left"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono" style={{ color: 'var(--zcc-champagne)' }}>
                    {item.label}
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t" style={{ borderColor: 'var(--zcc-hairline)' }}>
          <button
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-red-500/5 transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-danger)' }} />
            <div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--zcc-danger)' }}>
                Sair
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </>
  );
}

'use client';

// ==============================================================================
// DDC SHELL v2 — Modern application shell for Dashboard do Cliente
// ==============================================================================
// This is the upgraded shell wrapping all DDC tabs (Pousada + Airbnb).
// Improvements over v1:
//   - Collapsible sidebar (icon-only mode) — matches ZCC pattern
//   - ⌘K command palette for quick navigation (DDCCommandPalette)
//   - Live AI status ticker in topbar
//   - Real-time clock + date
//   - Quick KPI pills in topbar
//   - Theme toggle button (light/dark via next-themes)
//   - Better mobile drawer with backdrop blur
//   - Niche-themed accent colors (emerald for pousada, blue for airbnb)
//   - Preserves all existing functionality (MobileBottomNav, dropdown menus, etc.)
// ==============================================================================

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  LogOut,
  Menu,
  Settings,
  HelpCircle,
  User,
  ArrowLeft,
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  Bell,
  Activity,
  Zap,
  Sparkles,
} from 'lucide-react';
import { ZellaLogo } from '@/components/brand/ZellaLogo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileBottomNav } from './MobileBottomNav';
import { DDCCommandPalette } from './DDCCommandPalette';
import { YieldProfitWidget } from './YieldProfitWidget';
import { PWAInstallWidget } from './PWAInstallWidget';
import { useDesktopDevicePing } from '@/components/mobile/useMobileDevicePing';
import type { NicheType } from '@/contexts/NicheContext';
import type { PlanTier } from '@/lib/plan-features';
import { PLAN_DISPLAY } from '@/lib/plan-features';

// ═══════════════════════════════════════════════════════════════
// NICHE THEME CONFIG — accent colors per niche
// ═══════════════════════════════════════════════════════════════

export const NICHE_THEME: Record<NicheType, {
  accent: string; // hex
  accentBg: string;
  accentBorder: string;
  accentText: string;
  accentHover: string;
  sidebarActiveBg: string;
  sidebarActiveBorder: string;
  sidebarActiveText: string;
  headerGradient: string;
  label: string;
  logoSubtitle: string;
  glow: string;
}> = {
  pousada: {
    accent: '#10b981',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/30',
    accentText: 'text-emerald-400',
    accentHover: 'hover:border-emerald-500/50',
    sidebarActiveBg: 'bg-emerald-500/10',
    sidebarActiveBorder: 'border-emerald-500/30',
    sidebarActiveText: 'text-emerald-400',
    headerGradient: 'from-emerald-500 to-cyan-500',
    label: 'Pousada',
    logoSubtitle: 'Central de Controle',
    glow: '',
  },
  airbnb: {
    accent: '#3b82f6',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/30',
    accentText: 'text-blue-400',
    accentHover: 'hover:border-blue-500/50',
    sidebarActiveBg: 'bg-blue-500/10',
    sidebarActiveBorder: 'border-blue-500/30',
    sidebarActiveText: 'text-blue-400',
    headerGradient: 'from-blue-500 to-indigo-500',
    label: 'Airbnb',
    logoSubtitle: 'Central do Anfitrião',
    glow: '',
  },
};

// ═══════════════════════════════════════════════════════════════
// NAV ITEM INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  tier?: PlanTier; // optional: tier badge for locked tabs
}

// ═══════════════════════════════════════════════════════════════
// DDC SIDEBAR — Collapsible navigation
// ═══════════════════════════════════════════════════════════════

interface DDCSidebarProps {
  niche: NicheType;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userName?: string;
  propertyName?: string;
  currentPlan?: PlanTier;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DDCSidebar({
  niche,
  navItems,
  activeTab,
  onTabChange,
  userName = 'Proprietário',
  propertyName = 'Propriedade',
  collapsed = false,
  onToggleCollapse,
}: DDCSidebarProps) {
  const theme = NICHE_THEME[niche];

  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ─── Collapsed (icon-only) mode ─────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="hidden md:flex flex-col items-center py-3 px-2 border-r border-white/[0.06] bg-[#0d0d14] h-full">
        <button
          onClick={onToggleCollapse}
          className="mb-4 p-2 rounded transition-colors hover:bg-white/[0.04]"
          aria-label="Expandir sidebar"
          title="Expandir"
        >
          <ChevronRight className="w-4 h-4 text-white/40" />
        </button>
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative p-2.5 rounded-lg mb-1 transition-all ${isActive ? theme.sidebarActiveBg : 'hover:bg-white/[0.04]'}`}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={isActive ? theme.sidebarActiveText : 'text-white/40'}>
                {item.icon}
              </span>
              {isActive && (
                <motion.div
                  layoutId="ddc-sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
                  style={{ background: theme.accent }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Expanded sidebar ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Logo Section — Seu Zélla + nome da propriedade */}
      <div className="p-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <img
            src="/SeuZella_Logo_site.png"
            alt="Seu Zélla"
            className="h-8 w-auto object-contain shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-bold text-white tracking-tight truncate font-mono">
              seuzélla.com
            </h2>
            <p className="text-[10px] text-emerald-400 font-mono font-bold truncate" title={propertyName}>
              {propertyName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full text-left ${
                isActive
                  ? `${theme.sidebarActiveBg} ${theme.sidebarActiveText} border ${theme.sidebarActiveBorder}`
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="ddc-sidebar-active-bar"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: theme.accent }}
                />
              )}
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.tier && item.tier !== 'gratuito' && (
                <Badge
                  variant="outline"
                  className={`text-[7px] px-1 py-0 h-3 font-mono uppercase shrink-0 ${PLAN_DISPLAY[item.tier].badgeBorder} ${PLAN_DISPLAY[item.tier].badgeText} ${PLAN_DISPLAY[item.tier].badgeBg}`}
                >
                  {PLAN_DISPLAY[item.tier].label}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className={`bg-gradient-to-br ${theme.headerGradient} text-white text-xs font-bold`}>
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{userName}</p>
            <p className="text-[10px] text-white/40 truncate">{propertyName}</p>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded transition-colors hover:bg-white/[0.04]"
              aria-label="Colapsar sidebar"
              title="Colapsar"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white/40" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DDC SHELL — Layout wrapper
// ═══════════════════════════════════════════════════════════════

interface DDCShellProps {
  niche: NicheType;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
  userName?: string;
  propertyName?: string;
  currentPlan?: PlanTier;
  // Optional stats for topbar
  attendedToday?: number;
  conversionRate?: number;
  aiActive?: boolean;
  onToggleAI?: () => void;
}

export function DDCShell({
  niche,
  navItems,
  activeTab,
  onTabChange,
  children,
  userName = 'Proprietário',
  propertyName = 'Propriedade',
  currentPlan = 'gratuito',
  attendedToday = 45,
  conversionRate = 26.7,
  aiActive = true,
  onToggleAI,
}: DDCShellProps) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // ZCC Analytics — registra pings de uso Desktop (compara com Mobile)
  const route = niche === 'pousada' ? '/ddc/pousada' : '/ddc/airbnb';
  useDesktopDevicePing({
    niche,
    route,
    tenantId: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_ID ?? 'demo-desktop' : 'demo-desktop',
    tenantName: propertyName,
    tabName: activeTab,
  });

  const resolvedUserName = session?.user?.name || userName;
  const theme = NICHE_THEME[niche];
  const planDisplay = PLAN_DISPLAY[currentPlan] || PLAN_DISPLAY.gratuito;

  const userInitials = resolvedUserName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Hydration-safe mount
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ddc:${niche}:sidebar-collapsed`);
      if (stored !== null) setSidebarCollapsed(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, [niche]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(`ddc:${niche}:sidebar-collapsed`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [niche]);

  // ⌘K / Ctrl+K → command palette
  // ⌘\ / Ctrl+\ → toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  // ── Inline search: filter nav items by query ──────────────────────────
  const filteredSearchItems = searchQuery.trim()
    ? navItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  const handleSearchSelect = (tabId: string) => {
    onTabChange(tabId);
    setSearchQuery('');
    setSearchOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col bg-[#0d0d14] border-r border-white/[0.06] fixed inset-y-0 left-0 z-40 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 60 : 280 }}
      >
        <DDCSidebar
          niche={niche}
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          userName={resolvedUserName}
          propertyName={propertyName}
          currentPlan={currentPlan}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-[#0d0d14] border-white/[0.06]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de Navegação</SheetTitle>
          </SheetHeader>
          <DDCSidebar
            niche={niche}
            navItems={navItems}
            activeTab={activeTab}
            onTabChange={(id) => { onTabChange(id); setSidebarOpen(false); }}
            userName={resolvedUserName}
            propertyName={propertyName}
            currentPlan={currentPlan}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div
        className="flex-1 transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? 60 : 0 }}
      >
        {/* Mobile margin handled by md:ml classes */}
        <div className="lg:ml-[280px]" style={{ marginLeft: undefined }}>
          {/* Sticky Top Header */}
          <header className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.06]">

            <div className="flex items-center justify-between px-4 py-3 gap-3">
              {/* Left: Mobile menu + Back + Title */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile menu toggle */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 rounded-lg hover:bg-white/[0.04]"
                    aria-label="Abrir menu"
                  >
                    <Menu className="w-5 h-5 text-white/60" />
                  </button>
                </Sheet>

                {/* Back to home */}
                <Link
                  href="/"
                  className="text-white/30 hover:text-white/70 transition-all duration-200 p-2 rounded-lg hover:bg-white/[0.04] hidden sm:block"
                  aria-label="Voltar ao início"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>

                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-white tracking-tight truncate flex items-center gap-2">
                    <span>{propertyName}</span>
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-mono uppercase ${theme.accentBorder} ${theme.accentText} ${theme.accentBg}`}>
                      {theme.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-mono uppercase ${planDisplay.badgeBorder} ${planDisplay.badgeText} ${planDisplay.badgeBg}`}>
                      {planDisplay.label}
                    </Badge>

                    {/* Alternador Rápido de Nicho (Pousada vs Airbnb) */}
                    <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-white/10 text-[10px] font-mono">
                      <Link
                        href="/ddc/pousada"
                        className={`px-2 py-0.5 rounded transition-all ${
                          niche === 'pousada'
                            ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        🏨 Pousada
                      </Link>
                      <Link
                        href="/ddc/airbnb"
                        className={`px-2 py-0.5 rounded transition-all ${
                          niche === 'airbnb'
                            ? 'bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        🏡 Airbnb
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center: Functional inline search with dropdown results */}
              <div className="hidden md:flex flex-1 max-w-xl mx-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 z-10 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar ou navegar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredSearchItems.length > 0) {
                      handleSearchSelect(filteredSearchItems[0].id);
                    }
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-10 pr-16 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-white/20 font-mono px-1.5 py-0.5 rounded bg-white/[0.04] pointer-events-none">
                  ⌘K
                </kbd>
                {/* Search dropdown results */}
                {searchOpen && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d14] border border-white/[0.08] rounded-lg shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    {filteredSearchItems.length > 0 ? (
                      <>
                        <div className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-white/30 border-b border-white/[0.04]">
                          {filteredSearchItems.length} resultado{filteredSearchItems.length > 1 ? 's' : ''}
                        </div>
                        {filteredSearchItems.map((item) => (
                          <button
                            key={item.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSearchSelect(item.id);
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/[0.04] text-left transition-colors border-b border-white/[0.02] last:border-0"
                          >
                            <span className={`${theme.accentText} shrink-0`}>{item.icon}</span>
                            <span className="text-sm text-white/80 flex-1 truncate">{item.label}</span>
                            {item.tier && item.tier !== 'gratuito' && (
                              <Badge
                                variant="outline"
                                className={`text-[7px] px-1 py-0 h-3 font-mono uppercase shrink-0 ${PLAN_DISPLAY[item.tier].badgeBorder} ${PLAN_DISPLAY[item.tier].badgeText} ${PLAN_DISPLAY[item.tier].badgeBg}`}
                              >
                                {PLAN_DISPLAY[item.tier].label}
                              </Badge>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-6 text-center">
                        <p className="text-xs text-white/40 mb-1">Nenhum resultado para “{searchQuery}”</p>
                        <p className="text-[10px] text-white/30">Tente: hóspedes, financeiro, créditos, link...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: KPIs + Notifications + User */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Quick Stats */}
                <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-1.5">
                    <Activity className={`w-3 h-3 ${theme.accentText}`} />
                    <span className="text-[10px] text-white/50">Hoje:</span>
                    <span className="text-xs font-bold text-white">{attendedToday}</span>
                  </div>
                  <div className="w-px h-3 bg-white/[0.06]" />
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-bold text-white">{conversionRate}%</span>
                  </div>
                </div>

                {/* Command palette trigger (mobile) */}
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-white/[0.04]"
                  aria-label="Buscar"
                >
                  <Search className="w-4 h-4 text-white/60" />
                </button>

                {/* Notifications */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-all">
                      <Bell className="w-4 h-4 text-white/60 hover:text-white/90" />
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 bg-[#0a0a0f] border-white/[0.06]">
                    <DropdownMenuLabel className="text-white/90 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" />
                      Notificações
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04] text-xs">
                      <Sparkles className="w-3 h-3 mr-2 text-emerald-400" />
                      Nova reserva confirmada! 🎉
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04] text-xs">
                      <AlertCircle className="w-3 h-3 mr-2 text-amber-400" />
                      Roberto Almeida precisa de atenção
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04] text-xs">
                      <Crown className="w-3 h-3 mr-2 text-purple-400" />
                      Recorde de conversão hoje!
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/[0.04] transition-all">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className={`bg-gradient-to-br ${theme.headerGradient} text-white text-[10px] font-bold`}>
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#0a0a0f] border-white/[0.06]">
                    <DropdownMenuLabel className="text-white/90">
                      {resolvedUserName}
                      <div className="text-[10px] text-white/40 font-normal">
                        {session?.user?.email || ''}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04] cursor-pointer">
                      <User className="w-3.5 h-3.5 mr-2" />
                      Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-white/70 hover:text-white hover:bg-white/[0.04] cursor-pointer"
                      onClick={() => onTabChange('config')}
                    >
                      <Settings className="w-3.5 h-3.5 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04] cursor-pointer">
                      <HelpCircle className="w-3.5 h-3.5 mr-2" />
                      Suporte
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                      onClick={async () => {
                        try { await signOut({ redirect: false }); } catch { /* ignore */ }
                        window.location.href = '/login';
                      }}
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Time & Date Bar */}
            <div className="flex items-center justify-between px-4 py-1 bg-black/20 border-t border-white/[0.03]">
              <div className="flex items-center gap-2">
                <Activity className={`w-2.5 h-2.5 ${theme.accentText}`} />
                <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">
                  Sistema Operacional · DDC v2.0
                </span>
              </div>
              <div className="flex items-center gap-3">
                {mounted && currentTime ? (
                  <>
                    <span className="text-[9px] text-white/40 font-mono">
                      {formatDate(currentTime)}
                    </span>
                    <span className={`text-[9px] font-mono font-bold ${theme.accentText}`}>
                      {formatTime(currentTime)}
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] text-white/20 font-mono">--:--:--</span>
                )}
              </div>
            </div>

            {/* Mobile-First Sticky Horizontal Tab Bar (1-Tap Pill Navigation) */}
            <div className="md:hidden flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar bg-[#0d0d14]/95 backdrop-blur-md border-t border-white/[0.04]">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                      isActive
                        ? niche === 'pousada'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                          : 'bg-blue-500/20 text-cyan-300 border-blue-500/40 shadow-sm shadow-blue-500/20'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </header>

          {/* Page Content */}
          <main className="p-3 pb-24 md:p-6 md:pb-6 max-w-[1920px] mx-auto">
            {/* Yield Booster — Lucro Extra Gerado pela IA (sempre visível no topo) */}
            <YieldProfitWidget compact />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile Bottom Navigation Bar (1-Thumb Control) */}
          <MobileBottomNav
            niche={niche}
            activeTab={activeTab}
            onTabChange={onTabChange}
            aiActive={aiActive}
            onToggleAI={() => onToggleAI?.()}
            navItems={navItems}
          />
        </div>
      </div>

      {/* Command Palette */}
      <DDCCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        niche={niche}
        propertyName={propertyName}
        navItems={navItems}
        onNavigate={onTabChange}
        onToggleAI={onToggleAI}
        onLogout={async () => {
          try { await signOut({ redirect: false }); } catch { /* ignore */ }
          window.location.href = '/login';
        }}
      />

      {/* PWA Install Prompt Widget */}
      <PWAInstallWidget />
    </div>
  );
}

// Missing import — used in dropdown
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

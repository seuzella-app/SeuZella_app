'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ZellaLogo } from '@/components/brand/ZellaLogo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LogOut,
  Menu,
  Settings,
  HelpCircle,
  User,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import type { NicheType } from '@/contexts/NicheContext';
import type { PlanTier } from '@/lib/plan-features';
import { PLAN_DISPLAY } from '@/lib/plan-features';
import { MobileBottomNav } from './MobileBottomNav';

// ═══════════════════════════════════════════════════════════════
// NICHE THEME CONFIG — Centraliza cores e labels por nicho
// ═══════════════════════════════════════════════════════════════

export const NICHE_THEME: Record<NicheType, {
  accent: string;
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
}> = {
  pousada: {
    accent: 'emerald',
    accentBg: 'bg-emerald-500/15',
    accentBorder: 'border-emerald-500/20',
    accentText: 'text-emerald-400',
    accentHover: 'hover:border-emerald-500/30',
    sidebarActiveBg: 'bg-emerald-500/15',
    sidebarActiveBorder: 'border-emerald-500/20',
    sidebarActiveText: 'text-emerald-400',
    headerGradient: 'from-emerald-500 to-cyan-500',
    label: 'Pousada',
    logoSubtitle: 'Central de Controle',
  },
  airbnb: {
    accent: 'blue',
    accentBg: 'bg-blue-500/15',
    accentBorder: 'border-blue-500/20',
    accentText: 'text-blue-400',
    accentHover: 'hover:border-blue-500/30',
    sidebarActiveBg: 'bg-blue-500/15',
    sidebarActiveBorder: 'border-blue-500/20',
    sidebarActiveText: 'text-blue-400',
    headerGradient: 'from-blue-500 to-indigo-500',
    label: 'Airbnb',
    logoSubtitle: 'Central do Anfitrião',
  },
};

// ═══════════════════════════════════════════════════════════════
// NAV ITEM INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

// ═══════════════════════════════════════════════════════════════
// DDC SIDEBAR — Componente compartilhado
// ═══════════════════════════════════════════════════════════════

interface DDCSidebarProps {
  niche: NicheType;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userName?: string;
  propertyName?: string;
  currentPlan?: PlanTier;
}

export function DDCSidebar({
  niche,
  navItems,
  activeTab,
  onTabChange,
  userName = 'Proprietário',
  propertyName = 'Propriedade',
  currentPlan = 'gratuito',
}: DDCSidebarProps) {
  const theme = NICHE_THEME[niche];
  const planDisplay = PLAN_DISPLAY[currentPlan] || PLAN_DISPLAY.gratuito;

  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.08] flex items-center justify-center">
            <ZellaLogo size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight truncate">
              Seu Zélla
            </h2>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider truncate">
                {theme.logoSubtitle}
              </p>
              <Badge
                variant="outline"
                className={`text-[8px] px-1 py-0 h-3.5 font-mono uppercase ${planDisplay.badgeBorder} ${planDisplay.badgeText} ${planDisplay.badgeBg}`}
              >
                {planDisplay.label}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full text-left ${
              activeTab === item.id
                ? `${theme.sidebarActiveBg} ${theme.sidebarActiveText} border ${theme.sidebarActiveBorder}`
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
            }`}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
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
          <Badge
            variant="outline"
            className={`text-[8px] px-1 py-0 h-4 ${planDisplay.badgeBorder} ${planDisplay.badgeText} ${planDisplay.badgeBg}`}
          >
            {currentPlan.toUpperCase()}
          </Badge>
        </div>
      </div>
    </div>
  );

  return sidebarContent;
}

// ═══════════════════════════════════════════════════════════════
// DDC SHELL — Layout wrapper compartilhado
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
}: DDCShellProps) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiActive, setAiActive] = useState(true);

  const resolvedUserName = session?.user?.name || userName;
  const theme = NICHE_THEME[niche];
  const planDisplay = PLAN_DISPLAY[currentPlan] || PLAN_DISPLAY.gratuito;

  const userInitials = resolvedUserName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-[#0d0d14] border-r border-white/[0.06] fixed inset-y-0 left-0 z-40">
        <DDCSidebar
          niche={niche}
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={(id) => { onTabChange(id); }}
          userName={resolvedUserName}
          propertyName={propertyName}
          currentPlan={currentPlan}
        />
      </aside>

      {/* Mobile Sidebar */}
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
      <div className="flex-1 md:ml-64 lg:ml-72">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden p-2 rounded-lg hover:bg-white/[0.04]">
                    <Menu className="w-5 h-5 text-white/60" />
                  </Button>
                </SheetTrigger>
              </Sheet>

              {/* Back to home */}
              <Link
                href="/"
                className="text-white/30 hover:text-white/70 transition-all duration-200 p-2 rounded-lg hover:bg-white/[0.04]"
                aria-label="Voltar ao início"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              <div>
                <h1 className="text-base font-bold text-white tracking-tight">
                  {propertyName}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 font-mono uppercase ${theme.accentBorder} ${theme.accentText} ${theme.accentBg}`}
                  >
                    {theme.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 font-mono uppercase ${planDisplay.badgeBorder} ${planDisplay.badgeText} ${planDisplay.badgeBg}`}
                  >
                    {planDisplay.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Middle: Live Status Ticker */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-zinc-300 font-medium">
                {niche === 'pousada' 
                  ? '🟢 ZÉLLA ATIVO • Resposta em 0.6s • 80% Economia WhatsApp • Booking.com Sincronizado'
                  : '🛡️ PIX GATEKEEPER ATIVO • 100% Proteção contra Banimento Airbnb • Selo Superhost'}
              </span>
            </div>

            {/* Right: User Menu & Quick Links */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.04] transition-all"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className={`bg-gradient-to-br ${theme.headerGradient} text-white text-xs font-bold`}>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#0a0a0f] border-white/[0.06]">
                  <DropdownMenuLabel className="text-white/90">
                    {resolvedUserName}
                    <div className="text-[10px] text-white/40 font-normal">
                      {session?.user?.email || ''}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04]">
                    <User className="w-4 h-4 mr-2" />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04]">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-white/70 hover:text-white hover:bg-white/[0.04]">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Suporte
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                    onClick={async () => {
                      try {
                        await signOut({ redirect: false });
                      } catch {
                        // signOut may fail — session cookie will be cleared
                      }
                      window.location.href = '/login';
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 pb-24 md:p-6 md:pb-6 max-w-[1920px] mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile Bottom Navigation Bar (1-Thumb Control) */}
        <MobileBottomNav
          niche={niche}
          activeTab={activeTab}
          onTabChange={onTabChange}
          aiActive={aiActive}
          onToggleAI={() => setAiActive((prev) => !prev)}
        />
      </div>
    </div>
  );
}

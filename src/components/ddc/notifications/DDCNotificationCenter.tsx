'use client';

/**
 * Zélla — DDC Mobile & Desktop Notification Center (v3 — Clean Luxe Layout)
 *
 * Visual Improvements:
 *  - Compact, non-overlapping header with unread badge & close button
 *  - Single-row category tabs + quick search bar
 *  - Clean status & priority filter dropdowns (saving vertical space)
 *  - Spacious, high-contrast notification cards with clear action buttons
 *  - Zero layout shift, no overlapping elements, smooth scrolling
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  BellOff,
  CheckCheck,
  Volume2,
  Sparkles,
  Calendar,
  DollarSign,
  Users,
  Brain,
  Wrench,
  Megaphone,
  Shield,
  Trophy,
  Globe,
  X,
  ChevronRight,
  Archive,
  Search,
  Filter,
} from 'lucide-react';
import { useDDCMobileNotifications } from '@/lib/notifications/use-mobile-notifications';
import type {
  DDCNotification,
  NotificationCategory,
  NotificationNiche,
  NotificationPriority,
  NotificationStatus,
} from '@/lib/notifications/types';
import type { PlanTier } from '@/lib/plan-features';
import type { NicheType } from '@/contexts/NicheContext';

// ─── Category icons ────────────────────────────────────────────────────────
const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  reservations: Calendar,
  financial: DollarSign,
  guests: Users,
  ai: Brain,
  operations: Wrench,
  marketing: Megaphone,
  system: Shield,
  achievements: Trophy,
  external: Globe,
};

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  reservations: 'Reservas',
  financial: 'Financeiro',
  guests: 'Hóspedes',
  ai: 'IA Zélla',
  operations: 'Operações',
  marketing: 'Marketing',
  system: 'Sistema',
  achievements: 'Conquistas',
  external: 'Geral',
};

const PRIORITY_STYLE: Record<DDCNotification['priority'], { dot: string; badge: string; label: string }> = {
  low: { dot: 'bg-zinc-500', badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Baixa' },
  medium: { dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Média' },
  high: { dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Alta' },
  urgent: { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Urgente' },
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (minutes > 0) return `há ${minutes}min`;
  return 'agora';
}

export interface DDCNotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niche: NicheType | NotificationNiche;
  plan?: PlanTier;
}

export function DDCNotificationCenter({
  open,
  onOpenChange,
  niche,
  plan,
}: DDCNotificationCenterProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    urgentCount,
    isLoading,
    isMockMode,
    markAsRead,
    markAllAsRead,
    archive,
    simulateNotification,
  } = useDDCMobileNotifications({
    niche,
    plan,
    pollInterval: 15000,
    enableSound: true,
    enableBrowserNotifications: true,
  });

  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = notifications.slice();
    if (activeCategory !== 'all') {
      result = result.filter((n) => n.category === activeCategory);
    }
    if (activeStatus === 'unread') {
      result = result.filter((n) => n.status === 'unread');
    } else if (activeStatus === 'read') {
      result = result.filter((n) => n.status === 'read');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notifications, activeCategory, activeStatus, searchQuery]);

  const handleActionClick = useCallback(
    async (notification: DDCNotification) => {
      if (notification.status === 'unread') {
        try {
          await markAsRead(notification.id);
        } catch {}
      }
      onOpenChange(false);
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
    },
    [markAsRead, router, onOpenChange]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 bg-[#09090e] border-l border-white/[0.08] text-white flex flex-col h-full overflow-hidden shadow-2xl"
      >
        {/* Header Compacto e Elegante */}
        <SheetHeader className="p-4 border-b border-white/[0.08] bg-[#0c0c14] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-white text-sm font-bold tracking-tight">
                    Central de Notificações
                  </SheetTitle>
                  {unreadCount > 0 && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold px-2 py-0">
                      {unreadCount} novas
                    </Badge>
                  )}
                </div>
                <SheetDescription className="text-zinc-400 text-[11px] mt-0.5">
                  Alertas em tempo real do seu atendimento e reservas
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Barra de Busca e Filtros Rápidos */}
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <Input
                type="search"
                placeholder="Buscar por hóspede, PIX, quarto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 bg-zinc-900/90 border-zinc-700/60 text-white text-xs placeholder:text-zinc-500 rounded-lg focus:border-emerald-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Categorias Principais em 1 Linha com Scroll Suave */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 ${
                  activeCategory === 'all'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Todas
              </button>
              {(['reservations', 'financial', 'guests', 'ai', 'operations'] as NotificationCategory[]).map((cat) => {
                const Icon = CATEGORY_ICON[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {CATEGORY_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        </SheetHeader>

        {/* Barra de Ações Rápidas */}
        <div className="px-4 py-2 border-b border-white/[0.06] bg-black/40 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveStatus(activeStatus === 'unread' ? 'all' : 'unread')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                activeStatus === 'unread'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Não lidas ({unreadCount})
            </button>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="text-zinc-400 hover:text-emerald-400 disabled:opacity-40 flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> Marcar lidas
            </button>
          </div>

          {isMockMode && (
            <button
              type="button"
              onClick={() => simulateNotification()}
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 text-[11px]"
            >
              <Sparkles className="w-3 h-3" /> Simular
            </button>
          )}
        </div>

        {/* Lista de Notificações com Scroll Livre e Sem Sobreposições */}
        <div className="flex-1 overflow-y-auto zcc-scroll p-3 space-y-2.5">
          {isLoading && notifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-400 text-xs">Carregando suas notificações...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto mb-3">
                <BellOff className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-white font-bold text-sm">Tudo tranquilo por aqui!</p>
              <p className="text-zinc-400 text-xs mt-1 max-w-xs mx-auto">
                {searchQuery || activeCategory !== 'all' || activeStatus !== 'all'
                  ? 'Nenhum alerta corresponde aos filtros selecionados.'
                  : 'Nenhuma notificação pendente no momento.'}
              </p>
              {(searchQuery || activeCategory !== 'all' || activeStatus !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                    setActiveStatus('all');
                  }}
                  className="mt-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((notification) => {
                const Icon = CATEGORY_ICON[notification.category] || Bell;
                const isUnread = notification.status === 'unread';
                const pStyle = PRIORITY_STYLE[notification.priority] || PRIORITY_STYLE.medium;

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`rounded-xl border p-3.5 transition-all ${
                      isUnread
                        ? 'bg-zinc-900/90 border-emerald-500/40 shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800/80 opacity-75 hover:opacity-100'
                    }`}
                    onClick={() => {
                      if (isUnread) markAsRead(notification.id);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Ícone com Badge de Prioridade */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                          <Icon className="w-4 h-4 text-emerald-400" />
                        </div>
                        {isUnread && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
                        )}
                      </div>

                      {/* Conteúdo Textual da Notificação */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-xs font-bold leading-snug ${isUnread ? 'text-white' : 'text-zinc-300'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap shrink-0">
                            {timeAgo(notification.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {notification.message}
                        </p>

                        {/* Ações e Tags */}
                        <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${pStyle.badge}`}>
                            {pStyle.label}
                          </span>

                          {notification.actionLabel && notification.actionUrl ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(notification);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              {notification.actionLabel}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ) : isUnread ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              Marcar como lida
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="px-4 py-2.5 border-t border-white/[0.08] bg-[#0c0c14] flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <span>Seu Zélla • Central de Alertas</span>
          <span className="text-emerald-400 font-mono">● Conectado 24h</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

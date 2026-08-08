'use client';

/**
 * Zélla — DDC Mobile Notification Center (Mock Mode)
 *
 * Mobile-first slide-over drawer showing all notifications for the current
 * niche + plan. Includes:
 *  - Filter chips by category (9 categories)
 *  - Mark all as read button
 *  - Per-item: priority dot, title, message, time-ago, action button
 *  - Sound on new arrival (handled by hook)
 *  - "Simulate" button (mock mode only — to demo the system)
 */

import { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  BellOff,
  CheckCheck,
  Volume2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
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
} from 'lucide-react';
import { useDDCMobileNotifications } from '@/lib/notifications/use-mobile-notifications';
import type {
  DDCNotification,
  NotificationCategory,
  NotificationNiche,
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
  ai: 'IA Cérebro',
  operations: 'Operações',
  marketing: 'Marketing',
  system: 'Sistema',
  achievements: 'Conquistas',
  external: 'Externo',
};

const PRIORITY_COLOR: Record<DDCNotification['priority'], string> = {
  low: 'bg-zinc-500',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

// ─── Time-ago formatter ────────────────────────────────────────────────────
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

// ─── Component ─────────────────────────────────────────────────────────────
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
  const {
    notifications,
    unreadCount,
    urgentCount,
    isLoading,
    isMockMode,
    markAsRead,
    markAllAsRead,
    simulateNotification,
  } = useDDCMobileNotifications({
    niche,
    plan,
    pollInterval: 15000,
    enableSound: true,
    enableBrowserNotifications: true,
  });

  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');

  // ─── Filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  // ─── Category counts ─────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<NotificationCategory, number>> = {};
    for (const n of notifications) {
      if (n.status !== 'unread') continue;
      counts[n.category] = (counts[n.category] ?? 0) + 1;
    }
    return counts;
  }, [notifications]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 bg-[#0a0a0f] border-white/[0.06] flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-white text-base font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                Notificações
              </SheetTitle>
              {unreadCount > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {unreadCount} novas
                </Badge>
              )}
              {urgentCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                  {urgentCount} urgentes
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/60 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <SheetDescription className="text-white/40 text-xs">
            {niche === 'pousada' ? 'Pousada' : niche === 'airbnb' ? 'Airbnb' : 'Todos'} •
            {' '}{isMockMode ? 'Modo Mock' : 'Tempo Real'}
            <Volume2 className="inline-block w-3 h-3 ml-2" />
          </SheetDescription>
        </SheetHeader>

        {/* Filter chips */}
        <div className="px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            <FilterChip
              active={activeCategory === 'all'}
              label="Todas"
              count={unreadCount}
              onClick={() => setActiveCategory('all')}
            />
            {(Object.keys(CATEGORY_LABEL) as NotificationCategory[]).map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              if (count === 0 && activeCategory !== cat) return null;
              const Icon = CATEGORY_ICON[cat];
              return (
                <FilterChip
                  key={cat}
                  active={activeCategory === cat}
                  label={CATEGORY_LABEL[cat]}
                  icon={<Icon className="w-3 h-3" />}
                  count={count}
                  onClick={() => setActiveCategory(cat)}
                />
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-white/60 hover:text-white"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Marcar todas como lidas
          </Button>
          <div className="flex-1" />
          {isMockMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-emerald-400 hover:text-emerald-300"
              onClick={() => simulateNotification()}
              title="Simular nova notificação (mock mode)"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Simular
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="px-2 py-2 space-y-1">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/40 text-xs">Carregando notificações...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <BellOff className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-xs">
                  {activeCategory === 'all'
                    ? 'Nenhuma notificação no momento'
                    : `Nenhuma notificação em ${CATEGORY_LABEL[activeCategory as NotificationCategory]}`}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markAsRead(notification.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-black/20">
          <p className="text-[10px] text-white/30 text-center font-mono">
            Zélla DDC Mobile • Notificações v2 • Mock Mode
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Filter Chip ───────────────────────────────────────────────────────────
function FilterChip({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.08]'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 px-1.5 py-0 rounded-full bg-white/10 text-[9px]">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Notification Item ─────────────────────────────────────────────────────
function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: DDCNotification;
  onMarkRead: () => void;
}) {
  const Icon = CATEGORY_ICON[notification.category];
  const isUnread = notification.status === 'unread';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`relative px-3 py-2.5 rounded-lg transition-colors ${
        isUnread
          ? 'bg-white/[0.03] hover:bg-white/[0.05]'
          : 'bg-transparent hover:bg-white/[0.02] opacity-60'
      }`}
      onClick={() => {
        if (isUnread) onMarkRead();
      }}
    >
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="flex flex-col items-center gap-1 mt-0.5">
          <div className={`w-2 h-2 rounded-full ${PRIORITY_COLOR[notification.priority]}`} />
          <Icon className="w-3.5 h-3.5 text-white/40" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] leading-tight ${isUnread ? 'text-white font-medium' : 'text-white/60'}`}>
              {notification.title}
            </p>
            <span className="text-[10px] text-white/30 font-mono whitespace-nowrap mt-0.5">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5 leading-snug line-clamp-2">
            {notification.message}
          </p>
          {notification.actionLabel && notification.actionUrl && (
            <a
              href={notification.actionUrl}
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-400 hover:text-emerald-300"
              onClick={(e) => e.stopPropagation()}
            >
              {notification.actionLabel}
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

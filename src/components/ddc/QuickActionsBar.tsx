'use client';

import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  GraduationCap,
  Settings,
  Bell,
  Calendar,
  TrendingUp,
  Phone,
  MessageSquare,
  CreditCard,
  Zap,
  ArrowRight,
  Lock,
  Smartphone,
  Sparkles,
  Home,
  KeyRound
} from 'lucide-react';
import { type PlanTier, hasAccess } from '@/lib/plan-features';

interface QuickActionsBarProps {
  onActionClick: (action: string) => void;
  onQuickActionClick?: (actionId: string) => void;
  activeAction?: string;
  currentPlan?: PlanTier;
  /** Dynamic counts — replaces hardcoded values */
  dynamicCounts?: {
    messages?: number;
    guests?: number;
    bookings?: number;
    notifications?: number;
  };
}

interface ActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
  minTier: PlanTier;
}

export function QuickActionsBar({ onActionClick, onQuickActionClick, activeAction, currentPlan = 'gratuito', dynamicCounts }: QuickActionsBarProps) {
  const actions: ActionItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, minTier: 'gratuito' },
    { id: 'messages', label: 'Mensagens', icon: MessageCircle, count: dynamicCounts?.messages ?? 12, minTier: 'gratuito' },
    { id: 'guests', label: 'Hóspedes', icon: Users, count: dynamicCounts?.guests ?? 45, minTier: 'pro' },
    { id: 'training', label: 'Treinamento', icon: GraduationCap, minTier: 'pro' },
    { id: 'bookings', label: 'Reservas', icon: Calendar, count: dynamicCounts?.bookings ?? 3, minTier: 'lite' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, minTier: 'pro' },
    { id: 'notifications', label: 'Notificações', icon: Bell, count: dynamicCounts?.notifications ?? 5, minTier: 'gratuito' },
    { id: 'upsell', label: 'UPSELL', icon: Sparkles, minTier: 'gratuito' },
    { id: 'settings', label: 'Configurações', icon: Settings, minTier: 'gratuito' },
    { id: 'airb', label: 'Zélla AirB', icon: Home, minTier: 'pro' },
    { id: 'locks', label: 'Fechaduras', icon: KeyRound, minTier: 'lite' },
  ];

  const quickActions = [
    { id: 'call', label: 'Ligar', icon: Phone, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-400 bg-green-500/10 border-green-500/15' },
    { id: 'payment', label: 'Pagamento', icon: CreditCard, color: 'text-blue-400 bg-blue-500/10 border-blue-500/15' },
  ];

  // Link-in-Bio prominent tab config
  const isLibActive = activeAction === 'linkinbio';
  const isLibLocked = !hasAccess(currentPlan, 'lite');

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121216]/60 border border-white/[0.04] p-2.5 rounded-xl">
      {/* Segmented Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none select-none">
        {/* Link-in-Bio — Prominent CTA tab (highlighted, separated) */}
        <button
          onClick={() => onActionClick('linkinbio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer shrink-0 ${
            isLibLocked
              ? 'text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-white/[0.01] opacity-70'
              : isLibActive
                ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/10 text-emerald-300 border-emerald-500/25 shadow-sm shadow-emerald-500/5'
                : 'bg-emerald-500/[0.06] text-emerald-400/80 border-emerald-500/15 hover:bg-emerald-500/10 hover:text-emerald-300'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Link-in-Bio</span>
          {!isLibLocked && <Sparkles className="w-3 h-3 text-emerald-400/70" />}
          {isLibLocked && <Lock className="w-2.5 h-2.5 text-zinc-600" />}
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-white/[0.06] mx-1 shrink-0" />

        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = activeAction === action.id || (action.id === 'dashboard' && activeAction === 'overview');
          const isLocked = !hasAccess(currentPlan, action.minTier);

          return (
            <button
              key={action.id}
              onClick={() => onActionClick(action.id === 'dashboard' ? 'overview' : action.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                isLocked
                  ? 'text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-white/[0.01] opacity-70'
                  : isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[0.02]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{action.label}</span>

              {isLocked && (
                <Lock className="w-2.5 h-2.5 text-zinc-600" />
              )}

              {!isLocked && action.count !== undefined && action.count > 0 && (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${
                  isActive 
                    ? 'bg-emerald-500/20 border-emerald-500/25 text-emerald-300' 
                    : 'bg-zinc-800 border-zinc-700/60 text-zinc-400'
                }`}>
                  {action.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inline Quick Action Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto select-none">
        <div className="hidden xl:flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-2 shrink-0">
          <span>Ações</span>
          <ArrowRight className="w-3 h-3" />
        </div>
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              onClick={() => onQuickActionClick?.(action.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer hover:brightness-110 active:scale-[0.98] shrink-0 ${action.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
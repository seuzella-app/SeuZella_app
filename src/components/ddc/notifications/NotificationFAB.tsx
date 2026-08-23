'use client';

/**
 * Zélla — DDC Mobile Notification FAB (Floating Action Button)
 *
 * Floating bell button with unread badge. Used on mobile DDC pages.
 * Opens the DDCNotificationCenter sheet.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle } from 'lucide-react';
import { useDDCMobileNotifications } from '@/lib/notifications/use-mobile-notifications';
import { DDCNotificationCenter } from './DDCNotificationCenter';
import type { NotificationNiche } from '@/lib/notifications/types';
import type { PlanTier } from '@/lib/plan-features';
import type { NicheType } from '@/contexts/NicheContext';

export interface NotificationFABProps {
  niche: NicheType | NotificationNiche;
  plan?: PlanTier;
  /** Position classes — default bottom-right above mobile nav */
  className?: string;
}

export function NotificationFAB({ niche, plan, className = '' }: NotificationFABProps) {
  const [open, setOpen] = useState(false);
  const { unreadCount, urgentCount } = useDDCMobileNotifications({
    niche,
    plan,
    pollInterval: 15000,
    enableSound: false, // FAB itself doesn't trigger sound — center does
    enableBrowserNotifications: false,
  });

  // Hide FAB entirely if nothing to show
  const accentColor = niche === 'airbnb' ? 'bg-blue-500' : 'bg-emerald-500';
  const accentRing = niche === 'airbnb' ? 'ring-blue-500/30' : 'ring-emerald-500/30';
  const accentText = niche === 'airbnb' ? 'text-blue-400' : 'text-emerald-400';

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed z-40 bottom-20 right-4 sm:bottom-6 sm:right-6 w-12 h-12 rounded-full bg-[#0a0a0f] border border-white/[0.08] shadow-xl ${accentRing} ring-2 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-105 ${className}`}
        aria-label={`Notificações — ${unreadCount} novas`}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className={`w-5 h-5 ${accentText}`} />

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`absolute -top-1 -right-1 min-w-5 h-5 px-1 ${accentColor} rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Urgent pulse */}
        {urgentCount > 0 && (
          <motion.div
            className={`absolute inset-0 rounded-full ${accentColor} opacity-30`}
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>

      <DDCNotificationCenter open={open} onOpenChange={setOpen} niche={niche} plan={plan} />
    </>
  );
}

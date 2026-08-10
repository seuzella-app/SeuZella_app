'use client';

// ==============================================================================
// MOBILE NOTIFICATIONS HOOK — SEU ZÉLLA DDC MOBILE
// ==============================================================================
// Sound effects mapped by notification event type & priority
// ==============================================================================

import { useState, useEffect } from 'react';

export interface MobileNotificationItem {
  id: string | number;
  type: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  message?: string;
  timestamp?: string;
  read?: boolean;
}

export function useMobileNotifications(enableSound: boolean = true) {
  const [notifications, setNotifications] = useState<MobileNotificationItem[]>([]);

  const playNotificationSound = (newest: MobileNotificationItem) => {
    // Sound — choose file based on notification TYPE (not just priority)
    // Each event type has its own distinctive sound for instant recognition
    if (enableSound) {
      try {
        // Map notification type → sound file
        // PIX recebido = caixa registradora ("trin" de dinheiro)
        // Escalation/handover = WhatsApp notification sound
        // Reserva criada = "bad-ta-dum"
        // Reserva confirmada = arpeggio ascendente (sucesso)
        // Mensagem recebida = bip suave
        // Erro/falha = dois bipes graves
        // AI offline = alerta urgente
        // Default por prioridade
        const typeSoundMap: Record<string, string> = {
          'payment.pix_received': '/sounds/cash-register.mp3',
          'booking.escalated': '/sounds/whatsapp-notification.mp3',
          'guest.requested_human': '/sounds/whatsapp-notification.mp3',
          'booking.created': '/sounds/new-booking.mp3',
          'booking.confirmed': '/sounds/booking-confirmed.mp3',
          'booking.checkin_today': '/sounds/booking-confirmed.mp3',
          'guest.new_lead': '/sounds/message.mp3',
          'guest.hot_lead': '/sounds/new-booking.mp3',
          'guest.message_received': '/sounds/message.mp3',
          'ai.offline': '/sounds/alert.mp3',
          'payment.failed': '/sounds/error.mp3',
          'payment.overdue': '/sounds/error.mp3',
          'booking.double_booking': '/sounds/alert.mp3',
          'system.security_alert': '/sounds/alert.mp3',
          'system.plan_expiring': '/sounds/notification.mp3',
          'linkinbio.expiring_soon': '/sounds/notification.mp3',
          'achievement.first_booking': '/sounds/booking-confirmed.mp3',
          'achievement.milestone_10': '/sounds/booking-confirmed.mp3',
          'achievement.milestone_100': '/sounds/booking-confirmed.mp3',
          'achievement.revenue_record': '/sounds/cash-register.mp3',
        };

        // Type-specific sound, or fallback to priority-based
        const soundFile =
          typeSoundMap[newest.type] ??
          (newest.priority === 'urgent'
            ? '/sounds/alert.mp3'
            : newest.priority === 'high'
              ? '/sounds/notification.mp3'
              : newest.priority === 'medium'
                ? '/sounds/success.mp3'
                : '/sounds/info.mp3');

        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion) {
          const audio = new Audio(soundFile);
          // PIX e escalation: volume maior (evento importante)
          // Mensagens e info: volume menor (não atrapalhar)
          const isImportantEvent =
            newest.type === 'payment.pix_received' ||
            newest.type === 'booking.escalated' ||
            newest.type === 'guest.requested_human';
          audio.volume = isImportantEvent ? 0.7 : 0.5;
          audio.play().catch(() => {});
        }
      } catch {}
    }
  };

  const addNotification = (item: MobileNotificationItem) => {
    setNotifications((prev) => [item, ...prev]);
    playNotificationSound(item);
  };

  return {
    notifications,
    addNotification,
    playNotificationSound,
  };
}

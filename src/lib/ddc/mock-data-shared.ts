/**
 * SEU ZÉLLA — Shared Mock Data Bank (Desktop & Mobile Unified)
 * 
 * Camada de dados compartilhada entre os dashboards Web Desktop e o Super App Mobile.
 * Garante 100% de consistência entre telas em computador e smartphone.
 */

export interface SharedNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'pix' | 'checkin' | 'alert' | 'system' | 'message';
}

export interface SharedWhatsAppMessage {
  id: string;
  senderName: string;
  senderPhone: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  aiHandled: boolean;
  channel: 'whatsapp' | 'instagram' | 'web';
  status: 'active' | 'resolved' | 'escalated';
}

export interface SharedTransaction {
  id: string;
  guestName: string;
  description: string;
  paymentMethod: 'PIX' | 'Cartão' | 'Dinheiro';
  amount: number;
  date: string;
  status: 'approved' | 'pending' | 'refunded';
}

// ── Notifications Stream (Shared) ──────────────────────────────────────────
export const MOCK_SHARED_NOTIFICATIONS: SharedNotification[] = [
  {
    id: 'n1',
    title: '💰 PIX Recebido com Sucesso!',
    description: 'Reserva R$ 1.350,00 de Dr. Roberto Silva confirmada no PIX Direto (0% taxa).',
    time: 'Há 5 min',
    unread: true,
    type: 'pix', // TODO(REAL): sseLiveFeed.on('notification')
  },
  {
    id: 'n2',
    title: '🔑 PIN de Fechadura Disparado',
    description: 'PIN 849201# gerado e enviado via WhatsApp para Camila Alencar.',
    time: 'Há 18 min',
    unread: true,
    type: 'checkin',
  },
  {
    id: 'n3',
    title: '⚡ Sincronização iCAL Executada',
    description: 'Calendários Airbnb e Booking.com sincronizados com zero conflitos.',
    time: 'Há 45 min',
    unread: false,
    type: 'system',
  },
  {
    id: 'n4',
    title: '💬 Novo Hóspede em Atendimento IA',
    description: 'Fernanda O. perguntou sobre estacionamento e early check-in.',
    time: 'Há 1 hora',
    unread: false,
    type: 'message',
  },
];

// ── WhatsApp Conversations (Shared) ─────────────────────────────────────────
export const MOCK_SHARED_WHATSAPP_CONVERSATIONS: SharedWhatsAppMessage[] = [
  {
    id: 'c1',
    senderName: 'Dr. Roberto Silva',
    senderPhone: '(11) 98765-4321', // TODO(REAL): db.conversationLog.findMany()
    lastMessage: 'Perfeito! Já fiz o PIX de R$ 1.350. Poderia me enviar o código da fechadura?',
    timestamp: '15:24',
    unreadCount: 1,
    aiHandled: true,
    channel: 'whatsapp',
    status: 'active',
  },
  {
    id: 'c2',
    senderName: 'Fernanda Oliveira',
    senderPhone: '(21) 99887-1122',
    lastMessage: 'Qual o valor da diária para casal no próximo fim de semana? Tem vaga de garagem?',
    timestamp: '14:50',
    unreadCount: 0,
    aiHandled: true,
    channel: 'whatsapp',
    status: 'active',
  },
  {
    id: 'c3',
    senderName: 'Marcelo Santos',
    senderPhone: '(31) 97654-8899',
    lastMessage: 'Obrigado pelas recomendações de restaurantes! O check-in foi super tranquilo.',
    timestamp: 'Ontem',
    unreadCount: 0,
    aiHandled: true,
    channel: 'whatsapp',
    status: 'resolved',
  },
];

// ── Transactions Log (Shared) ────────────────────────────────────────────────
export const MOCK_SHARED_TRANSACTIONS: SharedTransaction[] = [
  {
    id: 'tx-101',
    guestName: 'Dr. Roberto Silva',
    description: 'Reserva Direct PIX — Suíte Master 101 (3 diárias)',
    paymentMethod: 'PIX', // TODO(REAL): db.paymentTransaction.findMany()
    amount: 1350.00,
    date: 'Hoje, 15:22',
    status: 'approved',
  },
  {
    id: 'tx-102',
    guestName: 'Fernanda Oliveira',
    description: 'Reserva Direct PIX — Chalé Vista Mar (2 diárias)',
    paymentMethod: 'PIX',
    amount: 1160.00,
    date: 'Hoje, 14:10',
    status: 'approved',
  },
  {
    id: 'tx-103',
    guestName: 'Marcelo Santos',
    description: 'Reserva Booking.com — Apartamento Standard',
    paymentMethod: 'Cartão',
    amount: 1280.00,
    date: 'Ontem, 18:45',
    status: 'approved',
  },
];

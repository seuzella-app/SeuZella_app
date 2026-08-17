/**
 * SEU ZÉLLA — Mock Data Bank: Pousada (Ready-to-Replace)
 * 
 * Fonte da verdade centralizada para métricas, listas e estado do DDC Pousada.
 * Cada campo exportado é anotado com o TODO(REAL) indicando de onde o dado
 * virá quando o sistema passar de MODO MOCK para PRODUÇÃO REAL.
 */

export interface PousadaOverviewMetrics {
  occupancyRate: number;        // % Ocupação atual
  totalRevenue: number;         // R$ Receita acumulada no mês
  directPixPercent: number;     // % Vendas via Direct PIX (sem taxa OTA)
  averageDailyRate: number;     // R$ Tarifa média da pousada
  checkInsToday: number;        // Quantidade de check-ins hoje
  checkOutsToday: number;       // Quantidade de check-outs hoje
  aiResponseTimeMs: number;     // Latência de resposta da IA em ms
  whatsappStatus: 'connected' | 'connecting' | 'disconnected';
}

export interface PousadaRoom {
  id: string;
  name: string;
  type: 'Suíte Master' | 'Chalé Vista Mar' | 'Apartamento Standard' | 'Bangalô Família';
  capacity: number;
  dailyRate: number;
  status: 'disponivel' | 'ocupado' | 'manutencao' | 'reservado';
  currentGuest?: string;
  checkOutDate?: string;
  amenities: string[];
}

export interface PousadaGuest {
  id: string;
  name: string;
  phone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  value: number;
  source: 'WhatsApp' | 'Booking' | 'Airbnb' | 'Balcão' | 'Direct PIX';
  status: 'atendimento-ia' | 'pix-enviado' | 'reserva-confirmada' | 'check-in-realizado';
}

// ── Overview Metrics Mock (Pousada) ──────────────────────────────────────────
export const MOCK_POUSADA_OVERVIEW: PousadaOverviewMetrics = {
  occupancyRate: 78,              // TODO(REAL): db.room.count({ status: 'occupied' }) / totalRooms * 100
  totalRevenue: 32450.00,         // TODO(REAL): db.paymentTransaction.aggregate({ _sum: { amount: true } })
  directPixPercent: 68,           // TODO(REAL): db.booking.count({ method: 'pix' }) / totalBookings * 100
  averageDailyRate: 420.00,       // TODO(REAL): db.room.aggregate({ _avg: { dailyRate: true } })
  checkInsToday: 4,               // TODO(REAL): db.booking.count({ where: { checkIn: today } })
  checkOutsToday: 2,              // TODO(REAL): db.booking.count({ where: { checkOut: today } })
  aiResponseTimeMs: 380,          // TODO(REAL): telemetry.average('ai_latency_ms')
  whatsappStatus: 'connected',    // TODO(REAL): meta-cloudClient.getStatus(tenantId)
};

// ── Rooms Mock (Pousada) ─────────────────────────────────────────────────────
export const MOCK_POUSADA_ROOMS: PousadaRoom[] = [
  {
    id: '101',
    name: 'Suíte Master 101',
    type: 'Suíte Master',
    capacity: 2,
    dailyRate: 450.00,            // TODO(REAL): db.room.findUnique({ id: '101' }).dailyRate
    status: 'ocupado',            // TODO(REAL): db.room.findUnique({ id: '101' }).status
    currentGuest: 'Dr. Roberto Silva', // TODO(REAL): db.booking.findFirst({ roomId: '101', active: true }).guestName
    checkOutDate: '12/08',
    amenities: ['Wi-Fi 500MB', 'Vista Mar', 'Hidromassagem', 'Café incluso'],
  },
  {
    id: '102',
    name: 'Chalé Vista Mar 102',
    type: 'Chalé Vista Mar',
    capacity: 4,
    dailyRate: 580.00,
    status: 'disponivel',
    amenities: ['Cozinha Completa', 'Lareira', 'Wi-Fi 500MB', 'Pet Friendly'],
  },
  {
    id: '103',
    name: 'Apartamento Standard 103',
    type: 'Apartamento Standard',
    capacity: 2,
    dailyRate: 320.00,
    status: 'reservado',
    currentGuest: 'Camila Alencar',
    checkOutDate: '14/08',
    amenities: ['Ar Condicionado', 'Wi-Fi', 'Café incluso'],
  },
  {
    id: '104',
    name: 'Bangalô Família 104',
    type: 'Bangalô Família',
    capacity: 5,
    dailyRate: 790.00,
    status: 'disponivel',
    amenities: ['Piscina Privativa', 'Deck Panorâmico', 'Churrasqueira', 'Estacionamento'],
  },
];

// ── Guests Mock (Pousada) ────────────────────────────────────────────────────
export const MOCK_POUSADA_GUESTS: PousadaGuest[] = [
  {
    id: 'g1',
    name: 'Carlos Eduardo',
    phone: '(11) 98765-4321',    // TODO(REAL): db.guest.phone
    roomType: 'Suíte Master 101',
    checkIn: '10/08',
    checkOut: '13/08',
    value: 1350.00,              // TODO(REAL): db.booking.totalValue
    source: 'Direct PIX',         // TODO(REAL): db.booking.channel
    status: 'check-in-realizado',
  },
  {
    id: 'g2',
    name: 'Fernanda Oliveira',
    phone: '(21) 99887-1122',
    roomType: 'Chalé Vista Mar 102',
    checkIn: '12/08',
    checkOut: '15/08',
    value: 1740.00,
    source: 'WhatsApp',
    status: 'pix-enviado',
  },
  {
    id: 'g3',
    name: 'Marcelo Santos',
    phone: '(31) 97654-8899',
    roomType: 'Apartamento Standard 103',
    checkIn: '14/08',
    checkOut: '18/08',
    value: 1280.00,
    source: 'Booking',
    status: 'reserva-confirmada',
  },
  {
    id: 'g4',
    name: 'Juliana Paes',
    phone: '(41) 99123-5544',
    roomType: 'Bangalô Família 104',
    checkIn: '20/08',
    checkOut: '22/08',
    value: 1580.00,
    source: 'WhatsApp',
    status: 'atendimento-ia',
  },
];

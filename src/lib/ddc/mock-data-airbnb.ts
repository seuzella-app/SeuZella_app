/**
 * SEU ZÉLLA — Mock Data Bank: Airbnb / Anfitrião (Ready-to-Replace)
 * 
 * Fonte da verdade centralizada para métricas, imóveis, iCAL e automações do DDC Airbnb.
 * Cada campo exportado é anotado com o TODO(REAL) indicando a fonte real futura.
 */

export interface AirbnbOverviewMetrics {
  totalProperties: number;      // Total de imóveis gerenciados
  activeProperties: number;     // Imóveis com canal iCAL/Airbnb ativo
  totalRevenue: number;         // Receita total do mês em R$
  averageOccupancy: number;     // % Ocupação média do portfólio
  superhostRating: number;      // Rating médio dos imóveis (ex: 4.92)
  totalReviewsCount: number;    // Quantidade total de avaliações recebidas
  autoPinsGenerated: number;    // Quantidade de PINs gerados automaticamente
  icalSyncStatus: 'synced' | 'syncing' | 'error';
}

export interface AirbnbProperty {
  id: string;
  name: string;
  location: string;
  connected: boolean;
  occupancy: number;
  rating: number;
  reviews: number;
  revenue: number;
  icalUrl?: string;
  smartLockStatus: 'online' | 'offline' | 'battery_low';
  currentPin?: string;
}

export interface AirbnbSyncSource {
  name: string;
  icon: string;
  status: 'synced' | 'syncing' | 'disconnected';
  lastSync: string;
  eventsCount: number;
}

export interface AirbnbAutomationLog {
  id: string;
  action: string;
  detail: string;
  time: string;
  type: 'auto-reply' | 'instruction' | 'update' | 'reminder';
  propertyId?: string;
}

// ── Overview Metrics Mock (Airbnb) ────────────────────────────────────────────
export const MOCK_AIRBNB_OVERVIEW: AirbnbOverviewMetrics = {
  totalProperties: 3,             // TODO(REAL): db.property.count({ tenantId })
  activeProperties: 2,            // TODO(REAL): db.property.count({ tenantId, connected: true })
  totalRevenue: 18650.00,         // TODO(REAL): db.paymentTransaction.aggregate({ _sum: { amount: true } })
  averageOccupancy: 73,           // TODO(REAL): calculatePortfolioOccupancy(tenantId)
  superhostRating: 4.86,          // TODO(REAL): db.property.aggregate({ _avg: { rating: true } })
  totalReviewsCount: 459,         // TODO(REAL): db.property.aggregate({ _sum: { reviewsCount: true } })
  autoPinsGenerated: 142,         // TODO(REAL): db.lockPin.count({ tenantId })
  icalSyncStatus: 'synced',       // TODO(REAL): icalSyncEngine.getStatus(tenantId)
};

// ── Properties Mock (Airbnb) ─────────────────────────────────────────────────
export const MOCK_AIRBNB_PROPERTIES: AirbnbProperty[] = [
  {
    id: 'prop-1',
    name: 'Apartamento Vista Mar — Copacabana',
    location: 'Copacabana, Rio de Janeiro, RJ',
    connected: true,              // TODO(REAL): db.property.findUnique({ id: 'prop-1' }).connected
    occupancy: 84,                // TODO(REAL): db.property.findUnique({ id: 'prop-1' }).occupancy
    rating: 4.96,
    reviews: 214,
    revenue: 8450.00,
    icalUrl: 'https://www.airbnb.com.br/calendar/ical/10928374.ics',
    smartLockStatus: 'online',
    currentPin: '849201#',
  },
  {
    id: 'prop-2',
    name: 'Chalé Campos do Jordão',
    location: 'Campos do Jordão, SP',
    connected: true,
    occupancy: 72,
    rating: 4.85,
    reviews: 156,
    revenue: 6280.00,
    icalUrl: 'https://www.airbnb.com.br/calendar/ical/9981273.ics',
    smartLockStatus: 'online',
    currentPin: '109284#',
  },
  {
    id: 'prop-3',
    name: 'Studio Paulista Cyber Loft',
    location: 'São Paulo, SP',
    connected: false,
    occupancy: 63,
    rating: 4.78,
    reviews: 89,
    revenue: 3920.00,
    icalUrl: 'https://www.booking.com/ical/sync/881273.ics',
    smartLockStatus: 'battery_low',
    currentPin: '556102#',
  },
];

// ── iCAL Sync Sources Mock (Airbnb) ──────────────────────────────────────────
export const MOCK_AIRBNB_SYNC_SOURCES: AirbnbSyncSource[] = [
  { name: 'Airbnb iCal', icon: '🏠', status: 'synced', lastSync: 'Há 2 min', eventsCount: 18 },  // TODO(REAL): icalSyncEngine.getSourceStatus('airbnb')
  { name: 'Booking.com iCal', icon: '🔵', status: 'synced', lastSync: 'Há 5 min', eventsCount: 12 },// TODO(REAL): icalSyncEngine.getSourceStatus('booking')
  { name: 'Google Calendar Sync', icon: '📅', status: 'disconnected', lastSync: 'Nunca', eventsCount: 0 },
];

// ── Automation Logs Mock (Airbnb) ───────────────────────────────────────────
export const MOCK_AIRBNB_AUTOMATION_LOGS: AirbnbAutomationLog[] = [
  { id: '1', action: 'Resposta autônoma enviada no WhatsApp', detail: 'para Marcos S. (Dúvida sobre Wi-Fi)', time: '2 min atrás', type: 'auto-reply', propertyId: 'prop-1' },
  { id: '2', action: 'PIN da fechadura eletrônica disparado', detail: 'para Ana P. (PIN: 849201#)', time: '15 min atrás', type: 'instruction', propertyId: 'prop-1' },
  { id: '3', action: 'Sincronização iCAL concluída', detail: 'Flat Copacabana x Booking.com', time: '1 hora atrás', type: 'update', propertyId: 'prop-1' },
  { id: '4', action: 'Lembrete de checkout automático', detail: 'para João M. (Check-out em 1h)', time: '3 horas atrás', type: 'reminder', propertyId: 'prop-2' },
];

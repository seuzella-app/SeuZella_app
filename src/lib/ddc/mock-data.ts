import type {
  Guest,
  Booking,
  RevenueMetrics,
  AIActivity,
  ConversationLog,
  KnowledgeEntry,
  TrainingPrompt,
  Notification,
  PerformanceMetrics,
  RoomOccupancy,
  PropertySettings,
  QuickAction,
  ChartDataPoint
} from '@/types/ddc';

// ============================================================================
// PROPERTY SETTINGS
// ============================================================================

export const mockPropertySettings: PropertySettings = {
  id: 'prop-001',
  name: 'Pousada Serenity',
  type: 'pousada',
  size: 'media',
  tier: 'padrao',
  totalRooms: 12,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  currency: 'BRL',
  locale: 'pt-BR',
  aiConfig: {
    active: true,
    autonomyLevel: 0,
    escalationThreshold: 70,
    autoBookings: false,
    autoPayments: false,
    language: 'pt-BR',
    tone: 'friendly',
    workingHours: {
      start: '00:00',
      end: '23:59',
      timezone: 'America/Sao_Paulo'
    }
  },
  integrations: {
    whatsapp: true,
    booking: false,
    airbnb: false,
    pix: true,
    "payment-gateway": false,
    calendar: true
  }
};

// ============================================================================
// REVENUE METRICS (ZEROED)
// ============================================================================

export const mockRevenueMetrics: RevenueMetrics = {
  today: {
    generated: 0,
    reservations: 0,
    aiAttended: 0,
    conversionRate: 0
  },
  week: {
    generated: 0,
    reservations: 0,
    growth: 0
  },
  month: {
    generated: 0,
    reservations: 0,
    growth: 0,
    projected: 0
  }
};

// ============================================================================
// GUESTS CRM (EMPTY)
// ============================================================================

export const mockGuests: Guest[] = [];

// ============================================================================
// BOOKINGS (EMPTY)
// ============================================================================

export const mockBookings: Booking[] = [];

// ============================================================================
// AI ACTIVITIES (EMPTY)
// ============================================================================

export const mockAIActivities: AIActivity[] = [];

// ============================================================================
// CONVERSATION LOGS (EMPTY)
// ============================================================================

export const mockConversationLogs: ConversationLog[] = [];

// ============================================================================
// KNOWLEDGE ENTRIES (EMPTY)
// ============================================================================

export const mockKnowledgeEntries: KnowledgeEntry[] = [];

// ============================================================================
// TRAINING PROMPTS (EMPTY)
// ============================================================================

export const mockTrainingPrompts: TrainingPrompt[] = [];

// ============================================================================
// NOTIFICATIONS (EMPTY)
// ============================================================================

export const mockNotifications: Notification[] = [];

// ============================================================================
// PERFORMANCE METRICS (ZEROED)
// ============================================================================

export const mockPerformanceMetrics: PerformanceMetrics = {
  today: {
    generated: 0,
    reservations: 0,
    aiAttended: 0,
    conversionRate: 0
  },
  week: {
    generated: 0,
    reservations: 0,
    growth: 0
  },
  month: {
    generated: 0,
    reservations: 0,
    growth: 0,
    projected: 0
  }
};

// ============================================================================
// ROOM OCCUPANCY (EMPTY/ZEROED)
// ============================================================================

export const mockRoomOccupancy: RoomOccupancy[] = [];

// ============================================================================
// CHARTS DATA (ZEROED)
// ============================================================================

export const mockRevenueChartData: ChartDataPoint[] = [];
export const mockOccupancyChartData: ChartDataPoint[] = [];
export const mockConversionChartData: ChartDataPoint[] = [];

// ============================================================================
// QUICK ACTIONS (PRESERVED FOR FUNCTIONALITY)
// ============================================================================

export const mockQuickActions: QuickAction[] = [
  {
    id: '1',
    category: 'booking',
    label: 'Nova Reserva',
    icon: 'CalendarPlus',
    action: 'open-booking-modal',
    shortcut: '⌘N',
    requiresConfirmation: false
  },
  {
    id: '2',
    category: 'communication',
    label: 'Pausar IA',
    icon: 'Pause',
    action: 'pause-ai-agent',
    shortcut: '⌘P',
    requiresConfirmation: true
  },
  {
    id: '3',
    category: 'analytics',
    label: 'Relatório DDC',
    icon: 'FileText',
    action: 'export-ddc-report',
    shortcut: '⌘E',
    requiresConfirmation: false
  },
  {
    id: '4',
    category: 'settings',
    label: 'Configurar IA',
    icon: 'Bot',
    action: 'open-ai-settings',
    shortcut: '⌘I',
    requiresConfirmation: false
  },
  {
    id: '5',
    category: 'emergency',
    label: 'Assumir Chat',
    icon: 'Flame',
    action: 'filter-hot-leads',
    shortcut: '⌘H',
    requiresConfirmation: false
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  formatCurrency,
  formatPhoneNumber,
  formatDate,
  formatDateTime,
  formatTimeAgo,
  getGuestStatusColor,
  getBookingStatusColor
} from './ddc-utils';
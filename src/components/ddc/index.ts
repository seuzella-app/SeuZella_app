// ZEHLA DDC - Cognitive OS Command Center
// Component Exports

// Shared Shell Components (PASSO 3 — Unified DDC Architecture)
export { DDCShell, DDCSidebar, NICHE_THEME } from './DDCShell';
export type { NavItem } from './DDCShell';

// Main Components
export { DDCHeader } from './DDCHeader';
export { RevenueMetrics } from './RevenueMetrics';
export { AILiveFeed } from './AILiveFeed';
export { GuestCRMPipeline } from './GuestCRMPipeline';
export { TrainingCenter } from './TrainingCenter';
export { QuickActionsBar } from './QuickActionsBar';
export { ZelladorChat } from './ZelladorChat';

// Plan Gating
export { PlanGate, PlanUpgradeBanner } from './PlanGate';

// Reusable Components
export { MetricCard } from './MetricCard';
export { ConversationCard } from './ConversationCard';
export { GuestCard } from './GuestCard';
export { PipelineStage } from './PipelineStage';
export { TrainingCard } from './TrainingCard';
export { AIStatusBadge, AIStatusDot, AIStatusCard } from './AIStatusBadge';

// Magic Scanner (Onboarding)
export { MagicScanner } from './MagicScanner';
export type { MagicScanResult } from './MagicScanner';

// Zella Simulator (Sandbox)
export { ZellaSimulator } from './ZellaSimulator';

// Guest Guide (Guia Digital)
export { GuestGuidePanel } from './GuestGuidePanel';

// AirB
export { ZellaAirBTab } from './ZellaAirBTab';

// Booking Sync
export { BookingSyncPanel } from './BookingSyncPanel';

// Mobile Navigation
export { MobileBottomNav } from './MobileBottomNav';


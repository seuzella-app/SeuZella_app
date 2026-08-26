/**
 * ZÉLLA — Prisma application-level tenant isolation.
 * Automatically injects tenantId for models classified TENANT_SCOPED.
 * This is application-level isolation; it is not PostgreSQL RLS.
 */

import { PrismaClient } from '@prisma/client';

const TENANT_MODELS = [
  'LockDevice', 'LockCode', 'LockEvent', 'LockOAuthAccount',
  'Reservation', 'Guest', 'GuestMessage', 'GuestGuide',
  'Property', 'Room', 'ApiConfig', 'AgentConfig',
  'Lead', 'Campaign', 'Target', 'SwipeTemplate', 'SwipeUsage',
  'FunnelEvent', 'FunnelScore',
  'AgentLog', 'ConversationLog', 'ConversationMessage', 'AIActivityLog',
  'KnowledgeEntry',
  'Transaction', 'Subscription', 'PaymentTransaction',
  'CalendarSync', 'AuditLog', 'ConsentLog',
  'AirBProperty', 'AirBConversation', 'AirBSubscription',
  'DynamicPricingRule', 'PricingCalculation',
  'ReferralCode', 'AmortizationCredit', 'LiteMilestone',
  'GuestRegistration', 'YieldProfitRecord', 'DevicePing',
  'CostLog', 'Booking', 'TrainingPrompt', 'Notification',
  'PerformanceSnapshot', 'QuickAction', 'Feedback', 'ZelladorMessage',
  'LgpdDeleteRequest', 'LgpdIncident', 'PushSubscription', 'MetaCostLog',
  'AirBRegionalKnowledge', 'AirBScrapingJob', 'AirBTransaction',
  'WhatsAppMessageCost', 'MessageBundle', 'ConsentRecord',
  'AirbnbWebhookEvent', 'AirbnbOAuthToken', 'DpoPreferencePair',
  'GraphNode', 'GraphEdge', 'BrainHealthLog', 'CompiledPrompt',
  'AirbExpense', 'AirbOperationTask', 'AirbGoal', 'AirbCommission',
  'AirbReport', 'PolicyAudit', 'CerebroWorkflow',
] as const;

const FILTERED_OPERATIONS = ['findMany', 'findFirst', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy', 'upsert'];
const CREATE_OPERATIONS = ['create', 'createMany'];
type AnyArgs = { where?: any; data?: any; create?: any; update?: any; [key: string]: any };

export function getTenantDb(prisma: PrismaClient, tenantId: string) {
  if (!tenantId) throw new Error('TENANT_CONTEXT_REQUIRED');

  return prisma.$extends({
    name: 'tenantIsolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: AnyArgs | undefined; query: (args: any) => Promise<any> }) {
          if (!TENANT_MODELS.includes(model as any)) return query(args);

          if (FILTERED_OPERATIONS.includes(operation)) {
            args ??= {};
            args.where ??= {};
            if (args.where.tenantId && args.where.tenantId !== tenantId) {
              console.error(`[TENANT_ISOLATION] Cross-tenant access blocked: ${tenantId} -> ${args.where.tenantId} on ${model}.${operation}`);
              if (operation === 'findMany') return [];
              if (operation === 'count') return 0;
              if (operation === 'aggregate') return { _count: { _all: 0 } };
              return null;
            }
            args.where.tenantId = tenantId;
          }

          if (operation === 'upsert') {
            args.create ??= {};
            args.update ??= {};
            args.create.tenantId = tenantId;
            args.update.tenantId = tenantId;
          } else if (CREATE_OPERATIONS.includes(operation)) {
            args ??= {};
            args.data ??= {};
            if (operation === 'createMany' && Array.isArray(args.data)) args.data = args.data.map((item: any) => ({ ...item, tenantId }));
            else if (typeof args.data === 'object') args.data.tenantId = tenantId;
          }

          return query(args);
        },
      },
    },
  });
}

export function assertTenantOwnership(record: { tenantId?: string } | null, tenantId: string, modelName?: string): void {
  if (!record) return;
  if (record.tenantId && record.tenantId !== tenantId) {
    console.error(`[TENANT_ISOLATION] Cross-tenant record blocked for ${tenantId} on ${modelName || 'model'}`);
    throw new Error('TENANT_MISMATCH: Record does not belong to this tenant');
  }
}

export { TENANT_MODELS };

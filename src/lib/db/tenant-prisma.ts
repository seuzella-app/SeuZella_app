/**
 * ZÉLLA — Prisma Extension para RLS (Row Level Security) Automático
 *
 * Força a injeção automática de tenantId em todas as operações Prisma
 * de modelos sensíveis, ELIMINANDO o risco de BOLA/IDOR.
 *
 * USO:
 *   import { getTenantDb } from '@/lib/db/tenant-prisma';
 *   const tenantDb = getTenantDb(db, tenantId);
 *   const result = await tenantDb.lockDevice.findMany({ where: { ... } });
 *   // tenantId é INJETADO automaticamente no where!
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
  'CalendarSync',
  'AuditLog', 'ConsentLog',
  'AirBProperty', 'AirBConversation', 'AirBSubscription',
  'DynamicPricingRule', 'PricingCalculation',
  'ReferralCode', 'AmortizationCredit', 'LiteMilestone',
  'GuestRegistration',
  'YieldProfitRecord',
];

const FILTERED_OPERATIONS = ['findMany', 'findFirst', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'];
const CREATE_OPERATIONS = ['create', 'createMany', 'upsert'];

export function getTenantDb(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    name: 'tenantRLS',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.includes(model)) return query(args);

          if (FILTERED_OPERATIONS.includes(operation)) {
            if (!args) args = {};
            if (!args.where) args.where = {};
            if (args.where.tenantId && args.where.tenantId !== tenantId) {
              console.error(`[RLS_VIOLATION] Tenant ${tenantId} tentou acessar tenant ${args.where.tenantId} em ${model}.${operation}`);
              if (operation === 'findMany') return [];
              if (operation === 'count') return 0;
              return null;
            }
            args.where.tenantId = tenantId;
          }

          if (CREATE_OPERATIONS.includes(operation)) {
            if (!args) args = {};
            if (!args.data) args.data = {};
            if (operation === 'createMany' && Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({ ...item, tenantId: item.tenantId || tenantId }));
            } else if (typeof args.data === 'object') {
              args.data.tenantId = args.data.tenantId || tenantId;
            }
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
    console.error(`[RLS_VIOLATION] Tenant ${tenantId} tentou acessar registro de ${record.tenantId} em ${modelName || 'model'}`);
    throw new Error('TENANT_MISMATCH: Record does not belong to this tenant');
  }
}

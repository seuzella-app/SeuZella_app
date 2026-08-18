// ═══════════════════════════════════════════════════════════════
// GATEKEEPER DE ENTITLEMENTS — ZÉLLA AIRB
// Validação obrigatória no backend ANTES de qualquer operação
// ═══════════════════════════════════════════════════════════════

import { db, isDatabaseAvailable } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────

export type AirBPlanType = 'airb_lite' | 'airb_pro' | 'airb_max';

export type EntitlementAction =
  | 'CREATE_PROPERTY'
  | 'START_SCRAPING_JOB'
  | 'ACTIVATE_WEBHOOK'
  | 'ACCESS_CONCIERGE_RAG'
  | 'ACCESS_AI_CONVERSATIONS';

export interface EntitlementResult {
  allowed: boolean;
  reason: string | null;
  currentCount: number;
  maxAllowed: number;
  planType: AirBPlanType | null;
  upgradeRequired: boolean;
}

// ── Constants ──────────────────────────────────────────────────

export const PROPERTY_LIMITS: Record<AirBPlanType, { maxProperties: number; maxConcurrentScrapes: number }> = {
  airb_lite: { maxProperties: 2, maxConcurrentScrapes: 1 },
  airb_pro: { maxProperties: 4, maxConcurrentScrapes: 1 },
  airb_max: { maxProperties: 12, maxConcurrentScrapes: 3 },
};

export const FEATURE_GATES: Record<AirBPlanType, {
  conciergeRAG: boolean;
  aiConversations: boolean;
  maxActiveConversations: number;
  prioritySupport: boolean;
}> = {
  airb_lite: { conciergeRAG: true, aiConversations: true, maxActiveConversations: 20, prioritySupport: false },
  airb_pro: { conciergeRAG: true, aiConversations: true, maxActiveConversations: 50, prioritySupport: false },
  airb_max: { conciergeRAG: true, aiConversations: true, maxActiveConversations: 200, prioritySupport: true },
};

// Map tenant plan to AirB plan type
// The tenant might have a Pousada plan (pro/max) — AirB has separate subscription
function resolveAirBPlan(_tenantId: string): AirBPlanType | null {
  // For now, we derive from tenant plan since AirB subscriptions are new
  // In production, this checks AirBSubscription table first
  return null; // Will be resolved in checkEntitlement
}

// ── Main Gatekeeper ────────────────────────────────────────────

export async function checkEntitlement(
  tenantId: string,
  action: EntitlementAction,
  requestedUrl?: string,
  propertyId?: string
): Promise<EntitlementResult> {
  const dbAvailable = await isDatabaseAvailable();
  
  if (!dbAvailable) {
    // In demo mode, allow everything with pro limits
    return {
      allowed: true,
      reason: null,
      currentCount: 0,
      maxAllowed: 4,
      planType: 'airb_pro',
      upgradeRequired: false,
    };
  }

  // ── STEP 1: Check for active AirB subscription ──
  let airbSubscription = await db.airBSubscription.findFirst({
    where: {
      tenantId,
      status: { in: ['active', 'past_due'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── STEP 2: If no AirB subscription, derive from tenant plan ──
  let planType: AirBPlanType;
  if (airbSubscription) {
    planType = airbSubscription.planType as AirBPlanType;
    
    // Check if subscription expired
    if (airbSubscription.currentPeriodEnd && new Date(airbSubscription.currentPeriodEnd) < new Date()) {
      await db.airBSubscription.update({
        where: { id: airbSubscription.id },
        data: { status: 'expired' },
      });
      // Fall through to tenant plan derivation
      airbSubscription = null;
    }
  }

  if (!airbSubscription) {
    // Derive from tenant plan for backwards compatibility
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const tenantPlan = tenant?.plan || 'gratuito';
    
    // Map: max → airb_max, pro → airb_pro, lite → airb_lite, gratuito → airb_lite (demo)
    if (tenantPlan === 'max') {
      planType = 'airb_max';
    } else if (tenantPlan === 'pro') {
      planType = 'airb_pro';
    } else {
      // gratuito/lite/parceiro — allow demo access with lite limits for now
      planType = 'airb_lite';
    }
  } else {
    planType = airbSubscription.planType as AirBPlanType;
  }

  // ── STEP 3: Resolve limits ──
  const limits = PROPERTY_LIMITS[planType];
  const features = FEATURE_GATES[planType];

  if (!limits) {
    return {
      allowed: false,
      reason: 'AIRB_INVALID_PLAN',
      currentCount: 0,
      maxAllowed: 0,
      planType,
      upgradeRequired: true,
    };
  }

  // ── STEP 4: Count active properties ──
  const activePropertyCount = await db.airBProperty.count({
    where: {
      tenantId,
      status: { in: ['active', 'scraping_pending'] },
    },
  });

  // ── STEP 5: Evaluate action ──
  switch (action) {
    case 'CREATE_PROPERTY': {
      if (activePropertyCount >= limits.maxProperties) {
        return {
          allowed: false,
          reason: 'AIRB_PROPERTY_LIMIT_REACHED',
          currentCount: activePropertyCount,
          maxAllowed: limits.maxProperties,
          planType,
          upgradeRequired: planType === 'airb_pro',
        };
      }
      return {
        allowed: true,
        reason: null,
        currentCount: activePropertyCount,
        maxAllowed: limits.maxProperties,
        planType,
        upgradeRequired: false,
      };
    }

    case 'START_SCRAPING_JOB': {
      // Check property limit — scraping creates a property
      if (activePropertyCount >= limits.maxProperties && requestedUrl) {
        // Allow re-scrape of existing property
        const existingProperty = await db.airBProperty.findFirst({
          where: { tenantId, airbnbUrl: requestedUrl },
        });
        if (!existingProperty) {
          return {
            allowed: false,
            reason: 'AIRB_PROPERTY_LIMIT_REACHED',
            currentCount: activePropertyCount,
            maxAllowed: limits.maxProperties,
            planType,
            upgradeRequired: planType === 'airb_pro',
          };
        }
      }

      // Check concurrent scrape limit
      const runningScrapes = await db.airBScrapingJob.count({
        where: {
          tenantId,
          status: { in: ['queued', 'running'] },
        },
      });
      if (runningScrapes >= limits.maxConcurrentScrapes) {
        return {
          allowed: false,
          reason: 'AIRB_CONCURRENT_SCRAPE_LIMIT',
          currentCount: runningScrapes,
          maxAllowed: limits.maxConcurrentScrapes,
          planType,
          upgradeRequired: false,
        };
      }

      // Check rate limit (max 10/hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentScrapes = await db.airBScrapingJob.count({
        where: {
          tenantId,
          createdAt: { gte: oneHourAgo },
        },
      });
      if (recentScrapes >= 10) {
        return {
          allowed: false,
          reason: 'AIRB_SCRAPE_RATE_LIMIT',
          currentCount: recentScrapes,
          maxAllowed: 10,
          planType,
          upgradeRequired: false,
        };
      }

      return {
        allowed: true,
        reason: null,
        currentCount: activePropertyCount,
        maxAllowed: limits.maxProperties,
        planType,
        upgradeRequired: false,
      };
    }

    case 'ACTIVATE_WEBHOOK': {
      if (!propertyId) {
        return {
          allowed: false,
          reason: 'AIRB_PROPERTY_ID_REQUIRED',
          currentCount: activePropertyCount,
          maxAllowed: limits.maxProperties,
          planType,
          upgradeRequired: false,
        };
      }
      const property = await db.airBProperty.findFirst({
        where: { id: propertyId, tenantId },
      });
      if (!property) {
        return {
          allowed: false,
          reason: 'AIRB_PROPERTY_NOT_FOUND',
          currentCount: activePropertyCount,
          maxAllowed: limits.maxProperties,
          planType,
          upgradeRequired: false,
        };
      }
      if (property.status !== 'active') {
        return {
          allowed: false,
          reason: 'AIRB_PROPERTY_NOT_ACTIVE',
          currentCount: activePropertyCount,
          maxAllowed: limits.maxProperties,
          planType,
          upgradeRequired: false,
        };
      }
      return {
        allowed: true,
        reason: null,
        currentCount: activePropertyCount,
        maxAllowed: limits.maxProperties,
        planType,
        upgradeRequired: false,
      };
    }

    case 'ACCESS_CONCIERGE_RAG': {
      if (!features.conciergeRAG) {
        return {
          allowed: false,
          reason: 'AIRB_RAG_NOT_AVAILABLE',
          currentCount: 0,
          maxAllowed: 0,
          planType,
          upgradeRequired: true,
        };
      }
      return {
        allowed: true,
        reason: null,
        currentCount: 0,
        maxAllowed: features.maxActiveConversations,
        planType,
        upgradeRequired: false,
      };
    }

    case 'ACCESS_AI_CONVERSATIONS': {
      if (!features.aiConversations) {
        return {
          allowed: false,
          reason: 'AIRB_AI_CONVERSATIONS_NOT_AVAILABLE',
          currentCount: 0,
          maxAllowed: 0,
          planType,
          upgradeRequired: true,
        };
      }
      const activeConversations = await db.airBConversation.count({
        where: { tenantId, status: 'active' },
      });
      if (activeConversations >= features.maxActiveConversations) {
        return {
          allowed: false,
          reason: 'AIRB_CONVERSATION_LIMIT_REACHED',
          currentCount: activeConversations,
          maxAllowed: features.maxActiveConversations,
          planType,
          upgradeRequired: planType === 'airb_pro',
        };
      }
      return {
        allowed: true,
        reason: null,
        currentCount: activeConversations,
        maxAllowed: features.maxActiveConversations,
        planType,
        upgradeRequired: false,
      };
    }

    default:
      return {
        allowed: false,
        reason: 'AIRB_UNKNOWN_ACTION',
        currentCount: 0,
        maxAllowed: 0,
        planType,
        upgradeRequired: false,
      };
  }
}

// ── PIX Gate ───────────────────────────────────────────────────

export type PlatformContext = 'airbnb_app' | 'airbnb_web' | 'direct' | 'whatsapp' | 'unknown';

export function isPixAllowed(platformContext: PlatformContext, mode: 'pre_booking' | 'post_booking'): boolean {
  switch (platformContext) {
    case 'airbnb_app':
    case 'airbnb_web':
      return false; // NEVER allow PIX in Airbnb context
    case 'direct':
      return mode === 'pre_booking';
    case 'whatsapp':
      return mode === 'pre_booking';
    case 'unknown':
    default:
      return false; // Conservative: block if unknown
  }
}

// ── Post-Processing Filter for PIX ─────────────────────────────

const PIX_PATTERNS = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, // CPF pattern (common in PIX keys)
  /\bchave\s*pix\b/gi,
  /\bpix\b.*\bchave\b/gi,
  /\bqr\s*code\s*pix\b/gi,
  /\bR\$\s*\d+[,\.]\d{2}\b.*\bpix\b/gi,
  /\bpagamento\s*(via|por|com)\s*pix\b/gi,
  /\btransfer[êe]ncia\s*banc[áa]ria\b/gi,
  /\bdados\s*banc[áa]rios\b/gi,
  /\bchave:\s*\w+/gi,
];

export function filterPixFromResponse(content: string, platformContext: PlatformContext): string {
  if (platformContext !== 'airbnb_app' && platformContext !== 'airbnb_web') {
    return content; // No filtering needed
  }

  let filtered = content;
  for (const pattern of PIX_PATTERNS) {
    filtered = filtered.replace(pattern, '[informação removida por política de segurança]');
  }
  return filtered;
}

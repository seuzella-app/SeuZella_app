import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { migratePlanLegacy } from '@/lib/plan-features';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

type TenantNiche = 'pousada' | 'airbnb';

const POUSADA_TYPES = ['pousada', 'hotel', 'hostel', 'chalé', 'resort'];

const PLAN_PRICING: Record<string, number> = {
  gratuito: 0,
  lite: 197,
  pro: 397,
  max: 797,
  parceiro: 247,
  // Legacy keys (for old DB values)
  trial: 0,
  starter: 147,
  business: 597,
  airb_pro: 397,
  airb_max: 797,
};

function determineNiche(plan: string, propertyType?: string): TenantNiche {
  if (propertyType === 'airbnb') return 'airbnb';
  if (POUSADA_TYPES.includes(propertyType || '')) return 'pousada';
  // Fallback: if they have Airbnb subscriptions, they're airbnb
  return 'pousada';
}

export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.tenants', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.tenants', what: 'zcc.tenants.entry', resource: 'api', result: 'ALLOW' });
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const nicheFilter = searchParams.get('niche') as TenantNiche | null;
    const searchFilter = searchParams.get('search')?.trim().toLowerCase() || '';
    const planFilter = searchParams.get('plan')?.trim().toLowerCase() || '';

    // ── Fetch all tenants with related data ──────────────────────
    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        createdAt: true,
        subscriptionAt: true,
        property: {
          select: {
            type: true,
            city: true,
            state: true,
          },
        },
        airbSubscriptions: {
          where: { status: 'active' },
          select: { amount: true, planType: true, currentPropertyCount: true, status: true },
        },
        subscriptions: {
          where: { status: 'active' },
          select: { amount: true, planType: true, status: true },
        },
        _count: {
          select: {
            reservations: true,
            agentLogs: true,
            guests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Enrich each tenant ───────────────────────────────────────
    const enriched = await Promise.all(
      tenants.map(async (tenant) => {
        const propertyType = tenant.property?.type;
        const niche = determineNiche(tenant.plan, propertyType);

        // Determine plan price
        const migratedPlan = migratePlanLegacy(tenant.plan || '');
        let planPrice = PLAN_PRICING[migratedPlan] ?? PLAN_PRICING[tenant.plan] ?? 0;
        if (niche === 'airbnb' && tenant.airbSubscriptions.length > 0) {
          planPrice = tenant.airbSubscriptions[0].amount;
        }
        const activeSub = tenant.subscriptions.find(s => s.status === 'active');
        if (activeSub) {
          planPrice = activeSub.amount;
        }

        // Revenue
        let revenue = 0;
        try {
          const txResult = await db.transaction.aggregate({
            where: {
              tenantId: tenant.id,
              type: 'PAYMENT',
              status: 'COMPLETED',
            },
            _sum: { amount: true },
          });
          revenue = txResult._sum.amount ?? 0;
        } catch {
          revenue = 0;
        }

        // AI messages processed
        let aiMessagesProcessed = 0;
        try {
          aiMessagesProcessed = await db.agentLog.count({
            where: { tenantId: tenant.id, status: 'success' },
          });
        } catch {
          aiMessagesProcessed = 0;
        }

        // Conversion rate (guests booked / total guests)
        let conversionRate = 0;
        try {
          const totalGuests = tenant._count.guests;
          const bookedGuests = await db.guest.count({
            where: { tenantId: tenant.id, status: { in: ['booked', 'staying', 'checked_out'] } },
          });
          conversionRate = totalGuests > 0 ? Math.round((bookedGuests / totalGuests) * 100) : 0;
        } catch {
          conversionRate = 0;
        }

        // Brain accuracy (mock placeholder based on plan)
        const brainAccuracy =
          migratedPlan === 'max' ? 96 :
          migratedPlan === 'pro' ? 91 :
          migratedPlan === 'lite' ? 85 :
          migratedPlan === 'parceiro' ? 80 :
          78;

        // LGPD: derive ownerInitials from name, no raw email/phone
        const ownerInitials = (tenant.name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const region = (tenant.property?.city && tenant.property?.state) ? `${tenant.property.city} — ${tenant.property.state}` : 'N/A';

        return {
          id: tenant.id,
          name: tenant.name,
          niche,
          plan: migratedPlan,
          planPrice,
          status: tenant.status,
          city: tenant.property?.city ?? '',
          state: tenant.property?.state ?? '',
          ownerInitials,
          region,
          revenue,
          aiMessagesProcessed,
          conversionRate,
          brainAccuracy,
          brainStatus: tenant.status === 'active' ? 'learning' : 'paused',
          killSwitchActive: tenant.status === 'suspended',
        };
      })
    );

    // ── Apply filters ────────────────────────────────────────────
    let filtered = enriched;

    if (nicheFilter) {
      filtered = filtered.filter(t => t.niche === nicheFilter);
    }
    if (searchFilter) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchFilter) ||
        t.ownerInitials.toLowerCase().includes(searchFilter) ||
        t.city.toLowerCase().includes(searchFilter)
      );
    }
    if (planFilter) {
      filtered = filtered.filter(t => t.plan.toLowerCase() === planFilter);
    }

    return NextResponse.json({
      success: true,
      data: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error('[ZCC Tenants] Error:', error);
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  }
}

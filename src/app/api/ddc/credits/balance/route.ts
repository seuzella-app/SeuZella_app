import { NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getCreditBalance } from '@/lib/credits/engine';
import type { PlanTier } from '@/lib/plan-features';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      // Demo mode: return mock data without tenant
      const balance = await getCreditBalance('demo-tenant', 'pro');
      return NextResponse.json({ data: balance, demo: true });
    }

    // Para demo: assumir PRO se não temos como ler o plano do tenant em Vercel
    // Em produção com PostgreSQL, isso viria do tenant row
    const plan = (process.env.DEMO_PLAN as PlanTier) || 'pro';
    const balance = await getCreditBalance(tenantId, plan);
    return NextResponse.json({ data: balance });
  } catch (err) {
    console.error('[/api/ddc/credits/balance] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

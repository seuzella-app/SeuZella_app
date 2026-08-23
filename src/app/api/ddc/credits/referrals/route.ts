import { NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { listReferrals } from '@/lib/credits/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      const referrals = await listReferrals('demo-tenant');
      return NextResponse.json({ data: referrals, demo: true });
    }
    const referrals = await listReferrals(tenantId);
    return NextResponse.json({ data: referrals });
  } catch (err) {
    console.error('[/api/ddc/credits/referrals] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

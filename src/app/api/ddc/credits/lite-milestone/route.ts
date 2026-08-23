import { NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getLiteMilestone } from '@/lib/credits/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      const ms = await getLiteMilestone('demo-tenant');
      return NextResponse.json({ data: ms, demo: true });
    }
    const ms = await getLiteMilestone(tenantId);
    return NextResponse.json({ data: ms });
  } catch (err) {
    console.error('[/api/ddc/credits/lite-milestone] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

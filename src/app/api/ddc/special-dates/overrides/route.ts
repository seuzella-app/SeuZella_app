import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';

async function getHandler(_request: NextRequest) {
  try {
    const tenantId = await requireTenant();
    const overrides = await (db as any).priceOverride.findMany({
      where: { tenantId, status: 'active' },
      include: { suggestion: { include: { specialDate: true } } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(overrides);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or invalid tenant' }, { status: 401 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'ddc-special-dates-overrides' });

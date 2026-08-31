import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      tenantId = await requireTenant();
    }

    const badgeStatus = await PartnerProgramService.getBadgeStatus(tenantId);
    return NextResponse.json(badgeStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json({ isPartner: false, badge: null, label: null }, { status: 200 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'partner-program-badge' });

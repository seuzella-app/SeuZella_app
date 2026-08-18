import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { createReferralCode } from '@/lib/credits/engine';
import type { ReferralChannel } from '@/lib/credits/rules';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_CHANNELS: ReferralChannel[] = ['linkinbio', 'email', 'whatsapp', 'manual'];

export async function POST(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const channel = body?.channel as ReferralChannel;
    const label = body?.label as string | undefined;

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'INVALID_CHANNEL', channels: VALID_CHANNELS }, { status: 400 });
    }
    if (label && (typeof label !== 'string' || label.length > 100)) {
      return NextResponse.json({ error: 'INVALID_LABEL' }, { status: 400 });
    }

    const result = await createReferralCode(tenantId, channel, label);
    if (!result) {
      return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[/api/ddc/credits/create-code] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

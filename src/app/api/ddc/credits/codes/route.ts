import { NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { listReferralCodes } from '@/lib/credits/engine';

export const dynamic = 'force-dynamic';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === 'production') return 'https://seuzella.com';
  return 'http://localhost:3000';
}

export async function GET() {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      const baseUrl = getBaseUrl();
      const codes = await listReferralCodes('demo-tenant', baseUrl);
      return NextResponse.json({ data: codes, demo: true });
    }

    const baseUrl = getBaseUrl();
    const codes = await listReferralCodes(tenantId, baseUrl);
    return NextResponse.json({ data: codes });
  } catch (err) {
    console.error('[/api/ddc/credits/codes] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

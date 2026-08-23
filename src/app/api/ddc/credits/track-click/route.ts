import { NextRequest, NextResponse } from 'next/server';
import { registerClick } from '@/lib/credits/engine';

export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return req.headers.get('cf-connecting-ip') || '0.0.0.0';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = body?.code as string;

    if (!code || typeof code !== 'string' || code.length > 32) {
      return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    }

    const result = await registerClick({
      code,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') || '',
      acceptLanguage: req.headers.get('accept-language') || '',
      referrer: req.headers.get('referer') || undefined,
      utmSource: body?.utmSource,
      utmCampaign: body?.utmCampaign,
      country: req.headers.get('cf-ipcountry') || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.reason || 'TRACK_FAILED' }, { status: 400 });
    }

    return NextResponse.json({ data: { clickId: result.clickId, ok: true } });
  } catch (err) {
    console.error('[/api/ddc/credits/track-click] error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

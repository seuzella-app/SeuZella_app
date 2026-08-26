import { NextRequest, NextResponse } from 'next/server';
import { registerClick } from '@/lib/credits/engine';
import { TRACKING_COOKIE_MAX_AGE_DAYS } from '@/lib/credits/rules';

interface RouteParams {
  params: Promise<{ code: string }>;
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === 'production') return 'https://seuzella.com';
  return 'http://localhost:3000';
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return req.headers.get('cf-connecting-ip') || '0.0.0.0';
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const url = req.nextUrl.clone();
  const {searchParams} = url;
  const channel = searchParams.get('ch') || 'linkinbio';
  const emailToken = searchParams.get('e');

  // Sanitiza o código (alfanumérico, máx 32 chars)
  const cleanCode = code.replace(/[^A-Za-z0-9]/g, '').slice(0, 32);

  if (!cleanCode) {
    return NextResponse.redirect(new URL('/', getBaseUrl()));
  }

  // Registra o clique (anti-fraude aplicado dentro do engine)
  try {
    await registerClick({
      code: cleanCode,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') || '',
      acceptLanguage: req.headers.get('accept-language') || '',
      referrer: req.headers.get('referer') || undefined,
      utmSource: searchParams.get('utm_source') || undefined,
      utmCampaign: searchParams.get('utm_campaign') || undefined,
      country: req.headers.get('cf-ipcountry') || undefined,
    });
  } catch (err) {
    console.error('[/r/[code]] registerClick error:', err);
    // Não bloqueia o redirect por erro de tracking
  }

  // Monta URL de destino com parâmetros preservados
  const target = new URL('/', getBaseUrl());
  // Sinaliza para a LP que veio de indicação (LP pode mostrar CTA personalizado)
  target.searchParams.set('ref', cleanCode);
  if (channel !== 'linkinbio') target.searchParams.set('rch', channel);
  if (emailToken) target.searchParams.set('re', emailToken);

  // Cria resposta com cookie de rastreamento (90 dias)
  const response = NextResponse.redirect(target);
  response.cookies.set('zella_ref', cleanCode, {
    httpOnly: false, // precisa ser legível no client para mostrar CTA
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TRACKING_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  });
  if (channel !== 'linkinbio') {
    response.cookies.set('zella_rch', channel, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TRACKING_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    });
  }

  return response;
}

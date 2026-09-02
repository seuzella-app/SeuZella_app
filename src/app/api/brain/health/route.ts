import { NextRequest, NextResponse } from 'next/server';
import { getBrainHealth } from '@/lib/brain-health';
import { apiRatelimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    // Wave B IDOR fix: tenantId from session, not query param
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;
    const data = await getBrainHealth(tenantId);
    return NextResponse.json(data, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch brain health' }, { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  }
}
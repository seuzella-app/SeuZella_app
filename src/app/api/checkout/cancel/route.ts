import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const {searchParams} = request.nextUrl;
    const subscriptionId = searchParams.get('subscription_id');

    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) return createError(401, 'UNAUTHORIZED', 'Faça login primeiro');
    const { success: allowed } = await authRatelimit.limit(session.user.tenantId);
    if (!allowed) return createError(429, 'RATE_LIMITED', 'Muitas requisições');

    if (subscriptionId) {
      const subscription = await db.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (subscription && subscription.tenantId !== session.user.tenantId) {
        return createError(403, 'FORBIDDEN', 'Esta assinatura não pertence à sua conta');
      }
    }

    return NextResponse.redirect(
      new URL('/?payment=cancelled', request.url)
    );
  } catch (error) {
    console.error('Checkout cancel error:', error);
    return createError(500, 'CANCEL_FAILED', 'Falha ao cancelar checkout');
  }
}
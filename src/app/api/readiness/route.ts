import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable, db } from '@/lib/db';
import { isPushEnabled } from '@/lib/push/push-service';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { assertProductionSecurityEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const checks: Array<{ name: string; passed: boolean; required: boolean; hint: string }> = [];

  checks.push({ name: 'NEXTAUTH_SECRET', passed: !!process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32, required: true, hint: 'Generate: openssl rand -base64 32 (≥32 chars)' });
  checks.push({ name: 'NEXTAUTH_URL', passed: !!process.env.NEXTAUTH_URL, required: true, hint: 'Set to production URL' });
  checks.push({ name: 'DATABASE_URL', passed: !!process.env.DATABASE_URL, required: true, hint: 'PostgreSQL connection string' });
  checks.push({ name: 'ZEHLA_MASTER_ADMIN_EMAIL', passed: !!process.env.ZEHLA_MASTER_ADMIN_EMAIL, required: true, hint: 'Corporate admin email' });
  checks.push({ name: 'ZEHLA_MASTER_ADMIN_PASSWORD', passed: !!process.env.ZEHLA_MASTER_ADMIN_PASSWORD && process.env.ZEHLA_MASTER_ADMIN_PASSWORD.length >= 12, required: true, hint: '≥12 chars' });
  checks.push({ name: 'ZCC_ADMIN_EMAILS', passed: !!process.env.ZCC_ADMIN_EMAILS, required: true, hint: 'CSV of admin emails' });
  checks.push({ name: 'ALEXA_JWT_SECRET', passed: !!process.env.ALEXA_JWT_SECRET && process.env.ALEXA_JWT_SECRET.length >= 32, required: true, hint: 'HS256 secret' });
  checks.push({ name: 'ENCRYPTION_SECRET', passed: !!process.env.ENCRYPTION_SECRET, required: true, hint: 'AES-256-GCM secret' });
  checks.push({ name: 'REDIS_URL', passed: !!process.env.REDIS_URL, required: false, hint: 'Upstash Redis for multi-instance sync' });
  checks.push({ name: 'Realtime transport', passed: getActiveTransport() === 'redis', required: false, hint: 'Set REDIS_URL for multi-instance transport' });
  checks.push({ name: 'VAPID_PUBLIC_KEY', passed: !!process.env.VAPID_PUBLIC_KEY, required: false, hint: 'Generate web-push VAPID keys' });
  checks.push({ name: 'VAPID_PRIVATE_KEY', passed: !!process.env.VAPID_PRIVATE_KEY, required: false, hint: 'Private VAPID key' });
  checks.push({ name: 'Push enabled', passed: isPushEnabled(), required: false, hint: 'Both VAPID keys must be set' });

  const hasAsaas = !!process.env.ASAAS_API_KEY || !!process.env.ASAAS_ACCESS_TOKEN;
  const hasMP = !!process.env.MERCADOPAGO_ACCESS_TOKEN || !!process.env.MP_ACCESS_TOKEN;
  checks.push({ name: 'Payment gateway (Asaas|Mercado Pago)', passed: hasAsaas || hasMP, required: true, hint: 'Configure at least one: ASAAS_ACCESS_TOKEN or MP_ACCESS_TOKEN' });
  checks.push({ name: 'Asaas webhook secret', passed: !hasAsaas || !!process.env.ASAAS_WEBHOOK_SECRET, required: hasAsaas, hint: 'Required when Asaas is configured' });
  checks.push({ name: 'Mercado Pago webhook secret', passed: !hasMP || !!(process.env.PAYMENT_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET), required: hasMP, hint: 'Required when Mercado Pago is configured' });

  let prodSecurityPassed = true;
  let prodSecurityHint = 'Production security environment assertion passed';
  try {
    assertProductionSecurityEnv();
  } catch (err: unknown) {
    prodSecurityPassed = false;
    prodSecurityHint = err instanceof Error ? err.message : 'Failed production security env assertion';
  }
  checks.push({
    name: 'assertProductionSecurityEnv',
    passed: prodSecurityPassed,
    required: process.env.NODE_ENV === 'production',
    hint: prodSecurityHint,
  });

  checks.push({ name: 'WHATSAPP_TOKEN', passed: !!process.env.WHATSAPP_TOKEN, required: false, hint: 'Meta WhatsApp Business API token' });
  checks.push({ name: 'META_APP_SECRET', passed: !!process.env.META_APP_SECRET, required: false, hint: 'Meta app secret for webhook HMAC verification' });

  let dbAvailable = false;
  let dbLatency: number | undefined;
  try {
    const start = Date.now();
    dbAvailable = await isDatabaseAvailable();
    if (dbAvailable) {
      await db.tenant.count({ take: 1 }).catch(() => {});
      dbLatency = Date.now() - start;
    }
  } catch {
    dbAvailable = false;
  }
  checks.push({ name: 'Database connection', passed: dbAvailable, required: true, hint: dbAvailable ? `Connected (${dbLatency}ms)` : 'Cannot connect to DATABASE_URL' });
  checks.push({ name: 'BullMQ (Redis)', passed: isBullMQAvailable(), required: false, hint: 'Requires REDIS_URL' });

  const requiredChecks = checks.filter(c => c.required);
  const failedRequired = requiredChecks.filter(c => !c.passed);
  const allPassed = failedRequired.length === 0;

  return NextResponse.json({
    status: allPassed ? 'ready' : 'not_ready',
    summary: { total: checks.length, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, requiredFailed: failedRequired.length },
    checks,
    timestamp: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
  }, { status: allPassed ? 200 : 503, headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
}

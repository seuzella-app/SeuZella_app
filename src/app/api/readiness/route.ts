import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable, db } from '@/lib/db';
import { isPushEnabled } from '@/lib/push/push-service';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/readiness
 *
 * Production readiness checklist — returns a structured report of all
 * env vars, services, and integrations that MUST be configured for
 * the app to be production-ready.
 *
 * Each check returns { passed: boolean, required: boolean, hint: string }.
 * The endpoint returns 200 if ALL required checks pass, 503 otherwise.
 *
 * SECURITY: returns NO secrets — only boolean flags and env var NAMES
 * (never values). Safe to expose to authenticated admins.
 */
export async function GET(_request: NextRequest) {
  const checks: Array<{
    name: string;
    passed: boolean;
    required: boolean;
    hint: string;
  }> = [];

  // ── Critical env vars ──────────────────────────────────────────────
  checks.push({
    name: 'NEXTAUTH_SECRET',
    passed: !!process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32,
    required: true,
    hint: 'Generate: openssl rand -base64 32 (≥32 chars)',
  });

  checks.push({
    name: 'NEXTAUTH_URL',
    passed: !!process.env.NEXTAUTH_URL,
    required: true,
    hint: 'Set to production URL (e.g. https://smart-hotel-zehla.vercel.app)',
  });

  checks.push({
    name: 'DATABASE_URL',
    passed: !!process.env.DATABASE_URL,
    required: true,
    hint: 'PostgreSQL connection string (Supabase/Neon/Railway)',
  });

  checks.push({
    name: 'ZEHLA_MASTER_ADMIN_EMAIL',
    passed: !!process.env.ZEHLA_MASTER_ADMIN_EMAIL,
    required: true,
    hint: 'Corporate admin email (e.g. admin@seuzella.com)',
  });

  checks.push({
    name: 'ZEHLA_MASTER_ADMIN_PASSWORD',
    passed: !!process.env.ZEHLA_MASTER_ADMIN_PASSWORD && process.env.ZEHLA_MASTER_ADMIN_PASSWORD.length >= 12,
    required: true,
    hint: '≥12 chars, mixed case + digits + symbols',
  });

  checks.push({
    name: 'ZCC_ADMIN_EMAILS',
    passed: !!process.env.ZCC_ADMIN_EMAILS,
    required: true,
    hint: 'CSV of admin emails (e.g. admin@seuzella.com,marciocau14@seuzella.com)',
  });

  // ── Security ──────────────────────────────────────────────────────
  checks.push({
    name: 'ALEXA_JWT_SECRET',
    passed: !!process.env.ALEXA_JWT_SECRET && process.env.ALEXA_JWT_SECRET.length >= 32,
    required: true,
    hint: 'HS256 secret for Alexa JWT verification (distinct from NEXTAUTH_SECRET)',
  });

  checks.push({
    name: 'ENCRYPTION_SECRET',
    passed: !!process.env.ENCRYPTION_SECRET,
    required: true,
    hint: 'AES-256-GCM for PAT vault (≥32 chars)',
  });

  // ── Realtime ──────────────────────────────────────────────────────
  checks.push({
    name: 'REDIS_URL',
    passed: !!process.env.REDIS_URL,
    required: false,
    hint: 'Upstash Redis URL for multi-instance SSE sync (optional but recommended)',
  });

  checks.push({
    name: 'Realtime transport',
    passed: getActiveTransport() === 'redis',
    required: false,
    hint: 'Currently using in-memory (single-instance). Set REDIS_URL for multi-instance.',
  });

  // ── Push notifications ────────────────────────────────────────────
  checks.push({
    name: 'VAPID_PUBLIC_KEY',
    passed: !!process.env.VAPID_PUBLIC_KEY,
    required: false,
    hint: 'Generate: npx web-push generate-vapid-keys',
  });

  checks.push({
    name: 'VAPID_PRIVATE_KEY',
    passed: !!process.env.VAPID_PRIVATE_KEY,
    required: false,
    hint: 'Private key from web-push generate-vapid-keys',
  });

  checks.push({
    name: 'Push enabled',
    passed: isPushEnabled(),
    required: false,
    hint: 'Both VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY must be set',
  });

  // ── Payment gateways (at least one required) ──────────────────────
  const hasAsaas = !!process.env.ASAAS_API_KEY || !!process.env.ASAAS_ACCESS_TOKEN;
  const hasMP = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  checks.push({
    name: 'Payment gateway (Asaas|MP|Stripe)',
    passed: hasAsaas || hasMP || hasStripe,
    required: true,
    hint: 'At least one: ASAAS_API_KEY, MERCADOPAGO_ACCESS_TOKEN, or STRIPE_SECRET_KEY',
  });

  // ── WhatsApp ──────────────────────────────────────────────────────
  checks.push({
    name: 'WHATSAPP_TOKEN',
    passed: !!process.env.WHATSAPP_TOKEN,
    required: false,
    hint: 'Meta WhatsApp Business API token',
  });

  checks.push({
    name: 'META_APP_SECRET',
    passed: !!process.env.META_APP_SECRET,
    required: false,
    hint: 'Meta app secret for webhook HMAC verification',
  });

  // ── Database connectivity ─────────────────────────────────────────
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

  checks.push({
    name: 'Database connection',
    passed: dbAvailable,
    required: true,
    hint: dbAvailable ? `Connected (${dbLatency}ms)` : 'Cannot connect to DATABASE_URL',
  });

  checks.push({
    name: 'BullMQ (Redis)',
    passed: isBullMQAvailable(),
    required: false,
    hint: 'Requires REDIS_URL — workers need Redis for durable queue',
  });

  // ── Compute overall status ────────────────────────────────────────
  const requiredChecks = checks.filter(c => c.required);
  const failedRequired = requiredChecks.filter(c => !c.passed);
  const allPassed = failedRequired.length === 0;

  const response = {
    status: allPassed ? 'ready' : 'not_ready',
    summary: {
      total: checks.length,
      passed: checks.filter(c => c.passed).length,
      failed: checks.filter(c => !c.passed).length,
      requiredFailed: failedRequired.length,
    },
    checks,
    timestamp: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
  };

  return NextResponse.json(response, {
    status: allPassed ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });
}

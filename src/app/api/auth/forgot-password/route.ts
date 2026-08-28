import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isDatabaseAvailable } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.' };
function adminEmails(): Set<string> {
  const configured = process.env.ZCC_ADMIN_EMAILS ? process.env.ZCC_ADMIN_EMAILS.split(',').map(v => v.trim().toLowerCase()).filter(Boolean) : [];
  return new Set(configured);
}
function baseUrl(request: Request): string { return (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, ''); }

async function ensureResetTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "password_reset_tokens" ("id" TEXT NOT NULL PRIMARY KEY, "tenant_id" TEXT NOT NULL, "token_hash" TEXT NOT NULL UNIQUE, "expires_at" TIMESTAMP(3) NOT NULL, "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "password_reset_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "password_reset_tokens_tenant_id_idx" ON "password_reset_tokens"("tenant_id")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at")`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.length > 254) return NextResponse.json(GENERIC_RESPONSE);
    if (!(await isDatabaseAvailable())) return NextResponse.json(GENERIC_RESPONSE);
    await ensureResetTable();

    let tenant = await db.tenant.findUnique({ where: { email } });
    if (!tenant && adminEmails().has(email)) tenant = await db.tenant.create({ data: { email, name: 'Administrador ZCC', role: 'system_admin', plan: 'enterprise', status: 'active' } });
    if (!tenant) return NextResponse.json(GENERIC_RESPONSE);

    await db.$executeRaw`UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "tenant_id" = ${tenant.id} AND "used_at" IS NULL`;
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.$executeRaw`INSERT INTO "password_reset_tokens" ("id", "tenant_id", "token_hash", "expires_at") VALUES (${tokenId}, ${tenant.id}, ${tokenHash}, ${expiresAt})`;

    const resetUrl = `${baseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
    const result = await sendEmail({
      to: email,
      subject: 'Redefina sua senha — Zélla',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#111827"><h1 style="color:#047857">Redefinição de senha</h1><p>Recebemos uma solicitação para criar uma nova senha para sua conta Zélla.</p><p style="text-align:center;margin:24px 0"><a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700">Criar nova senha</a></p><p>Este link expira em <strong>30 minutos</strong> e pode ser usado uma única vez.</p><p style="font-size:12px;color:#6b7280">Se você não solicitou esta alteração, ignore este e-mail. Nenhuma senha será alterada.</p></div>`,
      text: `Redefina sua senha Zélla: ${resetUrl}\n\nO link expira em 30 minutos e pode ser usado uma única vez.`,
      tags: ['auth', 'password-reset'],
    });
    if (!result.success && process.env.NODE_ENV === 'production') console.error('[auth] password reset email failed', result.error);
    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('[auth] forgot-password failure', error);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}

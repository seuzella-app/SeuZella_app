import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBaseUrl(request: Request): string {
  return (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, '');
}

async function ensureResetTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "password_reset_tokens" ("id" TEXT NOT NULL PRIMARY KEY, "tenant_id" TEXT NOT NULL, "token_hash" TEXT NOT NULL UNIQUE, "expires_at" TIMESTAMP(3) NOT NULL, "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "password_reset_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "password_reset_tokens_tenant_id_idx" ON "password_reset_tokens"("tenant_id")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at")`);
}

/** POST /api/auth/magic-link — creates and actually sends a one-time setup link. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    if (!(await isDatabaseAvailable())) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 });
    if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Serviço de e-mail não está configurado em produção.' }, { status: 503 });
    }

    let tenant = await db.tenant.findUnique({ where: { email } });
    const adminEmails = new Set((process.env.ZCC_ADMIN_EMAILS || 'marciocau14@gmail.com').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
    if (!tenant && adminEmails.has(email)) {
      tenant = await db.tenant.create({ data: { name: 'Administrador ZCC', email, role: 'system_admin', plan: 'enterprise', status: 'active', niche: 'pousada' } });
    }
    if (!tenant) return NextResponse.json({ error: 'E-mail não cadastrado. Use Criar conta primeiro.' }, { status: 404 });
    if (tenant.status !== 'active') return NextResponse.json({ error: 'Conta inativa.' }, { status: 403 });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({ data: { identifier: email, token: hashToken(token), expires } });

    const magicUrl = `${getBaseUrl(request)}/api/auth/magic-link?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const result = await sendEmail({
      to: email,
      subject: 'Configure seu acesso ao ZCC — Zélla',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#111827"><h1 style="color:#047857">Configure seu acesso</h1><p>Recebemos uma solicitação para configurar seu acesso administrativo ao ZCC.</p><p style="text-align:center;margin:24px 0"><a href="${magicUrl}" style="display:inline-block;background:#059669;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700">Configurar minha senha</a></p><p>Este link expira em <strong>10 minutos</strong> e pode ser usado uma única vez.</p><p style="font-size:12px;color:#6b7280">Se você não solicitou este acesso, ignore este e-mail.</p></div>`,
      text: `Configure seu acesso ao ZCC Zélla: ${magicUrl}\n\nO link expira em 10 minutos e pode ser usado uma única vez.`,
      tags: ['auth', 'zcc-setup'],
    });

    if (!result.success) {
      await db.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => undefined);
      console.error('[Magic Link] Email delivery failed', { email: '[REDACTED]', error: result.error });
      return NextResponse.json({ error: 'Não foi possível enviar o e-mail de autenticação. Verifique a configuração de e-mail de produção.' }, { status: 503 });
    }

    return NextResponse.json({ success: true, message: 'E-mail de configuração enviado. Verifique sua caixa de entrada.' });
  } catch (error) {
    console.error('[Magic Link] Error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** GET /api/auth/magic-link — consumes the setup token and issues a password-reset token. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email')?.trim().toLowerCase();
    if (!token || !email || token.length !== 64) return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
    if (!(await isDatabaseAvailable())) return NextResponse.redirect(new URL('/login?error=service-unavailable', request.url));

    const verificationToken = await db.verificationToken.findUnique({ where: { token: hashToken(token) } });
    if (!verificationToken || verificationToken.identifier !== email) return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
    if (verificationToken.expires < new Date()) {
      await db.verificationToken.delete({ where: { identifier_token: { identifier: email, token: verificationToken.token } } }).catch(() => undefined);
      return NextResponse.redirect(new URL('/login?error=token-expired', request.url));
    }

    const tenant = await db.tenant.findUnique({ where: { email } });
    if (!tenant || tenant.status !== 'active') return NextResponse.redirect(new URL('/login?error=account-inactive', request.url));

    await ensureResetTable();
    const resetToken = crypto.randomBytes(32).toString('base64url');
    const resetHash = hashToken(resetToken);
    const resetId = crypto.randomUUID();
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await db.$executeRaw`UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "tenant_id" = ${tenant.id} AND "used_at" IS NULL`;
    await db.$executeRaw`INSERT INTO "password_reset_tokens" ("id", "tenant_id", "token_hash", "expires_at") VALUES (${resetId}, ${tenant.id}, ${resetHash}, ${resetExpires})`;
    await db.verificationToken.delete({ where: { identifier_token: { identifier: email, token: verificationToken.token } } });

    return NextResponse.redirect(new URL(`/reset-password?token=${encodeURIComponent(resetToken)}`, getBaseUrl(request)));
  } catch (error) {
    console.error('[Magic Link] Verification error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.redirect(new URL('/login?error=internal-error', request.url));
  }
}

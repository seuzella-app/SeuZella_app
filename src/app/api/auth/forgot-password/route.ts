import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isDatabaseAvailable } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = {
  ok: true,
  message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.'
};

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ZCC_ADMIN_EMAILS || 'marciocau14@gmail.com')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

function baseUrl(request: Request): string {
  return (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.length > 254) return NextResponse.json(GENERIC_RESPONSE);
    if (!(await isDatabaseAvailable())) return NextResponse.json(GENERIC_RESPONSE);

    // Generic response prevents account enumeration.
    let tenant = await db.tenant.findUnique({ where: { email } });

    // The configured ZCC administrator may bootstrap the credential account
    // through verified mailbox ownership if the tenant row does not exist yet.
    if (!tenant && adminEmails().has(email)) {
      tenant = await db.tenant.create({
        data: {
          email,
          name: 'Administrador ZCC',
          role: 'system_admin',
          plan: 'enterprise',
          status: 'active',
        },
      });
    }

    if (!tenant) return NextResponse.json(GENERIC_RESPONSE);

    // Invalidate previous active tokens for this account.
    await db.$executeRaw`UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "tenant_id" = ${tenant.id} AND "used_at" IS NULL`;

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.$executeRaw`
      INSERT INTO "password_reset_tokens" ("id", "tenant_id", "token_hash", "expires_at")
      VALUES (${tokenId}, ${tenant.id}, ${tokenHash}, ${expiresAt})
    `;

    const resetUrl = `${baseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
    const result = await sendEmail({
      to: email,
      subject: 'Redefina sua senha — Zélla',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#111827">
          <h1 style="margin:0 0 12px;color:#047857">Redefinição de senha</h1>
          <p>Recebemos uma solicitação para criar uma nova senha para sua conta Zélla.</p>
          <p style="margin:24px 0;text-align:center">
            <a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700">Criar nova senha</a>
          </p>
          <p>Este link expira em <strong>30 minutos</strong> e pode ser usado uma única vez.</p>
          <p style="font-size:12px;color:#6b7280">Se você não solicitou esta alteração, ignore este e-mail. Nenhuma senha será alterada.</p>
        </div>
      `,
      text: `Redefina sua senha Zélla: ${resetUrl}\n\nO link expira em 30 minutos e pode ser usado uma única vez.`,
      tags: ['auth', 'password-reset'],
    });

    if (!result.success && process.env.NODE_ENV === 'production') {
      console.error('[auth] password reset email failed', result.error);
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('[auth] forgot-password failure', error);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}

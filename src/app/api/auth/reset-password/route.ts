import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, isDatabaseAvailable } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

async function ensureResetTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tenant_id" TEXT NOT NULL,
      "token_hash" TEXT NOT NULL UNIQUE,
      "expires_at" TIMESTAMP(3) NOT NULL,
      "used_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "password_reset_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_tenant_id_idx" ON "password_reset_tokens"("tenant_id");
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");
  `);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const password = body.password;
    const confirmPassword = body.confirmPassword;
    if (!token || token.length < 32 || !validPassword(password) || password !== confirmPassword) return NextResponse.json({ error: 'Token inválido ou senha fora dos requisitos.' }, { status: 400 });
    if (!(await isDatabaseAvailable())) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

    await ensureResetTable();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await db.$queryRaw<Array<{ id: string; tenant_id: string; expires_at: Date; used_at: Date | null }>>`
      SELECT "id", "tenant_id", "expires_at", "used_at" FROM "password_reset_tokens" WHERE "token_hash" = ${tokenHash} LIMIT 1
    `;
    const reset = rows[0];
    if (!reset || reset.used_at || new Date(reset.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: 'Link inválido, expirado ou já utilizado.' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction(async tx => {
      await tx.tenant.update({ where: { id: reset.tenant_id }, data: { passwordHash, status: 'active' } });
      await tx.$executeRaw`UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "id" = ${reset.id} AND "used_at" IS NULL`;
      await tx.$executeRaw`UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "tenant_id" = ${reset.tenant_id} AND "used_at" IS NULL`;
    });
    return NextResponse.json({ ok: true, message: 'Senha alterada com sucesso. Agora você já pode entrar no ZCC.' });
  } catch (error) {
    console.error('[auth] reset-password failure', error);
    return NextResponse.json({ error: 'Não foi possível alterar a senha.' }, { status: 500 });
  }
}

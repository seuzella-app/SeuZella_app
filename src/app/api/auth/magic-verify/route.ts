import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/magic-verify
 * Called when a user clicks a magic link and is redirected to the login page.
 * Sets a temporary password on the tenant so they can sign in via credentials.
 * Returns the temp password for the frontend to use with signIn('credentials').
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 });
    }

    // Find the tenant
    const tenant = await db.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Generate a temporary password using CSPRNG (not Math.random)
    import { randomInt } from 'crypto';
    const randomPart = Array.from({ length: 8 }, () => randomInt(0, 36).toString(36)).join('');
    const tempPassword = `magic_${Date.now()}_${randomPart}`;
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);

    // Update the tenant's password hash
    await db.tenant.update({
      where: { id: tenant.id },
      data: { passwordHash: tempPasswordHash },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Magic Verify] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

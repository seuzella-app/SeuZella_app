// =============================================================================
// API — Onboarding
// =============================================================================
// POST /api/onboarding — Completa o onboarding do tenant
// GET  /api/onboarding — Verifica status do onboarding
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst({ where: { status: 'active' } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      onboardingComplete: true,
      mode: tenant.niche,
      planSlug: tenant.plan,
      name: tenant.name,
    });
  } catch (error) {
    console.error('[api/onboarding] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, planSlug, name, email, password } = body as {
      mode: 'pousada' | 'airbnb';
      planSlug: 'pro' | 'max';
      name: string;
      email: string;
      password?: string;
    };

    if (!mode || !planSlug || !name || !email) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: mode, planSlug, name, email' },
        { status: 400 }
      );
    }

    if (!['pousada', 'airbnb'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode deve ser "pousada" ou "airbnb"' },
        { status: 400 }
      );
    }

    if (!['pro', 'max'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'PlanSlug deve ser "pro" ou "max"' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const cleanEmail = email.trim().toLowerCase();

      // RUN 6 — tenant authority (P0):
      // ANTES: um POST anônimo com o email de uma vítima reescrevia o tenant
      // dela (name/niche/plan — escalada de plano gratuita) ou conectava a
      // conta da vítima a um tenant novo criado pelo atacante (squatting).
      // AGORA: (1) usuário que já possui tenant → conflito, sem mutação;
      // (2) usuário sem tenant → somente o próprio principal autenticado
      // (fluxo pós-Google-signup, que carrega a sessão recém-criada) pode
      // criar e conectar um novo tenant.
      const existingTenant = await db.tenant.findFirst({
        where: { users: { some: { id: existingUser.id } } },
      });
      if (existingTenant) {
        return NextResponse.json(
          { error: 'ONBOARDING_ALREADY_COMPLETED', message: 'Onboarding já concluído para esta conta.' },
          { status: 409 }
        );
      }

      const session = await getServerSession(authOptions);
      const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
      if (!session || sessionEmail !== cleanEmail) {
        return NextResponse.json(
          { error: 'USER_EXISTS_AUTH_REQUIRED', message: 'Conta existente: autentique-se para concluir o onboarding.' },
          { status: 403 }
        );
      }

      // Create tenant for the authenticated existing user
      const tenant = await db.tenant.create({
        data: {
          name,
          niche: mode,
          plan: planSlug,
          users: { connect: { id: existingUser.id } },
        },
      });

      return NextResponse.json({
        success: true,
        tenant: { id: tenant.id, name, mode, planSlug },
        message: 'Onboarding completado com sucesso!',
      });
    }

    // Create new user + tenant
    const user = await db.user.create({
      data: {
        email,
        name: name,
        tenant: {
          create: {
            name,
            niche: mode,
            plan: planSlug,
          },
        },
      },
      include: { tenant: true },
    });

    return NextResponse.json({
      success: true,
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        mode: user.tenant.niche,
        planSlug: user.tenant.plan,
      } : null,
      message: 'Onboarding completado com sucesso!',
    }, { status: 201 });
  } catch (error) {
    console.error('[api/onboarding] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

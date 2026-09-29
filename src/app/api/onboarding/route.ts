// =============================================================================
// API — Onboarding
// =============================================================================
// POST /api/onboarding — Completa o onboarding do tenant
// GET  /api/onboarding — Verifica status do onboarding
//
// MISSÃO RBW (Fases A+B):
//  A) ONBOARDING NÃO É AUTORIDADE COMERCIAL. O cliente NÃO define plano pago:
//     planSlug pro/max enviado pelo corpo NUNCA ativa plano. A autoridade
//     comercial é PAYMENT/SUBSCRIPTION AUTORIZADA (checkout success / webhook
//     aprovado elevam tenant.plan). Tenant criado aqui nasce 'gratuito'.
//  B) ISOLAMENTO DE TENANT: o GET resolve tenant EXCLUSIVAMENTE da sessão
//     (session → user → tenantId). NUNCA findFirst({status:'active'}) global
//     (retornava o primeiro tenant ativo do banco — vazamento entre tenants).
//
// Consumidores reais localizados na auditoria RBW: NENHUM consumidor interno
// em src/ chama /api/onboarding (rota legada de setup). Portanto:
//  - fluxo AUTENTICADO (RUN 6, pós-Google-signup) permanece — consumidor legítimo;
//  - criação ANÔNIMA de conta+tenant é fechada em produção (fail-closed) e
//    mantida em dev/teste com plano FORÇADO para gratuito (compat de dev).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    // ── Fase B (RBW): sessão é a única autoridade de identificação ──
    const session = await getServerSession(authOptions);
    const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId;
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const tenant = await db.tenant.findUnique({ where: { id: String(tenantId) } });
    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Tenant A → A = PASS (própria sessão). A → B = DENY (não existe caminho
    // para passar outro tenantId: a resolução é session-bound por construção).
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

    // ── Fase A (RBW): plano do cliente NÃO é autoridade comercial ──
    // planSlug continua aceito no contrato (compat) mas é IGNORADO para
    // ativação. A elevação de plano só ocorre por pagamento autorizado
    // (webhook aprovado / checkout success com assinatura válida).
    void planSlug;
    void password; // nunca persistido (comportamento pré-existente preservado)

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
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

      // Create tenant for the authenticated existing user — plano inicial
      // SEMPRE 'gratuito' (Fase A): pagamento é a autoridade de elevação.
      const tenant = await db.tenant.create({
        data: {
          name,
          niche: mode,
          plan: 'gratuito',
          users: { connect: { id: existingUser.id } },
        },
      });

      return NextResponse.json({
        success: true,
        tenant: { id: tenant.id, name, mode, planSlug: tenant.plan },
        message: 'Onboarding completado com sucesso!',
      });
    }

    // ── Criação anônima de conta+tenant (sem usuário existente) ──
    // Auditoria RBW: NENHUM consumidor interno chama este caminho. É fail-open
    // de provisionamento comercial (qualquer anônimo minta tenant 'pro'/'max')
    // e cria conta sem credencial utilizável (password ignorado).
    // Produção: fail-closed — onboarding de conta nova exige principal
    // autenticado (signup/Google), e o plano nasce gratuito.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'ONBOARDING_AUTH_REQUIRED',
          message: 'Criação de conta anônima desabilitada. Autentique-se (signup/login) para concluir o onboarding.',
        },
        { status: 403 }
      );
    }

    // Dev/teste: mantém compatibilidade com plano FORÇADO para gratuito
    // (nunca plano pago sem assinatura autorizada — mesmo em dev).
    const user = await db.user.create({
      data: {
        email: cleanEmail,
        name: name,
        tenant: {
          create: {
            name,
            niche: mode,
            plan: 'gratuito',
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

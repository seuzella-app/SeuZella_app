import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

/**
 * PATCH /api/zcc/tenants/[id]/status
 *
 * Kill switch / Reactivate tenant.
 * Body: { status: 'active' | 'suspended' }
 *
 * Conexões Prisma:
 *  - Tenant.status (active | suspended | churned)
 *  - AuditLog (registra ação do operador ZCC)
 *  - Cérebro: SelfDefenseAgent escuta mudança para 'suspended'
 *      → pausa webhooks + IA do tenant
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'MISSING_ID', message: 'Tenant ID é obrigatório.' },
      { status: 400 }
    );
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_BODY', message: 'JSON inválido.' },
      { status: 400 }
    );
  }

  const newStatus = body.status;
  if (newStatus !== 'active' && newStatus !== 'suspended') {
    return NextResponse.json(
      {
        success: false,
        error: 'INVALID_STATUS',
        message: 'status deve ser "active" ou "suspended".',
      },
      { status: 400 }
    );
  }

  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    // Mock mode (Vercel serverless sem DB)
    return NextResponse.json({
      success: true,
      data: {
        id,
        status: newStatus,
        mock: true,
        message: `Tenant ${id} ${newStatus === 'suspended' ? 'suspenso' : 'reativado'} (mock)`,
      },
      meta: { source: 'demo' },
    });
  }

  try {
    // Verifica se o tenant existe
    const existing = await db.tenant.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, plan: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: `Tenant ${id} não encontrado.` },
        { status: 404 }
      );
    }

    // Atualiza status
    const updated = await db.tenant.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        name: true,
        status: true,
        plan: true,
        updatedAt: true,
      },
    });

    // Registra no AuditLog
    try {
      await db.auditLog.create({
        data: {
          tenantId: id,
          action: newStatus === 'suspended' ? 'TENANT_SUSPENDED' : 'TENANT_REACTIVATED',
          details: JSON.stringify({
            previousStatus: existing.status,
            newStatus,
            source: 'zcc-kill-switch',
            ip: security.ip,
          }),
        },
      });
    } catch {
      // AuditLog pode não existir em todos ambientes — não bloqueante
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        plan: updated.plan,
        updatedAt: updated.updatedAt.toISOString(),
        message: `Tenant ${updated.name} ${newStatus === 'suspended' ? 'suspenso' : 'reativado'} com sucesso`,
      },
      meta: { source: 'db' },
    });
  } catch (error) {
    console.error('[ZCC Tenants Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro ao atualizar status do tenant.',
      },
      { status: 500 }
    );
  }
}

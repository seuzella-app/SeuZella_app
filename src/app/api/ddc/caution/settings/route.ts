/**
 * GET /api/ddc/caution/settings
 * PATCH /api/ddc/caution/settings
 *
 * Lê e atualiza as configurações de Caução PIX do Property do tenant.
 * Permite que o dono/anfitrião habilite ou desabilite a caução dos hóspedes,
 * ajuste valor default, janela de estorno (h) e mensagem customizada.
 *
 * RBAC: somente owner ou admin do tenant pode modificar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCautionSettings, updateCautionSettings } from '@/lib/payments/caution';
import { withApiGuard } from '@/lib/security/api-guard';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA ZOD — PATCH
// ─────────────────────────────────────────────────────────────────────────────
const cautionSettingsSchema = z.object({
  habilitada: z.boolean().optional(),
  valorPadrao: z.number().min(0).max(10000).optional(),
  janelaEstornoH: z.number().int().min(1).max(168).optional(), // 1h a 7 dias
  mensagemCustom: z.string().max(2000).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — lê configurações atuais
// ─────────────────────────────────────────────────────────────────────────────
async function getHandler(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }
  const settings = await getCautionSettings(tenantId);
  return NextResponse.json({ success: true, data: settings });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — atualiza configurações (RBAC: owner/admin)
// ─────────────────────────────────────────────────────────────────────────────
const patchWrapped = withApiGuard(
  { schema: cautionSettingsSchema, routeLabel: 'caution-settings' },
  async ({ tenantId, body }) => {
    if (!tenantId) {
      return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
    }
    const updated = await updateCautionSettings(tenantId, body);
    return NextResponse.json({ success: true, data: updated });
  }
);

export const GET = getHandler;
export const PATCH = patchWrapped;

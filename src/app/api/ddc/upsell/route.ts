/**
 * GET /api/ddc/upsell
 * POST /api/ddc/upsell
 *
 * Lista e cria UPSELLs para o tenant autenticado.
 * A Zélla cobra 7% de comissão sobre valores de UPSELL (zero em valores normais).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  criarUpsell,
  listarUpsells,
  calcularMetricasUpsell,
  UPSELL_TYPES_CATALOG,
  type UpsellType,
  type UpsellStatus,
  type Temporada,
} from '@/lib/upsell/upsell-engine';
import { withApiGuard } from '@/lib/security/api-guard';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA ZOD — POST
// ─────────────────────────────────────────────────────────────────────────────
const criarUpsellSchema = z.object({
  roomId: z.string().optional(),
  reservationId: z.string().optional(),
  guestId: z.string().optional(),
  type: z.enum([
    'aumento_diaria_feriado', 'reveillon', 'carnaval', 'alta_demanda_temporada',
    'late_checkout', 'cafe_premium', 'massagem', 'passeio_barco',
    'transfer_aeroporto', 'jantar_romantico', 'decoracao_aniversario',
    'garrafa_vinho', 'aula_surf', 'passeio_bugue', 'spa_day',
    'kit_praia', 'late_checkin_madrugada', 'limpeza_diaria_extra', 'outros',
  ]),
  description: z.string().max(500).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  unitPrice: z.number().min(0).max(10000).optional(),
  suggestedByZehla: z.boolean().optional(),
  feriado: z.string().max(100).optional(),
  temporada: z.enum(['alta', 'média', 'baixa']).optional(),
  yieldMultiplier: z.number().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — Lista UPSELLs do tenant + métricas do mês
// ─────────────────────────────────────────────────────────────────────────────
async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const status = searchParams.get('status') as UpsellStatus | null;
  const type = searchParams.get('type') as UpsellType | null;
  const roomId = searchParams.get('roomId');
  const includeMetrics = searchParams.get('metrics') === 'true';

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  const [records, metrics] = await Promise.all([
    listarUpsells({ tenantId, startDate, endDate, status: status ?? undefined, type: type ?? undefined, roomId: roomId ?? undefined, limit: 500 }),
    includeMetrics ? calcularMetricasUpsell({ tenantId, startDate, endDate }) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      records,
      metrics,
      catalog: UPSELL_TYPES_CATALOG,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Cria novo UPSELL
// ─────────────────────────────────────────────────────────────────────────────
const postWrapped = withApiGuard(
  { schema: criarUpsellSchema, routeLabel: 'upsell-create' },
  async ({ tenantId, body }) => {
    if (!tenantId) {
      return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
    }
    const record = await criarUpsell({
      tenantId,
      roomId: body.roomId,
      reservationId: body.reservationId,
      guestId: body.guestId,
      type: body.type as UpsellType,
      description: body.description,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      suggestedByZehla: body.suggestedByZehla,
      feriado: body.feriado,
      temporada: body.temporada as Temporada | undefined,
      yieldMultiplier: body.yieldMultiplier,
      notes: body.notes,
    });
    if (!record) {
      return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: record });
  }
);

export const GET = getHandler;
export const POST = postWrapped;

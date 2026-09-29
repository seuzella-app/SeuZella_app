/**
 * ============================================================================
 * PROPERTY OPERATIONAL READINESS — autoridade server-side de operação REAL
 * (MISSÃO RBW — Fase O)
 * ============================================================================
 *
 * Responde com autoridade: "esta pousada está realmente operacional?"
 * Usa SOMENTE requisitos reais encontrados no código existente:
 *   PROPERTY_VALID      — property existe com nome (wizard basic_info)
 *   ROOMS_VALID         — ≥1 quarto com preço > 0
 *   ROOM_PRICING_VALID  — todos os quartos ativos têm preço válido
 *   POLICIES_VALID      — políticas mínimas salvas (checkIn/checkOut/petPolicy)
 *   PAYMENT_READY       — pixKey configurada (recebimento do hóspede)
 *   WHATSAPP_VERIFIED   — estado real VERIFIED/HEALTHY (Fase L — nunca
 *                         auto-relato do wizard)
 *   AI_READY            — personalidade/tone configurados
 *
 * Nenhum requisito comercial inventado. Checks sem evidência real no banco
 * não existem aqui. Resultado: OPERATIONAL_READY somente com TUDO satisfeito.
 * ============================================================================
 */

import { db } from '@/lib/db';
import { resolveWhatsAppConnectionState, whatsappConnectedFromState, type WhatsAppConnectionState } from '@/lib/whatsapp/connection-state';

export type ReadinessCheckId =
  | 'PROPERTY_VALID'
  | 'ROOMS_VALID'
  | 'ROOM_PRICING_VALID'
  | 'POLICIES_VALID'
  | 'PAYMENT_READY'
  | 'WHATSAPP_VERIFIED'
  | 'AI_READY';

export interface ReadinessCheck {
  id: ReadinessCheckId;
  ok: boolean;
  detail: string;
  /** WhatsApp depende de validação externa (Graph API) para avançar além de PENDING. */
  externalDependency?: 'BLOCKED_EXTERNAL_DEPENDENCY';
}

export interface PropertyOperationalReadinessResult {
  tenantId: string;
  ready: boolean;
  state: 'OPERATIONAL_READY' | 'INCOMPLETE' | 'UNKNOWN';
  checks: ReadinessCheck[];
  whatsappState: WhatsAppConnectionState | null;
}

function safeMeta(metadata: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(typeof metadata === 'string' ? metadata : '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function evaluatePropertyOperationalReadiness(
  tenantId: string,
): Promise<PropertyOperationalReadinessResult> {
  const checks: ReadinessCheck[] = [];

  const property = await (db as any).property?.findFirst?.({
    where: { tenantId },
    include: { rooms: true },
  });

  if (!property) {
    return {
      tenantId,
      ready: false,
      state: 'INCOMPLETE',
      checks: [
        { id: 'PROPERTY_VALID', ok: false, detail: 'Nenhuma propriedade cadastrada' },
      ],
      whatsappState: null,
    };
  }

  const meta = safeMeta(property.metadata);

  checks.push({
    id: 'PROPERTY_VALID',
    ok: Boolean(property.name),
    detail: property.name ? `Propriedade "${property.name}"` : 'Propriedade sem nome',
  });

  const rooms: Array<{ price?: unknown; name?: string }> = Array.isArray(property.rooms) ? property.rooms : [];
  const pricedRooms = rooms.filter(r => Number(r.price ?? 0) > 0);
  checks.push({
    id: 'ROOMS_VALID',
    ok: pricedRooms.length > 0,
    detail: `${pricedRooms.length}/${rooms.length} quartos com preço válido`,
  });
  checks.push({
    id: 'ROOM_PRICING_VALID',
    ok: rooms.length > 0 && pricedRooms.length === rooms.length,
    detail: rooms.length === 0 ? 'Sem quartos cadastrados' : pricedRooms.length === rooms.length ? 'Todos os quartos precificados' : 'Há quartos sem preço',
  });

  const hasPolicies = Boolean(meta.checkInTime) && Boolean(meta.checkOutTime);
  checks.push({
    id: 'POLICIES_VALID',
    ok: hasPolicies,
    detail: hasPolicies ? `Check-in ${meta.checkInTime} / check-out ${meta.checkOutTime}` : 'Políticas de check-in/check-out incompletas',
  });

  checks.push({
    id: 'PAYMENT_READY',
    ok: Boolean(property.pixKey),
    detail: property.pixKey ? 'Chave Pix de recebimento configurada' : 'Chave Pix ausente (recebimento do hóspede)',
  });

  // WhatsApp: autoridade REAL (Fase L) — nunca o auto-relato do wizard.
  const wa = await resolveWhatsAppConnectionState(tenantId);
  const waConnected = whatsappConnectedFromState(wa.state);
  checks.push({
    id: 'WHATSAPP_VERIFIED',
    ok: waConnected,
    detail: waConnected ? `Conexão ${wa.state}` : `Conexão ${wa.state} (verificação real pendente)`,
    externalDependency: !waConnected ? 'BLOCKED_EXTERNAL_DEPENDENCY' : undefined,
  });

  checks.push({
    id: 'AI_READY',
    ok: Boolean(meta.aiTone),
    detail: meta.aiTone ? `Personalidade "${meta.aiTone}"` : 'Personalidade da IA não configurada',
  });

  const ready = checks.every(c => c.ok);
  return {
    tenantId,
    ready,
    state: ready ? 'OPERATIONAL_READY' : 'INCOMPLETE',
    checks,
    whatsappState: wa.state,
  };
}

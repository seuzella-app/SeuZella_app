// ==============================================================================
// ZÉLLA — BSUID & Guest Resolver (Race-Condition Safe)
// ==============================================================================
// Resolve o Guest a partir de identificadores híbridos da Meta:
//  - BSUID (Business Scoped User ID) — canônico,首选
//  - phone (E.164) — fallback
//
// CORREÇÃO CRÍTICA v2:
//  - Substitui findFirst + create por `upsert` atômico (race-condition safe).
//  - Usa @@unique([tenantId, bsuid]) e @@unique([tenantId, phone]) do schema.
//  - Usa classifyPhoneInput de phone-utils (single source of truth).
//  - Sem mais `payload.phone.length > 20` (heurística frágil e duplicada).
// ==============================================================================

import { db } from '@/lib/db';
import { classifyPhoneInput, normalizeToE164 } from '@/lib/phone-utils';

export interface GuestResolvePayload {
  /** Número de telefone E.164 ou BSUID da Meta */
  phone?: string;
  /** BSUID explícito (se disponível no payload da Meta) */
  bsuid?: string;
  /** Nome do perfil (do campo contacts[].profile.name da Meta) */
  profileName?: string;
}

export interface ResolvedGuest {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  bsuid: string | null;
  realPhone: string | null;
  email: string | null;
  realEmail: string | null;
  optInAt: Date | null;
  optOutAt: Date | null;
  status: string;
  source: string;
  conversationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolve um Guest de forma race-safe usando `upsert` atômico.
 *
 * Estratégia:
 *  1. Se BSUID explícito disponível → upsert por (tenantId, bsuid)
 *  2. Se phone classificável como phone → upsert por (tenantId, phone)
 *  3. Senão → cria Guest sem chave única (caso raro, logado para auditoria)
 *
 * Race-safe porque `upsert` faz find+create atomicamente no DB, eliminando
 * a janela onde duas requisições paralelas criam Guests duplicados.
 */
export async function resolveGuest(
  tenantId: string,
  payload: GuestResolvePayload
): Promise<ResolvedGuest> {
  if (!tenantId) {
    throw new Error('resolveGuest: tenantId é obrigatório');
  }

  const phoneKind = classifyPhoneInput(payload.phone);
  const normalizedPhone = phoneKind === 'phone' ? normalizeToE164(payload.phone) : null;

  // ── 1. Upsert por BSUID (chave canônica da Meta) ──
  // BSUID vem de payload.bsuid explícito OU de phone que é na verdade BSUID
  const effectiveBsuid = payload.bsuid ?? (phoneKind === 'bsuid' ? payload.phone : null);

  if (effectiveBsuid) {
    try {
      const guest = await db.guest.upsert({
        where: {
          tenantId_bsuid: { tenantId, bsuid: effectiveBsuid },
        },
        update: {
          // Atualiza nome apenas se veio um nome novo
          ...(payload.profileName ? { name: payload.profileName } : {}),
          // Se temos um phone válido e o guest não tinha, registramos
          ...(normalizedPhone ? { phone: normalizedPhone, realPhone: normalizedPhone } : {}),
        },
        create: {
          tenantId,
          bsuid: effectiveBsuid,
          name: payload.profileName || `Hóspede — ${effectiveBsuid.substring(0, 8)}…`,
          phone: normalizedPhone,
          realPhone: normalizedPhone,
          status: 'new',
          source: 'whatsapp',
          conversationCount: 1,
          metadata: '{}',
        },
      });
      return mapToResolved(guest);
    } catch (error) {
      // Se o erro for constraint único em phone (raro: guest existe com mesmo phone mas bsuid diferente),
      // fazemos fallback para lookup por phone
      if (!isUniqueConstraintError(error)) throw error;
      // FASE 02B (FRENTE 30): identificadores mascarados em logs
      console.warn('[resolveGuest] BSUID conflict, tentando por phone:', { tenantId, effectiveBsuid: effectiveBsuid ? `****${String(effectiveBsuid).slice(-4)}` : undefined });
    }
  }

  // ── 2. Upsert por phone (E.164 normalizado) ──
  if (normalizedPhone) {
    try {
      const guest = await db.guest.upsert({
        where: {
          tenantId_phone: { tenantId, phone: normalizedPhone },
        },
        update: {
          ...(payload.profileName ? { name: payload.profileName } : {}),
          // Se temos BSUID agora, registramos
          ...(effectiveBsuid ? { bsuid: effectiveBsuid } : {}),
        },
        create: {
          tenantId,
          phone: normalizedPhone,
          realPhone: normalizedPhone,
          name: payload.profileName || `Hóspede — ${normalizedPhone}`,
          status: 'new',
          source: 'whatsapp',
          conversationCount: 1,
          metadata: '{}',
        },
      });
      return mapToResolved(guest);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // FASE 02B (FRENTE 30): telefone mascarado em logs
      console.warn('[resolveGuest] Phone conflict, tentando lookup direto:', { tenantId, normalizedPhone: normalizedPhone ? `****${String(normalizedPhone).slice(-4)}` : undefined });
    }
  }

  // ── 3. Fallback: lookup por BSUID ou phone (sem upsert, para casos de conflito) ──
  if (effectiveBsuid) {
    const existing = await db.guest.findFirst({
      where: { tenantId, bsuid: effectiveBsuid },
    });
    if (existing) return mapToResolved(existing);
  }

  if (normalizedPhone) {
    const existing = await db.guest.findFirst({
      where: {
        tenantId,
        OR: [
          { phone: normalizedPhone },
          { realPhone: normalizedPhone },
        ],
      },
    });
    if (existing) return mapToResolved(existing);
  }

  // ── 4. Último recurso: criar sem chave única ──
  // Acontece apenas se BSUID e phone estão ambos ausentes/inválidos.
  console.warn('[resolveGuest] Criando Guest sem chave única (sem BSUID nem phone válido)', {
    tenantId,
    phoneKind,
  });

  const fallbackName = payload.profileName || 'Hóspede sem identificador';
  const guest = await db.guest.create({
    data: {
      tenantId,
      name: fallbackName,
      phone: null,
      bsuid: null,
      realPhone: null,
      status: 'new',
      source: 'whatsapp',
      conversationCount: 1,
      metadata: JSON.stringify({ warning: 'guest_created_without_unique_key' }),
    },
  });
  return mapToResolved(guest);
}

/**
 * Detecta se um erro Prisma é de violação de constraint única.
 * Prisma code P2002 = Unique constraint failed.
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const prismaError = error as { code?: string };
  return prismaError.code === 'P2002';
}

/**
 * Mapeia um Guest do Prisma para o tipo ResolvedGuest (sem campos sensíveis extras).
 */
function mapToResolved(guest: {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  bsuid: string | null;
  realPhone: string | null;
  realEmail: string | null;
  email: string | null;
  optInAt: Date | null;
  optOutAt: Date | null;
  status: string;
  source: string;
  conversationCount: number;
  createdAt: Date;
  updatedAt: Date;
}): ResolvedGuest {
  return {
    id: guest.id,
    tenantId: guest.tenantId,
    name: guest.name,
    phone: guest.phone,
    bsuid: guest.bsuid,
    realPhone: guest.realPhone,
    realEmail: guest.realEmail,
    email: guest.email,
    optInAt: guest.optInAt,
    optOutAt: guest.optOutAt,
    status: guest.status,
    source: guest.source,
    conversationCount: guest.conversationCount,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  };
}

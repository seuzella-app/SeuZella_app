/**
 * ============================================================================
 * 🧠 GUEST MEMORY — Entidade Cognitiva Centralizada do Hóspede
 * ============================================================================
 * Modela o perfil cognitivo permanente, preferências, histórico emocional e
 * estadias passadas do hóspede, integrando-se diretamente ao Zélla Brain.
 *
 * Princípio: "Aprender não significa acreditar."
 * Uma experiência isolada entra em quarentena provisória antes de virar
 * regra permanente de preferência.
 * ============================================================================
 */

import { db } from '@/lib/db';

export type EmotionalTone = 'muito_positivo' | 'positivo' | 'neutro' | 'duvida' | 'ansioso' | 'irritado' | 'frustrado';

export interface GuestPreferenceItem {
  key: string;
  value: string | number | boolean;
  confidence: number; // 0.0 a 1.0
  status: 'provisional' | 'trusted' | 'verified';
  occurrences: number;
  lastObservedAt: string;
}

export interface GuestStayRecord {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  totalPrice: number;
  incidentsReported?: string[];
  feedbackScore?: number;
}

export interface GuestMemoryProfile {
  guestId: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyTier: 'standard' | 'frequent' | 'vip';
  creditsBalance: number;
  preferences: Record<string, GuestPreferenceItem>;
  emotionalHistory: Array<{
    tone: EmotionalTone;
    timestamp: string;
    context: string;
  }>;
  stayHistory: GuestStayRecord[];
  activeIncident?: {
    type: 'lock_issue' | 'payment_issue' | 'room_issue' | 'noise' | 'other';
    description: string;
    escalatedToHuman: boolean;
    openedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// In-memory memory store para cache rápido / dev mode
const inMemoryGuestStore = new Map<string, GuestMemoryProfile>();

function buildMemoryKey(tenantId: string, phoneOrId: string): string {
  const cleanPhone = phoneOrId.replace(/\D/g, '');
  return `${tenantId}:${cleanPhone || phoneOrId}`;
}

export class GuestMemoryService {
  /**
   * Recupera a memória consolidada do hóspede
   */
  static async getGuestMemory(tenantId: string, phoneOrId: string, name?: string): Promise<GuestMemoryProfile> {
    const key = buildMemoryKey(tenantId, phoneOrId);

    // 1. Cache in-memory
    if (inMemoryGuestStore.has(key)) {
      return inMemoryGuestStore.get(key)!;
    }

    // 2. Busca no banco de dados se disponível
    try {
      if (db && typeof (db as any).guest?.findFirst === 'function') {
        const guest = await (db as any).guest.findFirst({
          where: {
            tenantId,
            OR: [
              { phone: { contains: phoneOrId.slice(-8) } },
              { id: phoneOrId },
            ],
          },
          include: {
            reservations: {
              include: { room: true },
              orderBy: { checkIn: 'desc' },
              take: 5,
            },
          },
        });

        if (guest) {
          const stayHistory: GuestStayRecord[] = (guest.reservations || []).map((r: any) => ({
            reservationId: r.id,
            checkIn: r.checkIn?.toISOString() || '',
            checkOut: r.checkOut?.toISOString() || '',
            roomName: r.room?.name || 'Acomodação',
            totalPrice: Number(r.totalPrice || 0),
          }));

          const profile: GuestMemoryProfile = {
            guestId: guest.id,
            tenantId,
            name: guest.name || name || 'Hóspede',
            phone: guest.phone || phoneOrId,
            email: guest.email || undefined,
            loyaltyTier: stayHistory.length >= 3 ? 'vip' : stayHistory.length >= 1 ? 'frequent' : 'standard',
            creditsBalance: 0,
            preferences: {},
            emotionalHistory: [],
            stayHistory,
            createdAt: guest.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          inMemoryGuestStore.set(key, profile);
          return profile;
        }
      }
    } catch (err) {
      console.warn('[GuestMemory] Erro ao carregar hóspede do DB (usando fallback):', err);
    }

    // 3. Cria novo perfil cognitivo
    const newProfile: GuestMemoryProfile = {
      guestId: `guest-${Date.now().toString(36)}`,
      tenantId,
      name: name || 'Hóspede',
      phone: phoneOrId,
      loyaltyTier: 'standard',
      creditsBalance: 0,
      preferences: {},
      emotionalHistory: [],
      stayHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryGuestStore.set(key, newProfile);
    return newProfile;
  }

  /**
   * Registra um estado emocional detectado
   */
  static async recordEmotionalState(
    tenantId: string,
    phoneOrId: string,
    tone: EmotionalTone,
    context: string
  ): Promise<void> {
    const memory = await this.getGuestMemory(tenantId, phoneOrId);
    memory.emotionalHistory.push({
      tone,
      timestamp: new Date().toISOString(),
      context: context.slice(0, 200),
    });

    // Mantém no máximo os 10 registros emocionais mais recentes
    if (memory.emotionalHistory.length > 10) {
      memory.emotionalHistory.shift();
    }

    memory.updatedAt = new Date().toISOString();
    inMemoryGuestStore.set(buildMemoryKey(tenantId, phoneOrId), memory);
  }

  /**
   * Registra aprendizado em quarentena provisória (anti-viés de turno único)
   */
  static async recordProvisionalPreference(
    tenantId: string,
    phoneOrId: string,
    key: string,
    value: string | number | boolean,
    initialConfidence = 0.5
  ): Promise<{ status: 'provisional' | 'trusted' | 'verified'; occurrences: number }> {
    const memory = await this.getGuestMemory(tenantId, phoneOrId);

    const existing = memory.preferences[key];
    if (existing) {
      existing.occurrences += 1;
      existing.lastObservedAt = new Date().toISOString();
      existing.confidence = Math.min(1.0, existing.confidence + 0.25);

      // Promoção a confiável após 3 ocorrências consistentes
      if (existing.occurrences >= 3 && existing.status === 'provisional') {
        existing.status = 'trusted';
      }

      memory.updatedAt = new Date().toISOString();
      inMemoryGuestStore.set(buildMemoryKey(tenantId, phoneOrId), memory);
      return { status: existing.status, occurrences: existing.occurrences };
    }

    // Primeiro registro -> entra estritamente como provisório (quarentena)
    memory.preferences[key] = {
      key,
      value,
      confidence: initialConfidence,
      status: 'provisional',
      occurrences: 1,
      lastObservedAt: new Date().toISOString(),
    };

    memory.updatedAt = new Date().toISOString();
    inMemoryGuestStore.set(buildMemoryKey(tenantId, phoneOrId), memory);
    return { status: 'provisional', occurrences: 1 };
  }

  /**
   * Abre um incidente ativo para o hóspede (ex: falha de fechadura, atraso no check-in)
   */
  static async reportActiveIncident(
    tenantId: string,
    phoneOrId: string,
    type: 'lock_issue' | 'payment_issue' | 'room_issue' | 'noise' | 'other',
    description: string,
    escalatedToHuman = true
  ): Promise<void> {
    const memory = await this.getGuestMemory(tenantId, phoneOrId);
    memory.activeIncident = {
      type,
      description,
      escalatedToHuman,
      openedAt: new Date().toISOString(),
    };
    memory.updatedAt = new Date().toISOString();
    inMemoryGuestStore.set(buildMemoryKey(tenantId, phoneOrId), memory);
  }

  /**
   * Limpa o incidente ativo após resolução
   */
  static async resolveActiveIncident(tenantId: string, phoneOrId: string): Promise<void> {
    const memory = await this.getGuestMemory(tenantId, phoneOrId);
    delete memory.activeIncident;
    memory.updatedAt = new Date().toISOString();
    inMemoryGuestStore.set(buildMemoryKey(tenantId, phoneOrId), memory);
  }
}

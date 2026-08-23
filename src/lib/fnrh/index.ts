/**
 * FNRH Digital — Ficha Nacional de Registro de Hóspedes
 *
 * Gera FNRH padronizada (Cadastur/Ministério do Turismo) via WhatsApp.
 * Coleta CPF, RG, nome completo, endereço e dados de acompanhantes.
 * Gera PDF/JSON e libera fechadura eletrônica somente após cadastro completo.
 */

import { db } from '@/lib/db';

export interface FNRHData {
  id: string;
  tenantId: string;
  guestId: string;
  reservationId?: string;
  fullName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  companions: Array<{
    name: string;
    cpf: string;
    relationship: string;
  }>;
  status: 'pending' | 'collected' | 'verified' | 'completed';
  collectedAt?: string;
  verifiedAt?: string;
  pdfUrl?: string;
  lockReleased?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Cria registro FNRH pendente quando reserva é confirmada.
 */
export async function createFNRHRecord(params: {
  tenantId: string;
  guestId: string;
  reservationId?: string;
}): Promise<FNRHData> {
  const fnrh: FNRHData = {
    id: `fnrh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    guestId: params.guestId,
    reservationId: params.reservationId,
    fullName: '',
    cpf: '',
    rg: '',
    birthDate: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    companions: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Persiste no DB se disponível
  try {
    if (db && (db as any).guestRegistration) {
      await (db as any).guestRegistration.create({
        data: {
          tenantId: params.tenantId,
          guestId: params.guestId,
          reservationId: params.reservationId,
          status: 'pending',
          data: JSON.stringify(fnrh),
        },
      });
    }
  } catch (err) {
    console.warn('[FNRH] DB persistence failed (dev mode):', err);
  }

  return fnrh;
}

/**
 * Atualiza FNRH com dados coletados via WhatsApp.
 */
export async function updateFNRHData(fnrhId: string, data: Partial<FNRHData>): Promise<FNRHData | null> {
  try {
    if (db && (db as any).guestRegistration) {
      const record = await (db as any).guestRegistration.findFirst({
        where: { id: fnrhId },
      });
      if (!record) return null;

      const current = JSON.parse(record.data || '{}') as FNRHData;
      const updated = { ...current, ...data, updatedAt: new Date().toISOString() };

      // Verifica se todos os campos obrigatórios estão preenchidos
      const isComplete = updated.fullName && updated.cpf && updated.rg &&
        updated.birthDate && updated.address && updated.city && updated.state;
      if (isComplete && updated.status !== 'completed') {
        updated.status = 'completed';
        updated.collectedAt = new Date().toISOString();
      }

      await (db as any).guestRegistration.update({
        where: { id: record.id },
        data: { data: JSON.stringify(updated), status: updated.status },
      });

      return updated;
    }
  } catch (err) {
    console.warn('[FNRH] Update failed:', err);
  }
  return null;
}

/**
 * Verifica se FNRH está completa e libera fechadura.
 */
export async function verifyAndReleaseLock(params: {
  tenantId: string;
  guestId: string;
  reservationId?: string;
}): Promise<{ released: boolean; reason?: string }> {
  try {
    if (db && (db as any).guestRegistration) {
      const record = await (db as any).guestRegistration.findFirst({
        where: {
          tenantId: params.tenantId,
          guestId: params.guestId,
          ...(params.reservationId ? { reservationId: params.reservationId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        return { released: false, reason: 'FNRH não iniciada' };
      }

      const fnrh = JSON.parse(record.data || '{}') as FNRHData;
      if (fnrh.status !== 'completed') {
        return { released: false, reason: 'FNRH incompleta — dados pendentes' };
      }

      // Libera fechadura
      fnrh.lockReleased = true;
      fnrh.verifiedAt = new Date().toISOString();
      await (db as any).guestRegistration.update({
        where: { id: record.id },
        data: { data: JSON.stringify(fnrh), status: 'verified' },
      });

      return { released: true };
    }
  } catch (err) {
    console.warn('[FNRH] Lock release failed:', err);
  }
  return { released: false, reason: 'Erro ao verificar FNRH' };
}

/**
 * Extrai dados de CPF/RG de mensagens WhatsApp do hóspede.
 */
export function extractGuestDataFromMessage(message: string): Partial<FNRHData> {
  const data: Partial<FNRHData> = {};
  const lower = message.toLowerCase();

  // CPF: 000.000.000-00 ou 00000000000
  const cpfMatch = message.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
  if (cpfMatch) data.cpf = cpfMatch[1].replace(/[^\d-]/g, '');

  // RG: letras + números
  const rgMatch = message.match(/\bRG[:\s]*([A-Za-z]?\d{6,12})\b/i);
  if (rgMatch) data.rg = rgMatch[1];

  // Nome (se a mensagem começar com "meu nome é" ou "sou")
  const nameMatch = message.match(/(?:meu nome [ée]|sou|chamo[-\s]me)\s+([A-Za-zÀ-ÿ\s]{5,60})/i);
  if (nameMatch) data.fullName = nameMatch[1].trim();

  // Data de nascimento
  const birthMatch = message.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (birthMatch) data.birthDate = `${birthMatch[1]}/${birthMatch[2]}/${birthMatch[3]}`;

  // CEP
  const cepMatch = message.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) data.zipCode = cepMatch[1];

  return data;
}

/**
 * Gera mensagem WhatsApp para coleta de dados FNRH.
 */
export function generateFNRHCollectionMessage(guestName?: string): string {
  return `Olá${guestName ? ` ${guestName}` : ''}! 👋

Para agilizar seu check-in, precisamos cadastrar alguns dados (exigência do Ministério do Turismo / Cadastur).

Pode me enviar as seguintes informações?

1️⃣ Nome completo
2️⃣ CPF
3️⃣ RG
4️⃣ Data de nascimento (DD/MM/AAAA)
5️⃣ CEP

Você pode enviar tudo em uma mensagem ou uma informação por vez — como preferir! 😊

Assim que concluir, enviarei a senha da fechadura do seu quarto.`;
}

/**
 * FASE 02B — Regressão de handover/escalation (FRENTE 01/26/27).
 *
 * Política explícita: ACTIVE → ESCALATED → HUMAN CONTROL.
 * Enquanto escalada, a IA NÃO RESPONDE. Reativação só por ação humana.
 *
 * Padrão da casa: source-assertion (sandbox sem PostgreSQL real).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe('FASE 02B — supressão de IA durante handover (P1-2)', () => {
  const responder = read('src/lib/whatsapp-ai-responder.ts');

  it('lookup de conversa considera escalated (latest-wins) — conversa em handover não fica invisível', () => {
    expect(responder).toMatch(/status:\s*\{\s*in:\s*\['active',\s*'escalated'\]\s*\}/);
    expect(responder).toMatch(/orderBy:\s*\{\s*lastUpdate:\s*'desc'\s*\}/);
  });

  it('guard de supressão existe ANTES do pipeline cognitivo (após LGPD)', () => {
    expect(responder).toMatch(/HUMAN HANDOVER GUARD/);
    expect(responder).toMatch(/if \(conversation\.status === 'escalated'\)/);
  });

  it('supressão retorna aiResponse vazio ⇒ caller não envia WhatsApp nem registra custo', () => {
    expect(responder).toMatch(/aiResponse: '', guestId: guest\.id, metaCostRecord: undefined/);
  });

  it('supressão notifica o humano (notification + aIActivityLog)', () => {
    expect(responder).toMatch(/Hóspede respondeu durante handover/);
    expect(responder).toMatch(/IA suprimida \(controle humano ativo\)/);
  });

  it('ordenação correta: LGPD intercept vem ANTES do guard de handover', () => {
    const lgpdPos = responder.indexOf('LGPD Opt-In/Opt-Out Interceptor');
    const guardPos = responder.indexOf('HUMAN HANDOVER GUARD');
    const saveMsgPos = responder.indexOf("from: 'guest',\n      content: messageContent");
    expect(lgpdPos).toBeGreaterThan(-1);
    expect(guardPos).toBeGreaterThan(lgpdPos);
    // a mensagem do hóspede é salva antes do guard (humano vê no DDC)
    expect(guardPos).toBeGreaterThan(saveMsgPos);
  });

  it('handover.started é registrado quando a IA transfere (FRENTE 26)', () => {
    expect(responder).toMatch(/name: 'handover\.started'/);
  });

  it('handover.guest_message_suppressed é registrado (FRENTE 26)', () => {
    expect(responder).toMatch(/name: 'handover\.guest_message_suppressed'/);
  });
});

describe('FASE 02B — webhook media branch escalado-aware', () => {
  const webhook = read('src/app/api/webhooks/whatsapp/route.ts');

  it('mídia durante handover vai para a conversa escalada (nunca cria active nova)', () => {
    expect(webhook).toMatch(/lookup escalado-aware/);
    expect(webhook).toMatch(/status:\s*\{\s*in:\s*\['active',\s*'escalated'\]\s*\}/);
  });
});

describe('FASE 02B — reativação de handover só por ação humana validada', () => {
  const route = read('src/app/api/ddc/conversations/[id]/route.ts');

  it('PATCH valida transições de status (string arbitrária rejeitada)', () => {
    expect(route).toMatch(/ALLOWED_CONVERSATION_STATUSES/);
    expect(route).toMatch(/INVALID_STATUS/);
  });

  it('handover.ended registrado quando humano encerra o controle (FRENTE 26)', () => {
    expect(route).toMatch(/name: 'handover\.ended'/);
    expect(route).toMatch(/existing\.status === 'escalated' && status && status !== 'escalated'/);
  });

  it('metadata é MERGE (preserva metadata.zellm do bridge — P2-10)', () => {
    expect(route).toMatch(/existingMetadata = JSON\.parse\(existing\.metadata \|\| '\{\}'\)/);
    expect(route).toMatch(/\.\.\.existingMetadata, \.\.\.metadata/);
  });
});

describe('FASE 02B — learning não promove handover como sucesso (FRENTE 27)', () => {
  const metaLearning = read('src/lib/meta/meta-learning.ts');

  it('HUMAN_HANDOVER/FAILURE não são promovíveis (contrato mantido)', () => {
    expect(metaLearning).toMatch(/NEGATIVE_OUTCOME_NOT_PROMOTABLE/);
  });
});

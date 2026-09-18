/**
 * RUN 4 — WAVE 4C: Guest Concierge sem credenciais operacionais hardcoded.
 *
 * Contrato P0:
 *  - Credenciais Wi-Fi (SSID/senha) SOMENTE de contexto autorizado;
 *  - Sem credencial → orientar hóspede a solicitar à equipe (fail-safe);
 *  - Nenhuma credencial hardcoded permanece no módulo;
 *  - Senha NUNCA registrada em facts/audit (logs livres de segredo).
 */

import { describe, it, expect } from 'vitest';

import { RetrieveKnowledgeAction } from '@/lib/metagpt/sops/guest-concierge.sop';
import { runGuestConcierge } from '@/lib/metagpt/sops/guest-concierge.sop';
import fs from 'fs';
import path from 'path';

describe('WAVE 4C — guest-concierge sem credenciais hardcoded', () => {
  const action = new RetrieveKnowledgeAction();

  const runRetrieve = async (input: Record<string, unknown>) => {
    // MetaAction.execute é protegido; exercitamos via run/ cast controlado de teste.
    const exec = (action as unknown as { execute: (i: Record<string, unknown>) => Promise<{ output: { facts: string[]; draftResponse: string } }> }).execute.bind(action);
    return exec(input);
  };

  it('1. credencial presente no contexto autorizado → divulga ao hóspede', async () => {
    const out = await runRetrieve({
      intent: 'WIFI',
      propertyName: 'Pousada Teste',
      wifiSsid: 'rede-autorizada',
      wifiPassword: 'senha-autorizada-123',
    });
    expect(out.output.draftResponse).toContain('rede-autorizada');
    expect(out.output.draftResponse).toContain('senha-autorizada-123');
  });

  it('2. credencial ausente → resposta segura orientando solicitar à equipe', async () => {
    const out = await runRetrieve({ intent: 'WIFI', propertyName: 'Pousada Teste' });
    expect(out.output.draftResponse).not.toMatch(/senha é "|senha do Wi-Fi é "/);
    expect(out.output.draftResponse).toMatch(/solicite|recepção|equipe/i);
  });

  it('3. senha não aparece em facts/audit (logs livres de segredo)', async () => {
    const out = await runRetrieve({
      intent: 'WIFI',
      propertyName: 'Pousada Teste',
      wifiSsid: 'rede-autorizada',
      wifiPassword: 'super-secreta-987',
    });
    for (const fact of out.output.facts) {
      expect(fact).not.toContain('super-secreta-987');
    }
  });

  it('4. nenhum credential hardcoded permanece no módulo (fonte auditada)', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/metagpt/sops/guest-concierge.sop.ts'),
      'utf8'
    );
    expect(src).not.toContain('marés_vip2026');
    expect(src).not.toContain('Zella_Guest_5G');
    expect(src).not.toMatch(/wifiPassword\s*\|\|\s*['"][^'"]+['"]/); // sem fallback literal
  });

  it('5. runGuestConcierge end-to-end: sem credencial → resposta segura; com credencial → divulga', async () => {
    const safe = await runGuestConcierge({
      messageText: 'Qual a senha do Wi-Fi?',
      propertyName: 'Pousada Teste',
    });
    expect(safe.result.finalMessage).toMatch(/solicite|recepção|equipe/i);

    const disclosed = await runGuestConcierge({
      messageText: 'Qual a senha do Wi-Fi?',
      propertyName: 'Pousada Teste',
      wifiSsid: 'rede-propriedade',
      wifiPassword: 'senha-do-contexto-456',
    });
    expect(disclosed.result.finalMessage).toContain('senha-do-contexto-456');
  });
});

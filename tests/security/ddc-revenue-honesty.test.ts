import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

/**
 * FASE 02 — Auditoria Forense: DDC Revenue Honesty
 *
 * Regressão do P0 corrigido em src/app/api/ddc/revenue-details/route.ts:
 * um dia sem bookings devolvia 4 transações FABRICADAS (nomes, valores,
 * txIds Math.random e conversas inventadas) somadas em totalRevenueToday,
 * sem flag degraded — receita fictícia exibida como real em produção.
 *
 * Padrão: source-assertion (mesmo estilo de meta-wave4-regression.test.ts),
 * porque o sandbox de execução não tem PostgreSQL real.
 */
describe('DDC revenue-details — honestidade de dados (FASE 02)', () => {
  const source = read('src/app/api/ddc/revenue-details/route.ts');

  it('não fabrica mais transações mock em dia sem bookings', () => {
    expect(source).not.toContain('Mariana Silva');
    expect(source).not.toContain('mockNames');
    expect(source).not.toContain('mockValues');
    expect(source).not.toContain('mock-tx-');
    expect(source).not.toContain('Suíte Master');
  });

  it('não fabrica conversa (chatExcerpt) para booking real sem mensagens', () => {
    expect(source).not.toContain('Comprovante do Pix enviado!');
    expect(source).not.toContain('Perfeito, ${booking.guestName}');
    expect(source).not.toContain('Recebido com sucesso, ${name}');
  });

  it('txId não é mais Math.random com data hardcodada', () => {
    expect(source).not.toContain('Math.random() * 9000000000');
    expect(source).not.toContain('20260703');
    expect(source).toContain('const txId = booking.id;');
  });

  it('resposta vazia é honesta: flag degraded + source explícitos', () => {
    expect(source).toContain("degraded: transactions.length === 0");
    expect(source).toContain("source: transactions.length === 0 ? 'no_bookings_today' : 'database'");
    // caminho database_unavailable mantém o contrato honesto pré-existente
    expect(source).toContain("source: 'database_unavailable'");
  });

  it('totalRevenueToday é somado apenas de transações reais do banco', () => {
    // bookings vêm de db.booking com tenantId + filtro PIX; mock nunca entra na soma
    expect(source).toContain('db.booking.findMany');
    expect(source).toContain('paymentMethod: \'pix\'');
  });
});

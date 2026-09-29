/**
 * RBW Fase I — fonte canônica de métodos de pagamento.
 * RBW J — re-auditoria PARCEIRO 247 (proteção da regra canônica F28).
 */
import { describe, it, expect } from 'vitest';
import { PRICING_MATRIX, ALLOWED_METHODS, isMethodAllowed, getPrice } from '@/lib/payments/pricing';

describe('RBW-I · métodos canônicos derivados do pricing', () => {
  it('todo método vendido por qualquer plano é aceitável no checkout (boleto incluído)', () => {
    const union = new Set(Object.values(ALLOWED_METHODS).flat());
    expect(union.has('pix')).toBe(true);
    expect(union.has('boleto')).toBe(true);
    expect(union.has('cartao')).toBe(true);
  });

  it('isMethodAllowed e ALLOWED_METHODS são a MESMA autoridade', () => {
    for (const [plan, methods] of Object.entries(ALLOWED_METHODS)) {
      for (const method of ['pix', 'boleto', 'cartao'] as const) {
        expect(isMethodAllowed(plan as any, method)).toBe((methods as string[]).includes(method));
      }
    }
  });

  it('preço existe para TODA combinação plano×método anunciada (sem method fantasma)', () => {
    for (const [plan, methods] of Object.entries(ALLOWED_METHODS)) {
      for (const method of methods as string[]) {
        const quote = getPrice(plan as any, method as any);
        expect(typeof quote.amount).toBe('number');
        expect(Number.isFinite(quote.amount)).toBe(true);
      }
    }
  });
});

describe('RBW-J · PARCEIRO R$247 canônico (regra F28 intocada)', () => {
  it('matriz PARCEIRO = 247/247/257 (pix/cartao/boleto) — R$297 proibido', () => {
    expect(PRICING_MATRIX.parceiro).toEqual({ pix: 247, cartao: 247, boleto: 257 });
  });

  it('nenhuma célula da matriz comercial contém 297', () => {
    for (const [plan, row] of Object.entries(PRICING_MATRIX)) {
      for (const [method, amount] of Object.entries(row)) {
        expect(amount, `${plan}/${method}`).not.toBe(297);
      }
    }
  });

  it('PARCEIRO aceita os mesmos métodos do PRO (paridade funcional)', () => {
    expect(new Set(ALLOWED_METHODS.parceiro).union(new Set(ALLOWED_METHODS.pro))).toEqual(new Set(ALLOWED_METHODS.parceiro));
  });
});

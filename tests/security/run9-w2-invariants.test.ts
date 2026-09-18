/**
 * RUN9-W2 V2 — INVARIANTES DO FECHAMENTO (patches 9C + 9F + residuais)
 *
 * Estilo W2 do RUN8: provas ESTRUTURAIS (fs) sobre o estado pós-patch.
 * Este arquivo é instalado pelo RUN9_W2_APPLY.sh e commitado no fechamento.
 *
 * Cobertura:
 *  - cadeia ...... fechadura RUN8 (W2_PATCH_RECORD) + RUN9-W1 (inventário)
 *                  + disciplina migrate herdada (8B) + postgresql (8A)
 *  - 9C .......... guard fail-closed no webhook zcc/airbnb OU residual
 *                  RES-9C-1 documentado (disjunção), coerência do registro,
 *                  booking-com/reviews com assinatura preservada
 *  - 9F .......... margem temporal do teste run4-wave4a: a margem de 1ms
 *                  (Date.now() + 1_800_001) NÃO PODE mais existir — race de
 *                  relógio que causou o RED da execução V1 (20260918_113845).
 *                  Se existir, exige residual RES-9F-1 documentado.
 *  - 9D .......... RES-9D-1 + plano RUN9-W3 presente + pin ANTI-CRESCIMENTO
 *                  do conjunto Float money (se crescer, alguém adicionou
 *                  dinheiro em Float fora do controle — falha)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

const latestDir = (base: string, re: RegExp): string | null => {
  const abs = join(root, base);
  if (!existsSync(abs)) return null;
  const dirs = readdirSync(abs).filter((d) => re.test(d)).sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
};

const w2Dir = (): string => {
  const latest = latestDir('99_AUDITS', /^RUN9_W2_\d{8}_\d{6}$/);
  expect(latest, 'nenhum 99_AUDITS/RUN9_W2_* — APPLY não rodou').toBeTruthy();
  return join(root, '99_AUDITS', latest!);
};

describe('RUN9-W2 — fechaduras herdadas da cadeia RUN7+RUN8', () => {
  it('RUN8 fechado: registro do patch W2 existe e é consistente', () => {
    const latest = latestDir('99_AUDITS', /^RUN8_W2_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN8_W2_* — RUN8-W2 não rodou (cadeia quebrada)').toBeTruthy();
    const rec = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'W2_PATCH_RECORD.json'), 'utf8'));
    expect(rec.run).toBe('RUN8-W2 patches 8B');
    expect(rec.packageJsonValid).toBe(true);
  });

  it('RUN9-W1 executado: inventário de billing presente e parseável', () => {
    const latest = latestDir('99_AUDITS', /^RUN9_W1_\d{8}_\d{6}$/);
    expect(latest, 'nenhum 99_AUDITS/RUN9_W1_* — RUN9-W1 não rodou (cadeia quebrada)').toBeTruthy();
    const inv = JSON.parse(readFileSync(join(root, '99_AUDITS', latest!, 'RUN9_BILLING_INVENTORY.json'), 'utf8'));
    expect(inv.run).toContain('RUN9-W1');
    expect(inv.totals).toHaveProperty('billingRoutes');
  });

  it('disciplina migrate herdada: nenhum `db push` em scripts npm (8B)', () => {
    const pkg = JSON.parse(read('package.json'));
    const offenders = Object.entries(pkg.scripts || {})
      .filter(([, v]) => /\bdb\s+push\b/.test(String(v)))
      .map(([k]) => k);
    expect(offenders, 'scripts ainda com db push: ' + offenders.join(', ')).toEqual([]);
  });

  it('schema segue postgresql (8A herdado)', () => {
    const schema = read('prisma/schema.prisma');
    const ds = schema.match(/datasource\s+\w+\s*\{([^}]*)\}/)!;
    expect(ds[1]).toMatch(/provider\s*=\s*["']postgresql["']/);
  });
});

describe('RUN9-W2 — patch 9C (guard fail-closed do webhook zcc/airbnb)', () => {
  const routeRel = 'src/app/api/zcc/airbnb/webhook/route.ts';

  it('guard aplicado OU residual RES-9C-1 documentado (disjunção)', () => {
    const txt = read(routeRel);
    const guard = txt.includes('AIRBNB_WEBHOOK_SECRET') && txt.includes('401');
    if (!guard) {
      const residuals = JSON.parse(readFileSync(join(w2Dir(), 'RESIDUALS.json'), 'utf8'));
      const r = residuals.find((x: { id: string }) => x.id === 'RES-9C-1');
      expect(r, 'nem guard no arquivo nem RES-9C-1 documentado — estado inconsistente').toBeTruthy();
    }
  });

  it('quando o guard está presente, ele é fail-closed (recusa sem secret e sem token)', () => {
    const txt = read(routeRel);
    if (txt.includes('AIRBNB_WEBHOOK_SECRET')) {
      expect(txt).toMatch(/!\s*__wbSecret/);
      expect(txt).toMatch(/!\s*__wbToken/);
      expect(txt).toMatch(/status:\s*401/);
    }
  });

  it('registro do patch é coerente com o conteúdo real do arquivo', () => {
    const rec = JSON.parse(readFileSync(join(w2Dir(), 'W2_PATCH_RECORD.json'), 'utf8'));
    expect(rec.run).toBe('RUN9-W2 patches 9C+9F');
    expect(rec.kitVersion).toBe('V2');
    const txt = read(routeRel);
    expect(rec.airbnbGuardApplied).toBe(txt.includes('AIRBNB_WEBHOOK_SECRET'));
  });

  it('booking-com/reviews preserva sinal de assinatura (intocado pelo W2)', () => {
    const txt = read('src/app/api/webhooks/booking-com/reviews/route.ts');
    expect(txt).toMatch(/signature|token|hmac|secret/i);
  });
});

describe('RUN9-W2 — patch 9F (margem temporal do teste run4-wave4a, flake de relógio)', () => {
  const run4Rel = 'tests/security/run4-wave4a-checkout-adversarial.test.ts';
  const BAD_MARGIN = 'Date.now() + 1_800_001';

  it('margem de 1ms (race de relógio) eliminada do teste run4-wave4a OU RES-9F-1 documentado', () => {
    if (!existsSync(join(root, run4Rel))) return; // teste ausente = flake inexistente
    const txt = read(run4Rel);
    if (txt.includes(BAD_MARGIN)) {
      const residuals = JSON.parse(readFileSync(join(w2Dir(), 'RESIDUALS.json'), 'utf8'));
      const r = residuals.find((x: { id: string }) => x.id === 'RES-9F-1');
      expect(r, 'teste run4-wave4a ainda com margem de 1ms e sem RES-9F-1 — estado inconsistente').toBeTruthy();
    }
  });

  it('registro 9F é coerente com o conteúdo real do teste run4', () => {
    if (!existsSync(join(root, run4Rel))) return;
    const rec = JSON.parse(readFileSync(join(w2Dir(), 'W2_PATCH_RECORD.json'), 'utf8'));
    const txt = read(run4Rel);
    const badPresent = txt.includes(BAD_MARGIN);
    // se 9F alegou aplicar, a margem ruim não pode mais existir
    if (rec.flake9fApplied === true) {
      expect(badPresent, 'record diz 9F aplicado mas margem de 1ms ainda presente').toBe(false);
    }
  });
});

describe('RUN9-W2 — residuais documentados e plano 9D', () => {
  it('RESIDUALS.json documenta RES-9C-2 e RES-9D-1 com remediação', () => {
    const residuals = JSON.parse(readFileSync(join(w2Dir(), 'RESIDUALS.json'), 'utf8'));
    const r2 = residuals.find((x: { id: string }) => x.id === 'RES-9C-2');
    const rd = residuals.find((x: { id: string }) => x.id === 'RES-9D-1');
    expect(r2, 'RES-9C-2 ausente').toBeTruthy();
    expect(String(r2.remediation).length).toBeGreaterThan(10);
    expect(rd, 'RES-9D-1 ausente').toBeTruthy();
    expect(String(rd.remediation)).toMatch(/RUN9-W3/);
  });

  it('RUN9_W3_REMEDIATION_PLAN.md existe e propõe Decimal(12,2)', () => {
    const plan = readFileSync(join(w2Dir(), 'RUN9_W3_REMEDIATION_PLAN.md'), 'utf8');
    expect(plan).toMatch(/Decimal/);
    expect(plan).toMatch(/RUN9-W3/);
  });

  it('pin ANTI-CRESCIMENTO: nenhum campo Float money além dos 6 conhecidos nos models de billing', () => {
    const schema = read('prisma/schema.prisma');
    const billingModelRe = /transaction|invoice|payment|charge|billing|subscription|revenue|payout|refund|wallet|credit/i;
    const moneyNameRe = /price|amount|total|value|fee|rate|balance|cost|refund|discount|paid|revenue/i;
    const pinned = new Set([
      'Transaction.amount',
      'Subscription.amount',
      'Subscription.lastProrateAmount',
      'PaymentTransaction.amount',
      'AirBSubscription.amount',
      'AirBTransaction.amount',
    ]);
    const computed: string[] = [];
    const reModel = /\bmodel\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/g;
    let mm: RegExpExecArray | null;
    while ((mm = reModel.exec(schema)) !== null) {
      if (!billingModelRe.test(mm[1])) continue;
      for (const line of mm[2].split('\n').map((s) => s.trim())) {
        if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
        const fm = line.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_\[\]?]+)/);
        if (fm && /\bFloat\b/.test(fm[2]) && moneyNameRe.test(fm[1])) {
          computed.push(mm[1] + '.' + fm[1]);
        }
      }
    }
    const unknown = computed.filter((p) => !pinned.has(p));
    expect(unknown, 'novos campos Float money fora do pin (atualizar no RUN9-W3): ' + unknown.join(', ')).toEqual([]);
  });
});

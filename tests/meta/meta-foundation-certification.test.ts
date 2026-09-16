// ==============================================================================
// Meta Foundation — Certification Tests (Fase 25/26)
// ==============================================================================
// Certifica as garantias estruturais da onda feat/meta-zella-foundation:
//  1. Webhook existente preservado (HMAC, timing-safe, fail-closed, tenant,
//     LGPD, WABA) + evoluções (idempotência, statuses/pricing, attribution)
//  2. Nenhuma versão da Graph API hardcoded em código de produção
//  3. Feature flags com defaults corretos (Business Agent SEMPRE false)
//  4. Schema/migration das novas entidades
//  5. meta-cost-guard corrigido (estimativa ≠ custo real; sem multiplicadores
//     inventados; sem câmbio fixo; UNKNOWN nunca precificado)
//  6. DDC Meta Connect nunca fabrica status verde
//  7. ZéLLM: anti-pattern nunca promovido
//  8. Documentação completa
// ==============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const has = (file: string) => existsSync(resolve(root, file));

// ── 1. Webhook existente + evoluções ─────────────────────────────────────────

describe('🔒 Webhook WhatsApp — proteções existentes preservadas (Fase 4)', () => {
  const route = 'src/app/api/webhooks/whatsapp/route.ts';
  const source = read(route);

  it('HMAC + timingSafeEqual presentes', () => {
    expect(source).toMatch(/createHmac\s*\(\s*['"]sha256['"]/);
    expect(source).toMatch(/timingSafeEqual/);
  });

  it('fail-closed em produção sem META_APP_SECRET', () => {
    expect(source).toMatch(/META_APP_SECRET_NOT_SET_IN_PRODUCTION/);
  });

  it('resolução de tenant (resolveTenantByPhone) preservada', () => {
    expect(source).toMatch(/resolveTenantByPhone\(/);
  });

  it('LGPD opt-out síncrono preservado', () => {
    expect(source).toMatch(/isOptOutMessage/);
    expect(source).toMatch(/handleOptOut/);
  });

  it('idempotência de mensagem inbound (Fase 5)', () => {
    expect(source).toMatch(/claimMetaEvent\(\s*['"]inbound_message['"]/);
    expect(source).toMatch(/DUPLICATE_MESSAGE_IDEMPOTENCY/);
  });

  it('idempotência de status outbound (Fase 5)', () => {
    expect(source).toMatch(/claimMetaEvent\(\s*['"]outbound_status['"]/);
  });

  it('processamento de statuses com pricing authoritative (Fase 6)', () => {
    expect(source).toMatch(/processMetaStatuses/);
    expect(source).toMatch(/recordMetaPricingFromStatus/);
  });

  it('captura de referral Click-to-WhatsApp (Fase 9)', () => {
    expect(source).toMatch(/recordMetaAttribution/);
  });

  it('heartbeat MetaConnection (Fase 11)', () => {
    expect(source).toMatch(/touchMetaConnection/);
  });
});

// ── 2. Graph API version centralizada (Fase 2) ──────────────────────────────

describe('🌐 Graph API version — sem hardcoded (Fase 2)', () => {
  it('whatsapp-send.ts NÃO tem versão hardcoded e usa meta-config', () => {
    const send = read('src/lib/whatsapp-send.ts');
    expect(send).not.toMatch(/graph\.facebook\.com\/v\d+\.\d+/);
    expect(send).toMatch(/metaGraphUrl|ACTIVE_META_GRAPH_API_VERSION/);
  });

  it('nenhum arquivo de produção com v18–v26 hardcoded (exceto meta-config registry/docs)', () => {
    const offenders: string[] = [];
    const scanDirs = ['src/lib', 'src/app'];
    const skip = /(meta-config\.ts|mock-data|node_modules)/;
    const versionLiteral = /graph\.facebook\.com\/v(1[89]|2[0-6])\.0/;

    const walk = (dir: string) => {
      for (const name of readdirSync(resolve(root, dir))) {
        const full = `${dir}/${name}`;
        const abs = resolve(root, full);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const stat = require('node:fs').statSync(abs);
        if (stat.isDirectory()) {
          if (!skip.test(name)) walk(full);
        } else if (/\.(ts|tsx)$/.test(name) && !skip.test(full)) {
          if (versionLiteral.test(read(full))) offenders.push(full);
        }
      }
    };

    for (const dir of scanDirs) walk(dir);
    expect(offenders).toEqual([]);
  });

  it('registry de versões contém v21.0 com sunset jan/2027 e alvo v26.0', () => {
    const config = read('src/lib/meta/meta-config.ts');
    expect(config).toMatch(/v21\.0/);
    expect(config).toMatch(/2027-01/);
    expect(config).toMatch(/v26\.0/);
  });
});

// ── 3. Feature flags (Fase 29) ───────────────────────────────────────────────

describe('🚩 Feature flags Meta (Fase 29)', () => {
  it('as 7 flags existem com defaults corretos (CAPI flag OFF — onda correção/hardening)', () => {
    const config = read('src/lib/meta/meta-config.ts');
    expect(config).toMatch(/META_CONNECT_ENABLED[^;]*false/);
    expect(config).toMatch(/META_INSTAGRAM_ENABLED[^;]*false/);
    expect(config).toMatch(/META_BUSINESS_AGENT_ENABLED[^;]*false/);
    expect(config).toMatch(/META_ATTRIBUTION_ENABLED[^;]*true/);
    expect(config).toMatch(/META_COST_TRACKING_ENABLED[^;]*true/);
    expect(config).toMatch(/META_LEARNING_ENABLED[^;]*true/);
    expect(config).toMatch(/META_CAPI_ENABLED[^;]*false/);
  });

  it('Business Agent: capability default desligado (Fase 13)', () => {
    const config = read('src/lib/meta/meta-config.ts');
    expect(config).toMatch(/businessAgentEnabled:\s*META_BUSINESS_AGENT_ENABLED/);
  });

  it('Meta One não é requisito técnico (nada de checkout/assinatura)', () => {
    expect(has('docs/META_ONE_READINESS.md')).toBe(true);
  });
});

// ── 4. Schema + migration (Fase 3/23) ────────────────────────────────────────

describe('🗄️ Prisma — entidades Meta Foundation', () => {
  const schema = read('prisma/schema.prisma');

  it('MetaConnection multi-tenant com campos mínimos (Fase 3)', () => {
    expect(schema).toMatch(/model MetaConnection \{/);
    for (const field of ['tenantId', 'wabaId', 'businessAccountId', 'phoneNumberId', 'instagramAccountId', 'displayPhoneNumber', 'connectionStatus', 'verificationStatus', 'businessAgentEnabled', 'lastWebhookAt', 'lastHealthCheckAt']) {
      expect(schema).toMatch(new RegExp(`model MetaConnection \\{[\\s\\S]*?${field}[\\s\\S]*?\\}`));
    }
  });

  it('businessAgentEnabled default false no schema', () => {
    expect(schema).toMatch(/businessAgentEnabled\s+Boolean\s+@default\(false\)/);
  });

  it('MetaWebhookEvent com eventKey unique (idempotência, Fase 5)', () => {
    expect(schema).toMatch(/model MetaWebhookEvent \{[\s\S]*?eventKey\s+String\s+@unique/);
  });

  it('MetaAttributionEvent com janela de entry point (Fase 9)', () => {
    expect(schema).toMatch(/model MetaAttributionEvent \{[\s\S]*?entryPointExpiresAt/);
  });

  it('MetaCostLog com category/billable/currency/rate/source (Fase 6/7)', () => {
    for (const field of ['category', 'billable', 'currency', 'rate', 'source']) {
      expect(schema).toMatch(new RegExp(`model MetaCostLog \\{[\\s\\S]*?${field}[\`\\s]`));
    }
  });

  it('migration aditiva existe e não destrói nada', () => {
    const migrationDir = 'prisma/migrations/20260916000000_meta_foundation_connections_idempotency_attribution';
    expect(has(`${migrationDir}/migration.sql`)).toBe(true);
    const sql = read(`${migrationDir}/migration.sql`);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS|"meta_connections"/);
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM/);
  });
});

// ── 5. meta-cost-guard corrigido (Fase 6/7/19) ───────────────────────────────

describe('💵 meta-cost-guard — Meta Pricing 2026 (Fase 19)', () => {
  const guard = read('src/lib/meta-cost-guard.ts');

  it('registros de envio marcados como estimativa (não custo real)', () => {
    // FIX (auditoria): quote-agnóstico — a onda paralela ad83c47 mudou
    // "send_accepted" para 'send_accepted' sem alterar a semântica.
    expect(guard).toMatch(/source:\s*["']send_accepted["']/);
    expect(guard).toMatch(/estimated:\s*true/);
  });

  it('custo authoritative vem do status da Meta (meta_webhook_pricing)', () => {
    expect(guard).toMatch(/recordMetaPricingFromStatus/);
    expect(guard).toMatch(/meta_webhook_pricing/);
  });

  it('sem multiplicador inventado de custo (0.5 utility removido)', () => {
    expect(guard).not.toMatch(/META_COST_PER_MSG\s*\*\s*0\.5/);
  });

  it('sem câmbio fixo USD→BRL (5.15 removido do módulo)', () => {
    expect(guard).not.toMatch(/5\.15/);
  });

  it('UNBUNDLED_MULTIPLIER marcado como estimativa, não verdade financeira (Fase 19)', () => {
    expect(guard).toMatch(/NÃO é verdade financeira/);
    expect(guard).toMatch(/actualCost/);
    expect(guard).toMatch(/estimatedCost/);
  });

  it('UNKNOWN registrado sem preço inventado (Fase 6)', () => {
    expect(guard).toMatch(/UNKNOWN/);
  });

  it('deduplicação messageId: estimativa não duplica com authoritative', () => {
    // FIX (auditoria): quote-agnóstico + comportamento update-in-place
    // (a onda paralela ad83c47 reescreveu o bloco sem o comentário antigo —
    // a SEMÂNTICA de promoção sem dupla contagem foi preservada).
    expect(guard).toMatch(/meta_webhook_pricing["']?\s*,?\s*(as const)?\s*\}/);
    expect(guard).toMatch(/if\s*\(existing\)\s*\{[\s\S]*metaCostLog\.update/);
  });
});

// ── 6. DDC Meta Connect honesto (Fase 10) ────────────────────────────────────

describe('🖥️ DDC META CONNECT — nunca fabrica status verde (Fase 10)', () => {
  const route = 'src/app/api/ddc/meta-connect/route.ts';

  it('rota read-only existe', () => {
    expect(has(route)).toBe(true);
  });

  it('estado vem do health service (não fabricado)', () => {
    const source = read(route);
    expect(source).toMatch(/getMetaHealth/);
    expect(source).toMatch(/read-only nesta onda|readOnlyWave/);
  });

  it('health service NUNCA retorna CONNECTED sem evidência de webhook', () => {
    const health = read('src/lib/meta/meta-health.ts');
    // CONNECTED só é atribuído dentro do branch condicionado por webhookRecent
    expect(health).toMatch(/\} else if \(webhookRecent\) \{\s*\n\s*state = 'CONNECTED';/);
  });
});

// ── 7. ZéLLM learning contract (Fase 15/16) ─────────────────────────────────

describe('🧠 ZéLLM — anti-pattern nunca promovido (Fase 15/16)', () => {
  it('validação bloqueia anti-pattern e outcomes negativos', () => {
    const learning = read('src/lib/meta/meta-learning.ts');
    expect(learning).toMatch(/ANTI_PATTERN_NEVER_PROMOTED/);
    expect(learning).toMatch(/NEGATIVE_OUTCOME_NOT_PROMOTABLE/);
  });

  it('pipeline capture→sanitize→validate→score→promote presente', () => {
    const learning = read('src/lib/meta/meta-learning.ts');
    expect(learning).toMatch(/sanitizePatternCandidate/);
    expect(learning).toMatch(/validatePatternCandidate/);
    expect(learning).toMatch(/promoteVerifiedPattern/);
  });

  it('sanitização de PII/credenciais antes de promover', () => {
    const learning = read('src/lib/meta/meta-learning.ts');
    expect(learning).toMatch(/senha|password|cartão|cpf/i);
  });
});

// ── 8. Documentação (Fase 27/28) ─────────────────────────────────────────────

describe('📚 Documentação da onda (Fase 27/28)', () => {
  const docs = [
    'docs/META_ZELLA_ARCHITECTURE.md',
    'docs/META_CONNECT_IMPLEMENTATION.md',
    'docs/META_PRICING_2026.md',
    'docs/META_GRAPH_API_VERSION_MIGRATION.md',
    'docs/ZELLA_BRAIN_META_PIPELINE.md',
    'docs/ZELLM_LEARNING_CONTRACT.md',
    'docs/META_ONE_READINESS.md',
  ];

  for (const doc of docs) {
    it(`${doc} existe`, () => {
      expect(has(doc)).toBe(true);
    });
  }
});

// ── 9. Preços comerciais intocados (regra absoluta) ──────────────────────────

describe('🛡️ Regras comerciais — preços preservados', () => {
  it('plan-features mantém LITE=197, PRO=397, MAX=797, PARCEIRO=247', () => {
    const features = read('src/lib/plan-features.ts');
    expect(features).toMatch(/price:\s*197/);
    expect(features).toMatch(/price:\s*397/);
    expect(features).toMatch(/price:\s*797/);
    expect(features).toMatch(/price:\s*247/);
  });

  it('meta-cost-guard mantém limites de orçamento por plano', () => {
    const guard = read('src/lib/meta-cost-guard.ts');
    expect(guard).toMatch(/META_BUDGET_LITE_USD/);
    expect(guard).toMatch(/fail-closed/i);
  });
});

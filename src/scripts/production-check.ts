/**
 * ZÉLLA PRODUCTION PREFLIGHT — P0 GO/NO-GO GATE
 *
 * The preflight is intentionally fail-closed in production. It verifies
 * configuration plus live PostgreSQL/Redis reachability without exposing
 * provider credentials or low-level exception details.
 */
import { db } from '../lib/db';
import { getRedisConnection } from '../lib/queue/bullmq-queue';
import { encryptSecret, decryptSecret } from '../lib/security/secret-vault';
import { checkSystemHealth } from '../lib/monitoring/health';

interface CheckItem {
  id: string;
  name: string;
  category: 'ENV' | 'DATABASE' | 'REDIS' | 'SECRETS' | 'HEALTH';
  isP0: boolean;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(name: string, value: string | undefined): CheckItem {
  const configured = typeof value === 'string' && value.trim().length > 0;
  return {
    id: `ENV-${name}`,
    name: `${name} configurada`,
    category: 'ENV',
    isP0: isProduction,
    status: configured ? 'PASS' : isProduction ? 'FAIL' : 'WARN',
    details: configured ? 'Configurada.' : isProduction ? 'Obrigatória em produção.' : 'Ausente fora de produção; permitido apenas em dev/testes.',
  };
}

async function runProductionPreflight(): Promise<void> {
  const checks: CheckItem[] = [];

  const hasAppUrl = !!process.env.NEXTAUTH_URL || !!process.env.NEXT_PUBLIC_APP_URL;
  checks.push({
    id: 'ENV-01',
    name: 'URL canônica da aplicação',
    category: 'ENV',
    isP0: isProduction,
    status: hasAppUrl ? 'PASS' : isProduction ? 'FAIL' : 'WARN',
    details: hasAppUrl ? 'URL canônica configurada.' : isProduction ? 'NEXTAUTH_URL ou NEXT_PUBLIC_APP_URL é obrigatória.' : 'Ausente fora de produção.',
  });
  checks.push(requiredInProduction('DATABASE_URL', process.env.DATABASE_URL));
  checks.push(requiredInProduction('NEXTAUTH_SECRET', process.env.NEXTAUTH_SECRET));
  checks.push(requiredInProduction('REDIS_URL', process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING));

  try {
    await db.$queryRaw`SELECT 1`;
    checks.push({
      id: 'DB-01',
      name: 'Conectividade PostgreSQL',
      category: 'DATABASE',
      isP0: true,
      status: 'PASS',
      details: 'PostgreSQL respondeu ao health query.',
    });
  } catch {
    checks.push({
      id: 'DB-01',
      name: 'Conectividade PostgreSQL',
      category: 'DATABASE',
      isP0: true,
      status: 'FAIL',
      details: 'PostgreSQL não respondeu ao health query.',
    });
  }

  try {
    const encrypted = encryptSecret('zella_preflight_secret_validation_string_123');
    const decrypted = decryptSecret(encrypted);
    const vaultOk = decrypted === 'zella_preflight_secret_validation_string_123' && encrypted.startsWith('v1:');
    checks.push({
      id: 'SEC-01',
      name: 'Secret Vault AES-256-GCM',
      category: 'SECRETS',
      isP0: true,
      status: vaultOk ? 'PASS' : 'FAIL',
      details: vaultOk ? 'Round-trip criptográfico validado.' : 'Round-trip criptográfico inválido.',
    });
  } catch {
    checks.push({
      id: 'SEC-01',
      name: 'Secret Vault AES-256-GCM',
      category: 'SECRETS',
      isP0: true,
      status: 'FAIL',
      details: 'Secret Vault não conseguiu completar o round-trip.',
    });
  }

  const redis = getRedisConnection();
  if (!redis) {
    checks.push({
      id: 'REDIS-01',
      name: 'Conectividade Redis / BullMQ',
      category: 'REDIS',
      isP0: isProduction,
      status: isProduction ? 'FAIL' : 'WARN',
      details: isProduction ? 'Redis persistente é obrigatório em produção.' : 'Redis ausente fora de produção.',
    });
  } else {
    try {
      await redis.ping();
      checks.push({
        id: 'REDIS-01',
        name: 'Conectividade Redis / BullMQ',
        category: 'REDIS',
        isP0: true,
        status: 'PASS',
        details: 'Redis respondeu PONG.',
      });
    } catch {
      checks.push({
        id: 'REDIS-01',
        name: 'Conectividade Redis / BullMQ',
        category: 'REDIS',
        isP0: true,
        status: 'FAIL',
        details: 'Redis não respondeu ao PING.',
      });
    }
  }

  try {
    const health = await checkSystemHealth();
    const healthy = health.status === 'healthy';
    checks.push({
      id: 'HEALTH-01',
      name: 'Health & readiness',
      category: 'HEALTH',
      isP0: true,
      status: healthy ? 'PASS' : isProduction ? 'FAIL' : 'WARN',
      details: healthy ? 'Dependências críticas reportadas como saudáveis.' : 'Health global não está saudável.',
    });
  } catch {
    checks.push({
      id: 'HEALTH-01',
      name: 'Health & readiness',
      category: 'HEALTH',
      isP0: true,
      status: 'FAIL',
      details: 'Health check não pôde ser concluído.',
    });
  }

  let hasP0Failure = false;
  for (const check of checks) {
    const icon = check.status === 'PASS' ? '🟢 PASS' : check.status === 'WARN' ? '🟡 WARN' : '🔴 FAIL';
    console.log(`${check.id.padEnd(12)} | ${check.category.padEnd(9)} | ${check.isP0 ? 'P0' : 'P1'} | ${icon} | ${check.details}`);
    if (check.isP0 && check.status !== 'PASS') hasP0Failure = true;
  }

  if (hasP0Failure) {
    console.error('\n🔴 VEREDITO: NO-GO — requisito P0 não aprovado.');
    process.exitCode = 1;
    return;
  }

  console.log('\n🟢 VEREDITO: GO — todos os requisitos P0 foram aprovados.');
}

runProductionPreflight().catch(() => {
  console.error('Falha fatal no preflight de produção.');
  process.exitCode = 1;
});

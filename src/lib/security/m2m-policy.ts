/**
 * M2M SECURITY POLICY & CLIENT CREDENTIALS VAULT
 * - Client secrets are bcrypt hashes only.
 * - Scope authorization is explicit and allow-listed.
 * - Plaintext client-secret environment fallbacks are forbidden.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type CronScope = 'cerebro:read' | 'billing:read' | 'reports:read' | 'cerebro:write' | 'admin:all';

export interface M2MClientPolicy {
  clientId: string;
  secretHash: string;
  allowedScopes: CronScope[];
  description: string;
  active: boolean;
}

const revokedJtis = new Set<string>();
const KNOWN_SCOPES = new Set<CronScope>(['cerebro:read', 'billing:read', 'reports:read', 'cerebro:write', 'admin:all']);

function configuredHash(envName: string): string {
  const value = process.env[envName];
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value) ? value : '';
}

export const M2M_CLIENT_REGISTRY: Record<string, M2MClientPolicy> = {
  'cron-cerebro-analyze': {
    clientId: 'cron-cerebro-analyze',
    secretHash: configuredHash('ZELLA_M2M_CEREBRO_HASH'),
    allowedScopes: ['cerebro:read', 'cerebro:write'],
    description: 'Robô de Análise Neural Periódica do Cérebro Zélla',
    active: Boolean(configuredHash('ZELLA_M2M_CEREBRO_HASH')),
  },
  'cron-budget-forecast': {
    clientId: 'cron-budget-forecast',
    secretHash: configuredHash('ZELLA_M2M_BILLING_HASH'),
    allowedScopes: ['billing:read', 'cerebro:read'],
    description: 'Robô de Previsão Orçamentária e Consumo de Tokens',
    active: Boolean(configuredHash('ZELLA_M2M_BILLING_HASH')),
  },
  'cron-weekly-report': {
    clientId: 'cron-weekly-report',
    secretHash: configuredHash('ZELLA_M2M_REPORTS_HASH'),
    allowedScopes: ['reports:read'],
    description: 'Robô de Geração de Relatórios Semanais de Performance',
    active: Boolean(configuredHash('ZELLA_M2M_REPORTS_HASH')),
  },
};

export function registerM2MClient(client: M2MClientPolicy): void {
  if (!client.clientId || !client.secretHash || !/^\$2[aby]\$\d{2}\$/.test(client.secretHash)) throw new Error('M2M_SECRET_MUST_BE_BCRYPT_HASH');
  if (!client.allowedScopes.every(scope => KNOWN_SCOPES.has(scope))) throw new Error('M2M_SCOPE_NOT_ALLOWED');
  M2M_CLIENT_REGISTRY[client.clientId] = { ...client, secretHash: client.secretHash };
}

export async function hashClientSecret(plainSecret: string): Promise<string> {
  if (!plainSecret || plainSecret.length < 32) throw new Error('M2M_SECRET_TOO_WEAK');
  return bcrypt.hash(plainSecret, 12);
}

function loadDynamicHashedClient(clientId: string): M2MClientPolicy | undefined {
  const raw = process.env.ZELLA_M2M_CLIENT_HASHES;
  if (!raw) return undefined;
  for (const entry of raw.split(';').filter(Boolean)) {
    const [cId, hash, scopesStr] = entry.split(':');
    if (cId !== clientId || !hash || !/^\$2[aby]\$\d{2}\$/.test(hash)) continue;
    const scopes = (scopesStr ? scopesStr.split(',') : []).filter((scope): scope is CronScope => KNOWN_SCOPES.has(scope as CronScope));
    return { clientId: cId, secretHash: hash, allowedScopes: scopes, description: 'Dynamic Hashed Env Client', active: true };
  }
  return undefined;
}

export async function verifyM2MClientCredentials(
  clientId: string,
  providedSecret: string,
  requestedScope: CronScope
): Promise<{ valid: boolean; reason?: string; client?: M2MClientPolicy }> {
  const client = M2M_CLIENT_REGISTRY[clientId] || loadDynamicHashedClient(clientId);
  if (!client || !client.active) return { valid: false, reason: 'CLIENT_NOT_FOUND_OR_INACTIVE' };
  if (!KNOWN_SCOPES.has(requestedScope) || !client.allowedScopes.includes(requestedScope)) return { valid: false, reason: 'UNAUTHORIZED_SCOPE' };
  if (requestedScope === 'admin:all' && process.env.ZELLA_M2M_ADMIN_CLIENT_ID !== clientId) return { valid: false, reason: 'ADMIN_SCOPE_NOT_AUTHORIZED' };
  if (!providedSecret || providedSecret.length < 32) return { valid: false, reason: 'INVALID_CLIENT_SECRET' };

  const secretMatches = await bcrypt.compare(providedSecret, client.secretHash);
  if (!secretMatches) return { valid: false, reason: 'INVALID_CLIENT_SECRET' };
  return { valid: true, client };
}

export function revokeJti(jti: string): void {
  if (jti) revokedJtis.add(jti);
}

export function isJtiRevoked(jti?: string): boolean {
  return Boolean(jti && revokedJtis.has(jti));
}

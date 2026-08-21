// =============================================================================
// 🔐 SEU ZÉLLA — OAuth Token Store para Fechaduras Eletrônicas
// Armazenamento seguro de tokens OAuth2 com criptografia autenticada AES-256-GCM
// =============================================================================
import { db, isDatabaseAvailable } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/encryption';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

export type LockOAuthProvider = 'ttlock' | 'tuya' | 'igloohome' | 'nuki' | 'august';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
  externalAccountId: string;
  displayName?: string | null;
  oauthAccountId: string;
}

export interface UpsertOAuthInput {
  tenantId?: string;
  provider: LockOAuthProvider;
  externalAccountId: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface TokenRefresher {
  refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }>;
}

interface CacheEntry { tokens: OAuthTokens; expiresAt: number; }
const _tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;
const _refreshLocks = new Map<string, Promise<OAuthTokens | null>>();

function cacheKey(tenantId: string, provider: string, externalAccountId: string): string {
  return `${tenantId}:${provider}:${externalAccountId}`;
}

function validateTokenMaterial(input: Pick<UpsertOAuthInput, 'externalAccountId' | 'accessToken' | 'refreshToken' | 'expiresIn'>): void {
  if (!input.externalAccountId?.trim() || input.externalAccountId.length > 256) throw new Error('INVALID_OAUTH_ACCOUNT_ID');
  if (!input.accessToken?.trim() || input.accessToken.length > 8192) throw new Error('INVALID_OAUTH_ACCESS_TOKEN');
  if (input.refreshToken !== undefined && input.refreshToken.length > 8192) throw new Error('INVALID_OAUTH_REFRESH_TOKEN');
  if (input.expiresIn !== undefined && (!Number.isFinite(input.expiresIn) || input.expiresIn < 0 || input.expiresIn > 31_536_000)) throw new Error('INVALID_OAUTH_EXPIRY');
}

export async function getValidTokens(providerName: LockOAuthProvider, externalAccountId?: string, refresher?: TokenRefresher): Promise<OAuthTokens | null> {
  if (!isDatabaseAvailable()) return null;
  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId) return null;
  const normalizedExternalId = externalAccountId?.trim() || undefined;
  if (normalizedExternalId && normalizedExternalId.length > 256) return null;
  const lookupKey = normalizedExternalId ? cacheKey(tenantId, providerName, normalizedExternalId) : null;
  if (lookupKey) {
    const cached = _tokenCache.get(lookupKey);
    if (cached && cached.expiresAt > Date.now()) return cached.tokens;
  }

  const account = await db.lockOAuthAccount.findFirst({
    where: { tenantId, provider: providerName, ...(normalizedExternalId ? { externalAccountId: normalizedExternalId } : {}), status: 'active' },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => null);
  if (!account) return null;

  let accessToken: string;
  let refreshToken: string | null = null;
  try {
    accessToken = decryptText(account.accessToken);
    refreshToken = account.refreshToken ? decryptText(account.refreshToken) : null;
  } catch (err) {
    console.error(`[oauth-store] Token decryption failed for provider ${providerName}`);
    await db.lockOAuthAccount.update({ where: { id: account.id }, data: { status: 'expired' } }).catch(() => null);
    return null;
  }
  if (!accessToken) return null;

  const tokens: OAuthTokens = { accessToken, refreshToken, expiresAt: account.expiresAt, externalAccountId: account.externalAccountId, displayName: account.displayName, oauthAccountId: account.id };
  const now = Date.now();
  const expiresAtMs = tokens.expiresAt ? tokens.expiresAt.getTime() : 0;
  const needsRefresh = !expiresAtMs || expiresAtMs - now < 60_000;

  if (needsRefresh && tokens.refreshToken && refresher) {
    const lockKey = cacheKey(tenantId, providerName, account.externalAccountId);
    if (!_refreshLocks.has(lockKey)) {
      _refreshLocks.set(lockKey, (async () => {
        try {
          const refreshed = await refresher.refreshTokens(tokens.refreshToken!);
          validateTokenMaterial({ externalAccountId: account.externalAccountId, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken ?? tokens.refreshToken ?? undefined, expiresIn: refreshed.expiresIn });
          const updated = await upsertOAuthAccount({ tenantId, provider: providerName, externalAccountId: account.externalAccountId, displayName: account.displayName ?? undefined, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken ?? tokens.refreshToken ?? undefined, expiresIn: refreshed.expiresIn });
          const newTokens: OAuthTokens = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken ?? tokens.refreshToken, expiresAt: updated.expiresAt, externalAccountId: account.externalAccountId, displayName: account.displayName, oauthAccountId: account.id };
          _tokenCache.set(lockKey, { tokens: newTokens, expiresAt: Date.now() + CACHE_TTL_MS });
          return newTokens;
        } catch (err) {
          console.error(`[oauth-store] Refresh failed for provider ${providerName}`);
          await db.lockOAuthAccount.update({ where: { id: account.id }, data: { status: 'expired' } }).catch(() => null);
          return null;
        } finally { setTimeout(() => _refreshLocks.delete(lockKey), 2_000); }
      })());
    }
    return await _refreshLocks.get(lockKey)!;
  }

  if (lookupKey) _tokenCache.set(lookupKey, { tokens, expiresAt: Date.now() + CACHE_TTL_MS });
  return tokens;
}

export async function upsertOAuthAccount(input: UpsertOAuthInput): Promise<{ id: string; expiresAt: Date | null }> {
  const tenantId = input.tenantId ?? (await resolveTenantId().catch(() => null));
  if (!tenantId) throw new Error('TENANT_NOT_RESOLVED');
  validateTokenMaterial(input);
  const expiresAt = input.expiresIn !== undefined ? new Date(Date.now() + input.expiresIn * 1000) : null;
  const encryptedAccess = encryptText(input.accessToken.trim());
  const encryptedRefresh = input.refreshToken ? encryptText(input.refreshToken) : null;

  const existing = await db.lockOAuthAccount.findFirst({ where: { tenantId, provider: input.provider, externalAccountId: input.externalAccountId.trim() } }).catch(() => null);
  if (existing) {
    const updated = await db.lockOAuthAccount.update({ where: { id: existing.id }, data: { accessToken: encryptedAccess, refreshToken: encryptedRefresh, expiresAt, status: 'active', displayName: input.displayName?.trim() || existing.displayName || null, lastSyncAt: new Date() } });
    _tokenCache.delete(cacheKey(tenantId, input.provider, input.externalAccountId.trim()));
    return { id: updated.id, expiresAt: updated.expiresAt };
  }
  const created = await db.lockOAuthAccount.create({ data: { tenantId, provider: input.provider, externalAccountId: input.externalAccountId.trim(), displayName: input.displayName?.trim() || null, accessToken: encryptedAccess, refreshToken: encryptedRefresh, expiresAt, status: 'active', lastSyncAt: new Date() } });
  return { id: created.id, expiresAt: created.expiresAt };
}

export async function revokeOAuthAccount(provider: LockOAuthProvider, externalAccountId: string): Promise<void> {
  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId || !externalAccountId?.trim()) return;
  await db.lockOAuthAccount.updateMany({ where: { tenantId, provider, externalAccountId: externalAccountId.trim() }, data: { status: 'revoked' } }).catch(() => null);
  _tokenCache.delete(cacheKey(tenantId, provider, externalAccountId.trim()));
}

export async function listOAuthAccounts(): Promise<Array<{ id: string; provider: LockOAuthProvider; externalAccountId: string; displayName: string | null; status: string; expiresAt: Date | null; lastSyncAt: Date | null }>> {
  if (!isDatabaseAvailable()) return [];
  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId) return [];
  return db.lockOAuthAccount.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, select: { id: true, provider: true, externalAccountId: true, displayName: true, status: true, expiresAt: true, lastSyncAt: true } }) as Promise<Array<{ id: string; provider: LockOAuthProvider; externalAccountId: string; displayName: string | null; status: string; expiresAt: Date | null; lastSyncAt: Date | null }>>;
}

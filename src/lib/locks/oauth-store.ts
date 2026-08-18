// =============================================================================
// 🔐 SEU ZÉLLA — OAuth Token Store para Fechaduras
// =============================================================================
// Camada de persistência + refresh de tokens OAuth2 para os providers de
// fechaduras (TTLock, Tuya, Igloohome, Nuki, August).
//
// Responsabilidades:
// 1. Carregar tokens do DB (LockOAuthAccount) — descriptografados com AES-256-GCM
// 2. Detectar tokens expirados e renovar via refresh_token
// 3. Persistir tokens renovados de volta ao DB
// 4. Padronizar a interface para todos os providers consumirem
//
// Segurança:
// - Tokens NUNCA ficam em memória além da chamada
// - AccessToken/RefreshToken são AES-256-GCM encrypted-at-rest
// - Refresh automático com lock distribuído simples (cache em memória por 30s)
// =============================================================================

import { db, isDatabaseAvailable } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/encryption';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

/** Tipo do provider OAuth — alinhado com coluna `provider` em LockOAuthAccount. */
export type LockOAuthProvider = 'ttlock' | 'tuya' | 'igloohome' | 'nuki' | 'august';

/** Tokens descriptografados em memória — nunca persistir assim. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
  externalAccountId: string;
  displayName?: string | null;
  oauthAccountId: string;
}

/** Payload para criar/atualizar uma conta OAuth. */
export interface UpsertOAuthInput {
  tenantId?: string;
  provider: LockOAuthProvider;
  externalAccountId: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // segundos até expirar
}

/** Interface que todo provider OAuth deve implementar para refresh. */
export interface TokenRefresher {
  /** Endpoint de refresh do provider — retorna novos tokens. */
  refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
}

// Cache in-memory de tokens por (tenantId, provider, externalAccountId) — TTL 30s
// Evita N refreshes concorrentes se N requisições chegarem simultaneamente
interface CacheEntry {
  tokens: OAuthTokens;
  expiresAt: number; // epoch ms
}
const _tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

// Lock de refresh para evitar thundering herd
const _refreshLocks = new Map<string, Promise<OAuthTokens | null>>();

function cacheKey(tenantId: string, provider: string, externalAccountId: string): string {
  return `${tenantId}:${provider}:${externalAccountId}`;
}

/**
 * Busca tokens OAuth de um tenant para um provider — com refresh automático.
 *
 * @param providerName nome do provider (ttlock, tuya, etc.)
 * @param externalAccountId ID da conta no provedor (opcional — busca primeiro se omitido)
 * @param refresher implementação de refresh do provider (necessário para refresh)
 */
export async function getValidTokens(
  providerName: LockOAuthProvider,
  externalAccountId?: string,
  refresher?: TokenRefresher,
): Promise<OAuthTokens | null> {
  if (!isDatabaseAvailable()) return null;

  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId) return null;

  // 1. Busca no cache em memória (válido por 30s)
  const lookupKey = externalAccountId
    ? cacheKey(tenantId, providerName, externalAccountId)
    : null;
  if (lookupKey) {
    const cached = _tokenCache.get(lookupKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tokens;
    }
  }

  // 2. Busca no DB
  const account = await db.lockOAuthAccount.findFirst({
    where: {
      tenantId,
      provider: providerName,
      ...(externalAccountId ? { externalAccountId } : {}),
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => null);

  if (!account) return null;

  // 3. Descriptografa
  const tokens: OAuthTokens = {
    accessToken: decryptText(account.accessToken),
    refreshToken: account.refreshToken ? decryptText(account.refreshToken) : null,
    expiresAt: account.expiresAt,
    externalAccountId: account.externalAccountId,
    displayName: account.displayName,
    oauthAccountId: account.id,
  };

  // 4. Verifica expiração — se falta < 60s, tenta refresh
  const now = Date.now();
  const expiresAtMs = tokens.expiresAt ? tokens.expiresAt.getTime() : 0;
  const needsRefresh = !expiresAtMs || expiresAtMs - now < 60_000;

  if (needsRefresh && tokens.refreshToken && refresher) {
    const lockKey = cacheKey(tenantId, providerName, account.externalAccountId);

    // Evita thundering herd — se já tem um refresh em curso, aguarda
    if (!_refreshLocks.has(lockKey)) {
      _refreshLocks.set(
        lockKey,
        (async () => {
          try {
            const refreshed = await refresher.refreshTokens(tokens.refreshToken!);
            const updated = await upsertOAuthAccount({
              tenantId,
              provider: providerName,
              externalAccountId: account.externalAccountId,
              displayName: account.displayName ?? undefined,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? tokens.refreshToken ?? undefined,
              expiresIn: refreshed.expiresIn,
            });
            const newTokens: OAuthTokens = {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
              expiresAt: updated.expiresAt,
              externalAccountId: account.externalAccountId,
              displayName: account.displayName,
              oauthAccountId: account.id,
            };
            _tokenCache.set(lockKey, {
              tokens: newTokens,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return newTokens;
          } catch (err) {
            console.error(`[oauth-store] Refresh failed for ${providerName}/${account.externalAccountId}:`, err);
            // Marca conta como expired se refresh falhou
            await db.lockOAuthAccount.update({
              where: { id: account.id },
              data: { status: 'expired' },
            }).catch(() => null);
            return null;
          } finally {
            // Mantém o lock por 2s extra para evitar retry imediato
            setTimeout(() => _refreshLocks.delete(lockKey), 2_000);
          }
        })(),
      );
    }
    return await _refreshLocks.get(lockKey)!;
  }

  // 5. Cache hit válido
  if (lookupKey) {
    _tokenCache.set(lookupKey, {
      tokens,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  return tokens;
}

/**
 * Cria ou atualiza uma conta OAuth (criptografando tokens).
 * Retorna a conta atualizada com expiresAt calculado.
 */
export async function upsertOAuthAccount(input: UpsertOAuthInput): Promise<{
  id: string;
  expiresAt: Date | null;
}> {
  const tenantId = input.tenantId ?? (await resolveTenantId().catch(() => null));
  if (!tenantId) throw new Error('Tenant não resolvido para upsert OAuth');

  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000)
    : null;

  const encryptedAccess = encryptText(input.accessToken);
  const encryptedRefresh = input.refreshToken ? encryptText(input.refreshToken) : null;

  // Upsert: se já existe (tenantId, provider, externalAccountId), atualiza
  const existing = await db.lockOAuthAccount.findFirst({
    where: {
      tenantId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
    },
  }).catch(() => null);

  if (existing) {
    const updated = await db.lockOAuthAccount.update({
      where: { id: existing.id },
      data: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt,
        status: 'active',
        displayName: input.displayName ?? existing.displayName ?? null,
        lastSyncAt: new Date(),
      },
    });
    // Invalida cache
    _tokenCache.delete(cacheKey(tenantId, input.provider, input.externalAccountId));
    return { id: updated.id, expiresAt: updated.expiresAt };
  }

  const created = await db.lockOAuthAccount.create({
    data: {
      tenantId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      displayName: input.displayName ?? null,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt,
      status: 'active',
      lastSyncAt: new Date(),
    },
  });
  return { id: created.id, expiresAt: created.expiresAt };
}

/**
 * Revoga (soft-delete) uma conta OAuth — mantém registro para auditoria LGPD.
 */
export async function revokeOAuthAccount(
  provider: LockOAuthProvider,
  externalAccountId: string,
): Promise<void> {
  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId) return;

  await db.lockOAuthAccount.updateMany({
    where: { tenantId, provider, externalAccountId },
    data: { status: 'revoked' },
  }).catch(() => null);

  _tokenCache.delete(cacheKey(tenantId, provider, externalAccountId));
}

/**
 * Lista todas as contas OAuth ativas de um tenant (para exibição na UI).
 * Retorna apenas metadados — sem tokens.
 */
export async function listOAuthAccounts(): Promise<
  Array<{
    id: string;
    provider: LockOAuthProvider;
    externalAccountId: string;
    displayName: string | null;
    status: string;
    expiresAt: Date | null;
    lastSyncAt: Date | null;
  }>
> {
  if (!isDatabaseAvailable()) return [];
  const tenantId = await resolveTenantId().catch(() => null);
  if (!tenantId) return [];

  return db.lockOAuthAccount.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      provider: true,
      externalAccountId: true,
      displayName: true,
      status: true,
      expiresAt: true,
      lastSyncAt: true,
    },
  }) as Promise<Array<{
    id: string;
    provider: LockOAuthProvider;
    externalAccountId: string;
    displayName: string | null;
    status: string;
    expiresAt: Date | null;
    lastSyncAt: Date | null;
  }>>;
}

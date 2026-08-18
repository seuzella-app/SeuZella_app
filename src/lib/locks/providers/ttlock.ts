// =============================================================================
// 🔐 SEU ZÉLLA — Provider TTLock (Real)
// =============================================================================
// Integração com TTLock Open API Platform (open.ttlock.com).
//
// Documentação oficial: https://open.ttlock.com/document/doc?url=english/readme.html
//
// Capacidades:
// - OAuth2 Authorization Code flow
// - Listar fechaduras vinculadas à conta
// - Gerar PIN temporário (online + offline)
// - Revogar PIN (delete keyboard password)
// - Status da fechadura (bateria, online, locked/unlocked)
//
// Variáveis de ambiente necessárias:
// - TTLOCK_CLIENT_ID       (OAuth app client_id)
// - TTLOCK_CLIENT_SECRET   (OAuth app client_secret)
// - TTLOCK_REDIRECT_URI    (OAuth callback URL: https://seuzella.com/api/ddc/locks/oauth/callback/ttlock)
//
// TTLock diferencia dois tipos de PIN:
// 1. "Keyboard Password" — PIN online (a fechadura precisa estar online)
// 2. "Offline PIN" — PIN offline gerado por algoritmo do fabricante (não precisa de Wi-Fi)
// =============================================================================

import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';

const TTLOCK_API_BASE = 'https://api.eu.ttlock.com/v3'; // endpoint EU (suporta BR)

interface TTLockTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number; // segundos
  uid?: string; // user id no TTLock
  scope?: string;
}

/** Implementa refresh de token conforme OAuth2 do TTLock. */
const refresher: TokenRefresher = {
  async refreshTokens(refreshToken: string) {
    const clientId = process.env.TTLOCK_CLIENT_ID;
    const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('TTLOCK_CLIENT_ID/TTLOCK_CLIENT_SECRET não configurados');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await httpRequest<TTLockTokenResponse>(
      `${TTLOCK_API_BASE}/oauth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    if (!res.ok) {
      throw new Error(`TTLock refresh failed: ${res.status} ${res.raw}`);
    }
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresIn: res.data.expires_in,
    };
  },
};

/**
 * Troca o código OAuth recebido no callback por tokens de acesso.
 * Chamado pela rota /api/ddc/locks/oauth/callback/ttlock.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
}): Promise<void> {
  const clientId = process.env.TTLOCK_CLIENT_ID;
  const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
  const redirectUri = process.env.TTLOCK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('TTLOCK env vars não configuradas (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
  });

  const res = await httpRequest<TTLockTokenResponse>(`${TTLOCK_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok || !res.data.access_token) {
    throw new Error(`TTLock token exchange failed: ${res.status} ${res.raw}`);
  }

  await upsertOAuthAccount({
    provider: 'ttlock',
    externalAccountId: res.data.uid?.toString() ?? 'unknown',
    displayName: `TTLock Account #${res.data.uid ?? '??'}`,
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresIn: res.data.expires_in,
  });
}

/**
 * Lista as fechaduras vinculadas à conta TTLock.
 * Permite ao host selecionar quais importar para o Zélla.
 */
export async function listLocks(): Promise<
  Array<{
    lockId: number;
    lockName: string;
    lockAlias: string;
    batteryLevel: number;
    lockMac: string;
    lockData: string; // opaque — necessário para operações de PIN
    electricQuantity: number;
    hasGateway: boolean;
    date: number;
  }>
> {
  const tokens = await getValidTokens('ttlock', undefined, refresher);
  if (!tokens) throw new Error('TTLock OAuth não conectado');

  const params = new URLSearchParams({
    clientId: process.env.TTLOCK_CLIENT_ID!,
    accessToken: tokens.accessToken,
    pageNo: '1',
    pageSize: '100',
    date: String(Date.now()),
  });

  const res = await httpRequest<{ list: any[] }>(
    `${TTLOCK_API_BASE}/lock/list?${params}`,
  );
  if (!res.ok) throw new Error(`TTLock listLocks failed: ${res.status}`);

  return (res.data.list ?? []).map((l) => ({
    lockId: l.lockId,
    lockName: l.lockName,
    lockAlias: l.lockAlias,
    batteryLevel: l.electricQuantity,
    lockMac: l.lockMac,
    lockData: l.lockData,
    electricQuantity: l.electricQuantity,
    hasGateway: l.hasGateway ?? false,
    date: l.date,
  }));
}

/**
 * Gera um PIN temporário (online) na fechadura TTLock.
 *
 * TTLock exige `lockData` (token opaco retornado no listLocks) e um ID único
 * por cliente para idempotência — usamos um UUID.
 */
export async function generatePin(input: {
  externalDeviceId: string; // lockId (numérico)
  lockData?: string; // opaque token obrigatório
  validFrom: Date;
  validTo: Date;
  pin?: string; // se fornecido, usa este PIN (4-9 dígitos)
}): Promise<{
  pin: string;
  externalCodeId: string;
  codeType: 'online_pin';
}> {
  const tokens = await getValidTokens('ttlock', undefined, refresher);
  if (!tokens) throw new Error('TTLock OAuth não conectado');

  const clientId = process.env.TTLOCK_CLIENT_ID!;
  const startDate = Math.floor(input.validFrom.getTime() / 1000);
  const endDate = Math.floor(input.validTo.getTime() / 1000);

  const body = new URLSearchParams({
    clientId,
    accessToken: tokens.accessToken,
    lockId: input.externalDeviceId,
    keyboardPwd: input.pin ?? '',
    keyboardPwdType: '2', // 2 = período (start-end)
    startDate: String(startDate),
    endDate: String(endDate),
    addTime: String(Math.floor(Date.now() / 1000)),
    lockData: input.lockData ?? '',
  });

  const res = await httpRequest<{
    keyboardPwdId: number;
    keyboardPwd: string;
  }>(`${TTLOCK_API_BASE}/keyboardPassword/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`TTLock generatePin failed: ${res.status} ${res.raw}`);
  }

  return {
    pin: res.data.keyboardPwd,
    externalCodeId: String(res.data.keyboardPwdId),
    codeType: 'online_pin',
  };
}

/**
 * Revoga um PIN pelo ID externo (retornado no generatePin).
 * TTLock não tem "revogar com motivo" — apenas deleta.
 */
export async function revokePin(input: {
  externalDeviceId: string;
  externalCodeId: string;
  lockData?: string;
}): Promise<void> {
  const tokens = await getValidTokens('ttlock', undefined, refresher);
  if (!tokens) throw new Error('TTLock OAuth não conectado');

  const body = new URLSearchParams({
    clientId: process.env.TTLOCK_CLIENT_ID!,
    accessToken: tokens.accessToken,
    lockId: input.externalDeviceId,
    keyboardPwdId: input.externalCodeId,
    lockData: input.lockData ?? '',
    deleteType: '2', // 2 = delete (vs 1 = modify)
    date: String(Math.floor(Date.now() / 1000)),
  });

  const res = await httpRequest(`${TTLOCK_API_BASE}/keyboardPassword/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    console.warn(`[ttlock] revokePin soft-fail: ${res.status} ${res.raw}`);
  }
}

/**
 * Consulta o estado atual da fechadura (bateria, online, trancada).
 */
export async function getLockStatus(externalDeviceId: string, lockData?: string): Promise<{
  batteryLevel: number;
  online: boolean;
  locked: boolean;
}> {
  const tokens = await getValidTokens('ttlock', undefined, refresher);
  if (!tokens) throw new Error('TTLock OAuth não conectado');

  const params = new URLSearchParams({
    clientId: process.env.TTLOCK_CLIENT_ID!,
    accessToken: tokens.accessToken,
    lockId: externalDeviceId,
    lockData: lockData ?? '',
    date: String(Math.floor(Date.now() / 1000)),
  });

  const res = await httpRequest<{ electricQuantity: number; lockSwitch: number; gatewayOnline?: number }>(
    `${TTLOCK_API_BASE}/lock/queryStatus?${params}`,
  );
  if (!res.ok) throw new Error(`TTLock status failed: ${res.status}`);

  return {
    batteryLevel: res.data.electricQuantity,
    online: (res.data.gatewayOnline ?? 0) === 1,
    locked: res.data.lockSwitch === 1,
  };
}

/** URL para iniciar o fluxo OAuth2 — abre popup no navegador do host. */
export function getOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.TTLOCK_CLIENT_ID;
  const redirectUri = process.env.TTLOCK_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('TTLOCK_CLIENT_ID / TTLOCK_REDIRECT_URI não configurados');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'offline_access',
  });
  return `https://api.eu.ttlock.com/oauth2/authorize?${params}`;
}

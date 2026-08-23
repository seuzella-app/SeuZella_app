// =============================================================================
// 🔐 SEU ZÉLLA — Provider Nuki (Real)
// =============================================================================
// Integração com Nuki Web API (developer.nuki.io).
//
// Documentação: https://developer.nuki.io/page/nuki-web-api-1-13-1/13
//
// Diferenças do Nuki vs outros providers:
// 1. PIN é gerado no Keypad (Nuki Keypad 2.0) — não no Smart Lock
// 2. PINs podem ser: permanent, temporary (time-bounded), recurring
// 3. PIN é 6 dígitos numérico (sem sufixo #)
// 4. Web API permite remote unlock (único com essa capacidade)
//
// Capacidades:
// - OAuth2 Authorization Code flow
// - Listar Smart Locks e Keypads do account
// - Criar PIN temporário no Keypad (time-bounded)
// - Revogar PIN (deletar authorization)
// - Status (bateria do Smart Lock + Keypad, online)
// - Remote unlock (extra)
//
// Variáveis de ambiente:
// - NUKI_CLIENT_ID
// - NUKI_CLIENT_SECRET
// - NUKI_REDIRECT_URI
// =============================================================================

import { randomInt } from 'crypto';
import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';

const NUKI_BASE = 'https://api.nuki.io';

interface NukiTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  account_id?: number;
}

const refresher: TokenRefresher = {
  async refreshTokens(refreshToken: string) {
    const clientId = process.env.NUKI_CLIENT_ID;
    const clientSecret = process.env.NUKI_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('NUKI env vars não configuradas');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await httpRequest<NukiTokenResponse>(`${NUKI_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok || !res.data.access_token) {
      throw new Error(`Nuki refresh failed: ${res.status} ${res.raw}`);
    }
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresIn: res.data.expires_in,
    };
  },
};

export async function exchangeCodeForTokens(params: { code: string }): Promise<void> {
  const clientId = process.env.NUKI_CLIENT_ID;
  const clientSecret = process.env.NUKI_CLIENT_SECRET;
  const redirectUri = process.env.NUKI_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('NUKI env vars não configuradas');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await httpRequest<NukiTokenResponse>(`${NUKI_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok || !res.data.access_token) {
    throw new Error(`Nuki token exchange failed: ${res.status} ${res.raw}`);
  }

  await upsertOAuthAccount({
    provider: 'nuki',
    externalAccountId: res.data.account_id?.toString() ?? 'unknown',
    displayName: `Nuki Account #${res.data.account_id ?? '??'}`,
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresIn: res.data.expires_in,
  });
}

interface NukiSmartLock {
  smartlockId: number;
  type: number;
  name: string;
  state: {
    state: number; // 0=uncalibrated, 1=locked, 2=unlocking, 3=unlocked, 5=locking
    online: boolean;
    batteryCharge: number;
    batteryCritical: boolean;
  };
}

/**
 * Lista Smart Locks do usuário.
 */
export async function listLocks(): Promise<
  Array<{
    deviceId: string;
    name: string;
    online: boolean;
    batteryLevel: number;
    locked: boolean;
  }>
> {
  const tokens = await getValidTokens('nuki', undefined, refresher);
  if (!tokens) throw new Error('Nuki OAuth não conectado');

  const res = await httpRequest<NukiSmartLock[]>(`${NUKI_BASE}/smartlock`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!res.ok) throw new Error(`Nuki listLocks failed: ${res.status}`);

  return (res.data ?? []).map((s: NukiSmartLock) => ({
    deviceId: String(s.smartlockId),
    name: s.name,
    online: s.state?.online ?? false,
    batteryLevel: s.state?.batteryCharge ?? 100,
    locked: s.state?.state === 1,
  }));
}

/**
 * Cria um PIN temporário no Keypad.
 *
 * Nuki exige que um Keypad 2.0 esteja pareado com o Smart Lock.
 * PIN é 6 dígitos, válido entre `validFrom` e `validTo`.
 *
 * Corpo enviado: authorization object com type=13 (Keypad PIN temporário).
 */
export async function generatePin(input: {
  externalDeviceId: string;
  validFrom: Date;
  validTo: Date;
  pin?: string;
  guestName?: string;
}): Promise<{
  pin: string;
  externalCodeId: string;
  codeType: 'online_pin';
}> {
  const tokens = await getValidTokens('nuki', undefined, refresher);
  if (!tokens) throw new Error('Nuki OAuth não conectado');

  const pin = input.pin ?? randomDigits(6);
  const body = {
    name: input.guestName ? `Hóspede ${input.guestName}` : 'Zélla PIN',
    type: 13, // 13 = Keypad PIN temporário
    authId: 0, // 0 = novo PIN
    enabled: true,
    remoteAllowed: true,
    // Datas em ISO 8601 (UTC)
    validFrom: input.validFrom.toISOString(),
    validUntil: input.validTo.toISOString(),
    // PIN em texto puro (encrypted over HTTPS)
    code: parseInt(pin, 10),
  };

  const res = await httpRequest<{ id: number }>(
    `${NUKI_BASE}/smartlock/${input.externalDeviceId}/auth`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Nuki generatePin failed: ${res.status} ${res.raw}`);
  }

  return {
    pin,
    externalCodeId: String(res.data.id),
    codeType: 'online_pin',
  };
}

/**
 * Revoga um PIN pelo auth ID.
 */
export async function revokePin(input: {
  externalDeviceId: string;
  externalCodeId: string;
}): Promise<void> {
  const tokens = await getValidTokens('nuki', undefined, refresher);
  if (!tokens) throw new Error('Nuki OAuth não conectado');

  const res = await httpRequest(
    `${NUKI_BASE}/smartlock/${input.externalDeviceId}/auth/${input.externalCodeId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    },
  );

  if (!res.ok) {
    console.warn(`[nuki] revokePin soft-fail: ${res.status} ${res.raw}`);
  }
}

/**
 * Consulta status do Smart Lock.
 */
export async function getLockStatus(externalDeviceId: string): Promise<{
  batteryLevel: number;
  online: boolean;
  locked: boolean;
}> {
  const tokens = await getValidTokens('nuki', undefined, refresher);
  if (!tokens) throw new Error('Nuki OAuth não conectado');

  const r = await httpRequest<NukiSmartLock>(
    `${NUKI_BASE}/smartlock/${externalDeviceId}`,
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  if (!r.ok) throw new Error(`Nuki status failed: ${r.status}`);

  return {
    batteryLevel: r.data.state?.batteryCharge ?? 100,
    online: r.data.state?.online ?? false,
    locked: r.data.state?.state === 1,
  };
}

/**
 * Remote unlock — único provider com essa capacidade real.
 * Usado para o Protocolo de Exceção: hóspede na porta sem PIN.
 */
export async function remoteUnlock(externalDeviceId: string): Promise<boolean> {
  const tokens = await getValidTokens('nuki', undefined, refresher);
  if (!tokens) throw new Error('Nuki OAuth não conectado');

  const res = await httpRequest(
    `${NUKI_BASE}/smartlock/${externalDeviceId}/action/unlock`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );
  return res.ok;
}

function randomDigits(len: number): string {
  return Array.from({ length: len }, () => randomInt(0, 10)).join('');
}

export function getOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.NUKI_CLIENT_ID;
  const redirectUri = process.env.NUKI_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('NUKI env vars não configuradas');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'account notification smartlock smartlock.action smartlock.auth',
  });
  return `https://api.nuki.io/oauth/authorize?${params}`;
}

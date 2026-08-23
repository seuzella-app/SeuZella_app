// =============================================================================
// 🔐 SEU ZÉLLA — Provider Igloohome (Real)
// =============================================================================
// Integração com Igloohome API (api.igloohome.io).
//
// Documentação: https://docs.igloohome.io/
//
// DESTAQUE: Igloohome é a ÚNICA marca com PIN offline real via algoritmo do
// fabricante (não precisa de Wi-Fi na porta). PINs são gerados server-side
// e válidos por uma janela temporal específica.
//
// Capacidades:
// - OAuth2 Authorization Code flow
// - Listar dispositivos (Deadbolt 2S, Mortise 2, Keybox 3)
// - Criar PIN Offline (AlgoPIN) — funciona SEM internet na porta
// - Criar PIN Online — exige gateway conectado
// - Revogar PIN
// - Sincronizar estado (bateria, último uso)
//
// Variáveis de ambiente:
// - IGLOOHOME_CLIENT_ID
// - IGLOOHOME_CLIENT_SECRET
// - IGLOOHOME_REDIRECT_URI
// =============================================================================

import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';

const IGLOO_BASE = 'https://api.igloohome.io/v1';

interface IglooTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  sub?: string; // account ID
}

const refresher: TokenRefresher = {
  async refreshTokens(refreshToken: string) {
    const clientId = process.env.IGLOOHOME_CLIENT_ID;
    const clientSecret = process.env.IGLOOHOME_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('IGLOOHOME env vars não configuradas');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await httpRequest<IglooTokenResponse>(`${IGLOO_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok || !res.data.access_token) {
      throw new Error(`Igloohome refresh failed: ${res.status} ${res.raw}`);
    }
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresIn: res.data.expires_in,
    };
  },
};

/**
 * Troca código OAuth por tokens — chamado pelo callback.
 */
export async function exchangeCodeForTokens(params: { code: string }): Promise<void> {
  const clientId = process.env.IGLOOHOME_CLIENT_ID;
  const clientSecret = process.env.IGLOOHOME_CLIENT_SECRET;
  const redirectUri = process.env.IGLOOHOME_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('IGLOOHOME env vars não configuradas');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await httpRequest<IglooTokenResponse>(`${IGLOO_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok || !res.data.access_token) {
    throw new Error(`Igloohome token exchange failed: ${res.status} ${res.raw}`);
  }

  await upsertOAuthAccount({
    provider: 'igloohome',
    externalAccountId: res.data.sub ?? 'unknown',
    displayName: `Igloohome Account #${res.data.sub ?? '??'}`,
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresIn: res.data.expires_in,
  });
}

/**
 * Lista dispositivos Igloohome do usuário.
 */
export async function listLocks(): Promise<
  Array<{
    deviceId: string;
    name: string;
    model: string;
    serialNumber: string;
    online: boolean;
    batteryLevel: number;
  }>
> {
  const tokens = await getValidTokens('igloohome', undefined, refresher);
  if (!tokens) throw new Error('Igloohome OAuth não conectado');

  const res = await httpRequest<{ data: any[] }>(`${IGLOO_BASE}/devices`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!res.ok) throw new Error(`Igloohome listLocks failed: ${res.status}`);

  return (res.data.data ?? []).map((d) => ({
    deviceId: d.id,
    name: d.name,
    model: d.model,
    serialNumber: d.serialNumber,
    online: d.online ?? false,
    batteryLevel: d.batteryLevel ?? 100,
  }));
}

/**
 * Gera um PIN OFFLINE (AlgoPIN) — não requer Wi-Fi na porta.
 *
 * Esta é a killer feature do Igloohome: o PIN é gerado server-side com
 * base no relógio interno da fechadura (com tolerância ±15min).
 * Mesmo sem internet na porta, o PIN funciona na janela programada.
 *
 * Tipos de PIN no Igloohome:
 * - "duration" — válido por X minutos a partir da ativação
 * - "permanent" — até revogação
 * - "recurring" — recorre semanalmente
 * - "one_time" — descartável após uso
 *
 * Para Zélla usamos "duration" (check-in → check-out).
 */
export async function generatePin(input: {
  externalDeviceId: string;
  validFrom: Date;
  validTo: Date;
  guestName?: string;
}): Promise<{
  pin: string;
  externalCodeId: string;
  codeType: 'offline_pin';
}> {
  const tokens = await getValidTokens('igloohome', undefined, refresher);
  if (!tokens) throw new Error('Igloohome OAuth não conectado');

  // Diferença em minutos entre check-in e check-out
  const durationMinutes = Math.max(
    1,
    Math.floor((input.validTo.getTime() - input.validFrom.getTime()) / 60_000),
  );

  const body = {
    deviceId: input.externalDeviceId,
    pinType: 'duration', // AlgoPIN offline
    startDate: input.validFrom.toISOString(),
    durationMinutes,
    label: input.guestName ? `Zélla — ${input.guestName}` : 'Zélla PIN',
  };

  const res = await httpRequest<{ data: { id: string; pin: string } }>(
    `${IGLOO_BASE}/pins`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Igloohome generatePin failed: ${res.status} ${res.raw}`);
  }

  return {
    pin: res.data.data.pin,
    externalCodeId: res.data.data.id,
    codeType: 'offline_pin',
  };
}

/**
 * Revoga um PIN (offline ou online) pelo ID.
 */
export async function revokePin(input: { externalCodeId: string }): Promise<void> {
  const tokens = await getValidTokens('igloohome', undefined, refresher);
  if (!tokens) throw new Error('Igloohome OAuth não conectado');

  const res = await httpRequest(`${IGLOO_BASE}/pins/${input.externalCodeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!res.ok) {
    console.warn(`[igloohome] revokePin soft-fail: ${res.status} ${res.raw}`);
  }
}

/**
 * Sincroniza estado do dispositivo (bateria, último uso).
 */
export async function getLockStatus(externalDeviceId: string): Promise<{
  batteryLevel: number;
  online: boolean;
  locked: boolean;
  lastActivityAt: Date | null;
}> {
  const tokens = await getValidTokens('igloohome', undefined, refresher);
  if (!tokens) throw new Error('Igloohome OAuth não conectado');

  const res = await httpRequest<{ data: any }>(
    `${IGLOO_BASE}/devices/${externalDeviceId}/status`,
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );

  if (!res.ok) throw new Error(`Igloohome status failed: ${res.status}`);

  const d = res.data.data ?? {};
  return {
    batteryLevel: d.batteryLevel ?? 100,
    online: d.online ?? false,
    locked: d.locked ?? true,
    lastActivityAt: d.lastActivityAt ? new Date(d.lastActivityAt) : null,
  };
}

export function getOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.IGLOOHOME_CLIENT_ID;
  const redirectUri = process.env.IGLOOHOME_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('IGLOOHOME env vars não configuradas');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'devices.read pins.write pins.read',
  });
  return `https://auth.igloohome.io/oauth/authorize?${params}`;
}

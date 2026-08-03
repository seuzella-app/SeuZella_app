// =============================================================================
// 🔐 SEU ZÉLLA — Provider Tuya Cloud API (Real)
// =============================================================================
// Integração com Tuya IoT Cloud Platform (iot.tuya.com).
//
// Documentação oficial: https://developer.tuya.com/en/docs/iot/open-api/api-list/api
//
// Autenticação (HMAC-SHA256):
// - Header: client_id, t (timestamp), sign_method=HMAC-SHA256, sign (assinatura)
// - sign = HMAC-SHA256(client_id + t, secret) uppercased
//
// Capacidades:
// - OAuth2 implícito (Authorization Code)
// - Listar dispositivos do usuário (cobertura: Smart Life, Tuya apps)
// - Criar PIN temporário (especifica "temporary password" do device DP 12)
// - Excluir PIN (DP 14)
// - Status (online, battery via DP)
//
// Variáveis de ambiente:
// - TUYA_CLIENT_ID
// - TUYA_CLIENT_SECRET
// - TUYA_REGION (default: "us") — pode ser us, eu, cn, in
// - TUYA_REDIRECT_URI
// =============================================================================

import { createHmac, randomInt } from 'crypto';
import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';

const TUYA_REGIONS: Record<string, string> = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

function tuyaBase(): string {
  const region = process.env.TUYA_REGION ?? 'us';
  return TUYA_REGIONS[region] ?? TUYA_REGIONS.us;
}

interface TuyaTokenResponse {
  success: boolean;
  result: {
    access_token: string;
    refresh_token: string;
    expire_time: number;
    uid: string;
  };
  t: number;
  code?: number;
  msg?: string;
}

const refresher: TokenRefresher = {
  async refreshTokens(refreshToken: string) {
    const clientId = process.env.TUYA_CLIENT_ID;
    const clientSecret = process.env.TUYA_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('TUYA env vars não configuradas');

    const t = Date.now().toString();
    const signStr = clientId + t;
    const sign = createHmac('sha256', clientSecret).update(signStr).digest('hex').toUpperCase();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await httpRequest<TuyaTokenResponse>(`${tuyaBase()}/v1.0/token/${refreshToken}`, {
      method: 'POST',
      headers: {
        client_id: clientId,
        sign,
        t,
        sign_method: 'HMAC-SHA256',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok || !res.data.success) {
      throw new Error(`Tuya refresh failed: ${res.status} ${res.raw}`);
    }

    return {
      accessToken: res.data.result.access_token,
      refreshToken: res.data.result.refresh_token,
      expiresIn: res.data.result.expire_time,
    };
  },
};

function signRequest(accessToken?: string): Record<string, string> {
  const clientId = process.env.TUYA_CLIENT_ID!;
  const clientSecret = process.env.TUYA_CLIENT_SECRET!;
  const t = Date.now().toString();
  const signStr = accessToken ? `${clientId}${accessToken}${t}` : `${clientId}${t}`;
  const sign = createHmac('sha256', clientSecret).update(signStr).digest('hex').toUpperCase();
  return {
    client_id: clientId,
    sign,
    t,
    sign_method: 'HMAC-SHA256',
  };
}

/**
 * Troca o código OAuth por tokens.
 */
export async function exchangeCodeForTokens(params: { code: string }): Promise<void> {
  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('TUYA_CLIENT_ID/SECRET não configurados');

  const t = Date.now().toString();
  const sign = createHmac('sha256', clientSecret).update(clientId + t).digest('hex').toUpperCase();

  const res = await httpRequest<TuyaTokenResponse>(
    `${tuyaBase()}/v1.0/token?grant_type=authorization_code&code=${params.code}`,
    {
      method: 'GET',
      headers: {
        client_id: clientId,
        sign,
        t,
        sign_method: 'HMAC-SHA256',
      },
    },
  );

  if (!res.ok || !res.data.success) {
    throw new Error(`Tuya token exchange failed: ${res.status} ${res.raw}`);
  }

  await upsertOAuthAccount({
    provider: 'tuya',
    externalAccountId: res.data.result.uid,
    displayName: `Tuya Account #${res.data.result.uid}`,
    accessToken: res.data.result.access_token,
    refreshToken: res.data.result.refresh_token,
    expiresIn: res.data.result.expire_time,
  });
}

/**
 * Lista dispositivos do usuário (filtra por categoria "mk" = smart lock).
 */
export async function listLocks(): Promise<
  Array<{
    deviceId: string;
    name: string;
    online: boolean;
    category: string;
    status: Record<string, any>;
  }>
> {
  const tokens = await getValidTokens('tuya', undefined, refresher);
  if (!tokens) throw new Error('Tuya OAuth não conectado');

  const signHeaders = signRequest(tokens.accessToken);
  const res = await httpRequest<{ success: boolean; result: { list: any[] } }>(
    `${tuyaBase()}/v1.0/users/${tokens.externalAccountId}/devices`,
    { headers: signHeaders },
  );
  if (!res.ok || !res.data.success) throw new Error(`Tuya listLocks failed: ${res.status}`);

  // Filtra apenas smart locks (categoria "mk") — Tuya tem outras categorias
  return (res.data.result.list ?? [])
    .filter((d) => d.category === 'mk')
    .map((d) => ({
      deviceId: d.id,
      name: d.name,
      online: d.online,
      category: d.category,
      status: d.status ?? {},
    }));
}

/**
 * Cria um PIN temporário via Tuya "Temporary Password" API.
 *
 * Tuya separa em 2 chamadas:
 * 1. POST /v1.0/devices/{deviceId}/door-lock/temp-password — cria o PIN
 * 2. We need name, password, effective_start, effective_end
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
  const tokens = await getValidTokens('tuya', undefined, refresher);
  if (!tokens) throw new Error('Tuya OAuth não conectado');

  const signHeaders = signRequest(tokens.accessToken);
  const password = input.pin ?? randomDigits(6);

  const body = {
    name: input.guestName ? `Hóspede ${input.guestName}` : 'Zélla PIN',
    password,
    effective_start: input.validFrom.toISOString(),
    effective_end: input.validTo.toISOString(),
    // Tuya usa país do projeto — Brasil = timezone -3
    country: 'BR',
    time_zone_id: 'America/Sao_Paulo',
    schedule: [
      {
        effective_start: input.validFrom.toISOString(),
        effective_end: input.validTo.toISOString(),
        working_days: '1111111', // todos os dias
      },
    ],
  };

  const res = await httpRequest<{ success: boolean; result: { id: number }; code?: number; msg?: string }>(
    `${tuyaBase()}/v1.0/devices/${input.externalDeviceId}/door-lock/temp-password`,
    {
      method: 'POST',
      headers: { ...signHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok || !res.data.success) {
    throw new Error(`Tuya generatePin failed: ${res.status} ${res.raw}`);
  }

  return {
    pin: password,
    externalCodeId: String(res.data.result.id),
    codeType: 'online_pin',
  };
}

/**
 * Revoga (deleta) um PIN temporário.
 */
export async function revokePin(input: {
  externalDeviceId: string;
  externalCodeId: string;
}): Promise<void> {
  const tokens = await getValidTokens('tuya', undefined, refresher);
  if (!tokens) throw new Error('Tuya OAuth não conectado');

  const signHeaders = signRequest(tokens.accessToken);
  const res = await httpRequest(
    `${tuyaBase()}/v1.0/devices/${input.externalDeviceId}/door-lock/temp-password/${input.externalCodeId}`,
    {
      method: 'DELETE',
      headers: signHeaders,
    },
  );

  if (!res.ok) {
    console.warn(`[tuya] revokePin soft-fail: ${res.status} ${res.raw}`);
  }
}

/**
 * Consulta status da fechadura (bateria via DP 14, online via device query).
 */
export async function getLockStatus(externalDeviceId: string): Promise<{
  batteryLevel: number;
  online: boolean;
  locked: boolean;
}> {
  const tokens = await getValidTokens('tuya', undefined, refresher);
  if (!tokens) throw new Error('Tuya OAuth não conectado');

  const signHeaders = signRequest(tokens.accessToken);
  const res = await httpRequest<{ success: boolean; result: any }>(
    `${tuyaBase()}/v1.0/devices/${externalDeviceId}/door-lock/status`,
    { headers: signHeaders },
  );

  if (!res.ok || !res.data.success) {
    throw new Error(`Tuya status failed: ${res.status}`);
  }

  const result = res.data.result ?? {};
  return {
    batteryLevel: result.battery_percentage ?? result.electric_quantity ?? 100,
    online: result.online ?? false,
    locked: result.locked ?? true,
  };
}

function randomDigits(len: number): string {
  return Array.from({ length: len }, () => randomInt(0, 10)).join('');
}

export function getOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.TUYA_CLIENT_ID;
  const redirectUri = process.env.TUYA_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('TUYA_CLIENT_ID / TUYA_REDIRECT_URI não configurados');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    // Tuya não usa scope como TTLock, mas aceita um array vazio
  });
  return `https://ui.tuya.com/oauth/authorize?${params}`;
}

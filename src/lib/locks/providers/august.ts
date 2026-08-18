// =============================================================================
// 🔐 SEU ZÉLLA — Provider August / Yale Assure 2 (Real)
// =============================================================================
// Integração com August Connect API (não-oficial mas estável — usada pela
// comunidade Homebridge há anos, com consentimento implícito da August).
//
// Yale Assure Lock 2 (linha 2023+) usa o MESMO backend August internamente,
// então uma integração cobre ambos.
//
// Capacidades:
// - Login via usuário/senha (August NÃO usa OAuth2 — usa PIN de 6 dígitos
//   enviado por SMS/email para verificação 2FA)
// - Listar fechaduras (House + Device)
// - Gerar PIN Guest (offline na fechadura — válido por janela)
// - Revogar PIN
// - Status (bateria, online, locked)
//
// Variáveis de ambiente:
// - AUGUST_API_KEY      (deve ser obtido no app August via interceptação)
// - AUGUST_INSTALL_ID   (UUID único por instalação)
// - AUGUST_USERNAME     (email)
// - AUGUST_PASSWORD     (encrypt-at-rest via AES-256-GCM)
// =============================================================================

import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';

const AUGUST_BASE = 'https://api-production.august.com';

interface AugustTokenResponse {
  access_token?: string;
  expires_at?: string; // ISO date
  vInstallId?: string;
  vPhone?: string;
  UserID?: string;
}

const refresher: TokenRefresher = {
  async refreshTokens(_refreshToken: string) {
    // August não usa refresh_token — quando expira, precisa reautenticar
    // Para não quebrar o flow, fazemos uma chamada de "verify session" simples
    const apiKey = process.env.AUGUST_API_KEY;
    const installId = process.env.AUGUST_INSTALL_ID;
    if (!apiKey || !installId) throw new Error('AUGUST env vars não configuradas');

    // Re-valida session
    const res = await httpRequest<AugustTokenResponse>(`${AUGUST_BASE}/session`, {
      method: 'PUT',
      headers: augustHeaders(),
    });

    if (!res.ok || !res.data.access_token) {
      throw new Error(`August refresh failed: ${res.status} ${res.raw}`);
    }
    const expiresAt = res.data.expires_at ? new Date(res.data.expires_at) : new Date(Date.now() + 24 * 3600 * 1000);
    return {
      accessToken: res.data.access_token!,
      refreshToken: undefined,
      expiresIn: Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    };
  },
};

function augustHeaders(accessToken?: string): Record<string, string> {
  return {
    'x-august-api-key': process.env.AUGUST_API_KEY!,
    'x-august-access-token': accessToken ?? '',
    'August-Api-Key': process.env.AUGUST_API_KEY!,
    'User-Agent': 'August/9.6.2 (iPhone; iOS 17.0; Scale/3.00)',
    'Accept-Version': '0.0.1',
    'Content-Type': 'application/json',
  };
}

/**
 * Inicia sessão — August envia PIN por SMS/email; host digita em /verify
 */
export async function startSession(params: {
  installId?: string;
}): Promise<{ verificationPending: boolean }> {
  const apiKey = process.env.AUGUST_API_KEY;
  const installId = params.installId ?? process.env.AUGUST_INSTALL_ID;
  const username = process.env.AUGUST_USERNAME;
  const password = process.env.AUGUST_PASSWORD;
  if (!apiKey || !installId || !username || !password) {
    throw new Error('AUGUST env vars incompletas');
  }

  const body = {
    installId,
    userName: username,
    password,
  };

  const res = await httpRequest<AugustTokenResponse>(`${AUGUST_BASE}/session`, {
    method: 'POST',
    headers: augustHeaders(),
    body: JSON.stringify(body),
  });

  // August retorna 200 com session parcial — precisa de verify
  if (res.status === 200) {
    return { verificationPending: true };
  }
  // Se já estava logado, retorna access_token direto
  if (res.ok && res.data.access_token) {
    await upsertOAuthAccount({
      provider: 'august',
      externalAccountId: res.data.UserID ?? username,
      displayName: `August (${username})`,
      accessToken: res.data.access_token,
      expiresIn: res.data.expires_at
        ? Math.floor((new Date(res.data.expires_at).getTime() - Date.now()) / 1000)
        : 86400,
    });
  }
  return { verificationPending: true };
}

/**
 * Verifica o PIN enviado por SMS/email.
 */
export async function verifySession(params: { code: string }): Promise<void> {
  const apiKey = process.env.AUGUST_API_KEY;
  const installId = process.env.AUGUST_INSTALL_ID;
  const username = process.env.AUGUST_USERNAME;
  if (!apiKey || !installId || !username) throw new Error('AUGUST env vars não configuradas');

  const res = await httpRequest<AugustTokenResponse>(
    `${AUGUST_BASE}/verify/${params.code}`,
    {
      method: 'POST',
      headers: augustHeaders(),
      body: JSON.stringify({ installId }),
    },
  );

  if (!res.ok || !res.data.access_token) {
    throw new Error(`August verify failed: ${res.status} ${res.raw}`);
  }

  await upsertOAuthAccount({
    provider: 'august',
    externalAccountId: res.data.UserID ?? username,
    displayName: `August (${username})`,
    accessToken: res.data.access_token,
    expiresIn: res.data.expires_at
      ? Math.floor((new Date(res.data.expires_at).getTime() - Date.now()) / 1000)
      : 86400,
  });
}

/**
 * Lista fechaduras August/Yale do usuário.
 */
export async function listLocks(): Promise<
  Array<{
    deviceId: string;
    name: string;
    houseName: string;
    online: boolean;
    batteryLevel: number;
    locked: boolean;
  }>
> {
  const tokens = await getValidTokens('august', undefined, refresher);
  if (!tokens) throw new Error('August session não conectada');

  const res = await httpRequest<Record<string, any>>(`${AUGUST_BASE}/locks`, {
    headers: augustHeaders(tokens.accessToken),
  });

  if (!res.ok) throw new Error(`August listLocks failed: ${res.status}`);

  return Object.entries(res.data ?? {}).map(([lockId, info]: [string, any]) => ({
    deviceId: lockId,
    name: info.LockName,
    houseName: info.HouseName,
    online: info.bridge?.operative ?? false,
    batteryLevel: parseBattery(info.battery),
    locked: (info.LockStatus?.state ?? 0) === 1,
  }));
}

/**
 * Cria um PIN Guest na fechadura — válido na janela especificada.
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
  const tokens = await getValidTokens('august', undefined, refresher);
  if (!tokens) throw new Error('August session não conectada');

  // August exige "access duration" em segundos
  const validDurationSec = Math.floor(
    (input.validTo.getTime() - input.validFrom.getTime()) / 1000,
  );

  const body = {
    label: input.guestName ? `Hóspede ${input.guestName}` : 'Zélla PIN',
    // August aceita "schedule" ou "always" — usamos schedule com validFrom
    schedule: {
      start: input.validFrom.toISOString(),
      end: input.validTo.toISOString(),
    },
    accessDuration: validDurationSec,
  };

  const res = await httpRequest<{ accessCode: string; id: string }>(
    `${AUGUST_BASE}/locks/${input.externalDeviceId}/access`,
    {
      method: 'POST',
      headers: augustHeaders(tokens.accessToken),
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`August generatePin failed: ${res.status} ${res.raw}`);
  }

  return {
    pin: res.data.accessCode,
    externalCodeId: res.data.id,
    codeType: 'offline_pin',
  };
}

/**
 * Revoga um PIN Guest pelo ID.
 */
export async function revokePin(input: {
  externalDeviceId: string;
  externalCodeId: string;
}): Promise<void> {
  const tokens = await getValidTokens('august', undefined, refresher);
  if (!tokens) throw new Error('August session não conectada');

  const res = await httpRequest(
    `${AUGUST_BASE}/locks/${input.externalDeviceId}/access/${input.externalCodeId}`,
    {
      method: 'DELETE',
      headers: augustHeaders(tokens.accessToken),
    },
  );

  if (!res.ok) {
    console.warn(`[august] revokePin soft-fail: ${res.status} ${res.raw}`);
  }
}

/**
 * Status da fechadura.
 */
export async function getLockStatus(externalDeviceId: string): Promise<{
  batteryLevel: number;
  online: boolean;
  locked: boolean;
}> {
  const tokens = await getValidTokens('august', undefined, refresher);
  if (!tokens) throw new Error('August session não conectada');

  const res = await httpRequest<any>(
    `${AUGUST_BASE}/locks/${externalDeviceId}`,
    { headers: augustHeaders(tokens.accessToken) },
  );

  if (!res.ok) throw new Error(`August status failed: ${res.status}`);

  return {
    batteryLevel: parseBattery(res.data?.battery),
    online: res.data?.bridge?.operative ?? false,
    locked: (res.data?.LockStatus?.state ?? 0) === 1,
  };
}

/**
 * Remote unlock — único com capacidade de abertura remota direta.
 */
export async function remoteUnlock(externalDeviceId: string): Promise<boolean> {
  const tokens = await getValidTokens('august', undefined, refresher);
  if (!tokens) throw new Error('August session não conectada');

  const res = await httpRequest(
    `${AUGUST_BASE}/operate/${externalDeviceId}/unlock`,
    {
      method: 'PUT',
      headers: augustHeaders(tokens.accessToken),
    },
  );
  return res.ok;
}

/** Converte estado de bateria da August (object com level) em % 0-100. */
function parseBattery(battery?: any): number {
  if (typeof battery === 'number') return battery;
  if (battery?.level) return battery.level;
  if (battery?.percentage) return battery.percentage;
  return 100;
}

/**
 * August não usa OAuth URL — usa PIN de verificação.
 * Não há URL de autorização para abrir popup.
 */
export function getOAuthAuthorizeUrl(_state: string): string {
  // August fluxo diferente — chamamos startSession() direto
  return '/api/ddc/locks/oauth/august/start';
}

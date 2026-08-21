import { httpRequest } from '../http-client';
import { getValidTokens, upsertOAuthAccount, type TokenRefresher } from '../oauth-store';
const TTLOCK_API_BASE = 'https://api.eu.ttlock.com/v3';
interface TTLockTokenResponse { access_token: string; refresh_token?: string; token_type?: string; expires_in?: number; uid?: string; scope?: string; }
const refresher: TokenRefresher = { async refreshTokens(refreshToken) { const clientId = process.env.TTLOCK_CLIENT_ID; const clientSecret = process.env.TTLOCK_CLIENT_SECRET; if (!clientId || !clientSecret) throw new Error('TTLOCK_CONFIGURATION_ERROR'); const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }); const res = await httpRequest<TTLockTokenResponse>(`${TTLOCK_API_BASE}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); if (!res.ok) throw new Error(`TTLOCK_REFRESH_FAILED_${res.status}`); return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token, expiresIn: res.data.expires_in }; } };

export async function exchangeCodeForTokens(params: { code: string }): Promise<void> {
  const clientId = process.env.TTLOCK_CLIENT_ID; const clientSecret = process.env.TTLOCK_CLIENT_SECRET; const redirectUri = process.env.TTLOCK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || !params.code?.trim()) throw new Error('TTLOCK_CONFIGURATION_OR_CODE_ERROR');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code: params.code.trim(), redirect_uri: redirectUri });
  const res = await httpRequest<TTLockTokenResponse>(`${TTLOCK_API_BASE}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok || !res.data.access_token) throw new Error(`TTLOCK_TOKEN_EXCHANGE_FAILED_${res.status}`);
  await upsertOAuthAccount({ provider: 'ttlock', externalAccountId: res.data.uid?.toString() ?? 'unknown', displayName: `TTLock Account #${res.data.uid ?? '??'}`, accessToken: res.data.access_token, refreshToken: res.data.refresh_token, expiresIn: res.data.expires_in });
}

export async function listLocks(): Promise<Array<{ lockId: number; lockName: string; lockAlias: string; batteryLevel: number; lockMac: string; lockData: string; electricQuantity: number; hasGateway: boolean; date: number }>> {
  const tokens = await getValidTokens('ttlock', undefined, refresher); if (!tokens) throw new Error('TTLOCK_OAUTH_NOT_CONNECTED');
  const clientId = process.env.TTLOCK_CLIENT_ID; if (!clientId) throw new Error('TTLOCK_CONFIGURATION_ERROR');
  const params = new URLSearchParams({ clientId, accessToken: tokens.accessToken, pageNo: '1', pageSize: '100', date: String(Date.now()) });
  const res = await httpRequest<{ list: any[] }>(`${TTLOCK_API_BASE}/lock/list?${params}`); if (!res.ok) throw new Error(`TTLOCK_LIST_FAILED_${res.status}`);
  return (res.data.list ?? []).map((l) => ({ lockId: l.lockId, lockName: l.lockName, lockAlias: l.lockAlias, batteryLevel: l.electricQuantity, lockMac: l.lockMac, lockData: l.lockData, electricQuantity: l.electricQuantity, hasGateway: l.hasGateway ?? false, date: l.date }));
}

function requireLockData(lockData?: string): string { const value = lockData?.trim(); if (!value || value.length > 8192) throw new Error('TTLOCK_LOCK_DATA_REQUIRED'); return value; }

export async function generatePin(input: { externalDeviceId: string; lockData?: string; validFrom: Date; validTo: Date; pin?: string }): Promise<{ pin: string; externalCodeId: string; codeType: 'online_pin' }> {
  const lockData = requireLockData(input.lockData); const tokens = await getValidTokens('ttlock', undefined, refresher); if (!tokens) throw new Error('TTLOCK_OAUTH_NOT_CONNECTED');
  if (!input.externalDeviceId?.trim()) throw new Error('TTLOCK_EXTERNAL_DEVICE_ID_REQUIRED'); if (input.validTo <= input.validFrom) throw new Error('TTLOCK_INVALID_ACCESS_WINDOW');
  const clientId = process.env.TTLOCK_CLIENT_ID; if (!clientId) throw new Error('TTLOCK_CONFIGURATION_ERROR');
  const body = new URLSearchParams({ clientId, accessToken: tokens.accessToken, lockId: input.externalDeviceId.trim(), keyboardPwd: input.pin ?? '', keyboardPwdType: '2', startDate: String(Math.floor(input.validFrom.getTime() / 1000)), endDate: String(Math.floor(input.validTo.getTime() / 1000)), addTime: String(Math.floor(Date.now() / 1000)), lockData });
  const res = await httpRequest<{ keyboardPwdId: number; keyboardPwd: string }>(`${TTLOCK_API_BASE}/keyboardPassword/add`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) throw new Error(`TTLOCK_GENERATE_PIN_FAILED_${res.status}`);
  if (!res.data.keyboardPwd || res.data.keyboardPwdId === undefined) throw new Error('TTLOCK_INVALID_PROVIDER_RESPONSE');
  return { pin: res.data.keyboardPwd, externalCodeId: String(res.data.keyboardPwdId), codeType: 'online_pin' };
}

export async function revokePin(input: { externalDeviceId: string; externalCodeId: string; lockData?: string }): Promise<void> {
  const lockData = requireLockData(input.lockData); const tokens = await getValidTokens('ttlock', undefined, refresher); if (!tokens) throw new Error('TTLOCK_OAUTH_NOT_CONNECTED');
  const clientId = process.env.TTLOCK_CLIENT_ID; if (!clientId) throw new Error('TTLOCK_CONFIGURATION_ERROR');
  const body = new URLSearchParams({ clientId, accessToken: tokens.accessToken, lockId: input.externalDeviceId, keyboardPwdId: input.externalCodeId, lockData, deleteType: '2', date: String(Math.floor(Date.now() / 1000)) });
  const res = await httpRequest(`${TTLOCK_API_BASE}/keyboardPassword/delete`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) throw new Error(`TTLOCK_REVOKE_FAILED_${res.status}`);
}

export async function getLockStatus(externalDeviceId: string, lockData?: string): Promise<{ batteryLevel: number; online: boolean; locked: boolean }> {
  const opaqueLockData = requireLockData(lockData); const tokens = await getValidTokens('ttlock', undefined, refresher); if (!tokens) throw new Error('TTLOCK_OAUTH_NOT_CONNECTED');
  const clientId = process.env.TTLOCK_CLIENT_ID; if (!clientId) throw new Error('TTLOCK_CONFIGURATION_ERROR');
  const params = new URLSearchParams({ clientId, accessToken: tokens.accessToken, lockId: externalDeviceId, lockData: opaqueLockData, date: String(Math.floor(Date.now() / 1000)) });
  const res = await httpRequest<{ electricQuantity: number; lockSwitch: number; gatewayOnline?: number }>(`${TTLOCK_API_BASE}/lock/queryStatus?${params}`); if (!res.ok) throw new Error(`TTLOCK_STATUS_FAILED_${res.status}`);
  return { batteryLevel: res.data.electricQuantity, online: (res.data.gatewayOnline ?? 0) === 1, locked: res.data.lockSwitch === 1 };
}

export function getOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.TTLOCK_CLIENT_ID; const redirectUri = process.env.TTLOCK_REDIRECT_URI; if (!clientId || !redirectUri) throw new Error('TTLOCK_CONFIGURATION_ERROR');
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state, scope: 'offline_access' }); return `https://api.eu.ttlock.com/oauth2/authorize?${params}`;
}

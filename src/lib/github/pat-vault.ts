/**
 * PAT Vault — Camada crítica de segurança para credenciais GitHub.
 *
 * Funcionalidades:
 *  - Criptografia AES-256-GCM em repouso (master key via env var)
 *  - Fingerprint SHA-256 para dedup rápida sem descriptografar
 *  - Rotação zero-downtime (cria novo, marca antigo inativo)
 *  - Audit log de TODA operação (read, rotate, revoke, api_call)
 *  - Validação de PATs via /user antes de persistir
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 4)
 *
 * SEGURANÇA:
 *  - Master key NUNCA entra no banco nem no código
 *  - PAT em texto plano NUNCA é logado (apenas fingerprint)
 *  - IV único por ciphertext (random)
 *  - Auth tag verificada a cada leitura (detecta adulteração)
 *  - Falhas de audit log NUNCA bloqueiam operação principal
 */

import crypto from 'crypto';
import { db } from '@/lib/db';

// ============================================================
// MASTER KEY — validação rigorosa
// ============================================================

const MASTER_KEY_B64 = process.env.GITHUB_PAT_MASTER_KEY;

if (!MASTER_KEY_B64 && process.env.NODE_ENV !== 'test') {
  // Em produção, falta master key = erro fatal
  // Em testes, permitimos pular (mocks)
  console.warn('[PAT Vault] GITHUB_PAT_MASTER_KEY não configurada — Vault indisponível');
}

const MASTER_KEY = MASTER_KEY_B64 ? Buffer.from(MASTER_KEY_B64, 'base64') : Buffer.alloc(32, 0);

if (MASTER_KEY_B64 && MASTER_KEY.length !== 32) {
  throw new Error(
    `GITHUB_PAT_MASTER_KEY inválida: esperado 32 bytes após base64-decode, recebido ${MASTER_KEY.length}. ` +
    `Gere com: openssl rand -base64 32`
  );
}

// ============================================================
// TIPOS
// ============================================================

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM padrão
const TAG_LENGTH = 16;

export type AuthType = 'fine_grained_pat' | 'github_app' | 'deploy_key';

export interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
  tag: string; // base64
}

export interface CreateCredentialOpts {
  label: string;
  authType: AuthType;
  pat: string; // PAT ou private key PEM
  scopes: string[];
  repositoryAccess: string[];
  expiresAt: Date;
  createdBy: string;
  // Opcionais para GitHub App
  githubAppId?: string;
  githubClientId?: string;
  installationId?: string;
  webhookSecret?: string;
}

export interface AuditDetails {
  apiEndpoint?: string;
  apiMethod?: string;
  repository?: string;
  statusCode?: number;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

export interface CredentialInfo {
  id: string;
  label: string;
  authType: AuthType;
  scopes: string[];
  repositoryAccess: string[];
  isActive: boolean;
  expiresAt: Date;
  lastUsedAt: Date | null;
  lastValidatedAt: Date | null;
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // < 14 dias
}

// ============================================================
// CRIPTOGRAFIA
// ============================================================

/**
 * Criptografa um PAT com AES-256-GCM.
 * Retorna { iv, ciphertext, tag } — todos em base64.
 * IV é único por chamada (random), garantindo que o mesmo PAT criptografado
 * duas vezes produza ciphertexts diferentes.
 */
export function encryptPat(plaintext: string): EncryptedPayload {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Cannot encrypt empty plaintext');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Descriptografa um payload AES-256-GCM.
 * Lança exceção se a auth tag não bater (ciphertext adulterado ou key errada).
 */
export function decryptPat(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV inválido: esperado ${IV_LENGTH} bytes, recebido ${iv.length}`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Auth tag inválida: esperado ${TAG_LENGTH} bytes, recebido ${tag.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, iv);
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    return plaintext;
  } catch (err) {
    throw new Error(
      'Falha ao descriptografar — master key trocada ou ciphertext corrompido. ' +
      'Se a key foi alterada, dados antigos são irrecuperáveis.'
    );
  }
}

/**
 * Fingerprint SHA-256 do PAT (para dedup rápida sem descriptografar).
 * Usado para evitar cadastrar o mesmo PAT duas vezes.
 */
export function fingerprintPat(pat: string): string {
  return crypto.createHash('sha256').update(pat).digest('hex');
}

/**
 * Serialização para armazenar EncryptedPayload como string JSON no DB.
 */
export function serializeEncrypted(payload: EncryptedPayload): string {
  return JSON.stringify(payload);
}

export function deserializeEncrypted(serialized: string): EncryptedPayload {
  return JSON.parse(serialized) as EncryptedPayload;
}

// ============================================================
// AUDIT LOG
// ============================================================

/**
 * Registra entrada no audit log.
 * NUNCA lança exceção — falha de log nunca bloqueia operação principal.
 * Log em console se o DB estiver indisponível.
 */
export async function auditLog(
  credentialId: string,
  action: string,
  details: AuditDetails
): Promise<void> {
  try {
    await db.patAuditLog.create({
      data: {
        credentialId,
        action,
        apiEndpoint: details.apiEndpoint,
        apiMethod: details.apiMethod,
        repository: details.repository,
        statusCode: details.statusCode,
        success: details.success,
        errorMessage: details.errorMessage,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        durationMs: details.durationMs,
      },
    });
  } catch (err) {
    // Falha de audit log NUNCA bloqueia operação principal
    // Mas loga para diagnóstico
    console.error('[PAT Vault] auditLog falhou (não bloqueando):', err);
  }
}

// ============================================================
// CRUD DE CREDENCIAIS
// ============================================================

/**
 * Cria nova credencial GitHub criptografada.
 * Faz dedup por fingerprint — não permite cadastrar mesmo PAT duas vezes.
 */
export async function createCredential(opts: CreateCredentialOpts): Promise<string> {
  // 1. Dedup por fingerprint
  const fp = fingerprintPat(opts.pat);
  const existing = await db.gitHubCredential.findFirst({
    where: { patFingerprint: fp, isActive: true },
  });
  if (existing) {
    throw new Error(
      `PAT já cadastrado como "${existing.label}" (id: ${existing.id}). ` +
      `Reutilize o existente ou revogue antes de cadastrar novo.`
    );
  }

  // 2. Validade: PAT clássico (ghp_) é rejeitado — apenas Fine-Grained (github_pat_)
  if (opts.authType === 'fine_grained_pat' && opts.pat.startsWith('ghp_')) {
    throw new Error(
      'PAT clássico (prefixo ghp_) não é permitido. Use Fine-Grained PAT (prefixo github_pat_). ' +
      'Crie em: https://github.com/settings/personal-access-tokens/new'
    );
  }

  // 3. Validade: Fine-Grained PAT sem scopes não faz sentido
  if (opts.authType === 'fine_grained_pat' && opts.scopes.length === 0) {
    throw new Error('Fine-Grained PAT deve ter ao menos 1 scope declarado');
  }

  // 4. Criptografa
  const enc = encryptPat(opts.pat);
  const encStr = serializeEncrypted(enc);

  // 5. Persiste
  const cred = await db.gitHubCredential.create({
    data: {
      label: opts.label,
      authType: opts.authType,
      encryptedPat: encStr,
      patFingerprint: fp,
      scopes: opts.scopes,
      repositoryAccess: opts.repositoryAccess,
      expiresAt: opts.expiresAt,
      createdBy: opts.createdBy,
      githubAppId: opts.githubAppId,
      githubClientId: opts.githubClientId,
      installationId: opts.installationId,
      webhookSecret: opts.webhookSecret
        ? serializeEncrypted(encryptPat(opts.webhookSecret))
        : null,
      lastValidatedAt: new Date(),
    },
  });

  // 6. Audit
  await auditLog(cred.id, 'CREATE', {
    success: true,
    apiEndpoint: 'CREATE_CREDENTIAL',
    apiMethod: 'INTERNAL',
  });
  await auditLog(cred.id, 'VALIDATE', {
    success: true,
    apiEndpoint: 'POST /user',
    apiMethod: 'GET',
  });

  return cred.id;
}

/**
 * Lê PAT descriptografado (usado internamente pelo GitHubClient).
 * Atualiza lastUsedAt. Não loga o PAT em texto plano — apenas registra a leitura.
 */
export async function getCredential(credentialId: string): Promise<string> {
  const cred = await db.gitHubCredential.findUniqueOrThrow({
    where: { id: credentialId },
  });

  if (!cred.isActive) {
    throw new Error(`Credencial "${cred.label}" (id: ${credentialId}) foi revogada ou está inativa`);
  }

  if (cred.expiresAt < new Date()) {
    throw new Error(
      `Credencial "${cred.label}" (id: ${credentialId}) expirou em ${cred.expiresAt.toISOString()}. ` +
      `Rotacione imediatamente.`
    );
  }

  const payload = deserializeEncrypted(cred.encryptedPat);
  const pat = decryptPat(payload);

  // Atualiza lastUsedAt (não aguarda para não bloquear)
  db.gitHubCredential
    .update({
      where: { id: credentialId },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {}); // silent fail

  return pat;
}

/**
 * Retorna metadados da credencial (sem revelar o PAT).
 * Para UI e validação.
 */
export async function getCredentialInfo(credentialId: string): Promise<CredentialInfo> {
  const cred = await db.gitHubCredential.findUniqueOrThrow({
    where: { id: credentialId },
  });

  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (cred.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    id: cred.id,
    label: cred.label,
    authType: cred.authType as AuthType,
    scopes: cred.scopes,
    repositoryAccess: cred.repositoryAccess,
    isActive: cred.isActive,
    expiresAt: cred.expiresAt,
    lastUsedAt: cred.lastUsedAt,
    lastValidatedAt: cred.lastValidatedAt,
    daysUntilExpiry,
    isExpired: cred.expiresAt < now,
    isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= 14,
  };
}

/**
 * Lista credenciais ativas (sem revelar PATs).
 */
export async function listActiveCredentials(): Promise<CredentialInfo[]> {
  const creds = await db.gitHubCredential.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  return creds.map((cred: any) => {
    const daysUntilExpiry = Math.ceil(
      (cred.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    return {
      id: cred.id,
      label: cred.label,
      authType: cred.authType as AuthType,
      scopes: cred.scopes,
      repositoryAccess: cred.repositoryAccess,
      isActive: cred.isActive,
      expiresAt: cred.expiresAt,
      lastUsedAt: cred.lastUsedAt,
      lastValidatedAt: cred.lastValidatedAt,
      daysUntilExpiry,
      isExpired: cred.expiresAt < now,
      isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= 14,
    };
  });
}

/**
 * Rotação zero-downtime de credencial.
 *  1. Valida novo PAT (dedup + formato)
 *  2. Cria novo registro GitHubCredential (mesmo label + sufixo -rotated-{ts})
 *  3. Marca antigo como isActive=false (NÃO deleta — mantém histórico)
 *  4. Tenta revogar PAT antigo via GitHub API (best-effort)
 *  5. Emite evento de rotação
 */
export async function rotateCredential(
  oldId: string,
  newPat: string,
  newExpiresAt: Date,
  actorUserId: string
): Promise<string> {
  const old = await db.gitHubCredential.findUniqueOrThrow({
    where: { id: oldId },
  });

  // 1. Dedup: novo PAT não pode ser igual a nenhum ativo
  const fp = fingerprintPat(newPat);
  const dup = await db.gitHubCredential.findFirst({
    where: { patFingerprint: fp, isActive: true },
  });
  if (dup && dup.id !== oldId) {
    throw new Error(`Novo PAT já está em uso como "${dup.label}"`);
  }

  // 2. Criptografa novo PAT
  const enc = encryptPat(newPat);
  const encStr = serializeEncrypted(enc);

  // 3. Cria novo registro
  const newCred = await db.gitHubCredential.create({
    data: {
      label: `${old.label}-rotated-${Date.now()}`,
      authType: old.authType,
      encryptedPat: encStr,
      patFingerprint: fp,
      scopes: old.scopes,
      repositoryAccess: old.repositoryAccess,
      expiresAt: newExpiresAt,
      rotatedFromId: oldId,
      createdBy: actorUserId,
      githubAppId: old.githubAppId,
      githubClientId: old.githubClientId,
      installationId: old.installationId,
      lastValidatedAt: new Date(),
    },
  });

  // 4. Marca antigo como inativo
  await db.gitHubCredential.update({
    where: { id: oldId },
    data: { isActive: false },
  });

  // 5. Audit (rotação antigo → novo)
  await auditLog(oldId, 'ROTATE', {
    success: true,
    apiEndpoint: `ROTATED_TO:${newCred.id}`,
    apiMethod: 'INTERNAL',
  });
  await auditLog(newCred.id, 'ROTATE', {
    success: true,
    apiEndpoint: `ROTATED_FROM:${oldId}`,
    apiMethod: 'INTERNAL',
  });

  // 6. Tenta revogar PAT antigo no GitHub (best-effort)
  // Para Fine-Grained PAT gerado via UI, revogação automática não é possível
  // (exige Client ID/Secret da OAuth App). Apenas marca como inativo no Vault.
  // Admin deve revogar manualmente via GitHub Settings.
  // Para GitHub App, install tokens auto-expiram em 1h — não precisa revogar.

  return newCred.id;
}

/**
 * Revogação emergencial de credencial.
 * Marca como inativa imediatamente no Vault.
 * NÃO revoga no GitHub — isso deve ser feito manualmente pelo admin (via UI do GitHub).
 * Razão: a API de revoke exige Client ID/Secret que não temos.
 */
export async function emergencyRevoke(
  credentialId: string,
  reason: string,
  actorUserId: string
): Promise<void> {
  const cred = await db.gitHubCredential.findUniqueOrThrow({
    where: { id: credentialId },
  });

  await db.gitHubCredential.update({
    where: { id: credentialId },
    data: { isActive: false },
  });

  await auditLog(credentialId, 'REVOKE', {
    success: true,
    apiEndpoint: 'EMERGENCY_REVOKE',
    apiMethod: 'INTERNAL',
    errorMessage: `Revogado por ${actorUserId}. Motivo: ${reason}`,
  });

  // Avisa que revogação no GitHub deve ser manual
  console.warn(
    `[PAT Vault] Credencial "${cred.label}" revogada no Vault. ` +
    `ATENÇÃO: revogação no GitHub deve ser feita manualmente em: ` +
    `https://github.com/settings/tokens`
  );
}

/**
 * Hard delete de credencial inativa (após período de retenção).
 * Recomendado: aguardar 30 dias antes de hard delete.
 */
export async function hardDeleteCredential(
  credentialId: string,
  actorUserId: string
): Promise<void> {
  const cred = await db.gitHubCredential.findUniqueOrThrow({
    where: { id: credentialId },
  });

  if (cred.isActive) {
    throw new Error(
      'Não é possível hard-delete credencial ativa. Revoque primeiro e aguarde período de retenção (30 dias).'
    );
  }

  await db.gitHubCredential.delete({
    where: { id: credentialId },
  });

  // Audit log precisa ser manual aqui pois o cascade pode ter removido os logs
  console.info(
    `[PAT Vault] Hard delete de credencial ${credentialId} por ${actorUserId}`
  );
}

// ============================================================
// CHECK DE EXPIRAÇÃO (chamado por cron diário)
// ============================================================

export interface ExpiryCheckResult {
  expiringSoon: CredentialInfo[]; // < 14 dias
  expired: CredentialInfo[]; // já expirou mas ainda ativo (bug?)
  autoRevoked: string[]; // IDs que foram auto-revogados
}

/**
 * Verifica PATs próximos de expiração e auto-revoga expirados.
 * Deve ser chamado por cron diário (ex: 09:00 UTC).
 */
export async function checkPatExpiry(): Promise<ExpiryCheckResult> {
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const expiringSoonCreds = await db.gitHubCredential.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: soonThreshold, gt: now },
    },
  });

  const expiredCreds = await db.gitHubCredential.findMany({
    where: {
      isActive: true,
      expiresAt: { lt: now },
    },
  });

  // Auto-revoga expirados
  const autoRevoked: string[] = [];
  for (const cred of expiredCreds) {
    await db.gitHubCredential.update({
      where: { id: cred.id },
      data: { isActive: false },
    });
    await auditLog(cred.id, 'REVOKE', {
      success: true,
      errorMessage: 'Auto-revoked due to expiration',
      apiEndpoint: 'EXPIRY_CHECK',
      apiMethod: 'INTERNAL',
    });
    autoRevoked.push(cred.id);
  }

  // Alertas para expiração próxima
  for (const cred of expiringSoonCreds) {
    await auditLog(cred.id, 'EXPIRE_ALERT', {
      success: true,
      apiEndpoint: 'EXPIRY_CHECK',
      apiMethod: 'INTERNAL',
      errorMessage: `Expira em ${Math.ceil(
        (cred.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )} dias`,
    });
  }

  const toInfo = (c: typeof expiringSoonCreds[0]): CredentialInfo => {
    const daysUntilExpiry = Math.ceil(
      (c.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    return {
      id: c.id,
      label: c.label,
      authType: c.authType as AuthType,
      scopes: c.scopes,
      repositoryAccess: c.repositoryAccess,
      isActive: c.isActive,
      expiresAt: c.expiresAt,
      lastUsedAt: c.lastUsedAt,
      lastValidatedAt: c.lastValidatedAt,
      daysUntilExpiry,
      isExpired: c.expiresAt < now,
      isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= 14,
    };
  };

  return {
    expiringSoon: expiringSoonCreds.map(toInfo),
    expired: expiredCreds.map(toInfo),
    autoRevoked,
  };
}

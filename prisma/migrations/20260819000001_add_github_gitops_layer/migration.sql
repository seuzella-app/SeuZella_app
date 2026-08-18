-- Migration: GitHub GitOps Layer (PAT Vault + Audit Log)
-- Cria tabelas github_credentials e pat_audit_logs
-- Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 4)

-- Tabela de credenciais GitHub (PAT Fine-Grained / GitHub App / Deploy Keys)
-- Criptografadas com AES-256-GCM (master key via env var GITHUB_PAT_MASTER_KEY)
CREATE TABLE "github_credentials" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "encryptedPat" TEXT NOT NULL,
    "patFingerprint" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "repositoryAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "githubAppId" TEXT,
    "githubClientId" TEXT,
    "installationId" TEXT,
    "webhookSecret" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedFromId" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_credentials_pkey" PRIMARY KEY ("id")
);

-- Índices para busca eficiente
CREATE INDEX "github_credentials_patFingerprint_idx" ON "github_credentials"("patFingerprint");
CREATE INDEX "github_credentials_isActive_idx" ON "github_credentials"("isActive");
CREATE INDEX "github_credentials_expiresAt_idx" ON "github_credentials"("expiresAt");
CREATE INDEX "github_credentials_authType_idx" ON "github_credentials"("authType");

-- Constraint UNIQUE em label (uma credencial ativa por label)
CREATE UNIQUE INDEX "github_credentials_label_key" ON "github_credentials"("label");

-- Self-reference para cadeia de rotação (rotatedFromId → id)
ALTER TABLE "github_credentials"
    ADD CONSTRAINT "github_credentials_rotatedFromId_fkey"
    FOREIGN KEY ("rotatedFromId") REFERENCES "github_credentials"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabela de audit log — TODA operação envolvendo credenciais é logada
CREATE TABLE "pat_audit_logs" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "apiEndpoint" TEXT,
    "apiMethod" TEXT,
    "repository" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pat_audit_logs_pkey" PRIMARY KEY ("id")
);

-- FK para github_credentials (CASCADE delete para manter integridade)
ALTER TABLE "pat_audit_logs"
    ADD CONSTRAINT "pat_audit_logs_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "github_credentials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Índices para queries de auditoria (filtros comuns)
CREATE INDEX "pat_audit_logs_credentialId_createdAt_idx" ON "pat_audit_logs"("credentialId", "createdAt");
CREATE INDEX "pat_audit_logs_action_createdAt_idx" ON "pat_audit_logs"("action", "createdAt");
CREATE INDEX "pat_audit_logs_success_createdAt_idx" ON "pat_audit_logs"("success", "createdAt");
CREATE INDEX "pat_audit_logs_repository_createdAt_idx" ON "pat_audit_logs"("repository", "createdAt");

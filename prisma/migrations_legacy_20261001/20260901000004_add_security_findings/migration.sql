-- Migration: add_security_findings
-- Creates security_findings table for codex-security + T3MP3ST scan results

CREATE TABLE IF NOT EXISTS "security_findings" (
    "id"               TEXT NOT NULL,
    "scanType"         TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT NOT NULL DEFAULT '',
    "severity"         TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'open',
    "file"             TEXT,
    "line"             INTEGER,
    "cwe"              TEXT,
    "cvss"             DOUBLE PRECISION,
    "exploitPayload"   TEXT,
    "remediation"      TEXT,
    "autoFixAttempted" BOOLEAN NOT NULL DEFAULT false,
    "autoFixPrUrl"     TEXT,
    "scannedAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_findings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "security_findings_severity_check"
        CHECK ("severity" IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT "security_findings_status_check"
        CHECK ("status" IN ('open', 'triaged', 'fixing', 'fixed', 'false_positive', 'wont_fix')),
    CONSTRAINT "security_findings_scantype_check"
        CHECK ("scanType" IN ('sast', 'pentest', 'secret-scan', 'dependency'))
);

CREATE INDEX IF NOT EXISTS "security_findings_severity_status_idx"
    ON "security_findings" ("severity", "status");

CREATE INDEX IF NOT EXISTS "security_findings_scantype_scannedat_idx"
    ON "security_findings" ("scanType", "scannedAt");

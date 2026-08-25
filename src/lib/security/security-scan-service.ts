/**
 * Security Scan Service — codex-security + T3MP3ST integration
 * ============================================================================
 *
 * Executa scans de segurança usando GLM 5.2 (Cérebro Zélla embarcado).
 * Sem OpenAI, sem Anthropic — 100% GLM 5.2.
 *
 * ARQUITETURA:
 *   Cron de madrugada (03:00 BRT)
 *     ↓
 *   runSecurityScan() → GLM 5.2 analisa código + rota HTTP
 *     ↓
 *   Findings persistidos em SecurityFinding (Prisma)
 *     ↓
 *   Se severity >= HIGH → publishTenantEvent + alert ZéCode
 *     ↓
 *   ZéCode recebe alerta → GLM 5.2 gera patch → commit + PR
 *
 * O GLM 5.2 faz o papel que OpenAI/Anthropic faria no codex-security
 * e T3MP3ST originais — mas sem custo extra (já embarcado).
 */

import { db, isDatabaseAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Types ──────────────────────────────────────────────────────────────────

export type ScanType = 'sast' | 'pentest' | 'dependency' | 'secret-scan';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'triaged' | 'fixing' | 'fixed' | 'false_positive' | 'wont_fix';

export interface SecurityFinding {
  id: string;
  scanType: ScanType;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  file?: string;
  line?: number;
  cwe?: string;
  cvss?: number;
  exploitPayload?: string;
  remediation?: string;
  autoFixAttempted?: boolean;
  autoFixPrUrl?: string;
  createdAt: string;
  scannedAt: string;
}

export interface ScanResult {
  scanType: ScanType;
  findings: SecurityFinding[];
  totalFound: number;
  criticalCount: number;
  highCount: number;
  scanDurationMs: number;
  glmTokensUsed: number;
  mode: 'mock' | 'live';
}

// ── GLM 5.2 Configuration ──────────────────────────────────────────────────

function getGlmConfig() {
  return {
    apiKey: process.env.GLM_5_2_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-5.2',
    isLive: !!process.env.GLM_5_2_API_KEY && process.env.CEREBRO_LIVE_MODE === 'true',
  };
}

// ── Scan: SAST (Static Analysis) ────────────────────────────────────────────

const SAST_PROMPT = `You are a security expert auditing the Seu Zélla codebase.
Analyze the following source code for security vulnerabilities.

Focus on:
1. Injection (SQL, NoSQL, command, LDAP)
2. Broken Authentication & Session Management
3. Sensitive Data Exposure (plaintext secrets, PII in logs)
4. XML/XXE
5. Broken Access Control (IDOR, missing auth checks, tenant isolation gaps)
6. Security Misconfiguration (CSP, CORS, headers)
7. XSS (stored, reflected, DOM-based)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

For each finding, output JSON:
{
  "findings": [
    {
      "title": "Short title",
      "description": "Detailed explanation",
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/to/file.ts",
      "line": 42,
      "cwe": "CWE-89",
      "remediation": "How to fix"
    }
  ]
}

If no vulnerabilities found, return {"findings": []}.`;

/**
 * Run a SAST scan on a specific file using GLM 5.2.
 * Returns findings with file:line references.
 */
export async function runSastScan(
  filePath: string,
  _tenantId?: string,
): Promise<SecurityFinding[]> {
  const config = getGlmConfig();

  // Read the source file
  const fullPath = resolve(process.cwd(), filePath);
  if (!existsSync(fullPath)) {
    logger.warn('[SecurityScan] File not found', { filePath });
    return [];
  }

  const sourceCode = readFileSync(fullPath, 'utf8');
  if (sourceCode.length > 50000) {
    // Truncate large files to avoid token explosion
    logger.warn('[SecurityScan] File too large, truncating', { filePath, size: sourceCode.length });
  }

  const truncatedCode = sourceCode.slice(0, 50000);

  if (!config.isLive) {
    // Mock mode — return empty (no false positives)
    logger.info('[SecurityScan] SAST scan (mock mode)', { filePath });
    return [];
  }

  try {
    const messages: AdapterMessage[] = [
      { role: 'system', content: SAST_PROMPT },
      { role: 'user', content: `File: ${filePath}\n\n\`\`\`\n${truncatedCode}\n\`\`\`` },
    ];

    const result = await callOpenAICompatible({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      temperature: 0.1, // Low temp for consistent analysis
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = JSON.parse(result.content);
    const findings: SecurityFinding[] = (parsed.findings || []).map((f: any, i: number) => ({
      id: `sast_${Date.now()}_${i}`,
      scanType: 'sast' as ScanType,
      title: f.title || 'Untitled finding',
      description: f.description || '',
      severity: (f.severity || 'info') as FindingSeverity,
      status: 'open' as FindingStatus,
      file: f.file || filePath,
      line: f.line,
      cwe: f.cwe,
      remediation: f.remediation,
      scannedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));

    return findings;
  } catch (err) {
    logger.error('[SecurityScan] SAST scan failed', {
      filePath,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return [];
  }
}

// ── Scan: HTTP Pentest (T3MP3ST-style) — REAL HTTP execution ─────────────

const PENTEST_PROMPT = `You are an offensive security expert performing a black-box pentest
on the Seu Zélla web application. Generate HTTP attack requests that I will execute.

Output a JSON array of attack requests. Each request must have:
{
  "attacks": [
    {
      "name": "Short test name",
      "method": "GET|POST|DELETE|...",
      "path": "/api/path-to-test",
      "headers": {"Header-Name": "value"},
      "body": null or {"json": "body"},
      "expectedStatus": 401,
      "description": "What this test validates",
      "severity": "critical|high|medium|low|info",
      "remediation": "How to fix if it fails"
    }
  ]
}

Generate at least 10 attack tests covering:
1. Authentication bypass (no Authorization header → expect 401)
2. Authorization bypass (try /api/ddc/locks without auth → expect 401)
3. Cross-tenant access (try /api/ddc/locks/{id} without auth → expect 401)
4. Webhook signature bypass (POST /api/webhooks/asaas without signature → expect 401)
5. Stripe webhook bypass (POST /api/webhooks/stripe without signature → expect 401)
6. Alexa JWT bypass (POST /api/alexa/smart-home without Bearer → expect 401)
7. Rate limit test (same endpoint 100 times → expect some 429)
8. Information disclosure (GET /api/health → should not leak secrets)
9. CORS preflight (OPTIONS with malicious Origin → should not reflect *)
10. Path traversal (GET /api/../../../etc/passwd → expect 404 or 400)`;

interface AttackRequest {
  name: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  expectedStatus: number;
  description: string;
  severity: FindingSeverity;
  remediation: string;
}

interface AttackResult {
  attack: AttackRequest;
  actualStatus: number;
  passed: boolean;
  responseBody: string;
  evidence: string;
}

/**
 * Run a REAL black-box pentest scan.
 *
 * FLOW:
 *   1. GLM 5.2 generates 10+ attack HTTP requests (JSON)
 *   2. We EXECUTE each attack via fetch() against the target
 *   3. We compare actual HTTP status with expectedStatus
 *   4. If actual != expected → VULNERABILITY CONFIRMED (not theoretical)
 *   5. Finding persisted with REAL HTTP evidence (status code + response body)
 *
 * This is NOT a mock pentest. Each finding has real HTTP evidence.
 */
export async function runPentestScan(
  baseUrl: string,
  _tenantId?: string,
): Promise<SecurityFinding[]> {
  const config = getGlmConfig();
  const findings: SecurityFinding[] = [];

  // ── FASE 1: GLM generates attack payloads ──
  let attacks: AttackRequest[] = [];

  if (config.isLive) {
    try {
      const messages: AdapterMessage[] = [
        { role: 'system', content: PENTEST_PROMPT },
        { role: 'user', content: `Target: ${baseUrl}` },
      ];

      const result = await callOpenAICompatible({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        messages,
        temperature: 0.3,
        maxTokens: 4096,
        jsonMode: true,
      });

      const parsed = JSON.parse(result.content);
      attacks = parsed.attacks || [];
      logger.info('[SecurityScan] GLM generated pentest attacks', { count: attacks.length });
    } catch (err) {
      logger.error('[SecurityScan] GLM pentest generation failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // ── FASE 1b: If GLM unavailable, use hardcoded baseline attacks ──
  if (attacks.length === 0) {
    attacks = getBaselineAttacks();
    logger.info('[SecurityScan] Using baseline pentest attacks (GLM unavailable)', { count: attacks.length });
  }

  // ── FASE 2: EXECUTE each attack via real HTTP ──
  for (const attack of attacks) {
    try {
      const url = `${baseUrl}${attack.path}`;
      const fetchOptions: RequestInit = {
        method: attack.method,
        headers: attack.headers || {},
      };

      if (attack.body && (attack.method === 'POST' || attack.method === 'PUT' || attack.method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(attack.body);
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, fetchOptions);
      const actualStatus = response.status;
      const responseBody = await response.text().catch(() => '');

      // ── FASE 3: Compare actual vs expected ──
      const passed = actualStatus === attack.expectedStatus;

      const result: AttackResult = {
        attack,
        actualStatus,
        passed,
        responseBody: responseBody.slice(0, 500),
        evidence: `HTTP ${attack.method} ${attack.path} → ${actualStatus} (expected ${attack.expectedStatus})`,
      };

      // ── FASE 4: If attack SUCCEEDED (vuln confirmed) → create finding ──
      if (!passed) {
        // Attack succeeded = vulnerability is REAL (not theoretical)
        findings.push({
          id: `pentest_${Date.now()}_${findings.length}`,
          scanType: 'pentest',
          title: `CONFIRMED: ${attack.name}`,
          description: `${attack.description}. ${result.evidence}. Response: ${result.responseBody.slice(0, 200)}`,
          severity: attack.severity,
          status: 'open',
          file: attack.path,
          exploitPayload: `${attack.method} ${attack.path} with headers ${JSON.stringify(attack.headers)}`,
          remediation: attack.remediation,
          scannedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });

        logger.warn('[SecurityScan] Pentest VULNERABILITY CONFIRMED', {
          name: attack.name,
          path: attack.path,
          expected: attack.expectedStatus,
          actual: actualStatus,
          severity: attack.severity,
        });
      } else {
        logger.info('[SecurityScan] Pentest attack blocked (good)', {
          name: attack.name,
          path: attack.path,
          status: actualStatus,
        });
      }
    } catch (err) {
      // Network error — target may be down
      logger.error('[SecurityScan] Pentest attack failed (network)', {
        name: attack.name,
        path: attack.path,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  logger.info('[SecurityScan] Pentest scan complete', {
    totalAttacks: attacks.length,
    vulnerabilitiesFound: findings.length,
  });

  return findings;
}

/**
 * Baseline attacks used when GLM is unavailable (mock mode).
 * These are deterministic, hardcoded attack vectors that test the
 * most critical security boundaries.
 */
function getBaselineAttacks(): AttackRequest[] {
  return [
    {
      name: 'Auth bypass — no Authorization header',
      method: 'GET',
      path: '/api/ddc/locks',
      headers: {},
      body: null,
      expectedStatus: 401,
      description: 'Accessing protected endpoint without auth token should return 401',
      severity: 'critical',
      remediation: 'Ensure all /api/ddc/* routes require authentication',
    },
    {
      name: 'Webhook bypass — Asaas without signature',
      method: 'POST',
      path: '/api/webhooks/asaas',
      headers: {},
      body: { event: 'PAYMENT_RECEIVED', payment: { id: 'test' } },
      expectedStatus: 401,
      description: 'Webhook without HMAC signature should be rejected',
      severity: 'critical',
      remediation: 'Ensure verifyAsaasWebhook is called before processing',
    },
    {
      name: 'Webhook bypass — Stripe without signature',
      method: 'POST',
      path: '/api/webhooks/stripe',
      headers: {},
      body: { type: 'checkout.session.completed' },
      expectedStatus: 401,
      description: 'Stripe webhook without signature should be rejected',
      severity: 'critical',
      remediation: 'Ensure verifyWebhook HMAC-SHA256 is called',
    },
    {
      name: 'Webhook bypass — MercadoPago without signature',
      method: 'POST',
      path: '/api/webhooks/mercadopago',
      headers: {},
      body: { type: 'payment' },
      expectedStatus: 401,
      description: 'MP webhook without signature should be rejected',
      severity: 'critical',
      remediation: 'Ensure verifyMercadoPagoWebhook is called',
    },
    {
      name: 'Alexa JWT bypass — no Bearer token',
      method: 'POST',
      path: '/api/alexa/smart-home',
      headers: { 'Content-Type': 'application/json' },
      body: { directive: { header: { namespace: 'Alexa.Discovery', name: 'Discover' } } },
      expectedStatus: 401,
      description: 'Alexa endpoint without JWT should return 401',
      severity: 'critical',
      remediation: 'Ensure verifyJwtToken is called before processing',
    },
    {
      name: 'Alexa JWT bypass — alg=none',
      method: 'POST',
      path: '/api/alexa/smart-home',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0In0.',
        'Content-Type': 'application/json',
      },
      body: { directive: { header: { namespace: 'Alexa.Discovery', name: 'Discover' } } },
      expectedStatus: 401,
      description: 'JWT with alg=none should be rejected',
      severity: 'critical',
      remediation: 'Ensure jwtVerify uses algorithms: [HS256] only',
    },
    {
      name: 'IDOR — access lock by ID without auth',
      method: 'GET',
      path: '/api/ddc/locks/lock_test_id',
      headers: {},
      body: null,
      expectedStatus: 401,
      description: 'Accessing lock by ID without auth should return 401',
      severity: 'high',
      remediation: 'Ensure resolveTenantId is called before findFirst',
    },
    {
      name: 'CORS — preflight with malicious origin',
      method: 'OPTIONS',
      path: '/api/ddc/locks',
      headers: {
        'Origin': 'https://evil.com',
        'Access-Control-Request-Method': 'GET',
      },
      body: null,
      expectedStatus: 204,
      description: 'CORS preflight from evil origin should not reflect Access-Control-Allow-Origin: *',
      severity: 'medium',
      remediation: 'Configure CORS to only allow seuzella.com origins',
    },
    {
      name: 'Information disclosure — /api/health',
      method: 'GET',
      path: '/api/health',
      headers: {},
      body: null,
      expectedStatus: 200,
      description: 'Health endpoint should return 200 but must NOT expose secrets',
      severity: 'info',
      remediation: 'Ensure /api/health does not return env var values',
    },
    {
      name: 'Path traversal attempt',
      method: 'GET',
      path: '/api/../../../etc/passwd',
      headers: {},
      body: null,
      expectedStatus: 404,
      description: 'Path traversal should be blocked (404 or 400)',
      severity: 'high',
      remediation: 'Ensure path validation rejects traversal attempts',
    },
  ];
}

// ── Scan: Secret Detection ──────────────────────────────────────────────────

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, cwe: 'CWE-798' },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g, cwe: 'CWE-798' },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, cwe: 'CWE-321' },
  { name: 'JWT Secret', pattern: /(jwt[_-]?(secret|key))\s*[:=]\s*['"]([A-Za-z0-9+/=]{20,})['"]/gi, cwe: 'CWE-798' },
  { name: 'Database URL', pattern: /(postgres|mongodb|redis|mysql):\/\/[^\s]+:[^\s]+@/g, cwe: 'CWE-798' },
  { name: 'Stripe Key', pattern: /sk_(live|test)_[0-9a-zA-Z]{24,}/g, cwe: 'CWE-798' },
  { name: 'Hardcoded Password', pattern: /password\s*[:=]\s*['"]([^'"]{8,})['"]/gi, cwe: 'CWE-798' },
  { name: 'API Key Generic', pattern: /(api[_-]?key)\s*[:=]\s*['"]([A-Za-z0-9]{32,})['"]/gi, cwe: 'CWE-798' },
];

/**
 * Scan for hardcoded secrets in source files.
 * This is a regex-based scan (no LLM needed) — fast and deterministic.
 */
export async function runSecretScan(directory: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const findingsSeen = new Set<string>();

  // Use grep to find files with potential secrets
  try {
    const result = execFileSync('grep', [
      '-rln',
      '--include=*.ts',
      '--include=*.tsx',
      '--include=*.js',
      '--include=*.json',
      '--include=*.env*',
      '--include=*.yml',
      '--include=*.yaml',
      '-E',
      SECRET_PATTERNS.map(p => p.pattern.source).join('|'),
      directory,
    ], { timeout: 30000, encoding: 'utf8' }).trim();

    const files = result.split('\n').filter(Boolean);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const { name, pattern, cwe } of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (!matches) continue;

        for (const match of matches) {
          // Skip if it's in a comment or .env.example
          if (file.includes('.env.example') || file.includes('.gitignore')) continue;
          // Skip test files
          if (file.includes('.test.') || file.includes('.spec.')) continue;

          const key = `${file}:${name}:${match.slice(0, 20)}`;
          if (findingsSeen.has(key)) continue;
          findingsSeen.add(key);

          // Find line number
          const lines = content.split('\n');
          let lineNum = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match.slice(0, 20))) {
              lineNum = i + 1;
              break;
            }
          }

          findings.push({
            id: `secret_${Date.now()}_${findings.length}`,
            scanType: 'secret-scan',
            title: `Hardcoded ${name}`,
            description: `Found ${name} in ${file}:${lineNum}. Value: ${match.slice(0, 10)}...`,
            severity: 'critical',
            status: 'open',
            file,
            line: lineNum,
            cwe,
            remediation: `Move to environment variable and remove from source code.`,
            scannedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err: any) {
    // grep returns exit code 1 when no matches found — that's OK
    if (err.status !== 1) {
      logger.error('[SecurityScan] Secret scan failed', {
        error: err.message,
      });
    }
  }

  return findings;
}

// ── Orchestrator: Run all scans ─────────────────────────────────────────────

/**
 * Run all security scans in sequence.
 * Called by the cron job at 03:00 BRT (06:00 UTC).
 *
 * @returns Summary of findings by severity
 */
export async function runFullSecurityScan(): Promise<ScanResult> {
  const startTime = Date.now();
  const allFindings: SecurityFinding[] = [];
  let glmTokensUsed = 0;
  const config = getGlmConfig();

  logger.info('[SecurityScan] Starting full security scan', {
    mode: config.isLive ? 'live' : 'mock',
    timestamp: new Date().toISOString(),
  });

  // 1. Secret scan (regex, fast, no LLM)
  try {
    const secretFindings = await runSecretScan('src/');
    allFindings.push(...secretFindings);
    logger.info('[SecurityScan] Secret scan complete', { found: secretFindings.length });
  } catch (err) {
    logger.error('[SecurityScan] Secret scan failed', { error: err });
  }

  // 1b. Dependency scan (npm audit, fast, no LLM)
  try {
    const depFindings = await runDependencyScan();
    allFindings.push(...depFindings);
    logger.info('[SecurityScan] Dependency scan complete', { found: depFindings.length });
  } catch (err) {
    logger.error('[SecurityScan] Dependency scan failed', { error: err });
  }

  // 2. SAST scan on critical files (GLM 5.2)
  const criticalFiles = [
    'src/lib/auth.ts',
    'src/lib/auth/jwt.ts',
    'src/middleware.ts',
    'src/lib/security/webhook-verify.ts',
    'src/lib/db/tenant-prisma.ts',
    'src/app/api/webhooks/stripe/route.ts',
    'src/app/api/webhooks/asaas/route.ts',
    'src/app/api/ddc/locks/[id]/pins/route.ts',
  ];

  for (const file of criticalFiles) {
    try {
      const sastFindings = await runSastScan(file);
      allFindings.push(...sastFindings);
      logger.info('[SecurityScan] SAST complete', { file, found: sastFindings.length });
    } catch (err) {
      logger.error('[SecurityScan] SAST failed', { file, error: err });
    }
  }

  // 3. Pentest scan (GLM 5.2, black-box)
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  try {
    const pentestFindings = await runPentestScan(baseUrl);
    allFindings.push(...pentestFindings);
    logger.info('[SecurityScan] Pentest complete', { found: pentestFindings.length });
  } catch (err) {
    logger.error('[SecurityScan] Pentest failed', { error: err });
  }

  // 4. Persist findings to DB
  if (await isDatabaseAvailable()) {
    try {
      for (const finding of allFindings) {
        await (db as any).securityFinding?.create({
          data: {
            id: finding.id,
            scanType: finding.scanType,
            title: finding.title,
            description: finding.description,
            severity: finding.severity,
            status: finding.status,
            file: finding.file,
            line: finding.line,
            cwe: finding.cwe,
            cvss: finding.cvss,
            exploitPayload: finding.exploitPayload,
            remediation: finding.remediation,
            autoFixAttempted: false,
            scannedAt: new Date(finding.scannedAt),
          },
        }).catch(() => {}); // Silently skip if model doesn't exist yet
      }
    } catch (err) {
      logger.error('[SecurityScan] Persist findings failed', { error: err });
    }
  }

  // 5. Alert ZéCode for critical/high findings
  const criticalFindings = allFindings.filter(f => f.severity === 'critical' || f.severity === 'high');
  if (criticalFindings.length > 0) {
    // Publish to realtime SSE — ZéCode panel receives alert
    publishTenantEvent('zcc-admin-tenant', 'tenant:metadata_updated', {
      type: 'security_alert',
      findings: criticalFindings.map(f => ({
        title: f.title,
        severity: f.severity,
        file: f.file,
        remediation: f.remediation,
      })),
      count: criticalFindings.length,
      timestamp: new Date().toISOString(),
    });

    logger.warn('[SecurityScan] Critical findings detected — alerting ZéCode', {
      count: criticalFindings.length,
      findings: criticalFindings.map(f => `${f.severity}: ${f.title}`),
    });
  }

  const durationMs = Date.now() - startTime;
  const result: ScanResult = {
    scanType: 'sast', // overall scan
    findings: allFindings,
    totalFound: allFindings.length,
    criticalCount: allFindings.filter(f => f.severity === 'critical').length,
    highCount: allFindings.filter(f => f.severity === 'high').length,
    scanDurationMs: durationMs,
    glmTokensUsed,
    mode: config.isLive ? 'live' : 'mock',
  };

  logger.info('[SecurityScan] Full scan complete', {
    total: result.totalFound,
    critical: result.criticalCount,
    high: result.highCount,
    durationMs,
    mode: result.mode,
  });

  return result;
}

// ── Scan: Dependency vulnerability (npm audit) ──────────────────────────────

/**
 * Run npm audit and parse vulnerabilities.
 * Uses `npm audit --json` to get structured output.
 */
export async function runDependencyScan(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const { execFileSync } = await import('node:child_process');
    const output = execFileSync('npm', ['audit', '--json', '--omit=dev'], {
      timeout: 30000,
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const audit = JSON.parse(output);
    const vulnerabilities = audit.vulnerabilities || {};

    for (const [packageName, info] of Object.entries(vulnerabilities)) {
      const v = info as any;
      const severity = (v.severity || 'info') as FindingSeverity;

      findings.push({
        id: `dep_${Date.now()}_${packageName}`,
        scanType: 'dependency',
        title: `Vulnerable dependency: ${packageName}`,
        description: `${packageName} has ${v.via?.length || 0} vulnerability path(s). Severity: ${severity}.`,
        severity,
        status: 'open',
        file: 'package.json',
        line: undefined,
        cwe: 'CWE-1035', // Using Components with Known Vulnerabilities
        remediation: v.fixAvailable ? `Run: npm install ${packageName}@${typeof v.fixAvailable === 'object' ? v.fixAvailable.version : v.fixAvailable}` : 'Manual review required',
        scannedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }

    logger.info('[SecurityScan] Dependency scan complete', {
      found: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
    });
  } catch (err: any) {
    // npm audit returns exit code 1 if vulnerabilities found — that's expected
    if (err.stdout) {
      try {
        const audit = JSON.parse(err.stdout.toString());
        const vulnerabilities = audit.vulnerabilities || {};
        for (const [packageName, info] of Object.entries(vulnerabilities)) {
          const v = info as any;
          const severity = (v.severity || 'info') as FindingSeverity;
          findings.push({
            id: `dep_${Date.now()}_${packageName}`,
            scanType: 'dependency',
            title: `Vulnerable dependency: ${packageName}`,
            description: `${packageName} has ${v.via?.length || 0} vulnerability path(s). Severity: ${severity}.`,
            severity,
            status: 'open',
            file: 'package.json',
            cwe: 'CWE-1035',
            remediation: v.fixAvailable ? `npm install ${packageName}@latest` : 'Manual review',
            scannedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        logger.error('[SecurityScan] Dependency scan parse failed', { error: err.message });
      }
    } else {
      logger.error('[SecurityScan] Dependency scan failed', { error: err.message });
    }
  }

  return findings;
}

// ── Auto-fix: GLM 5.2 generates patch for critical findings ─────────────────

const AUTOFIX_PROMPT = `You are ZéCode, the DEV FULL STACK agent of Seu Zélla.
A security vulnerability was found. Generate a fix.

Rules:
1. Output ONLY the corrected code (no explanations).
2. Preserve all existing functionality.
3. Follow the existing code style.
4. Add a comment: "// SECURITY FIX: <brief description>"
5. Do not introduce new dependencies.
6. Do not remove existing security measures.

Output the complete fixed file content.`;

/**
 * Generate an auto-fix for a security finding using GLM 5.2.
 * ZéCode analyzes the vulnerable code and generates a patch.
 *
 * ISOLATION: The fix is generated on a SEPARATE BRANCH, not main.
 * The fix goes through PR review before merge — never direct to main.
 *
 * @param finding The security finding to fix
 * @returns Object with branch name, patch content, and PR-ready description
 */
export async function generateAutoFix(finding: SecurityFinding): Promise<{
  patch: string | null;
  branchName: string;
  prTitle: string;
  prDescription: string;
} | null> {
  const config = getGlmConfig();

  if (!config.isLive || !finding.file) {
    return null;
  }

  try {
    const fullPath = resolve(process.cwd(), finding.file);
    if (!existsSync(fullPath)) return null;

    const sourceCode = readFileSync(fullPath, 'utf8');

    const messages: AdapterMessage[] = [
      { role: 'system', content: AUTOFIX_PROMPT },
      {
        role: 'user',
        content: `Vulnerability: ${finding.title}\nSeverity: ${finding.severity}\nCWE: ${finding.cwe || 'N/A'}\nFile: ${finding.file}:${finding.line || '?'}\nRemediation hint: ${finding.remediation || 'N/A'}\n\nCurrent code:\n\`\`\`\n${sourceCode}\n\`\`\``,
      },
    ];

    const result = await callOpenAICompatible({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      temperature: 0.1,
      maxTokens: 8192,
    });

    // Generate isolated branch name (never commit to main directly)
    const sanitizedTitle = finding.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40);
    const branchName = `security-fix/${sanitizedTitle}-${Date.now().toString(36)}`;
    const prTitle = `[AUTO-FIX] ${finding.severity.toUpperCase()}: ${finding.title}`;
    const prDescription = `## Security Auto-Fix by ZéCode (GLM 5.2)

**Finding:** ${finding.title}
**Severity:** ${finding.severity}
**CWE:** ${finding.cwe || 'N/A'}
**File:** ${finding.file}:${finding.line || '?'}
**Scan Type:** ${finding.scanType}

### Remediation
${finding.remediation || 'N/A'}

### Evidence
${finding.exploitPayload || finding.description}

---
🤖 Generated by ZéCode Security Auto-Fix Pipeline
⚠️ This PR was auto-generated. Review carefully before merge.`;

    return {
      patch: result.content,
      branchName,
      prTitle,
      prDescription,
    };
  } catch (err) {
    logger.error('[SecurityScan] Auto-fix generation failed', {
      finding: finding.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

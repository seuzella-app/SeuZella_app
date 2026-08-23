/**
 * Night Audit Service — Relatório Noturno Automático
 * =====================================================
 *
 * Roda diariamente às 03:00 BRT (06:00 UTC) via cron job.
 * Executa 3 etapas:
 *
 *   1. CODE SCAN — percorre o código buscando vulnerabilidades e más práticas
 *      usando patterns SAST (Static Application Security Testing):
 *      - eval() / Function() em qualquer lugar
 *      - dangerouslySetInnerHTML sem sanitize
 *      - sql injection (template literals em queries)
 *      - hard-coded secrets / API keys / tokens
 *      - fs.readFile sem path traversal guard
 *      - crypto.createHash('md5'/'sha1') — fracos
 *      - process.env.* exibidos em logs
 *      - hooks React perigosos (useEffect sem cleanup)
 *      - endpoints sem withApiGuard
 *      - dependências com vulnerabilidades conhecidas (audit npm)
 *
 *   2. METRICS COLLECTION — coleta métricas do dia anterior (00:00-23:59 BRT):
 *      - Leads captados (criados em Lead)
 *      - Leads convertidos (status='converted' + Lead.converted=true)
 *      - Cliques no anúncio (DevicePing with route='/mobile/*' isMobile=true
 *        — quando integrar Google Ads, troca por dados reais)
 *      - Distribuição geográfica: top UFs, top cidades, top bairros
 *      - Pousadas convertidas (Tenant com Property + lat/lng)
 *      - Devices ativos (mobile vs desktop)
 *
 *   3. LLM ANALYSIS — envia código + métricas para GLM 5.2 gerar:
 *      - Resumo executivo (PT-BR, 1-3 parágrafos)
 *      - Severity (info|warning|critical|emergency)
 *      - Recomendações priorizadas
 *      - Riscos detectados
 *      - Oportunidades de evolução
 *
 * Persiste tudo em NightAuditReport (1 por dia) e disponibiliza
 * via /api/zcc/night-audit/latest para a "Sala de Guerra" do ZCC.
 */

import { db } from '@/lib/db';
import { GlmCerebroService } from './glm-service';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { getCerebroMode } from './types';
import { NightPentestService, type PentestFinding } from './night-pentest-service';
import { NightActivityTrackerService, type ActivityEvent } from './night-activity-tracker-service';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface VulnFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;          // 'eval_usage' | 'dangerously_set_inner_html' | etc.
  file: string;          // path relativo
  line: number;
  description: string;
  recommendation: string;
  cwe?: string;          // Common Weakness Enumeration (opcional)
}

export interface DayMetrics {
  // Leads
  leadsCaptured: number;
  leadsConverted: number;
  conversionRate: number;
  // Cliques (mock = dispositivos mobile que acessaram)
  clicks: number;
  // Distribuição geográfica
  regions: Array<{ uf: string; count: number }>;
  cities: Array<{ cidade: string; uf: string; count: number }>;
  // Pousadas convertidas (Tenant pagantes)
  pousadasConverted: Array<{
    nome: string;
    cidade: string;
    uf: string;
    plano: string;
    whatsapp?: string | null;
  }>;
  // Dispositivos
  devicesMobile: number;
  devicesDesktop: number;
  // Total de Tenants ativos
  totalActiveTenants: number;
}

export interface LLMAnalysis {
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  rawResponse?: any;
}

export interface NightAuditResult {
  auditDate: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  status: 'completed' | 'partial' | 'failed';
  summary: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  confidence: number;
  vulnFindings: VulnFinding[];
  vulnCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  // NOVO: Pentest findings (do Grande Run #1, consolidado)
  pentestFindings?: PentestFinding[];
  pentestStats?: {
    total: number;
    newlyDetected: number;
    persisting: number;
    resolvedLast7d: number;
  };
  // NOVO: Atividade suspeita rastreada em 4 superfícies
  activityEvents?: ActivityEvent[];
  activityStats?: {
    landing_page: { anomalies: number; severity: string };
    ddc: { anomalies: number; severity: string };
    linkinbio: { anomalies: number; severity: string };
    zella_parceiros: { anomalies: number; severity: string };
  };
  metrics: DayMetrics;
  llmAnalysis: LLMAnalysis;
  llmTokensInput: number;
  llmTokensOutput: number;
  llmCostUsd: number;
  mode: 'mock' | 'live';
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PADRÕES SAST — Static Application Security Testing
// ─────────────────────────────────────────────────────────────────────────────

interface VulnPattern {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  pattern: RegExp;
  description: string;
  recommendation: string;
  cwe?: string;
  falsePositivePatterns?: RegExp[]; // se match, é false positive
}

const VULN_PATTERNS: VulnPattern[] = [
  // ── CRITICAL ──
  {
    type: 'eval_usage',
    severity: 'critical',
    pattern: /\beval\s*\(/,
    description: 'Uso de eval() — permite execução arbitrária de código',
    recommendation: 'Remova eval() e use JSON.parse() ou alternativas seguras',
    cwe: 'CWE-95',
    falsePositivePatterns: [/\/\/.*eval/, /\*.*eval/],
  },
  {
    type: 'sql_injection_template_literal',
    severity: 'critical',
    pattern: /\$\{.*\}\s*[;)]/g,
    description: 'Possível SQL injection via template literal em query',
    recommendation: 'Use parameterized queries: prisma.$queryRaw`...` com ${param}',
    cwe: 'CWE-89',
    falsePositivePatterns: [/console\.(log|warn|error)/, /\/\/.*/],
  },
  {
    type: 'hardcoded_secret',
    severity: 'critical',
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][a-zA-Z0-9]{20,}["']/i,
    description: 'Secret hard-coded no código — risco de exposição no GitHub',
    recommendation: 'Use process.env.SECRET_NAME e configure via Vercel dashboard',
    cwe: 'CWE-798',
    falsePositivePatterns: [/process\.env/, /\$\{process\.env/, /test/i, /mock/i],
  },

  // ── HIGH ──
  {
    type: 'dangerously_set_inner_html',
    severity: 'high',
    pattern: /dangerouslySetInnerHTML/,
    description: 'Uso de dangerouslySetInnerHTML — XSS se input não for sanitizado',
    recommendation: 'Use DOMPurify.sanitize() antes de injetar HTML',
    cwe: 'CWE-79',
  },
  {
    type: 'weak_crypto',
    severity: 'high',
    pattern: /crypto\.createHash\s*\(\s*["'](md5|sha1)["']\s*\)/,
    description: 'Algoritmo de hash fraco (md5/sha1)',
    recommendation: 'Use sha256 ou sha512 para dados sensíveis',
    cwe: 'CWE-327',
  },
  {
    type: 'disable_cors_wildcard',
    severity: 'high',
    pattern: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/,
    description: 'CORS configurado com wildcard * — qualquer origem pode chamar',
    recommendation: 'Restrinja a origens confiáveis: ["https://seuzella.com"]',
    cwe: 'CWE-942',
  },
  {
    type: 'path_traversal',
    severity: 'high',
    pattern: /fs\.read(?:File|Sync)\s*\(\s*[^,)]*\$\{/,
    description: 'Possível path traversal — input do usuário em fs.readFile',
    recommendation: 'Valide e sanitize o path: path.normalize() + path.basename()',
    cwe: 'CWE-22',
  },

  // ── MEDIUM ──
  {
    type: 'use_effect_no_cleanup',
    severity: 'medium',
    pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*setInterval|setTimeout/,
    description: 'useEffect com setInterval/setTimeout sem cleanup — memory leak',
    recommendation: 'Retorne função cleanup: return () => clearInterval(interval)',
  },
  {
    type: 'console_log_prod',
    severity: 'medium',
    pattern: /console\.(log|debug)\s*\(/,
    description: 'console.log em produção — pode vazar dados sensíveis',
    recommendation: 'Use logger estruturado ou remova em produção',
    falsePositivePatterns: [/\/\/.*/],
  },
  {
    type: 'no_error_boundary',
    severity: 'medium',
    pattern: /throw\s+new\s+Error\([^)]*\)(?![^{]*catch)/,
    description: 'Throw sem try/catch — pode crashar a UI',
    recommendation: 'Envolve em try/catch ou use Error Boundary',
  },

  // ── LOW ──
  {
    type: 'any_type',
    severity: 'low',
    pattern: /:\s*any\b/,
    description: 'TypeScript any — perde type safety',
    recommendation: 'Defina tipos específicos: interface, type, union',
  },
  {
    type: 'ts_expect_error',
    severity: 'low',
    pattern: /@ts-expect-error|@ts-ignore/,
    description: '@ts-ignore/@ts-expect-error — suprime erro de tipo',
    recommendation: 'Corrija o erro de tipo ao invés de suprimir',
  },

  // ── INFO ──
  {
    type: 'todo_comment',
    severity: 'info',
    pattern: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/,
    description: 'TODO/FIXME pendente no código',
    recommendation: 'Crie issue no GitHub para acompanhar',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_DIRS = [
  'src/app/api',
  'src/lib',
  'src/components',
];

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export class NightAuditService {
  /**
   * Executa o audit completo do dia.
   * Idempotente: se já existe report para a data, retorna o existente.
   */
  public static async run(opts?: { force?: boolean; dateOverride?: string }): Promise<NightAuditResult> {
    const startedAt = new Date();
    const auditDate = opts?.dateOverride ?? getBRTDateString();
    const mode = getCerebroMode();

    // Idempotência: se já existe, retorna (a menos que force=true)
    if (!opts?.force) {
      try {
        const existing = await (db as any).nightAuditReport?.findUnique({
          where: { auditDate },
        });
        if (existing && existing.status === 'completed') {
          return this.deserialize(existing);
        }
      } catch {}
    }

    // Cria registro "running"
    const reportId = await this.createRunningReport(auditDate, startedAt, mode);

    try {
      // ── 1. CODE SCAN (SAST básico — mantém para retrocompatibilidade) ──
      const vulnFindings = await this.scanCode();
      const vulnCounts = this.countBySeverity(vulnFindings);

      // ── 1.5. PENTEST (Grande Run #1 consolidado) ──
      // Executa SAST completo + API pentest + npm audit + diff vs últimos 7d
      const pentestResult = await NightPentestService.run({ auditReportId: reportId });
      const pentestFindings = pentestResult.findings;
      const pentestStats = {
        total: pentestFindings.length,
        newlyDetected: pentestResult.diff.newlyDetected.length,
        persisting: pentestResult.diff.persisting.length,
        resolvedLast7d: pentestResult.diff.resolved.length,
      };

      // ── 2. METRICS COLLECTION ──
      const metrics = await this.collectDayMetrics();

      // ── 2.5. ACTIVITY TRACKING (4 superfícies) ──
      const activityResult = await NightActivityTrackerService.run();
      const activityEvents = activityResult.events;
      const activityStats = {
        landing_page: activityResult.stats.landingPage,
        ddc: activityResult.stats.ddc,
        linkinbio: activityResult.stats.linkinbio,
        zella_parceiros: activityResult.stats.zellaParceiros,
      };

      // ── 3. LLM ANALYSIS (GLM 5.2) ──
      // Passa vulns + pentest + activity + metrics para o LLM
      const llmResult = await this.runLLMAnalysis(
        vulnFindings, metrics, mode,
        { pentestFindings, activityEvents, activityStats }
      );

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      const result: NightAuditResult = {
        auditDate,
        startedAt,
        completedAt,
        durationMs,
        status: 'completed',
        summary: llmResult.summary,
        severity: llmResult.severity,
        confidence: llmResult.confidence,
        vulnFindings,
        vulnCounts,
        pentestFindings,
        pentestStats,
        activityEvents,
        activityStats,
        metrics,
        llmAnalysis: llmResult.analysis,
        llmTokensInput: llmResult.tokensInput,
        llmTokensOutput: llmResult.tokensOutput,
        llmCostUsd: llmResult.costUsd,
        mode,
      };

      // Persiste resultado final
      await this.updateReport(reportId, result);

      return result;
    } catch (err: any) {
      // Marca como failed mas mantém dados parciais
      const errorMessage = err?.message ?? String(err);
      const completedAt = new Date();
      await this.markAsFailed(reportId, completedAt, startedAt, errorMessage, mode);
      throw err;
    }
  }

  /**
   * Retorna o último report disponível (mesmo que partial).
   */
  public static async getLatest(): Promise<NightAuditResult | null> {
    try {
      const report = await (db as any).nightAuditReport?.findFirst({
        orderBy: { auditDate: 'desc' },
      });
      if (!report) return null;
      return this.deserialize(report);
    } catch (err) {
      console.warn('[NIGHT_AUDIT] Falha ao buscar último report:', err);
      return null;
    }
  }

  /**
   * Retorna o report de uma data específica (YYYY-MM-DD BRT).
   */
  public static async getByDate(auditDate: string): Promise<NightAuditResult | null> {
    try {
      const report = await (db as any).nightAuditReport?.findUnique({
        where: { auditDate },
      });
      if (!report) return null;
      return this.deserialize(report);
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 1: CODE SCAN
  // ─────────────────────────────────────────────────────────────────────────

  private static async scanCode(): Promise<VulnFinding[]> {
    const findings: VulnFinding[] = [];
    const projectRoot = path.resolve(process.cwd());

    for (const dir of SOURCE_DIRS) {
      const absDir = path.join(projectRoot, dir);
      if (!fs.existsSync(absDir)) continue;

      await this.scanDir(absDir, projectRoot, findings);
    }

    // Limita a 200 findings para não estourar o LLM context
    return findings.slice(0, 200);
  }

  private static async scanDir(dir: string, root: string, findings: VulnFinding[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .next, dist, etc.
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', '.git', '__pycache__'].includes(entry.name)) continue;
        await this.scanDir(fullPath, root, findings);
        continue;
      }

      if (!FILE_EXTENSIONS.some(ext => entry.name.endsWith(ext))) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(root, fullPath);
        this.scanFile(content, relativePath, findings);
      } catch {
        // Skip unreadable files
      }
    }
  }

  private static scanFile(content: string, filePath: string, findings: VulnFinding[]) {
    const lines = content.split('\n');

    for (const pattern of VULN_PATTERNS) {
      // Reset regex lastIndex (em caso de flag g)
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags.replace('g', '') + 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;

        // Check false positives
        if (pattern.falsePositivePatterns) {
          const lineContent = lines[lineNum - 1] || '';
          const isFalsePositive = pattern.falsePositivePatterns.some(fp => fp.test(lineContent));
          if (isFalsePositive) continue;
        }

        // Dedup: mesmo arquivo + linha + tipo = 1 finding
        const exists = findings.find(
          f => f.file === filePath && f.line === lineNum && f.type === pattern.type
        );
        if (exists) continue;

        findings.push({
          severity: pattern.severity,
          type: pattern.type,
          file: filePath,
          line: lineNum,
          description: pattern.description,
          recommendation: pattern.recommendation,
          cwe: pattern.cwe,
        });
      }
    }
  }

  private static countBySeverity(findings: VulnFinding[]) {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 2: METRICS COLLECTION (dia anterior em BRT)
  // ─────────────────────────────────────────────────────────────────────────

  private static async collectDayMetrics(): Promise<DayMetrics> {
    const { startBRT, endBRT } = getYesterdayBRTWindow();

    const empty: DayMetrics = {
      leadsCaptured: 0,
      leadsConverted: 0,
      conversionRate: 0,
      clicks: 0,
      regions: [],
      cities: [],
      pousadasConverted: [],
      devicesMobile: 0,
      devicesDesktop: 0,
      totalActiveTenants: 0,
    };

    try {
      // Leads captados (criados no dia)
      const leadsCaptured = await db.lead.count({
        where: { createdAt: { gte: startBRT, lte: endBRT } },
      }).catch(() => 0);

      // Leads convertidos (status='converted')
      const leadsConverted = await db.lead.count({
        where: {
          status: 'converted',
          updatedAt: { gte: startBRT, lte: endBRT },
        },
      }).catch(() => 0);

      // Cliques no anúncio (mock = dispositivos mobile que acessaram)
      // Em produção, trocar por integração Google Ads API
      let clicks = 0;
      try {
        clicks = await (db as any).devicePing?.count({
          where: {
            isMobile: true,
            lastSeen: { gte: startBRT, lte: endBRT },
          },
        }) ?? 0;
      } catch {}

      // Distribuição geográfica (top 10 UFs)
      let regions: Array<{ uf: string; count: number }> = [];
      try {
        const leadsByUF = await db.lead.groupBy({
          by: ['state'],
          where: { createdAt: { gte: startBRT, lte: endBRT } },
          _count: true,
          orderBy: { _count: { state: 'desc' } },
          take: 10,
        });
        regions = leadsByUF
          .filter((l: any) => l.state)
          .map((l: any) => ({ uf: l.state as string, count: l._count }));
      } catch {}

      // Top 10 cidades
      let cities: Array<{ cidade: string; uf: string; count: number }> = [];
      try {
        const leadsByCity = await db.lead.groupBy({
          by: ['city', 'state'],
          where: { createdAt: { gte: startBRT, lte: endBRT } },
          _count: true,
          orderBy: { _count: { city: 'desc' } },
          take: 10,
        });
        cities = leadsByCity
          .filter((l: any) => l.city)
          .map((l: any) => ({
            cidade: l.city as string,
            uf: (l.state as string) || '',
            count: l._count,
          }));
      } catch {}

      // Pousadas convertidas (Tenants ativos com Property + lat/lng)
      let pousadasConverted: any[] = [];
      let totalActiveTenants = 0;
      try {
        const tenants = await db.tenant.findMany({
          where: {
            status: 'active',
            plan: { in: ['lite', 'pro', 'max', 'parceiro'] },
            subscriptionAt: { gte: startBRT, lte: endBRT },
          },
          include: { property: true },
        });
        totalActiveTenants = await db.tenant.count({
          where: { status: 'active' },
        });
        pousadasConverted = tenants
          .filter(t => t.property && t.property.latitude != null && t.property.longitude != null)
          .map(t => ({
            nome: t.property?.name || t.name,
            cidade: t.property?.city || '',
            uf: t.property?.state || '',
            plano: t.plan,
            whatsapp: t.whatsappPhoneNumber,
          }));
      } catch {}

      // Devices ativos hoje
      let devicesMobile = 0;
      let devicesDesktop = 0;
      try {
        devicesMobile = await (db as any).devicePing?.count({
          where: { isMobile: true, lastSeen: { gte: startBRT, lte: endBRT } },
        }) ?? 0;
        devicesDesktop = await (db as any).devicePing?.count({
          where: { isMobile: false, lastSeen: { gte: startBRT, lte: endBRT } },
        }) ?? 0;
      } catch {}

      return {
        leadsCaptured,
        leadsConverted,
        conversionRate: leadsCaptured > 0 ? (leadsConverted / leadsCaptured) * 100 : 0,
        clicks,
        regions,
        cities,
        pousadasConverted,
        devicesMobile,
        devicesDesktop,
        totalActiveTenants,
      };
    } catch (err) {
      console.warn('[NIGHT_AUDIT] Falha ao coletar métricas:', err);
      return empty;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETAPA 3: LLM ANALYSIS (GLM 5.2)
  // ─────────────────────────────────────────────────────────────────────────

  private static async runLLMAnalysis(
    vulnFindings: VulnFinding[],
    metrics: DayMetrics,
    mode: 'mock' | 'live',
    extras?: {
      pentestFindings?: PentestFinding[];
      activityEvents?: ActivityEvent[];
      activityStats?: any;
    },
  ): Promise<{
    summary: string;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    confidence: number;
    analysis: LLMAnalysis;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  }> {
    if (mode === 'mock') {
      return this.mockAnalysis(vulnFindings, metrics, extras);
    }

    // Modo live: chama GLM 5.2
    const cerebro = new GlmCerebroService();
    const apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
    const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    const model = process.env.GLM_MODEL || 'glm-5.2';

    // Prepara input para o LLM
    const topVulns = vulnFindings
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .slice(0, 15);

    const systemPrompt = `Você é o Cérebro Zélla — assistente de segurança e operações SaaS para pousadas brasileiras.

Sua tarefa: gerar um RELATÓRIO NOTURNO (Night Audit) executivo para o operador do ZCC.

O relatório deve ser em PORTUGUÊS DO BRASIL, prático e acionável. O operador lerá isto ao acordar às 06:00 BRT.

Estrutura JSON obrigatória:
{
  "summary": "1-3 parágrafos PT-BR resumindo o que aconteceu na madrugada: vulnerabilidades encontradas, métricas do dia, ações recomendadas",
  "severity": "info | warning | critical | emergency",
  "confidence": 0.0-1.0 (quanto você confia nesta análise),
  "analysis": {
    "recommendations": ["ação 1", "ação 2", ...] (top 5 prioridades do dia),
    "risks": ["risco 1", "risco 2", ...] (riscos identificados),
    "opportunities": ["oportunidade 1", ...] (sugestões de evolução do produto)
  }
}

Regras:
- Se houver vulnerabilidade CRITICAL, severity deve ser "critical" ou "emergency"
- Se houver apenas HIGH, severity="warning"
- Se houver apenas MEDIUM/LOW/INFO, severity="info"
- Recomendações devem ser específicas (cite arquivo + linha quando relevante)
- Não invente dados que não estão no input`;

    const userPrompt = `=== NIGHT AUDIT — ${getBRTDateString()} ===

## VULNERABILIDADES DE CÓDIGO ENCONTRADAS
Total: ${vulnFindings.length}
- CRITICAL: ${vulnFindings.filter(v => v.severity === 'critical').length}
- HIGH: ${vulnFindings.filter(v => v.severity === 'high').length}
- MEDIUM: ${vulnFindings.filter(v => v.severity === 'medium').length}
- LOW: ${vulnFindings.filter(v => v.severity === 'low').length}
- INFO: ${vulnFindings.filter(v => v.severity === 'info').length}

Top 15 vulnerabilidades críticas/altas:
${JSON.stringify(topVulns, null, 2)}

## MÉTRICAS DO DIA (00:00-23:59 BRT)
- Leads captados: ${metrics.leadsCaptured}
- Leads convertidos: ${metrics.leadsConverted}
- Taxa de conversão: ${metrics.conversionRate.toFixed(2)}%
- Cliques no anúncio (mock): ${metrics.clicks}
- Dispositivos mobile ativos: ${metrics.devicesMobile}
- Dispositivos desktop ativos: ${metrics.devicesDesktop}
- Total Tenants ativos: ${metrics.totalActiveTenants}

Distribuição geográfica (top 10 UFs):
${JSON.stringify(metrics.regions, null, 2)}

Top 10 cidades:
${JSON.stringify(metrics.cities, null, 2)}

Pousadas convertidas hoje:
${JSON.stringify(metrics.pousadasConverted, null, 2)}

Gere o relatório JSON agora.`;

    const messages: AdapterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await callOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        messages,
        temperature: 0.3,
        maxTokens: 1500,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.content);
      const costUsd =
        (response.inputTokens * 0.00140 + response.outputTokens * 0.00440) / 1000;

      return {
        summary: parsed.summary || 'Relatório gerado sem resumo.',
        severity: parsed.severity || 'info',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        analysis: {
          recommendations: parsed.analysis?.recommendations ?? [],
          risks: parsed.analysis?.risks ?? [],
          opportunities: parsed.analysis?.opportunities ?? [],
          rawResponse: parsed,
        },
        tokensInput: response.inputTokens,
        tokensOutput: response.outputTokens,
        costUsd,
      };
    } catch (err) {
      console.warn('[NIGHT_AUDIT] GLM 5.2 falhou, usando mock:', err);
      return this.mockAnalysis(vulnFindings, metrics);
    }
  }

  private static mockAnalysis(
    vulnFindings: VulnFinding[],
    metrics: DayMetrics,
    extras?: {
      pentestFindings?: PentestFinding[];
      activityEvents?: ActivityEvent[];
      activityStats?: any;
    },
  ): {
    summary: string;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    confidence: number;
    analysis: LLMAnalysis;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  } {
    const critical = vulnFindings.filter(v => v.severity === 'critical').length;
    const high = vulnFindings.filter(v => v.severity === 'high').length;

    // Pentest findings consolidados (do Grande Run #1)
    const pentestTotal = extras?.pentestFindings?.length ?? 0;
    const pentestCritical = extras?.pentestFindings?.filter(f => f.severity === 'critical').length ?? 0;
    const pentestNewlyDetected = extras?.pentestFindings?.filter(f => f.detectionSource === 'pentest').length ?? 0;

    // Activity events (4 superfícies)
    const activityTotal = extras?.activityEvents?.length ?? 0;
    const activityCritical = extras?.activityEvents?.filter(e => e.severity === 'critical').length ?? 0;

    const severity: 'info' | 'warning' | 'critical' | 'emergency' =
      critical > 5 || pentestCritical > 5 ? 'emergency'
      : critical > 0 || pentestCritical > 0 || activityCritical > 0 ? 'critical'
      : high > 0 ? 'warning' : 'info';

    const summary = `🌙 NIGHT AUDIT — ${getBRTDateString()} (MODO MOCK)

📊 RESUMO EXECUTIVO

Vulnerabilidades de código (SAST): ${vulnFindings.length} (${critical} críticas, ${high} altas).
Pentest findings consolidados (Grande Run #1): ${pentestTotal} (${pentestCritical} críticas, ${pentestNewlyDetected} novas detectadas).
Atividade suspeita rastreada: ${activityTotal} eventos em 4 superfícies (${activityCritical} críticos).

📈 MÉTRICAS DO DIA (BRT 00:00-23:59)
- Leads captados: ${metrics.leadsCaptured}
- Leads convertidos: ${metrics.leadsConverted} (taxa ${metrics.conversionRate.toFixed(1)}%)
- Cliques no anúncio: ${metrics.clicks}
- Dispositivos ativos: ${metrics.devicesMobile} mobile + ${metrics.devicesDesktop} desktop

🔍 ATIVIDADE POR SUPERFÍCIE
- Landing Page: ${extras?.activityStats?.landing_page?.anomalies ?? 0} anomalias
- DDC: ${extras?.activityStats?.ddc?.anomalies ?? 0} anomalias
- Link-in-Bio: ${extras?.activityStats?.linkinbio?.anomalies ?? 0} anomalias
- Zélla Parceiros: ${extras?.activityStats?.zella_parceiros?.anomalies ?? 0} anomalias

Para análise completa via GLM 5.2, ative CEREBRO_LIVE_MODE=true + GLM_5_2_API_KEY.`;

    const recommendations: string[] = [];
    if (critical > 0) {
      recommendations.push(`Corrigir ${critical} vulnerabilidades CRITICAL imediatamente (SAST)`);
    }
    if (pentestCritical > 0) {
      recommendations.push(`Pentest: corrigir ${pentestCritical} rotas críticas sem proteção withApiGuard`);
    }
    if (high > 0) {
      recommendations.push(`Revisar ${high} vulnerabilidades HIGH nesta semana`);
    }
    if (activityCritical > 0) {
      recommendations.push(`Investigar ${activityCritical} eventos críticos de atividade suspeita`);
    }
    if (metrics.leadsCaptured > 0 && metrics.conversionRate < 5) {
      recommendations.push('Taxa de conversão baixa — revisar funil de vendas');
    }
    if (metrics.devicesMobile > metrics.devicesDesktop * 2) {
      recommendations.push('Maioria mobile — priorizar UX mobile no roadmap');
    }
    recommendations.push('Ativar CEREBRO_LIVE_MODE=true para análise GLM 5.2 real');

    const risks: string[] = [];
    if (critical > 0) risks.push(`${critical} vulnerabilidades críticas no código (SAST)`);
    if (pentestCritical > 0) risks.push(`${pentestCritical} rotas de API sem proteção (pentest)`);
    if (vulnFindings.some(v => v.type === 'hardcoded_secret')) {
      risks.push('Secrets hard-coded podem estar expostos no GitHub');
    }
    if (vulnFindings.some(v => v.type === 'eval_usage')) {
      risks.push('eval() permite RCE (Remote Code Execution)');
    }
    if (activityCritical > 0) risks.push(`${activityCritical} eventos críticos de atividade suspeita`);

    const opportunities: string[] = [];
    if (metrics.leadsCaptured > 100) {
      opportunities.push(`${metrics.leadsCaptured} leads — escala para campanha Google Ads`);
    }
    if (metrics.regions.length > 0) {
      opportunities.push(`Top região: ${metrics.regions[0].uf} (${metrics.regions[0].count} leads) — concentra esforços de vendas lá`);
    }
    if (pentestTotal === 0) {
      opportunities.push('Nenhuma vulnerabilidade nova no pentest — codebase estável');
    }

    return {
      summary,
      severity,
      confidence: 0.5, // mock sempre 0.5
      analysis: { recommendations, risks, opportunities },
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSISTÊNCIA
  // ─────────────────────────────────────────────────────────────────────────

  private static async createRunningReport(
    auditDate: string,
    startedAt: Date,
    mode: 'mock' | 'live',
  ): Promise<string> {
    try {
      const report = await (db as any).nightAuditReport?.create({
        data: {
          auditDate,
          startedAt,
          status: 'running',
          mode,
        },
      });
      return report?.id ?? '';
    } catch (err) {
      console.warn('[NIGHT_AUDIT] Falha ao criar report running:', err);
      return '';
    }
  }

  private static async updateReport(reportId: string, result: NightAuditResult) {
    if (!reportId) return;
    try {
      await (db as any).nightAuditReport?.update({
        where: { id: reportId },
        data: {
          status: result.status,
          completedAt: result.completedAt,
          durationMs: result.durationMs,
          summary: result.summary,
          severity: result.severity,
          confidence: result.confidence,
          vulnFindings: JSON.stringify(result.vulnFindings),
          vulnCountCritical: result.vulnCounts.critical,
          vulnCountHigh: result.vulnCounts.high,
          vulnCountMedium: result.vulnCounts.medium,
          vulnCountLow: result.vulnCounts.low,
          vulnCountInfo: result.vulnCounts.info,
          metricsJson: JSON.stringify({
            ...result.metrics,
            // NOVO: inclui pentest + activity no metricsJson (evita criar colunas extras)
            _pentestFindings: result.pentestFindings ?? [],
            _pentestStats: result.pentestStats,
            _activityEvents: result.activityEvents ?? [],
            _activityStats: result.activityStats,
          }),
          llmAnalysis: JSON.stringify(result.llmAnalysis),
          llmTokensInput: result.llmTokensInput,
          llmTokensOutput: result.llmTokensOutput,
          llmCostUsd: result.llmCostUsd,
          mode: result.mode,
        },
      });
    } catch (err) {
      console.warn('[NIGHT_AUDIT] Falha ao atualizar report:', err);
    }
  }

  private static async markAsFailed(
    reportId: string,
    completedAt: Date,
    startedAt: Date,
    errorMessage: string,
    mode: 'mock' | 'live',
  ) {
    if (!reportId) return;
    try {
      await (db as any).nightAuditReport?.update({
        where: { id: reportId },
        data: {
          status: 'failed',
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          summary: `❌ Night Audit falhou: ${errorMessage}`,
          severity: 'critical',
          mode,
          errorMessage,
        },
      });
    } catch {}
  }

  private static deserialize(record: any): NightAuditResult {
    return {
      auditDate: record.auditDate,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      durationMs: record.durationMs,
      status: record.status,
      summary: record.summary,
      severity: record.severity,
      confidence: record.confidence,
      vulnFindings: JSON.parse(record.vulnFindings || '[]'),
      vulnCounts: {
        critical: record.vulnCountCritical,
        high: record.vulnCountHigh,
        medium: record.vulnCountMedium,
        low: record.vulnCountLow,
        info: record.vulnCountInfo,
      },
      metrics: JSON.parse(record.metricsJson || '{}'),
      llmAnalysis: JSON.parse(record.llmAnalysis || '{}'),
      llmTokensInput: record.llmTokensInput,
      llmTokensOutput: record.llmTokensOutput,
      llmCostUsd: record.llmCostUsd,
      mode: record.mode,
      errorMessage: record.errorMessage ?? undefined,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — FUSO HORÁRIO BRT (America/Sao_Paulo = UTC-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna a data atual em BRT no formato YYYY-MM-DD.
 * BRT = UTC-3 (sem horário de verão desde 2019).
 */
function getBRTDateString(): string {
  const now = new Date();
  // Converte para BRT subtraindo 3 horas do UTC
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

/**
 * Retorna a janela de "ontem" em BRT (00:00-23:59 BRT do dia anterior).
 * Usado para coletar métricas do dia que acabou.
 */
function getYesterdayBRTWindow(): { startBRT: Date; endBRT: Date } {
  const now = new Date();
  // BRT agora = UTC - 3h
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Ontem BRT 00:00:00
  const brtYesterday = new Date(brtNow);
  brtYesterday.setDate(brtYesterday.getDate() - 1);
  brtYesterday.setHours(0, 0, 0, 0);

  // Converte de volta para UTC (adiciona 3h)
  const startBRT = new Date(brtYesterday.getTime() + 3 * 60 * 60 * 1000);
  // End = start + 24h
  const endBRT = new Date(startBRT.getTime() + 24 * 60 * 60 * 1000);

  return { startBRT, endBRT };
}

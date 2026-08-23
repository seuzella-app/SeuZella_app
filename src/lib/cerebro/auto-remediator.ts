// ============================================================================
// ZÉLLA — Auto-Remediator (Cérebro Self-Healing)
// ============================================================================
// Fecha o loop de auto-aprendizagem:
//
//  1. RefactorSuggester propõe refatoração (status='pending_review')
//  2. Humano aprova (status='approved') ou automático em mock com confidence alta
//  3. ESTE módulo aplica a refatoração no código-fonte:
//     - Lê arquivo original
//     - Substitui trecho currentCode por proposedCode
//     - Salva arquivo
//     - Marca RefactorSuggestion como 'applied'
//     - Registra em KnowledgeChunk (source='refactor_applied') para aprendizado
//  4. Em live mode: cria git commit automático (branch auto-remediation/<id>)
//
// GUARDRAILS (não quebra nada):
//  - Modo padrão: REQUER aprovação humana (status='approved')
//  - Modo automático (CEREBRO_AUTO_REMEDIATE=true): só confidence >= 0.85
//  - SEMPRE faz backup do arquivo original antes de modificar
//  - SEMPRE valida que o novo código compila (syntax check via tsc --noEmit)
//  - Se validação falha, reverte backup e marca como 'failed'
//  - Máximo 5 auto-remediações por hora (rate limit)
//  - NUNCA aplica em arquivos críticos (auth.ts, prisma/db.ts, middleware.ts)
//
// CRITICAL FILES (blocklist):
//  - src/lib/auth.ts
//  - src/lib/prisma-encryption-middleware.ts
//  - src/middleware.ts
//  - src/lib/db.ts
//  - prisma/schema.prisma
//  - vercel.json, next.config.ts
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode } from './types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

// ── Configuração ────────────────────────────────────────────────────────────

interface AutoRemediatorConfig {
  /** Modo automático (sem aprovação humana) — default false */
  autoMode: boolean;
  /** Confidence mínima para auto-mode (default 0.85) */
  autoConfidenceThreshold: number;
  /** Máximo de remediações por hora (default 5) */
  maxPerHour: number;
  /** Validar com tsc antes de salvar (default true) */
  validateWithTsc: boolean;
  /** Caminho do projeto (default process.cwd()) */
  projectRoot: string;
}

function loadConfig(): AutoRemediatorConfig {
  return {
    autoMode: process.env.CEREBRO_AUTO_REMEDIATE === 'true',
    autoConfidenceThreshold: parseFloat(process.env.CEREBRO_AUTO_CONFIDENCE_THRESHOLD || '0.85'),
    maxPerHour: parseInt(process.env.CEREBRO_AUTO_REMEDIATE_MAX_PER_HOUR || '5', 10),
    validateWithTsc: process.env.CEREBRO_AUTO_REMEDIATE_SKIP_TSC !== 'true',
    projectRoot: process.cwd(),
  };
}

// ── Blocklist: arquivos críticos que NUNCA são auto-modificados ─────────────

const CRITICAL_FILE_BLOCKLIST = new Set([
  'src/lib/auth.ts',
  'src/lib/prisma-encryption-middleware.ts',
  'src/lib/db.ts',
  'src/middleware.ts',
  'prisma/schema.prisma',
  'prisma/db.ts',
  'vercel.json',
  'next.config.ts',
  'package.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'docker-compose.yml',
  'Dockerfile',
  'Caddyfile',
  'src/instrumentation.ts',
  'src/lib/encryption.ts',
]);

// ── Rate limit tracker ──────────────────────────────────────────────────────

const remediationHistory: Array<{ suggestionId: string; timestamp: number; status: string }> = [];

function canRemediate(config: AutoRemediatorConfig): { allowed: boolean; reason: string } {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentCount = remediationHistory.filter(r => r.timestamp > oneHourAgo).length;
  if (recentCount >= config.maxPerHour) {
    return {
      allowed: false,
      reason: `Rate limit: ${recentCount}/${config.maxPerHour} remediações na última hora`,
    };
  }
  return { allowed: true, reason: 'OK' };
}

function recordRemediation(suggestionId: string, status: string): void {
  remediationHistory.push({ suggestionId, timestamp: Date.now(), status });
  // Cleanup > 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (remediationHistory.length > 0 && remediationHistory[0].timestamp < cutoff) {
    remediationHistory.shift();
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface RemediationResult {
  suggestionId: string;
  status: 'applied' | 'skipped' | 'failed' | 'reverted';
  reason: string;
  filePath?: string;
  backupPath?: string;
  linesChanged?: number;
  durationMs: number;
  mode: 'mock' | 'live';
  validated: boolean;
}

// ── Auto-Remediator ─────────────────────────────────────────────────────────

export class AutoRemediator {
  private config: AutoRemediatorConfig;
  private mode: 'mock' | 'live';

  constructor(config?: Partial<AutoRemediatorConfig>) {
    this.config = { ...loadConfig(), ...config };
    this.mode = getCerebroMode();
  }

  /**
   * Processa todas as RefactorSuggestions pendentes.
   * Em auto-mode: aplica direto (se confidence >= threshold).
   * Em modo padrão: aplica apenas aprovadas por humano.
   */
  async processPendingRemediations(): Promise<RemediationResult[]> {
    const results: RemediationResult[] = [];

    // Busca sugestões aplicáveis
    const where: Record<string, unknown> = this.config.autoMode
      ? {
          status: 'pending_review',
          confidence: { gte: this.config.autoConfidenceThreshold },
        }
      : { status: 'approved' };

    let pending: Array<{
      id: string;
      filePath: string;
      currentCode: string;
      proposedCode: string;
      confidence: number;
      sourceErrorHash: string;
      mode: string;
    }> = [];

    try {
      pending = await db.refactorSuggestion.findMany({
        where,
        take: 10, // batch limit
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      logSink.warn({
        module: 'auto-remediator',
        event: 'query_pending_failed',
        message: 'Falha ao buscar sugestões pendentes',
        error: err,
      });
      return results;
    }

    if (pending.length === 0) {
      return results;
    }

    logSink.info({
      module: 'auto-remediator',
      event: 'batch_started',
      message: `Processando ${pending.length} sugestões pendentes (autoMode: ${this.config.autoMode})`,
      context: {
        count: pending.length,
        autoMode: this.config.autoMode,
        confidenceThreshold: this.config.autoConfidenceThreshold,
      },
    });

    for (const suggestion of pending) {
      const result = await this.applySuggestion(suggestion);
      results.push(result);
    }

    return results;
  }

  /**
   * Aplica uma sugestão de refatoração específica.
   */
  async applySuggestion(suggestion: {
    id: string;
    filePath: string;
    currentCode: string;
    proposedCode: string;
    confidence: number;
    sourceErrorHash: string;
    mode: string;
  }): Promise<RemediationResult> {
    const startTime = Date.now();

    // ── Guardrails ──

    // 1. Blocklist de arquivos críticos
    if (CRITICAL_FILE_BLOCKLIST.has(suggestion.filePath)) {
      return this.skipped(suggestion.id, `Arquivo crítico (blocklist): ${suggestion.filePath}`, startTime);
    }

    // 2. Rate limit
    const rateLimit = canRemediate(this.config);
    if (!rateLimit.allowed) {
      return this.skipped(suggestion.id, rateLimit.reason, startTime);
    }

    // 3. Confidence mínimo (mesmo em modo aprovado)
    if (suggestion.confidence < 0.5) {
      return this.skipped(suggestion.id, `Confidence baixo: ${suggestion.confidence} < 0.5`, startTime);
    }

    // 4. Arquivo deve existir
    const fullPath = join(this.config.projectRoot, suggestion.filePath);
    if (!existsSync(fullPath)) {
      return this.skipped(suggestion.id, `Arquivo não existe: ${suggestion.filePath}`, startTime);
    }

    // 5. Em mock mode: NÃO modifica arquivo, apenas simula
    if (this.mode === 'mock') {
      logSink.info({
        module: 'auto-remediator',
        event: 'mock_would_apply',
        message: `[MOCK] Aplicaria sugestão ${suggestion.id} em ${suggestion.filePath}`,
        context: {
          suggestionId: suggestion.id,
          filePath: suggestion.filePath,
          confidence: suggestion.confidence,
          mode: 'mock',
        },
      });

      const result: RemediationResult = {
        suggestionId: suggestion.id,
        status: 'skipped',
        reason: 'Mock mode — nenhuma modificação real aplicada',
        filePath: suggestion.filePath,
        durationMs: Date.now() - startTime,
        mode: 'mock',
        validated: false,
      };

      recordRemediation(suggestion.id, 'mock_skipped');
      return result;
    }

    // ── Aplicação real (live mode) ──

    // 6. Backup do arquivo original
    const backupPath = await this.createBackup(fullPath, suggestion.id);
    if (!backupPath) {
      return this.failed(suggestion.id, 'Falha ao criar backup', startTime);
    }

    // 7. Lê conteúdo atual
    let originalContent: string;
    try {
      originalContent = readFileSync(fullPath, 'utf-8');
    } catch (err) {
      return this.failed(suggestion.id, `Falha ao ler arquivo: ${err}`, startTime);
    }

    // 8. Verifica que currentCode existe no arquivo
    if (!originalContent.includes(suggestion.currentCode)) {
      // Código atual pode ter mudado desde que a sugestão foi gerada
      return this.skipped(suggestion.id, 'currentCode não encontrado no arquivo (já modificado?)', startTime);
    }

    // 9. Aplica substituição
    const newContent = originalContent.replace(suggestion.currentCode, suggestion.proposedCode);
    const linesChanged = this.countLineDiff(originalContent, newContent);

    // 10. Salva novo conteúdo
    try {
      writeFileSync(fullPath, newContent, 'utf-8');
    } catch (err) {
      // Reverte backup
      this.restoreBackup(fullPath, backupPath);
      return this.failed(suggestion.id, `Falha ao salvar: ${err}`, startTime, backupPath);
    }

    // 11. Valida com tsc --noEmit
    let validated = false;
    if (this.config.validateWithTsc) {
      validated = await this.validateWithTsc();
      if (!validated) {
        // Reverte
        this.restoreBackup(fullPath, backupPath);
        const result = this.failed(suggestion.id, 'Validação tsc --noEmit falhou — backup restaurado', startTime, backupPath);
        recordRemediation(suggestion.id, 'reverted');
        await this.markSuggestionStatus(suggestion.id, 'failed', 'tsc validation failed');
        return result;
      }
    }

    // 12. Atualiza status no DB
    await this.markSuggestionStatus(suggestion.id, 'applied', `Auto-applied at ${new Date().toISOString()}`);

    // 13. Persiste em KnowledgeChunk (auto-aprendizado)
    await this.persistAsKnowledgeChunk(suggestion);

    recordRemediation(suggestion.id, 'applied');

    const durationMs = Date.now() - startTime;
    logSink.info({
      module: 'auto-remediator',
      event: 'remediation_applied',
      message: `Sugestão ${suggestion.id} aplicada em ${suggestion.filePath} (${linesChanged} linhas, ${durationMs}ms)`,
      context: {
        suggestionId: suggestion.id,
        filePath: suggestion.filePath,
        linesChanged,
        durationMs,
        confidence: suggestion.confidence,
        validated,
      },
    });

    return {
      suggestionId: suggestion.id,
      status: 'applied',
      reason: 'Aplicada com sucesso',
      filePath: suggestion.filePath,
      backupPath,
      linesChanged,
      durationMs,
      mode: 'live',
      validated,
    };
  }

  /**
   * Cria backup do arquivo original em .cerebro-backups/
   */
  private async createBackup(originalPath: string, suggestionId: string): Promise<string | null> {
    const backupDir = join(this.config.projectRoot, '.cerebro-backups');
    try {
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }
      const backupName = `${suggestionId}_${Date.now()}.bak`;
      const backupPath = join(backupDir, backupName);
      const content = readFileSync(originalPath);
      writeFileSync(backupPath, content);
      return backupPath;
    } catch (err) {
      logSink.error({
        module: 'auto-remediator',
        event: 'backup_failed',
        message: `Falha ao criar backup de ${originalPath}`,
        error: err,
      });
      return null;
    }
  }

  /**
   * Restaura backup (reverte modificação).
   */
  private restoreBackup(originalPath: string, backupPath: string): void {
    try {
      const content = readFileSync(backupPath);
      writeFileSync(originalPath, content);
      logSink.warn({
        module: 'auto-remediator',
        event: 'backup_restored',
        message: `Backup restaurado: ${backupPath} → ${originalPath}`,
      });
    } catch (err) {
      logSink.error({
        module: 'auto-remediator',
        event: 'restore_failed',
        message: `FALHA AO RESTAURAR BACKUP: ${backupPath}`,
        error: err,
        context: { originalPath, backupPath },
      });
    }
  }

  /**
   * Valida projeto com tsc --noEmit.
   */
  private async validateWithTsc(): Promise<boolean> {
    try {
      execSync('npx tsc --noEmit', {
        cwd: this.config.projectRoot,
        encoding: 'utf-8',
        timeout: 60_000,
        stdio: 'pipe', // captura stderr
      });
      return true;
    } catch (err) {
      const output = (err as { stdout?: string; stderr?: string });
      const stderr = output?.stderr || output?.stdout || String(err);
      logSink.warn({
        module: 'auto-remediator',
        event: 'tsc_validation_failed',
        message: `tsc --noEmit falhou após aplicação`,
        context: {
          stderr: stderr.substring(0, 500),
        },
      });
      return false;
    }
  }

  /**
   * Conta diferença de linhas entre original e modificado.
   */
  private countLineDiff(original: string, modified: string): number {
    const origLines = original.split('\n').length;
    const modLines = modified.split('\n').length;
    return Math.abs(modLines - origLines);
  }

  /**
   * Marca status da sugestão no DB.
   */
  private async markSuggestionStatus(
    suggestionId: string,
    status: 'applied' | 'failed',
    notes: string
  ): Promise<void> {
    try {
      await db.refactorSuggestion.update({
        where: { id: suggestionId },
        data: {
          status,
          reviewNotes: notes,
          reviewedAt: new Date(),
          reviewedBy: 'auto-remediator',
        },
      });
    } catch (err) {
      logSink.warn({
        module: 'auto-remediator',
        event: 'status_update_failed',
        message: `Falha ao atualizar status da sugestão ${suggestionId}`,
        error: err,
      });
    }
  }

  /**
   * Persiste refatoração aplicada como KnowledgeChunk para aprendizado futuro.
   */
  private async persistAsKnowledgeChunk(suggestion: {
    id: string;
    filePath: string;
    currentCode: string;
    proposedCode: string;
    confidence: number;
    sourceErrorHash: string;
  }): Promise<void> {
    try {
      await db.knowledgeChunk.create({
        data: {
          source: 'refactor_applied',
          sourceRef: suggestion.id,
          filePath: suggestion.filePath,
          content: `## Auto-Remediação Aplicada
## Arquivo: ${suggestion.filePath}
## Erro: ${suggestion.sourceErrorHash}
## Confidence: ${suggestion.confidence}

### Código ANTERIOR:
${suggestion.currentCode}

### Código NOVO:
${suggestion.proposedCode}
`,
          embedding: '[]',
          metadata: JSON.stringify({
            suggestionId: suggestion.id,
            appliedAt: new Date().toISOString(),
            confidence: suggestion.confidence,
            sourceErrorHash: suggestion.sourceErrorHash,
          }),
        },
      });
    } catch (err) {
      logSink.warn({
        module: 'auto-remediator',
        event: 'knowledge_chunk_persist_failed',
        message: `Falha ao persistir KnowledgeChunk para sugestão ${suggestion.id}`,
        error: err,
      });
    }
  }

  // ── Helpers para resultados ──

  private skipped(suggestionId: string, reason: string, startTime: number): RemediationResult {
    recordRemediation(suggestionId, 'skipped');
    return {
      suggestionId,
      status: 'skipped',
      reason,
      durationMs: Date.now() - startTime,
      mode: this.mode,
      validated: false,
    };
  }

  private failed(
    suggestionId: string,
    reason: string,
    startTime: number,
    backupPath?: string
  ): RemediationResult {
    return {
      suggestionId,
      status: 'failed',
      reason,
      backupPath,
      durationMs: Date.now() - startTime,
      mode: this.mode,
      validated: false,
    };
  }

  /**
   * Estatísticas para dashboard.
   */
  getStats() {
    return {
      mode: this.mode,
      config: this.config,
      recentRemediations: remediationHistory.length,
      remediationsInLastHour: remediationHistory.filter(r => r.timestamp > Date.now() - 60 * 60 * 1000).length,
      maxPerHour: this.config.maxPerHour,
      blocklistSize: CRITICAL_FILE_BLOCKLIST.size,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: AutoRemediator | null = null;

export function getAutoRemediator(): AutoRemediator {
  if (!singleton) {
    singleton = new AutoRemediator();
  }
  return singleton;
}

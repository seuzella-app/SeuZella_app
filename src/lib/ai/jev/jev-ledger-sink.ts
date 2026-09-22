// ============================================================================
// JEV — Sinks locais de exportação do ledger (RUN24-A) — jev-ledger-sink.ts
// ============================================================================
// Sink = destino APEND-ONLY das linhas JSONL já higienizadas pelo ledger.
// Nesta onda existem DOIS sinks:
//  - MemorySink: guarda linhas em memória (testes / inspeção local);
//  - FileSink: append em arquivo JSONL — OPT-IN EXPLÍCITO (exige caminho
//    ABSOLUTO passado pelo chamador; nada no app chama isto ainda; a fiação
//    no Cérebro decidirá o destino definitivo em onda futura).
// Fail-closed: sink NUNCA lança — resultado tipado com reason. Sem rede,
// sem env, sem truncar arquivo existente (flag 'a' — append-only).
// ============================================================================

import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import * as path from 'node:path';

import type { JevLedger, JevLedgerFilter } from './jev-ledger';

export interface JevSinkResult {
  ok: boolean;
  written: number;
  reason?: string;
}

export interface JevLedgerSink {
  readonly name: string;
  appendJsonl(lines: readonly string[]): Promise<JevSinkResult>;
}

/** Defesa em profundidade: linha JSONL maior que isso indica vazamento de
 * conteúdo bruto — o sink recusa o lote inteiro (atômico). */
export const JEV_SINK_MAX_LINE = 4096;

/** Sink de memória. Recusa o LOTE inteiro se exceder a capacidade (atômico). */
export class MemorySink implements JevLedgerSink {
  readonly name = 'memory';
  private readonly lines: string[] = [];
  private readonly capacity: number;

  constructor(capacity: number = 5000) {
    this.capacity =
      typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0
        ? Math.floor(capacity)
        : 5000;
  }

  async appendJsonl(lines: readonly string[]): Promise<JevSinkResult> {
    if (this.lines.length + lines.length > this.capacity) {
      return { ok: false, written: 0, reason: 'capacidade-memoria-atingida' };
    }
    for (const line of lines) this.lines.push(line);
    return { ok: true, written: lines.length };
  }

  snapshot(): readonly string[] {
    return this.lines.slice();
  }
}

/** Sink de arquivo JSONL append-only. dirPath null = DESATIVADO (fail-closed:
 * devolve reason, não escreve nada, não lança). */
export class FileSink implements JevLedgerSink {
  readonly name: string;
  private readonly dirPath: string | null;
  private readonly fileName: string;

  constructor(dirPath: string | null, fileName: string = 'jev-ledger.jsonl') {
    this.dirPath = dirPath;
    this.fileName = fileName;
    this.name = dirPath === null ? 'file-disabled' : `file:${fileName}`;
  }

  async appendJsonl(lines: readonly string[]): Promise<JevSinkResult> {
    if (this.dirPath === null) {
      return { ok: false, written: 0, reason: 'file-sink-desativado (sem caminho configurado)' };
    }
    try {
      if (!path.isAbsolute(this.dirPath)) {
        return { ok: false, written: 0, reason: 'caminho-nao-absoluto' };
      }
      for (const line of lines) {
        if (line.length > JEV_SINK_MAX_LINE) {
          return { ok: false, written: 0, reason: 'linha-acima-do-limite' };
        }
        if (line.includes('\n')) {
          return { ok: false, written: 0, reason: 'quebra-de-linha-inesperada' };
        }
      }
      let dirExists = true;
      try {
        dirExists = statSync(this.dirPath).isDirectory();
      } catch {
        dirExists = false;
      }
      if (!dirExists) mkdirSync(this.dirPath, { recursive: true });
      const target = path.join(this.dirPath, this.fileName);
      // APEND-ONLY: flag 'a' — NUNCA trunca/reescreve arquivo existente.
      appendFileSync(target, lines.map((l) => `${l}\n`).join(''), {
        encoding: 'utf8',
        flag: 'a',
      });
      return { ok: true, written: lines.length };
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : 'erro-desconhecido';
      return { ok: false, written: 0, reason: `fs-${code}` };
    }
  }
}

/** Exporta o ledger (respeitando filtro) e entrega ao sink. Lote vazio é
 * ok com written 0 (nada a fazer — não é erro). */
export async function flushLedgerToSink(
  ledger: JevLedger,
  sink: JevLedgerSink,
  filter?: JevLedgerFilter,
): Promise<JevSinkResult> {
  const lines = ledger.exportJsonlLines(filter);
  if (lines.length === 0) return { ok: true, written: 0 };
  return sink.appendJsonl(lines);
}

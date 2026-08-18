/**
 * ZéCode API — /api/zcc/zecode
 * ============================================================================
 * Endpoints:
 *   GET  /api/zcc/zecode            → status, limites de segurança, file tree
 *   GET  /api/zcc/zecode?path=...   → lista arquivos do path (read-only)
 *   POST /api/zcc/zecode            → executa scan com LLM
 *
 * TRAVAS:
 *   - Nunca escreve no filesystem
 *   - Path validation (whitelist + blacklist)
 *   - Limite de arquivos por scan (20)
 *   - Limite de tamanho por arquivo (256 KB)
 *   - Rate limit implícito por chamada LLM
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { runScan } from '@/lib/zecode/scanner';
import { listFiles, readFileSafe, validatePath, SAFETY_LIMITS } from '@/lib/zecode/safety';
import type { ZeCodeScanRequest } from '@/lib/zcc/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET — Status + file listing
// ─────────────────────────────────────────────────────────────────────────────

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetPath = searchParams.get('path');
    const fileRead = searchParams.get('file');

    // Modo: ler arquivo específico
    if (fileRead) {
      const result = await readFileSafe(fileRead);
      return NextResponse.json({
        ok: true,
        path: fileRead,
        size: result.size,
        content: result.content,
      });
    }

    // Modo: listar arquivos de um path
    if (targetPath) {
      const validation = validatePath(targetPath);
      if (!validation.passed) {
        return NextResponse.json(
          { ok: false, error: validation.reason },
          { status: 403 },
        );
      }
      const nodes = await listFiles(targetPath, { maxDepth: 3, maxFiles: 50 });
      return NextResponse.json({ ok: true, path: targetPath, nodes });
    }

    // Modo: status do ZéCode
    return NextResponse.json({
      ok: true,
      service: 'ZéCode · DEV FULL STACK Interno',
      version: '1.0.0',
      parallel: {
        cerebro: 'Cérebro Zélla — runtime decisions (produção)',
        zecode: 'ZéCode — código-fonte evolution (refactor/gargalos/gaps)',
      },
      safety: {
        readOnly: true,
        writes: false,
        approvalRequired: true,
        limits: SAFETY_LIMITS,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Executa scan
// ─────────────────────────────────────────────────────────────────────────────

async function postHandler(request: NextRequest) {
  try {
    const body = (await request.json()) as ZeCodeScanRequest;

    if (!body.mode) {
      return NextResponse.json(
        { ok: false, error: 'Campo "mode" é obrigatório (quick|deep|targeted|diff)' },
        { status: 400 },
      );
    }

    const validModes = ['quick', 'deep', 'targeted', 'diff'];
    if (!validModes.includes(body.mode)) {
      return NextResponse.json(
        { ok: false, error: `Mode inválido. Use: ${validModes.join('|')}` },
        { status: 400 },
      );
    }

    if (body.mode === 'targeted' && !body.targetPath) {
      return NextResponse.json(
        { ok: false, error: 'Mode "targeted" requer "targetPath"' },
        { status: 400 },
      );
    }

    const result = await runScan(body);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ZéCode_API_ERROR]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export { getHandler as GET, postHandler as POST };

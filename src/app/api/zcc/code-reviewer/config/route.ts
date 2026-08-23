// ============================================================================
// ZÉLLA — ZCC Endpoint: Code Reviewer — Config (path_instructions extras)
// ============================================================================
// GET  /api/zcc/code-reviewer/config  — lista todas config keys
// PUT  /api/zcc/code-reviewer/config  — atualiza uma config
//   body: { key, value }
//   keys permitidas:
//     - "path_instructions"      → PathInstruction[] (mirror + DB overrides)
//     - "exclude_patterns"       → string[]
//     - "review_profile"         → "assertive" | "gentle"
//     - "global_profile"         → string (instruções globais)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { logSink } from '@/lib/cerebro/log-sink';
import { clearInstructionsCache } from '@/lib/cerebro/code-reviewer/path-instructions-loader';

const ALLOWED_KEYS = new Set([
  'path_instructions',
  'exclude_patterns',
  'review_profile',
  'global_profile',
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const configs = await db.codeReviewConfig.findMany();
    return NextResponse.json({
      ok: true,
      data: configs.map((c: any) => ({
        key: c.key,
        value: JSON.parse(c.value),
        updatedBy: c.updatedBy,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json() as { key: string; value: unknown };
    if (!body.key || !ALLOWED_KEYS.has(body.key)) {
      return NextResponse.json(
        { ok: false, error: `key inválida (permitidas: ${Array.from(ALLOWED_KEYS).join(', ')})` },
        { status: 400 },
      );
    }

    // Validação específica por key
    if (body.key === 'review_profile' && !['assertive', 'gentle'].includes(body.value as string)) {
      return NextResponse.json(
        { ok: false, error: 'review_profile deve ser "assertive" ou "gentle"' },
        { status: 400 },
      );
    }
    if (body.key === 'exclude_patterns' && !Array.isArray(body.value)) {
      return NextResponse.json(
        { ok: false, error: 'exclude_patterns deve ser array' },
        { status: 400 },
      );
    }
    if (body.key === 'path_instructions' && !Array.isArray(body.value)) {
      return NextResponse.json(
        { ok: false, error: 'path_instructions deve ser array' },
        { status: 400 },
      );
    }
    if (body.key === 'global_profile' && typeof body.value !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'global_profile deve ser string' },
        { status: 400 },
      );
    }

    const token = await getToken({ req: request });
    const updatedBy = (token?.email as string) ?? 'unknown';

    const valueStr = JSON.stringify(body.value);

    // Upsert (cada key é única)
    const existing = await db.codeReviewConfig.findUnique({ where: { key: body.key } });
    let record;
    if (existing) {
      record = await db.codeReviewConfig.update({
        where: { key: body.key },
        data: { value: valueStr, updatedBy },
      });
    } else {
      record = await db.codeReviewConfig.create({
        data: { key: body.key, value: valueStr, updatedBy },
      });
    }

    // Limpa cache de path_instructions
    clearInstructionsCache();

    logSink.info({
      module: 'code-reviewer',
      event: 'config_updated',
      message: `Config "${body.key}" atualizada por ${updatedBy}`,
      context: { key: body.key, updatedBy },
    });

    return NextResponse.json({
      ok: true,
      data: { key: record.key, updatedAt: record.updatedAt, updatedBy: record.updatedBy },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

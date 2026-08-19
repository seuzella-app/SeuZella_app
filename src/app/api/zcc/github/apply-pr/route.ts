/**
 * API: Aplicar RefactorSuggestion via PR (Fase 3)
 *
 * POST /api/zcc/github/apply-pr
 *   { suggestionId, credentialId, dryRun?, createIssue? }
 *
 * GODMODE required para live mode (não-dryRun).
 */

import { NextRequest, NextResponse } from 'next/server';
import { applySuggestionViaPR } from '@/lib/cerebro/ze-code/apply-via-pr';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function POST(req: NextRequest) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.suggestionId || !body.credentialId) {
      return NextResponse.json(
        { error: 'suggestionId e credentialId são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await applySuggestionViaPR({
      suggestionId: body.suggestionId,
      credentialId: body.credentialId,
      dryRun: body.dryRun || false,
      createIssue: body.createIssue || false,
      actorUserId: 'admin',
      godMode: body.godMode || false,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[apply-pr] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

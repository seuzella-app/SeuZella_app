// ============================================================================
// ZÉLLA — /api/zcc/ze-code/apply
// ============================================================================
// POST: Marca uma sugestão como "applied" no DB (com safety locks).
//       Com autoCreatePR=true, cria um PR no GitHub automaticamente.
//
// Body:
//   { category: 'review' | 'refactor' | 'gap' | 'bottleneck',
//     suggestionId: string,
//     notes?: string,
//     autoCreatePR?: boolean,        // default: false
//     newCode?: string,              // para autoCreatePR=true
//     startLine?: number | null,     // para autoCreatePR=true
//     endLine?: number | null,       // para autoCreatePR=true
//     filePath?: string,             // para autoCreatePR=true (default: lê do finding)
//     prTitle?: string,              // opcional
//   }
//
// Safety locks:
//   - ZCC security guard (apenas admin)
//   - appliedBy extraído do JWT (NUNCA do body)
//   - Auto-apply SEMPRE false (humano aprova merge do PR)
//   - autoCreatePR exige GODMODE + GLM_5_2_API_KEY
//   - Em modo mock: apenas simula PR (não toca no git real)
//   - Em modo live: cria branch + commit + PR draft no GitHub
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { applySuggestion } from '@/lib/cerebro/ze-code/orchestrator';
import { applySuggestionViaGit, type GitApplyRequest } from '@/lib/cerebro/ze-code/git-applier';
import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import type { ApplySuggestionRequest, SuggestionCategory } from '@/lib/cerebro/ze-code/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = (await request.json()) as {
      category?: SuggestionCategory;
      suggestionId?: string;
      notes?: string;
      autoCreatePR?: boolean;
      newCode?: string;
      startLine?: number | null;
      endLine?: number | null;
      filePath?: string;
      prTitle?: string;
    };

    // Validação obrigatória
    if (!body.category || !body.suggestionId) {
      return NextResponse.json(
        { success: false, error: 'category e suggestionId são obrigatórios' },
        { status: 400 },
      );
    }

    const validCategories: SuggestionCategory[] = ['review', 'refactor', 'gap', 'bottleneck'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: `category inválido: ${body.category}` },
        { status: 400 },
      );
    }

    const token = await getToken({ req: request });
    const appliedBy = (token?.email as string | undefined) || 'unknown-admin';

    // ── Fluxo padrão: marcar como applied no DB ──
    if (!body.autoCreatePR) {
      const req: ApplySuggestionRequest = {
        category: body.category,
        suggestionId: body.suggestionId,
        appliedBy,
        notes: body.notes,
      };

      const result = await applySuggestion(req);

      logSink.info({
        module: 'ze-code',
        event: 'apply-request',
        message: `Apply ${result.status}: ${req.category}#${req.suggestionId} by ${req.appliedBy}`,
        context: {
          ip: security.ip,
          category: req.category,
          suggestionId: req.suggestionId,
          appliedBy: req.appliedBy,
          status: result.status,
          mode: result.mode,
          safetyLocksTriggered: result.safetyLocksTriggered,
        },
      });

      return NextResponse.json({
        success: result.ok,
        data: result,
      });
    }

    // ── Fluxo autoCreatePR: cria branch + commit + PR no GitHub ──
    if (!body.newCode) {
      return NextResponse.json(
        { success: false, error: 'newCode é obrigatório quando autoCreatePR=true' },
        { status: 400 },
      );
    }

    // Busca o finding no DB para obter filePath + rationale
    let {filePath} = body;
    let rationale = '';
    let severity = 'info';
    let findingTitle = '';

    if (!filePath) {
      try {
        if (body.category === 'gap' && db.gapFinding) {
          const f = await db.gapFinding.findUnique({ where: { id: body.suggestionId } });
          if (!f) {
            return NextResponse.json(
              { success: false, error: 'Finding não encontrado no DB' },
              { status: 404 },
            );
          }
          filePath = f.filePath;
          rationale = f.rationale || f.description;
          severity = f.severity;
          findingTitle = f.title;
        } else if (body.category === 'bottleneck' && db.bottleneckFinding) {
          const f = await db.bottleneckFinding.findUnique({ where: { id: body.suggestionId } });
          if (!f) {
            return NextResponse.json(
              { success: false, error: 'Finding não encontrado no DB' },
              { status: 404 },
            );
          }
          filePath = f.filePath;
          rationale = f.rationale || f.description;
          severity = f.severity;
          findingTitle = f.title;
        } else if (body.category === 'refactor' && db.refactorSuggestion) {
          const f = await db.refactorSuggestion.findUnique({ where: { id: body.suggestionId } });
          if (!f) {
            return NextResponse.json(
              { success: false, error: 'Finding não encontrado no DB' },
              { status: 404 },
            );
          }
          filePath = f.filePath;
          rationale = f.rationale;
          severity = 'warning';
          findingTitle = `Refactor: ${f.filePath}`;
        } else {
          return NextResponse.json(
            { success: false, error: 'autoCreatePR não suportado para category=review ainda' },
            { status: 400 },
          );
        }
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'DB error ao buscar finding', details: (e as Error).message },
          { status: 500 },
        );
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'filePath não pôde ser determinado' },
        { status: 400 },
      );
    }

    const prTitle = body.prTitle || `[ZéCode] ${body.category}: ${findingTitle || filePath}`;

    const prBody = `## 🤖 ZéCode Auto-PR

**Categoria:** \`${body.category}\`
**Finding ID:** \`${body.suggestionId}\`
**Arquivo:** \`${filePath}\`
**Severidade:** \`${severity}\`
**Aplicado por:** \`${appliedBy}\`

### Rationale
${rationale}

### Patch aplicado
\`\`\`diff
--- a/${filePath}
+++ b/${filePath}
@@ linha ${body.startLine || 'N/A'}-${body.endLine || 'N/A'} @@
${body.newCode.split('\n').map((l) => `+${l}`).join('\n')}
\`\`\`

### Safety
- [x] Path validado contra allowlist
- [x] Secrets verificados (sem padrões críticos)
- [x] Branch criada a partir da default
- [x] PR aberto como **DRAFT** (humano aprova merge)
- [x] GODMODE confirmado

> Este PR foi gerado automaticamente pelo ZéCode (DEV FULL STACK interno).
> Revise o diff com atenção antes de marcar como ready for review.

Generated-by: ZéCode`;

    const gitReq: GitApplyRequest = {
      category: body.category,
      findingId: body.suggestionId,
      filePath,
      startLine: body.startLine ?? null,
      endLine: body.endLine ?? null,
      newCode: body.newCode,
      commitMessage: `${body.category}: ${findingTitle || filePath} (${severity})`,
      appliedBy,
      prTitle,
      prBody,
    };

    const gitResult = await applySuggestionViaGit(gitReq);

    logSink.info({
      module: 'ze-code',
      event: 'auto-pr-request',
      message: `Auto-PR ${gitResult.ok ? 'created' : 'failed'}: ${gitResult.prUrl || gitResult.error}`,
      context: {
        ip: security.ip,
        category: body.category,
        suggestionId: body.suggestionId,
        appliedBy,
        ok: gitResult.ok,
        prUrl: gitResult.prUrl,
        prNumber: gitResult.prNumber,
        branch: gitResult.branch,
        mode: gitResult.mode,
        safetyLocksTriggered: gitResult.safetyLocksTriggered,
      },
    });

    return NextResponse.json({
      success: gitResult.ok,
      data: gitResult,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}

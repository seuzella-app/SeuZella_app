import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { captureDpoPair } from '@/lib/ml/dpo-collector';
import { SemanticaClient } from '@/lib/semantica/client';
import { logSink } from '@/lib/cerebro/log-sink';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/ddc/dpo-capture
 *
 * Quando o dono da pousada EDITA uma resposta da IA no DDC:
 *   1. Salva DpoPreferencePair (chosen = editado, rejected = original)
 *   2. Sincroniza no grafo Semantica (cria nó + aresta SUPERSEDES)
 *   3. Registra no LogSink para telemetria
 *
 * Body: { tenantId, prompt, rejected, chosen, conversationId? }
 */
export async function POST(request: NextRequest) {
  try {
    // RUN 6 — tenant authority (P1): ANTES o POST era anônimo e o tenantId
    // vinha do body — qualquer chamador envenenava os pares DPO e o grafo
    // Semantica de qualquer tenant. AGORA: sessão obrigatória e o tenant da
    // sessão é a autoridade; o tenantId do cliente é aceito apenas se
    // coincidir (consistency check, mesmo padrão RUN 4B/lgpd).
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Sessão não encontrada.' },
        { status: 401 }
      );
    }
    const sessionTenantId = (session.user as { tenantId?: string }).tenantId;
    if (!sessionTenantId) {
      return NextResponse.json(
        { success: false, error: 'TENANT_CONTEXT_MISSING' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tenantId, prompt, rejected, chosen, conversationId } = body;

    if (!tenantId || !prompt || !rejected || !chosen) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'tenantId, prompt, rejected, chosen são obrigatórios' },
        { status: 400 }
      );
    }
    if (tenantId !== sessionTenantId) {
      return NextResponse.json(
        { success: false, error: 'TENANT_MISMATCH', message: 'Acesso negado: tenant informado não corresponde à sessão autenticada.' },
        { status: 403 }
      );
    }

    // 1. Captura DPO pair (filtra similaridade 0.15-0.85) — tenantId já
    // comprovado igual ao da sessão (TENANT_MISMATCH 403 acima).
    const dpoResult = await captureDpoPair({ tenantId, prompt, rejected, chosen });

    if (!dpoResult.saved) {
      return NextResponse.json({
        success: true,
        data: { saved: false, reason: dpoResult.reason },
        message: 'Edição não capturada (trivial ou fora de contexto)',
      });
    }

    // 2. Sincroniza no grafo Semantica (write-path)
    if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
      try {
        const newNode = await SemanticaClient.addNode({
          tenantId,
          type: 'RULE',
          name: `DPO: ${prompt.slice(0, 50)}`,
          content: chosen,
          provenance: { source: 'ddc_edit', sourceRef: `dpo:${conversationId || Date.now()}`, extractedBy: 'dpo-collector' },
          confidence: 0.8,
        });
        const oldNode = await SemanticaClient.addNode({
          tenantId,
          type: 'RULE',
          name: `IA Original: ${prompt.slice(0, 50)}`,
          content: rejected,
          provenance: { source: 'ai_generated', extractedBy: 'zaos-neuro-router' },
          confidence: 0.3,
        });
        await SemanticaClient.addEdge({
          tenantId,
          sourceNodeId: newNode.id,
          targetNodeId: oldNode.id,
          relationType: 'SUPERSEDES',
          priorityWeight: 10,
          condition: `Editado pelo dono em ${new Date().toISOString()}`,
        });
        logSink.info({
          module: 'dpo-collector', event: 'graphrag_dpo_synced',
          message: `DPO pair sincronizado: ${newNode.id} SUPERSEDES ${oldNode.id}`,
          context: { tenantId, newNodeId: newNode.id, oldNodeId: oldNode.id },
        });
      } catch (err) {
        logSink.warn({
          module: 'dpo-collector', event: 'graphrag_dpo_sync_failed',
          message: `Falha ao sincronizar DPO no grafo: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // 3. Registra atividade
    try {
      if (db && (db as any).aIActivityLog) {
        await (db as any).aIActivityLog.create({
          data: {
            tenantId, type: 'training',
            message: `Dono editou resposta da IA para: "${prompt.slice(0, 80)}"`,
            status: 'success', duration: 0,
            metadata: JSON.stringify({
              source: 'dpo_capture', similarityScore: dpoResult.similarityScore,
              conversationId, graphSynced: SemanticaClient.isEnabled() && SemanticaClient.isConfigured(),
            }),
          },
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: { saved: true, similarityScore: dpoResult.similarityScore, graphSynced: SemanticaClient.isEnabled() && SemanticaClient.isConfigured() },
      message: 'Edição capturada! A IA vai aprender com essa correção.',
    });
  } catch (error) {
    console.error('[DPO Capture] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao capturar edição' }, { status: 500 });
  }
}

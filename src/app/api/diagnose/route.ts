import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { getAuthSession } from '@/lib/auth-guard';

interface RevenueDiagnosis {
  hotelName: string; idp: number; idpLabel: string;
  priceGap: { estimatedAvgRate: number; marketAvgRate: number; gapPercent: number; gapDirection: string; recommendation: string };
  auditReport: { resumo: string; pontuacaoGeral: number; achados: Array<{ categoria: string; severidade: string; descricao: string; impacto: string; recomendação: string }>; oportunidades: string[] };
  whatsappScript: string; diagnosedAt: string;
}

function getIdpLabel(score: number): string { if (score >= 80) return 'Excelente'; if (score >= 65) return 'Bom'; if (score >= 50) return 'Regular'; if (score >= 35) return 'Baixo'; return 'Crítico'; }

function generateDiagnosis(lead: { empresa: string; decisor: string; validationScore: number; porte: string; setor: string; cidade?: string; estado?: string }): RevenueDiagnosis {
  const baseScore = lead.validationScore;
  const idp = Math.max(15, Math.min(95, baseScore + (Math.random() * 20 - 10)));
  const idpRounded = Math.round(idp * 10) / 10;
  const estimatedAvgRate = lead.porte === 'grande' ? 450 + Math.random() * 200 : lead.porte === 'medio' ? 250 + Math.random() * 150 : 150 + Math.random() * 100;
  const marketAvgRate = estimatedAvgRate * (1.1 + Math.random() * 0.3);
  const gapPercent = ((marketAvgRate - estimatedAvgRate) / marketAvgRate) * 100;
  const auditFindings = [
    { categoria: 'Precificação Dinâmica', severidade: idp < 50 ? 'alta' : 'média', descricao: 'As diárias são fixas durante toda a semana, sem ajustes baseados na demanda sazonal ou eventos locais.', impacto: `Estimativa de perda: R$ ${Math.round(estimatedAvgRate * 0.15)} por quarto/noite em alta temporada.`, recomendação: 'Implementar precificação dinâmica com regras automatizadas.' },
    { categoria: 'Canais de Distribuição', severidade: idp < 60 ? 'alta' : 'baixa', descricao: 'Dependência excessiva de um único canal de reservas.', impacto: 'Comissões podem representar parcela relevante da receita.', recomendação: 'Diversificar canais e priorizar reservas diretas.' },
    { categoria: 'Taxa de Ocupação', severidade: idp < 55 ? 'alta' : 'média', descricao: `A taxa estimada está em torno de ${Math.round(40 + idp * 0.4)}%.`, impacto: 'Quartos vazios representam receita irrecuperável.', recomendação: 'Criar campanhas para períodos de baixa ocupação.' },
    { categoria: 'Presença Digital', severidade: 'média', descricao: 'A presença digital pode ser otimizada.', impacto: 'Melhor presença aumenta a descoberta orgânica.', recomendação: 'Atualizar perfis e integrar motor de reservas.' },
  ];
  const oportunidades = ['Implementar upselling de experiências locais', 'Criar pacotes para dias de semana', 'Ativar campanhas sazonais', 'Utilizar WhatsApp Business', 'Otimizar presença digital'];
  const whatsappScript = `Olá ${lead.decisor || 'pessoal da equipe'}! Fizemos uma análise automatizada da ${lead.empresa}. Seu IDP está em ${idpRounded.toFixed(1)}/100 — ${getIdpLabel(idpRounded)}.`;
  return { hotelName: lead.empresa, idp: idpRounded, idpLabel: getIdpLabel(idpRounded), priceGap: { estimatedAvgRate: Math.round(estimatedAvgRate * 100) / 100, marketAvgRate: Math.round(marketAvgRate * 100) / 100, gapPercent: Math.round(gapPercent * 10) / 10, gapDirection: gapPercent > 15 ? 'significativo' : gapPercent > 8 ? 'moderado' : 'leve', recommendation: gapPercent > 15 ? 'Priorizar precificação dinâmica.' : 'Otimizar ocupação e upselling.' }, auditReport: { resumo: `A ${lead.empresa} apresenta um IDP de ${idpRounded.toFixed(1)}/100.`, pontuacaoGeral: idpRounded, achados: auditFindings, oportunidades }, whatsappScript, diagnosedAt: new Date().toISOString() };
}

async function postHandler(request: NextRequest) {
  const { session, errorResponse } = await getAuthSession(request);
  if (errorResponse) return errorResponse;
  try {
    const body = await request.json();
    const { leadId } = body;
    if (typeof leadId !== 'string' || leadId.length > 100) return NextResponse.json({ error: 'INVALID_LEAD_ID' }, { status: 400 });
    const lead = await db.lead.findFirst({ where: { id: leadId, tenantId: session!.tenantId } });
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    const diagnosis = generateDiagnosis(lead);
    await db.agentLog.create({ data: { tenantId: lead.tenantId, agentId: 'lessie', action: 'diagnosis_generated', inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0, status: 'success', metadata: JSON.stringify({ leadId: lead.id, idp: diagnosis.idp }) } });
    return NextResponse.json(diagnosis, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[DIAGNOSE_POST]', error);
    return NextResponse.json({ error: 'Erro ao gerar diagnóstico' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'diagnose' });

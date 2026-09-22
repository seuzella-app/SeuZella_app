import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-sender';
import { PlanTier } from '@/lib/plan-features';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * POST `/api/zelador-suporte/ticket`
 * Envia um chamado de suporte/escalonamento do Zelador Zélla para o e-mail corporativo.
 */
export async function POST(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zelador-suporte.ticket', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zelador-suporte.ticket', what: 'zelador-suporte.ticket.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await request.json();
    const { 
      userName = 'Anfitrião', 
      userEmail = 'cliente@pousada.com', 
      propertyName = 'Minha Hospedagem', 
      tier = 'pro', 
      issueDescription = 'Solicitação de Suporte',
      chatSummary = '' 
    } = body;

    const isMax = (tier as PlanTier) === 'max';
    const recipientEmail = isMax ? 'atendimento@seuzella.com' : 'suporte@seuzella.com';
    const badgeText = isMax ? 'CHAMADO VIP MAX' : 'SUPORTE PRIORITÁRIO PRO';

    const subject = `[${badgeText}] Chamado do Zelador Zélla — ${propertyName} (${userName})`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0d0d11; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #1f1f2e;">
        <div style="text-align: center; padding-bottom: 16px; border-b: 1px solid #2a2a3d;">
          <h2 style="color: #10b981; margin: 0;">Zelador Zélla — Notificação de Suporte</h2>
          <span style="display: inline-block; background-color: ${isMax ? '#f59e0b' : '#10b981'}; color: #000000; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 12px; margin-top: 8px;">
            ${badgeText}
          </span>
        </div>

        <div style="padding: 20px 0; line-height: 1.6;">
          <p><strong>Anfitrião:</strong> ${userName}</p>
          <p><strong>E-mail de Contato:</strong> ${userEmail}</p>
          <p><strong>Propriedade:</strong> ${propertyName}</p>
          <p><strong>Plano Ativo:</strong> ${(tier as string).toUpperCase()}</p>
          <hr style="border: 0; border-top: 1px solid #2a2a3d; margin: 16px 0;" />
          <p><strong>Descrição da Solução / Dúvida:</strong></p>
          <blockquote style="background-color: #161622; padding: 12px 16px; border-left: 4px solid #10b981; margin: 0; border-radius: 4px; color: #e4e4e7;">
            ${issueDescription}
          </blockquote>

          ${chatSummary ? `
            <p style="margin-top: 16px;"><strong>Resumo da Conversa com o Zélla:</strong></p>
            <div style="background-color: #161622; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #a1a1aa; white-space: pre-wrap;">
              ${chatSummary}
            </div>
          ` : ''}
        </div>

        <div style="text-align: center; padding-top: 16px; border-t: 1px solid #2a2a3d; font-size: 12px; color: #71717a;">
          Enviado automaticamente pelo Zelador da plataforma seuzella.com
        </div>
      </div>
    `;

    const sent = await sendEmail(recipientEmail, subject, htmlContent);

    return NextResponse.json({
      success: sent,
      recipientEmail,
      message: sent ? 'Chamado encaminhado para a equipe seuzella.com com sucesso!' : 'Falha ao enviar e-mail.',
    });
  } catch (error) {
    console.error('[zelador-ticket-api] Erro ao criar ticket:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

/**
 * GET /api/cron/payment-confirmation
 *
 * Roda a cada 5 minutos via Vercel Cron.
 * Verifica pagamentos PIX confirmados (via webhook do MP/Payment Gateway) que ainda
 * não enviaram confirmação automática ao hóspede via WhatsApp.
 *
 * Fluxo:
 *   Hóspede paga PIX → MP/Payment Gateway webhook → Transaction (status=COMPLETED)
 *   → Este cron envia confirmação automática via WhatsApp
 *   → "Pagamento confirmado! Sua reserva está garantida ✅"
 */

export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  let confirmacoesEnviadas = 0;
  let erros = 0;

  try {
    if (!db) {
      return NextResponse.json({ success: true, data: { confirmacoesEnviadas: 0 } });
    }

    // Busca transações COMPLETED dos últimos 30 min que ainda não enviaram confirmação
    const ha30min = new Date(Date.now() - 30 * 60 * 1000);

    const transactions = await (db as any).transaction.findMany({
      where: {
        type: 'PAYMENT',
        status: 'COMPLETED',
        createdAt: { gte: ha30min },
        // metadata.confirmacaoEnviada = false ou null
      },
      include: {
        reservation: {
          include: {
            guest: { select: { id: true, name: true, phone: true, whatsapp: true } },
            property: { select: { id: true, name: true, city: true, state: true } },
          },
        },
        tenant: { select: { id: true, name: true } },
      },
      take: 50,
    });

    for (const tx of transactions) {
      try {
        const meta = JSON.parse(tx.metadata || '{}');
        if (meta.confirmacaoEnviada) continue;

        const phone = tx.reservation?.guest?.whatsapp || tx.reservation?.guest?.phone;
        if (!phone) continue;

        const valor = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const pousadaNome = tx.reservation?.property?.name || 'pousada';
        const dataCheckIn = tx.reservation?.checkIn
          ? new Date(tx.reservation.checkIn).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '';

        const mensagem = `✅ Pagamento confirmado!

${valor} recebidos com sucesso.
Sua reserva na ${pousadaNome} está garantida!

${dataCheckIn ? `📅 Check-in: ${dataCheckIn}` : ''}
🕐 Horário: a partir das 14h

Em breve você receberá um lembrete com todas as informações. Qualquer dúvida, é só responder aqui! 😊`;

        try {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-send');
          await sendWhatsAppMessage({
            tenantId: tx.tenant?.id,
            to: phone,
            message: mensagem,
          });

          meta.confirmacaoEnviada = true;
          meta.confirmacaoEnviadaAt = new Date().toISOString();
          await (db as any).transaction.update({
            where: { id: tx.id },
            data: { metadata: JSON.stringify(meta, undefined) },
          });

          confirmacoesEnviadas++;
          console.log(`[PaymentConfirmation] Enviado para ${tx.reservation?.guest?.name} (${phone})`);
        } catch (sendErr) {
          console.error(`[PaymentConfirmation] Erro ao enviar:`, sendErr);
          erros++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[PaymentConfirmation] Erro:`, err);
        erros++;
      }
    }

    return NextResponse.json({
      success: true,
      data: { confirmacoesEnviadas, erros, totalVerificado: transactions.length },
    });
  } catch (error) {
    console.error('[Cron PaymentConfirmation] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

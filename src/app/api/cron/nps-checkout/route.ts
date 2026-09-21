import { logger } from '@/lib/infra/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

/**
 * GET /api/cron/nps-checkout
 *
 * Roda a cada 1 hora via Vercel Cron.
 * Busca check-outs que aconteceram nas últimas 24h e envia pesquisa NPS via WhatsApp.
 *
 * Mensagem enviada:
 * "Oi [Nome]! Espero que sua estadia na [Pousada] tenha sido incrível! 🏖️
 * Em 1 palavra: como foi sua experiência? Responda com 👍 (ótimo) ou 👎 (poderia melhorar)"
 */

export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  let npsEnviados = 0;
  let erros = 0;

  try {
    if (!db) {
      return NextResponse.json({ success: true, data: { npsEnviados: 0, message: 'DB indisponível' } });
    }

    // Busca check-outs nas últimas 24h
    const agora = new Date();
    const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    const reservas = await (db as any).reservation.findMany({
      where: {
        checkOut: {
          gte: ha24h,
          lte: agora,
        },
        status: { in: ['checked_out', 'completed'] },
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, whatsapp: true } },
        property: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
      },
      take: 100,
    });

    for (const reserva of reservas) {
      try {
        const meta = JSON.parse(reserva.metadata || '{}');
        if (meta.npsEnviado) continue;

        const phone = reserva.guest?.whatsapp || reserva.guest?.phone;
        if (!phone) continue;

        const mensagem = `Oi ${reserva.guest?.name || 'hóspede'}! 🏖️

Espero que sua estadia na ${reserva.property?.name || 'pousada'} tenha sido incrível!

Em uma palavra: como foi sua experiência?
Responda com:
👍 — Foi incrível!
👎 — Pode melhorar

Seu feedback ajuda a melhorar! 🙏`;

        try {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-send');
          // Onda correção/hardening: assinatura posicional correta
          // (toPhone, text, options) — a forma objeto nunca existiu.
          await sendWhatsAppMessage(phone, mensagem, {
            tenantId: reserva.tenant?.id,
          });

          meta.npsEnviado = true;
          meta.npsEnviadoAt = new Date().toISOString();
          await (db as any).reservation.update({
            where: { id: reserva.id },
            data: { metadata: JSON.stringify(meta, undefined) },
          });

          npsEnviados++;
          logger.info(`[NPS] Enviado para ${reserva.guest?.name} (${phone}) - reserva ${reserva.id}`);
        } catch (sendErr) {
          console.error(`[NPS] Erro ao enviar:`, sendErr);
          erros++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[NPS] Erro processando reserva:`, err);
        erros++;
      }
    }

    return NextResponse.json({
      success: true,
      data: { npsEnviados, erros, totalReservas: reservas.length, executadoEm: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[Cron NPS] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

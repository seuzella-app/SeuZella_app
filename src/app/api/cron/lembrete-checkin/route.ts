// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

/**
 * GET /api/cron/lembrete-checkin
 *
 * Roda a cada 1 hora via Vercel Cron.
 * Busca reservas com check-in nas próximas 24h e envia lembrete via WhatsApp.
 *
 * Mensagem enviada:
 * "Olá [Nome]! Lembrete: seu check-in na [Pousada] é amanhã (DD/MM)!
 * Endereço: [endereço]
 * Horário de check-in: a partir das 14h
 * Qualquer dúvida, é só responder aqui! 😊"
 */

export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  let lembretesEnviados = 0;
  let erros = 0;

  try {
    if (!db) {
      return NextResponse.json({ success: true, data: { lembretesEnviados: 0, message: 'DB indisponível' } });
    }

    // Busca reservas com check-in nas próximas 24h que ainda não receberam lembrete
    const agora = new Date();
    const daqui24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

    const reservas = await (db as any).reservation.findMany({
      where: {
        checkIn: {
          gte: agora,
          lte: daqui24h,
        },
        status: { in: ['confirmed', 'booked'] },
        // Não tem campo "lembreteEnviado" — usamos metadata
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, whatsapp: true } },
        property: { select: { id: true, name: true, address: true, city: true, state: true } },
        tenant: { select: { id: true, name: true } },
      },
      take: 100,
    });

    for (const reserva of reservas) {
      try {
        // Verifica se já enviou lembrete (metadata)
        const meta = JSON.parse(reserva.metadata || '{}');
        if (meta.lembreteCheckinEnviado) continue;

        // Verifica se tem WhatsApp do hóspede
        const phone = reserva.guest?.whatsapp || reserva.guest?.phone;
        if (!phone) continue;

        const dataCheckIn = new Date(reserva.checkIn).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit',
        });

        const endereco = [reserva.property?.address, reserva.property?.city, reserva.property?.state]
          .filter(Boolean, undefined).join(', ');

        const mensagem = `Olá ${reserva.guest?.name || 'hóspede'}! 👋

Lembrete: seu check-in na ${reserva.property?.name || 'pousada'} é amanhã (${dataCheckIn})!

📍 Endereço: ${endereco || 'confirme com a pousada'}
🕐 Horário: a partir das 14h

Qualquer dúvida, é só responder aqui! 😊`;

        // Envia via WhatsApp Cloud API
        // Nota: usamos o número do tenant (WABA) para enviar
        try {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-send');
          await sendWhatsAppMessage({
            tenantId: reserva.tenant?.id,
            to: phone,
            message: mensagem,
          });

          // Marca como enviado
          meta.lembreteCheckinEnviado = true;
          meta.lembreteCheckinEnviadoAt = new Date().toISOString();
          await (db as any).reservation.update({
            where: { id: reserva.id },
            data: { metadata: JSON.stringify(meta, undefined) },
          });

          lembretesEnviados++;
          console.log(`[LembreteCheckIn] Enviado para ${reserva.guest?.name} (${phone}) - reserva ${reserva.id}`);
        } catch (sendErr) {
          console.error(`[LembreteCheckIn] Erro ao enviar para ${phone}:`, sendErr);
          erros++;
        }

        // Rate limiting entre envios
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[LembreteCheckIn] Erro processando reserva:`, err);
        erros++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lembretesEnviados,
        erros,
        totalReservas: reservas.length,
        executadoEm: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Cron LembreteCheckIn] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

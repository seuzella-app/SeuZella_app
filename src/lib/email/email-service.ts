/**
 * Email Transactional Service — Resend com fallback console
 * ============================================================================
 *
 * Para produção: configurar RESEND_API_KEY.
 * Para desenvolvimento: console.log apenas.
 *
 * Use cases:
 *   - Confirmação de reserva (hóspede)
 *   - Lembrete de check-in (24h antes)
 *   - NPS pós-estadia (24h após check-out)
 *   - Notificação de nova reserva (dono da pousada)
 *   - Cobrança mensal de comissão (dono da pousada)
 *   - LGPD: confirmação de exclusão, certificado
 * ============================================================================
 */

import { enqueueJob, QUEUE_NAMES } from '@/lib/queue/queue-service';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@seuzella.com';
const FROM_NAME = process.env.FROM_NAME || 'Zélla';
const IS_PRODUCTION = !!RESEND_API_KEY && process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIO DE EMAIL — Resend API
// ─────────────────────────────────────────────────────────────────────────────
async function sendWithResend(message: EmailMessage): Promise<EmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from || `${FROM_NAME} <${FROM_EMAIL}>`,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        tags: message.tags?.map(t => ({ name: t, value: t })),
        headers: {
          'X-Entity-Ref-ID': message.metadata?.entityId || '',
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message || `Resend API error: ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

async function sendWithConsole(message: EmailMessage): Promise<EmailResult> {
  console.log(`[EMAIL MOCK] to=${message.to} | subject="${message.subject}"`);
  console.log(`[EMAIL MOCK] body: ${message.text || message.html.slice(0, 200)}...`);
  return {
    success: true,
    messageId: `mock_${Date.now()}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA — enfileira e processa async
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (IS_PRODUCTION) {
    return await sendWithResend(message);
  }
  return await sendWithConsole(message);
}

export async function sendEmailAsync(message: EmailMessage): Promise<void> {
  await enqueueJob(QUEUE_NAMES.EMAIL_SEND, message);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES PRONTOS — LGPD compliant
// ─────────────────────────────────────────────────────────────────────────────
export const EMAIL_TEMPLATES = {
  RESERVATION_CONFIRMATION: (data: {
    guestName: string;
    pousadaName: string;
    checkIn: string;
    checkOut: string;
    room: string;
    total: number;
    pixKey?: string;
    pixAmount?: number;
    pixDueDate?: string;
  }): EmailMessage => {
    const pixInfo = data.pixKey ? `
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="color: #0f766e; margin: 0 0 8px;">Pagamento PIX</h3>
        <p>Valor: <strong>R$ ${data.pixAmount?.toFixed(2)}</strong></p>
        <p>Chave PIX: <code>${data.pixKey}</code></p>
        <p>Vencimento: <strong>${data.pixDueDate}</strong></p>
      </div>
    ` : '';

    return {
      to: '', // preencher
      subject: `✅ Reserva confirmada — ${data.pousadaName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0f766e;">Reserva confirmada!</h1>
          <p>Olá <strong>${data.guestName}</strong>,</p>
          <p>Sua reserva na <strong>${data.pousadaName}</strong> está confirmada. Detalhes:</p>
          <ul>
            <li>Check-in: <strong>${data.checkIn}</strong></li>
            <li>Check-out: <strong>${data.checkOut}</strong></li>
            <li>Quarto: <strong>${data.room}</strong></li>
            <li>Valor total: <strong>R$ ${data.total.toFixed(2)}</strong></li>
          </ul>
          ${pixInfo}
          <p>Em caso de dúvidas, responda este email ou chame no WhatsApp.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            Esta mensagem foi enviada automaticamente. Não responda com dados sensíveis.<br>
            LGPD: seus dados são processados conforme nossa política de privacidade.
          </p>
        </div>
      `,
      text: `Reserva confirmada na ${data.pousadaName}. Check-in: ${data.checkIn}. Check-out: ${data.checkOut}.`,
      tags: ['reservation', 'confirmation'],
    };
  },

  CHECKIN_REMINDER: (data: {
    guestName: string;
    pousadaName: string;
    checkInDate: string;
    checkInTime: string;
    address: string;
    wifiName?: string;
    wifiPassword?: string;
  }): EmailMessage => ({
    to: '',
    subject: `📋 Lembrete: check-in amanhã — ${data.pousadaName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f766e;">Amanhã é o grande dia!</h1>
        <p>Olá <strong>${data.guestName}</strong>,</p>
        <p>Sua estadia na <strong>${data.pousadaName}</strong> começa amanhã:</p>
        <ul>
          <li>Data: <strong>${data.checkInDate}</strong></li>
          <li>Check-in a partir das: <strong>${data.checkInTime}</strong></li>
          <li>Endereço: <strong>${data.address}</strong></li>
        </ul>
        ${data.wifiName ? `
          <div style="background: #f0fdf4; padding: 12px; border-radius: 8px;">
            <h4 style="color: #0f766e; margin: 0 0 8px;">Wi-Fi</h4>
            <p>Rede: <strong>${data.wifiName}</strong></p>
            <p>Senha: <strong>${data.wifiPassword}</strong></p>
          </div>
        ` : ''}
        <p>Boa viagem! 🌴</p>
      </div>
    `,
    text: `Lembrete: check-in amanhã às ${data.checkInTime} na ${data.pousadaName}.`,
    tags: ['checkin', 'reminder'],
  }),

  NPS_REQUEST: (data: {
    guestName: string;
    pousadaName: string;
    npsUrl: string;
  }): EmailMessage => ({
    to: '',
    subject: `Como foi sua estadia? — ${data.pousadaName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f766e;">Olá ${data.guestName}!</h1>
        <p>Esperamos que sua estadia na <strong>${data.pousadaName}</strong> tenha sido incrível.</p>
        <p>Poderia nos avaliar? Leva menos de 1 minuto:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${data.npsUrl}" style="background: #0f766e; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Avaliar estadia
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">
          Sua opinião é importante para melhorarmos nosso atendimento.
        </p>
      </div>
    `,
    text: `Como foi sua estadia? Avalie: ${data.npsUrl}`,
    tags: ['nps', 'feedback'],
  }),

  COMMISSION_INVOICE: (data: {
    tenantName: string;
    mes: number;
    ano: number;
    upsellCount: number;
    totalReceitaExtra: number;
    comissaoZehla: number;
    vencimento: string;
    cartaoLast4: string;
  }): EmailMessage => ({
    to: '',
    subject: `💳 Cobrança Zélla — ${data.mes}/${data.ano} (R$ ${data.comissaoZehla.toFixed(2)})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f766e;">Cobrança mensal Zélla</h1>
        <p>Olá <strong>${data.tenantName}</strong>,</p>
        <p>Sua cobrança mensal de comissão Zélla está pronta:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f0fdf4;">
            <td style="padding: 12px; border: 1px solid #ddd;">Período</td>
            <td style="padding: 12px; border: 1px solid #ddd;"><strong>${data.mes}/${data.ano}</strong></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">UPSELLs aceitos</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.upsellCount}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">Receita extra gerada</td>
            <td style="padding: 12px; border: 1px solid #ddd; color: #10b981;">R$ ${data.totalReceitaExtra.toFixed(2)}</td>
          </tr>
          <tr style="background: #fef3c7;">
            <td style="padding: 12px; border: 1px solid #ddd;">Comissão Zélla (7%)</td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">R$ ${data.comissaoZehla.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">Vencimento</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.vencimento}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">Cartão</td>
            <td style="padding: 12px; border: 1px solid #ddd;">**** ${data.cartaoLast4}</td>
          </tr>
        </table>
        <p>A cobrança será automática no cartão cadastrado. Detalhes completos no DDC > aba UPSELL.</p>
      </div>
    `,
    text: `Cobrança Zélla ${data.mes}/${data.ano}: R$ ${data.comissaoZehla.toFixed(2)} — vencimento ${data.vencimento}.`,
    tags: ['commission', 'invoice'],
  }),

  LGPD_DELETE_CONFIRMATION: (data: {
    guestName: string;
    requestId: string;
    completedAt: string;
    deletedTables: string[];
  }): EmailMessage => ({
    to: '',
    subject: '✅ Confirmação de exclusão de dados — LGPD',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f766e;">Dados excluídos com sucesso</h1>
        <p>Olá <strong>${data.guestName}</strong>,</p>
        <p>Conforme solicitado (art. 18, VI da LGPD), seus dados pessoais foram excluídos:</p>
        <ul>
          ${data.deletedTables.map(t => `<li>${t}</li>`).join('')}
        </ul>
        <p><strong>Solicitação:</strong> ${data.requestId}<br>
        <strong>Processada em:</strong> ${data.completedAt}</p>
        <p>Alguns dados foram mantidos por obrigação fiscal (Lei 8.137/90 — 5 anos), mas foram anonimizados.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          Em caso de dúvidas, entre em contato com nosso DPO: dpo@seuzella.com
        </p>
      </div>
    `,
    text: `Seus dados foram excluídos conforme LGPD. Solicitação ${data.requestId}.`,
    tags: ['lgpd', 'delete', 'confirmation'],
  }),
};

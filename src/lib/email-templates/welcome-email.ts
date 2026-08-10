/**
 * SEU ZÉLLA — Welcome Email Template (HTML)
 * 
 * Template de email de boas-vindas disparado imediatamente após a confirmação
 * de pagamento no webhook de provisionamento.
 */

export interface WelcomeEmailData {
  customerName: string;
  customerEmail: string;
  niche: 'pousada' | 'airbnb';
  planTier: string;
  propertyName?: string;
  magicLoginUrl: string;
}

export function generateWelcomeEmailHtml(data: WelcomeEmailData): string {
  const isPousada = data.niche === 'pousada';
  const nicheTitle = isPousada ? 'Pousada' : 'Anfitrião / Airbnb';
  const ddcUrl = data.magicLoginUrl || `https://smart-hotel-zehla.vercel.app/ddc/${data.niche}`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Seu Zélla SmartHotel</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; margin: 40px auto; background-color: #12121c; border-radius: 24px; border: 1px solid rgba(16, 185, 129, 0.2); overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 32px; text-align: center; background: linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, rgba(18, 18, 28, 0) 100%);">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #10b981; letter-spacing: -0.5px;">
          SEU ZÉLLA <span style="font-size: 14px; font-weight: 500; color: #a1a1aa;">SmartHotel</span>
        </h1>
      </td>
    </tr>

    <!-- Content Body -->
    <tr>
      <td style="padding: 0 32px 32px 32px;">
        <h2 style="margin-top: 0; font-size: 22px; color: #ffffff;">
          Olá, ${data.customerName}! 👋
        </h2>
        <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8;">
          Seu pagamento foi aprovado com sucesso e o seu ecossistema <strong>Seu Zélla (${nicheTitle})</strong> já está 100% provisionado e pronto para operação!
        </p>

        <!-- Summary Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="16" border="0" style="background-color: #181826; border-radius: 16px; margin: 24px 0; border: 1px solid rgba(255, 255, 255, 0.05);">
          <tr>
            <td style="font-size: 14px; color: #a1a1aa; width: 40%;">Plano Contratado:</td>
            <td style="font-size: 14px; font-weight: 700; color: #10b981;">Plano ${data.planTier.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #a1a1aa;">Segmento:</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff;">${nicheTitle}</td>
          </tr>
          ${data.propertyName ? `
          <tr>
            <td style="font-size: 14px; color: #a1a1aa;">Propriedade:</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff;">${data.propertyName}</td>
          </tr>
          ` : ''}
        </table>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ddcUrl}" style="display: inline-block; padding: 16px 36px; background-color: #10b981; color: #000000; font-weight: 800; font-size: 15px; text-decoration: none; border-radius: 12px; transition: all 0.2s;">
            🚀 ACESSAR PAINEL DDC DA ${data.niche.toUpperCase()}
          </a>
        </div>

        <p style="font-size: 13px; color: #71717a; text-align: center; margin-top: 24px;">
          Caso tenha dúvidas ou precise de auxílio na conexão do WhatsApp, nosso suporte 24h está à disposição no seu painel.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px 32px; background-color: #0d0d14; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; font-size: 12px; color: #71717a;">
        © ${new Date().getFullYear()} Seu Zélla SmartHotel. Todos os direitos reservados.
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

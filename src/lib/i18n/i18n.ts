/**
 * i18n — Internacionalização (PT-BR + ES-ES básico)
 * ============================================================================
 *
 * Estrutura para multi-idioma. Default: PT-BR.
 * Para adicionar novo idioma: criar arquivo em src/lib/i18n/locales/{lang}.ts
 * ============================================================================
 */

export type Locale = 'pt-BR' | 'es-ES' | 'en-US';

export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'es-ES', 'en-US'];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'es-ES': 'Español (España)',
  'en-US': 'English (US)',
};

// ─────────────────────────────────────────────────────────────────────────────
// TRADUÇÕES
// ─────────────────────────────────────────────────────────────────────────────
type TranslationKey = keyof typeof translations['pt-BR'];

const translations = {
  'pt-BR': {
    // Saudações
    greeting_morning: 'Bom dia',
    greeting_afternoon: 'Boa tarde',
    greeting_evening: 'Boa noite',

    // Identidade
    identity_intro: 'Aqui é a Zélla',
    identity_intro_short: 'Sou a Zélla',
    identity_invite_ze: 'pode me chamar de Zé',

    // UPSELL
    upsell_title: 'UPSELL',
    upsell_commission_label: 'Comissão Zélla (7%)',
    upsell_zero_normal: 'ZERO taxa em diárias normais',
    upsell_seven_extra: '7% sobre UPSELL',
    upsell_late_checkout: 'Check-out estendido (late checkout)',
    upsell_cafe_premium: 'Café da manhã premium',
    upsell_massagem: 'Massagem relaxante',

    // LGPD
    lgpd_consent_message: 'Concordo em receber mensagens no WhatsApp (LGPD art. 8º)',
    lgpd_delete_request: 'Solicitar exclusão dos meus dados',
    lgpd_data_portability: 'Exportar meus dados',

    // Depósito
    deposit_explanation: 'Depósito de segurança via PIX. Devolvido automaticamente após o check-out.',
    deposit_amount_label: 'Valor da depósito',

    // Pagamento
    payment_pix: 'PIX',
    payment_card: 'Cartão de crédito',
    payment_mercadopago: 'Mercado Pago',

    // Reserva
    reservation_confirmed: 'Reserva confirmada!',
    reservation_check_in: 'Check-in',
    reservation_check_out: 'Check-out',

    // Erros
    error_generic: 'Desculpe, tive um problema técnico. Tente novamente.',
    error_offline: 'Sem conexão. Verifique sua internet.',
  },

  'es-ES': {
    greeting_morning: 'Buenos días',
    greeting_afternoon: 'Buenas tardes',
    greeting_evening: 'Buenas noches',
    identity_intro: 'Aquí es Zélla',
    identity_intro_short: 'Soy Zélla',
    identity_invite_ze: 'puedes llamarme Zé',
    upsell_title: 'UPSELL',
    upsell_commission_label: 'Comisión Zélla (7%)',
    upsell_zero_normal: 'CERO comisión en diarias normales',
    upsell_seven_extra: '7% sobre UPSELL',
    upsell_late_checkout: 'Checkout extendido (late checkout)',
    upsell_cafe_premium: 'Desayuno premium',
    upsell_massagem: 'Masaje relajante',
    lgpd_consent_message: 'Acepto recibir mensajes por WhatsApp (LGPD art. 8º)',
    lgpd_delete_request: 'Solicitar exclusión de mis datos',
    lgpd_data_portability: 'Exportar mis datos',
    deposit_explanation: 'Depósito de seguridad vía PIX. Devuelto automáticamente después del checkout.',
    deposit_amount_label: 'Valor de la caución',
    payment_pix: 'PIX',
    payment_card: 'Tarjeta de crédito',
    payment_mercadopago: 'Mercado Pago',
    reservation_confirmed: '¡Reserva confirmada!',
    reservation_check_in: 'Check-in',
    reservation_check_out: 'Check-out',
    error_generic: 'Disculpe, tuve un problema técnico. Intente nuevamente.',
    error_offline: 'Sin conexión. Verifique su internet.',
  },

  'en-US': {
    greeting_morning: 'Good morning',
    greeting_afternoon: 'Good afternoon',
    greeting_evening: 'Good evening',
    identity_intro: 'This is Zélla',
    identity_intro_short: 'I am Zélla',
    identity_invite_ze: 'you can call me Zé',
    upsell_title: 'UPSELL',
    upsell_commission_label: 'Zélla Commission (7%)',
    upsell_zero_normal: 'ZERO fee on normal daily rates',
    upsell_seven_extra: '7% on UPSELL',
    upsell_late_checkout: 'Late checkout',
    upsell_cafe_premium: 'Premium breakfast',
    upsell_massagem: 'Relaxing massage',
    lgpd_consent_message: 'I agree to receive WhatsApp messages (LGPD art. 8)',
    lgpd_delete_request: 'Request deletion of my data',
    lgpd_data_portability: 'Export my data',
    deposit_explanation: 'Security deposit via PIX. Automatically refunded after checkout.',
    deposit_amount_label: 'Deposit amount',
    payment_pix: 'PIX',
    payment_card: 'Credit card',
    payment_mercadopago: 'Mercado Pago',
    reservation_confirmed: 'Reservation confirmed!',
    reservation_check_in: 'Check-in',
    reservation_check_out: 'Check-out',
    error_generic: 'Sorry, I had a technical issue. Please try again.',
    error_offline: 'No connection. Check your internet.',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — traduz com fallback para PT-BR
// ─────────────────────────────────────────────────────────────────────────────
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE): string {
  const localeTranslations = translations[locale] || translations[DEFAULT_LOCALE];
  return localeTranslations[key] || translations[DEFAULT_LOCALE][key] || key;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECTAR LOCALE DO REQUEST
// ─────────────────────────────────────────────────────────────────────────────
export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const languages = acceptLanguage
    .split(',')
    .map(l => l.split(';')[0].trim())
    .filter(Boolean);

  for (const lang of languages) {
    if (lang.startsWith('es')) return 'es-ES';
    if (lang.startsWith('en')) return 'en-US';
    if (lang.startsWith('pt')) return 'pt-BR';
  }

  return DEFAULT_LOCALE;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATADORES LOCALE-AWARE
// ─────────────────────────────────────────────────────────────────────────────
export function formatCurrency(value: number, locale: Locale = DEFAULT_LOCALE): string {
  const currency = locale === 'es-ES' ? 'EUR' : locale === 'en-US' ? 'USD' : 'BRL';
  return value.toLocaleString(locale.replace('-', '_'), {
    style: 'currency',
    currency,
  });
}

export function formatDate(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale.replace('-', '_'), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale.replace('-', '_'), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

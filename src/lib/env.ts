// Centralized env access with validation
function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

// Database
export const DATABASE_URL = getEnv('DATABASE_URL', 'file:./db/custom.db');

// NextAuth
export const NEXTAUTH_URL = getEnv('NEXTAUTH_URL', 'http://localhost:3000');
export const NEXTAUTH_SECRET = (() => {
  const secret = process.env.NEXTAUTH_SECRET;
  // Don't throw during Vercel build phase — runtime will still need it
  if (!secret) {
    if (process.env.NEXT_PHASE?.includes('build')) {
      // Build phase: use a throwaway random value (never used at runtime)
      return crypto.randomUUID();
    }
    throw new Error('NEXTAUTH_SECRET environment variable is required — set a cryptographically random value (≥32 chars)');
  }
  return secret;
})();

/**
 * Shared utility: get NEXTAUTH_SECRET or throw.
 * NO hardcoded fallback strings — missing secret always throws.
 * Use this in all files that need the secret for getToken() or HMAC signing.
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required');
  }
  return secret;
}

// Mercado Pago
export const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? '';
export const MP_WEBHOOK_URL = process.env.MP_WEBHOOK_URL ?? '';

// Payment Gateway (Unified — MP + Asaas + Stripe)
export const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? process.env.MP_WEBHOOK_SECRET ?? '';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
export const STRIPE_ACCOUNT_ID = process.env.STRIPE_ACCOUNT_ID ?? '';

// Asaas — Brazilian gateway (PIX, card, boleto, native recurring)
export const ASAAS_ACCESS_TOKEN = process.env.ASAAS_ACCESS_TOKEN ?? '';
export const ASAAS_ENVIRONMENT = (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox';
export const ASAAS_WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET ?? '';
export const ASAAS_AUTO_NFSE = process.env.ASAAS_AUTO_NFSE ?? 'true';
export const ASAAS_MUNICIPAL_SERVICE_CODE = process.env.ASAAS_MUNICIPAL_SERVICE_CODE ?? '01.01';
export const ASAAS_MUNICIPAL_SERVICE_NAME = process.env.ASAAS_MUNICIPAL_SERVICE_NAME ?? 'Licenciamento ou cessão de direito de uso de programas de computação';

// Default gateway selection — overrides preference order in gateway-factory.ts
// Valid values: 'asaas' | 'mercadopago' | 'stripe' | undefined (auto-detect)
export const DEFAULT_PAYMENT_GATEWAY = process.env.DEFAULT_PAYMENT_GATEWAY as 'asaas' | 'mercadopago' | 'stripe' | undefined;

// ── Public WhatsApp numbers (Landing Page + ZCC) ───────────────────────────
// Replace placeholder values via env vars when going live.
// Format: country code + DDD + number (e.g. "5548999999999")
// DO NOT keep the default zeros in production — set NEXT_PUBLIC_WHATSAPP_COMMERCIAL.
export const WHATSAPP_COMMERCIAL = process.env.NEXT_PUBLIC_WHATSAPP_COMMERCIAL ?? '5548999990000';
export const WHATSAPP_SUPPORT = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? '5548999990001';

// AI Providers
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? '';
export const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY ?? '';
export const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY ?? '';
export const GLM_5_2_API_KEY = process.env.GLM_5_2_API_KEY ?? '';
export const KIMI_K2_6_API_KEY = process.env.KIMI_K2_6_API_KEY ?? '';
export const OLLAMA_URL = process.env.OLLAMA_URL ?? '';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';

// Security
export const CACHE_SIGNING_SECRET = process.env.CACHE_SIGNING_SECRET ?? '';
export const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET ?? '';

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

// Upstash Redis (para semantic cache distribuído)
export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

// ZAOS Router
export const ZAI_API_KEY = process.env.ZAI_API_KEY ?? '';
export const ZEHLA_LOOP_API_KEY = process.env.ZEHLA_LOOP_API_KEY ?? '';

// Meta Cost Guard
export const META_COST_GUARD_ENABLED = process.env.META_COST_GUARD_ENABLED ?? 'false';
export const META_COST_LIMIT_PER_MESSAGE = Number(process.env.META_COST_LIMIT_PER_MESSAGE ?? '0.10');

// Meta WhatsApp Business API — NO fallback tokens (security)
export const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? '';
export const META_APP_SECRET = process.env.META_APP_SECRET ?? '';
export const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN ?? '';
export const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID ?? '';
export const META_WABA_ID = process.env.META_WABA_ID ?? '';

// Centralized environment access with explicit production safety rules.

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable: ${key}`);
}

function getOptionalEnv(key: string): string {
  return process.env[key] ?? '';
}

function requireProductionSecret(key: string, minimumLength = 32): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing production security secret: ${key}`);
  if (value.length < minimumLength) throw new Error(`${key} must contain at least ${minimumLength} characters`);
  return value;
}

export const DATABASE_URL = getEnv('DATABASE_URL', 'file:./db/custom.db');
export const NEXTAUTH_URL = getEnv('NEXTAUTH_URL', 'http://localhost:3000');

export const NEXTAUTH_SECRET = (() => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE?.includes('build') || process.env.NODE_ENV !== 'production' || !process.env.NEXT_RUNTIME) {
      return 'build_time_ephemeral_secret_for_nextjs_static_analysis_32chars!';
    }
    throw new Error('NEXTAUTH_SECRET environment variable is required — set a cryptographically random value (≥32 chars)');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32 && process.env.NEXT_RUNTIME === 'nodejs') {
    throw new Error('NEXTAUTH_SECRET must contain at least 32 characters in production');
  }
  return secret;
})();

export function getNextAuthSecret(): string { return requireProductionSecret('NEXTAUTH_SECRET'); }

// Mercado Pago — server-side only
export const MP_ACCESS_TOKEN = getOptionalEnv('MP_ACCESS_TOKEN');
export const MP_WEBHOOK_URL = getOptionalEnv('MP_WEBHOOK_URL');
export const PAYMENT_WEBHOOK_SECRET = getOptionalEnv('PAYMENT_WEBHOOK_SECRET') || getOptionalEnv('MP_WEBHOOK_SECRET');

// Asaas — payment + NFS-e provider
export const ASAAS_ACCESS_TOKEN = getOptionalEnv('ASAAS_ACCESS_TOKEN');
export const ASAAS_ENVIRONMENT = (process.env.ASAAS_ENVIRONMENT ?? (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')) as 'sandbox' | 'production';
export const ASAAS_WEBHOOK_SECRET = getOptionalEnv('ASAAS_WEBHOOK_SECRET');
export const ASAAS_AUTO_NFSE = process.env.ASAAS_AUTO_NFSE ?? 'false';
export const ASAAS_MUNICIPAL_SERVICE_CODE = process.env.ASAAS_MUNICIPAL_SERVICE_CODE ?? '';
export const ASAAS_MUNICIPAL_SERVICE_NAME = process.env.ASAAS_MUNICIPAL_SERVICE_NAME ?? '';
export const DEFAULT_PAYMENT_GATEWAY = process.env.DEFAULT_PAYMENT_GATEWAY as 'asaas' | 'mercadopago' | undefined;

export const WHATSAPP_COMMERCIAL = process.env.NEXT_PUBLIC_WHATSAPP_COMMERCIAL ?? (process.env.NODE_ENV === 'production' ? '' : '5548999990000');
export const WHATSAPP_SUPPORT = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? (process.env.NODE_ENV === 'production' ? '' : '5548999990001');

// Meta WhatsApp Business Cloud API
export const META_VERIFY_TOKEN = getOptionalEnv('META_VERIFY_TOKEN') || getOptionalEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
export const META_APP_SECRET = getOptionalEnv('META_APP_SECRET') || getOptionalEnv('WHATSAPP_APP_SECRET');
export const META_ACCESS_TOKEN = getOptionalEnv('META_ACCESS_TOKEN');
export const META_PHONE_NUMBER_ID = getOptionalEnv('META_PHONE_NUMBER_ID');
export const META_WABA_ID = getOptionalEnv('META_WABA_ID');
export const META_GRAPH_API_VERSION = getOptionalEnv('META_GRAPH_API_VERSION') || 'v23.0';

// Backward-compatible aliases for existing WhatsApp webhook routes.
export const WHATSAPP_WEBHOOK_VERIFY_TOKEN = META_VERIFY_TOKEN;
export const WHATSAPP_APP_SECRET = META_APP_SECRET;

export const META_COST_GUARD_ENABLED = process.env.META_COST_GUARD_ENABLED ?? 'false';
export const META_COST_LIMIT_PER_MESSAGE = Number(process.env.META_COST_LIMIT_PER_MESSAGE ?? '0.10');

// AI providers
export const OPENAI_API_KEY = getOptionalEnv('OPENAI_API_KEY');
export const GROQ_API_KEY = getOptionalEnv('GROQ_API_KEY');
export const GEMINI_API_KEY = getOptionalEnv('GEMINI_API_KEY');
export const ANTHROPIC_API_KEY = getOptionalEnv('ANTHROPIC_API_KEY');
export const DEEPSEEK_API_KEY = getOptionalEnv('DEEPSEEK_API_KEY');
export const ZHIPU_API_KEY = getOptionalEnv('ZHIPU_API_KEY');
export const MOONSHOT_API_KEY = getOptionalEnv('MOONSHOT_API_KEY');
export const GLM_5_2_API_KEY = getOptionalEnv('GLM_5_2_API_KEY');
export const KIMI_K2_6_API_KEY = getOptionalEnv('KIMI_K2_6_API_KEY');
export const OLLAMA_URL = getOptionalEnv('OLLAMA_URL');
export const OPENROUTER_API_KEY = getOptionalEnv('OPENROUTER_API_KEY');

// Security
export const CACHE_SIGNING_SECRET = getOptionalEnv('CACHE_SIGNING_SECRET');
export const ENCRYPTION_SECRET = getOptionalEnv('ENCRYPTION_SECRET');

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

// Upstash Redis
export const UPSTASH_REDIS_REST_URL = getOptionalEnv('UPSTASH_REDIS_REST_URL');
export const UPSTASH_REDIS_REST_TOKEN = getOptionalEnv('UPSTASH_REDIS_REST_TOKEN');

// ZAOS Router
export const ZAI_API_KEY = getOptionalEnv('ZAI_API_KEY');
export const ZEHLA_LOOP_API_KEY = getOptionalEnv('ZEHLA_LOOP_API_KEY');

export function assertProductionSecurityEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  requireProductionSecret('NEXTAUTH_SECRET');
  requireProductionSecret('DATABASE_URL', 1);
  requireProductionSecret('ENCRYPTION_SECRET');
  requireProductionSecret('CACHE_SIGNING_SECRET');
  if (!WHATSAPP_COMMERCIAL || !WHATSAPP_SUPPORT) throw new Error('Production WhatsApp contact numbers must be explicitly configured');

  if (DEFAULT_PAYMENT_GATEWAY === 'asaas') {
    requireProductionSecret('ASAAS_ACCESS_TOKEN', 1);
    requireProductionSecret('ASAAS_WEBHOOK_SECRET', 1);
  }
  if (DEFAULT_PAYMENT_GATEWAY === 'mercadopago') {
    requireProductionSecret('MP_ACCESS_TOKEN', 1);
    requireProductionSecret('PAYMENT_WEBHOOK_SECRET', 1);
  }
}

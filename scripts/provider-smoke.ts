type Provider = 'asaas' | 'mercadopago' | 'whatsapp';

const required: Record<Provider, string[]> = {
  asaas: ['ASAAS_API_KEY'],
  mercadopago: ['MERCADOPAGO_ACCESS_TOKEN'],
  whatsapp: ['META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID', 'META_APP_SECRET', 'META_VERIFY_TOKEN'],
};

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function check(provider: Provider) {
  const missing = required[provider].filter((name) => !has(name));
  return { provider, ready: missing.length === 0, missing };
}

const providers: Provider[] = ['asaas', 'mercadopago', 'whatsapp'];
const result = providers.map(check);

console.log(JSON.stringify({
  environment: process.env.NODE_ENV || 'development',
  providers: result,
  ready: result.every((item) => item.ready),
}, null, 2));

if (process.argv.includes('--strict') && !result.every((item) => item.ready)) {
  process.exitCode = 2;
}

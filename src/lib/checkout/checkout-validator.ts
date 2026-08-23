/**
 * SEU ZÉLLA — Checkout Validation Engine
 * 
 * Validação centralizada de formulários de checkout e entrada de dados do lead.
 */

export interface CheckoutInputParams {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  niche: 'pousada' | 'airbnb';
  planType: string;
  propertyName?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateCheckoutInput(input: Partial<CheckoutInputParams>): ValidationResult {
  const errors: Record<string, string> = {};

  // 1. Nome do cliente
  if (!input.customerName || input.customerName.trim().length < 3) {
    errors.customerName = 'Informe seu nome completo (mínimo 3 caracteres).';
  }

  // 2. Email formato válido
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.customerEmail || !emailRegex.test(input.customerEmail.trim())) {
    errors.customerEmail = 'Informe um endereço de e-mail válido.';
  }

  // 3. Telefone formato BR
  const phoneDigits = (input.customerPhone || '').replace(/\D/g, '');
  if (!input.customerPhone || phoneDigits.length < 10) {
    errors.customerPhone = 'Informe um telefone com DDD válido.';
  }

  // 4. Nicho obrigatório
  if (!input.niche || (input.niche !== 'pousada' && input.niche !== 'airbnb')) {
    errors.niche = 'Selecione o tipo de operação (Pousada ou Anfitrião/Airbnb).';
  }

  // 5. Plano válido
  const validPlans = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
  if (!input.planType || !validPlans.includes(input.planType.toLowerCase())) {
    errors.planType = 'Selecione um plano válido para continuar.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

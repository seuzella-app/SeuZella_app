// ==============================================================================
// ZÉLLA — Phone Utilities (Multi-Tenant Safe)
// ==============================================================================
// Funções centralizadas para normalização e classificação de identificadores
// de hóspede. Usadas por bsuid-resolver, resolve-tenant-by-phone, webhook
// handlers e lgpd-consent. Garantem que o roteamento multi-tenant por número
// WhatsApp seja determinístico e livre de colisões por substring.
// ==============================================================================

/**
 * Classifica o tipo de identificador recebido da Meta / hóspede.
 *
 * - 'phone'    → número E.164 válido (ex: +5511988887777)
 * - 'bsuid'    → Business Scoped User ID da Meta (não-telefone)
 * - 'unknown'  → não foi possível classificar (tratar como BSUID p/ segurança)
 *
 * A heurística é determinística e sem dependências externas, focada no
 * contexto Brasileiro do SeuZélla (DDI 55). Caso a Meta mude o formato do
 * BSUID no futuro, novos padrões podem ser adicionados aqui sem propagar
 * mudanças para outros arquivos (single source of truth).
 */
export type PhoneKind = 'phone' | 'bsuid' | 'unknown';

export function classifyPhoneInput(input: string | undefined | null): PhoneKind {
  if (!input || typeof input !== 'string') return 'unknown';

  const trimmed = input.trim();
  if (!trimmed) return 'unknown';

  // 1. Prefixo explícito de BSUID usado em mocks legados
  if (trimmed.startsWith('meta-')) return 'bsuid';

  // 2. Inicia com letra → BSUID (identificadores da Meta são alfanuméricos)
  if (/^[a-zA-Z]/.test(trimmed)) return 'bsuid';

  // 3. Contém caracteres não-numéricos (exceto +) → BSUID
  if (!/^\+?\d+$/.test(trimmed)) return 'bsuid';

  // 4. Apenas dígitos (com ou sem +): validar como E.164
  //    E.164: máximo 15 dígitos sem o '+'. Telefones BR: 12-13 dígitos (DDI+DDD+numero)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 0 || digitsOnly.length > 15) {
    return 'bsuid'; // numérico mas fora do range E.164 → provável BSUID numérico
  }

  // 5. Validação básica para Brasil (DDI 55)
  //    Celular BR: 55 + DDD(2) + 9 + 8 dígitos = 13 dígitos
  //    Fixo BR:    55 + DDD(2) + 8 dígitos = 12 dígitos
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return 'phone';
  }

  // 6. Sem DDI explícito mas com 10-11 dígitos → número BR local
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return 'phone';
  }

  // 7. Fallback conservador: numérico curto válido em outro país → phone
  //    Numérico entre 7-15 dígitos → assume phone (E.164 internacional)
  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    return 'phone';
  }

  return 'unknown';
}

/**
 * Normaliza um número de telefone para o formato E.164 canônico: +DDIdddddddddd
 *
 * Regras:
 *  - Remove todos os caracteres não-numéricos
 *  - Adiciona '+' no início
 *  - Se for número BR sem DDI (10-11 dígitos), prefixa com '55'
 *  - Retorna null se o input não for classificável como phone
 *
 * Esta função é idempotente: normalizar um número já normalizado retorna o mesmo valor.
 */
export function normalizeToE164(input: string | undefined | null): string | null {
  if (!input || typeof input !== 'string') return null;

  const kind = classifyPhoneInput(input);
  if (kind !== 'phone') return null;

  let digits = input.replace(/\D/g, '');

  // Brasil sem DDI → adicionar 55
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  // Validar range final E.164 (máx 15 dígitos)
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return `+${digits}`;
}

/**
 * Compara dois números de telefone por igualdade semântica (após normalização E.164).
 * Retorna false se qualquer um dos dois não for classificável como phone.
 */
export function arePhonesEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizeToE164(a);
  const nb = normalizeToE164(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Mascara um número de telefone para exibição segura em logs/painel.
 * Ex: +5511988887777 → +5511*****7777
 */
export function maskPhone(phone: string | undefined | null): string {
  const normalized = normalizeToE164(phone);
  if (!normalized) return '***';
  if (normalized.length <= 6) return '***';
  const prefix = normalized.substring(0, 6);
  const suffix = normalized.substring(normalized.length - 4);
  return `${prefix}***${suffix}`;
}

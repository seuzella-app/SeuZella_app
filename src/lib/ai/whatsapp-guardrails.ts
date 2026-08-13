/**  
 * WhatsApp Guardrails — Blindagem Ativa contra Prompt Injection  
 *  
 * Camada de defesa aplicada ANTES da mensagem do hóspede entrar  
 * no pipeline cognitivo. Detecta e sinaliza:  
 *   - Prompt injection / jailbreak  
 *   - Tentativas de extração de dados de outros hóspedes  
 *   - Manipulação de preços/descontos  
 *   - Comandos de sistema / instruções ocultas  
 *  
 * Design: zero-dependência, puro regex + heurística, <2ms por mensagem.  
 */

// ── Patterns de ataque ──────────────────────────────────────────────

const INJECTION_PATTERNS: Array<{ regex: RegExp; severity: 'high' | 'critical'; label: string }> = [
  // Instrução de ignorar sistema  
  { regex: /\b(ignor[eae]|esquec[eça]|desconsidere|n[aã]o siga|ignore)\s+(suas?|as?|tudo|o que|todas?|seus?|as regras|este sistema|as instru[cç][oõ]es)\b/i, severity: 'critical', label: 'IGNORE_SYSTEM' },  
  // Solicitação de system prompt  
  { regex: /\b(repete|mostre|imprima|exiba|revele|escreva|retorne|diga)\s+(o? ?|seu? ?|a? ?)(system\s*prompt|prompt\s*(do )?sistema|instru[cç][aã]o|configura[cç][aã]o|primeira\s*mensagem)/i, severity: 'critical', label: 'EXTRACT_SYSTEM_PROMPT' },  
  // Role switching  
  { regex: /\b(voc[eê]\s*(agora|passa? a)\s*(ser|eh|é|e|virar|fazer\s*de))\s+(um?a?|o? ?a?)(administrador|gerente|dono|desenvolvedor|sysadmin|super\s*user|root|god)/i, severity: 'critical', label: 'ROLE_SWITCH' },  
  // Jailbreak clássicos  
  { regex: /\b(DAN\b|jailbreak|desbloquei[ae]|bypass|hacke[ae]|exploit|DAN\s*mode|evil\s*mode|developer\s*mode)\b/i, severity: 'critical', label: 'JAILBREAK' },  
  // Delta / "ignore previous"  
  { regex: /\b(ignore\s*previous|esqueça\s*tudo|novas?\s*instru[cç][oõ]es|a\s*partir\s*de\s*agora|nova\s*personalidade)\b/i, severity: 'high', label: 'CONTEXT_RESET' },  
  // Markup de system prompt  
  { regex: /\[SYSTEM\]|\[INST\]|<\|im_start\|>|\{\{system\}\}|<<SYS>>/i, severity: 'critical', label: 'SYSTEM_MARKUP' },  
  // Extração de dados de outros hóspedes  
  { regex: /\b(list[ae]|mostr[ae]|busque|encontre|pesquis[ae])\s+(todos?\s*os?\s*)?(h[oó]spedes?|clientes?|reservas?|n[oô]meros?\s*de\s*telefone?|emails?|cpf|cnpj|dados?\s*(pessoais?|de\s*(outros?|terceiros)))\b/i, severity: 'high', label: 'PII_EXTRACTION' },  
  // Manipulação de preços  
  { regex: /\b(d[eê]\s*(um?\s*)?desconto\s*(de|de\s*(at[eé])?)?\s*\d{2,}|gr[aá]tis|zero\s*real|n[aã]o\s*pague|sem\s*custo|cobr[ae]\s*(zero|nada)|descont[oa]\s*(m[aá]ximo|total|absurdo|gigante))/i, severity: 'high', label: 'PRICE_MANIPULATION' },  
  // Base64 / encoding obfuscation  
  { regex: /\b(base64|decode|encode|atob|btoa|fromBase64)\b.*['"][A-Za-z0-9+/=]{20,}/i, severity: 'high', label: 'ENCODED_INJECTION' },  
  // Multi-turn setup  
  { regex: /\b(passo\s*\d|step\s*\d|etapa\s*\d).*\b(pr[oó]ximo|next|continu[ae])/i, severity: 'high', label: 'MULTI_STEP_INJECTION' },  
  // Linguagem técnica de prompt  
  { regex: /\b(temperature|top_p|max_tokens|system_message|api_key|apiKey|openai|anthropic)\s*[:=]/i, severity: 'high', label: 'LEAK_CONFIG' },  
];


// ── Padrões de conteúdo inapropriado ────────────────────────────────

const INAPPROPRIATE_PATTERNS: Array<{ regex: RegExp; severity: 'medium' | 'high'; label: string }> = [
  // Xingamentos / palavrões pesados
  { regex: /\b(merd[ãa]|bost[ao]|porr[aa]|caralh[oo]|bucet[aa]|piriguet[ee]|vagabund[ao]|put[aa]|viad[ao]|boiol[aa]|arrombad[ao]|babac[ao]|ot[aá]ri[oo]|imbecil|idiota|est[uú]pid[ao])\b/i, severity: 'medium', label: 'INAPPROPRIATE_LANGUAGE' },
  // Conteúdo sexual explícito
  { regex: /\b(sexo|trans[ae]r|pelad[oa]|n[úu]d|safad[ao]|tarad[ao]|excitant[ee])\b/i, severity: 'high', label: 'SEXUAL_CONTENT' },
  // Ameaças
  { regex: /\b(vou\s*te\s*(matar|pegar|achar)|vou\s*(te\s*)?destruir|cuidado|amea[cç][ao])\b/i, severity: 'high', label: 'THREAT' },
];

// ── Padrões de scam/phishing ────────────────────────────────────────

const SCAM_PATTERNS: Array<{ regex: RegExp; severity: 'high' | 'critical'; label: string }> = [
  // Phishing de dados bancários
  { regex: /\b(diga\s*(seu|o)\s*(cpf|cnpj|senha|cart[ãa]o|cvv|token|c[oó]digo|verifica[cç][ãa]o))\b/i, severity: 'critical', label: 'PHISHING_BANK' },
  // Links suspeitos
  { regex: /https?:\/\/(bit\.ly|tinyurl|t\.me|wa\.me\/\d)/i, severity: 'high', label: 'SUSPICIOUS_LINK' },
  // Pedido de PIX para número diferente da pousada
  { regex: /\b(pague\s*(no|para)|transfer?\s*(para|no)|pix\s*(para|no))\s*\d{10,}/i, severity: 'high', label: 'PIVOT_PAYMENT' },
  // Golpe do "funcionário"
  { regex: /\b(sou\s*(da|do)\s*(booking|airbnb|central|matriz)|funcion[aá]rio\s*(da|do)\s*(booking|airbnb|central))\b/i, severity: 'critical', label: 'IMPERSONATION' },
  // Tentativa de reembolso forjado
  { regex: /\b(reembols[oa]|estorn[ao]|devolu[cç][ãa]o).{0,30}(diferen[cç]a|errad[oa]|incorret[oa])\b/i, severity: 'high', label: 'FAKE_REFUND' },
];

// ── Heurísticas de urgência (para handover humano) ─────────────────

const URGENCY_PATTERNS: RegExp[] = [  
  /\b(urgente|emerg[eê]ncia|socorro|ajuda\s*imediata|pol[ií]cia|samu|bombeiro|inc[eê]ndio|acidente|ferid[oa]|sangrando|agress[aã]o|amea[cç]a)\b/i,  
  /\b(fale\s*(com|para)\s*(o|um)\s*(gerente|dono|don[ao]|respons[aá]vel|humano|persona|atendente\s*real))\b/i,  
  /\b(n[aã]o\s*(quero|gosto)\s*(de|do?)\s*(ia|robo?t?|autom[aá]tico|virtual|chat))\b/i,  
  /\b(advogado|processo|justi[cç]a|consumidor|procon|reclame\s*aqui|den[uú]ncia)\b/i,  
  /^(falar\s*(com|para)|quero\s*uma\s*pessoa|humano|atendente|pessoa\s*real|ningu[eé]m\s*responde)/i,  
];

// ── Tipos ───────────────────────────────────────────────────────────

export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GuardrailResult {  
  /** true se a mensagem é segura para processamento */  
  safe: boolean;  
  /** true se deve ser escalada para atendimento humano */  
  requiresHumanHandover: boolean;  
  /** Mensagem sanitizada (com conteúdo suspeito removido/truncado) */  
  sanitizedContent: string;  
  /** Alertas de segurança detectados */  
  alerts: Array<{  
    severity: GuardrailSeverity;  
    label: string;  
    matchedPattern: string;  
  }>;  
  /** Resumo do motivo se bloqueado */  
  blockReason?: string;  
}

// ── Constantes ───────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 2000;

// ── Funções auxiliares ───────────────────────────────────────────────

/** Remove caracteres de controle e normaliza whitespace */  
function normalizeMessage(msg: string): string {  
  return msg  
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars  
    .replace(/\t+/g, ' ')  
    .replace(/ {2,}/g, ' ')  
    .trim();  
}

/** Remove blocos de código e instruções estruturadas suspeitas */  
function stripSuspiciousBlocks(msg: string): string {  
  let cleaned = msg;  
  // Remove code blocks  
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[bloco de código removido]');  
  // Remove inline code com instruções  
  cleaned = cleaned.replace(/`[^`]*(?:system|prompt|ignore|instruction)[^`]*`/gi, '[removido]');  
  // Remove formatação de prompt injection  
  cleaned = cleaned.replace(/\[INST\][\s\S]*?\[\/INST\]/gi, '');  
  cleaned = cleaned.replace(/<<SYS>>[\s\S]*?<\/SYS>>/gi, '');  
  cleaned = cleaned.replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, '');  
  return cleaned;  
}


// ── Rate limiting por hóspede (30 msgs/hora) ───────────────────────

const guestMessageCount = new Map<string, { count: number; windowStart: number }>();
const GUEST_RATE_LIMIT_PER_HOUR = 30;
const GUEST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

export function checkGuestRateLimit(guestPhone: string): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = guestMessageCount.get(guestPhone);

  if (!entry || (now - entry.windowStart) > GUEST_RATE_LIMIT_WINDOW_MS) {
    guestMessageCount.set(guestPhone, { count: 1, windowStart: now });
    return { allowed: true, remaining: GUEST_RATE_LIMIT_PER_HOUR - 1, resetInMs: GUEST_RATE_LIMIT_WINDOW_MS };
  }

  entry.count++;
  const remaining = GUEST_RATE_LIMIT_PER_HOUR - entry.count;
  const resetInMs = GUEST_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);

  if (entry.count > GUEST_RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0, resetInMs };
  }

  return { allowed: true, remaining, resetInMs };
}

// ── Função principal ─────────────────────────────────────────────────

/**  
 * Analisa e sanitiza uma mensagem de hóspede do WhatsApp.  
 *  
 * Deve ser chamada ANTES de qualquer processamento de IA.  
 * Retorna o conteúdo sanitizado + flags de segurança.  
 */  
export function guardWhatsAppMessage(rawMessage: string): GuardrailResult {  
  const alerts: GuardrailResult['alerts'] = [];

  // 1. Verificar comprimento  
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {  
    return {  
      safe: false,  
      requiresHumanHandover: false,  
      sanitizedContent: rawMessage.substring(0, MAX_MESSAGE_LENGTH),  
      alerts: [{ severity: 'medium', label: 'MSG_TOO_LONG', matchedPattern: `length=${rawMessage.length}` }],  
      blockReason: `Mensagem excede ${MAX_MESSAGE_LENGTH} caracteres`,  
    };  
  }

  // 2. Normalizar  
  const normalized = normalizeMessage(rawMessage);

  if (!normalized) {  
    return {  
      safe: false,  
      requiresHumanHandover: false,  
      sanitizedContent: '',  
      alerts: [],  
      blockReason: 'Mensagem vazia após normalização',  
    };  
  }

  // 3. Verificar urgência / pedido de humano (ANTES da análise de injection)  
  let requiresHumanHandover = false;  
  for (const pattern of URGENCY_PATTERNS) {  
    if (pattern.test(normalized)) {  
      requiresHumanHandover = true;  
      break;  
    }  
  }

  // 4. Detectar prompt injection  
  for (const { regex, severity, label } of INJECTION_PATTERNS) {  
    const match = normalized.match(regex);  
    if (match) {  
      alerts.push({  
        severity,  
        label,  
        matchedPattern: match[0].substring(0, 100),  
      });  
    }  
  }

  // 4b. Detectar conteúdo inapropriado
  for (const { regex, severity, label } of INAPPROPRIATE_PATTERNS) {
    const match = normalized.match(regex);
    if (match) {
      alerts.push({ severity, label, matchedPattern: match[0].substring(0, 100) });
    }
  }

  // 4c. Detectar scam/phishing
  for (const { regex, severity, label } of SCAM_PATTERNS) {
    const match = normalized.match(regex);
    if (match) {
      alerts.push({ severity, label, matchedPattern: match[0].substring(0, 100) });
    }
  }

  // 5. Determinar se é seguro  
  const hasCritical = alerts.some(a => a.severity === 'critical');  
  const hasMultipleHigh = alerts.filter(a => a.severity === 'high').length >= 2;

  if (hasCritical || hasMultipleHigh) {  
    return {  
      safe: false,  
      requiresHumanHandover: true,  
      sanitizedContent: '[mensagem bloqueada por segurança]',  
      alerts,  
      blockReason: hasCritical  
        ? `Tentativa de prompt injection detectada (${alerts[0].label})`  
        : 'Múltiplas tentativas de manipulação detectadas',  
    };  
  }

  // 6. Sanitizar conteúdo (remover blocos suspeitos mesmo se seguro)  
  const sanitized = stripSuspiciousBlocks(normalized);

  // 7. Se tem alertas high únicos, marcar para log mas permitir com contexto reduzido  
  const hasSingleHigh = alerts.some(a => a.severity === 'high');

  return {  
    safe: true,  
    requiresHumanHandover,  
    sanitizedContent: sanitized,  
    alerts,  
    ...(hasSingleHigh ? { blockReason: undefined } : {}),  
  };  
}

/**  
 * Loga um alerta de segurança no banco de dados (SecurityAlert).  
 * Deve ser chamado asyncronamente (fire-and-forget).  
 */  
export async function logGuardrailAlert(  
  tenantId: string,  
  source: string,  
  result: GuardrailResult,  
): Promise<void> {  
  if (result.alerts.length === 0) return;  

  for (const alert of result.alerts) {  
    try {  
      await (await import('@/lib/db')).db.securityAlert.create({  
        data: {  
          type: 'injection',  
          severity: alert.severity,  
          description: `[WhatsApp Guardrails] ${alert.label}: "${alert.matchedPattern}"`,  
          source,  
        },  
      });  
    } catch {  
      // Fire-and-forget — não bloqueia o pipeline  
    }  
  }  
}  

/**
 * ZEHLA FORTRESS — Cognitive Security Brain Integration
 * 
 * Integrates the complete 6-layer Zero-Trust Fortress Architecture
 * directly into Zélla's Cognitive Memory and Sales Brain:
 * 
 * - Camada 0: Perímetro Adaptativo (WAF, Token Bucket, Geo-blocking)
 * - Camada 1: Isolamento Multi-Tenant Militarizado (PostgreSQL RLS + Prisma)
 * - Camada 2: Blindagem de IA (ZDR 2.0 - Local PII Scanner & Guardrails)
 * - Camada 3: Bunker Financeiro (HMAC PIX, Anti-Double Spend, WORM Audit)
 * - Camada 4: Canal de Comunicação Blindado (WhatsApp Webhook HMAC & Session Vault)
 * - Camada 5: Infraestrutura e Criptografia (AES-256-GCM + AWS KMS + mTLS)
 * - Agentes Ativos: Guardião 2.0, Honeypot Canary, Threat Hunter (Llama Local), Circuit Breaker
 */

export interface ZehlaSecurityKnowledgeItem {
  layer: string;
  topic: string;
  keywords: string[];
  summary: string;
  technicalDetails: string;
}

export const ZEHLA_FORTRESS_KNOWLEDGE: ZehlaSecurityKnowledgeItem[] = [
  {
    layer: 'Camada 0 - Perímetro Adaptativo',
    topic: 'WAF & Proteção Anti-DDoS',
    keywords: ['waf', 'ddos', 'firewall', 'ataque', 'cloudflare', 'rate limit', 'bloqueio'],
    summary: 'O ZEHLA utiliza WAF inteligente e Rate Limiting por tenant no Redis para bloquear SQLi, XSS e requisições anômalas antes que alcancem o servidor.',
    technicalDetails: 'Cloudflare Enterprise + AWS WAF + Redis Token Bucket. Geo-blocking dinâmico bloqueia acessos fora da região do tenant.',
  },
  {
    layer: 'Camada 1 - Isolamento Multi-Tenant',
    topic: 'Isolamento de Dados de Pousadas e Anfitriões (RLS)',
    keywords: ['multitenant', 'multi-tenant', 'isolamento', 'dados de outros', 'vazar dados', 'tenant', 'rls', 'privacidade'],
    summary: 'Os dados de cada pousada ou anfitrião são 100% isolados por Row-Level Security (RLS) no PostgreSQL e verificação de tenant via JWT. É impossível uma pousada ver os dados de outra.',
    technicalDetails: 'PostgreSQL RLS em 100% das tabelas + Prisma middleware de tenant resolution + JWT scoped. Eliminação completa de vulnerabilidades IDOR.',
  },
  {
    layer: 'Camada 2 - Blindagem de IA (ZDR 2.0)',
    topic: 'Proteção de Mensagens e Anonimização de PII',
    keywords: ['zdr', 'pii', 'cpf', 'anonimização', 'dados pessoais', 'lgpd', 'vazamento ia', 'gpt', 'llm'],
    summary: 'O ZDR 2.0 (Zehla Data Registry) executa um scanner local de PII antes de qualquer mensagem ser processada por IA. CPFs, cartões e nomes são substituídos por tokens irreversíveis.',
    technicalDetails: 'spaCy/Regex local sem chamadas externas. Prompt Sanitizer bloqueia prompt injections. Output Validator garante zero exfiltração.',
  },
  {
    layer: 'Camada 3 - Bunker Financeiro',
    topic: 'Segurança PIX e Conciliação Bancária',
    keywords: ['pix', 'banco', 'financeiro', 'fraude', 'comprovante', 'segurança pix', 'bacen', 'pago'],
    summary: 'O recebimento via PIX utiliza validação HMAC-SHA256, proteção anti-double spend e chave PIX criptografada em nível bancário.',
    technicalDetails: 'End-to-End ID único previne pagamentos duplicados. Registros WORM (append-only) garantem auditoria imutável.',
  },
  {
    layer: 'Camada 4 - Canal de Comunicação',
    topic: 'Segurança do WhatsApp e Webhooks Meta',
    keywords: ['whatsapp', 'webhook', 'meta', 'clonagem', 'qr code', 'hackear whatsapp'],
    summary: 'Toda integração com o WhatsApp exige validação da assinatura HMAC X-Hub-Signature-256 da Meta e rotação diária de tokens de sessão.',
    technicalDetails: 'QR Codes de pareamento expiram em 60s. Sandbox de contatos avalia score de confiança antes de permitir ações em reservas.',
  },
  {
    layer: 'Camada 5 - Criptografia & Infraestrutura',
    topic: 'Criptografia de Dados AES-256 & AWS KMS',
    keywords: ['criptografia', 'aes-256', 'kms', 'banco de dados', 'segurança dos dados', 'servidor'],
    summary: 'Todos os dados em repouso são criptografados com AES-256 no PostgreSQL com chaves de criptografia gerenciadas via AWS KMS.',
    technicalDetails: 'TLS 1.3 obrigatório no trânsito externo e mTLS entre microsserviços. Secrets em Vault com rotação a cada 90 dias.',
  },
  {
    layer: 'Agentes de Defesa Ativa',
    topic: 'Guardião 2.0 & Threat Hunter (Frota de IA)',
    keywords: ['guardião', 'guardiao', 'threat hunter', 'honeypot', 'circuit breaker', 'defesa ativa'],
    summary: 'Uma frota autônoma de 4 agentes de segurança (Guardião, Honeypot, Threat Hunter e Circuit Breaker) monitora transações em tempo real e bloqueia ataques em menos de 5ms.',
    technicalDetails: 'Guardião 2.0 em Go/Rust intervém em < 5ms. Threat Hunter roda Llama 3.3 local para caçar anomalias. Circuit Breaker responde a incidentes em < 10s.',
  },
];

export class ZehlaFortressBrain {
  /**
   * Procura no banco de conhecimento do Zehla Fortress por tópicos relevantes
   */
  static searchKnowledge(query: string): ZehlaSecurityKnowledgeItem | null {
    const lower = query.toLowerCase();
    
    for (const item of ZEHLA_FORTRESS_KNOWLEDGE) {
      if (item.keywords.some((kw) => lower.includes(kw))) {
        return item;
      }
    }
    return null;
  }

  /**
   * Sanitiza a mensagem do usuário via ZDR 2.0 substituindo padrões de PII por tokens
   */
  static zdrSanitizeInput(text: string): { sanitizedText: string; hasPII: boolean } {
    let sanitizedText = text;
    let hasPII = false;

    // Pattern CPF: xxx.xxx.xxx-xx ou xxxxxxxxxxx
    const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
    if (cpfRegex.test(sanitizedText)) {
      hasPII = true;
      sanitizedText = sanitizedText.replace(cpfRegex, '[CPF_PROTEGIDO_ZDR]');
    }

    // Pattern Email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    if (emailRegex.test(sanitizedText)) {
      hasPII = true;
      sanitizedText = sanitizedText.replace(emailRegex, '[EMAIL_PROTEGIDO_ZDR]');
    }

    // Pattern Cartão de Crédito (16 dígitos)
    const cardRegex = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g;
    if (cardRegex.test(sanitizedText)) {
      hasPII = true;
      sanitizedText = sanitizedText.replace(cardRegex, '[CARTAO_PROTEGIDO_ZDR]');
    }

    return { sanitizedText, hasPII };
  }
}

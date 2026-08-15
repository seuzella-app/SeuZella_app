// ═══════════════════════════════════════════════════════════════
// CLOSING NOTIFICATION PROMPT — ZÉLLA AIRB
// Módulo de fechamento de reserva + notificação do anfitrião
// ═══════════════════════════════════════════════════════════════
//
// Instruções do sistema para o agente IA detectar intenção de
// reserva, coletar dados, formatar notificação WhatsApp e
// escalar quando necessário.
// ═══════════════════════════════════════════════════════════════

import type { PlatformContext } from './gatekeeper';

// ── Types ──────────────────────────────────────────────────────

export type NotificationType =
  | 'RESERVATION_CLOSED'
  | 'RESERVATION_PENDING_PAYMENT'
  | 'RESERVATION_NEGOTIATED'
  | 'ESCALATION_REQUESTED';

export type ClosingConversationStage =
  | 'exploring' // Hóspede ainda pesquisando, sem intenção clara
  | 'interested' // Demonstrou interesse mas não confirmou
  | 'closing' // Sinal claro de intenção de reserva
  | 'collecting_data' // Coletando dados da reserva
  | 'finalizing' // Dados coletados, aguardando confirmação final
  | 'closed'; // Reserva fechada, notificação enviada

export interface ClosingIntentSignal {
  /** Frase ou expressão em português que sinaliza intenção de reserva */
  phrase: string;
  /** Peso de confiança: 0.0 (fraco) a 1.0 (forte) */
  confidence: number;
  /** Se true, a frase indica confirmação direta (o "sim" do hóspede) */
  isDirectConfirmation: boolean;
  /** Categoria do sinal para agrupamento */
  category: 'explicit' | 'strong' | 'moderate' | 'soft';
}

export interface ReservationDetails {
  /** Data de check-in (formato livre, como o hóspede falou) */
  checkInDate: string | null;
  /** Data de check-out (formato livre) */
  checkOutDate: string | null;
  /** Número de hóspedes */
  guestCount: number | null;
  /** Método de pagamento mencionado */
  paymentMethod: 'pix' | 'airbnb_platform' | 'card' | 'other' | null;
  /** Se houve negociação de preço */
  priceNegotiated: boolean;
  /** Valor acordado (se negociado), em centavos */
  agreedPriceCents: number | null;
  /** Pedidos especiais do hóspede */
  specialRequests: string[];
  /** Nome do hóspede (se identificado na conversa) */
  guestName: string | null;
}

export interface ClosingNotificationParams {
  /** Nome da propriedade */
  propertyName: string;
  /** Primeiro nome do anfitrião */
  hostFirstName: string;
  /** Contexto da plataforma (airbnb_app, whatsapp, direct, etc.) */
  platformContext: PlatformContext;
  /** Modo da conversa */
  conversationMode: 'pre_booking' | 'post_booking';
  /** Número máximo de hóspedes da propriedade */
  maxGuests: number;
  /** Horário de check-in */
  checkinTime: string;
  /** Horário de check-out */
  checkoutTime: string;
  /** Preço base por noite em centavos (se disponível) */
  basePricePerNightCents: number | null;
  /** WhatsApp do anfitrião para notificação */
  hostWhatsApp: string | null;
  /** Se a propriedade aceita PIX */
  acceptsPix: boolean;
  /** Chave PIX (apenas se platformContext permitir) */
  pixKey: string | null;
  /** Número de telefone do hóspede (se disponível) */
  guestPhone: string | null;
}

// ── Closing Intent Signals ─────────────────────────────────────
//
// Frases em português que indicam intenção de reserva,
// classificadas por força do sinal e peso de confiança.
// ═══════════════════════════════════════════════════════════════

export const CLOSING_INTENT_SIGNALS: ClosingIntentSignal[] = [
  // ── EXPLICIT: Confirmação direta e inequívoca ──────────────
  { phrase: 'quero reservar', confidence: 0.97, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'pode garantir', confidence: 0.96, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'fechou', confidence: 0.95, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'vou querer', confidence: 0.94, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'pode fechar', confidence: 0.96, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'confirmo a reserva', confidence: 0.98, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'quero fechar', confidence: 0.96, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'vamos fechar', confidence: 0.95, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'pode reservar pra mim', confidence: 0.97, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'garante pra mim', confidence: 0.95, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'estou fechando', confidence: 0.94, isDirectConfirmation: true, category: 'explicit' },
  { phrase: 'já pode reservar', confidence: 0.97, isDirectConfirmation: true, category: 'explicit' },

  // ── STRONG: Intenção clara mas sem confirmação direta ──────
  { phrase: 'como faço pra reservar', confidence: 0.88, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'quero fazer a reserva', confidence: 0.90, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'como funciona pra reservar', confidence: 0.85, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'qual o passo a passo pra reservar', confidence: 0.86, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'me passa o valor pra eu reservar', confidence: 0.89, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'tô querendo reservar', confidence: 0.87, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'quero garantir minhas datas', confidence: 0.88, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'pode me passar as formas de pagamento', confidence: 0.82, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'como faço o pagamento', confidence: 0.84, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'qual o valor total pra reservar', confidence: 0.86, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'aceita pix', confidence: 0.83, isDirectConfirmation: false, category: 'strong' },
  { phrase: 'pode mandar a chave pix', confidence: 0.91, isDirectConfirmation: false, category: 'strong' },

  // ── MODERATE: Interesse manifesto, pode evoluir ────────────
  { phrase: 'to interessado', confidence: 0.70, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'tô interessada', confidence: 0.70, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'gostei muito', confidence: 0.65, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'é isso que eu quero', confidence: 0.72, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'perfeito pra mim', confidence: 0.68, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'atende o que eu preciso', confidence: 0.66, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'quero saber o valor', confidence: 0.72, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'qual o preço', confidence: 0.70, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'tem vaga', confidence: 0.60, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'tem disponibilidade', confidence: 0.62, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'está disponível', confidence: 0.63, isDirectConfirmation: false, category: 'moderate' },
  { phrase: 'quanto fica', confidence: 0.68, isDirectConfirmation: false, category: 'moderate' },

  // ── SOFT: Sinal fraco, monitorar ───────────────────────────
  { phrase: 'estou olhando', confidence: 0.40, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'estou pesquisando', confidence: 0.35, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'qual a localização', confidence: 0.30, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'como é o local', confidence: 0.32, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'me conta mais', confidence: 0.38, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'quero saber mais', confidence: 0.40, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'pode mandar fotos', confidence: 0.35, isDirectConfirmation: false, category: 'soft' },
  { phrase: 'tem mais fotos', confidence: 0.33, isDirectConfirmation: false, category: 'soft' },
];

// ── Notification Templates ─────────────────────────────────────
//
// Templates de notificação WhatsApp para o anfitrião.
// Variáveis entre {{chaves}} são substituídas em runtime.
// ═══════════════════════════════════════════════════════════════

export const NOTIFICATION_TEMPLATES: Record<NotificationType, string> = {
  // ── RESERVATION_CLOSED: Reserva confirmada com todos os dados ──
  RESERVATION_CLOSED: `🏠 *NOVA RESERVA FECHADA!*

📋 *Propriedade:* {{propertyName}}
👤 *Hóspede:* {{guestName}}

📅 *Check-in:* {{checkInDate}} a partir das {{checkinTime}}
📅 *Check-out:* {{checkOutDate}} até às {{checkoutTime}}
👥 *Hóspedes:* {{guestCount}} pessoa(s)

💰 *Valor acordado:* {{agreedPrice}}
💳 *Pagamento:* {{paymentMethod}}

{{specialRequestsBlock}}
✅ _Reserva confirmada pelo agente IA_`,

  // ── RESERVATION_PENDING_PAYMENT: Aguardando PIX ──────────────
  RESERVATION_PENDING_PAYMENT: `🏠 *RESERVA — AGUARDANDO PIX*

📋 *Propriedade:* {{propertyName}}
👤 *Hóspede:* {{guestName}}

📅 *Check-in:* {{checkInDate}} a partir das {{checkinTime}}
📅 *Check-out:* {{checkOutDate}} até às {{checkoutTime}}
👥 *Hóspedes:* {{guestCount}} pessoa(s)

💰 *Valor:* {{agreedPrice}}
🔑 *Chave PIX:* {{pixKey}}
📱 *Telefone hóspede:* {{guestPhone}}

{{specialRequestsBlock}}
⏳ _Aguardando comprovante de pagamento_`,

  // ── RESERVATION_NEGOTIATED: Preço foi negociado ──────────────
  RESERVATION_NEGOTIATED: `🏠 *RESERVA COM NEGOCIAÇÃO*

📋 *Propriedade:* {{propertyName}}
👤 *Hóspede:* {{guestName}}

📅 *Check-in:* {{checkInDate}} a partir das {{checkinTime}}
📅 *Check-out:* {{checkOutDate}} até às {{checkoutTime}}
👥 *Hóspedes:* {{guestCount}} pessoa(s)

💰 *Valor original:* {{originalPrice}}
💰 *Valor negociado:* {{agreedPrice}}
📉 *Desconto:* {{discountPercent}}%
💳 *Pagamento:* {{paymentMethod}}

{{specialRequestsBlock}}
⚠️ _Preço negociado — confirme se aprova_`,

  // ── ESCALATION_REQUESTED: Hóspede precisa de atenção humana ──
  ESCALATION_REQUESTED: `🚨 *ESCALAÇÃO NECESSÁRIA*

📋 *Propriedade:* {{propertyName}}
👤 *Hóspede:* {{guestName}}
📱 *Telefone:* {{guestPhone}}

❗ *Motivo:* {{escalationReason}}

📝 *Resumo da conversa:*
{{conversationSummary}}

⚡ _O hóspede precisa de atenção humana_`,
};

// ── Helper: Special requests block ────────────────────────────

function buildSpecialRequestsBlock(requests: string[]): string {
  if (requests.length === 0) return '';
  const items = requests.map(r => `  • ${r}`).join('\n');
  return `📝 *Pedidos especiais:*\n${items}`;
}

// ── Helper: PIX gate for closing context ──────────────────────

function buildClosingPixGate(context: PlatformContext, acceptsPix: boolean): string {
  if (!acceptsPix) {
    return `⛔ Esta propriedade NÃO aceita PIX. Não ofereça pagamento via PIX em nenhuma circunstância.
Direcione o hóspede para a plataforma de reserva ou outro método informado pelo anfitrião.`;
  }

  if (context === 'airbnb_app' || context === 'airbnb_web') {
    return `⛔ PROIBIDO oferecer PIX neste contexto.
O hóspede veio pelo Airbnb — a reserva DEVE ser feita pela plataforma.
NUNCA mencione PIX, chave PIX, QR Code, pagamento direto ou transferência.
Se o hóspede perguntar sobre pagamento, diga: "A reserva é feita direto aqui pelo Airbnb, super prático!"
VIOLAÇÃO DOS TERMOS DO AIRBNB — pode resultar em suspensão da conta do anfitrião.`;
  }

  if (context === 'whatsapp' || context === 'direct') {
    return `✅ PERMITIDO oferecer pagamento via PIX neste contexto.
O hóspede está em contato direto — você pode:
  • Informar o valor total da reserva
  • Enviar a chave PIX quando o hóspede confirmar
  • Confirmar recebimento e fechar a reserva
NUNCA envie a chave PIX antes da confirmação de intenção do hóspede.`;
  }

  return `⚠️ Contexto incerto — NÃO ofereça PIX.
Diga que vai verificar as opções de pagamento e encaminhe para o anfitrião.`;
}

// ── Main Prompt Builder ────────────────────────────────────────

export function buildClosingNotificationPrompt(params: ClosingNotificationParams): string {
  const pixGate = buildClosingPixGate(params.platformContext, params.acceptsPix);
  const isAirbnb = params.platformContext === 'airbnb_app' || params.platformContext === 'airbnb_web';
  const isDirectBooking = params.platformContext === 'whatsapp' || params.platformContext === 'direct';

  return `# SYSTEM PROMPT — MÓDULO DE FECHAMENTO E NOTIFICAÇÃO
# Versão: 1.0.0 | Módulo: Zélla AirB — Closing Notification
# INSTRUÇÕES PARA O AGENTE IA

## SEU PAPEL NESTE MÓDULO

Você é o(a) **anfitrião(a)** do imóvel "${params.propertyName}" atuando em modo
de FECHAMENTO DE RESERVA. Seu objetivo é detectar quando o hóspede está pronto
para reservar, coletar todos os dados necessários e gerar a notificação
estruturada para o anfitrião real.

Você continua sendo o(a) dono(a) da propriedade — NÃO é um bot, NÃO é um
atendente de call center. Mantenha o tom acolhedor e humano em TODA interação.

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 1: QUANDO DISPARAR A NOTIFICAÇÃO DE FECHAMENTO
## ═══════════════════════════════════════════════════════════════

### 1.1 — Sinais de Intenção de Reserva

Você deve monitorar a conversa em busca de sinais de intenção. Os sinais são
classificados em 4 categorias:

| Categoria  | Confiança | Ação                                      |
|-----------|-----------|-------------------------------------------|
| EXPLICIT  | 0.93–1.00 | Iniciar coleta de dados IMEDIATAMENTE     |
| STRONG    | 0.80–0.92 | Confirmar intenção + iniciar coleta       |
| MODERATE  | 0.55–0.79 | Reforçar diferenciais + sondar intenção   |
| SOFT      | 0.30–0.54 | Continuar atendimento normal, monitorar   |

### 1.2 — O Momento do "Sim" (Confirmação)

O fechamento só deve ser disparado quando:
- O hóspede usar frase EXPLICIT de confirmação, OU
- O hóspede responder positivamente à sua pergunta de fechamento

Exemplos de perguntas de fechamento que você PODE fazer:
  "Quer que eu garanta essas datas pra você?"
  "Posso fechar a reserva pra essas datas?"
  "Vou reservar pra você, pode ser?"

Se o hóspede responder "sim", "isso", "isso aí", "exato", "pode ser",
"com certeza", "bora" — isso conta como confirmação.

### 1.3 — Quando NÃO disparar notificação

NÃO dispare notificação se:
- O hóspede apenas pediu informação de preço (sem confirmar intenção)
- O hóspede disse que vai "pensar" ou "ver com a família"
- O hóspede está comparando com outras propriedades
- O hóspede pediu orçamento mas não confirmou datas
- A conversa está em modo POST_BOOKING (hóspede já reservou)

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 2: O QUE COLETAR ANTES DE NOTIFICAR
## ═══════════════════════════════════════════════════════════════

### 2.1 — Dados Obrigatórios (sem eles, NÃO notifique)

Antes de gerar a notificação, você DEVE ter coletado:

1. **Data de check-in** — Pergunte: "Qual a data que você quer chegar?"
2. **Data de check-out** — Pergunte: "E até quando você vai ficar?"
3. **Número de hóspedes** — Pergunte: "Vai ser quantas pessoas no total?"
   - Valide contra o máximo de ${params.maxGuests} hóspedes da propriedade
   - Se exceder: "Ah, a capacidade máxima daqui é ${params.maxGuests} pessoas.
     Mas podemos ver se funciona pra vocês!"
4. **Método de pagamento** — Varia por plataforma (ver Seção 4)

### 2.2 — Dados Opcionais (colete se surgir naturalmente)

- Nome do hóspede (se ele se apresentar)
- Telefone/contato (se ele fornecer)
- Pedidos especiais (cama extra, chegada tardia, etc.)
- Motivo da viagem (lazer, trabalho, família)

### 2.3 — Estratégia de Coleta

NÃO faça um interrogatório. Colete os dados de forma natural:

❌ ERRADO: "Preciso das seguintes informações: data de check-in, data de
check-out, número de hóspedes e forma de pagamento."

✅ CORRETO: "Que legal! Pra eu garantir pra você, qual a data que você
tá planejando chegar? 😊" [depois: "E até quando você vai ficar com a gente?"]

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 3: COMO FORMATAR A NOTIFICAÇÃO
## ═══════════════════════════════════════════════════════════════

### 3.1 — Payload Estruturado

Quando todos os dados obrigatórios forem coletados, gere um JSON interno
com este formato EXATO (não envie ao hóspede — isto é interno do sistema):

\`\`\`json
{
  "type": "TIPO_DA_NOTIFICACAO",
  "property": "${params.propertyName}",
  "guest": {
    "name": "nome ou null",
    "phone": "telefone ou null"
  },
  "reservation": {
    "checkIn": "data check-in",
    "checkOut": "data check-out",
    "guestCount": número,
    "specialRequests": []
  },
  "payment": {
    "method": "pix|airbnb_platform|card|other|null",
    "priceNegotiated": false,
    "agreedPriceCents": null,
    "basePriceCents": ${params.basePricePerNightCents ?? 'null'}
  },
  "metadata": {
    "platformContext": "${params.platformContext}",
    "conversationMode": "${params.conversationMode}",
    "closedAt": "ISO timestamp"
  }
}
\`\`\`

### 3.2 — Tipos de Notificação

Escolha o tipo correto:

- **RESERVATION_CLOSED** — Reserva confirmada com pagamento resolvido
  (${isAirbnb ? 'Airbnb: reserva feita pela plataforma' : 'Direto/WhatsApp: pagamento confirmado ou combinado'})

- **RESERVATION_PENDING_PAYMENT** — Reserva combinada mas aguardando PIX
  (APENAS em contexto WhatsApp/direct com PIX habilitado)

- **RESERVATION_NEGOTIATED** — Preço foi negociado (desconto oferecido)
  (anfitrião precisa aprovar — sempre gere este tipo quando houver desconto)

- **ESCALATION_REQUESTED** — Hóspede precisa de atenção humana
  (ver Seção 5 para critérios de escalação)

### 3.3 — Mensagem WhatsApp para o Anfitrião

Após gerar o payload interno, formate a notificação WhatsApp usando o
template correspondente. Substitua todas as variáveis {{chave}}.

Regras de formatação:
- Use emojis com moderação (só os do template)
- Mantenha hierarquia visual clara
- Nunca inclua dados sensíveis do hóspede além do necessário
- Se não tiver um dado, coloque "não informado"

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 4: REGRA PIX GATE (CRÍTICO)
## ═══════════════════════════════════════════════════════════════

${pixGate}

### Regras Adicionais de Pagamento

${isAirbnb ? `Contexto Airbnb — o hóspede DEVE reservar pela plataforma:
- Diga: "É só clicar em Reservar aqui no Airbnb, super fácil!"
- NÃO ofereça alternativas de pagamento
- NÃO mencione que pagamento direto seria mais barato
- Se o hóspede insistir em pagar fora: "Ah, pelo Airbnb é mais seguro
  pra você também, tem a garantia e tudo! 😊"` : ''}

${isDirectBooking && params.acceptsPix ? `Contexto direto com PIX habilitado:
- Só envie a chave PIX DEPOIS que o hóspede confirmar a reserva
- Informe o valor total ANTES de enviar a chave
- Chave PIX disponível: ${params.pixKey || 'a ser fornecida pelo anfitrião'}
- Após pagamento, confirme: "Recebi! Tudo certo, sua reserva tá garantida! ✅"` : ''}

${isDirectBooking && !params.acceptsPix ? `Contexto direto SEM PIX:
- Informe que o anfitrião entrará em contato para combinar pagamento
- NÃO prometa métodos de pagamento que não foram confirmados` : ''}

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 5: QUANDO ESCALAR EM VEZ DE FECHAR
## ═══════════════════════════════════════════════════════════════

Escale (use [ESCALATE: motivo]) em QUALQUER destas situações:

### 5.1 — Escalação Obrigatória (NUNCA tente resolver sozinho)

- **Política de reembolso**: Hóspede pedindo garantia de reembolso
  → [ESCALATE: reembolso_solicitado]
- **Reclamação séria**: Hóspede insatisfeito com algo que você não pode resolver
  → [ESCALATE: reclamacao_hospede]
- **Acessibilidade**: Hóspede com necessidades que a propriedade pode não atender
  (cadeirante, mobilidade reduzida, etc.)
  → [ESCALATE: acessibilidade_necessaria]
- **Problema legal**: Hóspede mencionando processos, direitos do consumidor, Procon
  → [ESCALATE: questao_legal]
- **Pagamento disputado**: Hóspede contestando valor cobrado
  → [ESCALATE: disputa_pagamento]
- **Grupo grande**: Mais de ${params.maxGuests} hóspedes querendo reservar
  → [ESCALATE: capacidade_excedida]

### 5.2 — Escalação Recomendada (tente resolver, escale se não conseguir)

- **Negociação de preço acima de 15%**: Se o hóspede pedir desconto maior que 15%
  → Tente negociar. Se não aceitar, escale: [ESCALATE: negociacao_preco]
- **Pedido especial complexo**: Algo que foge do padrão (evento, animal exótico, etc.)
  → Tente acomodar. Se incerto, escale: [ESCALATE: pedido_especial]
- **Hóspede hesitante após coleta**: Se coletou todos os dados mas o hóspede
  não confirma depois de 2 tentativas de fechamento
  → Escale: [ESCALATE: hospede_hesitante]

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 6: CASOS ESPECIAIS
## ═══════════════════════════════════════════════════════════════

### 6.1 — Confirmação Parcial

Se o hóspede confirmou intenção mas falta algum dado obrigatório:
- NÃO envie notificação ainda
- Continue a conversa naturalmente coletando o que falta
- Exemplo: hóspede disse "quero reservar" mas não informou datas
  → "Que massa! Qual data você tá planejando, consegue me passar? 😊"
- Se após 3 mensagens não conseguir o dado, escale:
  [ESCALATE: dados_incompletos_fechamento]

### 6.2 — Negociação de Preço

Se o hóspede pedir desconto:
- Até 10%: Pode oferecer se tiver margem (diga "vou fazer um valor especial
  pra você")
- 10–15%: Tente negociar com contra-oferta
- Acima de 15%: Escale para o anfitrião decidir
- NUNCA ofereça desconto sem contexto — só se o hóspede pedir ou se for
  estratégico para fechar (ex: estadia longa)

Quando houver negociação, use o tipo RESERVATION_NEGOTIATED e preencha
tanto o valor original quanto o valor negociado no payload.

### 6.3 — Pedidos Especiais

Se o hóspede fizer pedidos especiais:
- Cama extra, berço, travesseiro extra → Anote e inclua no payload
- Chegada tardia (após ${params.checkinTime}) → Anote, geralmente ok
- Saída tardia (após ${params.checkoutTime}) → Anote, pode ter taxa
- Festa/evento → Escale IMEDIATAMENTE: [ESCALATE: evento_festa_solicitado]
- Pet → Verifique regras da casa; se permitir, anote o tipo/porte

### 6.4 — Hóspede Hesitante

Se o hóspede demonstrar interesse mas não confirmar:
- Reforce diferenciais da propriedade (localização, comodidades, avaliações)
- Crie urgência suave: "Essas datas támando bastante procura viu!"
- Ofereça ajuda: "Posso te ajudar com alguma dúvida ainda?"
- NUNCA pressione demais — se after 2 tentativas não confirmar, respeite
  e continue atendimento normal

### 6.5 — Múltiplas Propriedades

Se o hóspede mencionar estar vendo outras propriedades:
- NÃO denigra a concorrência
- Reforce os diferenciais da ${params.propertyName}
- Ofereça algo único se possível ("aqui a gente tem X que é diferenciado")
- Não ofereça desconto só por competição — escale se necessário

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 7: CHECKLIST FINAL ANTES DE NOTIFICAR
## ═══════════════════════════════════════════════════════════════

Antes de gerar a notificação, verifique:

☐ Intenção de reserva confirmada (sinal EXPLICIT ou "sim" do hóspede)
☐ Data de check-in coletada
☐ Data de check-out coletada
☐ Número de hóspedes coletado (≤ ${params.maxGuests})
☐ Método de pagamento alinhado com PIX GATE
☐ Nenhuma condição de escalação pendente
☐ Tipo de notificação correto selecionado

Se todos os itens estiverem OK, gere o payload e a mensagem WhatsApp.

Depois de notificar, diga ao hóspede algo como:
${isAirbnb ? '"Perfeito! É só confirmar a reserva aqui pelo Airbnb e pronto! Qualquer dúvida, tô aqui! 😊"' : '"Perfeito! Vou repassar pro anfitrião confirmar tudo e te aviso rapidinho! 😊"'}

## ═══════════════════════════════════════════════════════════════
## SEÇÃO 8: DADOS DA PROPRIEDADE
## ═══════════════════════════════════════════════════════════════

- **Propriedade**: ${params.propertyName}
- **Capacidade máxima**: ${params.maxGuests} hóspedes
- **Check-in**: A partir das ${params.checkinTime}
- **Check-out**: Até às ${params.checkoutTime}
- **Anfitrião**: ${params.hostFirstName}
${params.basePricePerNightCents ? `- **Preço base/noite**: R$ ${(params.basePricePerNightCents / 100).toFixed(2).replace('.', ',')}` : '- **Preço base**: Consulte o anfitrião'}
- **Aceita PIX**: ${params.acceptsPix ? 'Sim' : 'Não'}
- **Contexto**: ${params.platformContext}`;
}

// ── Utility: Evaluate closing intent from message ──────────────

export interface ClosingIntentEvaluation {
  /** Maior confiança detectada entre os sinais */
  maxConfidence: number;
  /** Categoria do sinal mais forte detectado */
  strongestCategory: ClosingIntentSignal['category'] | null;
  /** Se algum sinal é confirmação direta */
  hasDirectConfirmation: boolean;
  /** Estágio sugerido da conversa */
  suggestedStage: ClosingConversationStage;
  /** Sinais que foram detectados */
  matchedSignals: ClosingIntentSignal[];
}

/**
 * Avalia uma mensagem do hóspede contra os sinais de intenção de fechamento.
 * Usa normalização de acentos e busca por substring para flexibilidade.
 */
export function evaluateClosingIntent(message: string): ClosingIntentEvaluation {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const matched: ClosingIntentSignal[] = [];

  for (const signal of CLOSING_INTENT_SIGNALS) {
    const normalizedPhrase = signal.phrase
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes(normalizedPhrase)) {
      matched.push(signal);
    }
  }

  if (matched.length === 0) {
    return {
      maxConfidence: 0,
      strongestCategory: null,
      hasDirectConfirmation: false,
      suggestedStage: 'exploring',
      matchedSignals: [],
    };
  }

  const maxConfidence = Math.max(...matched.map(m => m.confidence));
  const hasDirectConfirmation = matched.some(m => m.isDirectConfirmation);
  const strongestCategory = matched.reduce<ClosingIntentSignal['category']>((strongest, current) =>
    current.confidence > (matched.find(m => m.category === strongest)?.confidence ?? 0)
      ? current.category
      : strongest
  , matched[0].category);

  let suggestedStage: ClosingConversationStage;
  if (hasDirectConfirmation) {
    suggestedStage = 'closing';
  } else if (maxConfidence >= 0.80) {
    suggestedStage = 'interested';
  } else if (maxConfidence >= 0.55) {
    suggestedStage = 'interested';
  } else {
    suggestedStage = 'exploring';
  }

  return {
    maxConfidence,
    strongestCategory,
    hasDirectConfirmation,
    suggestedStage,
    matchedSignals: matched,
  };
}

// ── Utility: Format notification from template + data ──────────

export interface NotificationFormatData {
  propertyName: string;
  guestName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  checkinTime: string;
  checkoutTime: string;
  guestCount: number | null;
  agreedPrice: string;
  originalPrice?: string;
  discountPercent?: string;
  paymentMethod: string;
  pixKey?: string;
  guestPhone?: string;
  specialRequests: string[];
  escalationReason?: string;
  conversationSummary?: string;
}

/**
 * Formata uma notificação WhatsApp a partir do template e dos dados fornecidos.
 * Substitui todas as variáveis {{chave}} pelos valores correspondentes.
 */
export function formatNotification(
  type: NotificationType,
  data: NotificationFormatData
): string {
  let template = NOTIFICATION_TEMPLATES[type];

  const specialRequestsBlock = buildSpecialRequestsBlock(data.specialRequests);

  const replacements: Record<string, string> = {
    propertyName: data.propertyName,
    guestName: data.guestName || 'Não informado',
    checkInDate: data.checkInDate || 'Não informado',
    checkOutDate: data.checkOutDate || 'Não informado',
    checkinTime: data.checkinTime,
    checkoutTime: data.checkoutTime,
    guestCount: String(data.guestCount ?? '?'),
    agreedPrice: data.agreedPrice,
    originalPrice: data.originalPrice || '',
    discountPercent: data.discountPercent || '',
    paymentMethod: data.paymentMethod,
    pixKey: data.pixKey || '',
    guestPhone: data.guestPhone || '',
    specialRequestsBlock,
    escalationReason: data.escalationReason || '',
    conversationSummary: data.conversationSummary || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Clean up empty blocks (lines with only empty variables remaining)
  template = template
    .split('\n')
    .filter(line => {
      // Remove lines that are just empty variable markers
      const cleaned = line.replace(/\{\{[^}]+\}\}/g, '').trim();
      return cleaned.length > 0 || line.trim().length === 0;
    })
    .join('\n')
    .trim();

  return template;
}

// ── Utility: Build reservation details from conversation ───────

/**
 * Cria um objeto ReservationDetails vazio para preencher durante a conversa.
 */
export function createEmptyReservationDetails(): ReservationDetails {
  return {
    checkInDate: null,
    checkOutDate: null,
    guestCount: null,
    paymentMethod: null,
    priceNegotiated: false,
    agreedPriceCents: null,
    specialRequests: [],
    guestName: null,
  };
}

/**
 * Valida se os detalhes da reserva têm todos os campos obrigatórios preenchidos.
 */
export function validateReservationDetails(
  details: ReservationDetails
): { complete: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!details.checkInDate) missing.push('data de check-in');
  if (!details.checkOutDate) missing.push('data de check-out');
  if (!details.guestCount) missing.push('número de hóspedes');
  if (!details.paymentMethod) missing.push('método de pagamento');

  return {
    complete: missing.length === 0,
    missing,
  };
}

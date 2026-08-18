/**
 * ConversationLearner — O cérebro que APRENDE de verdade
 *
 * Inspirado no padrão Recognize → Capture → Reuse do repositório
 * kulaxyz/self-learning-skills + padrões de online-learning do awesome-machine-learning.
 *
 * v2.0 — Melhorias reais:
 * 1. ANALISA conversas resolvidas e extrai padrões Q&A reais
 * 2. ARMAZENA como KnowledgeEntry (category='auto_learned') com confiança inicial
 * 3. ATUALIZA effectiveness com base em outcomes de conversas futuras
 * 4. PROMOVE padrões verificados (Promotion Rule: 3+ usos bem-sucedidos)
 * 5. CAPTURA "o que não funcionou" → Anti-padrões (Negative Knowledge Capture)
 * 6. SENTIMENT-WEIGHTED FEEDBACK — pondera confiança pelo sentimento do hóspede
 * 7. CONFIDENCE DECAY — decai confiança de padrões não usados recentemente
 * 8. ANTI-PATTERN INJECTION — injeta "o que NÃO fazer" no system prompt
 *
 * Regra de Promoção (adaptada do self-learning-skills):
 * - confidence >= 0.8 E timesUsed >= 3 E timesSuccessful >= 2 → verified
 * - confidence < 0.4 E timesUsed >= 3 → desativado (padrão falho)
 *
 * Confidence Decay (inspirado em online-learning / River):
 * - Padrões sem uso há 30+ dias: decay de -0.02/dia até mínimo de 0.3
 * - Padrões usados nas últimas 24h: boost de recência +0.05
 */

import { db } from '@/lib/db';
import { SemanticaClient } from '@/lib/semantica/client';
import { checkAndOptimizePrompts } from '@/lib/ml/brain-health-optimizer';
import { logSink } from '@/lib/cerebro/log-sink';

// ── Tipos ───────────────────────────────────────────────────────────

interface ExtractedPattern {
  question: string;
  answer: string;
  category: string;
  sourceConversationId: string;
  confidence: number;
}

interface LearningResult {
  patternsExtracted: number;
  patternsSkipped: number;
  patternsPromoted: number;
  patternsDeprecated: number;
  details: string[];
}

// ── Constantes ───────────────────────────────────────────────────────

const MIN_CONVERSATION_MESSAGES = 3; // Mínimo de trocas para analisar
const MAX_PATTERNS_PER_RUN = 5;     // Limite de extração por conversa
const PROMOTION_SUCCESS_THRESHOLD = 0.8;
const PROMOTION_MIN_USES = 3;
const PROMOTION_MIN_SUCCESSFUL = 2;
const DEPRECATION_CONFIDENCE = 0.4;
const DEPRECATION_MIN_USES = 3;
const INITIAL_CONFIDENCE = 0.5;
const CONFIDENCE_BOOST = 0.1;
const CONFIDENCE_PENALTY = 0.15;
const EFFECTIVENESS_BOOST_FACTOR = 0.05;

// ── v2.0: Sentiment & Decay Constants ──
const DECAY_DAYS_THRESHOLD = 30;     // Dias sem uso para ativar decay
const DECAY_RATE_PER_DAY = 0.02;     // Redução de confiança por dia acima do threshold
const DECAY_MIN_CONFIDENCE = 0.3;    // Confiança mínima após decay
const RECENCY_BOOST = 0.05;          // Boost para padrões usados nas últimas 24h
const ANTI_PATTERN_MAX = 3;          // Máximo de anti-padrões por conversa escalada

// ── Função Principal: Aprender de uma Conversa ────────────────────────

/**
 * Analisa uma conversa recém-resolvida e extrai padrões aprendidos.
 * Roda em background (não bloqueia a resposta ao hóspede).
 *
 * Triage (do self-learning-skills):
 * - Pergunta + resposta completa → KnowledgeEntry (padrão reutilizável)
 * - Facto solto (ex: "WiFi é Pousada2024") → ignorado (muda demais)
 * - One-off (ex: "ônibus 834 sai 3x/dia") → ignorado (não é recorrente)
 */
export async function learnFromConversation(
  tenantId: string,
  conversationId: string,
): Promise<LearningResult> {
  const result: LearningResult = {
    patternsExtracted: 0,
    patternsSkipped: 0,
    patternsPromoted: 0,
    patternsDeprecated: 0,
    details: [],
  };

  try {
    // 1. Buscar todas as mensagens da conversa
    const messages = await db.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });

    if (messages.length < MIN_CONVERSATION_MESSAGES) {
      result.details.push(`Conversa curta (${messages.length} msgs), pulando.`);
      return result;
    }

    // 2. Buscar status da conversa
    const conversation = await db.conversationLog.findUnique({
      where: { id: conversationId },
      select: { status: true, aiConfidence: true },
    });

    if (!conversation) return result;

    const isResolved = conversation.status === 'resolved';
    const isEscalated = conversation.status === 'escalated';

    // v2.0: Analisar sentimento do hóspede na conversa
    const guestMessages = messages.filter(m => m.from === 'guest').map(m => m.content);
    const sentimentScore = analyzeConversationSentiment(guestMessages);

    // 3. Extrair pares pergunta (hóspede) → resposta (IA)
    const pairs: Array<{ guestMsg: string; aiMsg: string }> = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].from === 'guest' && messages[i + 1].from === 'ai') {
        pairs.push({
          guestMsg: messages[i].content,
          aiMsg: messages[i + 1].content,
        });
      }
    }

    if (pairs.length === 0) {
      result.details.push('Nenhum par hóspede→IA encontrado.');
      return result;
    }

    // 4. Buscar conhecimento existente para evitar duplicatas
    const existingKnowledge = await db.knowledgeEntry.findMany({
      where: { tenantId },
      select: { question: true },
    });
    const existingQuestions = new Set(
      existingKnowledge.map(e => e.question.toLowerCase().trim())
    );

    // 5. Extrair padrões candidatos (apenas de conversas resolvidas)
    if (isResolved) {
      const candidates = extractCandidatePatterns(pairs);

      for (const candidate of candidates) {
        if (result.patternsExtracted >= MAX_PATTERNS_PER_RUN) break;

        // Triage: pular fatos soltos e one-offs
        if (!isReusablePattern(candidate.question)) {
          result.patternsSkipped++;
          result.details.push(`Triage SKIP (não reutilizável): "${candidate.question.substring(0, 50)}..."`);
          continue;
        }

        // Deduplicação: verificar se já existe algo similar
        if (isDuplicateQuestion(candidate.question, existingQuestions)) {
          result.patternsSkipped++;
          result.details.push(`DUPLICATA: "${candidate.question.substring(0, 50)}..."`);
          continue;
        }

        // Sanitização: remover PII e conteúdo sensível
        const sanitized = sanitizePattern(candidate);
        if (!sanitized) {
          result.patternsSkipped++;
          continue;
        }

        // v2.0: Sentiment-weighted initial confidence
        // Conversas com sentimento positivo geram padrões com confiança levemente maior
        const sentimentAdjustedConfidence = Math.min(
          1.0,
          INITIAL_CONFIDENCE + (sentimentScore > 0 ? sentimentScore * 0.1 : 0)
        );

        // Criar novo KnowledgeEntry
        try {
          const newEntry = await db.knowledgeEntry.create({
            data: {
              tenantId,
              question: sanitized.question,
              answer: sanitized.answer,
              category: sanitized.category,
              priority: 'medium', // Precisa ser promovido para 'high'
              usage: 0,
              effectiveness: sentimentAdjustedConfidence * 100, // 0-100 scale
              embeddingJson: '[]', // Será vetorizado pelo RAG na próxima busca
              metadata: JSON.stringify({
                source: 'auto_learned',
                sourceConversationId: conversationId,
                extractedAt: new Date().toISOString(),
                confidence: sentimentAdjustedConfidence,
                timesUsed: 0,
                timesSuccessful: 0,
                verified: false,
                sentimentScore, // v2.0: rastreia sentimento da conversa de origem
              }),
            },
          });

          result.patternsExtracted++;
          result.details.push(`NOVO padrão (sentimento: ${sentimentScore.toFixed(2)}): "${sanitized.question.substring(0, 60)}..."`);
          existingQuestions.add(sanitized.question.toLowerCase().trim());

          // ── WRITE-PATH: Sincroniza padrão aprendido no grafo Semantica ──
          // Não-bloqueante: erros aqui não afetam o loop de aprendizado.
          // Extrai entidades da resposta e cria nós/arestas no Apache AGE.
          syncPatternToGraphRAG(tenantId, sanitized.question, sanitized.answer, conversationId, newEntry.id).catch((err) => {
            console.warn('[ConversationLearner] GraphRAG sync falhou (não-bloqueante):', err);
          });

          // Log de atividade de aprendizado
          await db.aIActivityLog.create({
            data: {
              tenantId,
              type: 'learning',
              message: `Padrão aprendido da conversa ${conversationId}: "${sanitized.question.substring(0, 80)}"`,
              status: 'success',
              duration: 0,
              metadata: JSON.stringify({
                knowledgeEntryId: newEntry.id,
                sourceConversationId: conversationId,
                patternType: 'auto_extracted',
                sentimentScore, // v2.0
              }),
            },
          });
        } catch (err) {
          console.error('[ConversationLearner] Falha ao criar KnowledgeEntry:', err);
        }
      }
    }

    // v2.0: Negative Knowledge Capture (inspirado em self-learning-skills Pattern 7)
    // Quando uma conversa é escalada, captura o que a IA fez ERRADO como anti-padrão
    if (isEscalated && pairs.length > 0) {
      const antiPatternsResult = await captureAntiPatterns(tenantId, conversationId, pairs);
      result.details.push(...antiPatternsResult.details);
    }

    // 6. Feedback loop: atualizar effectiveness de knowledge usado nesta conversa
    // v2.0: Agora com sentiment-weighted feedback
    if (pairs.length > 0) {
      await updateKnowledgeEffectiveness(
        tenantId,
        pairs[pairs.length - 1].guestMsg,
        isResolved,
        isEscalated,
        sentimentScore, // v2.0: sentimento pondera o feedback
      );
    }

    // 7. Promover padrões que atingiram o threshold (Promotion Rule)
    const promotionResult = await promoteVerifiedPatterns(tenantId);
    result.patternsPromoted = promotionResult.promoted;
    result.patternsDeprecated = promotionResult.deprecated;
    result.details.push(...promotionResult.details);

    // v2.0: Confidence Decay — decair padrões não usados recentemente
    const decayResult = await applyConfidenceDecay(tenantId);
    if (decayResult.decayed > 0) {
      result.details.push(`DECAY: ${decayResult.decayed} padrões sofreram decaimento por inatividade`);
    }

    // ── 8. Brain Health Check: otimiza prompts se métricas indicarem problema ──
    try {
      const healthResult = await checkAndOptimizePrompts(tenantId);
      if (healthResult.optimizationTriggered) {
        result.details.push(`BRAIN HEALTH: ${healthResult.reason}`);
      }
    } catch {
      // Brain health é best-effort — não bloqueia aprendizado
    }

    // 9. Atualizar contadores no AgentConfig
    await updateAgentConfigLearningStats(tenantId, result);

  } catch (error) {
    console.error('[ConversationLearner] Erro em learnFromConversation:', error);
    result.details.push(`ERRO: ${error instanceof Error ? error.message : 'desconhecido'}`);
  }

  return result;
}

// ── Extração de Padrões Candidatos ────────────────────────────────────

function extractCandidatePatterns(
  pairs: Array<{ guestMsg: string; aiMsg: string }>,
): ExtractedPattern[] {
  const candidates: ExtractedPattern[] = [];

  for (const pair of pairs) {
    const question = pair.guestMsg.trim();
    const answer = pair.aiMsg.trim();

    // Filtrar perguntas muito curtas ou sem substância
    if (question.length < 10) continue;
    // Filtrar respostas muito curtas
    if (answer.length < 20) continue;
    // Filtrar respostas de erro / fallback
    if (answer.includes('probleminha para processar') || answer.includes('silenciada')) continue;
    // Filtrar mensagens de captura de dados
    if (answer.includes('Me passa seu e-mail') || answer.includes('WhatsApp é o melhor número')) continue;

    candidates.push({
      question,
      answer,
      category: classifyCategory(question),
      sourceConversationId: '',
      confidence: INITIAL_CONFIDENCE,
    });
  }

  return candidates;
}

// ── Triage: É um padrão reutilizável? ────────────────────────────────

function isReusablePattern(question: string): boolean {
  const q = question.toLowerCase();

  // Padrões reutilizáveis (perguntas que outros hóspedes também fariam)
  const reusablePatterns = [
    /pre[çc]o|valor|custo|quanto\s+custa|tarifa/,
    /dispon[ií]vel|vaga|tem\s+quarto|tem\s+chal[eé]/,
    /check[\s-]?in|check[\s-]?out|entrada|sa[íi]da/,
    /caf[ée]\s+da\s+manh[ãa]|cafe|morning/,
    /piscina|praia|piscina/,
    /aceita\s+pet|cachorro|gato|animal/,
    /estacionamento|carro|garagem/,
    /wi[-]?fi|internet|senha/,
    /cancel|desistir|reembolso/,
    /como\s+chegar|localiza[çc][ãaão]|endere[çc]o|mapa/,
    /crian[çc]a|bebe|ber[çc]o/,
    /pagamento|pix|cart[ãa]o|parcela/,
    /_transfer|aeroporto|onibus|[ôo]nibus|transporte/,
    /avalia[çc][ãaõ]|review|nota/,
  ];

  return reusablePatterns.some(pattern => pattern.test(q));
}

// ── Deduplicação ──────────────────────────────────────────────────────

function isDuplicateQuestion(
  question: string,
  existingQuestions: Set<string>,
): boolean {
  const normalized = question.toLowerCase().trim();

  // Verificar similaridade com perguntas existentes
  for (const existing of existingQuestions) {
    // Verificação exata
    if (existing === normalized) return true;

    // Verificação de sobreposição significativa (>70% das palavras)
    const existingWords = new Set(existing.split(/\s+/));
    const newWords = new Set(normalized.split(/\s+/));
    let overlap = 0;
    for (const word of newWords) {
      if (existingWords.has(word)) overlap++;
    }
    const similarity = overlap / Math.max(newWords.size, existingWords.size);
    if (similarity > 0.7) return true;
  }

  return false;
}

// ── Sanitização de PII ───────────────────────────────────────────────

function sanitizePattern(
  pattern: ExtractedPattern,
): ExtractedPattern | null {
  let { question, answer } = pattern;

  // Remover nomes próprios comuns de hóspedes (padrão: "Olá [Nome],")
  question = question.replace(/^Olá\s+\w+[,!]/i, 'Olá,');
  answer = answer.replace(/\b(?:Bernardo|Carlos|Maria|Ana|João|Pedro|Lucas)\b(?=,|\s+seja)/g, '[hóspede]');

  // Remover números de telefone
  question = question.replace(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g, '[telefone]');
  answer = answer.replace(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g, '[telefone]');

  // Remover e-mails
  question = question.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');
  answer = answer.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');

  // Remover chaves PIX reais
  answer = answer.replace(/00020101\d{20,}/g, '[PIX_COPIA_E_COLA]');

  // Se ficou muito curto após sanitização, descartar
  if (question.length < 10 || answer.length < 20) return null;

  return { ...pattern, question, answer };
}

// ── Classificação de Categoria ───────────────────────────────────────

function classifyCategory(question: string): string {
  const q = question.toLowerCase();

  if (/pre[çc]o|valor|custo|quanto\s+custa|tarifa|pagamento|pix|cart[ãa]o|parcela/.test(q)) return 'pricing';
  if (/quarto|chal[eé]|su[ií]te|cama|acomoda[çc][ãaão]|dispon[ií]vel|vaga/.test(q)) return 'rooms';
  if (/piscina|caf[ée]|servi[çc]o|restaurante|limpeza|arruma[çc][ãaão]|toalha|roupa/.test(q)) return 'amenities';
  if (/check[\s-]?in|check[\s-]?out|pol[ií]tica|regra|hor[aá]rio|cancel|reembolso/.test(q)) return 'policies';
  if (/como\s+chegar|localiza[çc][ãaão]|endere[çc]o|mapa|dist[aâ]ncia|transfer|aeroporto|onibus|transporte/.test(q)) return 'location';
  if (/passeio|tour|atividade|praia|trilha|passear|vizitar/.test(q)) return 'activities';
  if (/cafe|caf[ée]\s+da\s+manh[ãa]|jantar|almo[çc]o|restaurante|comida/.test(q)) return 'food';

  return 'custom';
}

// ── v2.0: Sentiment Analysis (keyword-based, zero dependências) ──────

/**
 * Analisa o sentimento geral das mensagens do hóspede.
 * Retorna score entre -1 (muito negativo) e +1 (muito positivo).
 * Zero-dependency: usa apenas regex, nenhum modelo externo.
 * Inspirado na abordagem de sentiment analysis do awesome-machine-learning.
 */
function analyzeConversationSentiment(guestMessages: string[]): number {
  if (guestMessages.length === 0) return 0;

  const POSITIVE_PATTERNS = [
    /obrigad[oa]/i, /valeu/i, /perfeito/i, /excelente/i, /maravilh[oaos]/i,
    /adorei/i, /amei/i, /massa/i, /top/i, /legal/i, /bonito/i,
    /lindo/i, /gostei/i, /recomend[oaos]/i, /voltar/i, /melhor/i,
    /ótimo/i, /otimo/i, /show/i, /incr[íi]vel/i, /surpreend/i,
    /bem/i, /sim/i, /claro/i, /com certeza/i, /beleza/i,
  ];

  const NEGATIVE_PATTERNS = [
    /p[ée]ssimo/i, /horr[íi]vel/i, /ruim/i, /n[aã]o gostei/i, /desapont/i,
    /problema/i, /erro/i, /errado/i, /nao funciona/i, /n[aã]o funciona/i,
    /reclama[çc][aã]o/i, /insatisfeit[oa]/i, /frustrad[oa]/i, /pessimo/i,
    /engana[çc][aã]o/i, /mentira/i, /falso/i, /desistir/i, /cancelar/i,
    /n[aã]o recomendo/i, /nunca mais/i, /dinheiro/i, /caro/i,
  ];

  let totalScore = 0;
  let scoredMessages = 0;

  // Analisar apenas as últimas 5 mensagens (mais relevantes para o outcome)
  const recentMessages = guestMessages.slice(-5);

  for (const msg of recentMessages) {
    let msgScore = 0;
    let hasSignal = false;

    for (const pattern of POSITIVE_PATTERNS) {
      if (pattern.test(msg)) { msgScore += 0.5; hasSignal = true; }
    }
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(msg)) { msgScore -= 0.5; hasSignal = true; }
    }

    // Negation detection: "não gostei" → inverte positivo, "não é ruim" → inverte negativo
    if (/n[aã]o\s+(é|gostei|recomendo|voltaria)/i.test(msg)) {
      msgScore = -Math.abs(msgScore) || -0.3;
      hasSignal = true;
    }

    if (hasSignal) {
      totalScore += Math.max(-1, Math.min(1, msgScore));
      scoredMessages++;
    }
  }

  return scoredMessages > 0 ? totalScore / scoredMessages : 0;
}

// ── v2.0: Negative Knowledge Capture ─────────────────────────────────

/**
 * Captura anti-padrões de conversas escaladas.
 * Quando a IA falha e a conversa é escalada para humano, extrai
 * o que a IA respondeu de errado para evitar repetir.
 * Inspirado no Pattern 7 (Negative Knowledge) do self-learning-skills.
 */
async function captureAntiPatterns(
  tenantId: string,
  conversationId: string,
  pairs: Array<{ guestMsg: string; aiMsg: string }>,
): Promise<{ details: string[] }> {
  const details: string[] = [];
  let captured = 0;

  for (const pair of pairs) {
    if (captured >= ANTI_PATTERN_MAX) break;

    // Filtrar respostas genéricas ou muito curtas
    if (pair.aiMsg.length < 30) continue;
    // Filtrar respostas de fallback/erro
    if (pair.aiMsg.includes('probleminha para processar') || pair.aiMsg.includes('silenciada')) continue;

    // Sanitizar PII do anti-padrão
    const sanitized = sanitizePattern({
      question: pair.guestMsg,
      answer: pair.aiMsg,
      category: 'anti_pattern',
      sourceConversationId: conversationId,
      confidence: 0,
    });
    if (!sanitized) continue;

    try {
      // Armazenar anti-padrão como KnowledgeEntry com categoria especial
      await db.knowledgeEntry.create({
        data: {
          tenantId,
          question: sanitized.question,
          answer: sanitized.answer,
          category: 'anti_pattern', // v2.0: categoria dedicada
          priority: 'low',
          usage: 0,
          effectiveness: 0,
          embeddingJson: '[]',
          metadata: JSON.stringify({
            source: 'auto_anti_pattern',
            sourceConversationId: conversationId,
            extractedAt: new Date().toISOString(),
            type: 'negative_knowledge',
            reason: 'Conversa escalada — resposta da IA não resolveu',
          }),
        },
      });
      captured++;
      details.push(`ANTI-PADRÃO capturado: "${sanitized.question.substring(0, 50)}..."`);
    } catch (err) {
      console.error('[ConversationLearner] Falha ao capturar anti-padrão:', err);
    }
  }

  if (captured > 0) {
    await db.aIActivityLog.create({
      data: {
        tenantId,
        type: 'learning',
        message: `${captured} anti-padrão(s) capturado(s) da conversa escalada ${conversationId}`,
        status: 'success',
        duration: 0,
        metadata: JSON.stringify({
          sourceConversationId: conversationId,
          patternType: 'anti_pattern',
          count: captured,
        }),
      },
    });
  }

  return { details };
}

// ── v2.0: Confidence Decay ───────────────────────────────────────────

/**
 * Aplica decaimento temporal de confiança em padrões não usados.
 * Inspirado em online-learning (River) e continual-learning.
 * Padrões que ninguém pergunta há 30+ dias perdem confiança gradualmente.
 * Padrões usados recentemente ganham um pequeno boost de recência.
 */
async function applyConfidenceDecay(
  tenantId: string,
): Promise<{ decayed: number; boosted: number }> {
  const result = { decayed: 0, boosted: 0 };

  try {
    const patterns = await db.knowledgeEntry.findMany({
      where: {
        tenantId,
        category: 'auto_learned',
        priority: { in: ['medium', 'high'] },
      },
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const pattern of patterns) {
      const metadata = safeParseMetadata(pattern.metadata);
      const { confidence = INITIAL_CONFIDENCE } = metadata;
      const lastUsed = pattern.lastUsed?.getTime() || pattern.createdAt.getTime();
      const daysSinceUsed = (now - lastUsed) / DAY_MS;

      let newConfidence = confidence;
      let changed = false;

      if (daysSinceUsed > DECAY_DAYS_THRESHOLD) {
        // Aplicar decay: -0.02 por dia acima do threshold
        const excessDays = daysSinceUsed - DECAY_DAYS_THRESHOLD;
        const decay = excessDays * DECAY_RATE_PER_DAY;
        newConfidence = Math.max(DECAY_MIN_CONFIDENCE, confidence - decay);
        if (newConfidence < confidence) {
          changed = true;
          result.decayed++;
        }
      } else if (daysSinceUsed <= 1 && pattern.usage > 0) {
        // Boost de recência para padrões usados nas últimas 24h
        newConfidence = Math.min(1, confidence + RECENCY_BOOST);
        changed = true;
        result.boosted++;
      }

      if (changed) {
        const newEffectiveness = Math.min(100, newConfidence * 100);
        await db.knowledgeEntry.update({
          where: { id: pattern.id },
          data: {
            effectiveness: newEffectiveness,
            metadata: JSON.stringify({
              ...metadata,
              confidence: newConfidence,
              lastDecayAt: new Date().toISOString(),
              daysSinceUsed: Math.round(daysSinceUsed),
            }),
          },
        });
      }
    }
  } catch (err) {
    console.error('[ConversationLearner] Falha no confidence decay:', err);
  }

  return result;
}

// ── Feedback Loop: Atualizar Effectiveness (v2.0: sentiment-weighted) ─

/**
 * Quando uma conversa usa RAG e termina, atualiza a effectiveness
 * das knowledge entries baseado no outcome.
 * v2.0: Sentiment pondera o boost/penalty — hóspede satisfeito boosta mais,
 * hóspede insatisfeito penaliza mais.
 */
async function updateKnowledgeEffectiveness(
  tenantId: string,
  lastGuestQuestion: string,
  wasResolved: boolean,
  wasEscalated: boolean,
  sentimentScore: number = 0, // v2.0: default neutro
): Promise<void> {
  try {
    // Buscar knowledge entries que foram usados recentemente
    const recentEntries = await db.knowledgeEntry.findMany({
      where: {
        tenantId,
        lastUsed: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Usados nos últimos 5 min
        category: 'auto_learned',
      },
    });

    if (recentEntries.length === 0) return;

    // v2.0: Sentiment weighting factor
    // sentimento > 0 (positivo) → multiplica boost por 1.0 + sentimento
    // sentimento < 0 (negativo) → multiplica penalty por 1.0 + |sentimento|
    const sentimentBoostMultiplier = 1 + Math.max(0, sentimentScore) * 0.5;
    const sentimentPenaltyMultiplier = 1 + Math.max(0, -sentimentScore) * 0.5;

    for (const entry of recentEntries) {
      const metadata = safeParseMetadata(entry.metadata);
      let { timesUsed = 0, timesSuccessful = 0, confidence = INITIAL_CONFIDENCE } = metadata;

      timesUsed++;
      if (wasResolved) {
        timesSuccessful++;
        // v2.0: Sentiment-weighted boost
        confidence = Math.min(1, confidence + (CONFIDENCE_BOOST * sentimentBoostMultiplier));
      } else if (wasEscalated) {
        // v2.0: Sentiment-weighted penalty
        confidence = Math.max(0, confidence - (CONFIDENCE_PENALTY * sentimentPenaltyMultiplier));
      }

      // Atualizar effectiveness como média ponderada
      const effectiveness = timesUsed > 0
        ? Math.min(100, (timesSuccessful / timesUsed) * 100)
        : confidence * 100; // 0-100 scale

      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: {
          effectiveness,
          metadata: JSON.stringify({
            ...metadata,
            timesUsed,
            timesSuccessful,
            confidence,
            lastOutcome: wasResolved ? 'resolved' : wasEscalated ? 'escalated' : 'active',
            lastOutcomeAt: new Date().toISOString(),
            lastSentimentScore: sentimentScore, // v2.0: rastreia sentimento do último feedback
          }),
        },
      });
    }
  } catch (err) {
    console.error('[ConversationLearner] Falha ao atualizar effectiveness:', err);
  }
}

// ── Promotion Rule: Promover/Desativar Padrões ───────────────────────

async function promoteVerifiedPatterns(
  tenantId: string,
): Promise<{ promoted: number; deprecated: number; details: string[] }> {
  const result = { promoted: 0, deprecated: 0, details: [] as string[] };

  try {
    // Buscar padrões auto_learned que podem ser promovidos
    const candidates = await db.knowledgeEntry.findMany({
      where: { tenantId, category: 'auto_learned' },
    });

    for (const entry of candidates) {
      const metadata = safeParseMetadata(entry.metadata);
      const { timesUsed = 0, timesSuccessful = 0, confidence = INITIAL_CONFIDENCE, verified = false } = metadata;

      // Promotion Rule: 3 gates
      if (
        !verified &&
        confidence >= PROMOTION_SUCCESS_THRESHOLD &&
        timesUsed >= PROMOTION_MIN_USES &&
        timesSuccessful >= PROMOTION_MIN_SUCCESSFUL
      ) {
        // PROMOVER: elevar prioridade e marcar como verificado
        await db.knowledgeEntry.update({
          where: { id: entry.id },
          data: {
            priority: 'high', // Promovido
            metadata: JSON.stringify({
              ...metadata,
              verified: true,
              verifiedAt: new Date().toISOString(),
            }),
          },
        });
        result.promoted++;
        result.details.push(`PROMOVIDO: "${entry.question.substring(0, 50)}..." (conf: ${confidence.toFixed(2)}, usos: ${timesUsed})`);
      }

      // Deprecation: desativar padrões com baixa performance
      if (
        timesUsed >= DEPRECATION_MIN_USES &&
        confidence < DEPRECATION_CONFIDENCE
      ) {
        await db.knowledgeEntry.update({
          where: { id: entry.id },
          data: {
            priority: 'low', // Desativado pelo feedback loop
            metadata: JSON.stringify({
              ...metadata,
              deprecated: true,
              deprecatedAt: new Date().toISOString(),
              deprecatedReason: `Confiança baixa (${confidence.toFixed(2)}) após ${timesUsed} usos`,
            }),
          },
        });
        result.deprecated++;
        result.details.push(`DESATIVADO: "${entry.question.substring(0, 50)}..." (conf: ${confidence.toFixed(2)})`);
      }
    }
  } catch (err) {
    console.error('[ConversationLearner] Falha na promoção:', err);
  }

  return result;
}

// ── Atualizar Estats do AgentConfig ───────────────────────────────────

async function updateAgentConfigLearningStats(
  tenantId: string,
  result: LearningResult,
): Promise<void> {
  try {
    const configs = await db.agentConfig.findMany({ where: { tenantId }, take: 1 });
    if (configs.length === 0) return;
    const config = configs[0];

    const currentPatterns = config.learnedPatterns || 0;
    const newTotal = currentPatterns + result.patternsExtracted;

    const autoEntries = await db.knowledgeEntry.findMany({
      where: { tenantId, category: 'auto_learned' },
      select: { effectiveness: true },
    });

    const avgConfidence = autoEntries.length > 0
      ? autoEntries.reduce((sum, e) => sum + (e.effectiveness || 0), 0) / autoEntries.length
      : 0;

    await db.agentConfig.update({
      where: { id: config.id },
      data: {
        learnedPatterns: newTotal,
        confidenceScore: Math.round(avgConfidence * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[ConversationLearner] Falha ao atualizar AgentConfig:', err);
  }
}

// ── Utilitários ───────────────────────────────────────────────────────

function safeParseMetadata(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Função Pública: Carregar Padrões Aprendidos para o Prompt ────────

/**
 * Carrega padrões verificados (promotion rule passou) para injetar no
 * system prompt. Só carrega padrões com confidence >= 0.7 e priority >= 7.
 *
 * Este é o passo "REUSE" do loop Recognize → Capture → Reuse.
 */
export async function loadLearnedPatternsForPrompt(
  tenantId: string,
): Promise<string> {
  try {
    const verifiedPatterns = await db.knowledgeEntry.findMany({
      where: {
        tenantId,
        category: 'auto_learned',
        priority: 'high',
        effectiveness: { gte: 70 }, // 0-100 scale
      },
      orderBy: { effectiveness: 'desc' },
      take: 5, // Máximo 5 padrões no prompt (não poluir o contexto)
    });

    if (verifiedPatterns.length === 0) return '';

    const lines = verifiedPatterns.map((p, i) => {
      const meta = safeParseMetadata(p.metadata);
      const verified = meta.verified ? '✓' : '?';
      return `${i + 1}. ${verified} P: ${p.question}\n   R: ${p.answer}`;
    });

    return `\n=== PADRÕES APRENDIDOS (verificados pela experiência) ===\n${lines.join('\n\n')}\n`;
  } catch (err) {
    console.error('[ConversationLearner] Falha ao carregar padrões:', err);
    return '';
  }
}

// ── Função Pública: Obter Estatísticas de Aprendizado ────────────────

export async function getLearningStats(tenantId: string) {
  try {
    const [total, verified, active, deprecated, antiPatterns] = await Promise.all([
      db.knowledgeEntry.count({ where: { tenantId, category: 'auto_learned' } }),
      db.knowledgeEntry.count({ where: { tenantId, category: 'auto_learned', priority: 'high' } }),
      db.knowledgeEntry.count({ where: { tenantId, category: 'auto_learned', priority: 'medium' } }),
      db.knowledgeEntry.count({
        where: { tenantId, category: 'auto_learned', metadata: { contains: '"deprecated":true' } },
      }),
      // v2.0: Contar anti-padrões
      db.knowledgeEntry.count({ where: { tenantId, category: 'anti_pattern' } }),
    ]);

    const configs = await db.agentConfig.findMany({
      where: { tenantId },
      select: { learnedPatterns: true, confidenceScore: true },
      take: 1,
    });

    const recentLearning = await db.aIActivityLog.findMany({
      where: { tenantId, type: 'learning' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { message: true, createdAt: true, status: true },
    });

    return {
      totalPatterns: total,
      verifiedPatterns: verified,
      activePatterns: active,
      deprecatedPatterns: deprecated,
      overallConfidence: configs[0]?.confidenceScore || 0,
      totalLearned: configs[0]?.learnedPatterns || 0,
      recentActivity: recentLearning.map(l => ({
        message: l.message,
        date: l.createdAt,
        success: l.status === 'success',
      })),
      // v2.0: Métricas expandidas
      antiPatternsCount: antiPatterns, // Anti-padrões capturados
      learningVelocity: calculateLearningVelocity(recentLearning.map(l => ({ date: l.createdAt, success: l.status === 'success' }))), // Velocidade de aprendizado
      avgSentimentScore: 0, // Calculado abaixo
    };

    // v2.0: Calcular sentimento médio dos padrões aprendidos
    const patternsWithSentiment = await db.knowledgeEntry.findMany({
      where: { tenantId, category: 'auto_learned' },
      select: { metadata: true },
      take: 50,
    });
    const sentimentScores = patternsWithSentiment
      .map(p => safeParseMetadata(p.metadata).sentimentScore)
      .filter((s): s is number => typeof s === 'number');

    return {
      totalPatterns: total,
      verifiedPatterns: verified,
      activePatterns: active,
      deprecatedPatterns: deprecated,
      overallConfidence: configs[0]?.confidenceScore || 0,
      totalLearned: configs[0]?.learnedPatterns || 0,
      recentActivity: recentLearning.map(l => ({
        message: l.message,
        date: l.createdAt,
        success: l.status === 'success',
      })),
      antiPatternsCount: antiPatterns,
      learningVelocity: calculateLearningVelocity(recentLearning.map(l => ({ date: l.createdAt, success: l.status === 'success' }))),
      avgSentimentScore: sentimentScores.length > 0
        ? Math.round((sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length) * 100) / 100
        : 0,
    };
  } catch (err) {
    console.error('[ConversationLearner] Falha ao buscar stats:', err);
    return {
      totalPatterns: 0,
      verifiedPatterns: 0,
      activePatterns: 0,
      deprecatedPatterns: 0,
      overallConfidence: 0,
      totalLearned: 0,
      recentActivity: [],
      antiPatternsCount: 0,
      learningVelocity: 0,
      avgSentimentScore: 0,
    };
  }
}

// ── v2.0: Funções Auxiliares ────────────────────────────────────────────

/**
 * Calcula a velocidade de aprendizado (padrões por semana nas últimas 2 semanas).
 */
function calculateLearningVelocity(
  recentActivity: Array<{ date: Date; success: boolean }>,
): number {
  if (recentActivity.length === 0) return 0;
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentCount = recentActivity.filter(a => new Date(a.date).getTime() > twoWeeksAgo).length;
  return Math.round((recentCount / 2) * 10) / 10; // padrões/semana
}

// ── v2.0: Anti-Pattern Loader ──────────────────────────────────────────

/**
 * Carrega anti-padrões para injetar no system prompt.
 * Diz à IA o que NÃO fazer baseado em erros passados.
 * Este é o passo "REUSE" dos anti-padrões.
 */
export async function loadAntiPatternsForPrompt(
  tenantId: string,
): Promise<string> {
  try {
    const antiPatterns = await db.knowledgeEntry.findMany({
      where: {
        tenantId,
        category: 'anti_pattern',
        priority: 'low',
      },
      orderBy: { createdAt: 'desc' },
      take: 3, // Máximo 3 anti-padrões (não poluir)
    });

    if (antiPatterns.length === 0) return '';

    const lines = antiPatterns.map((p, i) => {
      const meta = safeParseMetadata(p.metadata);
      return `${i + 1}. Quando perguntarem sobre "${p.question.substring(0, 80)}", NÃO responda como: "${p.answer.substring(0, 120)}..." (motivo: ${meta.reason || 'conversa escalada'})`;
    });

    return `\n=== ANTI-PADRÕES (respostas que NÃO funcionaram — aprendido com erros reais) ===\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[ConversationLearner] Falha ao carregar anti-padrões:', err);
    return '';
  }
}

// ============================================================================
// WRITE-PATH: GraphRAG Sync — Sincroniza padrão aprendido no grafo Semantica
// ============================================================================
// Quando o ConversationLearner aprende um novo padrão Q&A, esta função:
//   1. Identifica o tipo de entidade (RULE, POLICY, AMENITY, etc.)
//   2. Cria um GraphNode no Apache AGE via SemanticaClient
//   3. Tenta detectar relações com nós existentes (REQUIRES, OVERLAPS)
//   4. Registra proveniência (source='auto_learned', sourceConversationId)
//
// Não-bloqueante: erros aqui não afetam o loop de aprendizado.
// Feature flag: USE_SEMANTICA_GRAPH=true (default false)
// ============================================================================

const ENTITY_KEYWORDS: Array<{ keywords: string[]; type: 'CHECKIN' | 'CHECKOUT' | 'POLICY' | 'AMENITY' | 'SERVICE' | 'PAYMENT' | 'CANCEL' | 'RULE' | 'FAQ' }> = [
  { keywords: ['check-in', 'checkin', 'entrada', 'chegada', 'horario de entrada'], type: 'CHECKIN' },
  { keywords: ['check-out', 'checkout', 'saida', 'partida', 'horario de saida'], type: 'CHECKOUT' },
  { keywords: ['pet', 'cachorro', 'gato', 'animal', 'cao'], type: 'POLICY' },
  { keywords: ['piscina', 'sauna', 'academia', 'jacuzzi'], type: 'AMENITY' },
  { keywords: ['cafe da manha', 'café', 'breakfast', 'refeicao'], type: 'SERVICE' },
  { keywords: ['wifi', 'wi-fi', 'internet', 'senha'], type: 'AMENITY' },
  { keywords: ['estacionamento', 'garagem', 'vaga'], type: 'AMENITY' },
  { keywords: ['pix', 'cartao', 'cartão', 'pagamento', 'cobranca'], type: 'PAYMENT' },
  { keywords: ['cancelamento', 'cancelar', 'reembolso', 'no-show'], type: 'CANCEL' },
  { keywords: ['reserva', 'agendar', 'disponibilidade'], type: 'RULE' },
];

function detectEntityType(text: string): 'CHECKIN' | 'CHECKOUT' | 'POLICY' | 'AMENITY' | 'SERVICE' | 'PAYMENT' | 'CANCEL' | 'RULE' | 'FAQ' {
  const lower = text.toLowerCase();
  for (const { keywords, type } of ENTITY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }
  return 'FAQ';
}

function extractEntityName(text: string, type: string): string {
  // Extrai um nome curto baseado no tipo
  const lower = text.toLowerCase();
  const typeLabels: Record<string, string> = {
    CHECKIN: 'Check-in',
    CHECKOUT: 'Check-out',
    POLICY: 'Política',
    AMENITY: 'Comodidade',
    SERVICE: 'Serviço',
    PAYMENT: 'Pagamento',
    CANCEL: 'Cancelamento',
    RULE: 'Regra',
    FAQ: 'FAQ',
  };
  // Tenta extrair primeira frase curta
  const firstSentence = text.split(/[.!?]/)[0]?.trim().slice(0, 50) || text.slice(0, 50);
  return `${typeLabels[type] || 'Item'}: ${firstSentence}`;
}

async function syncPatternToGraphRAG(
  tenantId: string,
  question: string,
  answer: string,
  conversationId: string,
  knowledgeEntryId: string,
): Promise<void> {
  // Verifica se Semantica está ativo
  if (!SemanticaClient.isEnabled() || !SemanticaClient.isConfigured()) {
    return; // Silent skip — não é erro, só não está configurado
  }

  try {
    // Combina questão + resposta para análise semântica
    const fullText = `${question}\n${answer}`;

    // Detecta tipo de entidade baseado em palavras-chave
    const entityType = detectEntityType(fullText);
    const nodeName = extractEntityName(answer, entityType);

    // Cria nó no grafo
    const node = await SemanticaClient.addNode({
      tenantId,
      type: entityType,
      name: nodeName,
      content: answer.slice(0, 500), // Limite de 500 chars
      provenance: {
        source: 'auto_learned',
        sourceRef: `knowledge_entry:${knowledgeEntryId}`,
        extractedBy: 'conversation-learner',
      },
      confidence: 0.5, // Confiança inicial — aumenta conforme padrão é verificado
    });

    logSink.info({
      module: 'conversation-learner',
      event: 'graphrag_node_created',
      message: `Nó criado no grafo: ${node.id} (${entityType})`,
      context: { tenantId, nodeId: node.id, entityType, knowledgeEntryId, conversationId },
    });

    // Tenta detectar conflitos com nós existentes
    // (Semantica detecta automaticamente se houver sobreposição)
    try {
      const conflicts = await SemanticaClient.detectConflicts(tenantId);
      if (conflicts.length > 0) {
        logSink.warn({
          module: 'conversation-learner',
          event: 'graphrag_conflicts_detected',
          message: `${conflicts.length} conflito(s) detectado(s) após aprendizado`,
          context: { tenantId, conflictIds: conflicts.map((c: any) => c.id) },
        });
      }
    } catch {
      // Conflito detection é best-effort — não falha o sync
    }
  } catch (err) {
    // Erro silencioso — não bloqueia aprendizado
    logSink.warn({
      module: 'conversation-learner',
      event: 'graphrag_sync_failed',
      message: `Falha ao sincronizar padrão no grafo: ${err instanceof Error ? err.message : String(err)}`,
      context: { tenantId, knowledgeEntryId, conversationId },
    });
  }
}
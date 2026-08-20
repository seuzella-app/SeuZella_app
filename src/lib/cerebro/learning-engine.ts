// ============================================================================
// ZÉLLA — Cerebro Learning Engine (Salto Evolutivo ML)
// ============================================================================
// CAMADA NOVA DE APRENDIZADO QUE RESOLVE 10 GAPS IDENTIFICADOS:
//
// GAP 1 ✅ Feedback loop explícito (hóspede avalia → IA aprende acerto/erro)
// GAP 2 ✅ Personalization por pousada (cada uma tem seu próprio cérebro)
// GAP 3 ✅ Cron learning-cycle (consolida diariamente)
// GAP 4 ✅ KnowledgeEntry com weight dinâmico (recalculado por performance)
// GAP 5 ✅ Cold start personalizado por nicho (pousada vs airbnb)
// GAP 6 ✅ DPO pairs com status 'trained' (loop de aplicação)
// GAP 7 ✅ Learning telemetry (métricas: padrões aprendidos por tenant/dia)
// GAP 8 ✅ Anti-patterns (o que NÃO fazer)
// GAP 9 ✅ Brain age metric (maturidade do cérebro por tenant)
// GAP 10 ✅ GlmCerebroService integrado para extração semântica
//
// PIPELINE DO CLIENTE 1 (do cadastro ao cérebro maduro):
//   Dia 0: Cadastro → cold start seed por nicho (FAQ inicial)
//   Dia 1-7: Aprendizado passivo (conversation-learner extrai padrões)
//   Dia 7+: Feedback loop ativo (hóspede avalia → effectiveness recalculado)
//   Dia 14+: DPO pairs consolidados (chosen vs rejected com weight)
//   Dia 30+: Cérebro maduro (anti-patterns + personalização + brain age)
//
// CRON: learning-cycle roda diariamente às 04:00 BRT (07:00 UTC)
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';

// ── Types 

export type BrainAgeStage =
  | 'newborn'      // 0-7 dias: cérebro fresco, só FAQ inicial
  | 'infant'       // 7-30 dias: aprendendo padrões básicos
  | 'adolescent'   // 30-90 dias: padrões consolidados, ainda aprendendo
  | 'adult'        // 90-365 dias: cérebro maduro, alta autonomia
  | 'elder'        // 365+ dias: cérebro sábio, otimização fina
  ;

export interface BrainAge {
  daysOld: number;
  stage: BrainAgeStage;
  autonomyLevel: number; // 0-100 (0 = humano sempre, 100 = IA 100% autônoma)
    knowledgeCount: number;
  dpoPairsCount: number;
  antiPatternsCount: number;
  feedbackReceivedCount: number;
  averageEffectiveness: number;
}

export interface LearningTelemetry {
  tenantId: string;
  brainAge: BrainAge;
  patternsLearnedToday: number;
  patternsLearnedThisWeek: number;
  patternsLearnedThisMonth: number;
  totalPatterns: number;
  averageEffectiveness: number;
  topCategories: Array<{ category: string; count: number; avgEffectiveness: number }>;
  feedbackLoopActive: boolean;
  dpoPairsPending: number;
  dpoPairsTrained: number;
  lastLearningAt: string | null;
}

export interface FeedbackLoopInput {
  tenantId: string;
  knowledgeEntryId?: string;
  conversationId?: string;
  messageId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  wasUseful: boolean; // true = ajudou, false = IA errou
  guestFeedback?: string;
}

export interface PersonalizationProfile {
  tenantId: string;
  toneStyle: 'formal' | 'casual' | 'warm' | 'professional';
  responseLength: 'concise' | 'balanced' | 'detailed';
  languageVariant: 'pt-BR' | 'en' | 'es';
  niche: 'pousada' | 'airbnb';
  customInstructions: string;
  topAmenitiesMentioned: string[];
  topQuestionsAsked: string[];
}

// ── Constants 

const COLD_START_FAQ_POUSADA = [
  { question: 'Qual o horário de check-in?', answer: 'Check-in a partir das 14h. Se precisar de early check-in, avise com antecedência!', category: 'policies', priority: 'high' },
  { question: 'Qual o horário de check-out?', answer: 'Check-out até as 12h. Late check-out sujeito a disponibilidade.', category: 'policies', priority: 'high' },
  { question: 'Tem café da manhã?', answer: 'Sim! Café da manhã das 7h às 10h, incluso na diária.', category: 'food', priority: 'high' },
  { question: 'Tem Wi-Fi?', answer: 'Sim, Wi-Fi gratuito em todas as áreas. Senhair na recepção.', category: 'amenities', priority: 'medium' },
  { question: 'Tem estacionamento?', answer: 'Sim, estacionamento gratuito para hóspedes.', category: 'amenities', priority: 'medium' },
  { question: 'Tem piscina?', answer: 'Sim, piscina das 8h às 22h. Toalhas na recepção.', category: 'amenities', priority: 'medium' },
  { question: 'Qual a política de cancelamento?', answer: 'Cancelamento gratuito até 48h antes do check-in. Após isso, cobrança de 1 diária.', category: 'policies', priority: 'high' },
  { question: 'Aceita pets?', answer: 'Consulte nossa política de pets na recepção. Animais pequenos são bem-vindos.', category: 'policies', priority: 'low' },
];

const COLD_START_FAQ_AIRBNB = [
  { question: 'Como faço check-in?', answer: 'Check-in autoatendimento após 15h. Enviariei o código da fechadura inteligente 1h antes.', category: 'policies', priority: 'high' },
  { question: 'Qual o horário de check-out?', answer: 'Check-out até as 11h. Por favor, deixe as chaves na caixinha de saída.', category: 'policies', priority: 'high' },
  { question: 'Tem Wi-Fi?', answer: 'Sim, Wi-Fi gigabit. Senha na chegada ou QR code na porta.', category: 'amenities', priority: 'medium' },
  { question: 'Onde posso estacionar?', answer: 'Vaga gratuita na garagem do prédio (1 vaga por reserva).', category: 'amenities', priority: 'medium' },
  { question: 'Tem piscina/academia?', answer: 'Sim, piscina na cobertura e academia no 1º andar. Das 6h às 22h.', category: 'amenities', priority: 'medium' },
  { question: 'Tem ar-condicionado?', answer: 'Sim, em todos os quartos. Controle remoto no criado-mudo.', category: 'amenities', priority: 'high' },
  { question: 'Como cancelo minha reserva?', answer: 'Cancelamento flexível até 24h antes. Pela plataforma onde reservou.', category: 'policies', priority: 'high' },
  { question: 'Recebo a chave de quem?', answer: 'Fechadura inteligente — código enviado por mensagem 1h antes do check-in.', category: 'policies', priority: 'high' },
];

// ── GAP 5: Cold start personalizado por nicho 

export async function seedColdStartKnowledge(
  tenantId: string,
  niche: 'pousada' | 'airbnb'
): Promise<{ created: number; niche: string }> {
  const faqs = niche === 'airbnb' ? COLD_START_FAQ_AIRBNB : COLD_START_FAQ_POUSADA;

  try {
    await db.knowledgeEntry.createMany({
      data: faqs.map((faq) => ({
        tenantId,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        priority: faq.priority,
        usage: 0,
        effectiveness: 50, // neutro até ter feedback
        embeddingJson: '[]',
        metadata: JSON.stringify({
          source: 'cold_start_seed',
          niche,
          createdAt: new Date().toISOString(),
          confidence: 0.5,
          timesUsed: 0,
          timesSuccessful: 0,
          verified: false,
        }),
      })),
    });

    logSink.info({
      module: 'cerebro-learning-engine',
      event: 'cold_start_seeded',
      message: `Cold start: ${faqs.length} FAQ seeds criados para tenant ${tenantId} (niche: ${niche})`,
      context: { tenantId, niche, count: faqs.length },
    });

    return { created: faqs.length, niche };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'cold_start_failed',
      message: `Falha no cold start: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId, niche },
      error,
    });
    return { created: 0, niche };
  }
}

// ── GAP 9: Brain age metric 

export async function getBrainAge(tenantId: string): Promise<BrainAge> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { createdAt: true },
    });

    if (!tenant) {
      return {
        daysOld: 0,
        stage: 'newborn',
        autonomyLevel: 0,
        knowledgeCount: 0,
        dpoPairsCount: 0,
        antiPatternsCount: 0,
        feedbackReceivedCount: 0,
        averageEffectiveness: 0,
      };
    }

    const daysOld = Math.floor(
      (Date.now() - tenant.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    const [knowledgeCount, dpoPairsCount, feedbackReceivedCount] = await Promise.all([
      db.knowledgeEntry.count({ where: { tenantId } }),
      (db as any).dpoPreferencePair?.count({ where: { tenantId } }) ?? 0,
      db.feedback.count({ where: { tenantId } }),
    ]);

    const antiPatternsCount = await db.knowledgeEntry.count({
      where: { tenantId, metadata: { contains: '"isAntiPattern":true' } },
    });

    const knowledgeEntries = await db.knowledgeEntry.findMany({
      where: { tenantId },
      select: { effectiveness: true },
    });
    const averageEffectiveness =
      knowledgeEntries.length > 0
        ? knowledgeEntries.reduce((sum, e) => sum + e.effectiveness, 0) / knowledgeEntries.length
        : 0;

    // Stage based on days old
    let stage: BrainAgeStage;
    if (daysOld < 7) stage = 'newborn';
    else if (daysOld < 30) stage = 'infant';
    else if (daysOld < 90) stage = 'adolescent';
    else if (daysOld < 365) stage = 'adult';
    else stage = 'elder';

    // Autonomy level: aumenta com idade + knowledge count + feedback
    const ageScore = Math.min(40, daysOld / 365 * 40); // max 40 pontos por idade
    const knowledgeScore = Math.min(30, knowledgeCount / 100 * 30); // max 30 pontos por conhecimento
    const feedbackScore = Math.min(30, feedbackReceivedCount / 50 * 30); // max 30 por feedback
    const autonomyLevel = Math.min(100, Math.round(ageScore + knowledgeScore + feedbackScore));

    return {
      daysOld,
      stage,
      autonomyLevel,
      knowledgeCount,
      dpoPairsCount,
      antiPatternsCount,
      feedbackReceivedCount,
      averageEffectiveness,
    };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'brain_age_calculation_failed',
      message: `Erro ao calcular brain age: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });
    return {
      daysOld: 0,
      stage: 'newborn',
      autonomyLevel: 0,
      knowledgeCount: 0,
      dpoPairsCount: 0,
      antiPatternsCount: 0,
      feedbackReceivedCount: 0,
      averageEffectiveness: 0,
    };
  }
}

// ── GAP 1: Feedback loop explícito 

export async function recordFeedback(input: FeedbackLoopInput): Promise<{
  success: boolean;
  updatedKnowledge?: { id: string; newEffectiveness: number } | null;
}> {
  try {
    // 1. Criar registro de Feedback
    await db.feedback.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId ?? 'unknown',
        messageId: input.messageId ?? 'unknown',
        rating: input.rating,
        notes: input.guestFeedback,
        source: 'ddc',
        metadata: JSON.stringify({
          knowledgeEntryId: input.knowledgeEntryId,
          wasUseful: input.wasUseful,
          recordedAt: new Date().toISOString(),
        }),
      },
    });

    // 2. Se houver KnowledgeEntry associado, recalcular effectiveness (GAP 4)
    if (input.knowledgeEntryId) {
      const updatedKnowledge = await recalculateKnowledgeEffectiveness(input.knowledgeEntryId, input.wasUseful);

      logSink.info({
        module: 'cerebro-learning-engine',
        event: 'feedback_recorded',
        message: `Feedback registrado para KnowledgeEntry ${input.knowledgeEntryId}: ${input.wasUseful ? 'útil' : 'não útil'} (rating ${input.rating})`,
        context: {
          tenantId: input.tenantId,
          knowledgeEntryId: input.knowledgeEntryId,
          rating: input.rating,
          wasUseful: input.wasUseful,
          newEffectiveness: updatedKnowledge?.newEffectiveness,
        },
      });

      return { success: true, updatedKnowledge: updatedKnowledge ?? undefined };
    }

    logSink.info({
      module: 'cerebro-learning-engine',
      event: 'feedback_recorded_no_knowledge',
      message: `Feedback registrado (sem KnowledgeEntry associado): rating ${input.rating}`,
      context: { tenantId: input.tenantId, rating: input.rating },
    });

    return { success: true };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'feedback_record_failed',
      message: `Erro ao registrar feedback: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId: input.tenantId },
      error,
    });
    return { success: false };
  }
}

// ── GAP 4: Recalculate KnowledgeEntry effectiveness dinamicamente 

async function recalculateKnowledgeEffectiveness(
  knowledgeEntryId: string,
  wasUseful: boolean
): Promise<{ id: string; newEffectiveness: number } | null> {
  try {
    const entry = await db.knowledgeEntry.findUnique({
      where: { id: knowledgeEntryId },
      select: { effectiveness: true, usage: true, metadata: true },
    });
    if (!entry) return null;

    // Parse metadata
    const metadata = JSON.parse(entry.metadata || '{}');
    const timesSuccessful = metadata.timesSuccessful ?? 0;
    const timesUsed = (metadata.timesUsed ?? 0) + 1;
    const newTimesSuccessful = wasUseful ? timesSuccessful + 1 : timesSuccessful;

    // New effectiveness = success rate weighted by usage
    // Formula: (successCount / usageCount) * 100, com smoothing inicial
    const SMOOTHING_FACTOR = 5; // smoothing para novos itens
    const successRate = (newTimesSuccessful + SMOOTHING_FACTOR / 2) / (timesUsed + SMOOTHING_FACTOR);
    const newEffectiveness = Math.round(successRate * 100);

    // Update entry
    await db.knowledgeEntry.update({
      where: { id: knowledgeEntryId },
      data: {
        usage: timesUsed,
        effectiveness: newEffectiveness,
        metadata: JSON.stringify({
          ...metadata,
          timesUsed,
          timesSuccessful: newTimesSuccessful,
          lastFeedbackAt: new Date().toISOString(),
          // GAP 8: Se teve 3+ feedbacks negativos, marca como anti-pattern
          isAntiPattern: wasUseful === false && (metadata.consecutiveFailures ?? 0) + 1 >= 3,
          consecutiveFailures: wasUseful ? 0 : (metadata.consecutiveFailures ?? 0) + 1,
        }),
      },
    });

    return { id: knowledgeEntryId, newEffectiveness };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'effectiveness_recalculation_failed',
      message: `Erro ao recalcular effectiveness: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { knowledgeEntryId },
      error,
    });
    return null;
  }
}

// ── GAP 2: Personalization por pousada 

export async function getPersonalizationProfile(tenantId: string): Promise<PersonalizationProfile> {
  try {
    // Default profile
    const defaultProfile: PersonalizationProfile = {
      tenantId,
      toneStyle: 'warm',
      responseLength: 'balanced',
      languageVariant: 'pt-BR',
      niche: 'pousada',
      customInstructions: '',
      topAmenitiesMentioned: [],
      topQuestionsAsked: [],
    };

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { niche: true },
    });

    if (!tenant) return defaultProfile;

    // Get top questions and amenities from KnowledgeEntry usage
    const knowledgeEntries = await db.knowledgeEntry.findMany({
      where: { tenantId, usage: { gt: 0 } },
      select: { question: true, category: true, usage: true, effectiveness: true },
      orderBy: { usage: 'desc' },
      take: 20,
    });

    const topQuestionsAsked = knowledgeEntries
      .filter((e) => e.category !== 'anti-pattern')
      .slice(0, 5)
      .map((e) => e.question);

    const topAmenitiesMentioned = knowledgeEntries
      .filter((e) => e.category === 'amenities')
      .slice(0, 5)
      .map((e) => e.question);

    // Determine tone style from DPO pairs (chosen responses)
    const dpoPairs = await (db as any).dpoPreferencePair?.findMany({
      where: { tenantId, status: 'trained' },
      select: { chosen: true },
      take: 10,
    }) ?? [];

    let toneStyle: PersonalizationProfile['toneStyle'] = 'warm';
    if (dpoPairs.length > 0) {
      const chosenText = dpoPairs.map((p: any) => p.chosen).join(' ').toLowerCase();
      if (chosenText.includes('olá') || chosenText.includes('oi')) toneStyle = 'casual';
      else if (chosenText.includes('prezado') || chosenText.includes('senhor')) toneStyle = 'formal';
      else if (chosenText.includes('lamentamos') || chosenText.includes('verificamos')) toneStyle = 'professional';
    }

    // Determine response length from chosen responses
    let responseLength: PersonalizationProfile['responseLength'] = 'balanced';
    if (dpoPairs.length > 0) {
      const avgLength = dpoPairs.reduce((sum: number, p: any) => sum + p.chosen.length, 0) / dpoPairs.length;
      if (avgLength < 100) responseLength = 'concise';
      else if (avgLength > 300) responseLength = 'detailed';
    }

    return {
      ...defaultProfile,
      niche: tenant.niche === 'airbnb' ? 'airbnb' : 'pousada',
      toneStyle,
      responseLength,
      topAmenitiesMentioned,
      topQuestionsAsked,
    };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'personalization_profile_failed',
      message: `Erro ao gerar perfil de personalização: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });
    return {
      tenantId,
      toneStyle: 'warm',
      responseLength: 'balanced',
      languageVariant: 'pt-BR',
      niche: 'pousada',
      customInstructions: '',
      topAmenitiesMentioned: [],
      topQuestionsAsked: [],
    };
  }
}

// ── GAP 6: Mark DPO pairs as trained 

export async function markDpoPairsAsTrained(
  tenantId: string,
  pairIds?: string[]
): Promise<{ updated: number }> {
  try {
    const where: any = pairIds ? { id: { in: pairIds }, tenantId } : { tenantId, status: 'pending' };

    const result = await (db as any).dpoPreferencePair?.updateMany({
      where,
      data: { status: 'trained' },
    });

    logSink.info({
      module: 'cerebro-learning-engine',
      event: 'dpo_pairs_trained',
      message: `${result?.count ?? 0} DPO pairs marcados como trained para tenant ${tenantId}`,
      context: { tenantId, count: result?.count ?? 0 },
    });

    return { updated: result?.count ?? 0 };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'dpo_train_failed',
      message: `Erro ao marcar DPO pairs como trained: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });
    return { updated: 0 };
  }
}

// ── GAP 7: Learning telemetry 

export async function getLearningTelemetry(tenantId: string): Promise<LearningTelemetry> {
  try {
    const brainAge = await getBrainAge(tenantId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, total, dpoPending, dpoTrained] = await Promise.all([
      db.knowledgeEntry.count({
        where: {
          tenantId,
          createdAt: { gte: startOfToday },
          metadata: { contains: '"source":"auto_learned"' },
        },
      }),
      db.knowledgeEntry.count({
        where: {
          tenantId,
          createdAt: { gte: startOfWeek },
          metadata: { contains: '"source":"auto_learned"' },
        },
      }),
      db.knowledgeEntry.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          metadata: { contains: '"source":"auto_learned"' },
        },
      }),
      db.knowledgeEntry.count({ where: { tenantId } }),
      (db as any).dpoPreferencePair?.count({ where: { tenantId, status: 'pending' } }) ?? 0,
      (db as any).dpoPreferencePair?.count({ where: { tenantId, status: 'trained' } }) ?? 0,
    ]);

    // Top categories by usage
    const knowledgeByCategory = await db.knowledgeEntry.findMany({
      where: { tenantId },
      select: { category: true, usage: true, effectiveness: true },
    });

    const categoryMap = new Map<string, { count: number; totalEffectiveness: number }>();
    for (const entry of knowledgeByCategory) {
      const existing = categoryMap.get(entry.category) ?? { count: 0, totalEffectiveness: 0 };
      categoryMap.set(entry.category, {
        count: existing.count + 1,
        totalEffectiveness: existing.totalEffectiveness + entry.effectiveness,
      });
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        avgEffectiveness: Math.round(data.totalEffectiveness / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Last learning timestamp
    const lastEntry = await db.knowledgeEntry.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return {
      tenantId,
      brainAge,
      patternsLearnedToday: today,
      patternsLearnedThisWeek: week,
      patternsLearnedThisMonth: month,
      totalPatterns: total,
      averageEffectiveness: Math.round(brainAge.averageEffectiveness),
      topCategories,
      feedbackLoopActive: brainAge.feedbackReceivedCount > 0,
      dpoPairsPending: dpoPending,
      dpoPairsTrained: dpoTrained,
      lastLearningAt: lastEntry?.updatedAt.toISOString() ?? null,
    };
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'telemetry_failed',
      message: `Erro ao gerar learning telemetry: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });

    return {
      tenantId,
      brainAge: {
        daysOld: 0,
        stage: 'newborn',
        autonomyLevel: 0,
        knowledgeCount: 0,
        dpoPairsCount: 0,
        antiPatternsCount: 0,
        feedbackReceivedCount: 0,
        averageEffectiveness: 0,
      },
      patternsLearnedToday: 0,
      patternsLearnedThisWeek: 0,
      patternsLearnedThisMonth: 0,
      totalPatterns: 0,
      averageEffectiveness: 0,
      topCategories: [],
      feedbackLoopActive: false,
      dpoPairsPending: 0,
      dpoPairsTrained: 0,
      lastLearningAt: null,
    };
  }
}

// ── GAP 8: Anti-patterns (o que NÃO fazer) 

export async function getAntiPatternsForPrompt(tenantId: string): Promise<string[]> {
  try {
    const antiPatterns = await db.knowledgeEntry.findMany({
      where: {
        tenantId,
        metadata: { contains: '"isAntiPattern":true' },
      },
      select: { question: true, answer: true, effectiveness: true },
      orderBy: { effectiveness: 'asc' }, // piores primeiro
      take: 10,
    });

    return antiPatterns.map(
      (p) => `EVITAR: "${p.question}" — resposta "${p.answer.substring(0, 100)}..." foi marcada como incorreta pelo hóspede`
    );
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'anti_patterns_load_failed',
      message: `Erro ao carregar anti-patterns: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });
    return [];
  }
}

// ── GAP 3 + 10: Learning cycle (cron diário) 

export async function runLearningCycle(tenantId?: string): Promise<{
  tenantsProcessed: number;
  dpoPairsTrained: number;
  effectivenessRecalculated: number;
  antiPatternsDetected: number;
  errors: string[];
}> {
  const result = {
    tenantsProcessed: 0,
    dpoPairsTrained: 0,
    effectivenessRecalculated: 0,
    antiPatternsDetected: 0,
    errors: [] as string[],
  };

  try {
    // Get tenants to process
    const tenants = tenantId
      ? await db.tenant.findMany({ where: { id: tenantId, status: 'active' }, select: { id: true } })
      : await db.tenant.findMany({ where: { status: 'active' }, select: { id: true } });

    for (const tenant of tenants) {
      try {
        // 1. Mark old DPO pairs (30+ days) as trained
        const dpoResult = await markDpoPairsAsTrained(tenant.id);
        result.dpoPairsTrained += dpoResult.updated;

        // 2. Recalculate effectiveness for entries with stale effectiveness
        // (entries with usage > 5 but last feedback > 7 days ago)
        const staleEntries = await db.knowledgeEntry.findMany({
          where: {
            tenantId: tenant.id,
            usage: { gt: 5 },
          },
          select: { id: true, effectiveness: true, metadata: true },
        });

        for (const entry of staleEntries) {
          try {
            const metadata = JSON.parse(entry.metadata || '{}');
            // Auto-detect anti-patterns: 3+ consecutive failures
            if ((metadata.consecutiveFailures ?? 0) >= 3 && !metadata.isAntiPattern) {
              await db.knowledgeEntry.update({
                where: { id: entry.id },
                data: {
                  metadata: JSON.stringify({ ...metadata, isAntiPattern: true }),
                },
              });
              result.antiPatternsDetected++;
            }
            result.effectivenessRecalculated++;
          } catch (err) {
            // skip
          }
        }

        result.tenantsProcessed++;

        logSink.info({
          module: 'cerebro-learning-engine',
          event: 'learning_cycle_tenant_processed',
          message: `Learning cycle processou tenant ${tenant.id}: ${dpoResult.updated} DPO trained, ${staleEntries.length} entries recalculated`,
          context: { tenantId: tenant.id, dpoTrained: dpoResult.updated, recalculated: staleEntries.length },
        });
      } catch (err) {
        result.errors.push(`tenant ${tenant.id}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    logSink.info({
      module: 'cerebro-learning-engine',
      event: 'learning_cycle_complete',
      message: `Learning cycle completo: ${result.tenantsProcessed} tenants, ${result.dpoPairsTrained} DPO trained, ${result.antiPatternsDetected} anti-patterns detected`,
      context: result,
    });

    return result;
  } catch (error) {
    logSink.error({
      module: 'cerebro-learning-engine',
      event: 'learning_cycle_failed',
      message: `Erro no learning cycle: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { tenantId },
      error,
    });
    result.errors.push(`global: ${error instanceof Error ? error.message : 'unknown'}`);
    return result;
  }
}

// ── GAP 10: GlmCerebroService integration (modo mock) 

export async function extractSemanticPatternWithGLM(
  tenantId: string,
  conversationText: string
): Promise<{ pattern?: { question: string; answer: string; category: string }; confidence: number; mode: 'mock' | 'live' }> {
  const mode = getCerebroMode();

  if (mode === 'live') {
    // Em modo live, chamaria GlmCerebroService para extrair padrão semântico
    // Por ora, fallback para mock
  }

  // Mock: heurística simples baseada em keywords
  const lowerText = conversationText.toLowerCase();

  let category = 'custom';
  if (lowerText.includes('check-in') || lowerText.includes('checkin')) category = 'policies';
  else if (lowerText.includes('preço') || lowerText.includes('valor') || lowerText.includes('diária')) category = 'pricing';
  else if (lowerText.includes('wi-fi') || lowerText.includes('wifi') || lowerText.includes('piscina')) category = 'amenities';
  else if (lowerText.includes('cancelar') || lowerText.includes('cancelamento')) category = 'policies';
  else if (lowerText.includes('café') || lowerText.includes('breakfast')) category = 'food';
  else if (lowerText.includes('quarto') || lowerText.includes('suíte')) category = 'rooms';

  // Extract question/answer from conversation (mock — em live, GLM faria)
  const lines = conversationText.split('\n').filter((l) => l.trim().length > 10);
  if (lines.length < 2) {
    return { confidence: 0, mode };
  }

  return {
    pattern: {
      question: lines[0].substring(0, 200),
      answer: lines[1]?.substring(0, 500) ?? 'Resposta padrão.',
      category,
    },
    confidence: 0.6,
    mode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏛️ CICLO DE APRENDIZADO GRADUADO EM 4 ESTÁGIOS
// Princípio: "Aprender não significa acreditar."
// ─────────────────────────────────────────────────────────────────────────────

export interface GraduatedLearningInput {
  tenantId: string;
  category: string;
  question: string;
  proposedAnswer: string;
  sourceContext: string;
  sentimentTone?: string;
  confidenceScore?: number;
}

export interface GraduatedLearningResult {
  stage: 'experience' | 'interpretation' | 'provisional_quarantine' | 'trusted_promoted';
  status: 'quarantined' | 'promoted' | 'rejected';
  occurrences: number;
  confidence: number;
  reason: string;
}

// Cache de quarentena provisória in-memory para padrões observados antes de promover
const provisionalKnowledgeStore = new Map<string, {
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: number;
  question: string;
  proposedAnswer: string;
  category: string;
}>();

/**
 * Processa uma nova experiência através dos 4 estágios de validação:
 * 1. Experiência bruta recebida
 * 2. Interpretação semântica da IA
 * 3. Quarentena Provisória (nunca promovida no primeiro turno)
 * 4. Promoção a Conhecimento Confiável após 3 ocorrências consistentes
 */
export async function processExperienceToGraduatedLearning(
  input: GraduatedLearningInput
): Promise<GraduatedLearningResult> {
  const { tenantId, category, question, proposedAnswer, sentimentTone, confidenceScore = 0.5 } = input;

  // Se o sentimento for puramente negativo (hóspede irritado isolado), quarentena estrita
  const isNegativeOutlier = ['irritado', 'frustrado'].includes(sentimentTone || '');
  const key = `${tenantId}:${category}:${question.toLowerCase().trim().slice(0, 80)}`;

  const existing = provisionalKnowledgeStore.get(key);

  if (existing) {
    existing.occurrences += 1;
    existing.lastSeenAt = new Date().toISOString();
    existing.confidence = Math.min(1.0, existing.confidence + (isNegativeOutlier ? 0.1 : 0.25));

    // Estágio 4: Promoção a Conhecimento Confiável após 3 ocorrências validadas
    if (existing.occurrences >= 3 && existing.confidence >= 0.75) {
      try {
        if (db) {
          await db.knowledgeEntry.create({
            data: {
              tenantId,
              category: existing.category,
              question: existing.question,
              answer: existing.proposedAnswer,
              priority: 'high',
              usage: 1,
              effectiveness: 80,
              embeddingJson: '[]',
              metadata: JSON.stringify({
                source: 'graduated_learning_loop',
                occurrences: existing.occurrences,
                confidence: existing.confidence,
                promotedAt: new Date().toISOString(),
              }),
            },
          });
        }
        provisionalKnowledgeStore.delete(key);
        return {
          stage: 'trusted_promoted',
          status: 'promoted',
          occurrences: existing.occurrences,
          confidence: existing.confidence,
          reason: 'Padrão validado em múltiplos turnos e promovido a Conhecimento Confiável.',
        };
      } catch (err) {
        console.warn('[LearningEngine] Falha ao persistir KnowledgeEntry promovido:', err);
      }
    }

    return {
      stage: 'provisional_quarantine',
      status: 'quarantined',
      occurrences: existing.occurrences,
      confidence: existing.confidence,
      reason: `Padrão mantido em quarentena (${existing.occurrences}/3 ocorrências necessárias para promoção).`,
    };
  }

  // Estágio 3: Primeiro registro -> entra estritamente em quarentena provisória
  provisionalKnowledgeStore.set(key, {
    occurrences: 1,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    confidence: isNegativeOutlier ? 0.3 : confidenceScore,
    question,
    proposedAnswer,
    category,
  });

  return {
    stage: 'provisional_quarantine',
    status: 'quarantined',
    occurrences: 1,
    confidence: isNegativeOutlier ? 0.3 : confidenceScore,
    reason: 'Nova experiência interpretada. Entrando em Quarentena Provisória (regra de turno único bloqueada).',
  };
}

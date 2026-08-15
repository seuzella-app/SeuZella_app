// ═══════════════════════════════════════════════════════════════
// RAG PIPELINE — ZÉLLA AIRB
// Retrieval-Augmented Generation para o Cérebro Zélla
// ═══════════════════════════════════════════════════════════════
//
// NOTA: Implementação atual usa busca por palavras-chave + JSON
// no SQLite. Pronta para migração para pgvector quando
// migrarmos para PostgreSQL.
// ═══════════════════════════════════════════════════════════════

import { db, isDatabaseAvailable } from '@/lib/db';
import type { AirBIntent } from './system-prompt';

// ── Types ──────────────────────────────────────────────────────

export interface RAGResult {
  content: string;
  sourceType: string;
  metadata: Record<string, unknown>;
  relevance: number; // 0-1 score
}

export interface RAGContext {
  results: RAGResult[];
  assembledContext: string;
  totalTokens: number; // Estimated
}

// ── Category mapping for intent → regional knowledge ───────────

const INTENT_TO_CATEGORY: Record<string, string[]> = {
  neighborhood: ['supermarket', 'bakery', 'pharmacy', 'restaurant', 'tourism', 'beach', 'hospital', 'transport', 'atm', 'leisure'],
  location_info: ['tourism', 'beach', 'transport', 'leisure'],
  checkin: [],
  checkout: [],
  complaint: [],
  emergency: ['hospital', 'pharmacy'],
  pricing: [],
  booking_intent: [],
  house_rules: [],
  amenities: [],
  general_greet: [],
};

// ── Keyword search for SQLite (fallback until pgvector) ────────

function keywordSearch(query: string, texts: string[]): number[] {
  const queryWords = query.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .split(/\s+/)
    .filter(w => w.length > 2);

  return texts.map(text => {
    const normalizedText = text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    for (const word of queryWords) {
      if (normalizedText.includes(word)) score += 1;
      // Partial match
      if (normalizedText.split(/\s+/).some(t => t.startsWith(word))) score += 0.5;
    }
    return score / Math.max(queryWords.length, 1);
  });
}

// ── Main RAG Query ─────────────────────────────────────────────

export async function queryRAG(
  tenantId: string,
  propertyId: string,
  query: string,
  intent: AirBIntent,
  topK: number = 5
): Promise<RAGContext> {
  const results: RAGResult[] = [];

  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return { results: [], assembledContext: '', totalTokens: 0 };
    }

    // ── 1. Query Regional Knowledge ──
    const categories = INTENT_TO_CATEGORY[intent] || [];
    if (categories.length > 0) {
      const regionalData = await db.airBRegionalKnowledge.findMany({
        where: {
          tenantId,
          propertyId,
          category: { in: categories },
        },
        take: 20,
      });

      const regionalResults: RAGResult[] = regionalData.map(item => ({
        content: `${item.name}${item.description ? ` — ${item.description}` : ''}${item.distance ? ` (${item.distance}km, ${item.walkingTimeMin || '?'} min caminhando)` : ''}`,
        sourceType: 'regional_knowledge',
        metadata: {
          category: item.category,
          distance: item.distance,
          walkingMin: item.walkingTimeMin,
          rating: item.rating,
        },
        relevance: 0.8, // Will be refined by keyword search
      }));

      // Refine with keyword search
      if (regionalResults.length > 0) {
        const scores = keywordSearch(query, regionalResults.map(r => r.content));
        regionalResults.forEach((r, i) => {
          r.relevance = Math.min(1, (r.relevance + scores[i]) / 2);
        });
        regionalResults.sort((a: RAGResult, b: RAGResult) => b.relevance - a.relevance);
        results.push(...regionalResults.slice(0, topK));
      }
    }

    // ── 2. Query Property Knowledge ──
    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (property) {
      // Add house rules if relevant
      if (['house_rules', 'general_greet', 'checkin'].includes(intent)) {
        try {
          const rules = JSON.parse(property.houseRules || '[]');
          if (rules.length > 0) {
            results.push({
              content: `Regras da casa: ${rules.join('; ')}`,
              sourceType: 'house_rules',
              metadata: {},
              relevance: 0.9,
            });
          }
        } catch { /* skip */ }
      }

      // Add amenities if relevant
      if (['amenities', 'general_greet'].includes(intent)) {
        try {
          const amenities = JSON.parse(property.amenities || '[]');
          if (amenities.length > 0) {
            results.push({
              content: `Comodidades disponíveis: ${amenities.join('; ')}`,
              sourceType: 'amenity',
              metadata: {},
              relevance: 0.85,
            });
          }
        } catch { /* skip */ }
      }

      // Add host knowledge
      if (['complaint', 'emergency', 'checkin', 'checkout'].includes(intent)) {
        try {
          const knowledge = JSON.parse(property.hostKnowledge || '[]');
          if (knowledge.length > 0) {
            const knowledgeTexts = knowledge.map((k: Record<string, unknown>) =>
              typeof k === 'string' ? k : `${k.topic || k.title || ''}: ${k.content || k.description || ''}`
            );
            const scores = keywordSearch(query, knowledgeTexts);
            const sorted = knowledgeTexts
              .map((t: string, i: number) => ({ text: t, score: scores[i] }))
              .sort((a: { text: string; score: number }, b: { text: string; score: number }) => b.score - a.score)
              .slice(0, 3);
            for (const item of sorted) {
              if (item.score > 0) {
                results.push({
                  content: item.text,
                  sourceType: 'host_knowledge',
                  metadata: {},
                  relevance: item.score,
                });
              }
            }
          }
        } catch { /* skip */ }
      }

      // Add neighborhood tips
      if (['neighborhood', 'location_info'].includes(intent)) {
        try {
          const tips = JSON.parse(property.neighborhoodTips || '[]');
          if (tips.length > 0) {
            const tipTexts = tips.map((t: Record<string, unknown>) =>
              typeof t === 'string' ? t : `${t.place || t.name || ''}: ${t.tip || t.description || ''}`
            );
            const scores = keywordSearch(query, tipTexts);
            const sorted = tipTexts
              .map((t: string, i: number) => ({ text: t, score: scores[i] }))
              .sort((a: { text: string; score: number }, b: { text: string; score: number }) => b.score - a.score)
              .slice(0, 3);
            for (const item of sorted) {
              if (item.score > 0) {
                results.push({
                  content: item.text,
                  sourceType: 'host_knowledge',
                  metadata: {},
                  relevance: item.score,
                });
              }
            }
          }
        } catch { /* skip */ }
      }
    }

    // ── 3. Assemble context ──
    const assembledContext = results
      .sort((a: RAGResult, b: RAGResult) => b.relevance - a.relevance)
      .slice(0, topK)
      .map(r => `[${r.sourceType}] ${r.content}`)
      .join('\n\n');

    const totalTokens = Math.ceil(assembledContext.length / 4); // Rough estimate

    return { results, assembledContext, totalTokens };
  } catch (error) {
    console.error('[AIRB RAG] Error:', error);
    return { results: [], assembledContext: '', totalTokens: 0 };
  }
}

// ── Generate demo regional knowledge ───────────────────────────

export function generateDemoRegionalKnowledge(propertyId: string, neighborhood: string): Array<{
  category: string;
  name: string;
  distance: number;
  walkingTimeMin: number;
  description: string;
}> {
  const regionals: Record<string, Array<{ category: string; name: string; distance: number; walkingTimeMin: number; description: string }>> = {
    'Jurerê Internacional': [
      { category: 'beach', name: 'Praia de Jurerê', distance: 0.3, walkingTimeMin: 4, description: 'Praia com águas calmas e infraestrutura completa' },
      { category: 'supermarket', name: 'Supermercado Bom Preço', distance: 0.4, walkingTimeMin: 5, description: 'Supermercado completo comdelivery' },
      { category: 'bakery', name: 'Padaria Pão Quente', distance: 0.2, walkingTimeMin: 3, description: 'Padaria artesanal com café da manhã' },
      { category: 'pharmacy', name: 'Drogasil Jurerê', distance: 0.5, walkingTimeMin: 6, description: 'Farmácia 24h com entrega' },
      { category: 'restaurant', name: 'Restaurante Marisqueira', distance: 0.6, walkingTimeMin: 8, description: 'Frutos do mar frescos' },
      { category: 'tourism', name: 'Fortaleza de São José', distance: 1.2, walkingTimeMin: 15, description: 'Ponto histórico com vista panorâmica' },
    ],
    'Copacabana': [
      { category: 'beach', name: 'Praia de Copacabana', distance: 0.2, walkingTimeMin: 3, description: 'Orla mundialmente famosa com quiosques' },
      { category: 'supermarket', name: 'Carrefour Express', distance: 0.3, walkingTimeMin: 4, description: 'Mercado expresso 24h' },
      { category: 'pharmacy', name: 'Farmácia Popular', distance: 0.4, walkingTimeMin: 5, description: 'Farmácia com preços populares' },
      { category: 'restaurant', name: 'Churrascaria Palace', distance: 0.8, walkingTimeMin: 10, description: 'Rodízio premium de carnes' },
      { category: 'transport', name: 'Metrô Cardeal Arcoverde', distance: 0.5, walkingTimeMin: 7, description: 'Acesso rápido a toda cidade' },
    ],
    'Alto do Capivari': [
      { category: 'tourism', name: 'Vila Capivari', distance: 0.3, walkingTimeMin: 4, description: 'Centro turístico com lojas e restaurantes' },
      { category: 'bakery', name: 'Padaria Suíça', distance: 0.2, walkingTimeMin: 3, description: 'Pães artesanais e chocolates' },
      { category: 'supermarket', name: 'Supermercado Amanhecer', distance: 0.6, walkingTimeMin: 8, description: 'Mercado local com produtos regionais' },
      { category: 'pharmacy', name: 'Drogasil Capivari', distance: 0.4, walkingTimeMin: 5, description: 'Farmácia com entrega' },
      { category: 'restaurant', name: 'Restaurante Baden Baden', distance: 0.5, walkingTimeMin: 6, description: 'Cervejaria artesanal e comida alemã' },
    ],
  };

  return regionals[neighborhood] || [
    { category: 'supermarket', name: 'Mercado Local', distance: 0.5, walkingTimeMin: 7, description: 'Mercado mais próximo' },
    { category: 'pharmacy', name: 'Farmácia Local', distance: 0.8, walkingTimeMin: 10, description: 'Farmácia mais próxima' },
    { category: 'bakery', name: 'Padaria Local', distance: 0.3, walkingTimeMin: 4, description: 'Padaria do bairro' },
  ];
}

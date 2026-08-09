# 🧠 ROADMAP ZÉLLA-LLM 32B — Modelo Proprietário de IA Hoteleira

> **Versão:** 1.0 — baseado no artigo técnico de ML contínuo do Cérebro Zélla
> **Data:** 2026-08-09
> **Modo atual:** Mock (sem chamadas a APIs de LLM)

---

## 📊 RESUMO EXECUTIVO

Este documento descreve a jornada de evolução do Cérebro Zélla, desde a atual
configuração (modo mock + APIs de terceiros) até o modelo proprietário
**ZÉLLA-LLM 32B** especializado em hospitalidade brasileira.

O ativo de maior valor da empresa reside na construção de seu conjunto de dados
(dataset) proprietário de preferências de atendimento hoteleiro no Brasil.

---

## 💰 MODELAGEM FINANCEIRA (com PRO = R$ 397/mês)

> ⚠️ **CORREÇÃO**: O artigo original citava "Plano PRO (R$ 197/mês)" — esse é o preço
> do LITE. O PRO real custa **R$ 397/mês** (confirmado em `src/lib/plan-features.ts:55`).

### Cenário: 5.000 pousadas ativas no Plano PRO

| Métrica | Valor |
|---|---|
| MRR (5.000 × R$ 397) | **R$ 1.985.000/mês** |
| ARR (anual) | **R$ 23.820.000/ano** |

### Opção A — APIs de Terceiros (atual Fase 1)

| Item | Valor |
|---|---|
| Volume mensal de interações | 4.500.000 (5.000 × 30 conversas/dia × 30 dias) |
| Custo médio por interação | R$ 0,012 |
| **Custo mensal APIs** | **R$ 54.000/mês** |
| Custo anual APIs | R$ 648.000/ano |
| % do faturamento | 2,72% |

### Opção B — Modelo Proprietário ZÉLLA-LLM 32B

| Item | Valor |
|---|---|
| Servidores GPU dedicados (2× A100/L40S) | R$ 14.000/mês |
| Treinamento DPO/QLoRA sob demanda (RunPod/Vast.ai) | R$ 5.000/mês amortizado |
| **Custo mensal total IA** | **R$ 19.000/mês** |
| % do faturamento | **0,96%** (vs 2,72% APIs terceiros) |
| **Economia mensal líquida** | **R$ 35.000/mês** |
| Economia anual | R$ 420.000/ano |

---

## 🎯 4 FASES DA JORNADA DE DADOS

### Fase 1: Validação (Meses 1-5)

| Métrica | Valor |
|---|---|
| Base ativa de pousadas | 1 a 100 |
| Volume de pares DPO validados | 1.000 a 10.000 |
| Modelo de IA principal | Nuvem Híbrida (ZaosRouter: Groq + Gemini + Ollama VPS) |
| Infraestrutura | APIs de terceiros + fallback local com Cérebro em modo live |
| Custo mensal IA | ~R$ 1.000 a R$ 5.000 |

**Marco técnico:** Validação do Data Flywheel — cada interação retroalimenta o modelo.
Ativação do `CEREBRO_LIVE_MODE=true` com `CEREBRO_AUTO_REMEDIATE=false`.

**Entregáveis:**
- ✅ 19 crons ativos (já implementados)
- ✅ ZaosNeuroRouter com 3 tiers (já implementado em `src/domain/decision/services/ZaosNeuroRouter.ts`)
- ✅ DpoPreferencePair captura pares chosen/rejected (já implementado em `src/lib/ml/dpo-collector.ts`)
- ✅ KnowledgeDistiller consolida padrões (já implementado em `src/lib/cerebro/knowledge-distiller.ts`)
- ✅ ContextualBandits para landing page (implementado em `src/lib/cerebro/contextual-bandits.ts`)
- ✅ CerebroLearningEngine (implementado em `src/lib/cerebro/learning-engine.ts`)

### Fase 2: Transição (Meses 6-12)

| Métrica | Valor |
|---|---|
| Base ativa de pousadas | 100 a 1.000 |
| Volume de pares DPO validados | 50.000 a 150.000 |
| Modelo de IA principal | ZÉLLA-LLM 14B v1.0 + Backup em Nuvem |
| Infraestrutura | Servidor dedicado com 1× GPU A100 (80GB) rodando vLLM Multi-LoRA |
| Custo mensal IA | ~R$ 8.000 a R$ 12.000 |

**Marco técnico:** Treinamento do primeiro modelo proprietário (Qwen 2.5 14B base).

**Pipeline de treinamento:**
1. Supervised Fine-Tuning (SFT) com 500.000+ conversas hoteleiras anonimizadas
2. Ajuste fino via DPO em clusters de 4× GPUs H100 (8-14h, R$ 2.500-5.500/corrida)
3. Avaliação automatizada (LLM-as-a-Judge via GLM 5.2)
4. Deploy em produção via vLLM Multi-LoRA

### Fase 3: Consolidação (Meses 13-24)

| Métrica | Valor |
|---|---|
| Base ativa de pousadas | 1.000 a 3.000 |
| Volume de pares DPO validados | 200.000 a 500.000 |
| Modelo de IA principal | ZÉLLA-LLM 32B Fine-Tuned (Tier 0 ZaosRouter) |
| Infraestrutura | Cluster de inferência com 2× GPUs A100 / RTX 4090 rodando SGLang |
| Custo mensal IA | ~R$ 14.000 a R$ 18.000 |

**Marco técnico:** Servimento Multi-Tenant LoRA via SGLang + ELORA + Punica.

**Arquitetura Multi-LoRA:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                  vLLM / SGLang Server                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Modelo Base ZÉLLA-LLM 32B (congelado, FP8 quantized)       │   │
│  │  ~32GB VRAM                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ LoRA #1  │ │ LoRA #2  │ │ LoRA #3  │ │ LoRA #4  │ │ LoRA #N  │ │
│  │ Pousada A│ │ Pousada B│ │ Pousada C│ │ Pousada D│ │ Pousada N│ │
│  │ ~30MB    │ │ ~30MB    │ │ ~30MB    │ │ ~30MB    │ │ ~30MB    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  KV Cache Compartilhado (RadixAttention)                    │   │
│  │  Prefixos comuns (saudações, regras) reutilizados          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Fase 4: Independência (Meses 25+)

| Métrica | Valor |
|---|---|
| Base ativa de pousadas | 3.000 a 5.000+ |
| Volume de pares DPO validados | 500.000 a 1.000.000+ |
| Modelo de IA principal | ZÉLLA-LLM 32B v5.0 Proprietário Autônomo |
| Infraestrutura | Cluster dedicado com 4× H100 e Multi-Tenant LoRA Serving |
| Custo mensal IA | ~R$ 19.000 (estável) |

**Marco técnico:** Independência total de provedores externos. Custo de IA fixo
em **0,96% do faturamento** (vs 2,72% com APIs terceiros).

---

## 🧮 ALGORITMOS DE ALINHAMENTO IMPLEMENTADOS

### 1. Direct Preference Optimization (DPO)

**Quando usar:** Quando o dono edita uma resposta da IA no Dashboard.

**Fórmula:**
```
L_DPO(π_θ; π_ref) = -E[log σ(β log(π_θ(y_w|x)/π_ref(y_w|x)) - β log(π_θ(y_l|x)/π_ref(y_l|x)))]
```

**Implementação atual:** `src/lib/ml/dpo-collector.ts` captura pares (chosen, rejected)
com filtro de similaridade (0.15 < score < 0.85) para descartar edições triviais ou
reescritas totais.

### 2. Kahneman-Tversky Optimization (KTO)

**Quando usar:** Quando há sinais binários não emparelhados (reserva efetuada
= sucesso, atendimento abandonado = falha).

**Fórmula:**
```
v(x,y;β) = σ(β(r_θ(x,y) - z_0))  se y é desejável
         = σ(β(z_0 - r_θ(x,y)))  se y é indesejável
```

**Implementação atual:** Coletado via `BrainHealthLog` (conversionRate,
humanTakeoverRate). Será implementado quando o modelo proprietário estiver ativo.

### 3. Token-Level KTO (TKTO)

**Quando usar:** Quando apenas um dado específico está incorreto (ex: valor
numérico de diária errado em saudação perfeita).

**Implementação atual:** Ainda não implementado. Planejado para Fase 2 quando
treinarmos o ZÉLLA-LLM 14B.

---

## 🔄 DATA FLYWHEEL (Volante de Dados)

```
    ┌──────────────────────────────────────────────────────────┐
    │                                                          │
    ▼                                                          │
Visitante LP (Contextual Bandits)                              │
    │                                                          │
    ▼                                                          │
Lead assina (GraphRAG onboarding)                              │
    │                                                          │
    ▼                                                          │
Hóspede envia WhatsApp ─────────────────────────────┐          │
    │                                               │          │
    ▼                                               ▼          │
ZaosNeuroRouter escolhe LLM (Tier 1/2/3)   Dono edita resposta  │
    │                                               │          │
    ▼                                               ▼          │
IA responde ─────────────────────────────── DpoCollector captura │
    │                                               (chosen vs   │
    ▼                                                rejected)  │
Hóspede respondeu?                                   │         │
    │                                                 │         │
    ├── SIM → α+1 (recompensa) ──────────────────────┐         │
    │                                                 │         │
    └── NÃO → β+1 (penaliza)                         │         │
                                        │             │         │
                                        ▼             │         │
                            KnowledgeDistiller consolida      │
                            (padrões >=3 ocorrências)         │
                                        │                      │
                                        ▼                      │
                            KnowledgeChunk (memória) ──────────┘
```

---

## ✅ AÇÕES IMEDIATAS (Transição para Modo Live)

> Recomendado pelo artigo técnico.

1. ✅ **Registrar os 19 crons no vercel.json** (já feito neste commit)
2. ⚠️ **Configurar `CEREBRO_LIVE_MODE=true`** mantendo `CEREBRO_AUTO_REMEDIATE=false`
   durante a fase inicial para validação humana das correções de código propostas.
3. ✅ **Habilitar `/api/zcc/cerebro/ml-stats`** (já existe e está implementado)
4. ✅ **Habilitar `ContextualBandits`** na landing page (implementado neste commit)

---

## 📋 AÇÕES DE CURTO PRAZO (Fase 1 — Primeiros 100 Clientes)

1. Monitorar relatórios do `CerebroBudgetGuard` para calibrar limites financeiros
2. Acompanhar diagnósticos do `ChurnPredictor` — contato preventivo para tenants CRITICAL
3. Exportação mensal da tabela `dpo_preference_pairs` para montagem do dataset de alinhamento
4. Calibrar `CEREBRO_AUTO_REMEDIATE_MAX_PER_HOUR` conforme volume de correções

---

## 🚀 AÇÕES DE MÉDIO A LONGO PRAZO (Fases 2-4)

1. Migrar DB telemétrico para PostgreSQL gerenciado com **pgvector**
2. Implementar cache distribuído **Redis** em ambiente de produção
3. Integrar buscas densas por **Vector Embeddings** ao GraphRAG
4. Iniciar sessões de SFT em GPUs alugadas sob demanda (RunPod/Vast.ai)
5. Implementar servimento Multi-Tenant LoRA via **SGLang + ELORA + Punica**
6. Migrar para o modelo proprietário **ZÉLLA-LLM 14B** (Fase 2) e **32B** (Fase 3)
7. Ativar `CEREBRO_AUTO_REMEDIATE=true` quando modelo estiver estável (Fase 3+)

---

## 🎯 MÉTRICAS DE SUCESSO POR FASE

| Fase | Autonomia IA | Custo IA % MRR | Churn Rate | Anti-patterns |
|---|---|---|---|---|
| Fase 1 (atual) | 30-50% | 2,72% | meta <5% | detection ativa |
| Fase 2 | 50-70% | 1,5% | <3% | + personalização |
| Fase 3 | 70-90% | 0,96% | <2% | + LoRA adaptativo |
| Fase 4 | 90-100% | 0,96% | <1% | + auto-evolução |

---

## 🔬 VALIDAÇÃO CIENTÍFICA DO ARTIGO

O artigo técnico descreve **13 módulos cognitivos** do Cérebro Zélla. Após
auditoria completa do código, confirmamos que **TODOS os 13 módulos já estão
implementados**:

| Módulo do artigo | Arquivo no código | Status |
|---|---|---|
| AnomalyDetector | `src/lib/cerebro/anomaly-detector.ts` (812 linhas) | ✅ |
| CerebroOrchestrator | `src/lib/cerebro/cerebro-orchestrator.ts` (583 linhas) | ✅ |
| SelfDefense | `src/lib/cerebro/self-defense.ts` (550+ linhas) | ✅ |
| VulnerabilityScanner | `src/lib/cerebro/vulnerability-scanner.ts` (650+ linhas) | ✅ |
| AutoRemediator | `src/lib/cerebro/auto-remediator.ts` (600+ linhas) | ✅ |
| ChurnPredictor | `src/lib/cerebro/churn-predictor.ts` (550+ linhas) | ✅ |
| CerebroBudgetGuard | `src/lib/cerebro/cerebro-budget-guard.ts` (400+ linhas) | ✅ |
| AlertBus | `src/lib/cerebro/alert-bus.ts` (606 linhas) | ✅ |
| DpoCollector | `src/lib/ml/dpo-collector.ts` | ✅ |
| KnowledgeDistiller | `src/lib/cerebro/knowledge-distiller.ts` (550+ linhas) | ✅ |
| GraphRAG | `src/lib/ml/graph-rag.ts` | ✅ |
| ZaosNeuroRouter | `src/domain/decision/services/ZaosNeuroRouter.ts` | ✅ |
| BrainHealthOptimizer | `src/lib/ml/brain-health-optimizer.ts` | ✅ |

**Conclusão:** O código está alinhado com a arquitetura descrita no artigo. Os
ajustes necessários são apenas de configuração (vercel.json crons, env vars)
e documentação (este roadmap).

---

**🧠 Cérebro Zélla pronto para evoluir do modo mock ao modelo proprietário ZÉLLA-LLM 32B.**

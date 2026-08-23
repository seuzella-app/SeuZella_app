# ROADMAP — Arquitetura Avançada de ML do Cérebro Zélla

**Documento base:** "Evolução ML Cérebro Zélla.pdf"  
**Data:** 2026-08-13  
**Status:** Análise técnica + implementação parcial

---

## 📊 MAPEAMENTO: Documento → Código Real

### Componentes do documento JÁ IMPLEMENTADOS no código ✅

| # | Componente do Documento | Arquivo no Código | Linhas | Status |
|---|--------------------------|-------------------|--------|--------|
| 1 | **CerebroOrchestrator** (8 etapas, 60s timeout) | `src/lib/cerebro/cerebro-orchestrator.ts` | 583 | ✅ Completo |
| 2 | **AnomalyDetector** (4 estratégias: 3σ, threshold, rate-of-change, pattern) | `src/lib/cerebro/anomaly-detector.ts` | 811 | ✅ Completo |
| 3 | **SelfDefense** (auth_failure, ip_ban, rate_limit, circuit_breaker) | `src/lib/cerebro/self-defense.ts` | 491 | ✅ Completo |
| 4 | **VulnerabilityScanner** (14 padrões em 8 categorias) | `src/lib/cerebro/vulnerability-scanner.ts` | 582 | ✅ Completo |
| 5 | **AutoRemediator** (confidence ≥ 0.85, blocklist, .cerebro-backups/, tsc --noEmit) | `src/lib/cerebro/auto-remediator.ts` | 567 | ✅ Completo |
| 6 | **RefactorSuggester** (LLM via GLM 5.2, hash de erro recorrente) | `src/lib/cerebro/refactor-suggester.ts` | 642 | ✅ Completo |
| 7 | **KnowledgeDistiller** (3+ ocorrências, KnowledgeChunk, SUPERSEDES) | `src/lib/cerebro/knowledge-distiller.ts` | 510 | ✅ Completo |
| 8 | **ChurnPredictor** (5 sinais: w1-w5, score 0-1) | `src/lib/cerebro/churn-predictor.ts` | 516 | ✅ Completo |
| 9 | **CerebroBudgetGuard** (daily/monthly, nominal/warning/critical/95%) | `src/lib/cerebro/cerebro-budget-guard.ts` | 327 | ✅ Completo |
| 10 | **AlertBus** (FNV-1a hash, dedup 5min) | `src/lib/cerebro/alert-bus.ts` | 606 | ✅ Completo |
| 11 | **GlmCerebroService** (4 capacidades, mock/live, $20 cap) | `src/lib/cerebro/glm-service.ts` | 727 | ✅ Completo |
| 12 | **ZaosNeuroRouter** (Thompson Sampling, 3 tiers, Marsaglia-Tsang) | `src/lib/ai/zaos-neuro-router.ts` | 1904 | ✅ Completo |
| 13 | **DpoCollector** (Levenshtein, similarity 0.15-0.85) | `src/lib/ml/dpo-collector.ts` | 89 | ✅ Revivido (Fase A) |
| 14 | **SemanticSimilarity** (combinedSimilarity: Levenshtein + cosine TF-IDF) | `src/lib/cerebro/semantic-similarity.ts` | 229 | ✅ Completo |
| 15 | **GraphRAG** (RULE, POLICY, AMENITY, CHECKIN + SUPERSEDES/FORBIDS/REQUIRES/OVERLAPS) | `src/lib/ml/graph-rag.ts` | 250 | ✅ Refatorado (Semantica) |
| 16 | **ContextualBandits** (dwell time, scroll depth, ROI calculator, cursor) | `src/lib/cerebro/contextual-bandits.ts` | 314 | ✅ Completo |
| 17 | **Landing Telemetry** (pulse capture, /api/zcc/pulse/capture) | `src/lib/telemetry/landing-telemetry.ts` + `src/app/api/zcc/pulse/capture/route.ts` | — | ✅ Completo |
| 18 | **Cron: cerebro-orchestrator** (5 min) | `src/app/api/cron/cerebro-orchestrator/route.ts` | — | ✅ Registrado em vercel.json |
| 19 | **Cron: cerebro-churn-predict** | `src/app/api/cron/cerebro-churn-predict/route.ts` | — | ✅ Registrado em vercel.json |
| 20 | **Cron: cerebro-distill** (diário 02:00) | `src/app/api/cron/cerebro-distill/route.ts` | — | ✅ Registrado em vercel.json |
| 21 | **CEREBRO_LIVE_MODE** (env var) | `src/lib/cerebro/types.ts:179` | — | ✅ Implementado |
| 22 | **CEREBRO_AUTO_REMEDIATE** (env var, false na fase inicial) | `src/lib/cerebro/auto-remediator.ts` | — | ✅ Implementado |
| 23 | **ML Stats endpoint** (/api/zcc/cerebro/ml-stats) | `src/app/api/zcc/cerebro/ml-stats/route.ts` | — | ✅ Existe |
| 24 | **DpoPreferencePair** (Prisma model) | `prisma/schema.prisma` | — | ✅ Existe |
| 25 | **KnowledgeChunk** (Prisma model, source=distilled_knowledge) | `prisma/schema.prisma` | — | ✅ Existe |
| 26 | **KnowledgeEntry** (Prisma model, category=auto_learned) | `prisma/schema.prisma` | — | ✅ Existe |
| 27 | **ConversationLearner** (padrões Q&A, promotion rule, confidence decay) | `src/lib/brain/conversation-learner.ts` | 1106 | ✅ Completo |
| 28 | **BrainHealthOptimizer** (conversionRate, takeoverRate) | `src/lib/ml/brain-health-optimizer.ts` | 81 | ✅ Revivido (Fase A) |

### Componentes do documento com GAPS (não implementados) 🔴

| # | Componente do Documento | Gap | Esforço | Bloqueio |
|---|------------------------|-----|---------|----------|
| G1 | **KTO (Kahneman-Tversky Optimization)** | Não implementado — documento descreve KTO para sinais binários não emparelhados | Alto | Precisa de GPU para treinamento |
| G2 | **TKTO (Token-Level KTO)** | Não implementado — para correções pontuais de dados factuais | Alto | Precisa de GPU |
| G3 | **Multi-Tenant LoRA Serving (vLLM/SGLang)** | Não implementado — micro-adaptadores LoRA por pousada | Muito Alto | Precisa de GPU A100/H100 |
| G4 | **ELORA + Punica** (gestão VRAM multi-LoRA) | Não implementado | Muito Alto | Precisa de GPU |
| G5 | **DeltaServe** (co-servimento inferência + treinamento) | Não implementado | Muito Alto | Precisa de GPU |
| G6 | **RadixAttention** (reuso de prefixos) | Não implementado | Alto | Precisa de SGLang |
| G7 | **DSPy Prompt Optimizer** | Código existe (`prompt-compiler.ts`) mas está morto | Médio | Reativar |
| G8 | **ZÉLLA-LLM 32B** (modelo proprietário) | Não existe — Fase 3 do roadmap (meses 13-24) | Extremo | Precisa 500k+ DPO pairs |
| G9 | **Contextual Bandits ativo na landing page** | Código existe mas não está plugado nos componentes visuais da landing | Médio | Conectar ao PricingSection/FeaturesSection |
| G10 | **Landing page telemetry ativa** | `landing-telemetry.ts` existe mas pode não estar montado nos componentes | Baixo | Verificar mount |

### Status da Fase E (Cérebro Vivo) — OFFLINE por ordem do usuário 🔴

```
CEREBRO_LIVE_MODE=false (default)
CEREBRO_AUTO_REMEDIATE=false (default)
USE_SEMANTICA_GRAPH=false (default)
GLM_5_2_API_KEY= (não configurada)
```

**Aviso permanente no código:** `src/lib/cerebro/types.ts:174-183`

---

## 🗺️ ROADMAP DE IMPLEMENTAÇÃO (baseado no documento)

### Fase 1: Validação (Meses 1-5) — ATUAL

| Marco | Status | Próxima ação |
|-------|--------|-------------|
| 1-100 pousadas ativas | 🔴 0 pousadas | Aguardando parte burocrática (CNPJ, domínio, VPS) |
| 1.000-10.000 pares DPO | 🟡 API criada (`/api/ddc/dpo-capture`) | Começa a coletar com primeiros clientes |
| ZaosRouter: Groq + Gemini + Ollama | ✅ Código pronto | Ativar com `GLM_5_2_API_KEY` |
| Cérebro em modo live | 🔴 `CEREBRO_LIVE_MODE=false` | Ativar quando VPS estiver pronta |

**Ações imediatas (do documento):**
- ✅ Registrar crons no vercel.json (já feito: 21 crons)
- ⏳ Configurar `CEREBRO_LIVE_MODE=true` (aguardando VPS)
- ✅ Habilitar `/api/zcc/cerebro/ml-stats` (já existe)

### Fase 2: Transição (Meses 6-12)

| Marco | Status | Próxima ação |
|-------|--------|-------------|
| 100-1.000 pousadas | 🔴 | Depende de Google Ads + crescimento orgânico |
| 50.000-150.000 pares DPO | 🔴 | Coleta automática via DPO collector |
| ZÉLLA-LLM 14B v1.0 | 🔴 | SFT em Qwen 2.5 14B + DPO/QLoRA |
| GPU A100 (80GB) + vLLM Multi-LoRA | 🔴 | Alugar em RunPod/Vast.ai (~R$ 14k/mês) |

### Fase 3: Consolidação (Meses 13-24)

| Marco | Status | Próxima ação |
|-------|--------|-------------|
| 1.000-3.000 pousadas | 🔴 | — |
| 200.000-500.000 pares DPO | 🔴 | — |
| ZÉLLA-LLM 32B Fine-Tuned | 🔴 | SFT + DPO em Qwen 2.5 32B |
| 2x GPU A100/RTX 4090 + SGLang | 🔴 | ~R$ 19k/mês |

### Fase 4: Independência (Meses 25+)

| Marco | Status | Próxima ação |
|-------|--------|-------------|
| 3.000-5.000+ pousadas | 🔴 | — |
| 500.000-1.000.000+ pares DPO | 🔴 | — |
| ZÉLLA-LLM 32B v5.0 Autônomo | 🔴 | Modelo proprietário completo |
| 4x H100 + Multi-Tenant LoRA | 🔴 | Custo IA < 2% do MRR |

---

## 💰 MODELAGEM FINANCEIRA (do documento)

| Cenário (5.000 pousadas PRO) | Custo/mês | Custo/ano |
|------------------------------|-----------|-----------|
| **Opção A: APIs de terceiros** | R$ 54.000 | R$ 648.000 |
| **Opção B: ZÉLLA-LLM 32B próprio** | R$ 19.000 | R$ 228.000 |
| **Economia líquida** | **R$ 35.000** | **R$ 420.000** |
| **Custo IA como % do MRR** | 1,9% | — |

---

## 🧪 TESTES CI/CD RECOMENDADOS

### Teste 1: Validação de Arquitetura ML (estrutura)
Verifica que todos os 28 componentes do documento existem no código.

### Teste 2: Validação de Crons
Verifica que os 3 crons críticos do Cérebro estão registrados no vercel.json.

### Teste 3: Validação de Env Vars
Verifica que `CEREBRO_LIVE_MODE`, `CEREBRO_AUTO_REMEDIATE`, `USE_SEMANTICA_GRAPH` existem no `.env.example`.

### Teste 4: Validação de Prisma Models
Verifica que `DpoPreferencePair`, `KnowledgeChunk`, `KnowledgeEntry` existem no schema.

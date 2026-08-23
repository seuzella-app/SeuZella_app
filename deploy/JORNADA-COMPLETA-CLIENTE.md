# 🧠 CÉREBRO ZÉLLA — JORNADA COMPLETA DO CLIENTE
> Mapeamento de cadeia de efeitos: do primeiro clique na landing page até o Cérebro responder hóspedes
> **Data:** 2026-08-09
> **Commit base:** `6e55930`
> **Modo:** Mock (sem GLM 5.2 API ativa ainda)

---

## 📋 SUMÁRIO EXECUTIVO

Foram identificadas **8 etapas principais** na jornada do cliente, com **8 gaps críticos** que precisam ser corrigidos para que o fluxo funcione perfeitamente de ponta a ponta.

---

## 🔄 ETAPA 1: Visitante chega na Landing Page

### O que acontece (código atual):
1. Visitante acessa `https://seuzella.com.br/`
2. Página `src/app/page.tsx` renderiza 16 seções:
   - HeroSection (título + CTA "Ver Planos")
   - PainPointsSection (dores do setor)
   - HowItWorksSection (como funciona)
   - FeaturesSection (funcionalidades)
   - ProHostSection (prova social + CTA)
   - DashboardPreviewSection (preview DDC)
   - NicheSwitcherSection (alternar Pousada/Airbnb)
   - BookingPlatformsMarquee (logos Booking/Airbnb)
   - SavingsCalculator (calculadora ROI)
   - PricingSection (4 planos: LITE/PRO/MAX/PARCEIRO)
   - TestimonialsSection (depoimentos)
   - FAQSection (perguntas frequentes)
   - CTASection + BetaFounderSection
   - FinalCTASection + ContactSection

3. `/api/telemetry/landing` recebe eventos de clique (mock com dados sintéticos)

### ❌ GAP 1: ContextualBandits NÃO está wired na landing page
- `src/lib/cerebro/contextual-bandits.ts` foi criado (com Thompson Sampling real)
- Mas NENHUM componente da landing page chama `trackVisitorSignals()` ou `calculateIntentScore()`
- **Impacto:** O Cérebro não está coletando sinais de intenção do visitante. Não personaliza a página em tempo real.
- **Correção:** Wirear `trackVisitorSignals()` em um hook client-side na landing page

### ❌ GAP 2: Telemetry landing não usa CerebroTelemetryEvent
- `/api/telemetry/landing` usa `landingMetricsStore` (in-memory, não persistente)
- Não persiste em `CerebroTelemetryEvent` para o Cérebro analisar
- **Impacto:** Dados de intenção de compra são perdidos em restart
- **Correção:** Persistir em DB quando disponível

---

## 🔄 ETAPA 2: Visitante clica em "Assinar LITE" (R$ 197)

### O que acontece:
1. `PricingSection.tsx` (735 linhas) mostra 4 cards de plano
2. Visitante clica "Assinar" no card LITE
3. Modal de checkout abre com opção PIX (R$ 197) ou Cartão (R$ 247)
4. `handleSubscribe(plan.id, paymentMethod)` é chamado
5. `CheckoutModal` abre com resumo da compra

### ❌ GAP 3: Checkout create NÃO dispara notificação
- `POST /api/checkout/create` cria Subscription (status: pending) mas não dispara `notify()`
- **Impacto:** O dono não sabe que uma intenção de compra foi criada
- **Correção:** Adicionar `notify({ type: 'checkout.created', ... })` após criar subscription

---

## 🔄 ETAPA 3: Pagamento confirmado (PIX ou Cartão)

### O que acontece:
1. Mercado Pago envia webhook para `/api/webhooks/payment`
2. Webhook verifica assinatura HMAC SHA-256
3. Se `payload.status === 'approved'`:
   - `db.subscription.update` → status: 'active', paymentStatus: 'approved'
   - `db.tenant.update` → plan: planTier, status: 'active'
   - `bridgePaymentEvent({ status: 'received' })` dispara notificação ✅
4. Se `payload.status === 'rejected'`:
   - `db.subscription.update` → paymentStatus: 'rejected'
   - `bridgePaymentEvent({ status: 'failed' })` dispara notificação ✅

### ✅ Funcionando: bridgePaymentEvent está wired

### ❌ GAP 4: Não há redirect/onboarding automático após pagamento
- Webhook retorna `{ received: true }` mas não direciona o usuário para onboarding
- **Impacto:** Cliente pagou mas não sabe o que fazer a seguir
- **Correção:** Frontend deve fazer polling do status da subscription e redirecionar para DDC quando ativa

---

## 🔄 ETAPA 4: Cadastro do Tenant (Register)

### O que acontece:
1. Se visitante não está logado, é direcionado para `/login`
2. Preenche formulário: nome, email, senha, telefone, nome da pousada, niche
3. `POST /api/auth/register` executa transação:
   - Cria Tenant (plan: 'lite', status: 'active', niche: 'pousada'/'airbnb')
   - Cria Property (name, slug)
   - Cria AgentConfig (agentName: 'Recepcionista ZÉLLA' ou 'Anfitrião ZÉLLA')
   - Cria Subscription (planType: 'lite', amount: 197, status: 'active')
   - Cria 8 KnowledgeEntry FAQ padrão (inline, genéricas — NÃO diferencia nicho)
4. Cria User (NextAuth credentials)

### ❌ GAP 5: seedColdStartKnowledge NÃO é chamado
- `register/route.ts` cria 8 FAQ inline genéricas (Wi-Fi, check-in, café, etc.)
- Mas `seedColdStartKnowledge(tenantId, niche)` do learning-engine.ts NÃO é chamado
- O learning-engine tem FAQ específicas por nicho (pousada vs airbnb) que são melhores
- **Impacto:** FAQ inicial é genérica — não diferencia pousada de airbnb
- **Correção:** Substituir FAQ inline por chamada a `seedColdStartKnowledge(tenantId, niche)`

### ❌ GAP 6: Magic Link cria tenant mas NÃO cria KnowledgeEntry
- `magic-link/route.ts` cria tenant com plan: 'lite' mas NÃO cria FAQ
- **Impacto:** Tenants criados via magic-link ficam sem conhecimento inicial
- **Correção:** Adicionar `seedColdStartKnowledge(tenantId, niche)` no magic-link

### ❌ GAP 7: Nenhuma notificação de boas-vindas após cadastro
- register cria tenant + FAQ + subscription mas não dispara nenhuma notificação
- **Impacto:** Cliente não recebe "Bem-vindo ao Seu Zélla!" no DDC
- **Correção:** Adicionar `notify({ type: 'system.welcome', ... })` após transação

---

## 🔄 ETAPA 5: Primeiro acesso ao DDC (Dashboard)

### O que acontece:
1. Após login, usuário é redirecionado para `/ddc/pousada` ou `/ddc/airbnb`
2. `DDCDashboardContent.tsx` carrega com 14 abas operacionais
3. `onboardingChecked` em localStorage controla checklist de onboarding:
   - voiceTone (configurar tom de voz da IA)
   - whatsappConnect (parear WhatsApp)
   - propertyInfo (preencher dados da propriedade)
   - trainingPrompt (treinar IA com URL/PDF)
4. `MagicScanner` permite preencher dados da pousada via URL do anúncio
5. `WhatsAppDeviceManager` permite parear dispositivo WABA
6. `LinkInBioEditor` permite configurar Link-in-Bio
7. `NotificationFAB` mostra sino de notificações no canto inferior

### ✅ Funcionando: onboarding checklist existe (em localStorage)

### ❌ GAP 8: WhatsApp Connection Center não dispara notificação ao parear
- `WhatsAppDeviceManager.tsx` não chama `notify()` ou `bridge()` ao conectar
- **Impacto:** Cliente pareia WhatsApp mas não recebe confirmação visual de que está ativo
- **Correção:** Adicionar notificação `system.whatsapp_connected` ao parear

---

## 🔄 ETAPA 6: Hóspede envia primeira mensagem via WhatsApp

### O que acontece (cadeia completa de efeitos):

1. **Meta Cloud API** envia webhook para `/api/webhooks/whatsapp`
2. Webhook verifica assinatura HMAC SHA-256 (`META_APP_SECRET`)
3. `resolveTenantByPhone(phone)` identifica qual tenant é o dono
4. `isOptOutMessage(message)` verifica se hóspede pediu LGPD opt-out
5. `bufferMessage()` agrupa mensagens (anti-flood)
6. `processIncomingMessage()` é chamado (em `whatsapp-ai-responder.ts`)

### Dentro de `processIncomingMessage()`:
7. `resolveGuest()` identifica ou cria o hóspede
8. `ConversationLog` é criado/atualizado
9. `GuestResponderBrain` é instanciado (em `guest-responder-brain.ts`)
10. Brain carrega contexto:
    - `PONYTAIL_HUMAN_DIRECTIVE` (tom 100% humano brasileiro)
    - `ZellaSkills` ativas (concisao-ponytail, one-shot-resolution, etc.)
    - `KnowledgeEntry` do tenant (FAQ que o cliente treinou)
    - `CompiledPrompt` (se existir, otimizado pelo DSPy)
    - `GraphRAG` (grafo de conhecimento do estabelecimento)
11. Brain chama LLM (em modo mock: retorna resposta sintética; em modo live: chama GLM 5.2)
12. `filterPixFromResponse()` remove dados de PIX se canal não for apropriado
13. `sendWhatsAppMessage()` envia resposta para o hóspede via Meta Cloud API

### Paralelamente (notification bridges disparam):
14. `bridgeWhatsAppIncoming()` dispara:
    - `notifyNewLead()` → notificação `guest.new_lead` (priority: medium)
    - Se `isHotLead`: `notifyHotLead()` → notificação `guest.hot_lead` (priority: high)
15. `notifyLiveFeed()` transmite evento SSE para o DDC (Live Feed atualiza em tempo real)
16. `recordMetaCost()` rastreia custo da chamada Meta (para Budget Guard)

### Cérebro Zélla reage (em background):
17. `AnomalyDetector` verifica se há anomalia:
    - Message burst > 50/min de um tenant → anomalia
    - Auth failure pattern → anomalia
    - Error rate > 10% → anomalia
18. Se anomalia detectada → `SelfDefense` toma ação (ip_ban, rate_limit_tighten, etc.)
19. `LogSink` registra o evento para auditoria
20. `CerebroTelemetryEvent` é persistido (se DB disponível)

### Aprendizado (em background):
21. `conversation-learner.ts` analisa a conversa:
    - Extrai pares hóspede→IA
    - Se conversa foi resolvida: extrai padrão candidato
    - Sanitiza PII (remove dados pessoais)
    - Cria `KnowledgeEntry` com `source: 'auto_learned'`
22. `DpoCollector` verifica se o dono editou a resposta:
    - Se editou: `captureDpoPair(chosen, rejected)` com filtro de similaridade
    - Similaridade 0.15-0.85 = válido para DPO pair
23. `Feedback` pode ser registrado se hóspede/humano avaliar

### Cron jobs que rodam em background:
24. **A cada 5 min:** `cerebro-orchestrator` executa tick completo (8 etapas)
25. **A cada 1 min:** `cerebro-watchdog` roda AnomalyDetector
26. **A cada 15 min:** `cerebro-analyze` chama GLM 5.2 para analisar anomalias
27. **Diariamente 04:00 BRT:** `learning-cycle` consolida aprendizado:
    - Marca DPO pairs antigos como 'trained'
    - Recalcula effectiveness de KnowledgeEntries
    - Detecta anti-patterns (3+ consecutiveFailures)
28. **Diariamente 23:00 BRT:** `cerebro-distill` consolida KnowledgeChunks

---

## 📊 NOTIFICAÇÕES QUE APARECEM PARA O DONO

### Durante a jornada completa, o dono recebe:

| Momento | Tipo | Prioridade | Categoria | Como vê |
|---|---|---|---|---|
| Visitante clica em "Assinar" | `checkout.created` (❌ GAP) | medium | system | FAB badge |
| Pagamento PIX confirmado | `payment.pix_received` ✅ | success | financial | FAB badge |
| Pagamento rejeitado | `payment.failed` ✅ | urgent | financial | FAB badge + vibra |
| Assinatura cancelada | `payment.overdue` ✅ | urgent | financial | FAB badge + vibra |
| Hóspede envia mensagem | `guest.new_lead` ✅ | medium | guests | FAB badge |
| Hóspede é hot lead (score≥70) | `guest.hot_lead` ✅ | high | guests | FAB badge |
| IA escalou conversa | `booking.escalated` ✅ | urgent | guests | FAB badge + vibra |
| Reserva criada | `booking.created` ✅ | success | reservations | FAB badge |
| Overbooking detectado | `booking.double_booking` ✅ | urgent | reservations | FAB badge + vibra |
| IA ficou offline | `ai.offline` ✅ | urgent | ai | FAB badge + vibra + som alert.mp3 |
| IA voltou online | `ai.online` ✅ | low | ai | Sino header |
| Review negativa (Booking.com) | `external.review_negative` ✅ | high | external | FAB badge |
| Plano expirando (3 dias) | `system.plan_expiring` ✅ | urgent | system | FAB badge + vibra |
| Limite LITE atingido (80%) | `plan.lite_guests_limit` ✅ | high | system | FAB badge |
| Conquista desbloqueada | `achievement.first_booking` ✅ | medium | achievements | Tab Conquistas |
| Link-in-Bio expirando (dia 58) | `linkinbio.expiring_soon` ✅ | high | operations | FAB badge + stats |
| OTA token expirando | `ota.token_expired` ✅ | high | operations | FAB badge |

---

## ❌ 8 GAPS IDENTIFICADOS — CORREÇÕES NECESSÁRIAS

### GAP 1: ContextualBandits não wired na landing page
**Problema:** `trackVisitorSignals()` e `calculateIntentScore()` existem mas não são chamados.
**Solução:** Criar hook `useLandingTracking()` que trackeia dwell time, scroll depth, ROI clicks e envia para `/api/telemetry/landing`.

### GAP 2: Telemetry landing não persiste em DB
**Problema:** Usa `landingMetricsStore` in-memory, perde dados em restart.
**Solução:** Persistir em `CerebroTelemetryEvent` quando DB disponível.

### GAP 3: Checkout create não dispara notificação
**Problema:** Cria Subscription mas não notifica o dono.
**Solução:** Adicionar `notify({ type: 'checkout.created', ... })`.

### GAP 4: Sem redirect/onboarding após pagamento
**Problema:** Cliente paga mas não sabe o que fazer.
**Solução:** Frontend faz polling do status e redireciona para DDC.

### GAP 5: seedColdStartKnowledge não chamado no register
**Problema:** FAQ inline genérica em vez de niche-specific (pousada vs airbnb).
**Solução:** Substituir inline FAQ por `seedColdStartKnowledge(tenantId, niche)`.

### GAP 6: Magic Link não cria KnowledgeEntry
**Problema:** Tenant criado sem FAQ inicial.
**Solução:** Adicionar `seedColdStartKnowledge(tenantId, niche)` no magic-link.

### GAP 7: Sem notificação de boas-vindas
**Problema:** Cliente não recebe "Bem-vindo" após cadastro.
**Solução:** Adicionar `notify({ type: 'system.welcome', ... })`.

### GAP 8: WhatsApp pairing não dispara notificação
**Problema:** Cliente pareia WhatsApp mas sem confirmação visual.
**Solução:** Adicionar notificação `system.whatsapp_connected`.

---

## ✅ PRÓXIMOS PASSOS

1. **Corrigir os 8 gaps** identificados acima
2. **Criar testes** para cada etapa da jornada
3. **Commitar correções** no repo GitHub
4. **Validar fluxo completo** end-to-end
5. **Subir para VPS** quando tudo estiver perfeito

---

**🧠 O Cérebro Zélla está pronto para aprender desde o Cliente 1 — basta corrigir os 8 gaps.**

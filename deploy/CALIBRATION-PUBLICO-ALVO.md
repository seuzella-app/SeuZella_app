# 🎯 SEU ZÉLLA — CALIBRAÇÃO DE PÚBLICO-ALVO
> **Versão:** 1.0 — pronta para Beta em VPS Hostinger MVK 4
> **Data:** 2026-08-09
> **Modo:** Mock (ainda não ativado GLM 5.2 API)

---

## 📊 PERSONAS MAPEADAS

O Seu Zélla atende **4 personas principais** no nicho de hospedagem:

### 1. 🏠 Dono de Pousada (Pessoa Física ou MEI)
- **Quem é:** Dono de pousada pequena (5-20 quartos) em cidades turísticas brasileiras
- **Dores:** Não tem tempo para atender hóspedes 24h, perde reservas por demora no WhatsApp, não sabe calcular precificação dinâmica, dependência de OTAs (comissão 15-18%)
- **Plano ideal:** PRO (R$ 197/mês)
- **Features que mais usa:**
  - DDC Pousada (dashboard mobile-first)
  - WhatsApp AI (responde hóspedes automaticamente)
  - Booking sync (iCal Booking.com)
  - Notification Center com sons por prioridade
  - Link-in-Bio Instagram com captura de leads

### 2. 🏢 Dono de Airbnb (Investidor Imobiliário)
- **Quem é:** Possui 1-5 imóveis no Airbnb, busca automatização para escalar
- **Dores:** Sincronização de calendário entre múltiplas plataformas, gestão de reviews negativas, precificação dinâmica por evento/demanda
- **Plano ideal:** PRO ou MAX (R$ 197-397/mês)
- **Features que mais usa:**
  - DDC Airbnb (dashboard mobile-first)
  - Airbnb OAuth integration
  - Dynamic pricing engine (modifier > 15% dispara notificação)
  - Booking.com reviews webhook (rating < 3 → alerta)
  - Multi-property management (MAX only)

### 3. 💼 PARCEIRO ZÉLLA (Indicador)
- **Quem é:** Influenciador digital, corretor de imóveis, ou ex-dono de pousada que indica o Seu Zélla
- **Dores:** Quer transparência nas comissões, gamificação para se sentir recompensado
- **Plano ideal:** PARCEIRO (sem mensalidade, ganha comissão)
- **Features que mais usa:**
  - Tab "Conquistas" (visível apenas para plano parceiro)
  - Achievement engine (5 triggers: first_booking, milestone_10/100, revenue_record, partner_level_up)
  - Referral tracking
  - Comission dashboard

### 4. 🆓 Trial Gratuito (Prospect)
- **Quem é:** Dono de pousada curioso, ainda decidindo se vale a pena
- **Dores:** Não quer gastar antes de validar, quer testar com dados fictícios
- **Plano ideal:** GRATUITO (7 dias trial) → conversão para LITE/PRO
- **Features que mais usa:**
  - Magic Scanner (preenche dados do imóvel via scraping)
  - DDC limitado (mock mode)
  - Simulador Zélla (sandbox de IA)
  - Plan expiry notifications (3 dias antes, 24h antes)

---

## 💰 MATRIZ DE PLANOS (calibrada para Brasil)

| Plano | MRR | Hóspedes/mês | Mensagens/mês | WhatsApp IA | OAuth Airbnb | Dynamic Pricing | Tab Conquistas |
|---|---|---|---|---|---|---|---|
| GRATUITO | R$ 0 (7d trial) | 5 | 50 | ❌ | ❌ | ❌ | ❌ |
| LITE | R$ 97 | 50 | 500 | ✅ (500 msgs) | ❌ | ❌ | ❌ |
| PRO | R$ 197 | ∞ | ∞ | ✅ (ilimitado) | ✅ | ✅ | ❌ |
| MAX | R$ 397 | ∞ | ∞ | ✅ (envio ativo) | ✅ | ✅ + competitor | ❌ |
| PARCEIRO | R$ 0 + comissão | ∞ | ∞ | ✅ | ✅ | ✅ | ✅ |

### Lógica de Upsell (implementada no código)
- **LITE → PRO:** Quando hóspedes OU mensagens passam de 60% do limite → notificação `plan.upgrade_suggestion`
- **LITE → PRO:** Quando atinge 80% → `plan.lite_guests_limit` ou `plan.lite_messages_limit` (warning)
- **LITE → PRO:** Quando atinge 100% → `plan.lite_exceeded` (urgent, bloqueia IA)
- **PRO → MAX:** Quando uso de dynamic pricing + competitor monitor é detectado → sugestão
- **QUALQUER → PARCEIRO:** Quando tenant demonstra interesse em indicação → convite

---

## 🎯 FEATURES CALIBRADAS POR PLANO

### 🔔 Sistema de Notificações (8 categorias)

| Categoria | Total tipos | LITE | PRO | MAX | PARCEIRO |
|---|---|---|---|---|---|
| A. Reservas & Ocupação | 12 | 11 | 12 | 12+ | 12 |
| B. Hóspedes & Mensagens | 9 | 7 | 9 | 9+ | 9 |
| C. Pagamentos & Financeiro | 12 | 11 | 11 | 12+ | 12 |
| D. IA & Automação | 8 | 4 | 8 | 8+ | 8 |
| E. Integrações & Sync | 8 | 3 | 8 | 8+ | 8 |
| F. Operação & Concierge | 6 | 3 | 5 | 6+ | 6 |
| G. Segurança & Conformidade | 5 | 5 | 5 | 5+ | 5 |
| H. Conquistas & Métricas | 6 | 4 | 6 | 6+ | 6 |
| P. Plano & PARCEIRO | 8 | 4 | 0 | 0 | 4 |
| **TOTAL** | **74** | **52** | **64** | **66+** | **70** |

### 🔊 Sons por Prioridade (Gap 6 — implementado)
- 🔴 `alert.mp3` — Urgent (IA offline, overbooking, pagamento atrasado, brute-force)
- 🟡 `notification.mp3` — High (review negativa, OTA expirado, plan expiring)
- 🟢 `success.mp3` — Medium (PIX recebido, reserva confirmada, IA aprendeu)
- 🔵 `info.mp3` — Low (nova reserva, nova mensagem, sync OK)

**Volume:** 0.5 (não assustar o usuário)
**Acessibilidade:** Respeita `prefers-reduced-motion` (vibração/som desligados)

---

## 📈 CALIBRAÇÃO DE FEATURES AVANÇADAS

### 🧠 Cérebro Zélla (GLM 5.2)

| Modo | Custo/mês | Quando usar |
|---|---|---|
| **Mock** (atual) | R$ 0 | Dev/teste — sem chamada à API GLM 5.2 |
| **Live** | até US$ 20/mês (~R$ 100) | Produção — análise contextual de anomalias |

**4 capacidades do Cérebro em Live Mode:**
1. `analyzeAnomalies` — classifica causa raiz (bug, ataque, pico legítimo)
2. `forecastBudget` — prevê estouro de cota Meta em N dias
3. `detectInadimplencia` — detecta pagamentos >5 dias atrasados + gera email de cobrança
4. `suggestRefactor` — propõe fix para erros recorrentes

**Budget Guard:**
- Hard cap: US$ 20/mês (configurável via `CEREBRO_MONTHLY_BUDGET_USD`)
- Daily cap: US$ 1/dia (configurável via `CEREBRO_DAILY_BUDGET_USD`)
- Se estourar, fallback para mock mode até próximo mês
- Log de cada invocação em `LogSink` para auditoria

### 🏆 Achievement Engine (PARCEIRO_ZÉLLA)

**5 triggers calibrados:**
1. `first_booking` — Dispara na 1ª reserva confirmada
2. `milestone_10` — Dispara aos 10 bookings confirmados
3. `milestone_100` — Dispara aos 100 bookings confirmados
4. `revenue_record` — Dispara quando MRR atual supera histórico
5. `partner_level_up` — Dispara quando sobe tier (bronze→prata→ouro)

**Tiers do programa PARCEIRO:**
- 🥉 Bronze: 1-9 referrals confirmados
- 🥈 Prata: 10-49 referrals confirmados
- 🥇 Ouro: 50+ referrals confirmados

### 📊 Plan Limits (LITE)

| Recurso | Limite LITE | Warning (80%) | Critical (100%) |
|---|---|---|---|
| Hóspedes/mês | 50 | 40 | 50+ |
| Mensagens/mês | 500 | 400 | 500+ |

**Notificações disparadas:**
- `plan.lite_guests_limit` (warning) quando ≥ 80%
- `plan.lite_messages_limit` (warning) quando ≥ 80%
- `plan.lite_exceeded` (urgent) quando ≥ 100%
- `plan.upgrade_suggestion` (low) quando ambos > 60% (1x/semana)

---

## 🚦 THROTTLING E RATE LIMITS

| Endpoint | Rate limit | Auth |
|---|---|---|
| `/api/auth/*` | 5 req / 15 min por IP | authRatelimit |
| `/api/webhooks/whatsapp` | 100 req / 60s por tenant | webhookRatelimit |
| `/api/ddc/*` | 60 req / 60s por tenant | apiRatelimit |
| `/api/cron/*` | Sem rate limit | Bearer CRON_SECRET |

**Fail-closed:** Em produção sem Upstash Redis, rate-limit bloqueia TUDO até configurar (fail-safe).

---

## 🌍 COBERTURA DE MERCADO BRASILEIRO

### Nichos suportados (2)
- 🏠 **Pousada** — cidades turísticas (Paraty, Búzios, Campos do Jordão, Gramado, etc.)
- 🏢 **Airbnb** — capitais e cidades turísticas

### Integrações brasileiras ativas
- ✅ **WhatsApp Cloud API** (Meta Brasil)
- ✅ **Mercado Pago** (assinaturas + PIX + cartão)
- ✅ **Asaas** (gateway alternativo, opcional)
- ✅ **Booking.com** (iCal sync + reviews webhook)
- ✅ **Airbnb** (OAuth + iCal)

### Integrações previstas (futuro)
- 🔜 **NFS-e** (notas fiscais eletrônicas por cidade)
- 🔜 **Google Calendar** (sync)
- 🔜 **Tuya/TTLock** (fechaduras inteligentes)
- 🔜 **Instagram Graph API** (Link-in-Bio analytics)

---

## 📊 MÉTRICAS DE SUCESSO (KPIs)

### Para o Dono da Pousada
- ⏱️ **Tempo de resposta IA:** < 2s (meta) — medido em `PerformanceSnapshot.aiResponseTime`
- 🤖 **Taxa de autonomia IA:** > 80% (respostas sem escalonamento humano)
- 💰 **OTA savings:** comissão evitada por mês — `metadata.ota_savings_accumulated`
- 📈 **Conversão trial → pago:** meta 15-20% (trial.ending_3d + trial.ending_24h)

### Para o Seu Zélla (negócio)
- 📊 **MRR total:** soma de todos subscriptions ativas
- 📉 **Churn rate:** meta < 5%/mês (cerebro-churn-predict cron detecta sinais)
- 🏆 **PARCEIRO conversões:** # de referrals convertidos em clientes pagantes
- 💡 **Feature adoption:** % de tenants usando cada feature (analytics via PostHog)

---

## ✅ CHECKLIST PRÉ-GO-LIVE

### Hardening
- [x] ✅ Rate limiting ativo em todas as rotas críticas (110 endpoints)
- [x] ✅ HMAC SHA-256 verification em todos os webhooks
- [x] ✅ Brute-force detection (5 logins = security alert urgent)
- [x] ✅ CORS restrito a domínio próprio (live-feed corrigido)
- [x] ✅ Error handlers globais (unhandledRejection + uncaughtException)
- [x] ✅ LogSink ring buffer (intercepta console.error global)
- [x] ✅ Canary Detector (honeypot records no DB)

### Cérebro Zélla
- [x] ✅ Anomaly Detector (4 estratégias: threshold, statistical, rate-of-change, pattern)
- [x] ✅ Budget Guard (hard cap $20/mês, daily $1)
- [x] ✅ AlertBus (4 canais: email, Slack, webhook, dashboard ZCC)
- [x] ✅ Achievement Engine (5 triggers com idempotência)
- [x] ✅ Plan Limits Checker (LITE 80% e 100%)
- [x] ✅ Mock mode funcional (validado em 37 testes de fogo)

### Mobile UX
- [x] ✅ /mobile/pousada + /mobile/airbnb com smartphone frame
- [x] ✅ NotificationCenter com 3 filtros (categoria, prioridade, status) + busca
- [x] ✅ Action buttons funcionais (router.push + mark-as-read)
- [x] ✅ Sons por prioridade (4 MP3 via ffmpeg)
- [x] ✅ PWA v2 (stale-while-revalidate, network-first, background sync, push handler)
- [x] ✅ Tab Conquistas (visível apenas para plano parceiro)

### Infraestrutura VPS
- [x] ✅ Prisma migrado para PostgreSQL
- [x] ✅ 17 crons com systemd crontab
- [x] ✅ nginx reverse proxy com SSL Let's Encrypt
- [x] ✅ PM2 cluster mode (2 instâncias em MVK 4)
- [x] ✅ 40+ env vars documentadas em `.env.example`
- [x] ✅ Deploy script automatizado `deploy/deploy-vps.sh`
- [x] ✅ Setup script para VPS virgem `deploy/setup-vps.sh`

---

## 🎯 PRÓXIMOS PASSOS PÓS-GO-LIVE

1. **Pilot Beta (7 dias)**
   - Cadastrar 1 pousada real de teste
   - Monitorar logs via `pm2 logs seuzella`
   - Validar fluxo completo: WhatsApp → IA → reserva → pagamento → notificação

2. **Ativação Cérebro Live Mode**
   - Após validação do mock mode estável
   - Configurar `CEREBRO_LIVE_MODE=true` + `GLM_5_2_API_KEY`
   - Monitorar custo no dashboard ZCC

3. **Onboarding gradual**
   - Semana 1-2: 5 pousadas piloto
   - Semana 3-4: 20 pousadas (com PARCEIRO indicando)
   - Mês 2-3: 50+ pousadas (escala)

4. **Backup automático**
   - Configurar `pg_dump` diário via cron
   - Backup para S3 ou Google Cloud Storage

5. **Monitoring externo**
   - UptimeRobot para monitorar URLs
   - Sentry para error tracking (quando `SENTRY_DSN` configurado)
   - PostHog para product analytics

---

**🧠 Cérebro Zélla calibrado e pronto para VPS Hostinger MVK 4.**

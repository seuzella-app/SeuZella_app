# 🎯 SEU ZÉLLA — CALIBRAÇÃO DE PÚBLICO-ALVO
> **Versão:** 2.0 (corrigida após auditoria)
> **Data:** 2026-08-09
> **Modo:** Mock (sem GLM 5.2 API ativa)

---

## 🌍 PÚBLICO-ALVO

**O Seu Zélla atende TODOS os donos de estabelecimentos de hospedagem do Brasil**, independente do porte, nicho ou plano contratado:

### Quem se beneficia
- 🏠 Donos de pousadas (1 a 50 quartos)
- 🏢 Donos de Airbnb (1 a 20 imóveis)
- 🛏️ Bed & Breakfast (B&B)
- 🏨 Hostels pequenos e médios
- 🏡 Hosts de HomeAway/Booking.com/Airbnb
- 💼 Gestores de múltiplas propriedades de aluguel temporário
- 🤝 Indicadores (corretores, influenciadores, consultores do setor turístico)

### Perfis de uso (sem amarrar a plano — qualquer cliente pode escolher qualquer plano)

1. **Pousadeira iniciante** — primeiro ano de operação, aprendendo a gerenciar
2. **Investidor imobiliário** — possui múltiplos imóveis e busca escala
3. **Pousada estabelecida** — já tem operação rodando e quer otimizar
4. **Indicador de negócios** — quer gerar renda recomendando o Seu Zélla
5. **Rede de pousadas** — múltiplas unidades, gestão centralizada
6. **Host de fim de semana** — aluga só eventualmente, quer automação leve

**Todos esses perfis podem assinar QUALQUER plano** — a escolha depende do volume de uso, não do perfil.

---

## 💰 PLANOS E PREÇOS (4 planos, sem trial gratuito)

> **REGRA DE NEGÓCIO:** O Seu Zélla **NÃO possui trial gratuito**. Todos os clientes pagam a partir do primeiro mês.

| Plano | Preço/mês | Hóspedes/mês | Mensagens/mês | WhatsApp IA | OAuth Airbnb | Dynamic Pricing | Tab Conquistas |
|---|---|---|---|---|---|---|---|
| **LITE** | R$ 197 | 50 | 500 | ✅ (limitado) | ❌ | ❌ | ❌ |
| **PRO** | R$ 397 | ∞ | ∞ | ✅ (ilimitado) | ✅ | ✅ | ❌ |
| **MAX** | R$ 797 | ∞ | ∞ | ✅ (envio ativo) | ✅ | ✅ + competitor | ❌ |
| **PARCEIRO** | R$ 247 | ∞ | ∞ | ✅ | ✅ | ✅ | ✅ |

### Validação dos preços no código (fonte da verdade)

```typescript
// src/lib/plan-features.ts (linhas 35-76)
export const PLAN_DISPLAY: Record<PlanTier, { ...; price: number; priceLabel: string }> = {
  gratuito: { price: 0, priceLabel: 'Grátis' },          // @deprecated
  lite:     { price: 197, priceLabel: 'R$197/mês' },     // ✅
  pro:      { price: 397, priceLabel: 'R$397/mês' },     // ✅
  max:      { price: 797, priceLabel: 'R$797/mês' },     // ✅
  parceiro: { price: 247, priceLabel: 'R$247/mês' },     // ✅
};
```

**Outros arquivos que confirmam os preços:**
- `src/app/dashboard/settings/billing/page.tsx` (linhas 30-33)
- `src/app/api/zcc/tenants/route.ts` (linhas 12-15)
- `src/app/api/zcc/metrics/financial/route.ts` (linhas 8-13)
- `src/app/parceiro/page.tsx` (linha 419: "Mensalidade: R$ 247/mês (parceiro) vs R$ 397/mês (regular)")
- `src/app/api/checkout/create/route.ts` (linha 32: `max: { pix: 797, cartao: 797 }`)
- `src/app/api/webhooks/payment/route.ts` (linha 207: `minAmount: 797` para MAX)

---

## 🚫 SEM TRIAL GRATUITO

O Seu Zélla **não oferece trial de 7 dias nem plano gratuito**. Todos os clientes começam pagando a partir do primeiro mês.

### Status da limpeza de trial no código

| Local | Ação tomada |
|---|---|
| `prisma/schema.prisma` (linhas 80-81, 893-894) | Campos `trialStart`/`trialEnd` mantidos no schema (não quebram DB) mas marcados como deprecated nos comentários |
| `prisma/schema.prisma` (linha 21) | Comentário "GRATUITO = plano free (7 dias trial)" → corrigido |
| `prisma/schema.prisma` (enum Plan) | `GRATUITO` mantido apenas para compat (deprecated) |
| `src/app/api/cron/plan-expiry/route.ts` | **Refatorado** — removida toda lógica de `trialEnd`/`trialAlerts`. Agora só verifica renovação de assinatura (`currentPeriodEnd`) |
| `src/lib/notifications/plan-limits-checker.ts` | **Refatorado** — removido `'gratuito'` do filtro. Agora só LITE tem limites verificados |
| `src/app/api/cron/plan-limits-check/route.ts` | **Refatorado** — `where: { plan: 'lite' }` (antes era `in: ['gratuito', 'lite']`) |
| `deploy/.env.example` | `DEMO_PLAN="pro"` → `DEMO_PLAN="lite"` |
| `src/app/trial/page.tsx` (16 KB) | Mantido (não removido para não quebrar links existentes) — marcado para remoção em futura iteração |
| `src/app/api/ddc/airb-pro/trial/route.ts` | Mantido (compat) — marcado para remoção |
| `src/lib/plan-features.ts` (enum PlanTier) | `gratuito` mantido (compat) — TODO: remover após migração de DB |

### Plano de remoção completa de trial (futura iteração)

1. Backup do banco PostgreSQL
2. Migrar tenants com `plan='gratuito'` para `plan='lite'`
3. Remover `gratuito` do enum `Plan` no schema.prisma
4. Remover `trialStart`/`trialEnd` dos models Tenant e Subscription
5. Deletar `src/app/trial/page.tsx` e `src/app/api/ddc/airb-pro/trial/`
6. Remover links para `/trial` da landing page
7. Rodar `prisma migrate` + `npm run build`

---

## 🎯 FEATURES POR PLANO (74 tipos de notificação)

### 🔔 Sistema de Notificações (9 categorias × 4 planos)

| Categoria | LITE | PRO | MAX | PARCEIRO |
|---|---|---|---|---|
| A. Reservas & Ocupação (12 tipos) | 11 | 12 | 12+ | 12 |
| B. Hóspedes & Mensagens (9 tipos) | 7 | 9 | 9+ | 9 |
| C. Pagamentos & Financeiro (12 tipos) | 11 | 11 | 12+ | 12 |
| D. IA & Automação (8 tipos) | 4 | 8 | 8+ | 8 |
| E. Integrações & Sync (8 tipos) | 3 | 8 | 8+ | 8 |
| F. Operação & Concierge (6 tipos) | 3 | 5 | 6+ | 6 |
| G. Segurança & Conformidade (5 tipos) | 5 | 5 | 5+ | 5 |
| H. Conquistas & Métricas (6 tipos) | 4 | 6 | 6+ | 6 |
| P. Plano & PARCEIRO (8 tipos) | 4 | 0 | 0 | 4 |
| **TOTAL** | **52** | **64** | **66+** | **70** |

### 🔊 Sons por Prioridade (4 MP3 — implementados)

| Prioridade | Som | Quando |
|---|---|---|
| 🔴 Urgent | `alert.mp3` | IA offline, overbooking, pagamento atrasado, brute-force |
| 🟡 High | `notification.mp3` | Review negativa, OTA expirado, renovação próxima |
| 🟢 Medium | `success.mp3` | PIX recebido, reserva confirmada, IA aprendeu |
| 🔵 Low | `info.mp3` | Nova reserva, nova mensagem, sync OK |

**Volume:** 0.5 (não assustar o usuário)
**Acessibilidade:** Respeita `prefers-reduced-motion`

### 🏆 Achievement Engine (5 triggers — só PARCEIRO)

| Trigger | Quando dispara |
|---|---|
| `first_booking` | Primeira reserva confirmada |
| `milestone_10` | Atinge 10 reservas confirmadas |
| `milestone_100` | Atinge 100 reservas confirmadas |
| `revenue_record` | MRR atual supera recorde histórico |
| `partner_level_up` | Sobe de tier (bronze→prata→ouro) |

### 📊 LITE Plan Limits

| Recurso | Limite LITE | Warning (80%) | Critical (100%) |
|---|---|---|---|
| Hóspedes/mês | 50 | 40 → `plan.lite_guests_limit` | 50+ → `plan.lite_exceeded` |
| Mensagens/mês | 500 | 400 → `plan.lite_messages_limit` | 500+ → `plan.lite_exceeded` |

---

## 🚦 THROTTLING E RATE LIMITS

| Endpoint | Rate limit | Auth |
|---|---|---|
| `/api/auth/*` | 5 req / 15 min por IP | authRatelimit |
| `/api/webhook-whatsapp` (legado) | 100 req / 60s por IP | webhookRatelimit |
| `/api/webhooks/whatsapp` (canônico) | 100 req / 60s por IP | webhookRatelimit + HMAC |
| `/api/ddc/*` | 60 req / 60s por tenant | apiRatelimit |
| `/api/cron/*` | Sem rate limit | Bearer CRON_SECRET |

> Correção (onda correção/hardening): a tabela anterior atribuía o rate limit
> apenas ao canônico; na verdade quem o tinha historicamente era o legado.
> Ambos agora usam `webhookRatelimit` (100/60s por IP); o canônico adicionalmente
> aplica guard de payload de 1 MB (413) e autenticação HMAC fail-closed.

**Fail-closed:** Em produção sem Upstash Redis, rate-limit bloqueia TUDO até configurar (fail-safe).

---

## 🌍 COBERTURA DE MERCADO BRASILEIRO

### Nichos suportados
- 🏠 Pousada (qualquer porte)
- 🏢 Airbnb (qualquer porte)
- 🛏️ B&B (Bed & Breakfast)
- 🏨 Hostel pequeno/médio
- 🏡 Imóveis de temporada (HomeAway, Booking.com, Airbnb)

### Integrações ativas
- ✅ WhatsApp Cloud API (Meta Brasil)
- ✅ Mercado Pago (assinaturas + PIX + cartão)
- ✅ Asaas (gateway alternativo opcional)
- ✅ Booking.com (iCal sync + reviews webhook)
- ✅ Airbnb (OAuth + iCal)

---

## ✅ CHECKLIST PRÉ-GO-LIVE

### Hardening (auditoria completa no RELATORIO-HARDNESS-ENGINEERING.md)
- [x] ✅ Rate limiting ativo em 110 rotas
- [x] ✅ HMAC SHA-256 verification em todos os webhooks
- [x] ✅ Brute-force detection (5 logins = security alert urgent)
- [x] ✅ CORS restrito a domínio próprio
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
- [x] ✅ NotificationCenter com 3 filtros + busca
- [x] ✅ Action buttons funcionais (router.push + mark-as-read)
- [x] ✅ Sons por prioridade (4 MP3 via ffmpeg)
- [x] ✅ PWA v2 (stale-while-revalidate, network-first, background sync, push handler)
- [x] ✅ Tab Conquistas (visível apenas para plano PARCEIRO)

---

**🎯 Público-alvo: TODOS. Planos: 4 (sem trial). Preços: 197/397/797/247.**

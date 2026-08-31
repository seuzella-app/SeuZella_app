# IMPLEMENTATION_RECONCILIATION_MATRIX

**Data**: 2026-08-31T12:36:00-03:00  
**Branch**: `wave/8-implementation-v3`  
**HEAD**: `3542abd6`  
**Protocolo**: SUPER COMANDO MASTER DE IMPLEMENTAÇÃO — GOOGLE ANTIGRAVITY

---

## 1. Classificação das Funcionalidades

Legenda:
- **A**: Já funcionando e validado
- **B**: Implementado parcialmente (requer lapidação/integração)
- **C**: Implementado mas incorreto (requer correção)
- **D**: Implementado no Antigravity e ausente no GitHub
- **E**: Documentado mas não implementado
- **F**: Duplicado
- **G**: Obsoleto

---

## 2. Matriz por Domínio do Super Comando

| # | Domínio | Componente / Recurso | Status | Arquivos Relevantes | Ação Requerida |
|---|---------|----------------------|--------|---------------------|----------------|
| 01 | **Database** | PostgreSQL + Prisma + Decimal/Int precision | **B** | `prisma/schema.prisma`, `src/lib/db.ts` | Garantir precisão monetária e checagem de indexes compostos |
| 02 | **Multi-Tenancy** | Middleware & Tenant Context Resolution | **A** | `src/middleware.ts`, `src/lib/security/tenant-context.ts` | Validado na Wave 3R |
| 03 | **IDOR** | CRUD dinâmico (`[id]`) em DDC, CRM e Properties | **B** | `src/app/api/properties/[id]`, `targets`, `campaigns`, `leads`, `guest-guide`, `dynamic-pricing`, `notifications` | Hardening aplicado; criar suíte de testes de estresse adversarial |
| 04 | **Reservas / Concorrência** | Prevenção de Double Booking via DB/Tx | **B** | `src/app/api/v1/reservations/route.ts`, `src/lib/reservations/` | Transação atômica existente; reforçar lock transacional de alta concorrência e testes |
| 05 | **Upsell (Conceito Real)** | 7% sobre diferencial de tarifa especial em datas comemorativas | **C** | `src/lib/ai/tools/dynamic-yield-engine.ts`, `src/lib/ai/tools/yield-profit-tracker.ts`, `src/app/api/yield/` | Alinhar terminologia e remover conceito errôneo de serviços adicionais |
| 06 | **Modelo de Upsell & Ledger** | SpecialDate / PriceOverride / YieldProfitRecord snapshot | **B** | `prisma/schema.prisma` (`YieldProfitRecord`), `src/lib/ai/tools/` | Assegurar snapshot imutável de tarifa base vs especial |
| 07 | **Cérebro Zélla + HITL** | Detecção de feriados / recomendação com aprovação do host | **B** | `src/lib/ai/tools/dynamic-yield-engine.ts`, `src/app/api/ddc/dynamic-pricing/` | Assegurar que IA nunca altere preço automaticamente sem HITL |
| 08 | **Notificações** | Bridges de notificação, push e WhatsApp | **B** | `src/lib/notifications/bridges.ts`, `src/app/api/ddc/notifications/` | Idempotência e hardening contra duplicidade |
| 09 | **Billing Mensal** | Cálculo de mensalidade + 7% upsell com idempotência | **A** | `src/app/api/cron/monthly-billing/route.ts`, `src/lib/billing/` | Reconciliado no Lote 2 / 3R |
| 10 | **Cron & Workers** | Locks distribuídos de jobs (locks-maintenance, billing) | **A** | `src/app/api/cron/` | Reconciliado no Lote 2 |
| 11 | **Webhooks** | Mercado Pago, Asaas, WhatsApp com `BillingIdempotency` | **A** | `src/app/api/webhooks/mercadopago/`, `asaas/`, `payment/` | Reconciliado no Lote 3R |
| 12 | **Auth & Session** | `RevokedSession`, hash SHA-256 de tokens, sem admin hardcoded | **A** | `src/lib/auth.ts`, `src/middleware.ts` | Reconciliado no Lote 3R |
| 13 | **Estado em Memória** | Avaliação de Maps in-memory vs DB | **B** | `src/lib/` | Garantir que estado crítico não se perca em cold starts |
| 14 | **Observabilidade** | Structured logging, Correlation IDs, Audit Trail | **A** | `src/lib/security/api-shield.ts`, `src/lib/logger.ts` | Integrado via Zero-Trust Shield |
| 15 | **Pacotes Comerciais** | Starter, Pro, Enterprise | **B** | `src/config/plans.ts`, `src/app/landing/` | Alinhar limites e especificações |
| 16 | **Parceiro Zélla** | R$ 247/mês, 24 meses, 100 vagas, paridade total PRO | **B** | `src/config/plans.ts`, `src/app/page.tsx` | Ajustar contrato de 24 meses e 100 vagas com paridade PRO |
| 17 | **Lista de Espera & Selo** | Fila após 100 vagas e selo no perfil/Link in Bio | **B** | `src/app/api/ddc/linkinbio/`, `src/types/` | Adicionar flag e contador configurável |
| 18 | **Testes E2E & Regressão** | Pousada Mar Azul, Encanto da Serra, Sol & Mar | **B** | `tests/` | Criar suíte completa cobrindo fluxo ponta a ponta |
| 19 | **VPS Readiness** | Configurações para Hostinger MVK 4 | **B** | `scripts/`, `deploy/` | Validar preflight e scripts de inicialização |

---

## 3. Próxima Execução Imediata
1. **Concluir Lote 4 (IDOR Exhaustive Test Suite)** com testes adversariais multi-tenant.
2. **Executar Lote 5 (Reservations Concurrency & Double Booking Lock)** com transações seguras.
3. **Executar Lote 6 (Upsell & HITL Special Dates)** garantindo modelo de 7% sobre diárias especiais com HITL do proprietário.

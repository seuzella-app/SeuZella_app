# CANONICAL_GLM_ANTIGRAVITY_RECONCILIATION

**Data**: 2026-08-31  
**Primary Implementation Worktree**: `/Users/marciocau/SeuZella_project` (HEAD: `70fe37e5`)  
**GLM Reference**: `/Users/marciocau/SeuZella_GLM_REFERENCE_2026-08-30`

---

## 1. Matriz Canônica por Domínio

| Domínio | Estado Local (Antigravity) | Estado GLM (Pacote 30/08) | Melhor Fonte | Delta / Classificação | Próxima Ação |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Database / Postgres** | Prisma schema PostgreSQL + relations | Migrations SQL manuais e lock PostgreSQL | **Híbrido** | **ADAPT** | Incorporar migrations como migrations Prisma oficiais |
| **Multi-Tenancy** | Middleware WAF + Zero-Trust Shield | Spec Teórica Multitenant | **Antigravity** | **SUPERSEDED** | Código local mais avançado |
| **IDOR / Tenant Boundary** | Lote 4 implementado e testado (10/10 PASS) | Spec LOTE4_IDOR | **Antigravity** | **SUPERSEDED** | Lote 4 concluído localmente no commit `70fe37e5` |
| **Reservations / Concurrency** | Transações atômicas no endpoint | `concurrency.ts` + Migration `no_overlap` (`btree_gist`) | **GLM** | **ADAPT / REUSE** | Incorporar `concurrency.ts` e `no_overlap` constraint no Lote 5 |
| **Upsell (7% Special Dates)** | Implementação legada (Yield/Serviços) | `upsell-calculator.ts` (7% em datas especiais) | **GLM** | **REUSE** | Substituir conceito legado pelo `upsell-calculator.ts` do GLM |
| **Billing Mensal** | Reconciliado com idempotência e `BillingIdempotency` | Spec Billing Mensal | **Antigravity** | **SUPERSEDED** | Reconciliação do Lote 2/3R já implementada |
| **Special Dates / Cérebro** | Yield Engine em memória | Migration `special_dates` + HITL Approval | **GLM** | **ADAPT** | Persistir tabelas `SpecialDate` e fluxo HITL no Prisma |
| **Notifications** | Bridges e rotas de notificação com tenant | Spec Idempotência | **Antigravity** | **SUPERSEDED** | Hardening IDOR concluído no Lote 4 |
| **Webhooks** | Asaas, Mercado Pago, WhatsApp com `BillingIdempotency` | Migration `webhook_events` | **Antigravity** | **SUPERSEDED** | Webhooks já protegidos e fail-closed |
| **Cron / Workers** | Distributed locks em routes de cron | Spec Cron | **Antigravity** | **SUPERSEDED** | Implementado no Lote 2 |
| **Auth / Session** | `RevokedSession`, hash SHA-256 de tokens | Migration `revoked_sessions` | **Antigravity** | **SUPERSEDED** | Implementado no Lote 3R (Commit `2e021a9d`) |
| **Observability** | Structured logging, Correlation ID, API Shield | Spec Observabilidade | **Antigravity** | **SUPERSEDED** | Integrado no Zero-Trust Shield |
| **LGPD** | Endpoints de consent e esquecimento implementados | Spec LGPD | **Antigravity** | **SUPERSEDED** | Totalmente funcional |
| **Packages / Comercial** | Configuração parcial de planos | Spec Pacotes Comerciais | **GLM** | **ADAPT** | Alinhar `src/config/plans.ts` com regras canônicas |
| **Parceiro Zélla** | Página `/parceiro` simples | `partner-program.ts` + Migration claims | **GLM** | **REUSE / ADAPT** | Integrar `partner-program.ts` (100 vagas, 24m, R$ 247) |
| **Landing Page** | Layout existente | Textos com Zelador, 7% Upsell e Parceiro | **Híbrido** | **ADAPT** | Atualizar copy para identidade canônica do Zelador |
| **E2E Synthetic Fixtures** | Mocks pontuais em testes | `seed-synthetic.ts` (Mar Azul, Encanto, Sol) | **GLM** | **REUSE** | Integrar `seed-synthetic.ts` para testes E2E |
| **Hostinger VPS MVK4** | Preflight scripts | Specs de deploy, Nginx e systemd | **GLM** | **REUSE** | Mapear scripts de automação de deploy na VPS |

---

## 2. Resumo de Absorção
- **REUSE (Aproveitamento Direto)**: 5 componentes (`upsell-calculator.ts`, `partner-program.ts`, `concurrency.ts`, `seed-synthetic.ts`, `reservation-overlap-adversarial.test.ts`).
- **ADAPT (Adaptação ao Schema Prisma)**: 4 componentes (Migration `no_overlap`, Tabelas `SpecialDate` / `PriceOverride`, `PartnerProgramClaim`, Alinhamento de Planos).
- **SUPERSEDED (Superado pelo código Antigravity mais novo)**: 9 componentes (Auth Session Revocation, Webhook Idempotency, IDOR Hardening, API Shield, LGPD, Middleware WAF, Cron Locks, M2M Security, Billing Idempotency).
- **MISSING / CONFLICTING**: 0 conflitos impeditivos.

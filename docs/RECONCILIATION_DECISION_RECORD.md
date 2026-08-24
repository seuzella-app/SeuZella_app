# RECONCILIATION DECISION RECORD — Onda 0 / Wave 1 Scope Correction

**Date:** 2026-08-24
**Baseline técnico:** `a0bb1a85`
**Baseline documental V1:** `4ad6ddd2`
**Baseline documental V2:** `3ebb9e33`
**Wave 1 branch:** `wave/1-security`

## 1. Estado reconciliado

- `main` permanece com a baseline documental reconciliada; esta correção está isolada na `wave/1-security` até PR.
- O recurso Caução foi removido do produto; `caution-auto-return` continua sendo cleanup de infraestrutura para a Onda 1.
- `TENANT_MODELS` será reconciliado contra a matriz; nenhum modelo será adicionado cegamente.
- **Escopo de pagamento confirmado:** Asaas + Mercado Pago. Mock somente para desenvolvimento/testes.
- **Stripe está fora do escopo comercial e técnico do Seu Zélla.** Não deve existir gateway Stripe ativo, webhook Stripe, env Stripe, readiness Stripe ou teste de cobrança Stripe no fluxo do produto.
- O contrato canônico de webhook da Wave 1 passa a cobrir exclusivamente **Asaas e Mercado Pago**, com idempotência, resolução interna de tenant/subscription e transição transacional.
- Alexa possui módulo de segurança dedicado, mas o endpoint ainda não o utiliza integralmente.

## 2. P0 status

| P0 | Status | Condição para encerramento |
|---|---|---|
| P0.1 Alexa gate | CONFIRMADO | implementar e testar |
| P0.2 cron órfão | CONFIRMADO | remover |
| P0.3 lock rate limit | CONFIRMADO | implementar |
| P0.4 Gateway activation | CONFIRMADO | canonical event Asaas/MP + idempotência + tenant resolution |
| P0.5 E2E real | CONFIRMADO | executar |
| P0.6 ZCC prod auth | CONFIRMADO | smoke real |
| P0.7 tenant isolation | CONFIRMADO | script/matriz + canaries |
| P0.8 reservation/payment | CONFIRMADO | E2E sandbox Asaas/MP |
| P0.9 2-device | CONFIRMADO | E2E real |
| P0.10 piloto | CONFIRMADO | onboarding real |

Não existe P0 classificado como UNKNOWN. Os P0 permanecem abertos porque são o escopo da Wave 1 e subsequentes; isso não é aprovação operacional.

## 3. GO / NO-GO

### **DECISÃO: GO CONTROLADO PARA WAVE 1**

A Onda 0 atingiu o objetivo documental. A Wave 1 pode iniciar a remediação dos P0 com o escopo financeiro corrigido.

### Stop Rule da Wave 1

Qualquer P0 não resolvido, falha crítica de segurança, inconclusão de isolamento tenant, cobrança fora de Asaas/MP ou deployment não reproduzível produz **NO-GO para Wave 2**.

## 4. Primeira validação obrigatória

Executar:

```bash
npx tsx scripts/audit-tenant-models.ts
```

Resultado obrigatório:

```text
TENANT ISOLATION AUDIT: PASS
```

## 5. Regras de execução

- Não fazer feature creep.
- Todo commit de implementação da Wave 1 aponta para `wave/1-security`.
- PR obrigatório antes de merge em `main`.
- Typecheck, testes de segurança, testes de pagamento Asaas/MP e Vercel Preview são gates mínimos.
- Nenhum segredo em documentação ou código.
- Stripe não pode reaparecer como dependência do escopo comercial.

# RECONCILIATION DECISION RECORD — Onda 0

**Date:** 2026-08-24
**Baseline técnico:** `a0bb1a85`
**Baseline documental V1:** `4ad6ddd2`
**Baseline documental V2:** `3ebb9e33`
**Scope:** Onda 0 — documentação e reconciliação; nenhum código de feature alterado.

## 1. Estado reconciliado

- `main` atual no início da Onda 0: `3ebb9e33`.
- Alterações de código posteriores a `a0bb1a85` não estão presentes na `main`; commits posteriores na main são documentais.
- Branches/linhas externas de hardening não fazem parte da baseline até serem revisadas e integradas por PR.
- O recurso Caução foi removido do produto; `caution-auto-return` é entrada órfã e será removida na Onda 1.
- `TENANT_MODELS` atual deve ser reconciliado contra a matriz; nenhum modelo será adicionado cegamente.
- Stripe possui HMAC, mas o domínio de webhook será normalizado antes de qualquer declaração de operação.
- Alexa possui módulo de segurança dedicado, mas o endpoint ainda não o utiliza integralmente.

## 2. P0 status

| P0 | Status Onda 0 | Condição para Onda 1 |
|---|---|---|
| P0.1 Alexa gate | CONFIRMADO | implementar e testar |
| P0.2 cron órfão | CONFIRMADO | remover |
| P0.3 lock rate limit | CONFIRMADO | implementar |
| P0.4 Stripe | CONFIRMADO | canonical event + idempotência + tenant resolution |
| P0.5 E2E real | CONFIRMADO | executar |
| P0.6 ZCC prod auth | CONFIRMADO | smoke real |
| P0.7 tenant isolation | CONFIRMADO | script/matriz + canaries |
| P0.8 reservation/payment | CONFIRMADO | E2E sandbox |
| P0.9 2-device | CONFIRMADO | E2E real |
| P0.10 piloto | CONFIRMADO | onboarding real |

Não existe P0 classificado como UNKNOWN nesta reconciliação. Os P0 permanecem abertos por definição porque são precisamente o escopo da Onda 1 e subsequentes; isso não deve ser interpretado como aprovação operacional.

## 3. GO / NO-GO

### **DECISÃO: GO CONTROLADO PARA ONDA 1**

A Onda 0 atingiu seu objetivo documental: baseline, gaps, escopos e critérios estão formalizados. A Onda 1 pode iniciar a remediação dos P0.

### Stop Rule da Onda 1

Ao final da Onda 1, qualquer P0 não resolvido, qualquer falha crítica de segurança, qualquer inconclusão de isolamento de tenant ou qualquer deployment não reproduzível produz **NO-GO para Onda 2**.

## 4. Primeira validação obrigatória da Onda 1

Executar:

```bash
npx tsx scripts/audit-tenant-models.ts
```

O comando deve retornar `TENANT ISOLATION AUDIT: PASS`. Caso contrário, P0.7 permanece aberto e a Onda 1 não pode ser encerrada.

## 5. Regras de execução

- Não fazer feature creep durante a Onda 1.
- Todo commit de implementação deve apontar para a branch `wave/1-security`.
- PR obrigatório antes de merge em `main`.
- Typecheck, testes de segurança e Vercel preview são gates mínimos do PR.
- Nenhum segredo será colocado em documentação ou código.

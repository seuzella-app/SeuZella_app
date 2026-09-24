# RUN9-W3 — PLANO DE REMEDIAÇÃO 9D: Float money -> Decimal(12,2)

Gerado por RUN9-W2 em 2026-09-18T14:38:45.276Z a partir das evidências RUN9_W1_20260918_105754.

## Escopo exato (6 campos, 5 models)
| Model | Campos Float money |
|---|---|
| Transaction | amount |
| Subscription | amount, lastProrateAmount |
| PaymentTransaction | amount |
| AirBSubscription | amount |
| AirBTransaction | amount |

## Por que NÃO foi feito no W2
- Mudança Float -> Decimal altera o tipo gerado no Prisma Client de `number` para
  `Prisma.Decimal` (decimal.js): TODA aritmética/comparação/serialização sobre esses
  campos quebra o typecheck nos pontos de uso — os 5 models são centrais no billing.
- Exige migração real no banco (ALTER COLUMN TYPE) — o projeto não aplica migração
  sem rehearsal (padrão 8C do RUN8). Patch cego = risco de RED em cascata.

## Passos do W3 (onda dedicada, com rehearsal)
1. Rehearsal em cópia: migrar cópia do banco e rodar QA de amounts (saldos, totais, prorate).
2. schema.prisma: Float -> Decimal @db.Decimal(12,2) nos 6 campos (patch ancorado em model+campo).
3. `prisma migrate dev --create-only --name money_decimal_9d` (SQL: ALTER COLUMN TYPE com cast explícito USING).
4. Ajuste de tipagem nos pontos de uso apontados pelo typecheck (fronteiras: .toNumber() na saída, new Decimal() na entrada).
5. Verify completa COM build + suíte de invariantes 9D atualizada (pin do W2 é anti-crescimento).
6. Deploy: migrate deploy antes do start da app (ordem 8B).

## Rollback
- git revert do commit W3 + `prisma migrate resolve` conforme estado; migração ALTER COLUMN TYPE
  volta com USING (coluna para double precision) — dados preservados (cast com perda apenas de dígitos > 2 casas).

# JEV_TEST_REPORT.md — RUN23-A (subset SHADOW HARNESS)

- Suítes executadas (vitest): 4 (em src/__tests__/jev/ — include do vitest do projeto)
  - src/__tests__/jev/jev-contract.test.ts   (contrato + firewall — RUN22-A)
  - src/__tests__/jev/jev-registry.test.ts   (kind=DECISION fail-closed — RUN22-A)
  - src/__tests__/jev/jev-shadow.test.ts     (config + shadow runner + adapter — RUN22-A)
  - src/__tests__/jev/jev-harness.test.ts    (corpus + agreement + invariants — NOVA)
- Resultado: 4 passed / 0 failed
- tsc --noEmit: 0 erro(s) total | residuais conhecidos RUN19-A tolerados | NOVOS: 0 (exigido: 0)

## Mapeamento para as 20 security tests da diretiva (progresso)

| # | Segurança provada na trilha |
|---|---|
| 1 | fetch nunca é chamado sem JEV_ENABLED=true E TYPESAFE_API_KEY (RUN22-A) |
| 2 | valor da chave nunca aparece em serialização do config (RUN22-A) |
| 3 | tenant ausente/vazio/longo recusado (RUN22-A) |
| 4 | tenant 'demo' recusado em produção (RUN22-A) |
| 5 | buffer shadow guarda HASH do tenant — id puro nunca serializado (RUN22-A) |
| 6 | payload nunca serializado no buffer shadow (RUN22-A) |
| 7 | firewall deny-by-default (RUN22-A) |
| 8 | PII ofuscada (e-mail/telefone) na fronteira (RUN22-A) |
| 9 | kind GENERATIVE recusado no registro (RUN22-A) |
| 10 | shadowOnly=false recusado no registro (RUN22-A) |
| 11 | shadowOnly literal true em TODA variante de resposta (RUN22-A) |
| 12 | modo inválido recusado em contrato/firewall/adapter (RUN22-A) |
| 13 | fetch global NUNCA chamado pelo harness (esta onda — sem rede por construção) |
| 14 | relatório do harness sem tenantId puro (provado sobre a serialização) |
| 15 | relatório do harness sem payload/texto do corpus |

As 5 security tests restantes (rate-limit do endpoint futuro, auth M2M,
idempotência de ledger, política de retenção do ledger, fuzzing do parser
remoto) entram nas ondas de LEDGER/integração — cada uma com evidência própria.

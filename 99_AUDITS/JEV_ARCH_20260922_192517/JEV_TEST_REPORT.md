# JEV_TEST_REPORT.md — RUN22-A (subset ARCH/CONTRACT)

- Suítes executadas (vitest): 3 (em src/__tests__/jev/ — include do vitest do projeto)
  - src/__tests__/jev/jev-contract.test.ts   (contrato + firewall)
  - src/__tests__/jev/jev-registry.test.ts   (kind=DECISION fail-closed)
  - src/__tests__/jev/jev-shadow.test.ts     (config + shadow runner + adapter remoto)
- Resultado: 3 passed / 0 failed
- tsc --noEmit: 0 erro(s) total | residuais conhecidos RUN19-A tolerados | NOVOS: 0 (exigido: 0)

## Mapeamento para as 20 security tests da diretiva (progresso)

| # | Segurança provada nesta onda |
|---|---|
| 1 | fetch nunca é chamado sem JEV_ENABLED=true E TYPESAFE_API_KEY (fail-closed) |
| 2 | valor da chave nunca aparece em serialização do config (só booleano) |
| 3 | tenant ausente/vazio/longo recusado (isolamento obrigatório no envelope) |
| 4 | tenant 'demo' recusado em produção (regra da casa) |
| 5 | buffer shadow guarda HASH do tenant — id puro nunca serializado |
| 6 | payload nunca serializado no buffer shadow |
| 7 | firewall deny-by-default: campo fora da allowlist não atravessa |
| 8 | PII ofuscada (e-mail/telefone) em qualquer string da fronteira |
| 9 | kind GENERATIVE recusado no registro (JEV é DECISION PROVIDER) |
| 10 | shadowOnly=false recusado no registro (onda SHADOW_ONLY é invariante) |
| 11 | shadowOnly é literal true em TODA variante de resposta (tipo) |
| 12 | modo inválido recusado no contrato, no firewall e no adapter |

As 8 security tests restantes (rate-limit do endpoint futuro, auth M2M, SSRF
end-to-end com host real, idempotência de ledger, limites de custo, dedup de
requestId, política de retenção do ledger, fuzzing do parser remoto) entram
nas ondas de integração/ledger — cada uma com evidência própria.

# JEV_ENV_CONTRACT.md — RUN22-A (contrato de variáveis de ambiente, v1)

Convenção da casa (confirmada pelo SHAPES): leitura direta de `process.env`.
Nenhum valor de variável é lido/coletado pelos kits — este contrato define
NOMES, defaults e comportamento fail-closed. O RECON RUN20-A confirmou ZERO
chaves JEV_*/TYPESAFE_* no repositório: o contrato nasce limpo, sem colisão.

## Chaves contratuais (7 da diretiva + 1 opcional)

| # | Chave | Obrigatória? | Default | Efeito |
|---|-------|--------------|---------|--------|
| 1 | `TYPESAFE_API_KEY` | Não (shadow não exige) | ausente | Presença vira booleano (`typesafeKeyPresent`). VALOR NUNCA logado/serializado; lido apenas dentro do adapter remoto no momento da chamada. |
| 2 | `JEV_ENABLED` | Não | `false` | Só liga com `=== 'true'` (fail-closed). Desligada => remoto devolve `JEV_DISABLED`. |
| 3 | `JEV_SHADOW_MODE` | Não | `true` | Nesta onda `false` é IGNORADO: SHADOW_ONLY é invariante de tipos (`shadowOnly: true` literal) + guard no adapter (`JEV_SHADOW_REQUIRED`). |
| 4 | `JEV_MODEL` | Não | `jev-1` | Identificador enviado ao provider remoto (max 64 chars, trim). |
| 5 | `JEV_TIMEOUT_MS` | Não | `8000` | Inteiro com clamp [100..60000]; sujo/NaN => default. |
| 6 | `JEV_MAX_RETRIES` | Não | `1` | Inteiro com clamp [0..5]; sujo/NaN => default. |
| 7 | `JEV_DEFAULT_CONFIDENCE_THRESHOLD` | Não | `0.7` | Float com clamp [0..1]; governa a escalada (baixa confiança local => remoto/tier seguinte). |
| 8 | `JEV_TYPESAFE_BASE_URL` (opcional, extra) | Não | `https://api.typesafe.ai` | Só para apontar a outro endpoint (ex.: agregador). Documentada porque o ecossistema (OpenRouter/LiteLLM) expõe o Jev por base URL alternativa. |

## Matriz fail-closed (o que acontece SEM nada configurado)

| Estado do env | Resultado |
|---|---|
| Nada configurado (default) | JEV 100% inerte: heurística local decide em shadow; remoto devolve `JEV_DISABLED`; NENHUMA chamada de rede; NENHUM erro para o chamador |
| Só `TYPESAFE_API_KEY` presente | Remoto continua inerte (`JEV_ENABLED` ausente) — chave presente mas motor desligado |
| `JEV_ENABLED=true` sem chave | Remoto devolve `JEV_KEY_MISSING`; fetch nunca é chamado |
| `JEV_ENABLED=true` + chave (futuro) | Remoto ainda bloqueado por: allowlist SSRF da casa (host precisa estar liberado), timeout/retry, parser estrito (`JEV_INVALID_RESPONSE` em qualquer desvio) |

## Regras de segredo (diretriz)

1. A chave NUNCA transitou pelo chat, kit, log ou digest — o dono a coloca
   diretamente no `.env.local` do iMac NA onda de integração (não nesta).
2. `readJevConfig` expõe apenas `typesafeKeyPresent: boolean`; a string da
   chave existe somente em `readTypesafeKey()` para o header da chamada.
3. Testes provam: `JSON.stringify(config)` nunca contém a chave; fetch nunca
   é chamado sem flag+chave.
4. Suíte anti-vazamento do kit: padrões sk-/eyJ/AIza/gsk_ nos arquivos
   instalados => RED (rc=95).

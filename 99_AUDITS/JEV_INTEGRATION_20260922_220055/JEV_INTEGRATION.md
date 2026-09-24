# JEV — Método da INTEGRAÇÃO TYPESAFE (RUN25-A)

6ª onda da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION". O RUN24-A
PERSISTIU a evidência; esta onda ACENDE o caminho remoto COM PROTEÇÃO e
fecha as security tests restantes da diretiva: rate-limit do endpoint,
auth M2M e fuzz do parser remoto.

## 1. O que esta onda entrega

- **`jev-remote-rate-limit.ts`** — proteção de volume do caminho remoto:
  - `JevRemoteRateLimiter`: janela deslizante em memória (default 30/min,
    clamp [1..1000]) + cooldown pós-429 (default 60s, clamp [0..600s]) com
    Retry-After respeitado (cap 300s) e clock INJETÁVEL (determinismo);
    opções sujas caem nos clamps; nunca lança.
  - `JevRateLimitedPort`: decorator de `IJevDecisionPort` — sem permissão
    do limiter, o inner NEM é chamado (resposta tipada `unavailable`); a
    união de razões de RUN22-A permanece FECHADA (recusa usa
    `JEV_REMOTE_ERROR` e a causa real fica em `stats().deniedByLimiter`).
  - `createRateLimitedTypesafePort`: fábrica fail-closed — devolve
    `{ port, limiter }` SOMENTE com `jevAvailable()` (flag + chave + shadow);
    envolve o fetch para detectar 429 e alimentar o cooldown; `null` = remoto
    inerte (o runner trata como "sem remoto", como nas ondas anteriores).
- **`jev-integration.ts`** — a fiação do acendimento:
  - `getJevIntegrationStatus()`: estado só em booleanos/config (enabled,
    keyPresent, shadowMode, remoteActive, host da base URL, config do
    limiter) — NUNCA o valor da chave.
  - `createActiveShadowRunner()`: monta o `JevShadowRunner` com remotePort
    PROTEGIDO quando o ambiente está aceso, ou só-local (idêntico a hoje)
    quando apagado. Nada em produção chama ainda — a FIAÇÃO no Cérebro
    (próxima onda) usará esta fábrica num arquivo novo.
- **`jev-integration.test.ts`** — 17 testes com as security tests restantes
  (rate-limit, auth M2M, SSRF na fronteira, fuzz do parser remoto, wiring
  fail-closed) + relatório `JEV_INTEGRATION_REPORT.json` com cenário pinado.

## 2. Como o remoto acende (decisão do DONO)

O kit NUNCA lê nem escreve valores de chave. O acendimento é manual, no
`.env.local` do iMac, com TRÊS chaves:

```
TYPESAFE_API_KEY=<sua chave>
JEV_ENABLED=true
SSRF_ALLOWLIST=api.typesafe.ai
```

- `TYPESAFE_API_KEY`: presença vira booleano em `jev-config` (`typesafeKeyPresent`);
  o valor só existe dentro do adapter no momento da chamada (header Bearer).
- `JEV_ENABLED=true`: sem isso o remoto devolve `JEV_DISABLED` (fetch nem é chamado).
- `SSRF_ALLOWLIST`: libera o host do endpoint no guard da casa (contrato
  JEV_ENV_CONTRACT da RUN22-A). O guard é a ÚNICA autoridade de egresso:
  veredito de bloqueio => `JEV_SSRF_BLOCKED` antes de qualquer rede. Se
  você apontar `JEV_TYPESAFE_BASE_URL` para outro host, libere ESSE host.

Sem as três: remoto 100% inerte, heurística local decide em shadow — o
projeto segue funcionando exatamente como está. O agreement local-vs-remoto
acende de fato quando o endpoint real estiver apontado; até lá, o caminho
está PRONTO, PROTEGIDO e PROVADO (com fetch mockado).

## 3. Evidência da onda (relatório pinado)

- **Rate-limit (cenário pinado, clock injetado)**: 5 admitidas → 1 negada
  por janela (retryAfter 59995ms) → 429 alimenta cooldown (Retry-After
  60000ms) → negada no cooldown (retryAfter 41005ms) → liberada ao expirar;
  stats finais 6/2/1 (admitidas/negadas/429).
- **Auth M2M**: fetch sai com `Authorization: Bearer <chave>` e
  `content-type: application/json` para o host LIBERADO; corpo carrega
  `model/mode/requestId/payload-minimizado` — e-mail e CPF (fora da
  allowlist INTENT) NUNCA saem; a chave não aparece em corpo, resposta ou
  erro; sem chave, fetch NUNCA é chamado (JEV_KEY_MISSING).
- **SSRF na fronteira**: o guard da casa é a autoridade — veredito de
  bloqueio → `JEV_SSRF_BLOCKED` antes de QUALQUER rede (prova com override
  determinístico + oráculo que espelha o guard real; a suíte nunca presume
  a política interna do guard); host liberado → caminho feliz.
- **Fuzz do parser remoto**: 240 corpos determinísticos (mulberry32, seed
  20260922) contra o parser de PRODUÇÃO do adapter — 96 válidos aceitos
  (com clamp de confiança), 96 desvios de formato recusados
  (`JEV_INVALID_RESPONSE`), 48 lixo (bytes/unicode/gigante) tipado —
  NUNCA lança, SEMPRE tipado, `shadowOnly` literal em todas.
- **Invariantes**: limiterFailClosed, decoratorNeverCallsInnerWhenDenied,
  ssrfGuardHonored, keyNeverSerialized, remoteAlwaysShadowOnly,
  networkOnlyMocked — todas `true` no relatório.

## 4. O que esta onda NÃO faz

Não edita arquivo existente, não adiciona razão nova à união fechada de
RUN22-A, não lê banco, não toca Payload/Cérebro, não faz chamada de rede
real (todos os testes com fetch injetado), não escreve no `.env.local`,
não lê valor de chave alguma (apenas presença), não faz push, não toca
domínio financeiro. Circuit-breaker e budget-guard REAIS entram na onda de
fiação, com shapes exatas extraídas antes (mesma disciplina do SHAPES) —
usar `new CircuitBreaker()` às cegas quebraria o iMac se o construtor divergir.

## 5. Roadmap restante da trilha

FIAÇÃO NO CÉREBRO (extrator real de amostras implementando a ponte do
RUN24-A + chamador do `createActiveShadowRunner` + shapes de
circuit-breaker/budget) → DOCS → MASTER GATE → VPS.

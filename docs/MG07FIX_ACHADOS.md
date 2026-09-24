# MG-07 FIX — ACHADOS E DECISÕES

- **Data (UTC)**: 2026-09-24T03:12:18.000Z — evidências: `/Users/marciocau/SeuZella_project/99_AUDITS/MG07FIX_20260924_001218`

## ACHADOS

1. **A falha rc=84 não era do VITEST — era do código.** A suíte (3238 testes)
   estava saudável; 1 gate de regressão de segurança detectou uma remoção
   real de comportamento fail-closed no checkout.
2. **Culpa nomeada**: 064db917 (r3-f04, PR #47, 2026-09-02)
   reconstruiu o fluxo de assinatura determinística e derrubou o branch
   `ACCOUNT_EXISTS` introduzido por e35bef80 (2026-08-20) — sem
   atualizar o gate que o exige. Resultado: qualquer checkout de convidado
   com e-mail já cadastrado criaria um segundo tenant silenciosamente.
3. **A janela de latência foi de ~3 semanas** (2026-09-02 → detecção em
   2026-09-23). Motivo: nenhuma etapa intermediária rodou a suíte completa;
   a MG-07 V3 foi a primeira — e o fail-closed da campanha funcionou: nada
   foi commitado enquanto o gate esteve vermelho.
4. **O gate permaneceu intocado** — a correção foi no código, nunca no
   teste. Excluir/relaxar suíte de segurança para "ficar verde" é proibido
   nesta campanha.
5. **Lição do V4 (rc=84 honesto)**: pré-condição por string não prova
   ESCOPO — o TSC real reprovou o identificador fixo e o rollback manteve a
   base intacta.
6. **Lição do V5 (rc=84 honesto)**: candidatos fixos exauridos com SEMPRE o
   mesmo "1 erro novo" — causa comum fora do expr/retorno.
7. **Achado decisivo do V6 (prova por eliminação)**: as tentativas com forma
   JSON usaram a MESMA query Prisma das tentativas `createError` e NÃO
   produziram TS2345 → a query por e-mail é type-safe no schema atual; todas
   as tentativas com `createError` produziram EXATAMENTE 1 erro TS2345 →
   o argumento da chamada saiu do DOMÍNIO DE TIPOS da assinatura atual
   (união de códigos de erro estreitada junto com a remoção do r3-f04).
   As formas JSON, por sua vez, falharam com TS2304 + cascata de inferência
   (receiver não resolvível no escopo do route).
8. **Método do V7 — run cirúrgica guiada por PROBE**: a engine localiza a
   definição de `createError`, imprime a assinatura REAL no log e prova se
   o domínio ainda contém `ACCOUNT_EXISTS`. A escada de candidatos passa a
   atacar a causa: (a) restauração do MEMBRO na união de tipos do módulo de
   erro (cura semântica — o que e35bef80 tinha), (b) cast
   auto-adaptável `as Parameters<typeof createError>[N]` no slot lido do
   TEXTO do erro, (c) `as never`, (d) combinações, (e) JSON só com receiver
   verificado. O log imprime o texto INTEGRAL de cada erro novo
   (`DETALHE[n]`) — paste-back não depende mais de arquivo extra.
9. **Protocolo TOUCHED**: todo arquivo escrito pela engine é registrado em
   `MG07FIX_TOUCHED.txt`; rollback e commit do shell cobrem route + módulo
   de erro — a cura de domínio em 2 arquivos nunca fica órfã nem vaza para
   o commit sem verificação (arquivos modificados == arquivos tocados).

## DECISÕES REGISTRADAS

- **Restaurar em vez de realinhar**: a semântica original (409
  `ACCOUNT_EXISTS` para e-mail já cadastrado no checkout de convidado) é
  requisito de segurança do gate e do hardening de convidados — o patch a
  devolve usando os primitivos atuais, sem reintroduzir nada removido de
  propósito.
- **Cura de domínio antes de cast**: devolver o membro `'ACCOUNT_EXISTS'`
  à união de tipos é a correção semântica (a chamada volta a ser idêntica à
  original); o cast é fallback self-adaptável quando o módulo de erro não
  puder ser localizado com segurança.
- **O tsc do alvo é o juiz do patch**: nenhuma suposição de identificador,
  assinatura ou campo vive no kit — o candidato aplicado é o que zerou os
  erros novos contra a baseline (registrado em evidência, digest e RELATORIO).
- **Log auto-suficiente**: cada tentativa reprovada imprime o texto integral
  dos erros novos no log principal — o dono cola só o log; TRIAGEM é cinto
  de segurança, não dependência.
- **Árbitro objetivo**: engine cirúrgica + VITEST completo obrigatórios
  nesta onda; qualquer vermelho → rollback automático de TODOS os arquivos
  tocados e rc=84 sem commit.
- **Próximo passo da campanha**: com a suíte 100% verde, MG-07 segue para a
  etapa de VPS/deploy — as provas de fogo em produção ficam para depois do
  deploy, sob o mesmo regime de evidências.
10. **Lição do V7 (a prova final)**: o DETALHE integral revelou que o erro
    real era `executeCheckout` (callback do wrapper da linha 157) só pode
    retornar `Record<string, unknown>` — e o PROBE provou que
    `createError(status: number, code: string, ...)` tem `code: string`
    solto: os ARGUMENTOS da chamada nunca foram o problema (a hipótese do
    "domínio de tipos" do V6 foi refutada: as tentativas 1–3 do V7 falharam
    idênticas, inclusive com casts `as never`). Nesta arquitetura, erros
    fluem por THROW (ClassifiedError + withErrorHandling → handleApiError).
11. **Método do V8 — escada semântica**: o guard de ACCOUNT_EXISTS usa o
    PADRÃO NATIVO de erro do próprio route (throw-idioma extraído com
    callee/slots por parênteses balanceados), com fallbacks
    throw-casted → return-castado (`as unknown as Record<string, unknown>`,
    com a suíte completa arbitrando a semântica em runtime) → return-never.
    O PROBE v2 imprime o CONSUMIDOR de executeCheckout e o ESQUELETO do
    módulo de erro — o log fecha o diagnóstico sozinho.

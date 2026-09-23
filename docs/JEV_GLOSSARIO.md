# JEV — GLOSSÁRIO CONSOLIDADO DA TRILHA (docs/JEV_GLOSSARIO.md)

> Onda RUN28-A (DOCS) da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION".
> Documento ADITIVO: não substitui nem edita documentação existente da casa.
> Nenhuma chave, valor ou segredo aparece aqui — só conceitos, nomes de
> módulos e garantias já provadas pelas 8 suítes JEV (vitest) no iMac.
> Público: o dono do projeto e qualquer engenheiro que assuma a manutenção.

## Como ler este glossário

Cada verbete traz: **o conceito**, **onde vive no código** (quando aplicável),
**qual onda introduziu** e **qual garantia de segurança o cerca**. Os termos em
`mono` são nomes reais de arquivos, funções ou literais do projeto. As ondas
citadas são: RUN22-A (ARCH/CONTRACT), RUN23-A (HARNESS), RUN24-A (LEDGER),
RUN25-A (INTEGRAÇÃO), RUN26-A (FIAÇÃO NO CÉREBRO) e RUN27-A (USO REAL NO
CRON). O estado consolidado da trilha inteira está em `docs/JEV_TRILHA.md` e o
manual de uso do pulso está em `docs/JEV_OPERACAO.md`.

---

## Verbetes (ordem alfabética)

### Acendimento
O ato de **ligar** a avaliação remota do JEV. É um direito exclusivo do dono e
depende de 3 chaves no `.env.local` (`TYPESAFE_API_KEY`, `JEV_ENABLED=true`,
`SSRF_ALLOWLIST`). Os kits da trilha NUNCA ligam nada sozinhos: apenas
reportam PRESENÇA/AUSÊNCIA dos nomes das chaves, jamais valores. Sem as 3
chaves, o remoto permanece inerte (ver "Inerte") e a heurística local segue
decidindo em shadow — nada quebra. Introduzido como conceito no RUN22-A e
mantido idêntico em todas as ondas seguintes.

### Acordo / divergência (agreement)
Quando o motor local (heurística) e o motor remoto avaliam a mesma amostra, o
resultado pode ser **acordo** (mesma direção de decisão) ou **divergência**.
O módulo `jev-agreement.ts` (RUN23-A) calcula o `agreementRate` por modo. No
corpus v1 do harness (28 amostras) o acordo medido foi 89,3%. Divergências
NÃO são erros: são exatamente o sinal que a trilha quer observar em shadow
antes de qualquer decisão de produção.

### Âncora de cadeia
Um hash de commit LOCAL (NUNCA push) que fecha uma onda e é verificado pelo
driver da onda seguinte como **ancestral exato do HEAD** (`git merge-base
--is-ancestor`). Se qualquer âncora não for ancestral, o driver recusa a
instalação (rc=84). A cadeia atual tem 14 âncoras: RUN12-A (bede7de3),
RUN13-A (480281d2), RUN14-A (aff5ca01), RUN15-A (2b53b8e9), RUN16-A (7d7f28f1),
RUN17-A (1828090e), RUN18-A (e5eeb65d), RUN19-A (ffa3902b), RUN22-A (c6c07044),
RUN23-A (7b3f9810), RUN24-A (de734569), RUN25-A (c6275fd8), RUN26-A (371a96cd)
e RUN27-A (5e19649b). É a garantia estrutural de que nenhuma onda nasce de um
estado desconhecido.

### Budget guard (orçamento)
Controle de gasto da casa em `src/lib/ai/budget-guard.ts`, exposto pelo
singleton `tenantBudgetGuard` (classe `TenantBudgetGuard`, onda RUN27-A passou
a usá-lo no pulso). A assinatura usada pela trilha é EXATA:
`canUseTier(tenantId: string, tier: number, estimatedCost?: number, plan?:
string): boolean`. No pulso, o JEV usa uma **chave sintética de sistema**
(`jev-shadow-pulse`) — não é tenant real, nunca sai do processo — com tier 0 e
custo estimado 0, porque o pulso é shadow. Se o budget recusar, o pulso dá
`skip` com razão `budget-indisponivel` e NENHUMA amostra é avaliada
(fail-closed). O budget guard é a terceira camada de defesa do pulso (ver
`docs/JEV_OPERACAO.md`, defesas em camadas).

### Caps da fonte (5 MB / 10.000 linhas)
Defesas de tamanho da fonte real (RUN26-A, `jev-cerebro-file-source.ts`): um
export JSONL apontado por `?src=` não pode passar de **5 MB** nem de **10.000
linhas por ciclo**. Amostras além do cap são recusadas, não truncadas em
silêncio. É a primeira camada de defesa do ciclo: antes de qualquer
processamento, o tamanho da entrada já está limitado.

### Ciclo shadow (`runCerebroShadowCycle`)
O coração do JEV em produção (RUN26-A, `jev-cerebro-shadow-loop.ts`): lê
amostras de uma `JevSampleSource`, aplica o firewall, avalia local + (se
acendido) remoto, mede acordo/divergência e apenda o ledger — de ponta a
ponta. Idempotente por conteúdo (ver "Idempotência"). O ciclo NUNCA serializa
payload e NUNCA escreve tenant puro: só hashes. É chamado pelo pulso do cron
(RUN27-A) e foi provado no iMac com integração real de 6 lidas / 3 aceitas /
3 recusas / 3 avaliadas e ledger 6.

### Comando único
O padrão de operação da parceria: UM bloco colável no Terminal do iMac que
limpa kits antigos de Downloads, baixa o zip do HUB, verifica o manifesto de
embarque (SHA-256), executa o driver com log em `~/Downloads`, imprime o log e
salva o rc. Elimina erro de digitação e garante que o log colado de volta é
completo. Nome do arquivo do kit: `1_COMANDO_EXECUTAR.txt` (com o wrapper
`2_APLICAR_NO_IMAC.command`).

### Contrato do JEV (`JevDecisionContract`)
O contrato formal de decisão (RUN22-A,
`src/domain/decision/contracts/JevDecisionContract.ts` + `JevTypes.ts`):
tipa amostra, decisão e resposta; define os **7 modos** válidos do domínio
(a lista canônica dos 7 modos vive no contrato — este glossário não os
reescreve para não criar uma segunda fonte de verdade); recusa modo inválido
em contrato/firewall/adapter (security test 12). Todo o resto da trilha
compila contra este contrato.

### Corpus (v1, 28 amostras)
O conjunto fixo de amostras do harness (RUN23-A, `jev-harness-samples.ts`) usado
para medir acordo local×remoto por modo. Por construção o harness NUNCA chama
rede (security test 13: fetch global nunca é chamado). O relatório do harness
não contém tenant puro nem payload/texto do corpus (security tests 14 e 15).

### EMBARQUE (manifesto)
O arquivo `EMBARQUE_SHA256SUMS.txt` dentro de cada kit: SHA-256 de cada arquivo
do pacote, verificado no iMac ANTES de qualquer execução
(`shasum -a 256 -c`). Se 1 byte divergir, o embarque falha e nada é executado.
No HUB, o SHA-256 externo do zip é publicado na página para conferência
adicional (o dono já viu byte-exato em todas as ondas: download = publicação).

### Export JSONL
O formato de entrada escolhido para o uso real do pulso: **1 amostra por
linha**, ex.: `{"tenantId":"seu-tenant","mode":"INTENT","text":"..."}` ou
`{"tenantId":"seu-tenant","mode":"SENTIMENT","payload":{"text":"..."}}`.
Regras completas no `docs/JEV_OPERACAO.md`. Pontos-chave: tenant `demo` é
recusado; o modo tem de ser um dos 7 do contrato; o payload passa pelo
firewall de PII; amostra que sobra vazia é recusada; caps de 5 MB / 10.000
linhas. O kit NUNCA procura nem lê dados por conta própria: o dono aponta o
arquivo com `?src=` (opt-in explícito).

### Fail-closed
A doutrina central da trilha: **qualquer dúvida recusa a ação**. Gate ausente
=> inerte; budget recusado => skip; fusível aberto => skip; forma divergente
do fusível da casa => pulso recusado (sonda); fonte quebrada => inerte tipado.
Nenhum caminho da trilha "tenta por fora" de um gate. Provado nas 8 suítes:
cada gate tem teste com o ciclo NUNCA chamado.

### Firewall de PII (`jev-pii-firewall.ts`)
A fronteira de privacidade do JEV (RUN22-A): deny-by-default (security test 7)
— campos fora da allowlist são descartados; e-mail e telefone são ofuscados na
fronteira (security test 8); amostra que sobra vazia após o firewall é
recusada. O payload de uma amostra NUNCA é serializado para o buffer shadow
(security test 6) nem entra no ledger (security test 16). O firewall é a razão
pela qual a trilha pode rodar sobre texto real do dono sem vazamento.

### Fonte real (`createFileSampleSource`)
A fábrica de fonte read-only do RUN26-A (`jev-cerebro-file-source.ts`):
recebe o caminho absoluto de um export JSONL e devolve uma `JevSampleSource`
ou `null` (caminho sujo/ausente/ilegível => null — security test 23). Só lê o
arquivo que o dono apontou; não varre diretórios; não lê banco; não chama
rede. Assinatura exata usada pelo pulso: `createFileSampleSource(filePath:
string): JevSampleSource | null`.

### Fusível (CircuitBreaker da casa)
O disjuntor da casa em `src/lib/ai/circuit-breaker.ts` (classe `CircuitBreaker`
com `allow(): boolean`, `recordSuccess(): void`, `recordFailure(): void` entre
os 11 métodos das shapes-2). O pulso (RUN27-A) NÃO presume o construtor nem a
config da casa: monta o fusível por **sonda fail-closed**
(`probeHouseBreaker` — dynamic import + construtor sem argumentos + checagem
dos 3 métodos). Qualquer forma divergente => gate `breaker-indisponivel` =>
pulso recusado (security test 28). Fusível aberto => skip `breaker-aberto`.
Sucesso do ciclo => `recordSuccess`; timeout do ciclo => `recordFailure`.

### Gates (da casa)
As barreiras obrigatórias que o pulso aplica, na ordem fail-closed (RUN27-A):
1) `?src=` ausente => inerte `fonte-nao-indicada`; 2) fonte recusada => inerte
`fonte-ausente`; 3) budget (`tenantBudgetGuard.canUseTier`) recusado => skip
`budget-indisponivel`; 4) fusível aberto/indisponível => skip
`breaker-aberto`/`breaker-indisponivel`; 5) ciclo com teto de 25s. Antes deles,
a rota aplica a auth da casa. Cada gate tem teste próprio provando que o ciclo
NUNCA é chamado quando o gate recusa.

### Harness
Ver "Corpus" e `jev-harness.ts` (RUN23-A): o avaliador determinístico que roda
o corpus em shadow e produz `agreementRate` por modo. Sem rede por construção.
Foi a onda que institucionalizou a medição de acordo antes de qualquer uso
real.

### Idempotência (contentHash)
Garantia do ledger e do ciclo (RUN24-A/RUN26-A): re-processar o mesmo conteúdo
não duplica registro — o `contentHash` identifica a amostra processada. Provado
no iMac no RUN26-A: re-ciclo devolveu 0 novos + 6 duplicatas, ledger continuou
6 (security test 17). Protege contra re-execução acidental do pulso sobre o
mesmo export — a idempotência é o que permite chamar o pulso em janelas
sobrepostas sem inflar o ledger.

### Inerte
Estado do pulso/remote quando não há permissão explícita: a rota responde
rapidamente com contagens zeradas e razão tipada (`fonte-nao-indicada` /
`fonte-ausente`), e NADA é lido, avaliado ou registrado. Inerte por construção
sem `?src=`; inerte sem as 3 chaves de acendimento. "Inerte" é o contrário de
"falha": é o comportamento correto e testado.

### Invariantes (as 7 do relatório do pulso)
As propriedades que a suíte `jev-cron.test.ts` prova sobre a serialização e o
comportamento: `shadowOnlyLiteral` (resposta literal shadowOnly true),
`tenantHashOnly` (só hash de tenant), `payloadNotSerialized` (payload nunca
serializado), `networkOnlyMocked` (rede só mockada nos testes),
`budgetAndBreakerFailClosed` (gates recusam), `timeoutBounded` (teto de 25s),
`secretNeverInResponse` (segredo nunca na resposta). O driver valida o
relatório JSON gerado pela suíte e recusa GREEN se qualquer invariante
divergir. Ondas anteriores têm seus próprios conjuntos (5 no ledger, 6 na
fiação) — todos acumulados na trilha.

### Ledger (`jev-ledger.ts`)
O log de shadow apend-only do RUN24-A: cada avaliação vira uma linha com hash
de tenant (nunca tenant puro — security test 5), metadata mínima e
`contentHash`. Tem retenção com poda por idade/capacidade (clock injetado,
security test 18), sinks JSONL opt-in (`jev-ledger-sink.ts`) e a ponte com o
Cérebro (`jev-cerebro-samples.ts`). O ledger RECUSA draft com payload
(security test 16): PII nunca entra no log persistido.

### Modo (os 7 do contrato)
Cada amostra do JEV pertence a um dos 7 modos do contrato (ex.: INTENT e
SENTIMENT são dois deles; a lista completa e canônica está em
`JevDecisionContract.ts`). Modo inválido é recusado em três camadas
independentes: contrato, firewall e adapter (security test 12). O
`agreementRate` do harness é sempre medido por modo.

### Ofuscação (PII)
A transformação aplicada pelo firewall na fronteira: e-mail e telefone viram
formas irreconhecíveis antes de qualquer armazenamento/avaliação shadow
(security test 8). Combinada com o deny-by-default, garante que o que sobra da
amostra é o mínimo necessário para medir acordo — e nada mais.

### Opt-in (`?src=`)
O mecanismo de consentimento do pulso: sem o parâmetro `?src=` apontando para
um export JSONL do dono, a rota é inerte. Com `?src=`, o chamador autenticado
pela auth da casa assumiu explicitamente a leitura daquele arquivo. O kit
nunca descobre caminhos sozinho, nunca lê banco e nunca varre disco: só o
arquivo apontado, com caps.

### Pulso (cron pulse do JEV)
O chamador de produção do ciclo shadow (RUN27-A): lib
`src/lib/ai/jev/jev-cerebro-cron-pulse.ts` + rota NOVA
`src/app/api/cron/jev-shadow-pulse/route.ts` (padrão das irmãs da casa:
`dynamic = 'force-dynamic'`, `maxDuration = 60`). Aplica auth + gates
fail-closed + teto de 25s e responde **só contagens** (lidas/aceitas/recusas/
avaliadas/acordos/divergências/ledger) — zero payload, zero tenant real, zero
segredo no corpo (security test 29). Exceção do ciclo => http 500 com reason
tipada SEM stack/message do erro (sem vazamento).

### rc codes (códigos de recusa do driver)
Cada recusa do driver tem um código único e documentado, para diagnóstico
imediato pela colagem do log: rc=83 tag ausente; rc=84 âncora não ancestral;
rc=85 árvore suja; rc=86 dependência de onda anterior ausente; rc=88 conteúdo
obrigatório divergiu (gate CONTENT VERIFY, desta onda); rc=90 infra crítica
divergiu; rc=92 payload divergiu do manifesto; rc=93 colisão (arquivos já
existem — re-execução após GREEN); rc=94 token de domínio proibido; rc=95
segredo literal/leitura de env; rc=96 motor de evidência falhou; rc=1 RED
(rollback executado). Todos os códigos são provados no E2E local antes de o
kit ir para o HUB.

### Registry (`jev-provider-registry.ts`)
O registro de providers do JEV (RUN22-A): aceita só `kind = DECISION`
(security test 9), só `shadowOnly = true` (security test 10) e reflete
`shadowOnly: true` literal em TODA variante de resposta (security test 11). É
o que torna impossível registrar um provider generativo ou não-shadow na
trilha. O registro é estendível, mas o núcleo zaos permanece intocado.

### Retenção (poda)
A política do ledger (RUN24-A): entradas são podadas por idade e capacidade,
com clock injetado nos testes (determinístico; security test 18). Garante que
o ledger shadow não cresce indefinidamente e que a poda é testável sem sono
nem tempo real.

### Scrub duplo
A disciplina anti-vazamento dos motores de evidência: todo texto que vai para
o log/digest passa por substituições de padrões de segredo
(sk-/eyJ/AIza/gsk_/whsec_/Bearer/linhas `*KEY*=`) e truncagem de linhas longas
— aplicada em duas camadas independentes. Provado no E2E: mesmo com
`.env.local` populado no fixture, o valor NUNCA aparece no log nem no digest.

### Shapes (shapes-2 / SHAPES-3)
"Shapes" são as assinaturas EXATAS dos módulos da casa, extraídas READ-ONLY do
iMac (RUN21-A shapes do domínio; RUN26-A shapes-2 do cron: budget-guard,
circuit-breaker, llm-timeout, internal-secret, rota cron, prisma, middleware,
flags USE_TF_*). A lição RUN25-A ("nunca presumir a política/assinatura
interna de módulo da casa") virou GATE PERMANENTE no RUN27-A: o **SHAPES-3
VERIFY** (rc=87) confere nos arquivos reais as 9 assinaturas que o payload usa
ANTES de instalar. Nesta onda de DOCS o análogo é o **CONTENT VERIFY** (rc=88):
termos obrigatórios conferidos nos documentos antes e depois de instalar.
`withLlmTimeout`/`withLlmFallback` existem na casa, mas os parâmetros não
vieram nas shapes-2 — por isso NÃO são usados pela trilha (timer próprio do
pulso de 25s). Flags `USE_TF_*` existem, mas o módulo de origem não veio nas
shapes — NÃO são importadas.

### Shadow (e SHADOW_ONLY)
Modo de operação em que a IA **observa e mede, mas não decide nem interfere**:
toda avaliação é registrada no ledger para análise de acordo. `SHADOW_ONLY` é
literal obrigatório no registry (security tests 10 e 11) e o lema da trilha
inteira: o remoto só acende com as 3 chaves do dono, e mesmo aceso segue em
shadow (o acendimento libera avaliação remota, não ações de produção).

### Sink (`jev-ledger-sink.ts`)
O ponto de saída opt-in do ledger (RUN24-A): escreve JSONL para um destino
escolhido pelo dono. Sem sink configurado, o ledger fica apenas em memória no
processo. No E2E do RUN26-A, o sink provado recebeu 6 linhas sem vazamento de
tenant/payload.

### Teto de tempo (25s)
O timer próprio do pulso (RUN27-A): se o ciclo não termina em **25.000 ms**
(menos que o `maxDuration = 60` da rota), é abandonado com razão tipada
`ciclo-timeout` e `recordFailure` no fusível (security test 27). O teto é
tipado e pinado no relatório (`boundedMs === 25000`). A casa tem
`withLlmTimeout`, mas os parâmetros não vieram nas shapes-2 — o pulso usa
timer próprio por não presumir assinatura (lição RUN25-A).

### Tenant / tenantHash
`tenantId` é a identidade do inquilino; `tenantHash` é o SEU HASH criptográfico.
A trilha tem uma regra absoluta: **tenant puro nunca sai do processo** — buffers
shadow, ledger, relatórios e respostas do pulso carregam só o hash (security
tests 3, 4, 5, 14, 29). Tenant ausente/vazio/longo é recusado; tenant `demo` é
recusado em produção. No pulso, até a chave de budget é sintética
(`jev-shadow-pulse`), não tenant real.

---

## As 7 invariantes do pulso (resumo rápido)

| Invariante | Significado |
|---|---|
| `shadowOnlyLiteral` | `shadowOnly: true` literal em toda variante de resposta |
| `tenantHashOnly` | só hash de tenant em buffer/ledger/resposta |
| `payloadNotSerialized` | payload da amostra nunca serializado |
| `networkOnlyMocked` | rede só mockada/injetada nos testes |
| `budgetAndBreakerFailClosed` | budget/fusível recusam em qualquer dúvida |
| `timeoutBounded` | teto de tempo tipado (25s < maxDuration 60s) |
| `secretNeverInResponse` | nenhum segredo no corpo de resposta |

## Índice da documentação desta onda

- `docs/JEV_GLOSSARIO.md` — este glossário (conceitos + garantias).
- `docs/JEV_TRILHA.md` — estado consolidado: ondas, âncoras, suítes, arquivos
  com SHA-256, lições e próximos passos (MASTER GATE → VPS).
- `docs/JEV_OPERACAO.md` — manual de operação do pulso: export JSONL, `?src=`,
  contagens, acendimento de 3 chaves e solução de problemas.

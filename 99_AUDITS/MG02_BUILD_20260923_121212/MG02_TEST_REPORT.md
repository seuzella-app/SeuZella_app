# MG02_TEST_REPORT.md — MG-02 (MASTER GATE FINAL — forense Build)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 2 de 9 (MG-02 Build)
- Modo da onda: forense ESTÁTICA READ-ONLY — next build NÃO executado, sem
  rede, sem banco, sem credenciais; valores de chaves NUNCA lidos/exibidos
- Suítes executadas (vitest): 8 (em src/__tests__/jev/ — include do vitest do projeto)
  - src/__tests__/jev/jev-contract.test.ts     (contrato + firewall — RUN22-A)
  - src/__tests__/jev/jev-registry.test.ts     (kind=DECISION fail-closed — RUN22-A)
  - src/__tests__/jev/jev-shadow.test.ts       (config + shadow runner + adapter — RUN22-A)
  - src/__tests__/jev/jev-harness.test.ts      (corpus + agreement + invariants — RUN23-A)
  - src/__tests__/jev/jev-ledger.test.ts       (ledger + retenção + sinks + ponte — RUN24-A)
  - src/__tests__/jev/jev-integration.test.ts  (rate-limit + M2M + SSRF + fuzz + wiring — RUN25-A)
  - src/__tests__/jev/jev-wiring.test.ts       (fonte real + ciclo + ledger + sink — RUN26-A)
  - src/__tests__/jev/jev-cron.test.ts         (pulso: gates + fusível + timeout + integração — RUN27-A)
- Resultado: 8 passed / 0 failed
- tsc --noEmit: 0 erro(s) total | residuais conhecidos RUN19-A tolerados | NOVOS: 0 (exigido: 0)
- CONTENT VERIFY (relatório do payload): 40 OK / 0 FALHA (exigido 40/40)
- CONTENT RE-VERIFY (documentos instalados): 28/28 (20 canônicos no relatório + 8 incondicionais nos achados)
- SHAPES-3 RE-VERIFY (assinaturas nos arquivos reais): 9 OK / 0 FALHA (exigido 9/9)

## A varredura forense (o que o MG-02 examinou)

- next.config: presença + chaves canônicas (NOMES);
- tsconfig: flags de verificação (strict/noEmit) — presença;
- package.json: scripts.build / scripts.typecheck / engines (leitura LOCAL,
  sem rede) + next declarado;
- toolchain instalado: versões de next/react/react-dom/typescript em
  node_modules + client prisma gerado;
- lockfile: presença (package-lock/pnpm/yarn);
- artefato .next: presença, BUILD_ID, staleness (código mais novo que o
  build) e entrada no .gitignore;
- superfície de rotas: contagens (route/page/layout/use client/
  force-dynamic/maxDuration) — caminhos NUNCA enumerados nesta onda;
- superfície de env de build: 244 nome(s) referenciado(s) em
  src/ (NOMES apenas; lista completa em MG02_ENV_NAMES.txt), 5
  NEXT_PUBLIC_* (inlined no cliente) — valores NUNCA lidos;
- configs de build: varredura de token de domínio proibido e de segredo
  literal (só arquivo:linha — conteúdo NUNCA exibido).

## Resumo dos achados

BLOQUEIOS=0 ATENÇÃO=4 INFO=24
  [INFO] next.config: presente (next.config.ts)
  [INFO] next.config: chaves canônicas detectadas (NOMES): reactStrictMode output typescript headers redirects
  [INFO] tsconfig: strict=true (TypeScript estrito ativo no build)
  [INFO] tsconfig: noEmit=true (a emissão de saída fica por conta do Next)
  [INFO] scripts.build: presente (prisma generate && next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/)
  [INFO] scripts.typecheck: presente (tsc --noEmit)
  [INFO] scripts.start: presente (NODE_ENV=production node .next/standalone/server.js 2>&1 | tee server.log)
  [INFO] engines.node: não declarado (node instalado: v24.13.1)
  [INFO] next declarado no package.json: ^16.2.7
  [INFO] node_modules: presente
  [INFO] toolchain instalado: next@16.2.10
  [INFO] toolchain instalado: react@19.2.7
  [INFO] toolchain instalado: react-dom@19.2.7
  [INFO] toolchain instalado: typescript@5.9.3
  [INFO] client prisma gerado (node_modules/.prisma/client presente)
  [INFO] lockfile: package-lock.json ("lockfileVersion":3)
  [INFO] .gitignore: artefato .next ignorado pelo git
  **[ATENÇÃO]** artefato .next STALE: código em src/ mais novo que o último build (exemplo: src/app/checkout/cancel/page.tsx) — a próxima compilação oficial pertence à janela de deploy (MG-07)
  [INFO] next build NÃO foi executado nesta onda (escreveria artefatos e poderia tocar banco na prerender) — execução oficial de build pertence à janela de deploy (MG-07), por decisão do dono
  [INFO] superfície de rotas: route=322 page=28 layout=3 (contagens — caminhos NUNCA enumerados nesta onda)
  [INFO] diretivas: use client em 77 arquivo(s) | force-dynamic em 71 | maxDuration em 33 (contagens)
  [INFO] middleware: presente (src/middleware.ts)
  [INFO] superfície de env em src/: 244 nome(s) de chave referenciado(s) (NOMES apenas; lista completa na evidência MG02_ENV_NAMES.txt; valores NUNCA lidos)
  [INFO] NEXT_PUBLIC_* (nomes inlined no bundle do cliente): 5 — lista na evidência
  **[ATENÇÃO]** nome(s) NEXT_PUBLIC_* com padrão de segredo (seriam inlined no cliente): NEXT_PUBLIC_PIX_KEY— valor NUNCA lido; revisar antes do RELEASE
  **[ATENÇÃO]** token de domínio proibido em config de build: next.config.ts (1 ocorrência(s) — conteúdo NUNCA exibido; profundidade no MG-05)
  **[ATENÇÃO]** token de domínio proibido em config de build: src/middleware.ts (3 ocorrência(s) — conteúdo NUNCA exibido; profundidade no MG-05)
  [INFO] configs de build: 0 padrão de segredo literal

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.

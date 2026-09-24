# MG01_TEST_REPORT.md — MG-01 (MASTER GATE FINAL — forense PostgreSQL/Prisma)

- Campanha: MASTER GATE FINAL (pré-RELEASE) — onda 1 de 9 (MG-01 PostgreSQL/Prisma)
- Modo da onda: forense ESTÁTICA READ-ONLY — sem banco, sem rede, sem credenciais,
  sem prisma CLI; valores de chaves NUNCA lidos/exibidos
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

## A varredura forense (o que o MG-01 examinou)

- prisma/schema.prisma: presença, contagens (modelos/enums/@@index/@@unique —
  nomes NUNCA exibidos), datasource (url=env() vs literal — valor NUNCA exibido);
- prisma/migrations: contagem de pastas/arquivos, varredura de operações
  potencialmente destrutivas (só arquivo:linha — conteúdo NUNCA exibido);
- drift estático: modelo sem CREATE TABLE correspondente e tabela sem model
  (contagens, com @@map respeitado);
- package.json: presença/versão de prisma e @prisma/client;
- .env/.env.local: PRESENÇA de DATABASE_URL/DIRECT_URL/SHADOW_DATABASE_URL
  (valor NUNCA lido).

## Resumo dos achados

BLOQUEIOS=0 ATENÇÃO=2 INFO=13
  [INFO] PRISMA_SCHEMA: presente (prisma/schema.prisma)
  [INFO] estrutura: modelos=127 enums=2 @@index=291 @@unique=23 (nomes NUNCA exibidos nesta onda)
  [INFO] datasource: provider=postgresql url=env() (x1) — sem credencial literal
  [INFO] migrations: 22 pasta(s), 22 arquivo(s) .sql
  **[ATENÇÃO]** operações potencialmente destrutivas em migrations: 5 (só arquivo:linha abaixo — conteúdo NUNCA exibido; reversibilidade profundada em MG-06)
  [INFO] exemplo: 20260817000002_remove_caution_fields/migration.sql:7
  [INFO] exemplo: 20260817000002_remove_caution_fields/migration.sql:8
  [INFO] exemplo: 20260817000002_remove_caution_fields/migration.sql:9
  [INFO] exemplo: 20260817000002_remove_caution_fields/migration.sql:10
  [INFO] exemplo: 20260902000100_add_reservation_overlap_exclude/migration.sql:4
  **[ATENÇÃO]** drift estático: 99 modelo(s) do schema sem CREATE TABLE correspondente em migrations (nomes não exibidos; investigar em MG-06)
  [INFO] tabela(s) em migrations sem model no schema: 3 (nomes não exibidos — pode ser tabela de join implícita ou órfã; MG-06)
  [INFO] menções a 'tenant' no schema: 249 (contagem apenas — isolamento profundado em MG-04)
  [INFO] prisma no package.json: "prisma":{"seed":"npxtsxprisma/seed.ts"}, "@next-auth/prisma-adapter":"^1.0.7","@octokit/rest":"^22.0.1","@prisma/client":"^6.11.1","@radix-ui/react-accordion":"^1.2.11","@radix-ui/react-alert-dialog":"^1.1.14","@radix-ui/react-aspect-ratio":"^1.1.7","@radix-ui/react-avatar":"^1.1.10","@radix-ui/react-checkbox":"^1.3.2","@radix-ui/react-collapsible":"^1.1.11","@radix-ui/react-context-menu":"^2.2.15","@radix-ui/react-dialog":"^1.1.14","@radix-ui/react-dropdown-menu":"^2.1.15","@radix-ui/react-hover-card":"^1.1.14","@radix-ui/react-label":"^2.1.7","@radix-ui/react-menubar":"^1.1.15","@radix-ui/react-navigation-menu":"^1.2.13","@radix-ui/react-popover":"^1.1.14","@radix-ui/react-progress":"^1.1.7","@radix-ui/react-radio-group":"^1.3.2","@radix-ui/react-scroll-area":"^1.2.9","@radix-ui/react-select":"^2.2.5","@radix-ui/react-separator":"^1.1.7","@radix-ui/react-slider":"^1.3.5","@radix-ui/react-slot":"^1.2.3","@radix-ui/react-switch":"^1.2.5","@radix-ui/react-tabs":"^1.1.12","@radix-ui/react-toast":"^1.2.7","@radix-ui/react-toggle":"^1.1.9","@radix-ui/react-toggle-group":"^1.1.10","@radix-ui/react-tooltip":"^1.2.7","@tailwindcss/postcss":"^4","@tanstack/react-query":"^5.82.0","@tanstack/react-table":"^8.21.3","@types/leaflet":"^1.9.22","@types/node":"^20","@types/react":"^19","@types/react-dom":"^19","@upstash/ratelimit":"^2.0.8","@upstash/redis":"^1.38.2","axios":"^1.7.9","bcryptjs":"^3.0.3","bullmq":"^6.1.2","class-variance-authority":"^0.7.1","clsx":"^2.1.1","cmdk":"^1.1.1","date-fns":"^4.1.0","docx":"^9.7.1","dotenv":"^17.4.2","embla-carousel-react":"^8.6.0","framer-motion":"^12.38.0","input-otp":"^1.4.2","ioredis":"^6.0.0","jose":"^5.9.6","leaflet":"^1.9.4","leaflet.markercluster":"^1.5.3","lucide-react":"^0.525.0","mercadopago":"^3.1.0","next":"^16.2.7","next-auth":"^4.24.11","next-themes":"^0.4.6","node-ical":"^0.26.1","nodemailer":"^9.0.3","prisma":"^6.11.1","qrcode":"^1.5.4","react":"^19.2.4","react-day-picker":"^9.8.0","react-dom":"^19.2.4","react-hook-form":"^7.81.0","react-leaflet":"^5.0.0","react-leaflet-cluster":"^4.1.3","react-markdown":"^10.1.0","react-resizable-panels":"^3.0.3","react-syntax-highlighter":"^15.6.1","recharts":"^2.15.4","sharp":"^0.34.3","simple-git":"^3.36.0","socket.io":"^4.8.3","socket.io-client":"^4.8.3","sonner":"^2.0.6","swr":"^2.5.1","tailwind-merge":"^3.3.1","tailwindcss":"^4","tailwindcss-animate":"^1.0.7","tw-animate-css":"^1.3.5","typescript":"^5","uuid":"^11.1.0","vaul":"^1.1.2","xlsx":"^0.18.5","z-ai-web-dev-sdk":"^0.0.17","zod":"^4.0.2","zustand":"^5.0.6"
  [INFO] env [.env] DATABASE_URL: PRESENTE (valor NUNCA lido)
  [INFO] env [.env] DIRECT_URL: ausente
  [INFO] env [.env] SHADOW_DATABASE_URL: ausente
  [INFO] env [.env.local] DATABASE_URL: ausente
  [INFO] env [.env.local] DIRECT_URL: ausente
  [INFO] env [.env.local] SHADOW_DATABASE_URL: ausente

## Leitura

Achados BLOQUEIO não bloqueiam a onda (a onda forense é GREEN quando a varredura
conclui e a fundação está íntegra): eles alimentam a decisão de RELEASE do dono.
Correções nascem em ondas próprias da campanha MASTER GATE FINAL.

A fundação JEV continua SELADA (fc07fc8f) — o selo não muda
nesta campanha; cada onda MG-xx commita apenas seus documentos aditivos.

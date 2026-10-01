# Seu Zélla — Cronograma Mestre de Conclusão 2026

**Objetivo final:** terminar as superfícies críticas do código, validar os gates em ambiente real, publicar a stack na VPS Hostinger KVM/MVK4 e iniciar um beta controlado com pousadas reais.

**Estado de referência:** branch `feat/real-business-workflow-hardening`, commit `8cb7a523`.

> **Regra de verdade:** código que compila não é infraestrutura operacional validada. Um gate só pode ser marcado como verde quando existe evidência reproduzível no ambiente-alvo. Na ausência de contas, IP, DNS ou secrets, o resultado correto é `BLOCKED_EXTERNAL_INFRA`.

## Visão executiva

A estimativa operacional abaixo começa quando a VPS, o domínio e os responsáveis pelas credenciais estiverem disponíveis. As durações são janelas de trabalho, não compromissos de calendário. O caminho crítico é: **provisionar VPS → configurar secrets → PostgreSQL/Redis reais → deploy staging → testes de fluxo → observação → beta fechado**.

| Fase | Janela | Resultado | Estado atual |
|---|---:|---|---|
| 0. Controle de baseline | 0,5 dia | Branch, commit, backup e critérios congelados | Parcial — baseline publicada |
| 1. Fechamento de contratos técnicos | 1–2 dias | Configuração, migrations, workers e observabilidade coerentes | Em andamento |
| 2. PostgreSQL runtime | 0,5–1 dia | Migrations, EXCLUDE, RLS e restore provados | Bloqueada por banco real |
| 3. Redis/BullMQ runtime | 0,5–1 dia | Rate limit, filas, retry, DLQ e workers reais | Local verde; VPS/Upstash pendente |
| 4. Segurança da VPS | 0,5–1 dia | SSH, UFW, Docker, usuários e backup seguro | Código/template pronto |
| 5. Deploy staging | 1–2 dias | App + Postgres + Redis + worker atrás de TLS | Bloqueado por VPS/DNS |
| 6. Integrações externas | 2–5 dias | WhatsApp, pagamentos, e-mail, push e IA em sandbox/live controlado | Credenciais pendentes |
| 7. E2E e carga controlada | 2–4 dias | Jornadas reais sintéticas, concorrência, recovery e alertas | Pendente staging |
| 8. Beta fechado | 7–14 dias | 3 pousadas piloto, suporte e métricas diárias | Pendente aprovação |
| 9. Go-live | 1 dia | Gate final, rollback testado e liberação gradual | Bloqueado |
| 10. Operação contínua | contínua | SRE, backups, rotação, incidentes e melhoria | Não iniciado |

## Fase 0 — Baseline e controle de mudança

**Responsável:** engenharia/revisor. **Entrada:** branch de trabalho limpa. **Saída:** baseline imutável e plano aceito.

1. Confirmar que `origin/feat/real-business-workflow-hardening` aponta para `8cb7a523`.
2. Manter `main` sem merge até PostgreSQL, Redis e staging passarem.
3. Criar um registro de release com commit, hashes, resultados e pendências.
4. Separar explicitamente testes locais, staging e produção; nenhum smoke local deve ser chamado de runtime production.
5. Não versionar `.env`, tokens, chaves privadas, dumps ou logs contendo segredos.

**Gate de saída:** `git status` limpo, baseline reproduzível e `GO_LIVE_APPROVED=FALSE` até os gates externos.

## Fase 1 — Fechamento técnico antes da VPS

**Responsável:** engenharia. **Entrada:** baseline 8cb7a523. **Saída:** código pronto para execução no staging.

1. Revisar o contrato de Redis: REST Upstash para rate limit serverless e URL nativa para BullMQ/SSE; nunca misturar os dois.
2. Confirmar que `docker-compose.prod.yml` expõe somente a aplicação no host e mantém Postgres/Redis internos.
3. Corrigir/confirmar o serviço separado de worker no compose e seu comando de inicialização real; o documento não pode afirmar worker operacional se o compose não o iniciar.
4. Confirmar `prisma migrate deploy` como única migração de produção, sem `db push --accept-data-loss`.
5. Tornar o deploy fail-closed: migração, health, readiness e smoke devem falhar o deploy; rollback deve usar imagem/commit conhecido.
6. Definir observabilidade mínima: `/api/health`, `/api/readiness`, logs estruturados, `X-Request-Id`, erro, fila, DLQ, latência e espaço em disco.
7. Revisar o warning de workspace root do Next/Turbopack e os traces dinâmicos antes de carga real; isso é P1 de performance, não deve ser mascarado.
8. Migrar a configuração Prisma legada quando o upgrade de versão for planejado; não misturar upgrade major com o primeiro deploy.

**Gate de saída:** `npm run typecheck`, suíte de regressão, `npm run build`, preflight de configuração e revisão do diff sem erro.

## Fase 2 — PostgreSQL real e isolamento multi-tenant

**Responsável:** engenharia + infraestrutura. **Dependência:** banco staging acessível.

1. Provisionar PostgreSQL 16 com volume persistente, senha forte, backup e acesso interno.
2. Configurar `DATABASE_URL` somente na VPS/secrets manager; nunca no Git.
3. Rodar `npx prisma migrate deploy` dentro do serviço de aplicação.
4. Executar `scripts/production/validate-postgresql-runtime.sh` contra staging, não contra produção.
5. Validar as 16 canaries RLS, advisory locks e constraint de sobreposição de reservas.
6. Executar `backup-pre-migration.sh`, gerar dump, executar `restore-drill.sh` em banco de exercício e registrar contagem/tabelas restauradas.
7. Definir RPO/RTO e retenção; configurar destino off-site antes de aceitar dados reais.

**Gate de saída:** PostgreSQL `PASS`, migrations `PASS`, RLS canaries `PASS`, restore drill `PASS`, nenhuma credencial impressa nos logs.

## Fase 3 — Redis, rate limit, BullMQ e SSE

**Responsável:** engenharia + infraestrutura. **Dependência:** Redis real e, para serverless, Upstash REST.

1. Configurar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` para rate limit serverless.
2. Configurar `REDIS_URL`/`REDIS_CONNECTION_STRING` para BullMQ/SSE nativos.
3. Executar `scripts/production/validate-redis-runtime.sh` adaptado ao caminho real da VPS e ao compose efetivamente implantado.
4. Confirmar cinco filas, worker ativo, retries, idempotência, DLQ e graceful shutdown.
5. Validar que uma falha no Redis em produção não libera tráfego protegido nem declara job durável como enfileirado.
6. Subir duas instâncias da aplicação em staging e provar pub/sub, replay/resync e eventos tenant-scoped entre instâncias.
7. Limpar chaves de teste e registrar namespace, TTL e evidência de limpeza.

**Gate de saída:** Redis/BullMQ `PASS`, rate limit distribuído `PASS`, duas instâncias SSE `PASS`, DLQ/retry `PASS`.

## Fase 4 — Segurança e preparação da VPS Hostinger

**Responsável:** operador da VPS. **Dependência:** VPS KVM/MVK4 provisionada.

1. Confirmar Ubuntu suportado, IP fixo, armazenamento, memória e relógio sincronizado.
2. Criar usuário de deploy sem uso diário de root; instalar chave SSH e desabilitar senha quando o acesso por chave estiver validado.
3. Aplicar UFW: SSH limitado, 80/443 permitidos; 3000, 5432 e 6379 não públicos.
4. Instalar Docker/Compose, Nginx, Certbot, fail2ban, unattended-upgrades, auditd, jq e curl.
5. Criar `/opt/zehla`, permissões mínimas e arquivo de ambiente fora do Git.
6. Configurar backups locais e off-site com teste de restauração.
7. Registrar IP, hostname, versão do OS, versões Docker/Node/Prisma e hash do release.

**Gate de saída:** preflight VPS `PASS`, firewall verificado de fora, portas internas não expostas, SSH de recuperação testado.

## Fase 5 — Deploy staging

**Responsável:** engenharia + operador. **Dependências:** Fases 2–4.

1. Criar DNS de staging antes do TLS; usar TTL reduzido durante a mudança.
2. Configurar `.env.production` na VPS via canal seguro, com permissões restritas.
3. Fazer build da imagem no commit aprovado; preferir imagem imutável identificada por SHA.
4. Subir Postgres e Redis, esperar healthchecks, executar migrations e só então subir app/worker.
5. Colocar Nginx na frente da aplicação, emitir TLS e validar renovação do certificado.
6. Executar `/api/health`, `/api/readiness`, smoke de autenticação, tenant, reserva, cobrança simulada, webhook assinado e fila.
7. Guardar artefato de deploy, logs redigidos e plano de rollback; não executar `docker system prune` automaticamente sem política de retenção.

**Gate de saída:** staging HTTPS acessível, health/readiness verdes, worker ativo, migrations verdes e rollback ensaiado.

## Fase 6 — Integrações e credenciais

**Responsável:** proprietário de produto + responsáveis de cada provedor. **Dependência:** contas externas.

1. WhatsApp/Meta: app, WABA, telefone, tokens, assinatura de webhook e teste de envio controlado.
2. Pagamentos: Asaas/Mercado Pago/Stripe conforme o provedor escolhido; começar em sandbox, validar assinatura e idempotência, depois ativar live sob limite.
3. E-mail e push: domínio, SPF/DKIM/DMARC, SMTP/provider e VAPID.
4. IA: escolher providers, limites de gasto, fallback e desligamento seguro; manter modo mock até aprovação financeira.
5. Sentry/uptime/alertas: DSN, monitor, canal de incidente e política de dados.
6. Criar matriz de rotação, dono, data de expiração e ambiente para cada secret.

**Gate de saída:** somente integrações necessárias ao piloto em `PASS`; demais ficam `DISABLED_BY_DESIGN`, nunca como falsas integrações reais.

## Fase 7 — E2E, carga e recovery

**Responsável:** QA/SRE. **Dependência:** staging verde.

1. Rodar o Master Gate e as suítes críticas completas.
2. Testar onboarding, login, isolamento tenant, reserva, alteração/cancelamento, cobrança sandbox, webhook, WhatsApp, notificações, check-in/out e suporte.
3. Executar concorrência de mensagens, duplicidade de webhook, requeue, retry, DLQ e recuperação após reinício.
4. Rodar teste de carga com limites conservadores e registrar p95/p99, erro, CPU, RAM, Postgres, Redis e fila.
5. Simular indisponibilidade de Redis, Postgres, provider de pagamento e WhatsApp; confirmar respostas seguras e alertas.
6. Fazer restore drill com dados sintéticos e registrar RTO/RPO observado.
7. Corrigir P0/P1; nenhum P0 aberto pode seguir para beta.

**Gate de saída:** 7 dias de staging sem regressão crítica, incidentes classificados e runbook exercitado.

## Fase 8 — Beta fechado com pousadas reais

**Responsável:** produto, suporte e engenharia. **Entrada:** go/no-go aprovado.

1. Selecionar inicialmente até 3 pousadas com aceite explícito e contato de suporte.
2. Usar dados mínimos necessários e consentimento LGPD; não importar base completa antes do fluxo estar validado.
3. Ativar somente integrações já testadas e limites de cobrança conservadores.
4. Fazer onboarding acompanhado, registrar incidentes e manter rollback operacional.
5. Monitorar diariamente disponibilidade, erros, latência, mensagens, reservas, pagamentos, custos e tickets.
6. Fazer reunião de revisão ao final de 48 horas, 7 dias e 14 dias.
7. Expandir somente se os critérios de sucesso forem atingidos; não converter beta em lançamento geral automaticamente.

**Gate de saída:** 3 pilotos ativos, zero incidente P0, incidentes P1 tratados, suporte respondendo, dados e faturamento conciliados.

## Fase 9 — Go-live gradual

**Responsável:** dono do produto + aprovador técnico.

1. Confirmar todos os gates G0–G9 e a matriz de secrets.
2. Congelar migrations e mudanças de alto risco durante a janela.
3. Fazer backup imediatamente antes da liberação.
4. Publicar por canary/percentual, observar métricas e ampliar gradualmente.
5. Manter janela de rollback e responsáveis em prontidão.
6. Registrar decisão, commit, imagem, migrations, operador e evidências.

**Critério final:** `GO_LIVE_APPROVED=TRUE` somente com PostgreSQL, Redis/BullMQ, backups, TLS, health, readiness, observabilidade, rollback e beta aprovados.

## Fase 10 — Operação contínua

Semanalmente: revisar erros, fila, DLQ, latência, custos, backups e dependências. Mensalmente: executar restore drill, revisar acessos, rotacionar secrets conforme política, atualizar dependências de segurança e revisar capacidade. A cada incidente: registrar timeline, impacto, causa raiz, correção, teste de não regressão e atualização do runbook.

## Dependências do proprietário

O avanço das fases externas exige decisões e recursos que o código não pode inventar: compra/provisionamento da VPS, domínio e DNS, contas Meta/WhatsApp, gateway de pagamento, e-mail, Upstash, Sentry/uptime, destino off-site e dados/aceite das pousadas piloto. O repositório deve permanecer sem essas credenciais.

## Comando de acompanhamento

Na branch local, use os scripts existentes junto com o novo `scripts/production/go-live-gate.sh`. O relatório deve ser anexado ao release e conter o commit, os gates `PASS`, os itens `BLOCKED_EXTERNAL_INFRA`, os comandos executados e a ausência de segredos nos logs.

# DDC + CÉREBRO ZÉLLA — CAPACITY & READINESS CONTRACT

> Baseline operacional: 2026-09-03
> Status: diagnóstico e contrato de capacidade — não é certificação de carga.

## Objetivo

Estabelecer uma fonte operacional para evolução dos DDCs Pousada e Anfitrião/AirB, Cérebro Zélla, ZCC e filas assíncronas sem assumir uma capacidade de pousadas sem teste real.

## Regra fundamental

Capacidade é limitada pelo gargalo da cadeia:

`HTTP/API → auth/tenant → PostgreSQL → Redis/BullMQ → workers → LLM/provider → integrações → resposta`

Não usar “número de pousadas” como métrica isolada. A unidade de capacidade deve combinar:

- tenants ativos;
- requests/minuto;
- mensagens/minuto;
- jobs/minuto;
- concorrência de workers;
- latência p95/p99;
- conexões PostgreSQL;
- utilização/memória Redis;
- concorrência e rate limits dos provedores LLM;
- taxa de erro/retry/DLQ.

## Headroom obrigatório

Não operar o sistema sustentadamente no limite.

- GREEN: <70% da capacidade certificada
- YELLOW: 70–85% — alerta e investigação
- ORANGE: 85–95% — backpressure/throttling e expansão
- RED: >95% — proteção de serviço, prioridade e degradação controlada

A capacidade comercial anunciada deve ser inferior à capacidade certificada de carga, preservando margem para feriados, campanhas, picos de cadastro, pagamentos e mensagens simultâneas.

## Isolamento de tenant

Nenhum tenant deve monopolizar filas, workers, conexões ou chamadas LLM. Evoluções de capacidade devem contemplar quotas, prioridade/fairness, limites por tenant e backpressure.

## Cérebro: runtime ≠ learning ≠ training

### Runtime
Atende hóspedes e operações em tempo real. Deve permanecer responsivo mesmo quando learning/training estiverem executando.

### Learning
Coleta e avalia evidências, com isolamento por tenant, deduplicação, qualidade e decisões explícitas antes de promover conhecimento.

### Training
Produz versões do futuro ZELLA/LLM32B fora do runtime transacional. Modelo novo só pode ser promovido após avaliação, regressão, segurança e canary.

## DDC

O DDC possui superfícies Pousada e Airbnb/Anfitrião e uma composição grande de componentes, hooks e APIs. Toda ação deve ser classificada como:

1. operacional real;
2. leitura real;
3. ação assíncrona;
4. simulação/demo;
5. indisponível/feature futura.

Dados mock não podem aparecer silenciosamente como dados de produção. Falha de API deve ser distinguível de ausência legítima de dados.

## Capacity Gate futuro

Antes de declarar suporte a 500/1.000/5.000+ pousadas, executar testes com cenários progressivos:

- cadastro concorrente;
- login e sessão;
- reservas;
- pagamentos/webhooks;
- mensagens de hóspedes;
- respostas do Cérebro;
- retries e DLQ;
- cron/learning em paralelo;
- Redis e PostgreSQL sob saturação;
- provedor LLM sob rate limit;
- falha de integração externa;
- burst de feriado prolongado.

Critérios mínimos de aprovação devem incluir p95/p99, erro, queue depth, stalled jobs, DB pool exhaustion, Redis health, LLM throttling e recuperação após pico.

## Estado atual

Este documento não certifica uma quantidade de pousadas. O repositório possui infraestrutura de DDC, Cérebro, BullMQ/Redis e múltiplos processos de learning/orquestração, mas a capacidade comercial deve ser definida somente após load test reproduzível sobre a infraestrutura-alvo.

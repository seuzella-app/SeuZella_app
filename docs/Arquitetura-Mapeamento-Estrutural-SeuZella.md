# 🗺️ SEU ZÉLLA — ARQUITETURA, MAPA ESTRUTURAL DE APIs E DEFESA MULTI-TENANT

Este documento consolida o mapeamento estrutural, fronteiras de confiança e catálogo completo de componentes do ecossistema **Seu Zélla** para servir de referência definitiva em auditorias, novos desenvolvimentos e integrações de CI/CD.

---

## 🔒 1. Fronteiras de Confiança & Isolamento Multi-Tenant

```
                                  [ INTERNET PUBLICING ]
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │   Next.js Edge Middleware &      │
                           │   Public Previews (/ddc, /)      │
                           └──────────────────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
     ┌──────────────────────────────┐                ┌──────────────────────────────┐
     │      DDC (Anfitrião/Pousada)  │                │      ZCC (Super Admin / IA)  │
     │  Tenant Boundary (tenantId)  │                │   Role Audit & Global Scope  │
     └──────────────────────────────┘                └──────────────────────────────┘
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            ▼
                           ┌──────────────────────────────────┐
                           │   Prisma ORM & SQLite Storage    │
                           │   (Enforced Tenant Isolation)    │
                           └──────────────────────────────────┘
```

### 1.1 Modelo de Isolamento de Dados (RLS Boundary)
- **Tenant Context Isolation**: Todas as tabelas operacionais (`LockDevice`, `LockCode`, `LockEvent`, `AmortizationCredit`, `ReferralCode`) possuem chave estrangeira obrigatória `tenantId`.
- **Prevenção de Data Leakage**: Nenhuma consulta SQL/Prisma na camada DDC pode ser executada sem filtrar explicitamente pelo `tenantId` autenticado no token da sessão.
- **Sanitização de PII (LGPD)**: Logs de auditoria (`LockEvent`, `log-sink.ts`) aplicam máscara HASH SHA-256 e omitem dados sensíveis de cartões de crédito ou senhas no stdout/stderr.

---

## 📋 2. Índice Estrutural de Endpoints (API Catalog)

### 2.1 Rotas Públicas & Landing Page
| Rota | Método | Função | Nível de Acesso |
|---|---|---|---|
| `/` | `GET` | Landing Page Institucional & Calculadora de Economia | Público |
| `/login` | `GET/POST` | Autenticação via NextAuth | Público |
| `/r/[code]` | `GET` | Redirecionador de Links de Indicação (Amortização) | Público |
| `/api/landing/contact` | `POST` | Cadastro de Leads e Contato Comercial | Público (Rate-Limited) |

### 2.2 DDC — Dashboards de Operação Direta (`/ddc`)
| Rota | Método | Função | Isolamento |
|---|---|---|---|
| `/ddc` | `GET` | Visão Geral do Dashboard Operacional | Tenant |
| `/ddc/pousada` | `GET` | Dashboard Especializado em Pousadas | Tenant (`type: pousada`) |
| `/ddc/airbnb` | `GET` | Dashboard Especializado em Airbnb/Temporada | Tenant (`type: airbnb`) |
| `/api/ddc/locks` | `GET/POST` | Gerenciamento de Fechaduras Eletrônicas | Tenant |
| `/api/ddc/locks/[id]/pins` | `GET/POST` | Geração e Consulta de PINs de Acesso | Tenant |
| `/api/ddc/locks/[id]/panic-revoke` | `POST` | Revogação de Pânico de Todos os PINs | Tenant (Auditado) |
| `/api/ddc/credits/balance` | `GET` | Consulta de Saldo de Créditos por Indicação | Tenant |
| `/api/ddc/credits/create-code` | `POST` | Geração de Código de Indicação de Amortização | Tenant |

### 2.3 ZCC — Zélla Control Center (`/zcc`)
| Rota | Método | Função | Nível de Acesso |
|---|---|---|---|
| `/zcc` | `GET` | Super Dashboard Administrativo & IA | Role `ADMIN` |
| `/api/zcc/cerebro/analyses` | `GET` | Feed de Análises e Telemetria em Tempo Real | Role `ADMIN` |
| `/api/zcc/cerebro/anomalies` | `GET` | Detector de Anomalias Operacionais e Alertas | Role `ADMIN` |
| `/api/zcc/cerebro/ml-stats` | `GET` | Estatísticas de Aprendizado de Máquina (DSPy/DPO) | Role `ADMIN` |

### 2.4 Webhooks & Orquestração de Mensageria
| Rota | Método | Função | Proteção |
|---|---|---|---|
| `/api/webhook-whatsapp` | `POST` | Ingress de Mensagens e Áudios do WhatsApp | HMAC / Signature Check |
| `/api/cron/cerebro-orchestrator` | `GET/POST` | Cronjob Orquestrador de Inteligência e Autodefesa | Cron Secret |
| `/api/cron/cerebro-churn-predict` | `GET/POST` | Predição Autônoma de Riscos de Churn | Cron Secret |

---

## 🛠️ 3. Integração com a Esteira Defensiva de CI/CD (GitHub Actions)

A suíte de Integração Contínua conta com **36 workflows automatizados** em `.github/workflows/`:

```
                       ┌────────────────────────────────────────┐
                       │     GitHub Actions Workflow Gate       │
                       └────────────────────────────────────────┘
                                           │
         ┌──────────────────┬──────────────┼──────────────┬──────────────────┐
         ▼                  ▼              ▼              ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐ ┌─────────────────┐
│ Multi-Tenant    │ │ Smart Locks  │ │ ML Brain  │ │ LLM Router   │ │ Production Build│
│ RLS Guard       │ │ IoT Suite    │ │ Defense   │ │ Failover     │ │ Smoke Gate      │
└─────────────────┘ └──────────────┘ └───────────┘ └──────────────┘ └─────────────────┘
```

1. **`ci-multitenant-rls-guard.yml`**: Executa testes de estresse de contexto para impedir vazamento entre instâncias.
2. **`smart-locks-ci.yml` & `locks-stress-ci.yml`**: 194 cenários cobrindo 5 provedores IoT reais (TTLock, Tuya, Igloohome, Nuki, August) e resiliência a picos de Réveillon/Carnaval.
3. **`cerebro-ml-defense.yml`**: Valida a autodefesa do cérebro, filtros anti-hacker e auto-otimização DSPy.
4. **`ci-llm-failover-resilience.yml`**: Garante failover gracioso instantâneo entre Groq, DeepSeek, OpenAI, Gemini e Claude.
5. **`ci-production-build-smoke.yml`**: Garante compilação 100% limpa do Next.js antes de qualquer promoção de versão.

---

## ✅ 4. Checklist Defensivo de Qualidade para Produção

- [x] **561 de 561 testes unitários e de integração aprovados** (`npx vitest run`).
- [x] **Validação sintática do Prisma Schema** (`npx prisma validate`).
- [x] **Formatação e ordenação Prisma** (`npx prisma format --check`).
- [x] **36 Workflows de CI/CD padronizados no Node 22**.
- [x] **Isolamento de credenciais via variáveis `.env`**.
- [x] **URLs Canônicas salvas em `.agents/AGENTS.md`**.

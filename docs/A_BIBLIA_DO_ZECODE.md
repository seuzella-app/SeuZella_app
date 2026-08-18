# A BÍBLIA DO ZÉCODE
### Manual Técnico Completo de GitOps, Segurança e Automação GitHub
**SmartHotel_Zehla · ZCC Platform (Zélla Central Control)**  
*Versão 1.0 · Documento Técnico Oficial · Gerado em 18/08/2026*  
`PAT VAULT` | `CI/CD ACTIONS` | `WEBHOOK + MIRROR`

---

## 📑 Índice Geral

- [PARTE I — VISÃO ARQUITETURAL](#parte-i--visão-arquitetural)
  - [1. Contexto e Justificativa](#1-contexto-e-justificativa)
    - [1.1. Por que GitHub como Plataforma de Operação?](#11-por-que-github-como-plataforma-de-operação)
    - [1.2. Princípios de Segurança (Zero Trust)](#12-princípios-de-segurança-zero-trust)
    - [1.3. Modelos de Autenticação Suportados](#13-modelos-de-autenticação-suportados)
  - [2. Tour Completo das Abas do GitHub](#2-tour-completo-das-abas-do-github)
    - [2.1. Aba Code (Código e Repositório)](#21-aba-code-código-e-repositório)
    - [2.2. Aba Issues (Issue Tracking)](#22-aba-issues-issue-tracking)
    - [2.3. Aba Pull Requests (Revisão de Código)](#23-aba-pull-requests-revisão-de-código)
    - [2.4. Aba Actions (CI/CD)](#24-aba-actions-cicd)
    - [2.5. Aba Projects (Gestão de Projetos)](#25-aba-projects-gestão-de-projetos)
    - [2.6. Aba Wiki (Documentação)](#26-aba-wiki-documentação)
    - [2.7. Aba Security (Segurança e Alertas)](#27-aba-security-segurança-e-alertas)
    - [2.8. Aba Insights (Analytics e Métricas)](#28-aba-insights-analytics-e-métricas)
    - [2.9. Aba Settings (Configurações)](#29-aba-settings-configurações)
    - [2.10. Aba Discussions (Fórum)](#210-aba-discussions-fórum)
  - [3. Comparativo de Métodos de Autenticação](#3-comparativo-de-métodos-de-autenticação)
    - [3.1. PAT Clássico (NÃO RECOMENDADO)](#31-pat-clássico-não-recomendado)
    - [3.2. PAT Fine-Grained (Recomendado)](#32-pat-fine-grained-recomendado)
    - [3.3. GitHub App (Gold Standard)](#33-github-app-gold-standard)
    - [3.4. Deploy Keys (Casos Específicos)](#34-deploy-keys-casos-específicos)
    - [3.5. OIDC (Para Actions)](#35-oidc-para-actions)
- [PARTE II — IMPLEMENTAÇÃO](#parte-ii--implementação)
  - [4. Fase 1: PAT Vault Seguro](#4-fase-1-pat-vault-seguro)
    - [4.1. Modelo de Dados (Prisma)](#41-modelo-de-dados-prisma)
    - [4.2. Camada de Criptografia (AES-256-GCM)](#42-camada-de-criptografia-aes-256-gcm)
    - [4.3. Variáveis de Ambiente Necessárias](#43-variáveis-de-ambiente-necessárias)
  - [5. Fase 2: GitHub Client Service](#5-fase-2-github-client-service)
    - [5.1. Estrutura Principal](#51-estrutura-principal)
  - [6. Fase 3: Evolve-to-PR Pipeline](#6-fase-3-evolve-to-pr-pipeline)
    - [6.1. Fluxo Completo](#61-fluxo-completo)
    - [6.2. Implementação do Service](#62-implementação-do-service)
  - [7. Fase 4: GitHub Action de PR Review](#7-fase-4-github-action-de-pr-review)
    - [7.1. Workflow YAML](#71-workflow-yaml)
    - [7.2. Secrets Necessários no GitHub](#72-secrets-necessários-no-github)
  - [8. Fase 5: Webhook Listener](#8-fase-5-webhook-listener)
    - [8.1. Endpoint de Webhook](#81-endpoint-de-webhook)
    - [8.2. Configuração do Webhook no GitHub](#82-configuração-do-webhook-no-github)
  - [9. Fase 6: Mirror de Conta Corporativa](#9-fase-6-mirror-de-conta-corporativa)
    - [9.1. Ferramenta: git-filter-repo](#91-ferramenta-git-filter-repo)
    - [9.2. Script de Migração Robusto](#92-script-de-migração-robusto)
    - [9.3. Exemplo de Arquivo .mailmap](#93-exemplo-de-arquivo-mailmap)
- [PARTE III — OPERAÇÃO](#parte-iii--operação)
  - [10. Troca e Rotação de Credenciais](#10-troca-e-rotação-de-credenciais)
    - [10.1. Procedimento Passo a Passo](#101-procedimento-passo-a-passo)
    - [10.2. Rotação de Emergência (Suspeita de Vazamento)](#102-rotação-de-emergência-suspeita-de-vazamento)
    - [10.3. Auto-Rotação Programada](#103-auto-rotação-programada)
  - [11. Checklist de Implantação](#11-checklist-de-implantação)
  - [12. Troubleshooting](#12-troubleshooting)
  - [13. Próximos Passos (Roadmap M1-M14)](#13-próximos-passos-roadmap-m1-m14)
    - [13.1. Alta Prioridade (M1-M4)](#131-alta-prioridade-m1-m4)
    - [13.2. Média Prioridade (M5-M8)](#132-média-prioridade-m5-m8)
    - [13.3. Baixa Prioridade (M9-M14)](#133-baixa-prioridade-m9-m14)
    - [13.4. Ordem de Execução Recomendada](#134-ordem-de-execução-recomendada)

---

# PARTE I — Visão Arquitetural

## 1. Contexto e Justificativa

O **ZéCode** é o agente **DEV FULL STACK interno do ZCC (Zélla Central Control)** do projeto `SmartHotel_Zehla`. Inspirado no CodeRabbit.ai, ele evolui o código-fonte em paralelo ao Cérebro Zélla, que cuida das decisões em runtime. Para que o ZéCode atinja maturidade de produção, ele precisa operar o GitHub como uma plataforma de GitOps completa — não apenas ler diffs e comentar, mas criar branches, abrir Pull Requests, disparar workflows de CI/CD, rastrear issues, executar mirror de contas e responder a webhooks em tempo real.

Este documento é a referência técnica absoluta — a **"Bíblia do ZéCode"** — para que engenheiros possam implementar, operar, auditar e evoluir a integração GitHub × ZCC com segurança empresarial. Toda decisão arquitetural aqui documentada segue três princípios não-negociáveis:
1. **Princípio do menor privilégio (Least Privilege)**
2. **Zero downtime em rotações de credenciais**
3. **Auditabilidade completa** de cada ação realizada em nome do repositório.

### 1.1. Por que GitHub como Plataforma de Operação?

O GitHub deixou de ser apenas um repositório Git há muito tempo. Hoje ele é uma plataforma completa de engenharia de software que inclui CI/CD (Actions), gestão de projetos (Projects v2), segurança (CodeQL, Dependabot, Secret Scanning), issue tracking, discussions, wiki, e APIs REST e GraphQL extensivas. Para o ZéCode, usar o GitHub como plataforma significa herdar toda essa infraestrutura sem reinventar a roda — o agente foca em inteligência de código enquanto o GitHub provê a camada de orquestração, auditoria e colaboração.

A alternativa seria construir um sistema proprietário de revisão, fila de merges, tracking de issues e CI/CD. Isso consumiria meses de engenharia, reduziria a adoção pela equipe e nos obrigaria a manter infraestrutura que o GitHub já escala para milhões de repositórios.

### 1.2. Princípios de Segurança (Zero Trust)

Toda credencial GitHub é tratada como material sensível de alto risco. Um PAT vazado pode dar acesso irrestrito a repositórios, permitir commits maliciosos, exfiltrar código-fonte, alterar workflows de CI/CD para injetar supply chain attacks, e comprometer todo o histórico do projeto. Por isso, adotamos uma postura Zero Trust:

| Princípio | Implementação no ZéCode |
| :--- | :--- |
| **Criptografia em repouso** | AES-256-GCM com master key via env var (KMS) |
| **Criptografia em trânsito** | HTTPS/TLS 1.3 obrigatório, HSTS |
| **Princípio do menor privilégio** | Fine-Grained PAT com apenas escopos estritamente necessários |
| **Rotação periódica** | TTL máximo 90 dias, alerta com 14 dias de antecedência |
| **Auditabilidade completa** | Toda leitura/uso do PAT registrado em `PatAuditLog` |
| **Revogação imediata** | API de revoke chama GitHub `/applications/token` |
| **Sandbox de execução** | Branches dedicadas (`feat/ze-code/*`), nunca commit direto em `main` |
| **Rate limit enforcement** | Backoff exponencial, respeita `X-RateLimit-Remaining` |
| **Validação de webhooks** | HMAC SHA-256 + IP allowlist oficial do GitHub |
| **Separação de ambientes** | PATs distintos para prod / staging / dev |

### 1.3. Modelos de Autenticação Suportados

| Modelo | Granularidade | Rate Limit | Rotação | Caso de Uso |
| :--- | :--- | :--- | :--- | :--- |
| **PAT Fine-Grained** | Por repo + 40+ permissões | 5.000 req/h | Manual via Vault | Operações gerais (PR, issues, commits) |
| **GitHub App** | Por instalação + permissões | 15.000 req/h | JWT auto-rotate | Múltiplos repos, SaaS, multi-org |
| **Deploy Keys** | Por repo (read-only ou write)| N/A | Manual | Clone privado, push bot |
| **OIDC Token** | Por workflow run | Ilimitado* | Automático | Actions autenticando em nuvem |

*\* OIDC é emitido pelo GitHub Actions por run e não consome rate limit de API REST tradicional.*

---

## 2. Tour Completo das Abas do GitHub

### 2.1. Aba Code (Código e Repositório)
- **Como o ZéCode usa**: Consome a API de Contents para navegar na árvore de arquivos sem clonar o repositório inteiro. Para escrita, utiliza a **Git Database API** (trees, blobs, commits), criando commits atômicos de múltiplos arquivos em uma única chamada HTTP.

### 2.2. Aba Issues (Issue Tracking)
- **Como o ZéCode usa**: Quando o `gap-detector` detecta problemas críticos (ex: ausência de validação em rota pública), abre uma Issue com labels `ze-code-finding` e `severity:critical`. Conecta a issue à `RefactorSuggestion` no banco e fecha automaticamente via `Fixes #N` no PR body.

### 2.3. Aba Pull Requests (Revisão de Código)
- **Como o ZéCode usa**:
  1. *Criador de PRs*: Cria branch dedicada `feat/ze-code/{slug}`, commita os patches e abre PR com justificativa técnica, severidade e checklist.
  2. *Reviewer*: Analisa PRs abertos por humanos via `/api/zcc/ze-code/github-review`, posta comentários inline e publica veredito (`APPROVE`, `REQUEST_CHANGES` ou `COMMENT`).

### 2.4. Aba Actions (CI/CD)
- **Como o ZéCode usa**: Mantém `.github/workflows/ze-code-review.yml` disparado em eventos `pull_request` para fazer checkout, extrair diff, consultar a API do ZCC e postar feedback automatizado.

### 2.5. Aba Projects (Gestão de Projetos)
- **Como o ZéCode usa**: Cria itens no Projects v2 via GraphQL (`addProjectV2ItemById`) para cada `RefactorSuggestion` de alta prioridade.

### 2.6. Aba Wiki (Documentação)
- **Como o ZéCode usa**: Mantém documentação de arquitetura sincronizada via Git Database API apontando para o repositório `{repo}.wiki.git`.

### 2.7. Aba Security (Segurança e Alertas)
- **Como o ZéCode usa**: Consulta alertas do Dependabot para priorizar bumps de versão em dependências com CVE crítico e monitora Secret Scanning para auto-revogar credenciais se houver vazamento acidental.

### 2.8. Aba Insights (Analytics e Métricas)
- **Como o ZéCode usa**: Cruza métricas nativas do GitHub (traffic, commits, code frequency) com dados internos no ZCC (taxa de aceitação de refactors, tempo médio de merge).

### 2.9. Aba Settings (Configurações)
- **Como o ZéCode usa**: **NUNCA modifica Settings diretamente** (least privilege). Recomenda configurações via issues `ze-code-recommendation` para aprovação do administrador humano.

### 2.10. Aba Discussions (Fórum)
- **Como o ZéCode usa**: Monitora discussões com label `ze-code-help-needed` para fornecer respostas técnicas e links para a documentação interna.

---

## 3. Comparativo de Métodos de Autenticação

### 3.1. PAT Clássico (NÃO RECOMENDADO)
> [!CAUTION]
> **NÃO USE.** O PAT clássico (`ghp_...`) possui escopos globais e acesso irrestrito a todos os repositórios da conta. O Vault do ZéCode rejeita ativamente tokens iniciados por `ghp_`.

### 3.2. PAT Fine-Grained (Recomendado para Single Repo)
- Prefixo: `github_pat_`
- Escopo restrito ao repositório `MarcioCau14/SmartHotel_Zehla`.
- Permissões Mínimas:
  - `Contents`: Read & Write
  - `Pull requests`: Read & Write
  - `Issues`: Read & Write
  - `Workflows`: Read-only
  - `Metadata`: Read-only
  - *Demais escopos (Administration, Secrets, Webhooks, etc.): NUNCA.*

### 3.3. GitHub App (Gold Standard para Multi-Org / SaaS)
- Autenticação via JWT assinado com chave privada RSA + Installation Tokens com TTL de 1 hora.
- Rate Limit de 15.000 req/h.

---

# PARTE II — Implementação

## 4. Fase 1: PAT Vault Seguro

### 4.1. Modelo de Dados (Prisma)

```prisma
// Adições ao prisma/schema.prisma
model GitHubCredential {
  id               String           @id @default(cuid())
  label            String           @unique // "prod-corporate" | "staging"
  authType         String           // "fine_grained_pat" | "github_app" | "deploy_key"
  encryptedPat     String           @db.Text // AES-256-GCM payload JSON
  patFingerprint   String           // SHA-256 hash para busca rápida
  scopes           String[]         // Permissões declaradas
  repositoryAccess String[]         // Repositórios permitidos
  githubAppId      String?
  githubClientId   String?
  installationId   String?
  webhookSecret    String?          // Criptografado
  expiresAt        DateTime
  rotatedFromId    String?
  rotatedFrom      GitHubCredential? @relation("RotationChain", fields: [rotatedFromId], references: [id])
  rotatedTo        GitHubCredential[] @relation("RotationChain")
  createdBy        String
  isActive         Boolean          @default(true)
  lastUsedAt       DateTime?
  lastValidatedAt  DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  auditLogs        PatAuditLog[]

  @@index([patFingerprint])
  @@index([isActive])
  @@index([expiresAt])
}

model PatAuditLog {
  id           String           @id @default(cuid())
  credentialId String
  credential   GitHubCredential @relation(fields: [credentialId], references: [id])
  action       String           // "VALIDATE" | "READ" | "ROTATE" | "REVOKE" | "API_CALL" | "EXPIRE_ALERT"
  apiEndpoint  String?
  apiMethod    String?
  repository   String?
  statusCode   Int?
  success      Boolean
  errorMessage String?          @db.Text
  ipAddress    String?
  userAgent    String?
  durationMs   Int?
  createdAt    DateTime         @default(now())

  @@index([credentialId, createdAt])
  @@index([action, createdAt])
  @@index([success, createdAt])
}
```

### 4.2. Camada de Criptografia (`src/lib/github/pat-vault.ts`)

```typescript
import crypto from 'crypto';
import { prisma } from '@/lib/db/tenant-prisma';

const MASTER_KEY_B64 = process.env.GITHUB_PAT_MASTER_KEY;
if (!MASTER_KEY_B64) {
  throw new Error('GITHUB_PAT_MASTER_KEY env var is required (32 bytes base64)');
}
const MASTER_KEY = Buffer.from(MASTER_KEY_B64, 'base64');
if (MASTER_KEY.length !== 32) {
  throw new Error(`Master key must be 32 bytes, got ${MASTER_KEY.length}`);
}

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

export function encryptPat(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptPat(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function fingerprintPat(pat: string): string {
  return crypto.createHash('sha256').update(pat).digest('hex');
}
```

---

## 5. Fase 2: GitHub Client Service

Centraliza chamadas, cache ETag, retries com backoff e rate limit enforcement:

```typescript
// Exemplo de chamada atômica de commits via Git Database API
export class GitHubClient {
  async commitFiles(
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }>,
    message: string
  ): Promise<{ sha: string; commitUrl: string }> {
    // 1. Pega SHA da branch base
    // 2. Cria blobs individuais
    // 3. Cria árvore com base_tree
    // 4. Cria commit com parent
    // 5. Atualiza ref da branch
  }
}
```

---

## 6. Fase 3: Evolve-to-PR Pipeline

Transforma uma `RefactorSuggestion` em branch, commit atômico e Pull Request:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. gap-detector / bottleneck-detector identifica gap         │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ZéCode cria RefactorSuggestion no DB (status: pending)    │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Admin aprova no ZCC Panel ("Apply via PR")                │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Cria branch feat/ze-code/* -> Commita -> Abre Pull Request │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Webhook detecta PR merge -> RefactorSuggestion: 'applied' │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Fase 4: GitHub Action de PR Review

Workflow `.github/workflows/ze-code-review.yml`:
- Disparado em `pull_request: [opened, synchronize, reopened]`.
- Detecta autor para evitar auto-review em PRs gerados pelo próprio ZéCode (previne loop infinito).
- Valida tamanho do diff (pula se `> 500KB`).
- Consulta endpoint `/api/zcc/ze-code/github-review` e posta veredito diretamente no PR.

---

## 8. Fase 5: Webhook Listener

Endpoint `/api/zcc/github/webhook`:
1. **IP Allowlist**: Valida se a request provém dos blocos CIDR oficiais do GitHub.
2. **HMAC SHA-256**: Validação criptográfica com constant-time comparison (`crypto.timingSafeEqual`).
3. **Idempotência**: Descarte de requisições duplicadas via `X-GitHub-Delivery`.
4. **Tratamento de Eventos**:
   - `push`: Dispara reindexação no `code-indexer`.
   - `pull_request`: Atualiza status da `RefactorSuggestion` quando o PR é merged.
   - `check_suite`: Monitora quebras de CI causadas por automações.

---

## 9. Fase 6: Mirror de Conta Corporativa

Migração limpa de commits de conta pessoal para conta empresarial com reescrita de histórico via `git-filter-repo` e `.mailmap`.

---

# PARTE III — Operação

## 10. Troca e Rotação de Credenciais

### 10.1. Procedimento Padrão (Sem Downtime)
1. Gerar novo Fine-Grained PAT com 90 dias de expiração.
2. No ZCC (`Settings -> GitHub Credentials`), selecionar a credencial e clicar em **"Rotate"**.
3. O Vault valida o token via `/user`, cria o novo registro ativo e marca o anterior como `isActive: false`.

### 10.2. Rotação de Emergência (Suspeita de Vazamento)
1. Revogar o token imediatamente no GitHub (`Settings -> Developer settings -> Tokens`).
2. Acionar **"Emergency Revoke"** no ZCC.
3. Auditar logs em `PatAuditLog` das últimas 24 horas.
4. Identificar e reverter commits suspeitos via `git revert`.

---

## 11. Checklist de Implantação

- [x] Variáveis de ambiente configuradas (`GITHUB_PAT_MASTER_KEY`, `ZE_CODE_WEBHOOK_TOKEN`).
- [x] Models Prisma `CodeReview` e `CodeReviewComment` adicionados e sincronizados.
- [x] Painel ZéCode (5 views) modularizado no `ZccShell`.
- [x] Endpoints `/api/zcc/ze-code/*` operando com fallbacks resilientes.
- [x] Suíte de testes unitários validando fluxos em modo mock.

---

## 12. Troubleshooting Rápido

| Sintoma | Causa Provável | Solução |
| :--- | :--- | :--- |
| **HTTP 401 Unauthorized** | PAT revogado ou expirado | Gerar novo PAT e rotacionar no Vault |
| **HTTP 403 Forbidden** | Permissões ausentes para o repositório | Ajustar permissões no token Fine-Grained |
| **HTTP 429 Too Many Requests** | Rate limit atingido | Aguardar reset de quota ou migrar para GitHub App |
| **Webhook 401 Signature Mismatch**| Segredo HMAC incorreto | Alinhar `GITHUB_WEBHOOK_SECRET` no `.env` e no GitHub |
| **Master key must be 32 bytes** | Chave base64 mal formatada | Gerar com `openssl rand -base64 32` |

---

## 13. Roadmap ZéCode (M1-M14)

- **Alta Prioridade (M1-M4)**: Persistência completa de findings no Prisma, pipeline Evolve-to-PR, cron diário de evolução autônoma e GitHub Action nativo.
- **Média Prioridade (M5-M8)**: Análise sintática via AST Parser, priorização por TF-IDF hotspot, calibração de confiança via DPO e suporte a multi-linguagens.
- **Baixa Prioridade (M9-M14)**: Diff viewer interativo com syntax highlighting, chat de pair-programming embarcado no ZCC e dashboard de ROI de débito técnico.

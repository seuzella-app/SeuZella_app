---
name: ze-code
description: Manual Técnico Completo de GitOps, Segurança e Automação GitHub para o ZéCode (DEV FULL STACK do ZCC). Inclui PAT Vault, Evolve-to-PR, Webhooks e CodeReviewer.
---

# ZéCode — DEV FULL STACK do ZCC (GitOps & Automação GitHub)

## 📌 Contexto & Objetivo
O **ZéCode** é o agente DEV FULL STACK interno do **Zélla Central Control (ZCC)**. Inspirado no CodeRabbit.ai, ele opera em paralelo ao Cérebro Zélla para:
1. Detectar gargalos de performance (`bottleneck-detector`) e falhas de validação/segurança (`gap-detector`).
2. Gerar sugestões de refatoração (`RefactorSuggestion`).
3. Criar branches e abrir Pull Requests automatizados via **Git Database API** (`Evolve-to-PR`).
4. Realizar revisões estáticas e por LLM em PRs de humanos com comentários inline.
5. Gerenciar credenciais sensíveis via **PAT Vault** com criptografia AES-256-GCM.

---

## 📂 Localização dos Arquivos Chave

| Componente | Caminho no Repositório |
| :--- | :--- |
| **Manual Completo (Bíblia)** | [`docs/A_BIBLIA_DO_ZECODE.md`](file:///Users/marciocau/SeuZella_project/docs/A_BIBLIA_DO_ZECODE.md) |
| **Painel ZCC (5 Views)** | [`src/components/zcc/panels/ze-code-panel.tsx`](file:///Users/marciocau/SeuZella_project/src/components/zcc/panels/ze-code-panel.tsx) |
| **Orquestrador ZéCode** | [`src/lib/cerebro/ze-code/orchestrator.ts`](file:///Users/marciocau/SeuZella_project/src/lib/cerebro/ze-code/orchestrator.ts) |
| **Reviewer Service** | [`src/lib/cerebro/code-reviewer/reviewer-service.ts`](file:///Users/marciocau/SeuZella_project/src/lib/cerebro/code-reviewer/reviewer-service.ts) |
| **Models Prisma** | [`prisma/schema.prisma`](file:///Users/marciocau/SeuZella_project/prisma/schema.prisma) (`CodeReview`, `CodeReviewComment`) |
| **Testes Unitários** | [`tests/zecode-review-flow.test.ts`](file:///Users/marciocau/SeuZella_project/tests/zecode-review-flow.test.ts) |

---

## 🛡️ Regras de Segurança Zero Trust
- **Nunca usar PAT Clássico (`ghp_...`)**: O sistema bloqueia PATs clássicos e exige Fine-Grained Tokens (`github_pat_...`).
- **Permissões Mínimas**: Apenas `Contents: write`, `Pull requests: write`, `Issues: write` e `Workflows: read-only`.
- **Rotação Zero Downtime**: TTL máximo de 90 dias com alerta de 14 dias de antecedência no `AlertBus`.
- **Sandbox**: O ZéCode nunca commita direto em `main`; sempre cria branches `feat/ze-code/*`.

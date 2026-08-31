# SEU ZÉLLA — AUDITORIA FORENSE DE WORKFLOWS GITHUB ACTIONS

- **Data da Auditoria**: 2026-08-26
- **Branch**: `wave/7-fire-test-ready` (Commit `ca455ab2`)
- **Total de Workflows Identificados**: 27 arquivos em `.github/workflows/`

---

## 1. Inventário Detalhado dos 27 Workflows

| Workflow | Linhas | Trigger | Timeout | Concurrency | Permissions | Fail-Open Patterns (`|| true`, `exit 0`, `continue-on-error`) | Classificação |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `master-ci-fast-gate.yml` | 92 | PR (`main`, `wave/*`) | ✅ 15m | ✅ Sim | ✅ `contents: read` | 🟢 Zero fail-open | **P0 (Authoritative Fast Gate)** |
| `security-gate.yml` | 156 | Push/PR | ✅ 15m | ❌ Não | ✅ `security-events: write` | 🟢 Zero fail-open (Gitleaks + Codex + Custom Validators) | **P0 (Authoritative Security Gate)** |
| `ci-cd.yml` | 116 | Push `main`/PR | ✅ 15m | ✅ Sim | ✅ `contents: read` | 🟡 `eslint --max-warnings 9999 \|\| true` (L46), `npm audit \|\| true` (L109) | **P1 (Redundante com Fast Gate)** |
| `master-ci-build-regression.yml`| 276 | Push/PR | ✅ 30m | ❌ Não | ✅ Configurado | 🟡 `echo \|\| true` em logs não-críticos | **P1 (Suíte de Regressão Pesada)** |
| `master-ci-crons-webhooks.yml` | 254 | Push/PR | ✅ 20m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P1** |
| `master-ci-notifications-mobile.yml`| 309 | Push/PR | ✅ 20m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P1** |
| `master-ci-stress-security.yml`| 111 | Schedule / Manual | ✅ 30m | ✅ Sim | ✅ Configurado | 🟢 Zero fail-open | **P1** |
| `master-ci-zcc-simulation.yml` | 116 | Push/PR | ✅ 20m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P1** |
| `ci-zcc-vps-preflight.yml` | 109 | Push/PR | ✅ 15m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P1** |
| `ci-airbnb-style-guide.yml` | 75 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟡 `2>&1 \|\| true` em output format | **P2** |
| `ci-ddc-mobile-suite.yml` | 73 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2 (Subset de Fast Gate)** |
| `ci-dify-integration.yml` | 59 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-locks-integration.yml` | 62 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-multi-agent-system.yml` | 64 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-night-audit-system.yml` | 81 | Schedule / Manual | ✅ 15m | ❌ Não | ❌ Ausente | 🟢 Zero fail-open | **P2** |
| `ci-production-build.yml` | 28 | Push/PR | ✅ 15m | ✅ Sim | ❌ Ausente | 🟢 Zero fail-open | **P2 (Redundante)** |
| `ci-seclists-integration.yml` | 58 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-semantica-tests.yml` | 227 | Push/PR | ✅ 15m | ❌ Não | ✅ Configurado | 🟡 `tsc semantica \|\| true` (L141) | **P1** |
| `ci-tensorflow-integration.yml`| 52 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-v11-p0-antigravity.yml` | 147 | Push/PR | ✅ 15m | ✅ Sim | ✅ Configurado | 🟡 `exit 0` em step de relatório | **P2** |
| `ci-v11-p0-canaries.yml` | 51 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-v11-p0-harness.yml` | 63 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `ci-v11-p0-security.yml` | 51 | Push/PR | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |
| `deploy.yml` | 69 | Push `main` | ❌ Ausente | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P1 (Deploy CD)** |
| `production-build.yml` | 34 | Push/PR | ✅ 15m | ✅ Sim | ❌ Ausente | 🟢 Zero fail-open | **P2 (Duplicado de ci-production-build)** |
| `ze-code-review.yml` | 224 | PR review | ✅ 15m | ✅ Sim | ✅ Configurado | 🟡 `exit 0` intencional para não travar build por timeout de LLM externa | **P1 (Observabilidade ZéCode)** |
| `zecode-pr-review.yml` | 83 | PR open | ✅ 10m | ❌ Não | ✅ Configurado | 🟢 Zero fail-open | **P2** |

---

## 2. Diagnóstico dos Padrões Fail-Open (Fase 3)

1. **`ci-cd.yml:46` (`npx eslint src/ --max-warnings 9999 || true`)**:
   - **Risco**: P1. Mascara erros de lint no `ci-cd.yml`.
   - **Mitigação**: O `master-ci-fast-gate.yml` já executa `npm run lint` sem tolerância (fail-closed).
2. **`ci-cd.yml:109` (`npm audit --audit-level=high || true`)**:
   - **Risco**: P1. Permite dependências com vulnerabilidade alta subirem sem bloqueio no workflow genérico.
   - **Mitigação**: O `security-gate.yml` é o gate autoritativo de segurança que bloqueia falhas reais.
3. **`ze-code-review.yml` (`exit 0`)**:
   - **Análise**: O ZéCode PR Review faz chamadas para a API externa de IA. Se a chave da OpenAI/Anthropic/GLM oscilar ou sofrer rate limit da API externa, o step faz fallback e registra warning sem travar o pipeline de compilação. **Comportamento Intencional e Justificado**.

---

## 3. Identificação do Master Gate Autoritativo (Fase 4)

- **Master Gate Oficial**: [`.github/workflows/master-ci-fast-gate.yml`](file:///Users/marciocau/SeuZella_project/.github/workflows/master-ci-fast-gate.yml) + [`.github/workflows/security-gate.yml`](file:///Users/marciocau/SeuZella_project/.github/workflows/security-gate.yml).
- **O que eles cobrem obrigatoriamente**:
  - `master-ci-fast-gate.yml`: TypeScript (`tsc --noEmit`), ESLint (`eslint .`), Vitest Core (`npm test`), Prisma Generate e Next.js Production Build (`npm run build`).
  - `security-gate.yml`: Gitleaks (Secret scan), Custom Validators Python HTTP (Cross-Tenant, Webhook HMAC, Alexa JWT, Payment Idempotency) e SAST Security Tests.

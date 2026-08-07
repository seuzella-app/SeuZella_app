# 📚 V11-P0 CI/CD Runbook — Google Antigravity & GitHub Actions

## Visão Geral
Este runbook documenta os 4 workflows do V11-P0 e o processo de validação automatizada e veredito **GO/NO-GO** para produção no projeto **SmartHotel Zehla / ZCC Digital Twin**.

---

## Mapeamento de Workflows V11-P0

| Workflow File | Nome no GitHub Actions | Propósito & Validação | Duração Estimada |
| :--- | :--- | :--- | :--- |
| `ci-v11-p0-security.yml` | 🔒 **V11-P0 — Security Suite** | Valida M2M Auth, ZCC Security Gate, SAST e LGPD. | ~10 min |
| `ci-v11-p0-canaries.yml` | 🐦 **V11-P0 — RLS Canaries** | Valida Isolamento Multi-Tenant, SQLite e RLS. | ~15 min |
| `ci-v11-p0-harness.yml` | 🧠 **V11-P0 — Harness Build & Integration** | Valida Prisma Schema, Typecheck, DSPy Wire e Build Vercel. | ~25 min |
| `ci-v11-p0-antigravity.yml` | 🎯 **V11-P0 — Google Antigravity Orchestrator** | Roda 6 estágios integrados e emite veredito GO/NO-GO. | ~60 min |

---

## Comandos Locais Equivalentes (npm scripts)

Para rodar localmente as suítes antes de realizar o push:

```bash
# 1. Roda a suíte de segurança V11-P0
npx vitest run tests/zcc-security.test.ts tests/sast-static.test.ts tests/data-governance-lgpd.test.ts

# 2. Roda os canários de isolamento multi-tenant
npx vitest run tests/zella-cross-talk.test.ts tests/locks-multi-tenant-scale.test.ts

# 3. Roda a suíte inteira de baterias (com smoke em tempo de execução)
./.zscripts/zcc-battery/run-all.sh --skip-build
```

---

## Passo-a-Passo de Execução no Google Antigravity

1. Abra o repositório no GitHub: `https://github.com/MarcioCau14/SmartHotel_Zehla`
2. Vá até a aba **Actions**.
3. Selecione o workflow **🎯 V11-P0 — Google Antigravity Orchestrator**.
4. Clique no botão **Run workflow** e selecione a branch `main`.
5. Ajuste os parâmetros de entrada se necessário:
   - `run_canaries_pg`: `true`
   - `run_build`: `true`
   - `fail_fast`: `false`
6. Acompanhe a execução dos 6 estágios sequenciais até o job final de **VERDICT**.

---

## Vereditos Possíveis
- `VERDICT: GO ✅` → Todos os 5 estágios anteriores passaram 100%. Código aprovado para deploy em produção.
- `VERDICT: NO-GO ❌` → Falha detectada em um dos estágios. Inspecione o log do estágio correspondente.

---

## Branch Protection Recomendada (main)
Configure a proteção de branch no GitHub em **Settings > Branches > Branch protection rules** exigindo os seguintes status checks:
- `🔒 M2M Auth (13 Testes) & ZCC Security Audit`
- `🐦 RLS Multi-Tenant Canaries (SQLite 16 Testes)`
- `🧠 Estágio 3: Harness Build & Integration`
- `🎯 Estágio 6: Final GO/NO-GO Verdict`

---

## Próximos Passos Sugeridos no Roadmap

1. **P0.8 — CodeQL SAST**: Integração de análise estática nativa do GitHub CodeQL para detecção avançada de vulnerabilidades no código Next.js.
2. **P0.9 — Dependency Review Action**: Varredura automática de CVEs e licenças de dependências NPM em cada Pull Request.
3. **Revogação do PAT**: Revogar tokens temporários após concluir a validação no GitHub Settings.

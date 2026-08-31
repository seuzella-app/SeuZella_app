# SEU ZÉLLA — AUDITORIA DE CANDIDATOS A DEAD CODE

- **Data da Auditoria**: 2026-08-26
- **Branch**: `wave/7-fire-test-ready`
- **Regra**: Não apagar arquivos sem evidência. Classificar em `CONFIRMED DEAD`, `LIKELY DEAD`, `FALSE POSITIVE` e `REQUIRES REVIEW`.

---

## 1. Classificação dos Candidatos Auditados

| Candidato / Arquivo | Classificação | Evidência / Uso Atual | Ação Recomendada |
| :--- | :---: | :--- | :--- |
| `src/adapters/mock/PaymentMock.ts` | **FALSE POSITIVE** | Usado em testes unitários e modo sandbox de desenvolvimento offline. | **Manter** para isolamento de testes. |
| `src/adapters/real/index.ts` (stubs) | **REQUIRES REVIEW** | Contratos de interface para providers reais. Lançam erro intencional até a homologação da VPS. | **Manter** como barreira fail-closed. |
| `src/lib/semantica/` | **REQUIRES REVIEW** | Módulo legado de NLP antes do Cérebro GLM 5.2. Alguns testes ainda referenciam types. | **Preservar** até consolidação final da Wave 7. |
| `public/diagrams/seuzella-architecture.html` (com hífen) | **LIKELY DEAD** | Arquivo gerado anteriormente antes da renomeação canônica para `seuzella_architecture.html`. | Candidato à limpeza no próximo lote. |
| `src/app/api/cron/caution-auto-return` | **CONFIRMED DEAD** | Rota já removida em commits anteriores; confirmada ausente no `vercel.json`. | **Já Removido** (Status: VERIFIED). |

---

## 2. Diretriz para o ZéCode e Próximos Lotes
- Nenhum arquivo classificado como `REQUIRES REVIEW` ou `FALSE POSITIVE` deve ser removido sem testes de regressão associados.
- Exclusões devem ocorrer apenas em lotes dedicados de refatoração, com validação local prévia via `tsc` e Vitest.

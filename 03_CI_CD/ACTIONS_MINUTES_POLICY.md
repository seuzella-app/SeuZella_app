# SEU ZÉLLA — POLÍTICA DE ECONOMIA DE MINUTOS NO GITHUB ACTIONS & VERCEL

- **Objetivo**: Maximizar o trabalho de validação local e eliminar execuções redundantes e custosas no GitHub Actions e na Vercel.

---

## 1. Princípios Fundamentais

1. **GitHub Actions é CERTIFICADOR, não laboratório**:
   - Todo código, teste, lint e typecheck deve ser executado e validado **localmente** antes de qualquer comando `git push`.
2. **Prioridade Absoluta**:
   - `CORREÇÃO > SEGURANÇA > COBERTURA > ECONOMIA`.
   - Dentro do mesmo nível de cobertura, a economia de minutos e builds é obrigatória.

---

## 2. Filtros de Caminho (Path Filters) & Vercel Ignored Build Step

- **Documentação (`docs/`, `*.md`)** $\rightarrow$ Não dispara build na Vercel nem suítes pesadas de CI.
- **Diagramas (`docs/diagrams/`, `public/diagrams/`)** $\rightarrow$ Não dispara build.
- **Testes (`tests/`, `__tests__/`)** $\rightarrow$ Disparam apenas os jobs de validação de testes, pulando o build de produção da Vercel (`HEAD^ → HEAD`).
- **Código de Runtime (`src/`, `prisma/`, `package.json`)** $\rightarrow$ Disparo obrigatório do Master Fast Gate e build de produção.

---

## 3. Estratégia de Concurrency e Cancel-in-Progress

- Todos os workflows de PR devem possuir:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
- Isso cancela imediatamente execuções obsoletas quando um novo commit é enviado na mesma branch.

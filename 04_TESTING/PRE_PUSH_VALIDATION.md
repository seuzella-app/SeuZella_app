# SEU ZÉLLA — SEQUÊNCIA OBRIGATÓRIA DE PRÉ-PUSH GATE

Nenhum lote de código pode ser enviado ao repositório GitHub sem cumprir a sequência local estrita abaixo:

---

## Sequência Obrigatória de 13 Passos

```
 1. git diff              → Inspecionar todas as alterações linha por linha
 2. git status            → Verificar arquivos modificados e untracked
 3. npx prisma generate   → Regenerar tipos do Prisma se houver mudança de schema
 4. npx tsc --noEmit      → Compilação estrita TypeScript (0 erros tolerados)
 5. npx eslint src/       → Auditoria estrita de linting em arquivos executáveis
 6. npm test              → Execução da suíte crítica e regressões (Vitest)
 7. Custom Validators     → python3 security-validators/run-all.py (quando aplicável)
 8. npm run build         → Compilação de produção Next.js (validação de bundling)
 9. Docker Check          → Avaliação de sintaxe dos Dockerfiles/Compose
10. git diff --stat       → Revisão da proporção do lote antes do commit
11. git diff --check      → Validação de trailing spaces e conflitos
12. git commit -m "..."   → Commit atômico consolidado (sem commits intermediários)
13. git push              → Envio seguro para observação do Master Gate
```

> [!CRITICAL]
> O repositório no GitHub só deve receber commits que estejam **100% verdes localmente**.

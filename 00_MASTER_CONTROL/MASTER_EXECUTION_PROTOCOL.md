# SEU ZÉLLA — PROTOCOLO MESTRE DE EXECUÇÃO (MASTER EXECUTION PROTOCOL)

Este protocolo define a metodologia padrão de trabalho para o desenvolvimento, segurança e operação do Seu Zélla.

---

## O Ciclo Contínuo de Engenharia

```
AUDIT (Inspecionar o código real, commits, schemas e branches)
  ↓
PLAN (Definir escopo preciso sem inflação estatística ou estimativas falsas)
  ↓
IMPLEMENT (Executar correções mínimas necessárias, fail-closed)
  ↓
TEST (Executar tsc, lint, Vitest e custom validators localmente)
  ↓
RUN (Exercitar cenários e endpoints com o servidor Next.js em runtime)
  ↓
FIX (Ajustar divergências ou quebras de contrato)
  ↓
GREEN (Garantir 100% de sucesso nos gates locais)
  ↓
COMMIT (Agrupamento lógico em commits atômicos)
  ↓
PUSH (Envio para o GitHub Actions como certificador)
  ↓
VERIFY (Observabilidade e checagem de logs do Master Gate)
```

---

## Regras Canônicas de Ouro
1. **Código Atual é a Fonte de Verdade**: Documentos anteriores são apenas evidência histórica até serem confirmados contra os arquivos reais no repositório.
2. **Código Funcional $\neq$ Operação Certificada**: Ter o código escrito para uma integração não substitui o teste contra a API real com credenciais de produção e ambiente isolado.
3. **Database Branching para o ZéCode**: Mudanças de banco de dados por agentes devem operar em DB branches isolados antes de qualquer migração em produção.
4. **Nenhum Push Automático sem Validação Local**: O GitHub Actions atua como certificador estrito, nunca como bancada de teste.

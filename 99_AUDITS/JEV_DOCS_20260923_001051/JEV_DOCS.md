# SZ_JEV_DOCS_V1 — RUN28-A: DOCS (GLOSSÁRIO CONSOLIDADO DA TRILHA JEV)

## O que esta onda entrega

A 9ª onda consolida a **documentação canônica** da trilha JEV em 3 arquivos
NOVOS em `docs/` — zero código de produção, zero edição em arquivo existente:

| Documento | Conteúdo |
|---|---|
| `docs/JEV_GLOSSARIO.md` | Glossário completo: cada conceito com onde vive no código, qual onda introduziu e qual garantia o cerca (SHADOW_ONLY, fail-closed, firewall de PII, fusível por sonda, budget guard, shapes, invariantes, idempotência, tenantHash, opt-in, caps…). |
| `docs/JEV_TRILHA.md` | Estado canônico: ondas RUN20..RUN27, as 14 âncoras de cadeia (RUN12..RUN19 + RUN22..RUN27), arquivos com SHA-256, as 8 suítes, as 29 provas de segurança, lições institucionalizadas e próximos passos (MASTER GATE → VPS). |
| `docs/JEV_OPERACAO.md` | Manual de operação do pulso RUN27-A: export JSONL (regras + caps), `?src=`, `&max=`, leitura das contagens, acendimento das 3 chaves (por presença), agendamento externo como decisão do dono e troubleshooting. |

## CONTENT VERIFY (novo gate, rc=88) — a lição RUN25-A aplicada a documentação

Antes de instalar, o driver confere NOS DOCUMENTOS do payload os **34 termos
obrigatórios** (nomes de módulos, razões tipadas, âncoras e garantias
canônicas da trilha). Depois de instalar, re-verifica 20 termos nos arquivos
instalados (prova de cópia byte-idêntica). Qualquer divergência → recusa com
rollback. É o análogo documental do SHAPES-3 VERIFY (rc=87, RUN27-A): o que
está escrito em `docs/` tem de conferir exatamente com a realidade da trilha.

## Estabilidade provada (mesmo sem código novo)

- `npx tsc --noEmit`: 0 erros novos (residuais RUN19-A whitelistados).
- `npx vitest run`: as 8 suítes JEV continuam GREEN — documentação não afeta
  código.
- Segurança nos documentos: 0 tokens de domínio proibido, 0 padrões de
  segredo, 0 leituras de env (a documentação carrega só NOMES de chaves).

## Arquivos instalados (3, aditivos)

- `docs/JEV_GLOSSARIO.md`
- `docs/JEV_TRILHA.md`
- `docs/JEV_OPERACAO.md`

## Garantias permanentes (inalteradas)

Nada de domínio financeiro; NUNCA push; banco não lido; rede real nenhuma;
`.env.local` nunca escrito e valores nunca lidos (só presença de nomes);
`vercel.json` não editado; o pulso continua INERTE sem `?src=` — usar é
decisão do dono.

# SZ_JEV_MASTERGATE_V1 — RUN29-A: MASTER GATE (CERTIFICAÇÃO FINAL DA FUNDAÇÃO)

## O que esta onda entrega

A 10ª e última onda da trilha JEV **certifica a fundação inteira** e **sela a
trilha** com duas entregas — zero código de produção, zero edição em arquivo
existente:

| Entrega | Conteúdo |
|---|---|
| `docs/JEV_CERTIFICACAO.md` | O certificado canônico: 15 âncoras de cadeia (hash completo), as ondas RUN20..RUN28, os 32 arquivos (com SHA-256 dos blocos RUN26/RUN27), as 8 suítes, as 29 provas de segurança, as lições institucionalizadas e a tag de fechamento. |
| Tag `SEUZELLA_JEV_MASTER_CLOSURE_01` | Tag anotada, criada LOCALMENTE sobre o commit desta onda — o ÚNICO nascimento de tag da trilha depois das tags RUN10/RUN11 (mesmo padrão das fechamentos RUN7/RUN8/RUN9). **NUNCA push.** |

## A varredura mestra (MASTER SWEEP)

Antes de instalar qualquer coisa e antes da tag nascer, o driver re-verifica
a fundação INTEIRA num único passe, fail-closed:

1. **Cadeia**: branch, tags RUN10/RUN11, **15 âncoras** RUN12..RUN19 +
   RUN22..RUN28 como ancestrais do HEAD por hash exato (rc=84);
2. **Escudo da tag (NOVO, rc=97)**: se a tag de fechamento já existe, a onda
   se recusa — MASTER GATE só acontece uma vez;
3. **Dependências**: 32 arquivos RUN22..RUN28 (29 de código + 3 documentos)
   presentes (rc=86);
4. **CONTENT VERIFY (rc=88)**: 40 termos obrigatórios no certificado do
   payload (15 âncoras + 7 ondas + 8 suítes + 10 garantias);
5. **SHAPES-3 RE-VERIFY (rc=87)**: as 9 assinaturas do RUN27-A
   (requireInternalSecret, tenantBudgetGuard, canUseTier, CircuitBreaker,
   allow, recordSuccess, recordFailure, runCerebroShadowCycle,
   createFileSampleSource) re-conferidas nos arquivos reais;
6. **Estabilidade**: tsc 0 erros novos (residuais RUN19-A whitelistados) e as
   8 suítes vitest GREEN;
7. **Segurança**: grep duplo no certificado (0 tokens de domínio proibido,
   0 segredos, 0 leituras de env).

Só depois de TUDO passar: commit local do certificado → nascimento da tag →
evidência + digest. Se a criação da tag falhar por qualquer motivo, o commit é
revertido e a tag NÃO nasce (rollback total, rc=1).

## O que esta onda NÃO faz

Não edita arquivo existente; não faz push (a tag nasce e permanece no iMac);
não faz rede real; não lê nenhum valor de chave; não escreve `.env.local`;
não lê banco; não liga nada (uso do pulso é decisão do dono); não agenda cron;
não edita `vercel.json`; não toca domínio financeiro.

## Arquivos instalados (1, aditivo)

- `docs/JEV_CERTIFICACAO.md`

## Depois do selo

Fechado o MASTER GATE, resta um único passo na trilha: **VPS** (deploy na
Hostinger), sempre como decisão do dono. O certificado instalado documenta o
estado completo da fundação para que o deploy aconteça com base em provas,
não em promessas.

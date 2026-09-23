# MG05_ACHADOS.md — achados da varredura forense MG-05 (billing — ausência do domínio proibido)

- Onda: MG-05 (MASTER GATE FINAL — campanha pré-RELEASE)
- Modo: READ-ONLY estático — nenhuma execução, sem rede, sem banco,
  sem credenciais (NUNCA push)
- Execução: 20260923_154400
- Escopo: menções ao domínio proibido em src/ e configs (contagens e
  arquivo:linha), rotas com o próprio token no caminho, dependências
  financeiras no package.json, schema e migrations (contagens),
  vercel.json em só leitura, documentos da campanha — valores NUNCA exibidos

## ACHADOS DA VARREDURA

- [INFO] menções ao domínio proibido em src/: 173 arquivo(s) (contagens por arquivo na evidência MG05_BANNED_FILES.txt — conteúdo NUNCA exibido)
- **[ATENÇÃO]** ocorrências do domínio proibido em código: 727 (arquivo:linha na evidência MG05_CODE_HITS.txt — conteúdo NUNCA exibido; baseline conhecido do MG-02: next.config.ts e src/middleware.ts; a remoção é decisão do dono antes do RELEASE)
- **[ATENÇÃO]** ocorrências FORA do baseline conhecido (next.config.ts e src/middleware.ts): 723 — arquivo:linha na evidência MG05_CODE_HITS.txt (conteúdo NUNCA exibido; NOMES de arquivo ficam na evidência)
- **[ATENÇÃO]** rotas de API com o próprio token no caminho: 1 (NOMES na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido): superfície exposta de domínio proibido — decisão do dono antes do RELEASE
- **[BLOQUEIO]** dependência do domínio proibido instalada no package.json: 1 ocorrência(s) (NOMES dos pacotes na evidência MG05_SURFACE_MORE.txt; versões NUNCA exibidas): presença de implementação financeira proibida — decisão de remoção é do dono antes do RELEASE
- **[ATENÇÃO]** schema.prisma: 1 linha(s) com menção ao domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — NOMES de modelo/campo NUNCA exibidos)
- **[ATENÇÃO]** migrations: 2 linha(s) com menção ao domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido)
- [INFO] vercel.json: 0 linha(s) com menção ao domínio proibido (só leitura; NUNCA editado)
- **[ATENÇÃO]** documentos da campanha: 1 ocorrência(s) do domínio proibido (arquivo:linha na evidência MG05_SURFACE_MORE.txt — conteúdo NUNCA exibido): menção documental de proibição é legítima; a decisão de manter é do dono
- **[BLOQUEIO]** segredo literal em arquivo com menção ao domínio proibido: 1 ocorrência(s) — arquivo:linha na evidência MG05_CODE_HITS.txt; VALOR NUNCA exibido; mover para env antes de qualquer reativação
- [INFO] ausência: nenhuma execução, nenhuma consulta, sem rede, sem banco, sem credenciais nesta onda — contagens, NOMES de arquivo e arquivo:linha apenas
- [INFO] BLOQUEIOS=2 ATENÇÃO=6 INFO=3

## RESUMO

- BLOQUEIOS: 2
- ATENÇÃO: 6
- INFO: 3

## LEITURA

Achados BLOQUEIO não bloqueiam esta onda (a onda forense é GREEN quando a
varredura conclui e a fundação está íntegra): eles ALIMENTAM a decisão de
RELEASE do dono. Correções nascem em ondas próprias da campanha
MASTER GATE FINAL (fail-closed, NUNCA push).

## PRÓXIMO PASSO

MG-06 — Migration (segurança e reversibilidade em profundidade — método
próprio da onda, valores NUNCA exibidos).

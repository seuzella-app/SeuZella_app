# MG07VPS CHECKLIST — GO/NO-GO PARA O DEPLOY

> Marque tudo antes do `--deploy`. Qualquer caixa em NO = parar e resolver (o kit também trava,
> mas a leitura humana é a primeira barreira).

## FASE 0 — HOJE NO IMAC (pré-voo)

- [ ] SZ_MG07_FIX_V8 rodou rc=0 (suite 3193 passed | 45 skipped de 3238; commit `a19e0e47`)
- [ ] `1_COMANDO_EXECUTAR.txt` do SZ_MG07_VPS_PREP_V1 rodou **rc=0** (SEC 1..9 todos [OK])
- [ ] Fundação 17/17 no SEC 2
- [ ] SEC 3: `.env` não rastreado (nenhum [FALHA] de segurança)
- [ ] SEC 4: build VERDE + token no `.next/server`
- [ ] SEC 6: `MG07VPS_PAYLOAD_<TS>.tar.gz` em `~/Downloads` + SHA anotado
- [ ] `MG07VPS_PREP_DIGEST.txt` colado no chat (auditoria do agente)
- [ ] VPS existe, IP anotado, SSH por chave funcionando (`ssh USUARIO@IP echo ok`)

## FASE 1 — VPS ZERO (bootstrap, uma vez)

- [ ] Ubuntu 22.04/24.04 atualizado (`apt update && apt -y upgrade`)
- [ ] Node 22 LTS (`node -v` ≥ v20) + `npm i -g pm2`
- [ ] Swap se RAM < 2GB (`free -m` / `swapon --show`)
- [ ] ufw: 22, 80, 443 abertos; 3000 **fechado** para fora
- [ ] PostgreSQL local criado **ou** connection string do banco gerenciado em mãos
- [ ] Redis local instalado (se usado) ou `REDIS_URL` gerenciado em mãos
- [ ] `/var/www/seuzella` criado e com dono = usuário de app (não root)

## FASE 2 — TRANSFERÊNCIA

- [ ] `scp` do payload concluído
- [ ] `sha256sum` no VPS == SHA do digest do pré-voo

## FASE 3 — PRÉ-DEPLOY NO VPS

- [ ] `bash SZ_VPS_DEPLOY.sh --check` sem [VERMELHO]
- [ ] `shared/.env` criado (template + valores reais) e `chmod 600` confirmado
- [ ] `DATABASE_URL` testado: `psql "$DATABASE_URL" -c 'select 1;'` responde
- [ ] `REDIS_URL` presente (ou decisão consciente de viver sem cache)
- [ ] Decisão consciente sobre `SZ_SKIP_MIGRATE` (0 = rodar migrações; 1 = pular)
- [ ] Backup atual do banco se o VPS já tinha dados

## FASE 4 — DEPLOY

- [ ] `--deploy` rc=0, SECs A–J todos [OK]
- [ ] **PROVA MG-07 3/3 VERDE** (commit ancestral + token fonte + token `.next/server`)
- [ ] Health VERDE (rota impressa pelo kit)
- [ ] `pm2 status` online, restart count 0
- [ ] `MG07VPS_DEPLOY_DIGEST.txt` gerado e colado no chat

## FASE 5 — PÓS-DEPLOY

- [ ] nginx + SSL (certbot) configurados; `https://SEU_DOMINIO` abre com cadeado
- [ ] `--fogo` rc=0 (6/6)
- [ ] Provas de negócio do `MG07VPS_PROVAS_DE_FOGO.md` sem bloqueio
- [ ] `pm2 startup` + `pm2 save` (serviço sobe após reboot)
- [ ] Monitoramento 24h agendado (checklist 3× ao dia)

## NO-GO IMEDIATO (parar e chamar o agente com os logs)

- Qualquer rc diferente de 0 nos scripts (colar o log inteiro no chat)
- PROVA MG-07 (1/3, 2/3 ou 3/3) reprovada — NUNCA contornar
- `.env` com permissão aberta ou dentro do repositório/bundle
- Dados reais no banco e migrate reprovando — preferir `SZ_SKIP_MIGRATE=1` + diagnóstico antes

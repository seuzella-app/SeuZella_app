# MG07VPS ROLLBACK — PLAYBOOK COMPLETO (SZ_MG07_VPS_PREP_V1)

> Filosofia: **toda release é imutável** e o serviço serve o symlink `current`. Reverter é trocar
> o symlink de volta + reload — segundos, não minutos. O banco é protegido por dump antes de
> qualquer migração.

## 0. Mapa rápido de decisão

| Situação | Ação |
|----------|------|
| Deploy acabou de falhar (rc=124/125) **com release anterior existente** | o kit JÁ fez rollback automático (rc=126) — só diagnosticar |
| Deploy falhou **sem release anterior** (primeira) | nada está servindo; diagnostique e rode `--deploy` de novo |
| Site em produção com problema AGORA | **Nível 1** abaixo (10s) |
| Problema aparente no banco após migração | **Nível 3** abaixo (restore do dump) |
| Tudo verde, mas quer o código anterior mesmo assim | **Nível 1** também |

## 1. NÍVEL 1 — Rollback de release (o normal, 10 segundos)

```bash
cd ~/payload   # onde está SZ_VPS_DEPLOY.sh
bash SZ_VPS_DEPLOY.sh --rollback
```

O que ele faz: lê `.sz_deploy/history` → aponta `current` para a release anterior → `pm2 reload`
→ health → imprime o SHA da release restaurada. Verifique: `pm2 status` e o site.

**Manual (equivalente, se quiser entender):**
```bash
readlink -f /var/www/seuzella/current          # release atual
ls -1 /var/www/seuzella/releases               # todas as releases
ln -sfn /var/www/seuzella/releases/<TS_ANTIGA> /var/www/seuzella/current
pm2 reload seuzella
curl -fsS http://127.0.0.1:3000/api/health
```

## 2. NÍVEL 2 — Rollback de código sem release anterior

Se a release problemática é a primeira (sem `--rollback` possível):
```bash
cd /var/www/seuzella/.sz_work/repo 2>/dev/null || git clone ~/payload/repo.bundle /tmp/app -b feat/meta-zella-foundation
git log --oneline -5               # escolha o commit anterior ao problemático
git checkout --detach <SHA_ANTERIOR>
npm ci --no-audit --no-fund && npx prisma generate && npm run build
pm2 reload seuzella --update-env
```
Recomendação: rode o `--deploy` normal do kit na próxima janela para voltar ao layout de releases.

## 3. NÍVEL 3 — Banco (restore do dump)

O kit sempre tenta dump ANTES de migrar: `shared/backups/pre_deploy_<TS>.sql.gz`
(ou via `scripts/backup.sh` do próprio repo). Para restaurar:

```bash
# Identifique o dump da janela do problema
ls -lht /var/www/seuzella/shared/backups/
# Restore (CUIDADO: sobrescreve o estado atual do banco)
gunzip -c /var/www/seuzella/shared/backups/pre_deploy_<TS>.sql.gz | psql "$DATABASE_URL"
```

Regras de ouro:
1. **Pare o tráfego primeiro** (`pm2 stop seuzella`) durante o restore, depois `pm2 start`.
2. Nunca rode `prisma migrate resolve`/`reset` por conta própria sem colar logs no chat —
   `migrate reset` é destrutivo (apaga dados).
3. Migração que falhou e o dump restaurou o estado → o `--deploy` seguinte deve rodar com
   `SZ_SKIP_MIGRATE=1` até diagnosticarmos a migration.

## 4. NÍVEL 4 — Desastre (VPS indisponível)

1. Recrie o VPS (ou novo) → RUNBOOK sec 4 (bootstrap completo, ~15 min).
2. Recrie o banco gerenciado/local → restore do dump mais recente.
3. Re-transferir o payload do iMac (`scp`) → `--deploy` → `--fogo`.
4. DNS aponta para o IP novo (se mudou).

> O iMac é a fonte da verdade do código; os backups do VPS são a fonte da verdade dos dados.
> Recomendo: `pg_dump` diário extra via cron (o repo tem `vps-crontab` de referência) e cópia
> semanal fora do VPS.

## 5. Pós-rollback — checklist

- [ ] `pm2 status` online, health VERDE
- [ ] Site real abrindo (não só localhost)
- [ ] `.sz_deploy/history` consistente (release antiga re-ativada)
- [ ] Cole no chat: log do rollback + `pm2 logs seuzella --lines 50` + o que sentiu/observou
- [ ] Diagnóstico antes de tentar novo deploy (nunca repetir o mesmo `--deploy` às cegas)

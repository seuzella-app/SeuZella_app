# MG07VPS RUNBOOK — DEPLOY VPS DO SEUZELLA (SZ_MG07_VPS_PREP_V1)

> **Estado da campanha:** MG-07 FIX **VERDE** — commit `a19e0e4795196da1b1092c4487dfa1b1d4f28da6`
> (suite 3238 testes: 3193 passed | 45 skipped; gate 17-20 VERDE; TSC 0 erros).
> Este runbook cobre **hoje (pré-voo no iMac)** e **amanhã (deploy no VPS)** — via terminal **ou** manual.

---

## 0. ESTRATÉGIA EM 1 PARÁGRAFO

O commit do fix MG-07 existe **só no iMac** (regra da campanha: NUNCA push). Em vez de publicar num
remote, o pré-voo gera um **git bundle** (arquivo `.bundle` que contém a história completa da branch,
incluindo `a19e0e47`) e o embala num **payload `.tar.gz`** junto com o motor de deploy `SZ_VPS_DEPLOY.sh`
e todos os docs. Você transfere **1 arquivo** para o VPS e roda **3 comandos** (`--check`, `--deploy`,
`--fogo`). O deploy é **fail-closed**: prova tripla do MG-07 (commit ancestral → token no fonte →
token no build compilado), backup de banco antes de migrar, health check pós-troca e **rollback
automático** para a release anterior se algo falhar.

**Por que bundle e não `git push`?** Zero exposição de credenciais (nenhum token GitHub/remote
envolvido), zero dependência de rede externa, e o VPS recebe exatamente o commit auditado — nada
mais, nada menos (verificado por SHA no manifesto).

```
iMac (hoje)                          VPS (amanhã)
┌─────────────────────────┐  scp   ┌──────────────────────────────────┐
│ SZ_MG07_PREP.sh         │ ─────► │ tar -xzf MG07VPS_PAYLOAD_*.tar.gz│
│  gates 17/17 + fix V8   │  1     │ bash SZ_VPS_DEPLOY.sh --check    │
│  build verde + bundle   │  file  │ bash SZ_VPS_DEPLOY.sh --deploy   │
│  payload .tar.gz + sha  │        │ bash SZ_VPS_DEPLOY.sh --fogo     │
└─────────────────────────┘        └──────────────────────────────────┘
        ▲  colar digests de volta no chat (paste-back)              │
        └───────────────────────────────────────────────────────────┘
```

---

## 1. PREENCHA ANTES DE COMEÇAR (5 minutos, caneta ou bloco de notas)

| Item | Valor seu (exemplo) | Onde uso |
|------|--------------------|----------|
| IP do VPS | `203.0.113.10` | ssh/scp |
| Usuário SSH | `marcio` (ou `root` só para bootstrap) | ssh/scp |
| Porta SSH | `22` (ou customizada) | ssh -p |
| Provedor | Contabo/Hetzner/DigitalOcean/etc. | painel DNS |
| Domínio | `app.seuzella.com.br` | nginx + SSL |
| Banco | local no VPS **ou** gerenciado (RDS/Neon/Supabase) | `DATABASE_URL` |
| SO do VPS | Ubuntu 22.04/24.04 (assumido; Debian funciona igual) | comandos apt |

> **Se o VPS ainda não existe:** crie hoje na conta do provedor (Ubuntu 24.04, 2 vCPU/4GB ideal —
> mínimo absoluto 2GB com swap; região mais perto dos seus clientes), adicione sua chave SSH
> (`ssh-keygen -t ed25519` no iMac + colar a pública no painel) e anote o IP.

---

## 2. O QUE O KIT ENTREGA (arquivos)

| Arquivo | Onde roda | O que é |
|---------|-----------|---------|
| `1_COMANDO_EXECUTAR.txt` | iMac | pré-voo completo: valida o zip, roda `SZ_MG07_PREP.sh`, log em `~/Downloads` |
| `SZ_MG07_PREP.sh` | iMac | 9 SECs: gates → fundação 17/17 → segurança → build → bundle → payload |
| `2_COMANDO_NO_VPS.txt` | VPS | extração + `--check` + `--deploy` em sequência anotada |
| `3_POS_DEPLOY.txt` | VPS | nginx + SSL + firewall + DNS + fogo (resumo do runbook) |
| `SZ_VPS_DEPLOY.sh` | VPS | motor: `--check` / `--deploy` / `--rollback` / `--fogo` (fail-closed) |
| `docs/MG07VPS_RUNBOOK.md` | leitura | este documento |
| `docs/MG07VPS_CHECKLIST.md` | leitura | checklist de Go/No-Go com caixas |
| `docs/MG07VPS_ENV_TEMPLATE.env` | VPS | **nomes** de variáveis (valores você preenche manualmente) |
| `docs/MG07VPS_PROVAS_DE_FOGO.md` | VPS | provas técnicas + de negócio pós-deploy |
| `docs/MG07VPS_ROLLBACK.md` | VPS | playbook completo de reversão |

---

## 3. HOJE NO IMAC — PRÉ-VOO (≈ 5–8 min, quase tudo é build)

```bash
cd ~/Downloads && rm -rf SZ_MG07_VPS_PREP_V1 && unzip -oq SZ_MG07_VPS_PREP_V1.zip && bash SZ_MG07_VPS_PREP_V1/1_COMANDO_EXECUTAR.txt
```

O que acontece (9 SECs, todas com [OK] no terminal):

1. **SEC 1 GATES** — branch `feat/meta-zella-foundation`, HEAD contém o fix `a19e0e47` e descende da
   base `f749f190`, tree rastreada limpa. Falhou? → nada é tocado.
2. **SEC 2 FUNDAÇÃO** — selo + 16 âncoras RUN12..RUN29 (17/17), mesma tabela selada dos runs V3..V8.
3. **SEC 3 SEGURANÇA** — garante `.env` **não rastreado** (se rastreado: rc=90 e o pré-voo PARA —
   senão segredos viajariam no bundle); token `ACCOUNT_EXISTS` presente no route; digest do FIX V8
   presente em `99_AUDITS/MG07FIX_*/`.
4. **SEC 4 BUILD** — `npm run build` oficial (1–3 min) + **prova de que o artefato `.next/server`
   contém o token MG-07**. `SZ_RUN_SUITE=1` re-roda a suite completa (opcional).
5. **SEC 5 BUNDLE + INVENTÁRIO** — `git bundle` da branch (carrega a19e0e47 SEM push) + inventário
   dos assets de deploy que o repo já tem (`ecosystem.config.js`, `nginx.conf`, scripts backup/
   rollback, health).
6. **SEC 6 PAYLOAD** — monta `MG07VPS_PAYLOAD_<TS>.tar.gz` (bundle + motor VPS + docs + manifesto +
   SHA256SUMS) em `~/Downloads`.
7. **SEC 7 TRANSFERÊNCIA** — imprime o comando `scp` exato (ou transfere se `SZ_VPS_TARGET=usuario@ip`).
8. **SEC 8 DIGEST** — `MG07VPS_PREP_DIGEST.txt` em `99_AUDITS` + `~/Downloads` → **cole no chat**.
9. **SEC 9 AGENDA** — resumo + agenda de amanhã impressa.

**Saídas do dia:** `MG07VPS_PAYLOAD_<TS>.tar.gz` + `MG07VPS_PREP_DIGEST.txt` em `~/Downloads`.
O payload é o ÚNICO arquivo que viaja para o VPS.

---

## 4. BOOTSTRAP DO VPS (amanhã ou hoje — 10–15 min, uma vez só)

Só se o VPS estiver **zero** (nunca rodou o app). Se já roda algo, vá ao 4.5.

### 4.1 Entrar e atualizar

```bash
ssh root@SEU_IP          # ou seu usuário; -p PORTA se customizada
apt update && apt -y upgrade
apt -y install git curl ufw
```

### 4.2 Node 22 LTS (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs
node -v   # esperado v22.x — o motor exige >= v20 (rc=120 se menor)
npm install -g pm2
```

### 4.3 SWAP (OBRIGATÓRIO se RAM < 2GB — build do Next dá OOM sem isso)

```bash
free -m   # veja a RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 4.4 Usuário de app + diretório (menos root)

```bash
adduser --disabled-password --gecos '' marcio 2>/dev/null || true
usermod -aG sudo marcio
mkdir -p /var/www/seuzella && chown -R marcio:marcio /var/www/seuzella
```

### 4.5 Firewall (ufw)

```bash
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable && ufw status verbose
```
> A porta 3000 **NÃO** fica exposta — o nginx é quem fala com a internet (sec 7).

### 4.6 Banco PostgreSQL (se NÃO for gerenciado)

```bash
apt -y install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE seuzella;"
sudo -u postgres psql -c "CREATE USER seuzella_app WITH PASSWORD 'COLOQUE_SENHA_FORTE_AQUI';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE seuzella TO seuzella_app;"
apt -y install postgresql-client   # pg_dump para backups do kit
```
> Gerenciado (Neon/Supabase/RDS)? Pule 4.6 — use a connection string do painel no `.env`.

### 4.7 Redis (se o cache/filas do repo usarem Redis local)

```bash
apt -y install redis-server redis-tools && systemctl enable --now redis-server
```

---

## 5. TRANSFERIR O PAYLOAD (iMac → VPS)

No **iMac** (use o comando impresso pelo pré-voo no SEC 7; template):

```bash
scp ~/Downloads/MG07VPS_PAYLOAD_<TS>.tar.gz SEU_USUARIO@SEU_IP:~/
```

No **VPS**, confira a integridade antes de executar qualquer coisa:

```bash
sha256sum ~/MG07VPS_PAYLOAD_<TS>.tar.gz
# compare com o SHA impresso no SEC 6/7 do pré-voo e no MG07VPS_PREP_DIGEST.txt
```

O `--deploy` re-verifica **tudo** contra o `SHA256SUMS.txt` interno (rc=130 se divergir).

---

## 6. DEPLOY NO VPS (amanhã — 3 comandos, 8–15 min)

```bash
tar -xzf ~/MG07VPS_PAYLOAD_*.tar.gz
cd ~/payload
bash SZ_VPS_DEPLOY.sh --check     # 1) auditoria read-only (30s)
bash SZ_VPS_DEPLOY.sh --deploy    # 2) deploy fail-closed (5-12 min)
bash SZ_VPS_DEPLOY.sh --fogo      # 3) provas técnicas (10s)
```

### 6.1 O que o `--deploy` faz (SECs A–J, cada uma trava a anterior)

| SEC | O que faz | Falha → |
|-----|-----------|---------|
| A | valida SHA256 do payload inteiro + manifesto | rc=130 |
| B | git, curl, node ≥ 20, npm, pm2; RAM/disco; aviso de swap | rc=120 |
| C | cria layout `releases/ shared/ .sz_work/` + marker (recusa dir ocupado) | rc=93 |
| D | clona do bundle, fixa HEAD do manifesto, **PROVA MG-07 1/3 e 2/3** | rc=130 |
| E | exige `shared/.env` com `DATABASE_URL` (chmod 600) — valores nunca exibidos | rc=121 |
| F | `npm ci` | rc=122 |
| G | backup (`scripts/backup.sh` do repo ou `pg_dump`) → `prisma generate` → `prisma migrate deploy` | rc=123 |
| H | `npm run build` + **PROVA MG-07 3/3** (token no `.next/server`) | rc=122/124 |
| I | release imutável `releases/<TS>` + symlink `current` + `.env` linkado | rc=93 |
| J | PM2 (ecosystem gerado, reload se já existia, save) + **health 30s**; falha → **rollback automático** | rc=125/126 |

### 6.2 Layout criado no VPS (respeita deploy legado — marker)

```
/var/www/seuzella/
├── .sz_deploy/            # marker + histórico de releases + logs de etapa
├── .sz_work/repo/         # área de trabalho (limpa a cada deploy)
├── releases/<TS>/         # release imutável (código + node_modules + .next)
├── shared/.env            # ÚNICA fonte de segredos (chmod 600)
├── shared/backups/*.sql.gz
├── current -> releases/<TS>
└── ecosystem.mg07.config.cjs   # PM2 (nome do serviço, porta, mem)
```

### 6.3 Configuração por variáveis (todas opcionais)

```bash
SZ_APP_DIR=/var/www/seuzella SZ_SERVICE=seuzella SZ_PORT=3000 bash SZ_VPS_DEPLOY.sh --deploy
SZ_SKIP_MIGRATE=1 ...   # pula prisma migrate deploy (decisão consciente)
SZ_SVC_MODE=systemd ... # gera unit systemd em vez de PM2
SZ_HEALTH_PATH=/api/health  # fixa a rota de health (padrão: auto-probe)
```

---

## 7. NGINX REVERSO + SSL (após o deploy — 10 min)

```bash
sudo apt -y install nginx
sudo tee /etc/nginx/sites-available/seuzella > /dev/null <<'NGINX'
server {
    listen 80;
    server_name SEU_DOMINIO;           # ex.: app.seuzella.com.br
    client_max_body_size 20M;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/seuzella /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**SSL (Let's Encrypt):**

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO --redirect -m SEU_EMAIL
```

> Sem domínio ainda? Acesse `http://SEU_IP` direto (funciona para os testes; o SSL exige domínio).
> O repo também tem `nginx.conf` próprio (inventário do pré-voo) — se preferir o dele, adapte o
> `server_name`/`proxy_pass` e use-o no lugar deste bloco.

---

## 8. DNS (painel do provedor — manual)

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | `app` (ou `@`) | `SEU_IP` | 3600 |
| CNAME | `www` | `app.seuzella.com.br` | 3600 |

Confirme propagação: `dig +short SEU_DOMINIO` (no iMac). Só então rode o certbot (sec 7).

---

## 9. LEVAR O .ENV DO IMAC PARA O VPS (com segurança)

O bundle **não contém** o `.env` (não-rastreado — provado no SEC 3 do pré-voo). O `.env` do VPS
nasce do template `docs/MG07VPS_ENV_TEMPLATE.env` com os **valores reais** que só você tem:

**Opção A (scp direto, mais rápida):** no iMac —
```bash
scp /Users/marciocau/SeuZella_project/.env SEU_USUARIO@SEU_IP:/var/www/seuzella/shared/.env
ssh SEU_USUARIO@SEU_IP 'chmod 600 /var/www/seuzella/shared/.env'
```

**Opção B (revisada):** crie `shared/.env` do template no VPS (`nano`) e cole valor a valor
consultando o `.env` do iMac **na sua tela** — nunca no chat.

Em ambos: revise chaves que mudam no VPS (`DATABASE_URL` apontando p/ o banco do VPS/gerenciado,
`REDIS_URL`, `NEXT_PUBLIC_*` apontando para o domínio, `NODE_ENV=production`).
O deploy valida no mínimo `DATABASE_URL` (rc=121) e avisa sobre `REDIS_URL`/`NODE_ENV`.

---

## 10. PROVAS DE FOGO (resumo — detalhe em `docs/MG07VPS_PROVAS_DE_FOGO.md`)

1. **Técnicas (automatizadas):** `bash SZ_VPS_DEPLOY.sh --fogo` — serviço vivo, `/` 2xx, health,
   contrato de erro do checkout (`POST /api/checkout/create` com corpo vazio → 4xx), token MG-07 no
   artefato em serviço, `.env` no lugar.
2. **Negócio (manual, guiado):** cadastro real de tenant, login, checkout em modo **sandbox** do
   gateway, webhook do gateway, idempotência (mesma chave 2×), gate MG-07 real
   (e-mail de tenant existente no guest checkout → `409 ACCOUNT_EXISTS`), e-mails transacionais.
3. **Critério GO:** todas as técnicas VERDE + negócio sem bloqueio + 24h de monitoramento sem
   reinício anômalo.

## 11. MONITORAMENTO (24h pós-deploy)

```bash
pm2 status                  # online? restart count estável?
pm2 logs seuzella --lines 100
pm2 monit                   # CPU/RAM ao vivo (Ctrl+C sai)
pm2 startup systemd -u $USER --hp $HOME   # 1x: pm2 volta sozinho após reboot
pm2 save                    # após qualquer mudança no pm2
```

Checklist 24h (3× ao dia, 2 min): `pm2 status` (restarts não cresceram) → `curl -fsS localhost:3000/api/health`
(dentro do VPS) → site real abre → 1 checkout sandbox → `df -h` (disco estável) →
`tail -20 pm2 logs` sem stack trace novo.

## 12. ATUALIZAÇÕES FUTURAS (o ciclo que fica)

Ciclo eterno após o primeiro deploy: **iMac** commit → `SZ_MG07_PREP.sh` (regenera bundle+payload) →
`scp` → VPS `bash SZ_VPS_DEPLOY.sh --deploy` (o motor re-usa o layout: clona, builda, troca o
symlink `current`, faz `pm2 reload`) → `--fogo`. Rollback a qualquer momento:
`bash SZ_VPS_DEPLOY.sh --rollback`.

## 13. ERROS COMUNS (FAQ)

| Sintoma | Causa provável | Remédio |
|---------|---------------|---------|
| rc=120 node ausente/velho | VPS zero | sec 4.2 do runbook |
| rc=121 | `shared/.env` ausente/sem `DATABASE_URL` | sec 9 do runbook |
| rc=122 build mata com `Killed` | OOM (RAM pequena) | swap sec 4.3 e `--deploy` de novo |
| rc=123 migrate falha | banco inalcançável / credencial errada / migration manual pendente | leia `.sz_deploy/prisma_mig_*.log`; teste `psql "$DATABASE_URL" -c 'select 1'` |
| rc=125 pm2 start falha | porta ocupada / `.next` incompleto | `ss -ltnp \| grep 3000`; `pm2 logs seuzella` |
| rc=126 com rollback automático | health não subiu em 30s | logs em `.sz_deploy/build_*.log` e `pm2 logs` |
| rc=93 app dir ocupado | deploy legado sem marker | RUNBOOK 15 (modo manual) |
| health 404 no `--fogo` | rota com outro caminho | `SZ_HEALTH_PATH=/sua/rota bash SZ_VPS_DEPLOY.sh --fogo` |
| site abre por IP, não por domínio | DNS ainda não propagou | `dig +short SEU_DOMINIO`; espere TTL |

## 14. TABELA DE rc (os dois scripts)

| rc | Significado | Script |
|----|-------------|--------|
| 0 | VERDE | ambos |
| 84 | build/suite falhou | pré-voo |
| 87 | fundação divergiu | pré-voo |
| 90 | `.env` rastreado (segurança) | pré-voo |
| 91 | gates (repo/tree suja) | pré-voo |
| 92 | cadeia fix/token ausente | pré-voo |
| 88 | bundle/payload/digest | pré-voo |
| 93 | colisão de layout | deploy |
| 120 | ambiente (node/git/pm2/curl) | deploy |
| 121 | `.env` ausente/incompleto | deploy |
| 122 | npm ci / build | deploy |
| 123 | prisma generate/migrate | deploy |
| 124 | token ausente do `.next` / health sem release anterior | deploy |
| 125 | serviço não subiu | deploy |
| 126 | rollback executado/concluído | deploy |
| 127 | fogo técnico vermelho | deploy |
| 130 | payload/manifesto/MG-07 no fonte | deploy |

## 15. MODO MANUAL (sem os scripts — 100% terminal, se você preferir)

```bash
# No VPS, equivalente ao --deploy (resumo executável):
sudo mkdir -p /var/www/seuzella && sudo chown -R $USER /var/www/seuzella
git clone ~/repo.bundle app -b feat/meta-zella-foundation    # ou: git clone repo.bundle
cd app && git checkout --detach HEAD_DO_MANIFESTO
cp /var/www/seuzella/shared/.env .env 2>/dev/null || nano .env
npm ci --no-audit --no-fund
npx prisma generate && npx prisma migrate deploy
npm run build
grep -rq ACCOUNT_EXISTS .next/server   # PROVA MG-07 manual
pm2 start npm --name seuzella -- start -- -p 3000
pm2 save
curl -fsS localhost:3000/api/health    # ou /
```
> O modo manual NÃO cria o layout de releases/rollback instantâneo — para reverter:
> `scripts/rollback.sh` do repo ou `git checkout` do commit anterior + rebuild. O caminho
> scriptado é estritamente mais seguro; use o manual só se souber por que quer.

---

## 16. PASTE-BACK DE AMANHÃ (o que colar no chat)

1. `MG07VPS_PREP_DIGEST.txt` (do pré-voo de hoje — pode colar hoje mesmo).
2. Log completo do `bash SZ_VPS_DEPLOY.sh --deploy` do VPS.
3. `MG07VPS_DEPLOY_DIGEST.txt` (gerado pelo deploy na pasta payload).
4. Saída do `--fogo`.
→ Com isso eu auditoro o deploy e liberamos as **provas de negócio** (fogo real).

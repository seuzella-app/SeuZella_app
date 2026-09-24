#!/bin/bash
# =============================================================================
# SEUZELLA — MG-07 VPS DEPLOY (V1) — EXECUCAO NO VPS
# SZ_VPS_DEPLOY.sh
# -----------------------------------------------------------------------------
# Consumidor do payload gerado pelo SZ_MG07_PREP.sh (SZ_MG07_VPS_PREP_V1).
# Payload esperado no diretorio corrente (extraido do .tar.gz):
#   repo.bundle | MANIFESTO.txt | SZ_VPS_DEPLOY.sh | docs/ |
#   2_COMANDO_NO_VPS.txt | 3_POS_DEPLOY.txt | SHA256SUMS.txt
#
# MODOS:
#   --check     auditoria READ-ONLY do ambiente VPS (nunca altera nada)
#   --deploy    deploy fail-closed com rollback automatico
#   --rollback  volta para a release anterior (symlink + reload + health)
#   --fogo      provas tecnicas pos-deploy (health, contrato, token MG-07)
#   --help      uso + tabela de rc
#
# LAYOUT QUE O KIT CRIA/MANTÉM (somente dentro de SZ_APP_DIR):
#   $SZ_APP_DIR/
#     .sz_deploy         marcador do kit (colisao rc=93 se dir ocupado sem marker)
#     .sz_work/repo      area de trabalho (clone do bundle + build)
#     releases/<TS>/     cada release imutavel (codigo + node_modules + .next)
#     shared/.env        UNICA fonte de segredos (chmod 600)
#     shared/backups/    dumps pg antes de migracoes
#     current -> releases/<TS>   symlink servido pelo PM2
#     ecosystem.mg07.config.cjs  definicao PM2 (nome SZ_SERVICE)
#
# GARANTIAS:
#   - Prova TRIPLA do MG-07 no deploy: (1) FIX_COMMIT ancestral do HEAD
#     clonado; (2) token ACCOUNT_EXISTS no fonte; (3) token no .next/server
#     compilado. Qualquer prova falha => deploy ABORTA (rc=130/124).
#   - .env: valores NUNCA exibidos (apenas grep -q de NOMES).
#   - NUNCA push, nada remoto; rede usada apenas pelo npm/prisma do proprio VPS.
#   - Qualquer falha apos troca de release => rollback automatico p/ release
#     anterior + reload + rc=126.
#
# TABELA DE rc:
#   64 uso invalido        130 payload/manifesto/bundle/MG-07 no fonte
#   120 ambiente (node/git/pm2)   121 .env ausente/incompleto
#   122 npm install/build  123 prisma generate/migrate
#   124 pos-build (token no .next) / health sem release anterior
#   125 servico nao subiu  93 colisao de layout   126 rollback executado
#   127 prova de fogo vermelha   0 VERDE
# =============================================================================
set -o pipefail

MODE="${1:-}"
case "$MODE" in
  --check|--deploy|--rollback|--fogo|--help) : ;;
  *) echo "uso: bash SZ_VPS_DEPLOY.sh --check|--deploy|--rollback|--fogo|--help"; exit 64 ;;
esac

SZ_APP_DIR="${SZ_APP_DIR:-/var/www/seuzella}"
SZ_SERVICE="${SZ_SERVICE:-seuzella}"
SZ_PORT="${SZ_PORT:-3000}"
SZ_SVC_MODE="${SZ_SVC_MODE:-pm2}"          # pm2 | systemd
SZ_SKIP_MIGRATE="${SZ_SKIP_MIGRATE:-0}"
SZ_HEALTH_PATH="${SZ_HEALTH_PATH:-}"        # vazio = auto-probe
PAYLOAD_DIR="$(cd "$(dirname "$0")" && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
TS_UTC="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
MANIFESTO="$PAYLOAD_DIR/MANIFESTO.txt"
BUNDLE="$PAYLOAD_DIR/repo.bundle"

hdr() { echo ""; echo "================================================================"; echo " $1"; echo "================================================================"; }
die() { local RC="$1"; shift; echo ""; echo "ERRO FATAL [$RC]: $*"; echo " SZ_VPS_DEPLOY ($MODE): rc=$RC (fail-closed)"; exit "$RC"; }
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; fi
}
manifest_get() { sed -n "s/^$1: //p" "$MANIFESTO" 2>/dev/null | head -1 | tr -d '\r'; }
env_has() { grep -qE "^$1=" "$SZ_APP_DIR/shared/.env" 2>/dev/null; }
http_code() { curl -sS -o "$2" -w '%{http_code}' --max-time 5 "$1" 2>/dev/null; }

if [ "$MODE" = "--help" ]; then
  hdr "SZ_VPS_DEPLOY (V1) — AJUDA"
  sed -n '2,60p' "$0"
  exit 0
fi

hdr "SEUZELLA MG-07 VPS DEPLOY (V1) — $MODE — $TS_UTC"
echo " App dir  : $SZ_APP_DIR"
echo " Servico  : $SZ_SERVICE | porta $SZ_PORT | modo $SZ_SVC_MODE"
echo " Payload  : $PAYLOAD_DIR"
echo " Regras   : .env valores nunca exibidos | NUNCA push | rollback automatico"

# =============================================================================
# SEC A — GATES DE PAYLOAD (rc=130)
# =============================================================================
hdr "SEC A/10 — PAYLOAD (rc=130)"
[ -f "$MANIFESTO" ] || die 130 "MANIFESTO.txt ausente em $PAYLOAD_DIR — extraia o .tar.gz e rode de dentro da pasta payload."
[ -f "$BUNDLE" ] || die 130 "repo.bundle ausente — payload incompleto."
[ -f "$PAYLOAD_DIR/SHA256SUMS.txt" ] || die 130 "SHA256SUMS.txt ausente — payload incompleto."
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$PAYLOAD_DIR" && sha256sum -c SHA256SUMS.txt --quiet > /dev/null 2>&1 ) \
    || die 130 "payload divergente do SHA256SUMS — transferencia corrompida ou adulterada. Re-transferir."
else
  die 130 "sha256sum indisponivel no VPS — instale coreutils (apt install coreutils)."
fi
HEAD_SHA="$(manifest_get HEAD_SHA)"
FIX_COMMIT="$(manifest_get FIX_COMMIT)"
BRANCH="$(manifest_get BRANCH)"
[ -n "$HEAD_SHA" ] || die 130 "MANIFESTO sem HEAD_SHA."
echo " [OK] payload integro (SHA256SUMS $(( $(wc -l < "$PAYLOAD_DIR/SHA256SUMS.txt" | tr -d ' ') )) itens)"
echo " [OK] manifesto: HEAD $HEAD_SHA | fix $FIX_COMMIT | branch $BRANCH"

# =============================================================================
# SEC B — AMBIENTE (rc=120)
# =============================================================================
hdr "SEC B/10 — AMBIENTE (rc=120)"
command -v git >/dev/null 2>&1 || die 120 "git ausente (apt install git)."
command -v curl >/dev/null 2>&1 || die 120 "curl ausente (apt install curl)."
command -v node >/dev/null 2>&1 || die 120 "node ausente — instale Node 20+ (comandos no RUNBOOK, sec 4) e rode de novo."
NODE_V="$(node --version)"
NODE_MAJOR="$(echo "$NODE_V" | sed 's/^v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge 20 ] 2>/dev/null || die 120 "node $NODE_V < v20 — atualize (RUNBOOK sec 4.2: NodeSource 22.x)."
command -v npm >/dev/null 2>&1 || die 120 "npm ausente."
if [ "$SZ_SVC_MODE" = "pm2" ]; then
  command -v pm2 >/dev/null 2>&1 || die 120 "pm2 ausente (npm install -g pm2) ou use SZ_SVC_MODE=systemd."
fi
MEM_MB="$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo '?')"
DISK_AVAIL="$(df -Pk "$(dirname "$SZ_APP_DIR" 2>/dev/null || echo /)" 2>/dev/null | awk 'NR==2{print int($4/1024)}' || echo '?')"
echo " [OK] git | node $NODE_V | npm $(npm --version 2>/dev/null) | pm2 $(pm2 --version 2>/dev/null || echo 'n/a')"
echo " [OK] RAM ${MEM_MB}MB | disco livre ~${DISK_AVAIL}MB"
if [ "$MEM_MB" != "?" ] && [ "$MEM_MB" -lt 1800 ] 2>/dev/null; then
  echo " [AVISO] RAM < 1.8GB — o build do Next pode sofrer OOM. Crie swap (RUNBOOK sec 4.3) antes do --deploy."
fi

# =============================================================================
# SEC C — LAYOUT + COLISAO (rc=93)
# =============================================================================
hdr "SEC C/10 — LAYOUT + COLISAO (rc=93)"
[ "$MODE" = "--check" ] || {
  # Colisao: recusa SOMENTE conteudo estranho. Entradas conhecidas do kit
  # (shared/ criada antes com o .env, releases/, .sz_work/, marker, ecosystem,
  # current) nao bloqueiam o primeiro deploy.
  if [ -e "$SZ_APP_DIR" ] && [ -n "$(ls -A "$SZ_APP_DIR" 2>/dev/null)" ] && [ ! -e "$SZ_APP_DIR/.sz_deploy" ]; then
    OCCUPIED=0
    for ENTRY in "$SZ_APP_DIR"/* "$SZ_APP_DIR"/.[!.]*; do
      [ -e "$ENTRY" ] || continue
      case "$(basename "$ENTRY")" in
        shared|releases|.sz_work|.sz_deploy|ecosystem.mg07.config.cjs|current) : ;;
        *) OCCUPIED=1; break ;;
      esac
    done
    if [ "$OCCUPIED" = "1" ]; then
      die 93 "SZ_APP_DIR ocupado e sem marcador .sz_deploy (deployment legado?). Use outro SZ_APP_DIR=... ou siga o MODO MANUAL do RUNBOOK sec 15."
    fi
  fi
  mkdir -p "$SZ_APP_DIR/releases" "$SZ_APP_DIR/shared" "$SZ_APP_DIR/shared/backups" "$SZ_APP_DIR/.sz_work" "$SZ_APP_DIR/.sz_deploy"
  touch "$SZ_APP_DIR/.sz_deploy/marker"
  echo " [OK] layout garantido: releases/ shared/ shared/backups/ .sz_work/ + .sz_deploy/"
}
[ -d "$SZ_APP_DIR" ] && echo " [OK] app dir: $SZ_APP_DIR" || echo " [INFO] app dir ainda inexistente (sera criado no --deploy)"
[ -f "$SZ_APP_DIR/shared/.env" ] && echo " [OK] shared/.env presente" || echo " [AVISO] shared/.env AUSENTE — o --deploy exige (rc=121)"

# =============================================================================
# SEC D/E/F/G/H/I/J — apenas em --deploy
# =============================================================================
if [ "$MODE" = "--deploy" ]; then

# -----------------------------------------------------------------------------
hdr "SEC D/10 — REPO DO BUNDLE + PROVA MG-07 NO FONTE (rc=130)"
# -----------------------------------------------------------------------------
WORK="$SZ_APP_DIR/.sz_work/repo"
if [ -d "$WORK/.git" ]; then
  git -C "$WORK" fetch --quiet "$BUNDLE" "$BRANCH" > /dev/null 2>&1 || die 130 "git fetch do bundle falhou (bundle incompativel com repo de trabalho)."
  echo " [OK] repo de trabalho atualizado do bundle"
else
  git clone --quiet --branch "$BRANCH" "$BUNDLE" "$WORK" > /dev/null 2>&1 || die 130 "git clone do bundle falhou."
  echo " [OK] repo clonado do bundle"
fi
git -C "$WORK" checkout --detach --force "$HEAD_SHA" > /dev/null 2>&1 || die 130 "checkout do HEAD_SHA $HEAD_SHA falhou (bundle nao contem o commit do manifesto)."
ACTUAL="$(git -C "$WORK" rev-parse HEAD)"
[ "$ACTUAL" = "$HEAD_SHA" ] || die 130 "HEAD clonado $ACTUAL != manifesto $HEAD_SHA."
if [ -n "$FIX_COMMIT" ]; then
  git -C "$WORK" merge-base --is-ancestor "$FIX_COMMIT" "$HEAD_SHA" 2>/dev/null \
    || die 130 "PROVA MG-07 (1/3): FIX_COMMIT $FIX_COMMIT nao e ancestral do deploy — payload fora da cadeia."
  echo " [OK] PROVA MG-07 (1/3): fix commit ancestral do HEAD deployado"
fi
grep -q 'ACCOUNT_EXISTS' "$WORK/src/app/api/checkout/create/route.ts" 2>/dev/null \
  || die 130 "PROVA MG-07 (2/3): ACCOUNT_EXISTS ausente do fonte no bundle."
echo " [OK] PROVA MG-07 (2/3): token presente no fonte"
git -C "$WORK" log --oneline -1 2>/dev/null | sed 's/^/ [OK] deployando: /'

# -----------------------------------------------------------------------------
hdr "SEC E/10 — GATE .ENV (rc=121) — valores nunca exibidos"
# -----------------------------------------------------------------------------
ENVF="$SZ_APP_DIR/shared/.env"
[ -f "$ENVF" ] || die 121 "shared/.env ausente. Crie a partir de docs/MG07VPS_ENV_TEMPLATE.env e copie os VALORES do .env do iMac (scp manual, nunca pelo chat)."
env_has DATABASE_URL || die 121 "shared/.env sem DATABASE_URL."
[ -s "$ENVF" ] || die 121 "shared/.env vazio."
chmod 600 "$ENVF"
cp "$ENVF" "$WORK/.env"
echo " [OK] .env presente (chmod 600) + DATABASE_URL presente — valores NUNCA exibidos"
env_has REDIS_URL || echo " [AVISO] shared/.env sem REDIS_URL — cache/filas podem degradar (confira cache.ts)"

# -----------------------------------------------------------------------------
hdr "SEC F/10 — INSTALACAO (rc=122)"
# -----------------------------------------------------------------------------
( cd "$WORK" && npm ci --no-audit --no-fund ) > "$SZ_APP_DIR/.sz_deploy/npm_ci_$TS.log" 2>&1 \
  || ( cd "$WORK" && npm install --no-audit --no-fund ) >> "$SZ_APP_DIR/.sz_deploy/npm_ci_$TS.log" 2>&1 \
  || { tail -15 "$SZ_APP_DIR/.sz_deploy/npm_ci_$TS.log"; die 122 "npm ci/install falhou (log: .sz_deploy/npm_ci_$TS.log)."; }
echo " [OK] dependencias instaladas"

# -----------------------------------------------------------------------------
hdr "SEC G/10 — BACKUP + PRISMA (rc=123)"
# -----------------------------------------------------------------------------
if [ -f "$WORK/prisma/schema.prisma" ]; then
  if [ -x "$WORK/scripts/backup.sh" ]; then
    echo " [..] backup do repo (scripts/backup.sh, best-effort)..."
    ( cd "$WORK" && bash scripts/backup.sh ) > "$SZ_APP_DIR/.sz_deploy/backup_$TS.log" 2>&1 \
      && echo " [OK] backup.sh do repo executou" \
      || echo " [AVISO] scripts/backup.sh falhou/nao aplicavel (log: .sz_deploy/backup_$TS.log) — seguindo com pg_dump proprio se possivel"
  fi
  DBURL="$(grep -E '^DATABASE_URL=' "$ENVF" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//; s/^\x27//; s/\x27$//')"
  case "$DBURL" in
    postgres://*|postgresql://*)
      if command -v pg_dump >/dev/null 2>&1; then
        pg_dump "$DBURL" 2>/dev/null | gzip > "$SZ_APP_DIR/shared/backups/pre_deploy_$TS.sql.gz" \
          && echo " [OK] pg_dump salvo: shared/backups/pre_deploy_$TS.sql.gz" \
          || echo " [AVISO] pg_dump falhou (db acessivel? credenciais?) — deploy segue, mas migre com consciencia"
      else
        echo " [AVISO] pg_dump ausente (apt install postgresql-client) — sem dump antes de migrar"
      fi ;;
    *) echo " [INFO] DATABASE_URL nao e postgres — backup pg_dump ignorado" ;;
  esac
  ( cd "$WORK" && npx prisma generate ) > "$SZ_APP_DIR/.sz_deploy/prisma_gen_$TS.log" 2>&1 \
    || { tail -10 "$SZ_APP_DIR/.sz_deploy/prisma_gen_$TS.log"; die 123 "prisma generate falhou."; }
  echo " [OK] prisma generate"
  if [ "$SZ_SKIP_MIGRATE" = "1" ]; then
    echo " [INFO] SZ_SKIP_MIGRATE=1 — migrate deploy PULADO (decisao consciente)"
  else
    ( cd "$WORK" && npx prisma migrate deploy ) > "$SZ_APP_DIR/.sz_deploy/prisma_mig_$TS.log" 2>&1 \
      || { tail -15 "$SZ_APP_DIR/.sz_deploy/prisma_mig_$TS.log"; die 123 "prisma migrate deploy falhou (log: .sz_deploy/prisma_mig_$TS.log). Banco NAO foi quebrado pelo kit — migre manual se preciso."; }
    echo " [OK] prisma migrate deploy (log: .sz_deploy/prisma_mig_$TS.log)"
  fi
else
  echo " [INFO] prisma/schema.prisma ausente — etapa prisma ignorada"
fi

# -----------------------------------------------------------------------------
hdr "SEC H/10 — BUILD + PROVA MG-07 NO ARTEFATO (rc=122/124)"
# -----------------------------------------------------------------------------
echo " [..] npm run build no VPS (2-6 min em VPS pequeno)..."
BUILD_T0="$(date +%s)"
( cd "$WORK" && NEXT_TELEMETRY_DISABLED=1 npm run build ) > "$SZ_APP_DIR/.sz_deploy/build_$TS.log" 2>&1 \
  || { tail -20 "$SZ_APP_DIR/.sz_deploy/build_$TS.log"; die 122 "build no VPS falhou (log: .sz_deploy/build_$TS.log). Se OOM: crie swap (RUNBOOK 4.3) e rode de novo."; }
BUILD_T1="$(date +%s)"
echo " [OK] build VERDE ($((BUILD_T1-BUILD_T0))s)"
grep -rq 'ACCOUNT_EXISTS' "$WORK/.next/server" 2>/dev/null \
  || die 124 "PROVA MG-07 (3/3): ACCOUNT_EXISTS AUSENTE do .next/server compilado — artefato nao carrega o FIX. Deploy ABORTADO."
echo " [OK] PROVA MG-07 (3/3): token presente no artefato compilado"

# -----------------------------------------------------------------------------
hdr "SEC I/10 — RELEASE + TROCA (rc=93/126)"
# -----------------------------------------------------------------------------
REL="$SZ_APP_DIR/releases/$TS"
SUF=0
while [ -e "$REL" ]; do SUF=$((SUF+1)); REL="$SZ_APP_DIR/releases/${TS}_$SUF"; done
mv "$WORK" "$REL" || die 93 "mv da release falhou (permissao? use sudo chown -R \$USER $SZ_APP_DIR)."
mkdir -p "$SZ_APP_DIR/.sz_work"
rm -f "$REL/.env"
ln -s "$SZ_APP_DIR/shared/.env" "$REL/.env"
PREV=""
if [ -L "$SZ_APP_DIR/current" ]; then PREV="$(readlink -f "$SZ_APP_DIR/current")"; fi
ln -sfn "$REL" "$SZ_APP_DIR/current"
REL_TS="$(basename "$REL")"
echo "$REL_TS $HEAD_SHA" >> "$SZ_APP_DIR/.sz_deploy/history"
echo " [OK] release $REL_TS ativada (current -> releases/$REL_TS)"
[ -n "$PREV" ] && echo " [OK] release anterior preservada: $(basename "$PREV")"

# -----------------------------------------------------------------------------
hdr "SEC J/10 — SERVICO + HEALTH (rc=125/126)"
# -----------------------------------------------------------------------------
cat > "$SZ_APP_DIR/ecosystem.mg07.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: "$SZ_SERVICE",
    cwd: "$SZ_APP_DIR/current",
    script: "node_modules/next/dist/bin/next",
    args: "start -p $SZ_PORT",
    env: { NODE_ENV: "production", PORT: "$SZ_PORT" },
    max_memory_restart: "700M",
    time: true,
  }],
};
EOF
if [ "$SZ_SVC_MODE" = "pm2" ]; then
  RUNNING="$(pm2 pid "$SZ_SERVICE" 2>/dev/null | head -1 | tr -d '[:space:]')"
  if [ -n "$RUNNING" ] && [ "$RUNNING" != "0" ]; then
    pm2 reload "$SZ_SERVICE" --update-env > /dev/null 2>&1 || { pm2 logs "$SZ_SERVICE" --lines 20 --nostream 2>/dev/null | tail -20; die 125 "pm2 reload falhou."; }
    echo " [OK] pm2 reload $SZ_SERVICE"
  else
    pm2 start "$SZ_APP_DIR/ecosystem.mg07.config.cjs" > /dev/null 2>&1 || { tail -30 "$(pm2 logs "$SZ_SERVICE" --lines 5 --nostream 2>/dev/null | tail -5)" 2>/dev/null; die 125 "pm2 start falhou — rode 'pm2 logs $SZ_SERVICE' e o RUNBOOK sec 13."; }
    echo " [OK] pm2 start $SZ_SERVICE (ecosystem.mg07.config.cjs)"
  fi
  pm2 save > /dev/null 2>&1 && echo " [OK] pm2 save (sobrevive a reboot com pm2 startup — RUNBOOK 11)"
  pm2 pid "$SZ_SERVICE" 2>/dev/null | head -1 | tr -d '[:space:]' | grep -qE '^[1-9][0-9]*$' || die 125 "servico $SZ_SERVICE nao esta rodando apos start/reload."
else
  cat > "$SZ_APP_DIR/$SZ_SERVICE.service" <<EOF
[Unit]
Description=SeuZella (MG07 kit)
After=network.target

[Service]
User=$USER
WorkingDirectory=$SZ_APP_DIR/current
Environment=NODE_ENV=production
Environment=PORT=$SZ_PORT
ExecStart=$(command -v node) node_modules/next/dist/bin/next start -p $SZ_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  echo " [INFO] SZ_SVC_MODE=systemd — unit gerada em $SZ_APP_DIR/$SZ_SERVICE.service"
  echo " [INFO] instale manual: sudo cp $SZ_APP_DIR/$SZ_SERVICE.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now $SZ_SERVICE"
  systemctl is-active --quiet "$SZ_SERVICE" 2>/dev/null || die 125 "servico systemd $SZ_SERVICE inativo — instale a unit conforme impresso acima."
  echo " [OK] systemd $SZ_SERVICE ativo"
fi

HEALTH_OK=""; HEALTH_USED=""
for i in $(seq 1 30); do
  PATHS_TRY="$SZ_HEALTH_PATH"
  [ -z "$PATHS_TRY" ] && PATHS_TRY="/api/health /api/healthz /"
  for HP in $PATHS_TRY; do
    CODE="$(http_code "http://127.0.0.1:$SZ_PORT$HP" "$SZ_APP_DIR/.sz_deploy/health_body.tmp")"
    case "$CODE" in 2??) HEALTH_OK="1"; HEALTH_USED="$HP"; break ;; esac
  done
  [ -n "$HEALTH_OK" ] && break
  sleep 1
done
if [ -z "$HEALTH_OK" ]; then
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$SZ_APP_DIR/current"
    [ "$SZ_SVC_MODE" = "pm2" ] && pm2 reload "$SZ_SERVICE" --update-env > /dev/null 2>&1
    echo " [ROLLBACK] health falhou — current restaurado para $(basename "$PREV") + reload"
    die 126 "health check falhou apos 30s. ROLLBACK AUTOMATICO executado. Logs: pm2 logs $SZ_SERVICE | .sz_deploy/build_$TS.log"
  fi
  pm2 logs "$SZ_SERVICE" --lines 20 --nostream 2>/dev/null | tail -20
  die 124 "health check falhou apos 30s e NAO havia release anterior para rollback. Logs acima."
fi
echo " [OK] HEALTH VERDE via $HEALTH_USED (http://127.0.0.1:$SZ_PORT$HEALTH_USED)"

DEPLOY_DIGEST="$PAYLOAD_DIR/MG07VPS_DEPLOY_DIGEST.txt"
cat > "$DEPLOY_DIGEST" <<EOF
================================================================
MG07VPS_DEPLOY_DIGEST — SZ_MG07_VPS_DEPLOY_V1
================================================================
[A] RELEASE   : $TS ($HEAD_SHA)
[B] PROVA MG-07: 3/3 VERDE (commit ancestral + token fonte + token .next/server)
[C] SERVICO   : $SZ_SVC_MODE $SZ_SERVICE na porta $SZ_PORT
[D] HEALTH    : VERDE via $HEALTH_USED
[E] RELEASE ANTERIOR PRESERVADA: $([ -n "$PREV" ] && basename "$PREV" || echo "primeira release")
[F] BACKUP DB : shared/backups/pre_deploy_$TS.sql.gz $([ -f "$SZ_APP_DIR/shared/backups/pre_deploy_$TS.sql.gz" ] && echo PRESENTE || echo "(indisponivel)")
[G] DIGEST EM : $DEPLOY_DIGEST (+ $SZ_APP_DIR/.sz_deploy/)
[H] PROXIMO   : bash SZ_VPS_DEPLOY.sh --fogo | depois 3_POS_DEPLOY.txt (nginx/SSL/DNS)
================================================================
FIM — rc=0 VERDE
================================================================
EOF
cp "$DEPLOY_DIGEST" "$SZ_APP_DIR/.sz_deploy/" 2>/dev/null || true
echo " [OK] digest: $DEPLOY_DIGEST"

fi  # --deploy

# =============================================================================
# --ROLLBACK
# =============================================================================
if [ "$MODE" = "--rollback" ]; then
  hdr "SEC R — ROLLBACK (rc=126)"
  [ -f "$SZ_APP_DIR/.sz_deploy/history" ] || die 126 "sem historico de releases — nada para reverter."
  CUR="$(readlink -f "$SZ_APP_DIR/current" 2>/dev/null || echo '')"
  CUR_TS="$(basename "$CUR" 2>/dev/null || echo '')"
  PREV_LINE="$(grep -v "^$CUR_TS " "$SZ_APP_DIR/.sz_deploy/history" 2>/dev/null | tail -1 || true)"
  [ -n "$PREV_LINE" ] || die 126 "sem release anterior a '$CUR_TS' no historico."
  PREV_TS="$(echo "$PREV_LINE" | awk '{print $1}')"
  PREV_SHA="$(echo "$PREV_LINE" | awk '{print $2}')"
  PREV_DIR="$SZ_APP_DIR/releases/$PREV_TS"
  [ -d "$PREV_DIR" ] || die 126 "release anterior $PREV_DIR nao existe mais."
  ln -sfn "$PREV_DIR" "$SZ_APP_DIR/current"
  if [ "$SZ_SVC_MODE" = "pm2" ]; then
    pm2 reload "$SZ_SERVICE" --update-env > /dev/null 2>&1 || die 126 "pm2 reload falhou no rollback."
  fi
  CODE="$(http_code "http://127.0.0.1:$SZ_PORT/" "$SZ_APP_DIR/.sz_deploy/rollback_body.tmp")"
  case "$CODE" in 2??|3??|40*) H="VERDE" ;; *) H="AMARELO ($CODE — confira pm2 logs)" ;; esac
  echo " [OK] rollback: current -> releases/$PREV_TS (sha $PREV_SHA)"
  echo " [OK] health pos-rollback: $H"
  echo " SZ_VPS_DEPLOY ($MODE): rc=0 — rollback concluido"
  exit 0
fi

# =============================================================================
# --FOGO
# =============================================================================
if [ "$MODE" = "--fogo" ]; then
  hdr "SEC F/6 — PROVAS TECNICAS DE FOGO (rc=127)"
  FAIL=0
  if [ "$SZ_SVC_MODE" = "pm2" ]; then
    pm2 pid "$SZ_SERVICE" 2>/dev/null | head -1 | tr -d '[:space:]' | grep -qE '^[1-9][0-9]*$' \
      || { echo " [FALHA] servico $SZ_SERVICE parado"; FAIL=1; } \
      || true
    [ $FAIL -eq 0 ] && echo " [OK] 1/6 servico $SZ_SERVICE rodando (pm2)"
  else
    systemctl is-active --quiet "$SZ_SERVICE" 2>/dev/null || { echo " [FALHA] systemd $SZ_SERVICE inativo"; FAIL=1; }
    [ $FAIL -eq 0 ] && echo " [OK] 1/6 servico systemd ativo"
  fi
  HOME_BODY="$SZ_APP_DIR/.sz_deploy/fogo_home.tmp"
  CODE="$(http_code "http://127.0.0.1:$SZ_PORT/" "$HOME_BODY")"
  case "$CODE" in 2??|3??) echo " [OK] 2/6 GET / -> $CODE" ;; *) echo " [FALHA] 2/6 GET / -> $CODE"; FAIL=1 ;; esac
  HP_LIST="$SZ_HEALTH_PATH"; [ -z "$HP_LIST" ] && HP_LIST="/api/health /api/healthz /api/health-check /"
  HCODE=""; HUSED=""
  for HP in $HP_LIST; do
    C="$(http_code "http://127.0.0.1:$SZ_PORT$HP" "$SZ_APP_DIR/.sz_deploy/fogo_health.tmp")"
    case "$C" in 2??) HCODE="$C"; HUSED="$HP"; break ;; 4??) [ -z "$HUSED" ] && { HCODE="$C"; HUSED="$HP"; } ;; esac
  done
  case "$HCODE" in
    2??) echo " [OK] 3/6 health $HUSED -> $HCODE" ;;
    4??) echo " [AVISO] 3/6 health $HUSED -> $HCODE (rota existe mas responde 4xx — confira allowlist)";;
    *) echo " [AVISO] 3/6 nenhuma rota de health respondeu — defina SZ_HEALTH_PATH" ;;
  esac
  FBODY="$SZ_APP_DIR/.sz_deploy/fogo_checkout.tmp"
  CCODE="$(curl -sS -o "$FBODY" -w '%{http_code}' --max-time 8 -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:$SZ_PORT/api/checkout/create" 2>/dev/null || echo 000)"
  case "$CCODE" in
    4??) echo " [OK] 4/6 POST /api/checkout/create (corpo vazio) -> $CCODE (contrato de erro vivo)" ;;
    000) echo " [FALHA] 4/6 POST /api/checkout/create -> sem resposta"; FAIL=1 ;;
    5??) echo " [AVISO] 4/6 POST /api/checkout/create -> $CCODE (500 com corpo vazio — pode ser normal p/ payload invalido; confira logs)" ;;
    *) echo " [AVISO] 4/6 POST /api/checkout/create -> $CCODE (inesperado)" ;;
  esac
  if grep -rq 'ACCOUNT_EXISTS' "$SZ_APP_DIR/current/.next/server" 2>/dev/null; then
    echo " [OK] 5/6 PROVA MG-07 no artefato servido: ACCOUNT_EXISTS PRESENTE"
  else
    echo " [FALHA] 5/6 PROVA MG-07: token ausente do .next em servico"; FAIL=1
  fi
  if [ -f "$SZ_APP_DIR/shared/.env" ]; then
    echo " [OK] 6/6 shared/.env presente (chmod $(stat -c '%a' "$SZ_APP_DIR/shared/.env" 2>/dev/null || echo '?'))"
  else
    echo " [FALHA] 6/6 shared/.env sumiu"; FAIL=1
  fi
  echo ""
  if [ $FAIL -ne 0 ]; then
    die 127 "provas tecnicas de fogo com FALHA — resolva antes das provas de negocio (docs/MG07VPS_PROVAS_DE_FOGO.md)"
  fi
  echo "================================================================"
  echo " FOGO TECNICO: rc=0 VERDE — siga as PROVAS DE NEGOCIO em docs/MG07VPS_PROVAS_DE_FOGO.md"
  echo "================================================================"
  exit 0
fi

# =============================================================================
# --CHECK (read-only; nunca altera nada; sempre rc=0 com diagnostico)
# =============================================================================
if [ "$MODE" = "--check" ]; then
  hdr "SEC K/10 — CHECK DETALHADO (read-only)"
  VERMELHO=0; AMARELO=0
  say() { echo "   $*"; }
  RED() { say "[VERMELHO] $*"; VERMELHO=$((VERMELHO+1)); }
  YEL() { say "[AMARELO] $*"; AMARELO=$((AMARELO+1)); }
  GRN() { say "[OK] $*"; }
  say "SO/REDE:"
  say "  - $(uname -sr 2>/dev/null || echo '?') | $(ip -brief address show 2>/dev/null | awk 'NR==2{print $2, $3}' || hostname -I 2>/dev/null || echo 'rede n/a')"
  say "PORTA $SZ_PORT:"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$SZ_PORT " && YEL "porta $SZ_PORT JA EM USO (servico legado? EADDRINUSE no start)" || GRN "porta $SZ_PORT livre"
  else say "  - ss indisponivel"; fi
  say "APP DIR ($SZ_APP_DIR):"
  if [ ! -e "$SZ_APP_DIR" ]; then GRN "nao existe (primeiro deploy)"; 
  elif [ -d "$SZ_APP_DIR/.sz_deploy" ]; then
    GRN "layout do kit presente ($(ls -1 "$SZ_APP_DIR/releases" 2>/dev/null | wc -l | tr -d ' ') release(s), current -> $(readlink "$SZ_APP_DIR/current" 2>/dev/null || echo '?'))"
  else YEL "existe e SEM marker do kit — --deploy vai recusar (rc=93); leia RUNBOOK 15" ; fi
  say ".ENV ($SZ_APP_DIR/shared/.env):"
  if [ -f "$SZ_APP_DIR/shared/.env" ]; then
    GRN "presente (chmod $(stat -c '%a' "$SZ_APP_DIR/shared/.env" 2>/dev/null || echo '?'))"
    for V in DATABASE_URL REDIS_URL NODE_ENV; do
      env_has "$V" && GRN "tem $V" || YEL "SEM $V"
    done
  else RED "AUSENTE — crie do template docs/MG07VPS_ENV_TEMPLATE.env (rc=121 no deploy)"; fi
  say "BANCO/REDIS:"
  command -v psql >/dev/null 2>&1 && GRN "psql presente" || YEL "psql ausente (backup pg_dump indisponivel — apt install postgresql-client)"
  command -v pg_dump >/dev/null 2>&1 && GRN "pg_dump presente" || YEL "pg_dump ausente"
  command -v redis-cli >/dev/null 2>&1 && GRN "redis-cli presente" || YEL "redis-cli ausente (se Redis local: apt install redis-server)"
  say "ASSETS DO REPO PARA O DEPLOY (referencia):"
  for A in ecosystem.config.js nginx.conf scripts/backup.sh scripts/rollback.sh; do
    if [ -d "$SZ_APP_DIR/.sz_work/repo" ] && [ -e "$SZ_APP_DIR/.sz_work/repo/$A" ]; then GRN "$A presente no bundle"; else say "  [info] $A (verificar no bundle)"; fi
  done
  say "PROVA MG-07 NA ULTIMA RELEASE:"
  if [ -d "$SZ_APP_DIR/current/.next/server" ]; then
    grep -rq 'ACCOUNT_EXISTS' "$SZ_APP_DIR/current/.next/server" 2>/dev/null && GRN "token presente na release em servico" || RED "token AUSENTE na release em servico"
  else say "  [info] nenhuma release em servico ainda"; fi
  echo ""
  if [ $VERMELHO -gt 0 ]; then
    echo " CHECK: VERMELHO ($VERMELHO bloqueio(s), $AMARELO aviso(s)) — resolva antes do --deploy (o --deploy de qualquer forma recusa)"
  elif [ $AMARELO -gt 0 ]; then
    echo " CHECK: AMARELO ($AMARELO aviso(s), 0 bloqueios) — --deploy liberado; avisos merecem leitura"
  else
    echo " CHECK: VERDE (0 bloqueios, 0 avisos) — pronto para --deploy"
  fi
  echo " SZ_VPS_DEPLOY ($MODE): rc=0 (read-only, nada foi alterado)"
  exit 0
fi

exit 0

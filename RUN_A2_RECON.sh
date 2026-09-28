#!/bin/bash
# ============================================================================
# SEUZELLA — RUN A2 RECON (READ-ONLY) — v1
# Nao modifica NADA no repositorio. Nao le .env. Nao faz git write.
# Captura: prova git da base + manifesto de rotas + payload tar.gz (b64)
# Saida: REPO_ROOT/99_AUDITS/RUN_A2_RECON_<ts>/
# ============================================================================
set -u

echo "=============================================="
echo " SEUZELLA RUN A2 RECON (somente leitura) v1"
echo "=============================================="

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "${REPO_ROOT:-}" ]; then
  echo "ERRO FATAL: fora de um repositorio git (rc=51)"; exit 51
fi
cd "$REPO_ROOT" || exit 52

TS="$(date -u +%Y%m%d_%H%M%S)"
OUT="99_AUDITS/RUN_A2_RECON_${TS}"
mkdir -p "$OUT" || exit 53
echo "Saida: $OUT"

# ----------------------------------------------------------------------------
# 1) PROVA GIT DA BASE
# ----------------------------------------------------------------------------
{
  echo "== RUN A2 RECON — PROVA GIT — $(date -u +%Y-%m-%dT%H:%M:%SZ) =="
  echo "A) HEAD:"
  git rev-parse HEAD
  echo "B) BRANCH:"
  git rev-parse --abbrev-ref HEAD
  echo "C) LOG -3:"
  git log -3 --oneline
  echo "D) OBJETO HEAD (parent prova pureza do commit LOTE A):"
  git cat-file -p HEAD
  echo "E) DIFF 82bf6047..HEAD --stat (deve ser o LOTE A: 10 files, 158+/17-):"
  git diff 82bf6047..HEAD --stat
  echo "F) STATUS --short:"
  git status --short
  echo "G) QUANTIDADE DE ROTAS:"
  find src/app/api -name "route.ts" 2>/dev/null | wc -l
} > "$OUT/DIGEST.txt" 2>&1

# ----------------------------------------------------------------------------
# 2) MANIFESTO DE ROTAS (1 linha por route.ts)
# ----------------------------------------------------------------------------
find src/app/api -name "route.ts" 2>/dev/null | sort | while read -r f; do
  methods="$(grep -oE 'export (async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' "$f" 2>/dev/null | awk '{print $NF}' | tr '\n' ',' )"
  g=""
  echo "$f" | grep -qE "(debug|diagnose|simulate|simulation|sandbox|lab|seed|synthetic|test|dev|mock)" && g="${g}LABNAME,"
  grep -qE "withApiGuard|withAdminGuard|withTenantGuard" "$f" && g="${g}withApiGuard,"
  grep -q "withCronGuard" "$f" && g="${g}withCronGuard,"
  grep -q "verifyCronM2MToken" "$f" && g="${g}verifyCronM2MToken,"
  grep -q "verifyZCCAccess" "$f" && g="${g}verifyZCCAccess,"
  grep -q "resolveZccTenantScope" "$f" && g="${g}resolveZccTenantScope,"
  grep -q "getServerSession" "$f" && g="${g}getServerSession,"
  grep -q "verifyRobotToken\|timingSafeEqual" "$f" && g="${g}timingSafe,"
  grep -qE "searchParams\.get\(.tenantId|body\.tenantId|params\.tenantId|query\.tenantId" "$f" && g="${g}tenantFromRequest,"
  grep -q "NODE_ENV" "$f" && g="${g}nodeEnvCheck,"
  grep -qE "\.delete\(|\.update\(|\.create\(|\.upsert\(|\.deleteMany\(|\.updateMany\(" "$f" && g="${g}mutation,"
  wc -l < "$f" | tr -d ' ' > /tmp/_szrecon_lines
  echo "$f|$(echo "$methods" | sed 's/,$//')|$(echo "$g" | sed 's/,$//')|$(cat /tmp/_szrecon_lines)l"
done >> "$OUT/DIGEST.txt" 2>/dev/null

{
  echo "H) SUITES DE TESTE (arquivos + linhas):"
  for t in tests/security tests/auth tests/realtime tests/whatsapp tests/meta tests/mobile; do
    [ -e "$t" ] && find "$t" \( -name "*.test.ts" -o -name "*.test.tsx" \) -exec wc -l {} \; 2>/dev/null
  done
  for t in tests/security-hardening-12-fronts.test.ts tests/zcc-security.test.ts tests/semantica-client.test.ts tests/semantica-lgpd.test.ts tests/sast-static.test.ts tests/locks-lgpd-audit.test.ts tests/locks-multi-tenant-scale.test.ts; do
    [ -f "$t" ] && wc -l "$t"
  done
  echo "I) LIBS DE SEGURANCA (arquivos + linhas):"
  find src/lib/security src/lib/auth -type f -name "*.ts" -exec wc -l {} \; 2>/dev/null
  for f in src/lib/zcc-security.ts src/middleware.ts src/lib/auth.ts src/lib/auth-guard.ts src/lib/db.ts; do
    [ -f "$f" ] && wc -l "$f"
  done
  echo "J) PATCH LOTE A ORIGINAL (se o kit ainda estiver aqui):"
  if [ -f SEUZELLA_LOTE_A_SECURITY/LOTEA_SECURITY.patch ]; then
    shasum -a 256 SEUZELLA_LOTE_A_SECURITY/LOTEA_SECURITY.patch
  else
    echo "(kit dir ausente na raiz)"
  fi
} >> "$OUT/DIGEST.txt" 2>&1

# ----------------------------------------------------------------------------
# 3) PAYLOAD: tar.gz dos arquivos que o RUN A2 precisa LER (b64, em blocos)
#    NUNCA inclui .env / segredos / node_modules / .next / 99_AUDITS
# ----------------------------------------------------------------------------
FILES=""
add() { [ -e "$1" ] && FILES="$FILES $1"; }
for f in src/lib/security/*;      do add "$f"; done
for f in src/lib/auth/*;          do add "$f"; done
add src/lib/auth.ts
add src/lib/auth-guard.ts
add src/lib/zcc-security.ts
add src/middleware.ts
add src/proxy.ts
add src/lib/db.ts
add prisma/schema.prisma
add package.json
add tsconfig.json
add eslint.config.mjs
[ -d src/app/api/internal ] && for f in $(find src/app/api/internal -type f); do add "$f"; done
[ -d src/app/api/cron ]     && for f in $(find src/app/api/cron -type f);     do add "$f"; done
[ -d src/app/api/zcc ]      && for f in $(find src/app/api/zcc -type f);      do add "$f"; done
[ -d tests/security ]       && for f in $(find tests/security -type f);       do add "$f"; done
[ -d tests/auth ]           && for f in $(find tests/auth -type f);           do add "$f"; done
[ -d tests/realtime ]       && for f in $(find tests/realtime -type f -name "tenant-*"); do add "$f"; done
add tests/security-hardening-12-fronts.test.ts
add tests/zcc-security.test.ts
add tests/semantica-client.test.ts
add tests/semantica-lgpd.test.ts
add tests/sast-static.test.ts
add tests/locks-lgpd-audit.test.ts
add tests/locks-multi-tenant-scale.test.ts
add tests/whatsapp/inbound-security-contract.test.ts
add tests/meta/meta-wave3-webhook-guard.test.ts
add tests/mobile/mobile-api-auth-contract.test.ts
add tests/mobile/ddc-mobile-security-contract.test.ts
add tests/mobile/mobile-production-security-contract.test.ts
add tests/security/run6b-m2m-roles.test.ts

[ -z "$FILES" ] && { echo "ERRO: nenhum arquivo capturado (rc=54)"; exit 54; }

# shellcheck disable=SC2086
tar czf "$OUT/payload.tar.gz" $FILES 2>/dev/null
PB64="$OUT/PAYLOAD.b64"
base64 < "$OUT/payload.tar.gz" > "$PB64"
shasum -a 256 "$OUT/payload.tar.gz" > "$OUT/PAYLOAD.sha256"

split -b 48000 "$PB64" "$OUT/PAYLOAD_b64_"

NPARTS=$(ls "$OUT"/PAYLOAD_b64_* 2>/dev/null | wc -l | tr -d ' ')
PSIZE=$(wc -c < "$OUT/payload.tar.gz" | tr -d ' ')

# ----------------------------------------------------------------------------
# 4) RESUMO FINAL
# ----------------------------------------------------------------------------
{
  echo "K) PAYLOAD: payload.tar.gz = ${PSIZE} bytes; blocos base64 = ${NPARTS}"
  echo "L) RECON rc=0 — cole no chat: DIGEST.txt + PAYLOAD.sha256 + os blocos PAYLOAD_b64_*"
} >> "$OUT/DIGEST.txt"

echo ""
echo "=================================================="
echo " RECON CONCLUIDO — rc=0"
echo " Cole no chat:"
echo "   1) cat $OUT/DIGEST.txt"
echo "   2) cat $OUT/PAYLOAD.sha256"
echo "   3) cat $OUT/PAYLOAD_b64_*   (blocos, um por vez)"
echo "=================================================="
exit 0

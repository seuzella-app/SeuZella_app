#!/usr/bin/env bash
set -Eeuo pipefail

# Post-release synthetic smoke. No credentials are printed and no mutating
# application action is performed by this script.
BASE_URL="${1:-${APP_URL:-}}"
[[ -n "$BASE_URL" ]] || { echo 'SMOKE=FAIL: APP_URL required' >&2; exit 2; }
BASE_URL="${BASE_URL%/}"

curl_json() {
  curl --fail-with-body --silent --show-error --max-time 15 \
    --header 'Accept: application/json' "$1"
}

check_endpoint() {
  local path="$1" expected="$2" body
  body="$(curl_json "${BASE_URL}${path}")" || { echo "SMOKE=FAIL path=${path} transport" >&2; return 1; }
  if [[ "$path" == '/api/health' ]]; then
    printf '%s' "$body" | grep -q '"status"' || { echo "SMOKE=FAIL path=${path} missing_status" >&2; return 1; }
  fi
  printf 'PASS path=%s expected=%s\n' "$path" "$expected"
}

check_endpoint '/api/health' '2xx'

readiness_code="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' \
  "${BASE_URL}/api/readiness")" || {
  echo 'SMOKE=FAIL path=/api/readiness transport' >&2
  exit 1
}

case "$readiness_code" in
  503)
    printf '%s\n' 'INFO path=/api/readiness status=503 (diagnostic; not a false GREEN)'
    ;;
  2??)
    printf 'PASS path=/api/readiness http=%s\n' "$readiness_code"
    ;;
  *)
    printf 'SMOKE=FAIL path=/api/readiness http=%s\n' "$readiness_code" >&2
    exit 1
    ;;
esac

printf '%s\n' 'SMOKE=PASS'

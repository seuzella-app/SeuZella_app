#!/usr/bin/env bash
# Seu Zélla — Phase 3 Redis/Upstash configuration preflight
# No secrets are printed. Missing credentials are BLOCKED_EXTERNAL_INFRA, not a fake PASS.
set -Eeuo pipefail

has_rest_url=0
has_rest_token=0
has_native_url=0
[[ -n "${UPSTASH_REDIS_REST_URL:-}" ]] && has_rest_url=1
[[ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]] && has_rest_token=1
[[ -n "${REDIS_URL:-${REDIS_CONNECTION_STRING:-}}" ]] && has_native_url=1

printf '%s\n' 'Seu Zélla — Phase 3 Redis configuration preflight'
printf 'UPSTASH_REDIS_REST pair: %s\n' "$([[ $has_rest_url -eq 1 && $has_rest_token -eq 1 ]] && echo configured || echo missing)"
printf 'Native Redis URL for BullMQ/SSE: %s\n' "$([[ $has_native_url -eq 1 ]] && echo configured || echo missing)"

if [[ $has_rest_url -ne $has_rest_token ]]; then
  echo 'STATUS=FAIL_INVALID_PARTIAL_UPSTASH_PAIR'
  exit 2
fi

if [[ "${NODE_ENV:-production}" == 'production' && $has_rest_url -eq 0 ]]; then
  echo 'STATUS=BLOCKED_EXTERNAL_INFRA'
  echo 'Action: provision Upstash and add REST URL/token only in the deploy environment.'
  exit 0
fi

if [[ "${NODE_ENV:-production}" == 'production' && $has_native_url -eq 0 ]]; then
  echo 'STATUS=BLOCKED_EXTERNAL_INFRA'
  echo 'Action: add a native Redis connection URL before enabling BullMQ/multi-instance SSE.'
  exit 0
fi

echo 'STATUS=READY_FOR_PROVIDER_CONNECTIVITY_TEST'

#!/usr/bin/env bash
set -Eeuo pipefail

# Release preflight is deliberately non-mutating. It establishes the required
# deployment order and refuses to continue when mandatory tooling is absent.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

fail() { printf 'RELEASE_PREFLIGHT=FAIL: %s\n' "$1" >&2; exit 1; }

command -v npm >/dev/null 2>&1 || fail 'npm not found'
command -v git >/dev/null 2>&1 || fail 'git not found'
command -v node >/dev/null 2>&1 || fail 'node not found'

[[ -f package.json ]] || fail 'package.json missing'
[[ -f prisma/schema.prisma ]] || fail 'prisma/schema.prisma missing'

# Refuse both tracked modifications and untracked files: the release candidate
# must be reproducible from the committed tree only.
git diff --quiet || fail 'working tree has unstaged changes'
git diff --cached --quiet || fail 'index has staged changes'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'working tree has untracked files'

NODE_MAJOR="$(node -p 'parseInt(process.versions.node.split(".")[0],10)')"
(( NODE_MAJOR >= 20 )) || fail "Node >=20 required (found ${NODE_MAJOR})"

printf '%s\n' 'RELEASE_PREFLIGHT=PASS'
printf '%s\n' 'ORDER=backup -> migrate deploy -> build -> health -> smoke'
printf '%s\n' 'MIGRATION_COMMAND=npx prisma migrate deploy'
printf '%s\n' 'BUILD_COMMAND=npm run build'
printf '%s\n' 'NOTE=This script does not execute migrations, build, deployment, or rollback.'

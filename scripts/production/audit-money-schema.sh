#!/usr/bin/env bash
set -Eeuo pipefail

# ZÉLLA R2 — non-mutating monetary schema audit.
# Finds Float fields in Prisma models whose names suggest monetary semantics.
# This is an inventory gate, not a migration. It intentionally does not edit
# schema/data so the Decimal migration can be designed from observed facts.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA="${ROOT_DIR}/prisma/schema.prisma"

if [[ ! -f "$SCHEMA" ]]; then
  echo "ERROR: prisma/schema.prisma not found" >&2
  exit 1
fi

awk '
  /^model / { model=$2 }
  /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]+Float(\?|[[:space:]])/ {
    field=$1
    if (field ~ /(price|amount|value|cost|commission|comission|revenue|profit|rate|balance|total|subtotal|discount|fee|credit|debit|charge|prorate)/I) {
      printf "%s.%s\n", model, field
    }
  }
' "$SCHEMA" | sort -u

echo "MONEY_SCHEMA_AUDIT=CODE_READY"
echo "MUTATION=NONE"
echo "NEXT_STEP=Classify each finding as MONEY_DECIMAL, RATE_DECIMAL, or NON_MONETARY before migration."

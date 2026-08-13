#!/bin/bash
# ============================================================================
# ZÉLLA — Semantica Sidecar Startup Script (Dev)
# ============================================================================
# Inicia o sidecar Python + Postgres via Docker Compose.
# 
# Uso:
#   ./deploy/semantica-sidecar/start.sh         # Inicia
#   ./deploy/semantica-sidecar/start.sh --down  # Para tudo
#   ./deploy/semantica-sidecar/start.sh --logs  # Ver logs
# ============================================================================

set -e

cd "$(dirname "$0")/../.."

COMPOSE_FILE="docker-compose.semantica.yml"

case "${1:-up}" in
  up|--up)
    echo "🚀 Iniciando Semantica sidecar (modo dev)..."
    docker compose -f $COMPOSE_FILE up -d --build
    echo ""
    echo "✅ Sidecar ativo:"
    echo "   API:     http://127.0.0.1:7432"
    echo "   Docs:    http://127.0.0.1:7432/docs"
    echo "   Health:  http://127.0.0.1:7432/health"
    echo "   Metrics: http://127.0.0.1:7432/metrics"
    echo ""
    echo "   Postgres: 127.0.0.1:5433 (seuzella/seuzella_dev_2026/seuzella_semantica)"
    echo ""
    echo "📋 Para Next.js usar o sidecar, adicione ao .env.local:"
    echo "   USE_SEMANTICA_GRAPH=true"
    echo "   SEMANTICA_BASE_URL=http://127.0.0.1:7432"
    echo "   SEMANTICA_API_KEY=dev-key-zella-2026-not-for-production"
    ;;
  down|--down)
    echo "🛑 Parando Semantica sidecar..."
    docker compose -f $COMPOSE_FILE down
    ;;
  logs|--logs)
    docker compose -f $COMPOSE_FILE logs -f
    ;;
  status|--status)
    docker compose -f $COMPOSE_FILE ps
    echo ""
    echo "Health check:"
    curl -s http://127.0.0.1:7432/health | python3 -m json.tool 2>/dev/null || echo "  (sidecar offline)"
    ;;
  *)
    echo "Uso: $0 {up|down|logs|status}"
    exit 1
    ;;
esac

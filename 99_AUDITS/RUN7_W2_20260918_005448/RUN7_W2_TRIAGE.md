# RUN7-W2 — TRIAGEM 7D/7H (matriz final de autoridade)

Data: 2026-09-18 03:54:48
Entrada W1: 99_AUDITS/RUN7_W1_20260918_000121/RUN7_TENANT_MATRIX.json (320 rotas)
Mapa: RUN6 (322 endpoints) + RUN6B unknown_resolutions (46) + fixes R6B-01..05

## Disposition FINAL por rota (contagens)
- CROSS_CHECK: 21
- NEEDS_W3_REVIEW: 1
- PUBLIC_BY_DESIGN: 1
- SAFE_CRON: 34
- SAFE_DEMO: 21
- SAFE_INTERNAL: 11
- SAFE_PUBLIC: 5
- SAFE_SESSION: 110
- SAFE_SYSTEM_ADMIN: 91
- SAFE_WEBHOOK: 6
- UNSAFE_CLIENT_AUTHORITY: 1
- UNSAFE→FIXED: 18

## Perímetro (pós-patch 7A/RES-01)
- JWT validado no perímetro (RUN7-W2, RES-01 fechado): cookie-presente != autorizado; 401 fail-closed; machine auth via Bearer preservada

## 7H — Matriz Final
- UNKNOWN aberto: 0 (contrato: 0 ou justificado)
- NEEDS_W3_REVIEW: 1 (código-fonte de cada rota em route_sources/ — revisão assistida, sem risco de decisão cega)

## Rotas NEEDS_W3_REVIEW
- /api/proxy/[...path] (src/app/api/proxy/[...path]/route.ts | methods: GET, POST)

## Legenda
- SAFE_SESSION/SAFE_SYSTEM_ADMIN/SAFE_CRON/SAFE_INTERNAL/SAFE_WEBHOOK: autenticados por sessão/gate de plataforma/machine/internal-token/HMAC
- SAFE_DEMO: sem DB e sem dado de tenant (compute/telemetria local)
- SAFE_PUBLIC: público por design, sem dado sensível
- CROSS_CHECK: seguro com verificação cruzada adicional (ver evidence)
- UNSAFE→FIXED: corrigido pelo RUN6/RUN6B com teste adversarial
- MACHINE_GATED: Bearer de máquina no perímetro (cron/M2M)
- NEEDS_W3_REVIEW: fora do mapa e da lista pública — fonte em route_sources/ para decisão do agente

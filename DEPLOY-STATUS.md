# Zélla Mobile — Status do Projeto

> Última atualização: commit trigger para forçar redeploy Vercel
> (commits anteriores 82371c8 e c7b44ea foram reescritos com email correto
> e o Vercel estava mostrando "Redeploy" em commits que não existem mais)

## ✅ Status Atual

### Commits no main (todos com autor `marciocau14@gmail.com`):
- `a12c724` fix(cron-auth): make M2M env check lazy (no module-load throw)
- `eac5046` fix(tests): resolve TS1501 regex /s flag + TS2540 NODE_ENV readonly
- `11c3951` test(ci): add comprehensive GitHub Actions workflows + 8 new test files
- `42f8de9` feat(notifications+mobile): wire 12 bridges + implement all 12 gaps

### GitHub Actions
Todos os 10 workflows CI/CD passaram verde para o commit `a12c724`.

### URLs Vercel (após deploy deste commit)
- https://smart-hotel-zehla.vercel.app/mobile/pousada
- https://smart-hotel-zehla.vercel.app/mobile/airbnb
- https://smart-hotel-zehla.vercel.app/sw.js (deve conter `seuzella-pwa-v2`)
- https://smart-hotel-zehla.vercel.app/sounds/alert.mp3 (Gap 6)

## 📋 Resumo das 12 Gaps Implementadas

1. ✅ **Bridges Wiring** — 12 de 13 bridges wired (1 já existia)
2. ✅ **Achievement Engine** — 5 triggers (first_booking, milestone_10/100, revenue_record, partner_level_up)
3. ✅ **4 Novos Crons** — ota-token-expiry, plan-expiry, booking-daily, payment-overdue
4. ✅ **Booking.com Reviews Webhook** — HMAC SHA-256 verification
5. ✅ **Security Brute-Force Detector** — notifyRateLimitBlocked helper em rate-limit.ts
6. ✅ **4 Sons por Prioridade** — alert/notification/success/info MP3
7. ✅ **Filtros Avançados** no NotificationCenter (priority, status, search)
8. ✅ **Action Buttons Funcionais** — router.push + mark-as-read
9. ✅ **Tab Conquistas PARCEIRO_ZÉLLA** — visível apenas para plano parceiro
10. ✅ **LITE Plan Limits** — checker com thresholds 80%/100%
11. ✅ **PWA v2** — service worker bumped to v2 com sync + push handlers
12. ✅ **4 Test Files** — 373/373 testes passando

## 🔧 Stack

- Next.js 16.2.10 (Turbopack)
- TypeScript 5.x
- Prisma 6.19.3 + PostgreSQL (or SQLite in dev)
- Vitest 3.2.7
- React 19 + Tailwind CSS 4
- Radix UI + Lucide icons

## 🚀 CI/CD

10 workflows GitHub Actions:
- `master-ci-notifications-mobile.yml` (7 jobs)
- `master-ci-crons-webhooks.yml` (5 jobs)
- `master-ci-build-regression.yml` (5 jobs) — GATEKEEPER
- 7 workflows V11-P0 e ZCC já existentes

## 📝 Como rodar localmente

```bash
npm install --legacy-peer-deps
npx prisma generate
npm run dev  # http://localhost:3000/mobile/pousada
npm run test:mobile-suite  # 373 testes
```

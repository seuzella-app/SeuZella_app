# CRON INVENTORY & CLEANUP AUDIT

## Snapshot

`vercel.json` no baseline contém 29 entradas. Uma é órfã: `/api/cron/caution-auto-return`, pois o recurso Caução foi removido deliberadamente do produto. Após sua remoção, permanecem 28 crons válidos.

## Inventário de rotas do snapshot

1. budget-reset
2. metrics-snapshot
3. cerebro-analyze
4. cerebro-budget-forecast
5. cerebro-refactor-check
6. cerebro-cleanup
7. cerebro-night-audit
8. locks-maintenance
9. cerebro-night-pulse
10. cerebro-night-pentest
11. cerebro-learning
12. cerebro-orchestrator
13. cerebro-churn-predict
14. cerebro-distill
15. cerebro-watchdog
16. learning-cycle
17. linkinbio-expiry-check
18. ota-token-expiry
19. plan-expiry
20. booking-daily
21. payment-overdue
22. achievements-check
23. plan-limits-check
24. lembrete-checkin
25. nps-checkout
26. payment-confirmation
27. housekeeping-dispatch
28. ical-sync
29. caution-auto-return — **REMOVER**

## Regra de auditoria

Cada uma das 28 rotas válidas deve:
- existir fisicamente;
- estar registrada somente uma vez;
- usar `verifyCronAuth` com scope coerente;
- rejeitar chamadas sem credencial;
- possuir teste de proteção;
- ter timeout compatível com seu trabalho;
- não depender de query-string secreta como mecanismo primário.

## Resultado Onda 0

`caution-auto-return` é cleanup, não feature. A Onda 1 remove a entrada e reconta o inventário no deployment. `dlq-drain` permanece candidato a inclusão na Onda 3, pois existe como route mas não fazia parte do inventário do `vercel.json` do snapshot.

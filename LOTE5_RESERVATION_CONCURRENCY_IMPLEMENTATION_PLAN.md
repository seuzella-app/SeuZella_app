# LOTE 5 — RESERVATIONS & CONCURRENCY IMPLEMENTATION PLAN

**Data**: 2026-08-31  
**Autor**: Google Antigravity (Executor Técnico Principal)  
**Objetivo**: **ZERO DOUBLE BOOKING** via PostgreSQL Locking, Serializable Isolation & Strict Constraint Enforcement  
**Baseline**: `70fe37e5`

---

## 1. Estado Atual e Arquitetura de Reservas
- **Modelo Prisma**: `Reservation` (`id`, `tenantId`, `guestId`, `roomId`, `checkIn`, `checkOut`, `status`, `totalPrice`, `source`).
- **Endpoint**: `src/app/api/v1/reservations/route.ts`
- **Mecanismo Atual**: `$transaction` com checagem de overlap (`checkIn < targetCheckOut AND checkOut > targetCheckIn`).
- **Vulnerabilidade Sob Alta Concorrência**: Em isolamento padrão (`READ COMMITTED`), requisições simultâneas no mesmo milissegundo podem passar pelo `findFirst` de overlap antes do `create` de qualquer uma ser persistido (Race Condition de Leitura Fantasma).

---

## 2. Solução Arquitetural de 3 Camadas contra Double Booking

### Camada 1: PostgreSQL Advisory Lock Transacional (`pg_advisory_xact_lock`)
- Dentro da transação, adquire lock exclusivo por `(tenantId, roomId)`.
- Bloqueia requisições concorrentes para o mesmo quarto durante o curto ciclo da transação (10-30ms).

### Camada 2: Transação Serializável com Retry (`withSerializableRetry`)
- Caso ocorra colisão de serialização no banco (`P2034`), realiza retry com backoff exponencial (até 3 tentativas).

### Camada 3: Mapeamento de Erros de Concorrência e Exclusion Constraint (`23P01` / `P2002`)
- Mapeamento determinístico de violação de restrição para status `409 Conflict` (`ROOM_UNAVAILABLE`).

---

## 3. Semântica de Intervalos e Regra de Negócio
- Semântica de diária de hotel/pousada: intervalo semiaberto `[checkIn, checkOut)`.
- **Cenário A (Adjacente - PERMITIDO)**:
  - Reserva 1: `2026-10-10` a `2026-10-13` (Check-out dia 13)
  - Reserva 2: `2026-10-13` a `2026-10-16` (Check-in dia 13)
  - **Resultado**: `checkIn_2 >= checkOut_1` ➔ **PERMITIDO**.
- **Cenário B (Sobreposição - BLOQUEADO)**:
  - Reserva 1: `2026-10-10` a `2026-10-13`
  - Reserva 2: `2026-10-12` a `2026-10-15`
  - **Resultado**: `checkIn_2 < checkOut_1 AND checkOut_2 > checkIn_1` ➔ **REJEITADO (409)**.
- **Cenário C (Cancelamento e Reutilização - PERMITIDO)**:
  - Reserva 1 cancelada (`status = 'CANCELLED'`).
  - Nova reserva no mesmo período: **PERMITIDO**.

---

## 4. Arquivos que Serão Criados / Modificados

### [NOVO] `src/lib/db/concurrency.ts`
- Adaptado do GLM para PostgreSQL/Prisma com `withAdvisoryLock`, `withSerializableRetry`, e `mapConcurrencyError`.

### [MODIFICAR] `src/app/api/v1/reservations/route.ts`
- Integração de `withAdvisoryLock` no escopo `reservation:${tenantId}:${roomId}`.
- Refinamento do filtro de sobreposição para ignorar status cancelados/rejeitados.
- Retorno determinístico de `409 Conflict` com payload estruturado.

### [NOVO] `tests/security/lote5-reservation-concurrency.test.ts`
- Suíte adversarial com:
  1. Teste de 2 requisições simultâneas no mesmo quarto/período (1 CONFIRMED, 1 CONFLICT).
  2. Teste de estresse com 10 requisições simultâneas (1 CONFIRMED, 9 CONFLICT).
  3. Teste de 50 requisições simultâneas (1 CONFIRMED, 49 CONFLICT).
  4. Teste de reservas em datas adjacentes (2 CONFIRMED).
  5. Teste de rebooking após cancelamento (1 CANCELLED, 1 CONFIRMED).
  6. Teste de isolamento multi-tenant (Tenant A não pode reservar quarto de Tenant B).

---

## 5. Critérios de Aceitação
- Zero Double Booking comprovado por testes concorrentes (`Promise.all`).
- Nenhum efeito colateral órfão.
- `tsc --noEmit` = 0 erros.
- Build de produção = Pass.
- 100% de cobertura nos testes do Lote 5 sem regressão no Lote 4.

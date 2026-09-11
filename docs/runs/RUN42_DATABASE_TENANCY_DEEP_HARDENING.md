# RUN42 — DATABASE & TENANCY DEEP HARDENING

Projeto: Seu Zélla / SmartHotel_Zehla  
PR: #91  
Branch: `integration/final-pre-vps`

## Regra operacional

`ACHOU → CONFIRMOU → CORRIGIU → TESTOU → COMMIT → PUSH → REVALIDOU`

**Limitação desta execução:** o conector GitHub permitiu leitura e escrita no repositório real, mas não forneceu shell/runtime para executar `npm`, PostgreSQL, Redis ou a suíte Vitest. Portanto, nenhum teste de execução é declarado como executado nesta RUN. Testes adicionados ao repositório ficam `RUNTIME-UNPROVEN` até execução real.

## Autoridade / HEAD

- `RUN42_START_HEAD=db42a52650180aa462e0bb3257009c278b8e9363`
- `RUN42_CURRENT_HEAD=35fd82390d4bdb28a44d86a3475173686a81ec3e`
- `MAIN_SHA=NÃO PROVADO nesta execução`
- `MERGE_BASE=NÃO PROVADO nesta execução`

O HEAD foi confirmado diretamente no endpoint da branch antes das correções: `db42a52650180aa462e0bb3257009c278b8e9363`.

## Correções efetivamente realizadas

### COR-01 — DDL de password reset removido dos handlers HTTP

**Finding:** `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/magic-link/route.ts` e `src/app/api/auth/reset-password/route.ts` executavam `CREATE TABLE IF NOT EXISTS`/índices por `$executeRawUnsafe` durante requisições.

**Confirmação:** a migration `20260823130000_password_reset_tokens/migration.sql` já cria a tabela, FK e índices de forma versionada.

**Correção:** removido o `ensureResetTable()` e suas chamadas dos três handlers. Os handlers agora pressupõem o schema gerenciado por migration.

**Commits:**
- `10d7cd062dc877b4b24bae25e71e492bff44a305`
- `0db5e2848b84ac0554ccb37c857b4b2a4b389af8`
- `e77d0c507785352b12487d31bc168847e11d5644`

**Revalidação GitHub:** os arquivos foram reescritos e o HEAD final foi confirmado em `35fd82390d4bdb28a44d86a3475173686a81ec3e`.

### COR-02 — contrato automatizado de tenancy/database

Criado `tests/security/run42-database-tenancy-contract.test.ts` cobrindo:
- `set_config(..., true)` transaction-local;
- fail-closed `TENANT_CONTEXT_REQUIRED`;
- ausência de `$executeRawUnsafe` nos três handlers de reset;
- ownership do schema de password reset pela migration;
- tenant scope em criação de reservation/room/guest;
- autorização genérica fail-closed;
- proteção contra regressão do default `Tenant.plan = gratuito`.

**Commit:** `a92f893ae5bcf595cf1e63c478ae8791c2c3f882`, posteriormente refinado por `35fd82390d4bdb28a44d86a3475173686a81ec3e`.

**Execução:** `RUNTIME-UNPROVEN` — teste foi criado e revalidado no GitHub, mas não executado neste ambiente.

---

# F01..F30

## F01 — Inventário de acessos Prisma por tenant
**Status:** RUNTIME-UNPROVEN / auditoria parcial.  
Evidência: rotas auditadas usam `requireTenant()` e filtros por `tenantId`; não há prova nesta execução de cobertura exaustiva de todos os callers do repositório.

## F02 — `findMany` tenant-scoped
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Evidência: `/api/v1/reservations` deriva `tenantId` via `requireTenant()` e consulta `reservation.findMany({ where: { tenantId } })`.

## F03 — `findFirst`/`findUnique` de recursos
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Evidência: reservation route usa `room.findFirst({ where: { id: roomId, tenantId } })` e `guest.findFirst({ where: { id: guestId, tenantId } })`; auth usa lookup global por identidade de login, que é contexto legítimo.

## F04 — `update` / `updateMany`
**Status:** RUNTIME-UNPROVEN.  
Não foi provada cobertura integral de todos os update callers nesta rodada.

## F05 — `delete` / `deleteMany`
**Status:** RUNTIME-UNPROVEN.  
Não foi provada cobertura integral de todos os delete callers nesta rodada.

## F06 — `create` / `createMany`
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Evidência: reservation creation injeta `tenantId` derivado do contexto autenticado. Cobertura integral permanece runtime-unproven.

## F07 — `upsert`
**Status:** RUNTIME-UNPROVEN.  
Não foi provada nesta execução a ausência de upserts tenant-unsafe em todo o repositório.

## F08 — contexto de sessão → tenant
**Status:** RESOLVED.  
Evidência: `src/lib/auth.ts` grava `token.tenantId` a partir do usuário autenticado e revalida o tenant; rotas críticas usam `requireTenant()`.

## F09 — tenantId controlado pelo cliente
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Evidência direta: LGPD consent aceita `body.tenantId` apenas para compatibilidade e rejeita divergência; o valor persistido é o `tenantId` da sessão. Outras superfícies ainda exigem inventário completo.

## F10 — Server Actions
**Status:** RUNTIME-UNPROVEN.  
Necessária execução/varredura completa dos Server Actions para fechamento formal.

## F11 — Route Handlers
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Evidência direta nas rotas auditadas: tenant derivado do contexto e recursos filtrados por tenant.

## F12 — services/repositories
**Status:** RUNTIME-UNPROVEN.  
Helpers de autorização existem, mas cobertura integral dos services não foi executada nesta rodada.

## F13 — abstração `repository.find(id)` sem ownership
**Status:** RUNTIME-UNPROVEN.  
Não houve prova de inventário completo suficiente para declarar ausência global.

## F14 — `withTenantContext`
**Status:** RESOLVED.  
`withTenantContext()` usa `$transaction` e `set_config(..., true)`, portanto o tenant context é transaction-local.

## F15 — `withTenantContextOrThrow`
**Status:** RESOLVED.  
Falha sem tenant explícito com `TENANT_CONTEXT_REQUIRED`; não há fallback silencioso.

## F16 — GUC `app.current_tenant_id`
**Status:** RESOLVED / RUNTIME-UNPROVEN.  
Migration de foundation cria `app.current_tenant_id()`/`app.require_tenant_context()`; helper de aplicação usa `set_config` transaction-local.

## F17 — `SET SESSION` / contexto não transaction-local
**Status:** RESOLVED no helper auditado.  
O helper não usa `SET SESSION` nem `set_config(..., false)`.

## F18 — `$queryRaw`
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
O caminho de reservation payment usa tagged template parametrizado e inclui `tenant_id` + `reservation_id` no filtro.

## F19 — `$queryRawUnsafe`
**Status:** RESOLVED nos handlers de password reset auditados.  
Os três handlers deixaram de executar DDL via `$executeRawUnsafe`; o schema pertence à migration versionada.

## F20 — `$executeRaw` / SQL parametrizado
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
Os writes SQL auditados no fluxo de reservation payment e password reset usam tagged templates parametrizados. Cobertura global não provada.

## F21 — Room ↔ Property ↔ Tenant
**Status:** REAL-P1/P2 — NÃO RESOLVIDO.  
`Room` possui `propertyId` obrigatório, mas `tenantId` opcional. A FK `rooms_propertyId_fkey` aponta somente para `properties.id`, enquanto `rooms_tenantId_fkey` aponta independentemente para `tenants.id`. A estrutura não garante que `Room.tenantId` corresponda ao tenant da `Property`.

**Não corrigido nesta RUN:** uma correção correta exige migration aditiva + atualização do Prisma schema + validação de dados existentes. Não foi aplicado patch especulativo sem runtime/data census.

## F22 — Reservation ↔ Room ↔ Tenant
**Status:** REAL-P2 / NÃO RESOLVIDO estruturalmente.  
`reservations` possui `tenantId` e `roomId`, mas a FK para Room é somente `roomId → rooms.id`; não existe nesta baseline uma FK composta garantindo `(tenantId, roomId)` coerente.

## F23 — Guest ↔ Reservation ↔ Tenant
**Status:** REAL-P2 / NÃO RESOLVIDO estruturalmente.  
`reservations.guestId` aponta para `guests.id`, enquanto `tenantId` é independente; não há FK composta demonstrada na baseline para provar a mesma raiz tenant.

## F24 — Booking ↔ Room ↔ Tenant
**Status:** REAL-P2 / NÃO RESOLVIDO estruturalmente.  
`bookings.roomId` aponta para Room sem constraint composta tenant+room demonstrada.

## F25 — CalendarSync ↔ Room/Tenant
**Status:** REAL-P2 / NÃO RESOLVIDO estruturalmente.  
Há FKs independentes para `roomId` e `tenantId`; coerência entre ambos não é garantida pela FK simples.

## F26 — UNIQUE global vs tenant-scoped
**Status:** MITIGATED / DECISÃO NECESSÁRIA POR ENTIDADE.  
Exemplos globais existentes incluem identidade de login (`Tenant.email`) e slug público de Property. `Lead.email` também é globalmente unique; isso pode ser intencional para o pipeline central de leads e não foi alterado sem prova de requisito contrário.

## F27 — Double booking / EXCLUDE
**Status:** RUNTIME-UNPROVEN.  
A proteção PostgreSQL por EXCLUDE já foi implementada historicamente e o código também usa advisory lock. A presença/validade em runtime PG16 não foi executada nesta RUN.

## F28 — CASCADE / integridade referencial
**Status:** RUNTIME-UNPROVEN.  
As FKs principais usam cascades/restrict/set-null explícitos, mas não houve teste real de deleção nesta execução.

## F29 — órfãos / migration × schema
**Status:** RUNTIME-UNPROVEN.  
O baseline cria `rooms` com `tenantId` nullable e FKs independentes; migrations posteriores foram conferidas pontualmente. Não foi executado `prisma migrate deploy`/diff nesta sessão.

## F30 — seed/demo/production + regressões de schema
**Status:** MITIGATED / RUNTIME-UNPROVEN.  
`prisma/seed.ts` possui guard explícito contra `NODE_ENV=production`. `Tenant.plan` está alinhado a `gratuito`. O teste RUN42 protege esses contratos. O script `scripts/full-simulation.ts` foi identificado como stale em relação ao modelo atual de Room (usa `basePrice`/`active` e não `propertyId`), mas não foi alterado nesta RUN para não misturar escopo sem reconstrução completa do arquivo.

---

# Resumo de evidências

## TENANCY
- Sessão → tenant: **MITIGADO/RESOLVIDO nas superfícies auditadas**.
- Client-controlled tenant: **algumas superfícies corrigidas; cobertura integral NÃO PROVADA**.
- Resource authorization: **fail-closed**.

## RAW_SQL
- `$executeRawUnsafe` de DDL de password reset em handlers: **CORRIGIDO**.
- Tagged templates SQL em fluxos auditados: **OK**.
- Inventário global exaustivo: **NÃO PROVADO**.

## GUC
- transaction-local: **RESOLVIDO**.
- `SET SESSION`: **não encontrado no helper auditado**.

## RLS
- Foundation existe.
- A migration de foundation declara explicitamente que não habilita RLS em todas as tabelas.
- RLS amplo/total para todas as tabelas tenant-scoped: **NÃO PROVADO**.

## FORCE_RLS
**NÃO PROVADO nesta RUN.** Não aplicar rollout global sem census/decisão.

## FOREIGN_KEYS
Faltam constraints compostas para garantir coerência tenant entre algumas relações críticas.

## UNIQUE
Há mistura de identificadores globais e tenant-scoped; cada caso precisa de intenção funcional antes de alteração.

## EXCLUDE
**RUNTIME-UNPROVEN** nesta execução.

## CASCADE
**RUNTIME-UNPROVEN**.

## ORPHANS
**RUNTIME-UNPROVEN**.

## SCHEMA_MIGRATION
`Tenant.plan` atual permanece `gratuito`; finding histórico não reaberto.

## SEED_PRODUCTION
Guard de produção existente e protegido por teste RUN42.

---

# Contagem atual

```text
P0_CURRENT=NÃO PROVADO nesta RUN
P1_CURRENT=1 estrutural (Room/Property/Tenant) — pode ser reclassificado após census/runtime
P2_CURRENT=4+ estruturais relacionados a F22-F25 e demais cobertura não provada
P3_CURRENT=NÃO CONSOLIDADO

NEW_P0=0 comprovado
NEW_P1=1 (F21)
NEW_P2=4 (F22-F25)
NEW_P3=0 novo comprovado

RESOLVED=F08,F14,F15,F16,F17,F19
MITIGATED=F02,F03,F06,F09,F11,F18,F20,F26,F30
RUNTIME-UNPROVEN=F01,F04,F05,F07,F10,F12,F13,F27,F28,F29 + partes das demais
REAL-P1/P2 NÃO RESOLVIDOS=F21-F25
REGRESSIONS=0 comprovada
```

# Execução

```text
TESTS=ADDED, NOT EXECUTED
TSC=NÃO PROVADO
LINT=NÃO PROVADO
PRISMA=NÃO PROVADO
BUILD=NÃO PROVADO

FILES_CHANGED=
- src/app/api/auth/forgot-password/route.ts
- src/app/api/auth/magic-link/route.ts
- src/app/api/auth/reset-password/route.ts
- tests/security/run42-database-tenancy-contract.test.ts
- docs/runs/RUN42_DATABASE_TENANCY_DEEP_HARDENING.md

COMMITS_CREATED=
10d7cd062dc877b4b24bae25e71e492bff44a305
0db5e2848b84ac0554ccb37c857b4b2a4b389af8
e77d0c507785352b12487d31bc168847e11d5644
a92f893ae5bcf595cf1e63c478ae8791c2c3f882
35fd82390d4bdb28a44d86a3475173686a81ec3e
```

# Blockers

```text
CODE_BLOCKERS=
1. Room.tenantId nullable + FK independente de Property.tenantId.
2. Reservation/Guest/Room e Booking/Room não possuem, na baseline auditada,
   constraints compostas que provem coerência tenant de forma física.
3. Cobertura global de Prisma callers ainda não foi executada com runtime.

INFRA_BLOCKERS=
- execução real de PostgreSQL/Prisma não disponível nesta sessão.

CREDENTIAL_BLOCKERS=
- nenhum gateway é necessário para esta RUN.

GITHUB_BLOCKERS=
- nenhum para leitura/escrita da branch nesta sessão.

OWNER_DECISIONS=
- decidir estratégia de endurecimento estrutural de F21-F25 após census real.
- decidir rollout de RLS/FORCE RLS por ondas, sem habilitação global especulativa.
```

# FINAL_GATE

**NO-GO para declarar Database/Tenancy estruturalmente fechado.**

Motivo: há gaps físicos comprovados nas relações Room/Property/Tenant e nas relações tenant+resource relacionadas. Além disso, runtime PG16/RLS/FK/constraint ainda não foi executado nesta sessão.

# NEXT_ACTION

**RUN42-R2 — Structural Tenant FK Hardening**, exclusivamente após runtime census:

1. medir registros `rooms` com `tenantId IS NULL`;
2. medir `rooms` cujo `tenantId != property.tenantId`;
3. medir reservations/bookings com tenant divergente do Room/Guest;
4. medir calendar syncs divergentes;
5. somente se o census for limpo ou reconciliável, criar migration aditiva com constraints compostas;
6. atualizar `schema.prisma` de forma coerente;
7. executar PG16 + `prisma validate` + migration fresh + migration existing-db;
8. executar canários cross-tenant;
9. revalidar branch/HEAD;
10. só então encerrar F21-F25.

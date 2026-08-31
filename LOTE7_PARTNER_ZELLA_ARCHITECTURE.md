# LOTE 7 — PARCEIRO ZÉLLA ARCHITECTURE SPECIFICATION

**Data**: 2026-08-31  
**Autor**: Google Antigravity (Executor Técnico Principal)  
**Baseline**: `6e6880b6`

---

## 1. Modelo de Domínio e Ciclo de Vida

```text
[Cliente acessa Landing Page]
      │
      ▼
[Verifica vagas ativas do Programa] (GET /api/ddc/partner-program/status)
      │
      ├── Se claimedSlots < 100 ➔ Status: ACTIVE ➔ Permite Contratação (R$ 247/mês, 24m)
      │       │
      │       ▼ [Claim de Vaga Transacional com Lock]
      │       [Cria PartnerClaim com slotNumber sequencial único]
      │       [Ativa Plano 'parceiro' no Tenant: PRO features + Selo PARTNER_ZELLA_ACTIVE]
      │
      ├── Se claimedSlots == 100 ➔ Status: FULL / WAITLIST
      │       │
      │       ▼ [CTA altera para Inscrição na Lista de Espera]
      │       [POST /api/ddc/partner-program/waitlist]
      │
      ├── Se Administrador reabre 2º Lote (maxSlots = 200) ➔ Status: REOPENED
      │       │
      │       ▼ [Permite mais 100 vagas para quem está na lista ou novos]
      │
      └── Se claimedSlots == 200 ➔ Status: CLOSED (Programa definitivamente encerrado)
```

---

## 2. Modelos Prisma

1. **`PartnerProgramConfig`**:
   - `id`: "default"
   - `maxSlotsInitial`: 100
   - `maxSlotsCeiling`: 200
   - `claimedSlots`: Int
   - `status`: `'ACTIVE' | 'FULL' | 'WAITLIST' | 'REOPENED' | 'CLOSED'`
   - `monthlyPrice`: 247.0
   - `contractMonths`: 24
   - `activeBatch`: 1 ou 2

2. **`PartnerClaim`**:
   - `id`: CUID
   - `slotNumber`: 1..200 (Unique)
   - `tenantId`: String (Unique)
   - `pousadaName`, `ownerName`, `email`, `phone`
   - `monthlyPrice`: 247.0
   - `contractMonths`: 24
   - `status`: `'ACTIVE' | 'CANCELLED' | 'DEFAULTED' | 'COMPLETED'`
   - `badgeActive`: Boolean (true enquanto ACTIVE)
   - `contractStart`, `contractEnd` (24 meses)

3. **`PartnerWaitlist`**:
   - `id`: CUID
   - `pousadaName`, `contactName`, `email` (Unique), `phone`, `city`, `state`, `roomCount`
   - `status`: `'PENDING' | 'INVITED' | 'CONVERTED' | 'EXPIRED'`

---

## 3. Endpoints e Contratos de API

1. `GET /api/ddc/partner-program/status`:
   - Retorna `{ status, claimedSlots, totalSlots: 100 (ou 200), availableSlots, monthlyPrice: 247, contractMonths: 24, badgeActive }`.
2. `POST /api/ddc/partner-program/claim`:
   - Claim atômico com `withAdvisoryLock('partner_program_claim')` para garantir zero race conditions na vaga 100.
3. `POST /api/ddc/partner-program/waitlist`:
   - Registro na lista de espera quando o status for `FULL` ou `WAITLIST`.
4. `GET /api/ddc/partner-program/badge`:
   - Consulta pública ou autenticada do selo `PARTNER_ZELLA_ACTIVE` para exibição no Link-in-Bio / Perfil da Pousada.
5. `POST /api/zcc/partner-program/reopen`:
   - Operação administrativa exclusiva para autorizar abertura do 2º lote até o teto de 200 vagas.

---

## 4. Paridade com o PRO
- `TIER_LEVEL.parceiro = 2` (exato nível do PRO).
- `PLAN_CONFIG.parceiro.maxProperties = 4` (exato PRO).
- Todas as permissões de CRM, Treinamento de IA, Sincronização iCal e Fechaduras Inteligentes são idênticas ao PRO.

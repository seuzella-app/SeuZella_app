# LOTE 7 — PRE-IMPLEMENTATION RECONCILIATION REPORT

**Data**: 2026-08-31  
**Autor**: Google Antigravity (Executor Técnico Principal)  
**Baseline**: `6e6880b6`  
**Escopo**: Auditoria e Reconciliação dos Planos Comerciais, Parceiro Zélla, Paridade com o PRO, Contrato de 24 meses, 100 Vagas, Lista de Espera, Selo e Landing Page.

---

## 1. Matriz de Reconciliação de Planos e Paridade PRO × Parceiro Zélla

| Item | LITE | PRO | MAX | PARCEIRO ZÉLLA | Paridade com PRO? | Status / Ação |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Preço Mensal** | R$ 197/mês | R$ 397/mês | R$ 797/mês | **R$ 247/mês** | NÃO (Oferta de lançamento) | Configurado canonicamente em R$ 247 |
| **Contrato Mínimo** | Mensal | Mensal | Mensal | **24 meses** | NÃO (Compromisso 24m) | Registrado no contrato / claims |
| **Limite de Clientes** | Ilimitado | Ilimitado | Ilimitado | **100 vagas** (Fase 1) | NÃO (Escassez real) | Protegido por lock transacional |
| **Limite de Imóveis/Quartos** | 2 imóveis (1-4 qtos) | 4 imóveis (6-12 qtos) | 12 imóveis (13-20 qtos) | **4 imóveis (6-12 qtos)** | **SIM (Exato PRO)** | `maxProperties: 4`, herda PRO |
| **Atendimento WhatsApp IA** | 500 msgs/mês | Ilimitado | Ilimitado | **Ilimitado** | **SIM (Exato PRO)** | Sem limites de mensagens |
| **CRM de Hóspedes** | ❌ (Bloqueado) | ✅ (Kanban + Score) | ✅ (Kanban + Score) | **✅ (Kanban + Score)** | **SIM (Exato PRO)** | `hasAccess(tier, 'pro')` = true |
| **Treinamento de IA** | ❌ (Bloqueado) | ✅ (Prompts/Persona) | ✅ (Prompts/Persona) | **✅ (Prompts/Persona)** | **SIM (Exato PRO)** | `hasAccess(tier, 'pro')` = true |
| **Sincronização iCal** | ❌ (Bloqueado) | ✅ (Booking/Airbnb) | ✅ (Booking/Airbnb) | **✅ (Booking/Airbnb)** | **SIM (Exato PRO)** | `hasAccess(tier, 'pro')` = true |
| **Fechaduras Eletrônicas** | ❌ | ✅ (PINs automáticos) | ✅ (PINs automáticos) | **✅ (PINs automáticos)** | **SIM (Exato PRO)** | `hasAccess(tier, 'pro')` = true |
| **Selo Parceiro Zélla** | ❌ | ❌ | ❌ | **✅ (`PARTNER_ZELLA_ACTIVE`)** | Exclusivo Parceiro | Exibido no Link-in-Bio / Perfil |

---

## 2. Diagnóstico de Divergências Identificadas e Correções

1. **`src/lib/plan-features.ts`**:
   - *Legado*: `TIER_LEVEL.parceiro = 1` (nível do LITE).
   - *Correção Canônica*: Atualizar `TIER_LEVEL.parceiro = 2` (nível do PRO). Desta forma, todas as abas, gates e sub-features do PRO são herdadas automaticamente.
2. **`src/lib/features.ts`**:
   - *Legado*: `PLAN_CONFIG` continha apenas `pro` e `max`.
   - *Correção Canônica*: Adicionar `parceiro` com `maxProperties: 4`, `maxWhatsappNumbers: 1`, e `features: { ...PLAN_CONFIG.pro.features }`.
3. **Persistência de Vagas e Lista de Espera**:
   - *Necessidade*: Criar entidades Prisma `PartnerProgramConfig`, `PartnerClaim` e `PartnerWaitlist` com proteção contra race conditions.
4. **Selo de Parceiro Zélla**:
   - *Necessidade*: Estado `PARTNER_ZELLA_ACTIVE` no backend com verificação e renderização no Link-in-Bio.

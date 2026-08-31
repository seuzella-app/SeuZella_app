# LOTE 7 — IMPLEMENTATION PLAN & FORMAL CONTRACT

**Objetivo**: Implementação, paridade com o plano PRO, proteção transacional de 100 vagas, lista de espera, selo de verificação e landing page do programa **Parceiro Zélla**.

---

## 1. Contrato Técnico & Comercial

1. **Preço & Duração**:
   - R$ 247,00/mês
   - Contrato garantido por 24 meses
2. **Paridade com o PRO**:
   - `maxProperties: 4` (exato PRO)
   - `maxWhatsappNumbers: 1` (exato PRO)
   - CRM de Hóspedes, Treinamento de IA, Sincronização iCal, Fechaduras Eletrônicas (`hasAccess(tier, 'pro') === true`)
3. **Escassez & Concorrência**:
   - 100 primeiras vagas com lock transacional (`withAdvisoryLock('partner_program_claim')`)
   - Vaga 101 bloqueada com HTTP 409 (`PROGRAM_FULL`)
4. **Lista de Espera & Reabertura**:
   - Registro de interesse quando o programa atingir 100 vagas
   - Abertura de 2º lote até o teto de 200 vagas exclusivamente via ação administrativa ZCC
5. **Selo Parceiro Zélla**:
   - Emissão dinâmica e verificável de `PARTNER_ZELLA_ACTIVE` vinculada ao `PartnerClaim` ativo do tenant.

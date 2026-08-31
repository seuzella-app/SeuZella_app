# LOTE 6 — SPECIAL DATES + UPSELL 7% + HITL DO ZÉLLA IMPLEMENTATION PLAN

**Data**: 2026-08-31  
**Autor**: Google Antigravity (Executor Técnico Principal)  
**Baseline**: `fe3c6dd7`  
**Objetivo**: Implementação do ciclo completo:  
`Data Especial ➔ Oportunidade ➔ Sugestão Zélla (Pending) ➔ Aprovação Proprietário (HITL) ➔ Price Override ➔ Reserva ➔ Upsell 7% ➔ Ledger ➔ Billing`

---

## 1. Regra Inegociável de Negócio (HITL)
- O Zélla **NUNCA** altera preços automaticamente.
- O Zélla atua como o zelador digital: detecta a data especial, analisa a oportunidade de mercado, calcula a sugestão com justificativa e emite a sugestão com status `pending`.
- Apenas a aprovação explícita do proprietário (`owner` / `admin`) autoriza a criação do `PriceOverride`.
- Caso rejeitado, o preço base permanece inalterado e o histórico de auditoria é preservado.

---

## 2. Conceito Canônico de Upsell (7%)
- **O que NÃO é**: Café da manhã, late checkout, passeio, minibar ou serviço adicional.
- **O que É**: A taxa de 7% de comissão sobre o valor bruto da reserva realizada com tarifa especial recomendada pelo Zélla e aprovada pelo anfitrião em datas comemorativas / sazonais.
- Função canônica: `src/lib/billing/upsell-calculator.ts`.

---

## 3. Modelo de Dados Prisma & Persistência

### 3.1 Modelos Adicionados em `prisma/schema.prisma`
1. `SpecialDate`: Entidade de calendário de feriados nacionais, estaduais e sazonais por tenant.
2. `SpecialDateSuggestion`: Sugestão gerada pelo Zélla com status (`pending`, `approved`, `rejected`, `expired`).
3. `PriceOverride`: Tarifa especial efetivamente aprovada pelo proprietário para um quarto/propriedade em uma data específica.

---

## 4. Camada de Serviços e Rotas

1. `src/lib/billing/upsell-calculator.ts`
   - `calculateUpsell`: Cálculo puro, determinístico e com arredondamento seguro em centavos.
   - `calculateMonthlyBilling`: Consolidação para a fatura mensal.
2. `src/lib/ai/special-dates/hitl-service.ts`
   - `detectSpecialDateOpportunity`: Cria sugestão `pending` sem modificar preços.
   - `approveSuggestion`: Valida tenant, marca `approved` e persiste `PriceOverride`.
   - `rejectSuggestion`: Marca `rejected` e mantém preço inalterado.
   - `getActivePriceForDate`: Consulta se há `PriceOverride` ativo para a data da reserva.
3. Rotas de API com Proteção Anti-IDOR & Zero Trust:
   - `POST /api/ddc/special-dates/suggestions/[id]/approve`
   - `POST /api/ddc/special-dates/suggestions/[id]/reject`
   - `GET /api/ddc/special-dates`
   - `GET /api/ddc/special-dates/overrides`

---

## 5. Matriz de Testes do Lote 6 (`tests/security/lote6-special-dates-upsell-hitl.test.ts`)
1. **Fluxo Feliz Completo**:
   - Pousada Mar Azul / Quarto 101 / Tarifa Base R$ 300.
   - Réveillon sugerido a R$ 600 (`pending`).
   - Verificação: Preço ativo continua R$ 300 (sem override antes da aprovação).
   - Aprovação pelo proprietário ➔ Cria `PriceOverride` de R$ 600.
   - Nova reserva de 3 diárias a R$ 600 (Total R$ 1.800).
   - Cálculo de Upsell: 7% de R$ 1.800 = R$ 126 para o Zélla / R$ 1.674 para o proprietário.
   - Ledger mensal consolida fatura base + R$ 126.
2. **Rejeição pelo Proprietário**:
   - Sugestão rejeitada ➔ Status `rejected` ➔ Preço ativo permanece R$ 300.
3. **Proteção Anti-IDOR e Permissões**:
   - Tenant A não pode aprovar ou rejeitar sugestão de Tenant B (404/403).
   - Tenant A não pode listar overrides de Tenant B.
4. **Idempotência**:
   - Dupla chamada de aprovação não gera override duplicado nem comissão duplicada.
5. **Auditoria e Rastreabilidade**:
   - Registro de `decidedBy`, `decidedAt`, `reason` e `approvedAt`.

---

## 6. Critérios de Aceitação
- 100% dos testes do Lote 6 passando.
- Zero regressão nas suítes dos Lotes 4 e 5.
- `tsc --noEmit` = 0 erros.
- `npm run build` = Exit 0.
- Patch exportado com SHA-256 e relatórios formatados.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory stores for Special Dates, Suggestions, Overrides, UpsellRecords
let specialDatesStore: any[] = [];
let suggestionsStore: any[] = [];
let priceOverridesStore: any[] = [];
let upsellRecordsStore: any[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    specialDate: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          specialDatesStore.find(
            (s) =>
              s.tenantId === where.tenantId &&
              (!where.type || s.type === where.type) &&
              (!where.date || new Date(s.date).getTime() === new Date(where.date).getTime())
          ) || null
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: `sd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        specialDatesStore.push(item);
        return item;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return specialDatesStore
          .filter((s) => s.tenantId === where.tenantId)
          .map((s) => ({
            ...s,
            suggestions: suggestionsStore.filter((sug) => sug.specialDateId === s.id),
          }));
      }),
    },
    specialDateSuggestion: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const sug = suggestionsStore.find(
          (s) =>
            (!where.id || s.id === where.id) &&
            (!where.tenantId || s.tenantId === where.tenantId) &&
            (!where.specialDateId || s.specialDateId === where.specialDateId) &&
            (!where.status || s.status === where.status)
        );
        if (!sug) return null;
        if (include?.specialDate) {
          const sd = specialDatesStore.find((d) => d.id === sug.specialDateId);
          return { ...sug, specialDate: sd };
        }
        return sug;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = {
          id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date(),
          ...data,
        };
        suggestionsStore.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = suggestionsStore.findIndex((s) => s.id === where.id);
        if (idx >= 0) {
          suggestionsStore[idx] = { ...suggestionsStore[idx], ...data, updatedAt: new Date() };
          return suggestionsStore[idx];
        }
        return null;
      }),
    },
    priceOverride: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          priceOverridesStore.find((p) => {
            if (p.tenantId !== where.tenantId) return false;
            if (where.status && p.status !== where.status) return false;
            if (where.date && new Date(p.date).getTime() !== new Date(where.date).getTime()) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return priceOverridesStore.filter((p) => p.tenantId === where.tenantId && (!where.status || p.status === where.status));
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const targetDate = where.tenantId_roomId_date.date;
        const tenantId = where.tenantId_roomId_date.tenantId;
        const roomId = where.tenantId_roomId_date.roomId;

        const idx = priceOverridesStore.findIndex(
          (p) =>
            p.tenantId === tenantId &&
            p.roomId === roomId &&
            new Date(p.date).getTime() === new Date(targetDate).getTime()
        );

        if (idx >= 0) {
          priceOverridesStore[idx] = { ...priceOverridesStore[idx], ...update };
          return priceOverridesStore[idx];
        } else {
          const item = {
            id: `pov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...create,
          };
          priceOverridesStore.push(item);
          return item;
        }
      }),
    },
    upsellRecord: {
      create: vi.fn(async ({ data }: any) => {
        const item = { id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        upsellRecordsStore.push(item);
        return item;
      }),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('tenant_pousada_mar_azul'),
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: any) => handler,
}));

import { SpecialDatesHitlService } from '@/lib/ai/special-dates/hitl-service';
import { calculateUpsell, calculateMonthlyBilling } from '@/lib/billing/upsell-calculator';
import { POST as approveSuggestionRoute } from '@/app/api/ddc/special-dates/suggestions/[id]/approve/route';
import { POST as rejectSuggestionRoute } from '@/app/api/ddc/special-dates/suggestions/[id]/reject/route';
import { requireTenant } from '@/lib/auth';

describe('🎯 LOTE 6: Special Dates, Canonical 7% Upsell & HITL Owner Approval Suite', () => {
  beforeEach(() => {
    specialDatesStore = [];
    suggestionsStore = [];
    priceOverridesStore = [];
    upsellRecordsStore = [];
    vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_mar_azul');
  });

  it('1. End-to-End Canonical Flow: Pousada Mar Azul, Réveillon R$ 600, Approval, 7% Upsell & Ledger', async () => {
    const tenantId = 'tenant_pousada_mar_azul';
    const roomId = 'room_101';
    const baseDailyRate = 300;
    const reveillonDate = new Date('2026-12-31T00:00:00Z');

    // Step A: Zélla detects Réveillon opportunity and emits PENDING suggestion
    const detection = await SpecialDatesHitlService.detectOpportunity({
      tenantId,
      roomId,
      date: reveillonDate,
      name: 'Réveillon 2027',
      type: 'national',
      basePrice: baseDailyRate,
      suggestedPrice: 600,
      reason: 'Feriado de alta procura no litoral; ocupação histórica de 100%.',
      impactEstimate: '+100% de receita na diária',
    });

    expect(detection.status).toBe('pending_approval');
    expect(detection.suggestion.status).toBe('pending');
    expect(detection.suggestion.suggestedPrice).toBe(600);

    // Step B: Before approval, active price remains base rate (R$ 300) - HITL Gate Verified!
    const activeBeforeApproval = await SpecialDatesHitlService.getActivePriceForDate(
      tenantId,
      roomId,
      reveillonDate,
      baseDailyRate
    );
    expect(activeBeforeApproval.price).toBe(300);
    expect(activeBeforeApproval.isSpecialDate).toBe(false);
    expect(priceOverridesStore.length).toBe(0);

    // Step C: Owner explicitly approves the suggested tariff via HITL endpoint
    const approveReq = new NextRequest(
      `http://localhost:3000/api/ddc/special-dates/suggestions/${detection.suggestion.id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ approvedBy: 'proprietario_mar_azul', note: 'Aprovado para o Réveillon' }),
      }
    );

    const approveRes = await approveSuggestionRoute(approveReq, {
      params: Promise.resolve({ id: detection.suggestion.id }),
    });
    expect(approveRes.status).toBe(200);

    // Step D: Active price for Réveillon is now R$ 600 (PriceOverride materialized)
    const activeAfterApproval = await SpecialDatesHitlService.getActivePriceForDate(
      tenantId,
      roomId,
      reveillonDate,
      baseDailyRate
    );
    expect(activeAfterApproval.price).toBe(600);
    expect(activeAfterApproval.isSpecialDate).toBe(true);
    expect(activeAfterApproval.source).toBe('price_override');

    // Step E: 3-night reservation booked over Réveillon at approved rate
    const nights = 3;
    const specialRate = activeAfterApproval.price; // R$ 600

    const upsellCalc = calculateUpsell({
      baseRate: baseDailyRate, // R$ 300
      specialRate, // R$ 600
      nights, // 3 noites
      attributedToZehla: true,
      isSpecialDate: true,
    });

    // Verification of Canonical 7% Upsell Rule:
    // Total Reservation: 3 * R$ 600 = R$ 1.800
    // Base Reservation: 3 * R$ 300 = R$ 900
    // Incremental: R$ 900
    // Upsell Commission (7% of R$ 1.800): R$ 126.00
    // Owner Net Amount: R$ 1.800 - R$ 126 = R$ 1.674.00
    expect(upsellCalc.reservationValue).toBe(1800);
    expect(upsellCalc.baseValue).toBe(900);
    expect(upsellCalc.commissionRate).toBe(0.07);
    expect(upsellCalc.upsellAmount).toBe(126);
    expect(upsellCalc.ownerAmount).toBe(1674);
    expect(upsellCalc.upsellDue).toBe(true);

    // Step F: Monthly Billing Ledger Consolidation
    const monthlyBilling = calculateMonthlyBilling({
      baseSubscription: 247, // Parceiro Zélla PRO
      upsellRecords: [{ commissionAmount: upsellCalc.upsellAmount, status: 'confirmed' }],
    });

    expect(monthlyBilling.baseSubscription).toBe(247);
    expect(monthlyBilling.upsellTotal).toBe(126);
    expect(monthlyBilling.totalInvoice).toBe(373); // R$ 247 + R$ 126
    expect(monthlyBilling.upsellCount).toBe(1);
  });

  it('2. Owner Rejection: suggestion marked rejected, price remains base rate (R$ 300), zero overrides', async () => {
    const tenantId = 'tenant_pousada_mar_azul';
    const roomId = 'room_101';
    const baseDailyRate = 300;
    const tiradentesDate = new Date('2026-04-21T00:00:00Z');

    const detection = await SpecialDatesHitlService.detectOpportunity({
      tenantId,
      roomId,
      date: tiradentesDate,
      name: 'Tiradentes',
      basePrice: baseDailyRate,
      suggestedPrice: 450,
      reason: 'Feriado nacional prolongado',
    });

    const rejectReq = new NextRequest(
      `http://localhost:3000/api/ddc/special-dates/suggestions/${detection.suggestion.id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Quero manter o preço base neste feriado', rejectedBy: 'proprietario' }),
      }
    );

    const rejectRes = await rejectSuggestionRoute(rejectReq, {
      params: Promise.resolve({ id: detection.suggestion.id }),
    });
    expect(rejectRes.status).toBe(200);

    const sugInDb = suggestionsStore.find((s) => s.id === detection.suggestion.id);
    expect(sugInDb.status).toBe('rejected');
    expect(sugInDb.decisionNote).toBe('Quero manter o preço base neste feriado');

    // Price remains R$ 300
    const activePrice = await SpecialDatesHitlService.getActivePriceForDate(
      tenantId,
      roomId,
      tiradentesDate,
      baseDailyRate
    );
    expect(activePrice.price).toBe(300);
    expect(activePrice.isSpecialDate).toBe(false);
    expect(priceOverridesStore.length).toBe(0);
  });

  it('3. Anti-IDOR & Zero Trust: Tenant A cannot approve or reject suggestion belonging to Tenant B', async () => {
    // Suggestion created by Tenant B (Pousada Encanto da Serra)
    const sugTenantB = {
      id: 'sug_encanto_99',
      tenantId: 'tenant_pousada_encanto',
      specialDateId: 'sd_1',
      currentPrice: 250,
      suggestedPrice: 500,
      status: 'pending',
    };
    suggestionsStore.push(sugTenantB);

    // Tenant A (Pousada Mar Azul) attempts to approve Tenant B's suggestion
    vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_mar_azul');

    const reqApprove = new NextRequest(
      `http://localhost:3000/api/ddc/special-dates/suggestions/sug_encanto_99/approve`,
      { method: 'POST' }
    );

    const resApprove = await approveSuggestionRoute(reqApprove, {
      params: Promise.resolve({ id: 'sug_encanto_99' }),
    });
    expect(resApprove.status).toBe(404);
    const jsonApprove = await resApprove.json();
    expect(jsonApprove.code).toBe('RESOURCE_NOT_FOUND');

    // Tenant A attempts to reject Tenant B's suggestion
    const reqReject = new NextRequest(
      `http://localhost:3000/api/ddc/special-dates/suggestions/sug_encanto_99/reject`,
      { method: 'POST' }
    );

    const resReject = await rejectSuggestionRoute(reqReject, {
      params: Promise.resolve({ id: 'sug_encanto_99' }),
    });
    expect(resReject.status).toBe(404);
  });

  it('4. Idempotency: Double approval does not duplicate PriceOverride or create ledger conflicts', async () => {
    const tenantId = 'tenant_pousada_mar_azul';
    const date = new Date('2026-11-15T00:00:00Z');

    const detection = await SpecialDatesHitlService.detectOpportunity({
      tenantId,
      date,
      name: 'Proclamação da República',
      basePrice: 300,
      suggestedPrice: 480,
      reason: 'Feriado de novembro',
    });

    // First Approval
    const req1 = new NextRequest(`http://localhost:3000/api/ddc/special-dates/suggestions/${detection.suggestion.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy: 'proprietario' }),
    });
    const res1 = await approveSuggestionRoute(req1, {
      params: Promise.resolve({ id: detection.suggestion.id }),
    });
    expect(res1.status).toBe(200);

    // Second Approval (Immediate replay / double-click)
    const req2 = new NextRequest(`http://localhost:3000/api/ddc/special-dates/suggestions/${detection.suggestion.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy: 'proprietario' }),
    });
    const res2 = await approveSuggestionRoute(req2, {
      params: Promise.resolve({ id: detection.suggestion.id }),
    });
    expect(res2.status).toBe(200);

    // Verify exactly ONE active price override exists
    const overrides = priceOverridesStore.filter((p) => p.tenantId === tenantId);
    expect(overrides.length).toBe(1);
    expect(overrides[0].price).toBe(480);
  });

  it('5. Upsell Definition Purity: Normal dates without special attribution produce R$ 0 upsell', () => {
    const normalReservation = calculateUpsell({
      baseRate: 300,
      specialRate: 300,
      nights: 4,
      attributedToZehla: false,
      isSpecialDate: false,
    });

    expect(normalReservation.reservationValue).toBe(1200);
    expect(normalReservation.upsellAmount).toBe(0);
    expect(normalReservation.ownerAmount).toBe(1200);
    expect(normalReservation.upsellDue).toBe(false);
  });
});

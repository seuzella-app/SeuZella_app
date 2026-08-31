import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory stores for Partner Program testing
let configStore: any = {
  id: 'default',
  maxSlotsInitial: 100,
  maxSlotsCeiling: 200,
  claimedSlots: 0,
  status: 'ACTIVE',
  monthlyPrice: 247.0,
  contractMonths: 24,
  activeBatch: 1,
};

let claimsStore: any[] = [];
let waitlistStore: any[] = [];
let tenantsStore: any[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    partnerProgramConfig: {
      findFirst: vi.fn(async () => configStore),
      create: vi.fn(async ({ data }: any) => {
        configStore = { ...data };
        return configStore;
      }),
      update: vi.fn(async ({ data }: any) => {
        configStore = { ...configStore, ...data };
        return configStore;
      }),
    },
    partnerClaim: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          claimsStore.find(
            (c) =>
              (!where.tenantId || c.tenantId === where.tenantId) &&
              (!where.status || c.status === where.status) &&
              (where.badgeActive === undefined || c.badgeActive === where.badgeActive)
          ) || null
        );
      }),
      count: vi.fn(async ({ where }: any) => {
        return claimsStore.filter((c) => !where.status || c.status === where.status).length;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: `claim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        claimsStore.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = claimsStore.findIndex((c) => c.tenantId === where.tenantId || c.id === where.id);
        if (idx >= 0) {
          claimsStore[idx] = { ...claimsStore[idx], ...data };
          return claimsStore[idx];
        }
        return null;
      }),
    },
    partnerWaitlist: {
      findFirst: vi.fn(async ({ where }: any) => {
        return waitlistStore.find((w) => w.email === where.email) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: `wait_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        waitlistStore.push(item);
        return item;
      }),
    },
    tenant: {
      findFirst: vi.fn(async ({ where }: any) => {
        return tenantsStore.find((t) => t.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = tenantsStore.findIndex((t) => t.id === where.id);
        if (idx >= 0) {
          tenantsStore[idx] = { ...tenantsStore[idx], ...data };
          return tenantsStore[idx];
        }
        tenantsStore.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      }),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

// Mock transactional advisory lock to execute synchronously with mutual exclusion
vi.mock('@/lib/db/concurrency', () => ({
  withAdvisoryLock: vi.fn(async (_lockKey: string, callback: (tx: any) => Promise<any>) => {
    const { db } = await import('@/lib/db');
    return await callback(db);
  }),
}));

vi.mock('@/lib/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('tenant_pousada_mar_azul'),
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: any) => handler,
}));

import { PartnerProgramService } from '@/lib/partner-program/partner-service';
import { tierLevel, hasAccess, PLAN_DISPLAY, PLAN_HIGHLIGHTS } from '@/lib/plan-features';
import { PLAN_CONFIG, getMaxProperties, hasFeature } from '@/lib/features';
import { POST as claimSlotRoute } from '@/app/api/ddc/partner-program/claim/route';
import { POST as waitlistRoute } from '@/app/api/ddc/partner-program/waitlist/route';
import { GET as badgeRoute } from '@/app/api/ddc/partner-program/badge/route';
import { POST as reopenRoute } from '@/app/api/zcc/partner-program/reopen/route';
import { requireTenant } from '@/lib/auth';

describe('🎯 LOTE 7: Parceiro Zélla Launch Program, PRO Parity, Gated Slots & Badge Suite', () => {
  beforeEach(() => {
    configStore = {
      id: 'default',
      maxSlotsInitial: 100,
      maxSlotsCeiling: 200,
      claimedSlots: 0,
      status: 'ACTIVE',
      monthlyPrice: 247.0,
      contractMonths: 24,
      activeBatch: 1,
    };
    claimsStore = [];
    waitlistStore = [];
    tenantsStore = [{ id: 'tenant_pousada_mar_azul', plan: 'gratuito' }];
    vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_mar_azul');
  });

  describe('1. Full Parity with PRO Plan Rule Verification', () => {
    it('enforces exact feature and property limit equality between PRO and PARCEIRO', () => {
      // Room/Property limit
      expect(getMaxProperties('parceiro')).toBe(4);
      expect(getMaxProperties('parceiro')).toBe(getMaxProperties('pro'));

      // WhatsApp Numbers
      expect(PLAN_CONFIG.parceiro.maxWhatsappNumbers).toBe(PLAN_CONFIG.pro.maxWhatsappNumbers);

      // Core Feature Gates
      expect(hasFeature('parceiro', 'aiAttendance')).toBe(true);
      expect(hasFeature('parceiro', 'preBookingMode')).toBe(true);
      expect(hasFeature('parceiro', 'postBookingMode')).toBe(true);
      expect(hasFeature('parceiro', 'magicOnboarding')).toBe(true);
      expect(hasFeature('parceiro', 'oneShotResolution')).toBe(true);
      expect(hasFeature('parceiro', 'dashboard')).toBe(true);
      expect(hasFeature('parceiro', 'conversationHistory')).toBe(true);

      // Tier Level access parity (Level 2)
      expect(tierLevel('parceiro')).toBe(2);
      expect(tierLevel('parceiro')).toBe(tierLevel('pro'));
      expect(hasAccess('parceiro', 'pro')).toBe(true);

      // Commercial differentiation (Price R$ 247 vs PRO R$ 397)
      expect(PLAN_DISPLAY.parceiro.price).toBe(247);
      expect(PLAN_DISPLAY.pro.price).toBe(397);
    });
  });

  describe('2. 100 Gated Slots & Concurrency Protection', () => {
    it('allows slot 1 to 100, blocks slot 101, and updates tenant plan to parceiro', async () => {
      // Pre-fill 99 claims
      for (let i = 1; i <= 99; i++) {
        claimsStore.push({
          id: `claim_${i}`,
          slotNumber: i,
          tenantId: `tenant_${i}`,
          monthlyPrice: 247.0,
          contractMonths: 24,
          status: 'ACTIVE',
          badgeActive: true,
        });
      }

      // Slot 100: Should succeed
      const res100 = await PartnerProgramService.claimSlot({
        tenantId: 'tenant_pousada_mar_azul',
        pousadaName: 'Pousada Mar Azul',
        ownerName: 'Marcio Cau',
        email: 'marcio@marazul.com',
        phone: '11999998888',
      });

      expect(res100.success).toBe(true);
      expect(res100.slotNumber).toBe(100);

      // Status should now be FULL / 0 available
      const statusAfter100 = await PartnerProgramService.getProgramStatus();
      expect(statusAfter100.status).toBe('FULL');
      expect(statusAfter100.availableSlots).toBe(0);
      expect(statusAfter100.claimedSlots).toBe(100);

      // Slot 101: Attempting to claim slot 101 must be blocked
      vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_101');
      const req101 = new NextRequest('http://localhost:3000/api/ddc/partner-program/claim', {
        method: 'POST',
        body: JSON.stringify({
          pousadaName: 'Pousada Sol 101',
          ownerName: 'Anfitrião 101',
          email: 'sol101@pousada.com',
          phone: '11988887777',
        }),
      });

      const res101 = await claimSlotRoute(req101);
      expect(res101.status).toBe(409);
      const json101 = await res101.json();
      expect(json101.code).toBe('PROGRAM_FULL');
    });

    it('idempotency: tenant calling claim twice receives existing claim without consuming an extra slot', async () => {
      const firstClaim = await PartnerProgramService.claimSlot({
        tenantId: 'tenant_pousada_mar_azul',
        pousadaName: 'Pousada Mar Azul',
        ownerName: 'Marcio Cau',
        email: 'marcio@marazul.com',
        phone: '11999998888',
      });
      expect(firstClaim.slotNumber).toBe(1);

      const secondClaim = await PartnerProgramService.claimSlot({
        tenantId: 'tenant_pousada_mar_azul',
        pousadaName: 'Pousada Mar Azul',
        ownerName: 'Marcio Cau',
        email: 'marcio@marazul.com',
        phone: '11999998888',
      });
      expect(secondClaim.isExisting).toBe(true);
      expect(secondClaim.slotNumber).toBe(1);
      expect(claimsStore.length).toBe(1);
    });
  });

  describe('3. Waitlist & Admin Reopening Lifecycle', () => {
    it('handles waitlist subscription and 2nd batch reopening up to 200 slots', async () => {
      // 1. Fill 100 slots
      for (let i = 1; i <= 100; i++) {
        claimsStore.push({
          id: `claim_${i}`,
          slotNumber: i,
          tenantId: `tenant_${i}`,
          monthlyPrice: 247.0,
          contractMonths: 24,
          status: 'ACTIVE',
          badgeActive: true,
        });
      }

      // 2. Candidate registers on waitlist
      const waitlistReq = new NextRequest('http://localhost:3000/api/ddc/partner-program/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          pousadaName: 'Pousada Vista da Serra',
          contactName: 'Carlos Pousadeiro',
          email: 'carlos@vistadaserra.com',
          phone: '24987654321',
          city: 'Paraty',
          state: 'RJ',
          roomCount: 8,
        }),
      });

      const waitlistRes = await waitlistRoute(waitlistReq);
      expect(waitlistRes.status).toBe(201);
      expect(waitlistStore.length).toBe(1);
      expect(waitlistStore[0].email).toBe('carlos@vistadaserra.com');

      // 3. Admin reopens 2nd batch (up to 200)
      vi.mocked(requireTenant).mockResolvedValue('zcc-admin');
      const reopenReq = new NextRequest('http://localhost:3000/api/zcc/partner-program/reopen', {
        method: 'POST',
      });
      const reopenRes = await reopenRoute(reopenReq);
      expect(reopenRes.status).toBe(200);

      // Status should now be REOPENED with 100 available slots (out of 200 ceiling)
      const statusAfterReopen = await PartnerProgramService.getProgramStatus();
      expect(statusAfterReopen.status).toBe('REOPENED');
      expect(statusAfterReopen.totalSlots).toBe(200);
      expect(statusAfterReopen.availableSlots).toBe(100);

      // 4. Candidate claims slot 101 in Batch 2
      vi.mocked(requireTenant).mockResolvedValue('tenant_vista_da_serra');
      const batch2Claim = await PartnerProgramService.claimSlot({
        tenantId: 'tenant_vista_da_serra',
        pousadaName: 'Pousada Vista da Serra',
        ownerName: 'Carlos Pousadeiro',
        email: 'carlos@vistadaserra.com',
        phone: '24987654321',
      });
      expect(batch2Claim.success).toBe(true);
      expect(batch2Claim.slotNumber).toBe(101);
    });
  });

  describe('4. Partner Badge Verification (PARTNER_ZELLA_ACTIVE)', () => {
    it('returns official verified badge for active partner and null for non-partner', async () => {
      // Non-partner tenant
      const badgeNonPartner = await PartnerProgramService.getBadgeStatus('tenant_unregistered');
      expect(badgeNonPartner.isPartner).toBe(false);
      expect(badgeNonPartner.badge).toBeNull();

      // Active partner tenant
      claimsStore.push({
        id: 'claim_mar_azul',
        slotNumber: 7,
        tenantId: 'tenant_pousada_mar_azul',
        status: 'ACTIVE',
        badgeActive: true,
        contractEnd: new Date('2028-08-31'),
      });

      const badgePartner = await PartnerProgramService.getBadgeStatus('tenant_pousada_mar_azul');
      expect(badgePartner.isPartner).toBe(true);
      expect(badgePartner.badge).toBe('PARTNER_ZELLA_ACTIVE');
      expect(badgePartner.label).toBe('Parceiro Zélla Oficial #7');

      // Test badge HTTP route
      const reqBadge = new NextRequest('http://localhost:3000/api/ddc/partner-program/badge?tenantId=tenant_pousada_mar_azul');
      const resBadge = await badgeRoute(reqBadge);
      expect(resBadge.status).toBe(200);
      const jsonBadge = await resBadge.json();
      expect(jsonBadge.isPartner).toBe(true);
      expect(jsonBadge.badge).toBe('PARTNER_ZELLA_ACTIVE');
    });
  });
});

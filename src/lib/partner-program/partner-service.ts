/**
 * PARCEIRO ZÉLLA — PROGRAM SERVICE (HUMAN-IN-THE-LOOP & GATED LAUNCH)
 * ============================================================================
 * CANONICAL RULES:
 * 1. Price: R$ 247/month with 24-month contract.
 * 2. Features: EXACT SAME AS PRO PLAN (Full Parity: CRM, Training, iCal, Locks, 4 properties).
 * 3. Initial limit: 100 first partner pousadas/hosts.
 * 4. Concurrency protected by transactional advisory lock (zero duplicate claims).
 * 5. Waitlist kicks in at 100; batch 2 (up to 200) opened only via admin action.
 * 6. Badge `PARTNER_ZELLA_ACTIVE` derived dynamically from verified backend claim.
 */
import { db } from '@/lib/db';
import { withAdvisoryLock } from '@/lib/db/concurrency';

export interface ClaimSlotInput {
  tenantId: string;
  pousadaName: string;
  ownerName: string;
  email: string;
  phone: string;
  propertyId?: string;
}

export interface JoinWaitlistInput {
  tenantId?: string;
  pousadaName: string;
  contactName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  roomCount?: number;
  notes?: string;
}

export interface PartnerProgramStatus {
  status: 'ACTIVE' | 'FULL' | 'WAITLIST' | 'REOPENED' | 'CLOSED';
  claimedSlots: number;
  totalSlots: number;
  availableSlots: number;
  monthlyPrice: number;
  contractMonths: number;
  activeBatch: number;
  isAvailable: boolean;
}

export interface PartnerBadgeStatus {
  isPartner: boolean;
  badge: 'PARTNER_ZELLA_ACTIVE' | null;
  label: string | null;
  slotNumber?: number;
  contractEnd?: Date;
}

export class PartnerProgramService {
  /**
   * Fetches the current live status of the Parceiro Zélla launch program.
   */
  static async getProgramStatus(): Promise<PartnerProgramStatus> {
    let config = await (db as any).partnerProgramConfig.findFirst({
      where: { id: 'default' },
    });

    if (!config) {
      config = await (db as any).partnerProgramConfig.create({
        data: {
          id: 'default',
          maxSlotsInitial: 100,
          maxSlotsCeiling: 200,
          claimedSlots: 0,
          status: 'ACTIVE',
          monthlyPrice: 247.0,
          contractMonths: 24,
          activeBatch: 1,
        },
      });
    }

    const activeClaims = await (db as any).partnerClaim.count({
      where: { status: 'ACTIVE' },
    });

    const maxAllowed = config.activeBatch === 1 ? config.maxSlotsInitial : config.maxSlotsCeiling;
    let effectiveStatus: 'ACTIVE' | 'FULL' | 'WAITLIST' | 'REOPENED' | 'CLOSED' = 'ACTIVE';

    if (activeClaims >= config.maxSlotsCeiling) {
      effectiveStatus = 'CLOSED';
    } else if (activeClaims >= config.maxSlotsInitial && config.activeBatch === 1) {
      effectiveStatus = 'FULL';
    } else if (config.activeBatch === 2 && activeClaims < config.maxSlotsCeiling) {
      effectiveStatus = 'REOPENED';
    } else {
      effectiveStatus = 'ACTIVE';
    }

    const availableSlots = Math.max(0, maxAllowed - activeClaims);

    return {
      status: effectiveStatus,
      claimedSlots: activeClaims,
      totalSlots: maxAllowed,
      availableSlots,
      monthlyPrice: config.monthlyPrice,
      contractMonths: config.contractMonths,
      activeBatch: config.activeBatch,
      isAvailable: availableSlots > 0 && effectiveStatus !== 'CLOSED' && effectiveStatus !== 'FULL',
    };
  }

  /**
   * Claim a Partner Slot with transactional advisory lock to prevent race conditions.
   */
  static async claimSlot(input: ClaimSlotInput) {
    const { tenantId, pousadaName, ownerName, email, phone, propertyId } = input;

    return await withAdvisoryLock('partner_program_claim', async (tx) => {
      // 1. Check if tenant already has an active claim (Idempotency)
      const existing = await (tx as any).partnerClaim.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      });

      if (existing) {
        return {
          success: true,
          claim: existing,
          slotNumber: existing.slotNumber,
          isExisting: true,
        };
      }

      // 2. Fetch current config
      let config = await (tx as any).partnerProgramConfig.findFirst({
        where: { id: 'default' },
      });

      if (!config) {
        config = await (tx as any).partnerProgramConfig.create({
          data: {
            id: 'default',
            maxSlotsInitial: 100,
            maxSlotsCeiling: 200,
            claimedSlots: 0,
            status: 'ACTIVE',
            monthlyPrice: 247.0,
            contractMonths: 24,
            activeBatch: 1,
          },
        });
      }

      const activeClaims = await (tx as any).partnerClaim.count({
        where: { status: 'ACTIVE' },
      });

      const maxAllowed = config.activeBatch === 1 ? config.maxSlotsInitial : config.maxSlotsCeiling;

      if (activeClaims >= maxAllowed) {
        throw new Error('PARTNER_PROGRAM_FULL');
      }

      const nextSlotNumber = activeClaims + 1;
      const contractStart = new Date();
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + config.contractMonths);

      // 3. Create PartnerClaim
      const claim = await (tx as any).partnerClaim.create({
        data: {
          slotNumber: nextSlotNumber,
          tenantId,
          propertyId,
          pousadaName,
          ownerName,
          email,
          phone,
          monthlyPrice: config.monthlyPrice,
          contractMonths: config.contractMonths,
          status: 'ACTIVE',
          badgeActive: true,
          batch: config.activeBatch,
          contractStart,
          contractEnd,
        },
      });

      // 4. Update Tenant plan to 'parceiro' (which has full PRO parity)
      await (tx as any).tenant.update({
        where: { id: tenantId },
        data: { plan: 'parceiro' },
      });

      // 5. Update Program status
      const isNowFull = nextSlotNumber >= maxAllowed;
      await (tx as any).partnerProgramConfig.update({
        where: { id: config.id },
        data: {
          claimedSlots: nextSlotNumber,
          status: isNowFull ? (config.activeBatch === 1 ? 'FULL' : 'CLOSED') : config.status,
        },
      });

      return {
        success: true,
        claim,
        slotNumber: nextSlotNumber,
        isExisting: false,
      };
    });
  }

  /**
   * Register interest in the waitlist when the initial 100 slots are full.
   */
  static async joinWaitlist(input: JoinWaitlistInput) {
    const { tenantId, pousadaName, contactName, email, phone, city, state, roomCount, notes } = input;

    const existing = await (db as any).partnerWaitlist.findFirst({
      where: { email },
    });

    if (existing) {
      return {
        success: true,
        waitlistEntry: existing,
        isExisting: true,
      };
    }

    const waitlistEntry = await (db as any).partnerWaitlist.create({
      data: {
        tenantId,
        pousadaName,
        contactName,
        email,
        phone,
        city,
        state,
        roomCount: roomCount ? Number(roomCount) : null,
        notes: notes || 'Interesse registrado para o próximo lote Parceiro Zélla',
        status: 'PENDING',
      },
    });

    return {
      success: true,
      waitlistEntry,
      isExisting: false,
    };
  }

  /**
   * Resolves the official Partner Badge status for a tenant.
   */
  static async getBadgeStatus(tenantId: string): Promise<PartnerBadgeStatus> {
    const claim = await (db as any).partnerClaim.findFirst({
      where: { tenantId, status: 'ACTIVE', badgeActive: true },
    });

    if (claim) {
      return {
        isPartner: true,
        badge: 'PARTNER_ZELLA_ACTIVE',
        label: `Parceiro Zélla Oficial #${claim.slotNumber}`,
        slotNumber: claim.slotNumber,
        contractEnd: claim.contractEnd,
      };
    }

    return {
      isPartner: false,
      badge: null,
      label: null,
    };
  }

  /**
   * Administrative action: reopens the program for Batch 2 (up to 200 slots total).
   */
  static async reopenSecondBatch() {
    let config = await (db as any).partnerProgramConfig.findFirst({
      where: { id: 'default' },
    });

    if (!config) {
      config = await (db as any).partnerProgramConfig.create({
        data: {
          id: 'default',
          maxSlotsInitial: 100,
          maxSlotsCeiling: 200,
          claimedSlots: 100,
          status: 'REOPENED',
          activeBatch: 2,
        },
      });
    } else {
      config = await (db as any).partnerProgramConfig.update({
        where: { id: config.id },
        data: {
          activeBatch: 2,
          status: 'REOPENED',
        },
      });
    }

    return {
      success: true,
      config,
    };
  }
}

/**
 * SPECIAL DATES & HITL APPROVAL SERVICE — Seu Zélla
 * ============================================================================
 * NON-NEGOTIABLE ARCHITECTURAL RULE:
 * Seu Zélla DETECTS opportunities and SUGGESTS price adjustments (status = 'pending').
 * Seu Zélla NEVER modifies prices automatically without explicit owner approval.
 * Only an approved suggestion materializes a `PriceOverride`.
 */
import { db } from '@/lib/db';

export interface DetectOpportunityInput {
  tenantId: string;
  propertyId?: string;
  roomId?: string;
  date: Date | string;
  name: string;
  type?: string;
  basePrice: number;
  suggestedPrice: number;
  reason: string;
  impactEstimate?: string;
}

export interface ApproveSuggestionInput {
  tenantId: string;
  suggestionId: string;
  approvedBy: string;
  customPrice?: number;
  note?: string;
}

export interface RejectSuggestionInput {
  tenantId: string;
  suggestionId: string;
  rejectedBy: string;
  reason?: string;
}

export interface ActivePriceResult {
  price: number;
  basePrice: number;
  isSpecialDate: boolean;
  source: 'price_override' | 'base_rate';
  overrideId?: string;
  suggestionId?: string;
}

export class SpecialDatesHitlService {
  /**
   * Detects a high-demand special date or holiday and records a PENDING suggestion.
   * NEVER alters the active price at this stage.
   */
  static async detectOpportunity(input: DetectOpportunityInput) {
    const {
      tenantId,
      propertyId,
      roomId,
      date,
      name,
      type = 'national',
      basePrice,
      suggestedPrice,
      reason,
      impactEstimate = '',
    } = input;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // 1. Find or create SpecialDate record
    let specialDate = await (db as any).specialDate.findFirst({
      where: { tenantId, date: targetDate, type },
    });

    if (!specialDate) {
      specialDate = await (db as any).specialDate.create({
        data: {
          tenantId,
          propertyId,
          date: targetDate,
          type,
          name,
          description: reason,
        },
      });
    }

    // 2. Check if a pending suggestion already exists (Idempotency)
    const existingSuggestion = await (db as any).specialDateSuggestion.findFirst({
      where: {
        tenantId,
        specialDateId: specialDate.id,
        roomId: roomId ?? null,
        status: 'pending',
      },
    });

    if (existingSuggestion) {
      return {
        specialDate,
        suggestion: existingSuggestion,
        status: 'pending_approval',
        isNew: false,
      };
    }

    // 3. Create PENDING suggestion for owner review
    const suggestion = await (db as any).specialDateSuggestion.create({
      data: {
        tenantId,
        specialDateId: specialDate.id,
        propertyId,
        roomId,
        currentPrice: basePrice,
        suggestedPrice,
        reason,
        impactEstimate,
        status: 'pending',
      },
    });

    return {
      specialDate,
      suggestion,
      status: 'pending_approval',
      isNew: true,
    };
  }

  /**
   * Owner approves the suggested tariff.
   * Materializes the `PriceOverride` so future bookings for this date receive the approved price.
   */
  static async approveSuggestion(input: ApproveSuggestionInput) {
    const { tenantId, suggestionId, approvedBy, customPrice, note } = input;

    const suggestion = await (db as any).specialDateSuggestion.findFirst({
      where: { id: suggestionId, tenantId },
      include: { specialDate: true },
    });

    if (!suggestion) {
      throw new Error('SUGGESTION_NOT_FOUND_OR_NOT_OWNED');
    }

    const finalPrice = customPrice !== undefined && customPrice > 0 ? customPrice : suggestion.suggestedPrice;
    const targetDate = new Date(suggestion.specialDate.date);

    // 1. Update suggestion status
    const updatedSuggestion = await (db as any).specialDateSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: approvedBy,
        decisionNote: note || 'Aprovado pelo proprietário/anfitrião',
      },
    });

    // 2. Upsert PriceOverride (idempotent)
    const priceOverride = await (db as any).priceOverride.upsert({
      where: {
        tenantId_roomId_date: {
          tenantId,
          roomId: suggestion.roomId || 'all',
          date: targetDate,
        },
      },
      update: {
        price: finalPrice,
        basePrice: suggestion.currentPrice,
        suggestionId: suggestion.id,
        createdBy: approvedBy,
        approvedAt: new Date(),
        status: 'active',
      },
      create: {
        tenantId,
        propertyId: suggestion.propertyId,
        roomId: suggestion.roomId || 'all',
        date: targetDate,
        price: finalPrice,
        basePrice: suggestion.currentPrice,
        suggestionId: suggestion.id,
        createdBy: approvedBy,
        approvedAt: new Date(),
        status: 'active',
      },
    });

    return {
      suggestion: updatedSuggestion,
      priceOverride,
      success: true,
    };
  }

  /**
   * Owner rejects the suggestion.
   * Preserves historical decision without creating any PriceOverride.
   */
  static async rejectSuggestion(input: RejectSuggestionInput) {
    const { tenantId, suggestionId, rejectedBy, reason } = input;

    const suggestion = await (db as any).specialDateSuggestion.findFirst({
      where: { id: suggestionId, tenantId },
    });

    if (!suggestion) {
      throw new Error('SUGGESTION_NOT_FOUND_OR_NOT_OWNED');
    }

    const updatedSuggestion = await (db as any).specialDateSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'rejected',
        decidedAt: new Date(),
        decidedBy: rejectedBy,
        decisionNote: reason || 'Rejeitado pelo anfitrião',
      },
    });

    return {
      suggestion: updatedSuggestion,
      success: true,
    };
  }

  /**
   * Resolves the effective active price for a room on a given calendar date.
   * Returns approved PriceOverride if present, else fallback to base room rate.
   */
  static async getActivePriceForDate(
    tenantId: string,
    roomId: string,
    date: Date | string,
    basePrice: number
  ): Promise<ActivePriceResult> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Look for specific room override or general room override
    const override = await (db as any).priceOverride.findFirst({
      where: {
        tenantId,
        date: targetDate,
        status: 'active',
        OR: [{ roomId }, { roomId: 'all' }, { roomId: null }],
      },
    });

    if (override) {
      return {
        price: override.price,
        basePrice,
        isSpecialDate: true,
        source: 'price_override',
        overrideId: override.id,
        suggestionId: override.suggestionId ?? undefined,
      };
    }

    return {
      price: basePrice,
      basePrice,
      isSpecialDate: false,
      source: 'base_rate',
    };
  }
}

/**
 * ZÉLLA DDC — Dynamic Pricing API
 *
 * GET:    Fetch pricing rules for tenant + current pricing insights
 * POST:   Create/update a pricing rule
 * DELETE: Delete a pricing rule (by id in query param)
 *
 * Uses withSecurity from @/lib/security/api-shield
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { withSecurity, SecurityContext } from '@/lib/security/api-shield';
import {
  getPricingInsights,
  getBrazilianHolidays,
} from '@/lib/dynamic-pricing-engine';

// ── GET: Fetch pricing rules + insights ────────────────────────────────

async function handleGet(_request: NextRequest, _ctx: SecurityContext): Promise<NextResponse> {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Return demo data when DB is unavailable
      return NextResponse.json({
        success: true,
        data: {
          rules: [],
          insights: {
            upcomingHolidays: getBrazilianHolidays(new Date().getFullYear()).slice(0, 5),
            currentSeason: 'Season Normal',
            activeRulesCount: 0,
            rulesByType: {},
            recentCalculationsCount: 0,
            lastCalculationDate: null,
          },
        },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Autenticação requerida.' }, { status: 401 });
    }

    // Fetch all pricing rules for this tenant
    const rules = await db.dynamicPricingRule.findMany({
      where: { tenantId },
      orderBy: { priority: 'desc' },
    });

    // Fetch pricing insights
    const insights = await getPricingInsights(tenantId);

    // Fetch recent pricing calculations (last 10)
    const recentCalculations = await db.pricingCalculation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        rules: rules.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          type: r.type,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          minOccupancy: r.minOccupancy,
          maxOccupancy: r.maxOccupancy,
          daysOfWeek: r.daysOfWeek,
          minDaysBefore: r.minDaysBefore,
          modifierType: r.modifierType,
          modifierValue: r.modifierValue,
          minPrice: r.minPrice,
          maxPrice: r.maxPrice,
          priority: r.priority,
          appliedCount: r.appliedCount,
          revenueImpact: r.revenueImpact,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        insights,
        recentCalculations: recentCalculations.map(c => ({
          id: c.id,
          roomId: c.roomId,
          airbPropertyId: c.airbPropertyId,
          date: c.date,
          basePrice: c.basePrice,
          calculatedPrice: c.calculatedPrice,
          occupancyAtCalc: c.occupancyAtCalc,
          daysBeforeCheckIn: c.daysBeforeCheckIn,
          appliedRulesCount: c.appliedRulesCount,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[DynamicPricing GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: { code: '500', message: 'Erro ao buscar dados de precificação.' },
    }, { status: 500 });
  }
}

// ── POST: Create / Update pricing rule ─────────────────────────────────

async function handlePost(request: NextRequest, ctx: SecurityContext): Promise<NextResponse> {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({
        success: false,
        error: { code: '503', message: 'Banco de dados indisponível.' },
      }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Autenticação requerida.' }, { status: 401 });
    }

    // Get body — prefer sanitized body from security context, fallback to raw request
    let data: Record<string, unknown>;
    if (ctx.sanitizedBody) {
      data = ctx.sanitizedBody as Record<string, unknown>;
    } else {
      try {
        data = await request.json();
      } catch {
        return NextResponse.json({ error: 'INVALID_BODY', message: 'Body JSON inválido.' }, { status: 400 });
      }
    }

    // Validate required fields
    if (!data.name || typeof data.name !== 'string') {
      return NextResponse.json({ error: 'VALIDATION', message: 'name é obrigatório.' }, { status: 400 });
    }
    if (!data.modifierValue || typeof data.modifierValue !== 'number') {
      return NextResponse.json({ error: 'VALIDATION', message: 'modifierValue é obrigatório (number).' }, { status: 400 });
    }

    // Check if updating an existing rule (has id)
    const ruleId = data.id as string | undefined;

    const ruleData = {
      tenantId,
      name: data.name as string,
      type: (data.type as string) || 'seasonal',
      status: (data.status as string) || 'active',
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
      minOccupancy: (data.minOccupancy as number) ?? 0,
      maxOccupancy: (data.maxOccupancy as number) ?? 100,
      daysOfWeek: JSON.stringify((data.daysOfWeek as number[]) ?? []),
      minDaysBefore: (data.minDaysBefore as number) ?? 0,
      modifierType: (data.modifierType as string) || 'multiplier',
      modifierValue: data.modifierValue as number,
      minPrice: (data.minPrice as number) ?? null,
      maxPrice: (data.maxPrice as number) ?? null,
      priority: (data.priority as number) ?? 0,
    };

    if (ruleId) {
      // Update existing rule - verify tenant ownership
      const existing = await db.dynamicPricingRule.findFirst({
        where: { id: ruleId, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Regra não encontrada.' }, { status: 404 });
      }

      const updated = await db.dynamicPricingRule.update({
        where: { id: existing.id },
        data: ruleData,
      });
      return NextResponse.json({ success: true, data: updated });
    } else {
      // Create new rule
      const created = await db.dynamicPricingRule.create({
        data: ruleData,
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }
  } catch (error) {
    console.error('[DynamicPricing POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: { code: '500', message: 'Erro ao criar/atualizar regra de precificação.' },
    }, { status: 500 });
  }
}

// ── DELETE: Delete pricing rule ────────────────────────────────────────

async function handleDelete(request: NextRequest, _ctx: SecurityContext): Promise<NextResponse> {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({
        success: false,
        error: { code: '503', message: 'Banco de dados indisponível.' },
      }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Autenticação requerida.' }, { status: 401 });
    }

    const ruleId = request.nextUrl.searchParams.get('id');
    if (!ruleId) {
      return NextResponse.json({ error: 'VALIDATION', message: 'id é obrigatório (query param).' }, { status: 400 });
    }

    // Verify the rule belongs to this tenant
    const rule = await db.dynamicPricingRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Regra não encontrada.' }, { status: 404 });
    }

    await db.dynamicPricingRule.delete({
      where: { id: rule.id },
    });

    return NextResponse.json({ success: true, data: { deleted: ruleId } });
  } catch (error) {
    console.error('[DynamicPricing DELETE] Error:', error);
    return NextResponse.json({
      success: false,
      error: { code: '500', message: 'Erro ao deletar regra de precificação.' },
    }, { status: 500 });
  }
}

// ── Export with Security ───────────────────────────────────────────────

export const GET = withSecurity(handleGet, { routeLabel: 'dynamic-pricing' });
export const POST = withSecurity(handlePost, { routeLabel: 'dynamic-pricing' });
export const DELETE = withSecurity(handleDelete, { routeLabel: 'dynamic-pricing' });

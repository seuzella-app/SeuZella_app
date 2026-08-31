import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { SpecialDatesHitlService } from '@/lib/ai/special-dates/hitl-service';

async function getHandler(_request: NextRequest) {
  try {
    const tenantId = await requireTenant();
    const specialDates = await (db as any).specialDate.findMany({
      where: { tenantId },
      include: {
        suggestions: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(specialDates);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or invalid tenant' }, { status: 401 });
  }
}

async function postHandler(request: NextRequest) {
  try {
    const tenantId = await requireTenant();
    const body = await request.json();
    const { propertyId, roomId, date, name, type, basePrice, suggestedPrice, reason, impactEstimate } = body;

    if (!date || !name || !basePrice || !suggestedPrice) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (date, name, basePrice, suggestedPrice)' },
        { status: 400 }
      );
    }

    const result = await SpecialDatesHitlService.detectOpportunity({
      tenantId,
      propertyId,
      roomId,
      date,
      name,
      type,
      basePrice: Number(basePrice),
      suggestedPrice: Number(suggestedPrice),
      reason: reason || 'Oportunidade de alta demanda identificada pelo Seu Zélla.',
      impactEstimate,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao processar oportunidade de data especial' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'ddc-special-dates' });
export const POST = withSecurity(postHandler, { routeLabel: 'ddc-special-dates' });

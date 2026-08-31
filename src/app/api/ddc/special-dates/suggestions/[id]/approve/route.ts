import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { SpecialDatesHitlService } from '@/lib/ai/special-dates/hitl-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant();
    const { id } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const { customPrice, note, approvedBy = 'owner' } = body;

    const result = await SpecialDatesHitlService.approveSuggestion({
      tenantId,
      suggestionId: id,
      approvedBy,
      customPrice: customPrice ? Number(customPrice) : undefined,
      note,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error.message === 'SUGGESTION_NOT_FOUND_OR_NOT_OWNED') {
      return NextResponse.json(
        { error: 'Sugestão não encontrada ou não pertence ao tenant autenticado', code: 'RESOURCE_NOT_FOUND' },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'Falha ao aprovar sugestão de data especial' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET/POST /api/ddc/onboarding-wizard
 *
 * Wizard multi-step para o dono cadastrar a pousada (Etapa 3: Magic Scan).
 *
 * GET ?tenantId=xxx → retorna dados já cadastrados da pousada
 * POST { tenantId, step, data } → salva dados de cada step
 *
 * Steps:
 *   1. Dados básicos (nome, descrição, cidade, endereço)
 *   2. Quartos (quantidade, tipos, preços)
 *   3. Políticas (check-in, check-out, pets, cancelamento)
 *   4. PIX (chave PIX para pagamentos)
 *   5. WhatsApp (conectar número Cloud API)
 *   6. Personalidade (tom de voz da IA)
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'MISSING_TENANT_ID' }, { status: 400 });
  }

  try {
    if (!db) {
      return NextResponse.json({
        success: true,
        data: { property: null, rooms: [], stepsCompleted: [], source: 'fallback' },
      });
    }

    const property = await (db as any).property.findFirst({
      where: { tenantId },
      include: { rooms: true },
    });

    if (!property) {
      return NextResponse.json({
        success: true,
        data: { property: null, rooms: [], stepsCompleted: [], source: 'empty' },
      });
    }

    const meta = JSON.parse(property.metadata || '{}');
    const stepsCompleted = meta.onboardingStepsCompleted || [];

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: property.id,
          name: property.name,
          description: property.description,
          city: property.city,
          state: property.state,
          address: property.address,
          pixKey: property.pixKey,
          pixKeyType: property.pixKeyType,
          checkInTime: meta.checkInTime || '14:00',
          checkOutTime: meta.checkOutTime || '12:00',
          petPolicy: meta.petPolicy || 'not_allowed',
          cancellationPolicy: meta.cancellationPolicy || 'flexible',
          aiTone: meta.aiTone || 'descontraida',
          whatsappConnected: meta.whatsappConnected || false,
          autoPinActive: meta.autoPinActive || false,
        },
        rooms: property.rooms || [],
        stepsCompleted,
      },
    });
  } catch (error) {
    console.error('[Onboarding Wizard GET] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, step, data } = body;

    if (!tenantId || !step || !data) {
      return NextResponse.json({ success: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: true, data: { step, saved: true, source: 'fallback' } });
    }

    const property = await (db as any).property.findFirst({
      where: { tenantId },
      select: { id: true, metadata: true },
    });

    if (!property) {
      // Cria property se não existe
      const newProperty = await (db as any).property.create({
        data: {
          tenantId,
          name: data.name || 'Minha Pousada',
          city: data.city || '',
          state: data.state || '',
          metadata: JSON.stringify({ onboardingStepsCompleted: [step] }),
        },
      });
      return NextResponse.json({ success: true, data: { step, saved: true, propertyId: newProperty.id } });
    }

    const meta = JSON.parse(property.metadata || '{}');
    const stepsCompleted = new Set(meta.onboardingStepsCompleted || []);
    stepsCompleted.add(step);
    meta.onboardingStepsCompleted = [...stepsCompleted];

    // Salva dados específicos de cada step
    const updateData: any = { metadata: JSON.stringify(meta) };

    switch (step) {
      case 'basic_info':
        updateData.name = data.name;
        updateData.description = data.description;
        updateData.city = data.city;
        updateData.state = data.state;
        updateData.address = data.address;
        break;
      case 'rooms':
        // Quartos são salvos separadamente via API de rooms
        break;
      case 'policies':
        meta.checkInTime = data.checkInTime || '14:00';
        meta.checkOutTime = data.checkOutTime || '12:00';
        meta.petPolicy = data.petPolicy || 'not_allowed';
        meta.cancellationPolicy = data.cancellationPolicy || 'flexible';
        updateData.metadata = JSON.stringify(meta);
        break;
      case 'pix':
        updateData.pixKey = data.pixKey;
        updateData.pixKeyType = data.pixKeyType || 'cpf';
        break;
      case 'whatsapp':
        meta.whatsappConnected = data.connected || false;
        updateData.metadata = JSON.stringify(meta);
        break;
      case 'personality':
        meta.aiTone = data.tone || 'descontraida';
        meta.aiExpressions = data.expressions || [];
        meta.aiGreeting = data.greeting || '';
        meta.aiAssistantName = data.assistantName || 'Zélla';
        updateData.metadata = JSON.stringify(meta);
        break;
      case 'autopin':
        meta.autoPinActive = data.active || false;
        updateData.metadata = JSON.stringify(meta);
        break;
    }

    await (db as any).property.update({
      where: { id: property.id },
      data: updateData,
    });

    // Verifica se completou todos os steps
    const allSteps = ['basic_info', 'rooms', 'policies', 'pix', 'whatsapp', 'personality'];
    const completedAll = allSteps.every(s => stepsCompleted.has(s));

    return NextResponse.json({
      success: true,
      data: {
        step,
        saved: true,
        stepsCompleted: [...stepsCompleted],
        completedAll,
      },
      message: completedAll
        ? 'Onboarding completo! Sua pousada está pronta para receber hóspedes. 🎉'
        : `Etapa ${step} salva com sucesso!`,
    });
  } catch (error) {
    console.error('[Onboarding Wizard POST] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

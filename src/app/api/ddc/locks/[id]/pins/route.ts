import { NextRequest, NextResponse } from 'next/server';
import { generatePin, listPins } from '@/lib/locks/orchestrator';
import { calculatePinValidityWindow } from '@/lib/locks/pin-generator';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/ddc/locks/[id]/pins — Lista PINs do dispositivo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const pins = await listPins(id);
    return NextResponse.json({ success: true, data: pins });
  } catch (error) {
    console.error('[LOCKS] Error listing pins:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list lock pins' },
      { status: 500 },
    );
  }
}

// POST /api/ddc/locks/[id]/pins — Gera um novo PIN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Campos aceitos
    const {
      guestName,
      guestPhone,
      bookingId,
      manualPin,
      autoGenerate,
      note,
      validFrom,
      validTo,
      // OU alternativa: passar checkInDate/Time e checkOutDate/Time
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
    } = body;

    // Calcula janela de validade
    let from: Date;
    let to: Date;

    if (validFrom && validTo) {
      from = new Date(validFrom);
      to = new Date(validTo);
    } else if (checkInDate && checkOutDate) {
      const window = calculatePinValidityWindow(
        checkInDate,
        checkOutDate,
        checkInTime || '14:00',
        checkOutTime || '11:00',
      );
      from = window.validFrom;
      to = window.validTo;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Forneça validFrom+validTo OU checkInDate+checkOutDate (com checkInTime/checkOutTime opcionais)',
        },
        { status: 400 },
      );
    }

    if (to <= from) {
      return NextResponse.json(
        { success: false, error: 'validTo deve ser depois de validFrom' },
        { status: 400 },
      );
    }

    const result = await generatePin({
      deviceId: id,
      guestName: guestName?.trim() || undefined,
      guestPhone: guestPhone?.trim() || undefined,
      bookingId: bookingId?.trim() || undefined,
      validFrom: from,
      validTo: to,
      manualPin: manualPin?.trim() || undefined,
      autoGenerate: !!autoGenerate,
      note: note?.trim() || undefined,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('[LOCKS] Error generating pin:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to generate pin' },
      { status: 500 },
    );
  }
}

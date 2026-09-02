/**
 * GET /api/lgpd/export-my-data
 *
 * Portabilidade de dados (art. 18, V LGPD).
 * Hóspede baixa todos os dados que temos sobre ele em formato JSON.
 *
 * Query: ?tenantId=xxx&guestId=yyy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exportarDadosHospede } from '@/lib/lgpd/lgpd-service';

async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  // Wave B IDOR fix: tenantId from session ONLY — never from query params.
  const tenantId = (session.user as any).tenantId;
  const guestId = searchParams.get('guestId');

  if (!tenantId || !guestId) {
    return NextResponse.json(
      { error: 'MISSING_PARAMS', message: 'tenantId e guestId obrigatórios' },
      { status: 400 },
    );
  }

  const data = await exportarDadosHospede(tenantId, guestId);

  return NextResponse.json({
    success: true,
    data,
    message: 'Dados exportados conforme LGPD art. 18, V (portabilidade).',
  });
}

export const GET = getHandler;

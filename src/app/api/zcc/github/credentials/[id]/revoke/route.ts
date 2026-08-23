/**
 * API: Emergency Revoke Credential
 *
 * POST /api/zcc/github/credentials/[id]/revoke
 *   { reason }
 *
 * Marca credencial como inativa no Vault imediatamente.
 * NÃO revoga no GitHub — admin deve fazer manualmente via UI do GitHub.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emergencyRevoke } from '@/lib/github/pat-vault';
import { invalidateClientCache } from '@/lib/github/github-client';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.reason) {
      return NextResponse.json(
        { error: 'reason é obrigatório (para audit log)' },
        { status: 400 }
      );
    }

    await emergencyRevoke(id, body.reason, 'admin');
    invalidateClientCache(id);

    return NextResponse.json({
      success: true,
      message:
        'Credencial revogada no Vault. URGENTE: revogue também no GitHub: https://github.com/settings/tokens',
    });
  } catch (err: any) {
    console.error('[revoke] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

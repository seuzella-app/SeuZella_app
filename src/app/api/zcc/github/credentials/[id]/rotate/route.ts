/**
 * API: Rotate Credential (zero-downtime)
 *
 * POST /api/zcc/github/credentials/[id]/rotate
 *   { newPat, newExpiresAt }
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { rotateCredential } from '@/lib/github/pat-vault';
import { invalidateClientCache } from '@/lib/github/github-client';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.newPat || !body.newExpiresAt) {
      return NextResponse.json(
        { error: 'newPat e newExpiresAt são obrigatórios' },
        { status: 400 }
      );
    }

    const newExpiresAt = new Date(body.newExpiresAt);
    if (isNaN(newExpiresAt.getTime()) || newExpiresAt < new Date()) {
      return NextResponse.json(
        { error: 'newExpiresAt inválido ou no passado' },
        { status: 400 }
      );
    }

    const newId = await rotateCredential(params.id, body.newPat, newExpiresAt, 'admin');

    // Invalida cache do GitHubClient para forçar reload
    invalidateClientCache(params.id);

    return NextResponse.json({
      success: true,
      newCredentialId: newId,
      message:
        'Rotação concluída. ATENÇÃO: revogue o PAT antigo manualmente em https://github.com/settings/tokens',
    });
  } catch (err: any) {
    console.error('[rotate] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

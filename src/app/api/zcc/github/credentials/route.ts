/**
 * API: List & Create GitHub Credentials
 *
 * GET  /api/zcc/github/credentials — lista credenciais (sem PAT)
 * POST /api/zcc/github/credentials — cria nova credencial
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 4)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createCredential,
  listActiveCredentials,
  type AuthType,
} from '@/lib/github/pat-vault';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function GET(req: NextRequest) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const credentials = await listActiveCredentials();
    return NextResponse.json({ credentials });
  } catch (err: any) {
    console.error('[github-credentials] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validação básica
    if (!body.label || !body.authType || !body.pat || !body.expiresAt) {
      return NextResponse.json(
        {
          error:
            'Campos obrigatórios: label, authType, pat, expiresAt. scopes e repositoryAccess são altamente recomendados.',
        },
        { status: 400 }
      );
    }

    if (!['fine_grained_pat', 'github_app', 'deploy_key'].includes(body.authType)) {
      return NextResponse.json(
        { error: `authType inválido: ${body.authType}` },
        { status: 400 }
      );
    }

    const expiresAt = new Date(body.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: 'expiresAt inválido' }, { status: 400 });
    }

    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'expiresAt não pode ser no passado' },
        { status: 400 }
      );
    }

    // Para Fine-Grained PAT: valida formato (deve começar com github_pat_)
    if (
      body.authType === 'fine_grained_pat' &&
      typeof body.pat === 'string' &&
      body.pat.startsWith('ghp_')
    ) {
      return NextResponse.json(
        {
          error:
            'PAT clássico (ghp_) não permitido. Use Fine-Grained PAT (github_pat_). Crie em: https://github.com/settings/personal-access-tokens/new',
        },
        { status: 400 }
      );
    }

    // Cria credencial
    const credentialId = await createCredential({
      label: body.label,
      authType: body.authType as AuthType,
      pat: body.pat,
      scopes: body.scopes || [],
      repositoryAccess: body.repositoryAccess || [],
      expiresAt,
      createdBy: 'admin', // TODO: extrair do JWT
      githubAppId: body.githubAppId,
      githubClientId: body.githubClientId,
      installationId: body.installationId,
      webhookSecret: body.webhookSecret,
    });

    // Retorna sem o PAT (apenas metadados)
    return NextResponse.json(
      {
        success: true,
        credentialId,
        message:
          'Credencial criada. Valide acessando um repositório para garantir que está funcionando.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[github-credentials] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

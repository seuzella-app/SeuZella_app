// src/app/api/alexa/smart-home/route.ts
import { NextResponse } from 'next/server';
import { AlexaLockService, AlexaSmartHomeDirective } from '@/lib/locks/alexa-adapter';
import { verifyJwtToken } from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '');

    const directiveWrapper = await req.json();
    const directive: AlexaSmartHomeDirective = directiveWrapper.directive || directiveWrapper;

    if (!directive || !directive.header) {
      return NextResponse.json({ error: 'Diretiva Alexa inválida ou ausente' }, { status: 400 });
    }

    // Extrai o token do cabeçalho ou do payload do endpoint
    const bearerToken = token || directive.endpoint?.scope?.token;

    if (!bearerToken) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 });
    }

    // Valida a sessão OAuth2 e extrai o tenantId e userId autenticados
    const session = await verifyJwtToken(bearerToken);
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: 'Sessão inválida ou tenant ausente' }, { status: 403 });
    }

    const { namespace, name } = directive.header;

    // Roteamento de Diretivas da Alexa
    if (namespace === 'Alexa.Discovery' && name === 'Discover') {
      const response = await AlexaLockService.handleDiscovery(
        session.tenantId,
        directive.header.correlationToken
      );
      return NextResponse.json(response);
    }

    if (namespace === 'Alexa.LockController') {
      const response = await AlexaLockService.handleControl(
        directive,
        session.tenantId,
        session.userId
      );
      return NextResponse.json(response);
    }

    return NextResponse.json(
      { error: `Diretiva não suportada: ${namespace}.${name}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[ALEXA SMART HOME ERROR]:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar comando da Alexa', details: error.message },
      { status: 500 }
    );
  }
}

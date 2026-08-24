import { NextResponse } from 'next/server';
import { AlexaLockService, AlexaSmartHomeDirective } from '@/lib/locks/alexa-adapter';
import { verifyJwtToken } from '@/lib/auth/jwt';
import { checkAlexaRateLimit, isReplay, markJtiUsed, validateAlexaJwtPayload } from '@/lib/locks/alexa-security';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '');
    const directiveWrapper = await req.json();
    const directive: AlexaSmartHomeDirective = directiveWrapper.directive || directiveWrapper;

    if (!directive?.header) return NextResponse.json({ error: 'ALEXA_DIRECTIVE_INVALID' }, { status: 400 });

    const bearerToken = token || directive.endpoint?.scope?.token;
    if (!bearerToken) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });

    const session = await verifyJwtToken(bearerToken);
    if (!session?.tenantId || !session.userId) return NextResponse.json({ error: 'AUTHENTICATION_INVALID' }, { status: 403 });

    const payloadValidation = validateAlexaJwtPayload({
      sub: session.userId,
      tenantId: session.tenantId,
      scope: session.scope,
      jti: session.jti,
      iat: session.iat,
    });
    if (!payloadValidation.valid) return NextResponse.json({ error: 'ALEXA_TOKEN_INVALID', reason: payloadValidation.reason }, { status: 403 });
    if (session.jti && isReplay(session.jti)) return NextResponse.json({ error: 'ALEXA_REPLAY_DETECTED' }, { status: 409 });

    const rate = checkAlexaRateLimit(session.tenantId);
    if (!rate.allowed) {
      const response = NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
      response.headers.set('Retry-After', String(Math.ceil((rate.retryAfterMs || 60000) / 1000)));
      return response;
    }

    const { namespace, name } = directive.header;
    let response: unknown;

    if (namespace === 'Alexa.Discovery' && name === 'Discover') {
      response = await AlexaLockService.handleDiscovery(session.tenantId, directive.header.correlationToken);
    } else if (namespace === 'Alexa.LockController') {
      response = await AlexaLockService.handleControl(directive, session.tenantId, session.userId);
    } else {
      return NextResponse.json({ error: 'ALEXA_DIRECTIVE_UNSUPPORTED' }, { status: 400 });
    }

    if (session.jti) markJtiUsed(session.jti);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'ALEXA_PROCESSING_FAILED' }, { status: 500 });
  }
}

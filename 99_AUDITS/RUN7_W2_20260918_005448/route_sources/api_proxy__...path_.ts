import { NextRequest, NextResponse } from 'next/server';

/**
 * ZEHLA — Local Dev Proxy (SSRF-protected)
 *
 * SECURITY: This proxy is DISABLED in production.
 * In development, it forwards requests to a local FastAPI backend on port 8000.
 * In production, all backend communication must go through direct API calls.
 *
 * ALLOWED_PATHS restricts which backend endpoints can be proxied even in dev.
 */

const ALLOWED_PATHS: string[] = [
  // Add specific dev-only paths here if needed
  // Example: 'health', 'metrics'
];

const PROXY_ENABLED = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_PROXY === 'true';

function isPathAllowed(urlPath: string): boolean {
  if (ALLOWED_PATHS.length === 0) return true; // Dev mode: allow all when explicitly enabled
  return ALLOWED_PATHS.some((p) => urlPath.startsWith(p));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!PROXY_ENABLED) {
    return NextResponse.json({ error: 'Proxy disabled in this environment.' }, { status: 403 });
  }

  const { path } = await params;
  const urlPath = path.join('/');

  if (!isPathAllowed(urlPath)) {
    return NextResponse.json({ error: 'Path not allowed.' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : '';

  // Only allow localhost targets — prevent SSRF
  const targetUrl = `http://127.0.0.1:8000/${urlPath}${queryString}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Back-end indisponivel na porta 8000.' },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!PROXY_ENABLED) {
    return NextResponse.json({ error: 'Proxy disabled in this environment.' }, { status: 403 });
  }

  const { path } = await params;
  const urlPath = path.join('/');

  if (!isPathAllowed(urlPath)) {
    return NextResponse.json({ error: 'Path not allowed.' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : '';

  const targetUrl = `http://127.0.0.1:8000/${urlPath}${queryString}`;

  try {
    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await request.text();
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamResponse.status}` },
        { status: upstreamResponse.status }
      );
    }

    const upstreamContentType = upstreamResponse.headers.get('content-type') || '';
    if (
      upstreamContentType.includes('text/event-stream') ||
      upstreamContentType.includes('application/x-ndjson')
    ) {
      return new NextResponse(upstreamResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await upstreamResponse.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Back-end indisponivel na porta 8000.' },
      { status: 502 }
    );
  }
}
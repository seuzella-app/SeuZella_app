import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createError } from '@/lib/error-handler';
import { apiRatelimit } from '@/lib/rate-limit';
import { getAuthSession } from '@/lib/auth-guard';

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { session, errorResponse } = await getAuthSession(request);
  if (errorResponse) return errorResponse;

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const {pathname} = new URL(request.url);
  try {
    const rl = await apiRatelimit.limit(`download:${session!.tenantId}:${clientIp}:${pathname}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))) } },
      );
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return createError(503, 'RATE_LIMIT_UNAVAILABLE', 'Serviço temporariamente indisponível');
    }
  }

  try {
    const { filename } = await params;

    if (!filename || filename.length > 255 || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return createError(400, 'INVALID_FILENAME', 'Nome de arquivo inválido');
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS[ext]) {
      return createError(400, 'BLOCKED_EXTENSION', 'Extensão não permitida');
    }

    const filePath = path.join(DOWNLOADS_DIR, filename);
    if (!filePath.startsWith(`${DOWNLOADS_DIR}${path.sep}`)) {
      return createError(400, 'PATH_TRAVERSAL', 'Path traversal detectado');
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      return createError(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado');
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': ALLOWED_EXTENSIONS[ext],
        'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return createError(500, 'DOWNLOAD_ERROR', 'Erro ao processar download');
  }
}

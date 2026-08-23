/**
 * API: Audit Log de credenciais
 *
 * GET /api/zcc/github/credentials/audit?credentialId=&action=&success=&page=&limit=
 *
 * Retorna entradas do PatAuditLog com filtros e paginação.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function GET(req: NextRequest) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const credentialId = url.searchParams.get('credentialId');
    const action = url.searchParams.get('action');
    const success = url.searchParams.get('success');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    const where: any = {};
    if (credentialId) where.credentialId = credentialId;
    if (action) where.action = action;
    if (success === 'true') where.success = true;
    if (success === 'false') where.success = false;

    const [logs, total] = await Promise.all([
      db.patAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          credential: {
            select: { label: true, authType: true },
          },
        },
      }),
      db.patAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('[audit] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

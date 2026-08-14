/**
 * ZCC — Code Vulnerabilities API
 * ================================
 *
 * GET /api/zcc/night-audit/vulns
 *   Retorna todas as CodeVulnerability abertas (não fixed, não false_positive).
 *
 * Query params:
 *   ?status=open|fixed|wont_fix|false_positive (default: open)
 *   ?severity=critical|high|medium|low|info (opcional)
 *   ?limit=100 (default 100, max 500)
 *
 * POST /api/zcc/night-audit/vulns
 *   Body: { fingerprint, action: 'fixed' | 'wont_fix' | 'false_positive', notes?: string }
 *   Atualiza status de uma vulnerabilidade (workflow de correção).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json({ vulnerabilities: [], total: 0, databaseAvailable: false });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? 'open';
  const severity = sp.get('severity');
  const limit = Math.min(parseInt(sp.get('limit') ?? '100', 10), 500);

  try {
    const where: any = { status };
    if (severity) where.severity = severity;

    const vulnerabilities = await (db as any).codeVulnerability?.findMany({
      where,
      orderBy: [
        { severity: 'asc' }, // critical < high < medium < low < info (alfabético funciona)
        { lastDetectedAt: 'desc' },
      ],
      take: limit,
    }) ?? [];

    const total = await (db as any).codeVulnerability?.count({ where }) ?? 0;

    return NextResponse.json({
      vulnerabilities,
      total,
      databaseAvailable: true,
    });
  } catch (error) {
    console.error('[ZCC_VULNS] Erro:', error);
    return NextResponse.json(
      { vulnerabilities: [], total: 0, error: 'Falha ao buscar vulnerabilidades' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json(
      { error: 'Banco indisponível' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { fingerprint, action, notes } = body;

    if (!fingerprint || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: fingerprint, action' },
        { status: 400 },
      );
    }

    if (!['fixed', 'wont_fix', 'false_positive'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: fixed | wont_fix | false_positive' },
        { status: 400 },
      );
    }

    const updated = await (db as any).codeVulnerability?.updateMany({
      where: { fingerprint },
      data: {
        status: action,
        fixedAt: action === 'fixed' ? new Date() : null,
        fixedBy: 'human',
      },
    });

    return NextResponse.json({
      ok: true,
      updated: updated?.count ?? 0,
      fingerprint,
      newStatus: action,
      notes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Falha ao atualizar' },
      { status: 500 },
    );
  }
}

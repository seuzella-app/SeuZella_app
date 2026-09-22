import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMetaCostSummary } from "@/lib/meta-cost-guard";
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(req: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'meta-costs', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:meta-costs', what: 'meta-costs.entry', resource: 'api', result: 'ALLOW' });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // Default to last 30 days
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    
    const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 86400000);
    const endDate = endParam ? new Date(endParam) : new Date();

    // FASE 02B: datas inválidas → 400 honesto (antes: Invalid Date propagava
    // silenciosamente para o where do Prisma).
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const summary = await getMetaCostSummary(
      session.user.tenantId,
      startDate,
      endDate
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/meta-costs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

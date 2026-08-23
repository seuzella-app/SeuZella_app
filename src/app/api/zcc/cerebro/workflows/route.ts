/**
 * ZCC — Cerebro Workflows API
 * ============================
 * GET /api/zcc/cerebro/workflows — lista workflows
 * POST /api/zcc/cerebro/workflows — cria/atualiza workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { CerebroWorkflowEngine } from '@/lib/cerebro/workflow-engine';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const workflows = await (db as any).cerebroWorkflow?.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }) ?? [];
    return NextResponse.json({ workflows });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

const CreateSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.any()),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
});

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 });
    }

    const id = await CerebroWorkflowEngine.saveWorkflow({
      tenantId: parsed.data.tenantId,
      name: parsed.data.name,
      description: parsed.data.description,
      nodes: parsed.data.nodes,
      status: parsed.data.status,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

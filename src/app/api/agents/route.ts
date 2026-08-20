import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';

const DEFAULT_AGENTS = [
  { id: 'ag-receptionist', icon: '🛎️', status: 'active', name: 'Recepcionista', role: 'Reservas e check-in', tasksCompleted: 2847, tasksFailed: 12, successRate: 99.6, avgLatencyMs: 23, modelUsed: 'ZAI Default', uptimeHours: 2160 },
  { id: 'ag-pricer', icon: '💰', status: 'active', name: 'Revenue Manager', role: 'Dynamic pricing', tasksCompleted: 1893, tasksFailed: 34, successRate: 98.2, avgLatencyMs: 45, modelUsed: 'ZAI Default', uptimeHours: 2160 },
  { id: 'ag-messenger', icon: '💬', status: 'active', name: 'WhatsApp Agent', role: 'Auto-reply WhatsApp', tasksCompleted: 12847, tasksFailed: 89, successRate: 99.3, avgLatencyMs: 18, modelUsed: 'ZAI Default', uptimeHours: 2160 },
  { id: 'ag-reviewer', icon: '⭐', status: 'active', name: 'Review Manager', role: 'Resposta a reviews', tasksCompleted: 634, tasksFailed: 8, successRate: 98.7, avgLatencyMs: 67, modelUsed: 'ZAI Default', uptimeHours: 2160 },
  { id: 'ag-hunter', icon: '🎯', status: 'active', name: 'Lead Hunter', role: 'Prospecção Lessie', tasksCompleted: 412, tasksFailed: 21, successRate: 95.1, avgLatencyMs: 156, modelUsed: 'ZAI Default', uptimeHours: 1440 },
  { id: 'ag-housekeeper', icon: '🧹', status: 'sleeping', name: 'Housekeeper', role: 'Gestão de limpeza', tasksCompleted: 891, tasksFailed: 5, successRate: 99.4, avgLatencyMs: 12, modelUsed: 'ZAI Default', uptimeHours: 2160 },
  { id: 'ag-voice', icon: '🎙️', status: 'active', name: 'Voice Agent', role: 'Transcrição de áudio', tasksCompleted: 234, tasksFailed: 18, successRate: 92.9, avgLatencyMs: 210, modelUsed: 'ZAI Default', uptimeHours: 720 },
  { id: 'ag-guardian', icon: '🛡️', status: 'active', name: 'Guardian', role: 'LGPD e segurança', tasksCompleted: 5671, tasksFailed: 0, successRate: 100, avgLatencyMs: 8, modelUsed: 'ZAI Default', uptimeHours: 2160 },
];

async function getTenantId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

function sanitizeAgentInput(body: unknown, tenantId: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.agentId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.agentId)) return null;
  if (typeof input.agentName !== 'string' || input.agentName.trim().length < 1 || input.agentName.length > 120) return null;
  if (input.systemPrompt !== undefined && (typeof input.systemPrompt !== 'string' || input.systemPrompt.length > 20000)) return null;
  if (input.customKnowledge !== undefined && typeof input.customKnowledge !== 'string') return null;
  if (input.temperature !== undefined && (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 2)) return null;
  if (input.maxTokens !== undefined && (typeof input.maxTokens !== 'number' || !Number.isInteger(input.maxTokens) || input.maxTokens < 1 || input.maxTokens > 32768)) return null;
  return {
    tenantId,
    agentId: input.agentId,
    agentName: input.agentName.trim(),
    systemPrompt: typeof input.systemPrompt === 'string' ? input.systemPrompt : '',
    isActive: input.isActive === undefined ? true : input.isActive === true,
    temperature: typeof input.temperature === 'number' ? input.temperature : 0.7,
    maxTokens: typeof input.maxTokens === 'number' ? input.maxTokens : 2048,
    customKnowledge: typeof input.customKnowledge === 'string' ? input.customKnowledge : '[]',
  };
}

async function getHandler(_request: NextRequest, _ctx: any) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await db.agentConfig.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (result.length > 0) {
      return NextResponse.json(result.map((dbAgent, i) => {
        const fallback = DEFAULT_AGENTS[i] || DEFAULT_AGENTS[0];
        return { id: dbAgent.agentId || fallback.id, icon: fallback.icon, status: dbAgent.isActive ? 'active' : 'sleeping', name: dbAgent.agentName || fallback.name, role: fallback.role, tasksCompleted: dbAgent.learnedPatterns || fallback.tasksCompleted, tasksFailed: fallback.tasksFailed, successRate: dbAgent.confidenceScore ? Math.round(dbAgent.confidenceScore * 100) : fallback.successRate, avgLatencyMs: fallback.avgLatencyMs, modelUsed: fallback.modelUsed, uptimeHours: fallback.uptimeHours };
      }));
    }
    return NextResponse.json(DEFAULT_AGENTS);
  } catch {
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 });
  }
}

async function postHandler(request: NextRequest, _ctx: any) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data = sanitizeAgentInput(await request.json(), tenantId);
    if (!data) return NextResponse.json({ error: 'Invalid agent payload' }, { status: 400 });
    const agent = await db.agentConfig.create({ data });
    return NextResponse.json({ success: true, agent: { id: agent.id, tenantId: agent.tenantId, agentId: agent.agentId, agentName: agent.agentName, isActive: agent.isActive } }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create agent' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'agents', requireAuth: true });
export const POST = withSecurity(postHandler, { routeLabel: 'agents', requireAuth: true });

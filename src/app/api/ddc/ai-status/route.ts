import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { getLearningStats } from '@/lib/brain/conversation-learner';

export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // FASE 02B (FRENTE 10/12): DB indisponível = estado honesto 'offline'
      // com zeros — removeu demo (5 conversas, 24 hoje, patterns 87.3%).
      return NextResponse.json({
        success: true,
        data: {
          status: 'offline' as const,
          isProcessing: false,
          activeConversations: 0,
          totalToday: 0,
          averageResponseTime: 0,
          lastActivity: new Date(),
          learning: {
            totalPatterns: 0,
            verifiedPatterns: 0,
            activePatterns: 0,
            deprecatedPatterns: 0,
            overallConfidence: 0,
            totalLearned: 0,
            recentActivity: [],
          },
        },
        meta: { timestamp: new Date().toISOString(), source: 'database_unavailable', degraded: true },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeConversations, totalToday, todayLogs, lastLog, learningStats] = await Promise.all([
      db.conversationLog.count({ where: { tenantId, status: 'active' } }),
      db.conversationLog.count({ where: { tenantId, createdAt: { gte: today } } }),
      db.aIActivityLog.findMany({
        where: { tenantId, timestamp: { gte: today }, type: 'message' },
      }),
      db.aIActivityLog.findFirst({
        where: { tenantId },
        orderBy: { timestamp: 'desc' },
      }),
      getLearningStats(tenantId),
    ]);

    const averageResponseTime = todayLogs.length > 0
      ? Number((todayLogs.reduce((s, l) => s + (l.duration || 0), 0) / todayLogs.length / 1000).toFixed(1))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        status: 'online' as const,
        isProcessing: false,
        activeConversations,
        totalToday,
        averageResponseTime,
        lastActivity: lastLog?.timestamp || new Date(),
        learning: learningStats,
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('[DDC ai-status] Prisma error, returning fallback:', error);
    return NextResponse.json({
      success: true,
      data: {
        // FASE 02B: erro = 'error' honesto (antes mantinha 'online' com zeros)
        status: 'error' as const,
        isProcessing: false,
        activeConversations: 0,
        totalToday: 0,
        averageResponseTime: 0,
        lastActivity: new Date(),
        learning: {
          totalPatterns: 0,
          verifiedPatterns: 0,
          activePatterns: 0,
          deprecatedPatterns: 0,
          overallConfidence: 0,
          totalLearned: 0,
          recentActivity: [],
        },
      },
      meta: { timestamp: new Date().toISOString(), source: 'fallback-zeros', degraded: true }
    });
  }
}
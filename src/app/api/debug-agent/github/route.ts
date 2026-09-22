import { NextRequest, NextResponse } from 'next/server';
import { createError, apiSuccess } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function handler(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'debug-agent.github', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:debug-agent.github', what: 'debug-agent.github.entry', resource: 'api', result: 'ALLOW' });
  try {
    const body = await request.json();
    const { repoUrl } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return createError(400, 'MISSING_REPO_URL', 'repoUrl é obrigatório');
    }

    // SECURITY: Sanitize repoUrl to prevent SSRF
    const allowedPrefixes = ['https://github.com/', 'https://api.github.com/'];
    const normalizedUrl = repoUrl.trim();
    if (!allowedPrefixes.some(p => normalizedUrl.startsWith(p))) {
      return createError(400, 'INVALID_REPO_URL', 'Apenas repositórios GitHub são permitidos');
    }

    const repoName = normalizedUrl.split('/').slice(-2).join('/').replace('.git', '') || normalizedUrl;

    const commits = Math.floor(Math.random() * 200) + 20;
    const openPRs = Math.floor(Math.random() * 8);
    const openIssues = Math.floor(Math.random() * 15);

    return apiSuccess({
      repo: {
        name: repoName,
        url: normalizedUrl,
        commits,
        openPRs,
        openIssues,
        stars: Math.floor(Math.random() * 50),
        forks: Math.floor(Math.random() * 10),
        languages: ['TypeScript', 'JavaScript', 'Prisma'],
        branches: ['main', 'develop', `feature/${Math.random().toString(36).slice(2, 8)}`],
        lastCommit: new Date().toISOString(),
      },
    });
  } catch (error) {
    return createError(
      500,
      'GITHUB_DEBUG_FAILED',
      'Falha ao depurar GitHub',
      error instanceof Error ? error.message : undefined
    );
  }
}

export const POST = withSecurity(handler, { routeLabel: 'debug-agent-github' });
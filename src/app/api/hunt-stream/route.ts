import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
export const dynamic = 'force-dynamic';

const HUNT_STEPS = [
  {
    event: 'search_started',
    message: (target: string) => `Buscando domínios registrados para "${target}"...`,
    progress: 10,
  },
  {
    event: 'social_scan',
    message: (target: string) => `Escaneando perfis sociais de "${target}" no Instagram e Google...`,
    progress: 25,
  },
  {
    event: 'contact_extraction',
    message: (target: string) => `Extraindo contatos e decisores de "${target}"...`,
    progress: 40,
  },
  {
    event: 'enrichment',
    message: (target: string) => `Enriquecendo dados com informações de mercado para "${target}"...`,
    progress: 55,
  },
  {
    event: 'scoring',
    message: (_target: string) => 'Calculando score de validação para leads encontrados...',
    progress: 70,
  },
  {
    event: 'leads_generated',
    message: (_target: string) => 'Leads gerados e armazenados com sucesso!',
    progress: 90,
  },
  {
    event: 'hunt_complete',
    message: (target: string) => `Prospecção de "${target}" finalizada com sucesso.`,
    progress: 100,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'hunt-stream', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:hunt-stream', what: 'hunt-stream.entry', resource: 'api', result: 'ALLOW' });
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target') || 'pousada-desconhecida';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < HUNT_STEPS.length; i++) {
          const step = HUNT_STEPS[i];

          const payload = {
            event: step.event,
            message: step.message(target),
            timestamp: Date.now(),
            progress: step.progress,
            step: i + 1,
            totalSteps: HUNT_STEPS.length,
          };

          controller.enqueue(encoder.encode(formatSSE('hunt_progress', payload)));
          await sleep(800 + Math.random() * 600);
        }

        // Send a final done event
        const donePayload = {
          event: 'done',
          message: `Prospecção concluída para "${target}".`,
          timestamp: Date.now(),
          progress: 100,
        };
        controller.enqueue(encoder.encode(formatSSE('hunt_done', donePayload)));
        controller.close();
      } catch (err) {
        const errorPayload = {
          event: 'error',
          message: 'Erro durante a prospecção.',
          timestamp: Date.now(),
          progress: 0,
        };
        controller.enqueue(encoder.encode(formatSSE('hunt_error', errorPayload)));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
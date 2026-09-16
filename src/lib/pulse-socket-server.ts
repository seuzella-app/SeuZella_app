// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZCC Pulse Socket.io Server — Standalone server on port 3003
// Runs within the Next.js process via instrumentation.ts
// The frontend connects via: io("/?XTransformPort=3003")
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

// ── Types ────────────────────────────────────────────────────────────────────────

interface PulseAlert {
  id: string;
  timestamp: string;
  container: string;
  severity: 'ALTA' | 'MÉDIA' | 'BAIXA';
  title: string;
  stackTrace: string;
  arquivo_linha: string;
  impacto_usuario: string;
  causa_raiz: string;
  codigo_solucao: string;
}

interface VPSMetrics {
  cpuUsage: number;
  cpuCores: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
  loadAvg: [number, number, number];
  uptime: string;
  networkIn: number;
  networkOut: number;
  timestamp: string;
}

interface ContainerStatus {
  name: string;
  service: string;
  status: 'running' | 'stopped' | 'restarting';
  uptime: string;
  cpu: number;
  memory: number;
  port: number;
  image: string;
}

interface CommandPayload {
  type: 'clear_cache' | 'restart_agent' | 'pause_tenant' | 'force_container_restart';
  target: string;
  confirmToken?: string;
}

interface CommandResult {
  success: boolean;
  message: string;
  target: string;
  type: string;
}

interface AnalysisResult {
  alertId: string;
  container: string;
  title: string;
  analysis: {
    diagnostico: string;
    impacto: string;
    acao_recomendada: string;
    severidade_estimada: string;
    tempo_estimado_resolucao: string;
    automacao_possivel: boolean;
  };
  timestamp: string;
}

const VALID_COMMAND_TYPES: CommandPayload['type'][] = [
  'clear_cache',
  'restart_agent',
  'pause_tenant',
  'force_container_restart',
];

// FASE 02B (FRENTE 30): credencial NUNCA hardcoded nem impressa em log.
// Fonte: env ZELLA_NUCLEAR_TOKEN. Sem env, token efêmero por boot
// (operação nuclear efetivamente desabilitada até o operador configurar).
const NUCLEAR_TOKEN = process.env.ZELLA_NUCLEAR_TOKEN || require('crypto').randomBytes(24).toString('hex');
const PORT = 3003;

// ── Mock Data & Simulations ──────────────────────────────────────────────────────

let alertCounter = 0;
function generateId(): string {
  alertCounter++;
  return `PULSE-${Date.now().toString(36).toUpperCase()}-${alertCounter.toString().padStart(4, '0')}`;
}

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStackTrace(container: string): string {
  const traces = [
    `Error: ECONNREFUSED 127.0.0.1:${randomIntBetween(3000, 9000)}
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)
    at ${container}/src/services/connection-pool.ts:47:12`,
    `Error: Timeout awaiting 'request' for 30000ms
    at ${container}/src/handlers/processor.ts:128:9
    at async ${container}/src/queue/worker.ts:64:22`,
    `Error: Cannot read properties of undefined (reading 'data')
    at ${container}/src/adapters/api-adapter.ts:89:31
    at ${container}/src/middleware/parser.ts:22:15`,
    `Error: P2002: Unique constraint failed on the fields: (tenant_id, session_id)
    at PrismaClientKnownRequestError (${container}/src/repositories/session-repo.ts:34:11)`,
    `Error: RedisConnectionPool exhausted — max 50 connections reached
    at ${container}/src/cache/redis-pool.ts:92:23
    at ${container}/src/services/cache-service.ts:15:8`,
  ];
  return traces[randomIntBetween(0, traces.length - 1)];
}

function generateArquivoLinha(): string {
  const files = [
    'src/services/brain-router.ts:47', 'src/handlers/webhook-handler.ts:128',
    'src/adapters/evolution-adapter.ts:89', 'src/middleware/rate-limiter.ts:34',
    'src/queue/job-processor.ts:64', 'src/cache/semantic-cache.ts:22',
    'src/api/routes/conversations.ts:201', 'src/services/ical-sync.ts:92',
  ];
  return files[randomIntBetween(0, files.length - 1)];
}

const ALERT_TEMPLATES: Omit<PulseAlert, 'id' | 'timestamp' | 'stackTrace' | 'arquivo_linha'>[] = [
  {
    container: 'zella-brain', severity: 'ALTA',
    title: 'LLM Router timeout — fallback para modelo secundário',
    impacto_usuario: 'Respostas da IA com latência >8s para 12% dos tenants',
    causa_raiz: 'OpenAI API rate limit atingido no tier atual',
    codigo_solucao: 'ZCC-001: Implementar backoff exponencial + queue prioritária',
  },
  {
    container: 'zella-evolution', severity: 'ALTA',
    title: 'WhatsApp webhook falhou — 47 mensagens na fila DLQ',
    impacto_usuario: 'Mensagens de hóspedes sem resposta há >15 minutos',
    causa_raiz: 'Evolution API socket desconectou do WhatsApp Business',
    codigo_solucao: 'ZCC-002: Restart automático do Evolution + replay DLQ',
  },
  {
    container: 'zella-postgres', severity: 'MÉDIA',
    title: 'Query lenta detectada — p95 >2s na tabela conversations',
    impacto_usuario: 'Dashboard DDC carregando em >5s para tenants grandes',
    causa_raiz: 'Índice ausente em conversations(tenant_id, updated_at)',
    codigo_solucao: 'ZCC-003: Adicionar índice composto + VACUUM ANALYZE',
  },
  {
    container: 'zella-redis', severity: 'MÉDIA',
    title: 'Cache miss rate elevado — 34% em semantic_cache',
    impacto_usuario: 'Custo LLM 22% acima do esperado por falta de cache hit',
    causa_raiz: 'TTL do cache semântico muito baixo (5min) para padrões de consulta',
    codigo_solucao: 'ZCC-004: Ajustar TTL para 30min + warm-up de padrões frequentes',
  },
  {
    container: 'zella-app', severity: 'BAIXA',
    title: 'Memory leak suspeito — RSS crescendo 2MB/hora',
    impacto_usuario: 'Sem impacto visível ainda, mas pode causar OOM em ~72h',
    causa_raiz: 'Possível leak em event listeners do Socket.io não limpos',
    codigo_solucao: 'ZCC-005: Auditoria de cleanup em useEffect + destroy patterns',
  },
  {
    container: 'zella-bullmq', severity: 'MÉDIA',
    title: 'Job de sincronização iCal stuck — 3 propriedades desatualizadas',
    impacto_usuario: 'Disponibilidade do calendário desatualizada para 3 pousadas',
    causa_raiz: 'Worker travou ao processar resposta malformada do Google Calendar',
    codigo_solucao: 'ZCC-006: Add timeout + retry com validação de schema iCal',
  },
  {
    container: 'zella-evolution', severity: 'ALTA',
    title: 'QR Code expirado — Instância WhatsApp desconectada',
    impacto_usuario: 'Tenant "Pousada Sol Mar" sem canal WhatsApp ativo',
    causa_raiz: 'Sessão WhatsApp expirou após 7 dias sem renovação',
    codigo_solucao: 'ZCC-008: Auto-refresh QR + alerta proativo para tenant',
  },
  {
    container: 'zella-brain', severity: 'MÉDIA',
    title: 'Circuit Breaker aberto — provedor Anthropic indisponível',
    impacto_usuario: 'Roteamento forçado para OpenAI (custo +40%)',
    causa_raiz: 'Anthropic API retornando 503 intermitentemente',
    codigo_solucao: 'ZCC-009: Health check a cada 30s + half-open após 60s',
  },
  {
    container: 'zella-app', severity: 'ALTA',
    title: 'Next.js build memory spike — ISR regeneration failed',
    impacto_usuario: 'Página de preços com dados desatualizados para 8 tenants',
    causa_raiz: 'ISR revalidation queue acumulou após deploy sem drain',
    codigo_solucao: 'ZCC-010: Implementar graceful drain + ISR queue monitoring',
  },
];

const CONTAINER_TEMPLATES: ContainerStatus[] = [
  { name: 'zella-app', service: 'Next.js App', status: 'running', uptime: '14d 6h', cpu: 12, memory: 340, port: 3000, image: 'zella:latest' },
  { name: 'zella-postgres', service: 'PostgreSQL', status: 'running', uptime: '14d 6h', cpu: 4, memory: 512, port: 5432, image: 'postgres:16' },
  { name: 'zella-redis', service: 'Redis Cache', status: 'running', uptime: '14d 6h', cpu: 1, memory: 128, port: 6379, image: 'redis:7-alpine' },
  { name: 'zella-evolution', service: 'Evolution API', status: 'running', uptime: '3d 12h', cpu: 8, memory: 456, port: 8080, image: 'atticus/evolution-api:latest' },
  { name: 'zella-nginx', service: 'Nginx Reverse Proxy', status: 'running', uptime: '14d 6h', cpu: 1, memory: 64, port: 80, image: 'nginx:alpine' },
  { name: 'zella-bullmq', service: 'BullMQ Worker', status: 'running', uptime: '14d 6h', cpu: 3, memory: 96, port: 0, image: 'zella-worker:latest' },
  { name: 'zella-brain', service: 'Brain AI Router', status: 'running', uptime: '7d 2h', cpu: 15, memory: 512, port: 0, image: 'zella-brain:latest' },
];

// ── Simulated State ───────────────────────────────────────────────────────────────

let vpsState: VPSMetrics = {
  cpuUsage: 23, cpuCores: 4, ramUsed: 3.2, ramTotal: 8,
  diskUsed: 42, diskTotal: 100, loadAvg: [0.8, 0.6, 0.5],
  uptime: '14d 6h 32m', networkIn: 12.4, networkOut: 8.1,
  timestamp: new Date().toISOString(),
};

let containerState: ContainerStatus[] = [...CONTAINER_TEMPLATES];

// ── Global guard ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForIo = globalThis as any;

export function initPulseSocketServer(): SocketIOServer | null {
  if (globalForIo.__pulseInitialized) {
    return globalForIo.__pulseio ?? null;
  }

  globalForIo.__pulseInitialized = true;

  try {
    const httpServer = createServer();

    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:81',
          'http://127.0.0.1:81',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    });

    // ── Connection Handler ────────────────────────────────────────────────────

    io.on('connection', (socket) => {
      console.log(`[PulseSocket] ✓ Client connected: ${socket.id}`);

      // Send current state immediately
      socket.emit('pulse:metrics', vpsState);
      socket.emit('pulse:containers', containerState);

      // ── zcc:subscribe ─────────────────────────────────────────────────────
      socket.on('zcc:subscribe', () => {
        console.log(`[PulseSocket] 📡 Client ${socket.id} subscribed`);
        socket.emit('pulse:metrics', vpsState);
        socket.emit('pulse:containers', containerState);
      });

      // ── zcc:command ───────────────────────────────────────────────────────
      socket.on('zcc:command', (payload: CommandPayload) => {
        const { type, target, confirmToken } = payload;
        console.log(`[PulseSocket] ⚡ Command: ${type} → ${target}`);

        if (!VALID_COMMAND_TYPES.includes(type)) {
          socket.emit('command:result', {
            success: false,
            message: `Comando inválido: "${type}". Permitidos: ${VALID_COMMAND_TYPES.join(', ')}`,
            target, type,
          });
          return;
        }

        if (!target || typeof target !== 'string' || target.trim().length === 0) {
          socket.emit('command:result', {
            success: false, message: 'Target não especificado ou inválido.',
            target: target || 'undefined', type,
          });
          return;
        }

        if (type === 'force_container_restart') {
          if (confirmToken !== NUCLEAR_TOKEN) {
            socket.emit('command:result', {
              success: false,
              message: 'TOKEN INVÁLIDO. force_container_restart requer confirmToken válido. Operação NUCLEAR bloqueada.',
              target, type,
            });
            console.log(`[PulseSocket] 🔒 NUCLEAR BLOCKED from ${socket.id}`);
            return;
          }
          console.log(`[PulseSocket] ☢️ NUCLEAR AUTHORIZED for ${target}`);
        }

        const delays: Record<CommandPayload['type'], number> = {
          clear_cache: 1000, restart_agent: 2000,
          pause_tenant: 1500, force_container_restart: 3000,
        };

        const successMessages: Record<CommandPayload['type'], string> = {
          clear_cache: `Redis FLUSHDB executado para pattern "${target}" — ${randomIntBetween(120, 450)} chaves removidas`,
          restart_agent: `Agent "${target}" reiniciado — novo PID ${randomIntBetween(10000, 65535)}`,
          pause_tenant: `Kill Switch ativado — tenant "${target}" pausado. Serviços suspensos imediatamente`,
          force_container_restart: `Container "${target}" reiniciado via Docker — docker restart ${target}. Status: running`,
        };

        setTimeout(() => {
          const failed = Math.random() < 0.1;
          const result: CommandResult = failed
            ? { success: false, message: `Falha ao executar ${type} em "${target}": Operation timed out.`, target, type }
            : { success: true, message: successMessages[type], target, type };

          socket.emit('command:result', result);

          if (type === 'force_container_restart' && !failed) {
            const idx = containerState.findIndex(c => c.name === target);
            if (idx !== -1) {
              containerState[idx] = {
                ...containerState[idx], status: 'running', uptime: '0d 0h 0m',
                cpu: randomIntBetween(5, 25), memory: randomIntBetween(64, 256),
              };
              io.emit('pulse:containers', containerState);
            }
          }
        }, delays[type]);
      });

      // ── zcc:request_analysis ──────────────────────────────────────────────
      socket.on('zcc:request_analysis', (data: { alertId: string; container: string; title: string }) => {
        console.log(`[PulseSocket] 🧠 Analysis requested: ${data.alertId}`);

        setTimeout(() => {
          const analysis: AnalysisResult = {
            alertId: data.alertId, container: data.container, title: data.title,
            analysis: {
              diagnostico: `O container ${data.container} apresenta instabilidade: ${data.title.toLowerCase().split('—')[0].trim()}. Padrão de falha intermitente detectado nos últimos 30 minutos.`,
              impacto: 'Potencial cascata de falhas se não tratado em até 2 horas. Risco de degradação para tenants conectados.',
              acao_recomendada: `1) docker logs --tail 500 ${data.container}\n2) Reiniciar via ZCC Command Center\n3) Monitorar métricas por 15 min pós-intervenção`,
              severidade_estimada: data.title.includes('timeout') || data.title.includes('falhou') ? 'CRÍTICA' : 'MODERADA',
              tempo_estimado_resolucao: '15-30 minutos',
              automacao_possivel: true,
            },
            timestamp: new Date().toISOString(),
          };
          socket.emit('analysis:result', analysis);
        }, randomIntBetween(2000, 4000));
      });

      // ── Disconnect ─────────────────────────────────────────────────────────
      socket.on('disconnect', (reason) => {
        console.log(`[PulseSocket] ✗ Disconnected: ${socket.id} — ${reason}`);
      });
    });

    // ── Periodic Simulations ──────────────────────────────────────────────────

    // VPS Metrics — every 3 seconds
    const metricsInterval = setInterval(() => {
      vpsState = {
        ...vpsState,
        cpuUsage: Math.max(5, Math.min(95, vpsState.cpuUsage + (Math.random() - 0.5) * 6)),
        ramUsed: Math.max(2, Math.min(7, vpsState.ramUsed + (Math.random() - 0.5) * 0.2)),
        diskUsed: Math.max(30, Math.min(85, vpsState.diskUsed + (Math.random() - 0.5) * 0.1)),
        networkIn: Math.max(3, vpsState.networkIn + (Math.random() - 0.5) * 4),
        networkOut: Math.max(2, vpsState.networkOut + (Math.random() - 0.5) * 3),
        loadAvg: [
          Math.max(0.1, Math.min(4, vpsState.loadAvg[0] + (Math.random() - 0.5) * 0.3)),
          Math.max(0.1, Math.min(3, vpsState.loadAvg[1] + (Math.random() - 0.5) * 0.2)),
          Math.max(0.1, Math.min(2.5, vpsState.loadAvg[2] + (Math.random() - 0.5) * 0.15)),
        ] as [number, number, number],
        timestamp: new Date().toISOString(),
      };
      io.emit('pulse:metrics', vpsState);
    }, 3000);

    // Container Status — every 5 seconds
    const containerInterval = setInterval(() => {
      containerState = containerState.map(c => {
        let newStatus = c.status;
        if (c.name === 'zella-evolution' && Math.random() < 0.05) {
          newStatus = c.status === 'running' ? 'restarting' : 'running';
        }
        return {
          ...c, status: newStatus,
          cpu: Math.max(0, Math.min(100, c.cpu + Math.round((Math.random() - 0.5) * 6))),
          memory: Math.max(32, c.memory + Math.round((Math.random() - 0.5) * 24)),
        };
      });
      io.emit('pulse:containers', containerState);
    }, 5000);

    // Error Alerts — every 15-25 seconds
    function scheduleNextAlert() {
      const interval = randomIntBetween(15000, 25000);
      setTimeout(() => {
        const template = ALERT_TEMPLATES[randomIntBetween(0, ALERT_TEMPLATES.length - 1)];
        const alert: PulseAlert = {
          id: generateId(), timestamp: new Date().toISOString(),
          container: template.container, severity: template.severity, title: template.title,
          stackTrace: generateStackTrace(template.container),
          arquivo_linha: generateArquivoLinha(),
          impacto_usuario: template.impacto_usuario, causa_raiz: template.causa_raiz,
          codigo_solucao: template.codigo_solucao,
        };
        console.log(`[PulseSocket] 🚨 Alert: [${alert.severity}] ${alert.title}`);
        io.emit('pulse:alert', alert);
        scheduleNextAlert();
      }, interval);
    }
    scheduleNextAlert();

    // Start listening
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  ⚡ ZCC PULSE SOCKET — Zélla Central Control');
      console.log(`  🌐 Listening on port ${PORT}`);
      // FASE 02B: token mascarado no boot (antes: impresso em texto puro)
      console.log(`  🔒 Nuclear token: ${NUCLEAR_TOKEN.slice(0, 4)}**** (defina ZELLA_NUCLEAR_TOKEN; valor completo nunca é logado)`);
      console.log('  📊 Metrics: 3s | Alerts: 15-25s | Containers: 5s');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });

    httpServer.on('close', () => {
      clearInterval(metricsInterval);
      clearInterval(containerInterval);
    });

    globalForIo.__pulseio = io;
    return io;
  } catch (err) {
    console.error('[PulseSocket] Failed to initialize:', err);
    return null;
  }
}

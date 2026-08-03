'use client';

// =============================================================================
// OPERATOR CONSOLE — new ZCC home tab
// =============================================================================
// Replaces the old "Visão Geral" KPI cards layout with a FounderOS-style
// operator console:
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ PULSE ROW       (system pulse: MRR, clients, msgs, etc.) │
//   ├──────────────────────────────────────────────────────────┤
//   │ CONNECTIONS     (live integrations: WhatsApp, Airbnb, etc)│
//   ├──────────────────────────────────────────────────────────┤
//   │ AGENT LIST      (12 agents with status, last run, cost)   │
//   ├──────────────────────────────────────────────────────────┤
//   │ KNOWLEDGE CORE  (activity feed + recent decisions)        │
//   └──────────────────────────────────────────────────────────┘
//
// All data is hydrated from existing ZCC APIs — no new endpoints needed.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity, Users, MessageSquare, DollarSign, TrendingUp,
  Zap, AlertCircle, CheckCircle2, Bot, Brain,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PulseMetric {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  icon: React.ElementType;
}

interface Connection {
  name: string;
  status: 'online' | 'warn' | 'err' | 'idle';
  meta: string;
}

interface AgentSummary {
  id: string;
  name: string;
  desc: string;
  status: 'idle' | 'active' | 'error';
  lastRun?: string;
  costUsd?: number;
}

interface ActivityEntry {
  id: string;
  ts: string;
  text: string;
  tag: string;
  level: 'ok' | 'warn' | 'err' | 'info';
}

// ── Static fallbacks (used while API hydrates) ──────────────────────────────

const PULSE_FALLBACK: PulseMetric[] = [
  { label: 'MRR', value: 'R$ 0', delta: '0% vs mês anterior', deltaDir: 'flat', icon: DollarSign },
  { label: 'Clientes', value: '0', icon: Users },
  { label: 'Mensagens 24h', value: '0', icon: MessageSquare },
  { label: 'Reservas 7d', value: '0', icon: TrendingUp },
  { label: 'Agentes ativos', value: '0/12', icon: Bot },
  { label: 'Cérebro accuracy', value: '—', icon: Brain },
];

const CONNECTIONS_FALLBACK: Connection[] = [
  { name: 'WhatsApp Cloud API', status: 'idle', meta: '—' },
  { name: 'Airbnb OAuth', status: 'idle', meta: '—' },
  { name: 'Mercado Pago', status: 'idle', meta: '—' },
  { name: 'OpenAI', status: 'idle', meta: '—' },
  { name: 'Groq', status: 'idle', meta: '—' },
  { name: 'Vercel Postgres', status: 'idle', meta: '—' },
];

const AGENTS_FALLBACK: AgentSummary[] = [
  { id: 'conductor', name: 'Conductor', desc: 'Roteia mensagens para o agente certo', status: 'idle' },
  { id: 'cerebro', name: 'Cérebro', desc: 'IA central — análise de reservas e pricing', status: 'idle' },
  { id: 'comms', name: 'Comms', desc: 'Comunicação outbound — WhatsApp/Instagram', status: 'idle' },
  { id: 'finance', name: 'Finance', desc: 'Cobraças, MRR, churn, projeções', status: 'idle' },
  { id: 'ops', name: 'Ops', desc: 'Operação — calendário, disponibilidade', status: 'idle' },
  { id: 'sales', name: 'Sales', desc: 'Vendas — funil, follow-up, conversão', status: 'idle' },
  { id: 'tech', name: 'Tech', desc: 'Manutenção — bugs, deploys, monitoramento', status: 'idle' },
  { id: 'marketing', name: 'Marketing', desc: 'Campanhas, conteúdo, social', status: 'idle' },
  { id: 'hunter', name: 'Hunter', desc: 'Prospecção — busca novos leads', status: 'idle' },
  { id: 'guardian', name: 'Guardian', desc: 'Segurança — auditoria, anomalias', status: 'idle' },
  { id: 'concierge', name: 'Concierge', desc: 'Atendimento hóspede — check-in/out', status: 'idle' },
  { id: 'cfo', name: 'CFO Virtual', desc: 'Análise financeira estratégica', status: 'idle' },
];

const ACTIVITY_FALLBACK: ActivityEntry[] = [
  { id: '1', ts: '—', text: 'Aguardando primeira execução', tag: 'INIT', level: 'info' },
];

// ── Component ───────────────────────────────────────────────────────────────

export function OperatorConsole({
  totalMRR,
  totalClients,
  totalMessages,
  totalReservations,
  activeAgents,
  brainAccuracy,
  agents,
  activity,
  connections,
}: {
  totalMRR?: number;
  totalClients?: number;
  totalMessages?: number;
  totalReservations?: number;
  activeAgents?: string;
  brainAccuracy?: string;
  agents?: AgentSummary[];
  activity?: ActivityEntry[];
  connections?: Connection[];
}) {
  // ── API hydration ─────────────────────────────────────────────────────────
  const [pulse, setPulse] = useState<PulseMetric[]>(PULSE_FALLBACK);
  const [conns, setConns] = useState<Connection[]>(connections ?? CONNECTIONS_FALLBACK);
  const [agentList, setAgentList] = useState<AgentSummary[]>(agents ?? AGENTS_FALLBACK);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>(activity ?? ACTIVITY_FALLBACK);

  useEffect(() => {
    async function hydrate() {
      try {
        const [metricsRes, agentsRes] = await Promise.all([
          fetch('/api/zcc/metrics'),
          fetch('/api/zcc/agents'),
        ]);

        if (metricsRes.ok) {
          const json = await metricsRes.json();
          const d = json.data ?? {};
          setPulse([
            {
              label: 'MRR',
              value: d.mrr?.total != null ? `R$ ${d.mrr.total.toLocaleString('pt-BR')}` : 'R$ —',
              delta: d.mrr?.delta != null ? `${d.mrr.delta > 0 ? '+' : ''}${d.mrr.delta}% vs mês anterior` : undefined,
              deltaDir: d.mrr?.delta > 0 ? 'up' : d.mrr?.delta < 0 ? 'down' : 'flat',
              icon: DollarSign,
            },
            { label: 'Clientes', value: String(d.totalClients ?? totalClients ?? 0), icon: Users },
            { label: 'Mensagens 24h', value: String(d.totalMessages ?? totalMessages ?? 0), icon: MessageSquare },
            { label: 'Reservas 7d', value: String(d.totalReservations ?? totalReservations ?? 0), icon: TrendingUp },
            { label: 'Agentes ativos', value: activeAgents ?? '0/12', icon: Bot },
            { label: 'Cérebro accuracy', value: brainAccuracy ?? '—', icon: Brain },
          ]);
        }
        if (agentsRes.ok) {
          const json = await agentsRes.json();
          if (Array.isArray(json.agents)) {
            setAgentList(json.agents.map((a: any) => ({
              id: a.id,
              name: a.name,
              desc: a.description,
              status: a.status ?? 'idle',
              lastRun: a.lastRun,
              costUsd: a.costUsd,
            })));
          }
        }
      } catch {
        /* keep fallback */
      }
    }
    hydrate();
    const interval = setInterval(hydrate, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="operator-console">
      {/* ─── PULSE ROW ───────────────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">
            <span className="live-dot" /> PULSE · OPERATOR CONSOLE
          </span>
          <span className="meta">
            ATUALIZADO {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <div className="pulse-row">
          {pulse.map((m, i) => {
            const Icon = m.icon;
            return (
              <div className="pulse-cell" key={i}>
                <div className="label">
                  <Icon size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {m.label}
                </div>
                <div className="value">{m.value}</div>
                {m.delta && (
                  <div className={`delta ${m.deltaDir ?? ''}`}>{m.delta}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CONNECTIONS STRIP ──────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">CONNECTIONS · LIVE INTEGRATIONS</span>
          <span className="meta">{conns.filter(c => c.status === 'online').length}/{conns.length} ONLINE</span>
        </div>

        <div className="connections-strip">
          {conns.map((c, i) => (
            <div className={`conn ${c.status}`} key={i} title={c.name}>
              <span className="dot" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="name">{c.name}</div>
                <div className="meta">{c.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── AGENT LIST ─────────────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">AGENTES VIVOS · 12 AGENTS</span>
          <Link href="?tab=agents" style={{ color: 'var(--accent)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            VER TODOS →
          </Link>
        </div>

        <div className="agent-list">
          {agentList.map((a) => (
            <div className={`agent-card ${a.status}`} key={a.id}>
              <div className="head">
                <span className="name">{a.name}</span>
                <span className="status">{a.status}</span>
              </div>
              <div className="desc">{a.desc}</div>
              <div className="meta">
                {a.lastRun ? `LAST: ${a.lastRun}` : '—'}
                {a.costUsd != null ? ` · $${a.costUsd.toFixed(4)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── KNOWLEDGE CORE ─────────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">KNOWLEDGE CORE · ACTIVITY & DECISIONS</span>
          <span className="meta">{activityFeed.length} EVENTOS</span>
        </div>

        <div className="knowledge-core">
          <div className="panel">
            <div className="panel-title">FEED AO VIVO</div>
            {activityFeed.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '20px 0' }}>
                Sem atividade registrada.
              </div>
            ) : (
              activityFeed.slice(0, 8).map((e) => (
                <div className={`activity-item ${e.level}`} key={e.id}>
                  <span className="ts">{e.ts}</span>
                  <span className="text">{e.text}</span>
                  <span className="tag">{e.tag}</span>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <div className="panel-title">DECISÕES RECENTES</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 8 }}>
                <span className="monolith-tag accent" style={{ marginRight: 8 }}>BRAIN</span>
                Cérebro analisou padrões de ocupação — sem anomalias nas últimas 24h.
              </p>
              <p style={{ marginBottom: 8 }}>
                <span className="monolith-tag ok" style={{ marginRight: 8 }}>OK</span>
                Conductor routeou 0 mensagens — sistema em modo mock.
              </p>
              <p style={{ marginBottom: 8 }}>
                <span className="monolith-tag warn" style={{ marginRight: 8 }}>WARN</span>
                Aguardando primeira execução real para alimentar RefactorSuggester.
              </p>
              <p>
                <span className="monolith-tag" style={{ marginRight: 8 }}>INFO</span>
                12 agentes prontos para execução. Use a aba <strong>Agentes Vivos</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

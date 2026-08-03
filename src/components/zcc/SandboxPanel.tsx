'use client';

// ============================================================================
// Z-LAB — SandboxPanel (UI com logs ao vivo)
// ============================================================================
// Painel visual no ZCC para acionar simulações do Z-Lab.
//
// Funcionalidades:
//  - Seletor de persona, niche, plano
//  - Botões: Run Single, Run Battery, Cleanup All
//  - Terminal de logs ao vivo (console-style)
//  - Métricas: latência, custo Meta, mensagens enviadas
//  - Lista de test tenants existentes com botão de cleanup individual
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Play, Trash2, Users, Zap, CheckCircle,
  XCircle, Clock, DollarSign, RefreshCw, Terminal,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface Persona {
  id: string;
  name: string;
  niche: 'pousada' | 'airbnb';
  category: 'normal' | 'security_test';
  description: string;
  expectedBehavior: string;
  messagesCount: number;
}

interface TestTenant {
  id: string;
  name: string;
  niche: string;
  plan: string;
  whatsappPhoneNumber: string | null;
  createdAt: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface SimulationMetrics {
  totalDurationMs: number;
  messagesSent: number;
  messagesSucceeded: number;
  messagesFailed: number;
  totalMetaCostUsd: number;
  avgResponseMs: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function personaColor(category: string): string {
  return category === 'security_test' ? '#ef4444' : '#10b981';
}

function personaEmoji(category: string): string {
  return category === 'security_test' ? '🛡️' : '👤';
}

// ── Component ───────────────────────────────────────────────────────────────

export function SandboxPanel() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [testTenants, setTestTenants] = useState<TestTenant[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('dona-sonia');
  const [selectedNiche, setSelectedNiche] = useState<'pousada' | 'airbnb'>('pousada');
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch initial data ──
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/sandbox');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPersonas(data.data.personas);
          setTestTenants(data.data.testTenants);
        }
      }
    } catch (err) {
      console.error('[SandboxPanel] fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Log helper ──
  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      level,
      message,
    }]);
  }, []);

  // ── Actions ──

  const runSingle = async (): Promise<void> => {
    setActionLoading('run');
    setLogs([]);
    setMetrics(null);
    addLog('info', `Iniciando simulação: ${selectedPersona} | ${selectedNiche} | ${selectedPlan}`);

    try {
      const res = await fetch('/api/zcc/sandbox?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: selectedNiche,
          plan: selectedPlan,
          personaId: selectedPersona,
          messageDelayMs: 1000,
          skipCheckout: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const report = data.report;
        addLog('success', `✓ Simulação ${report.passed ? 'APROVADA' : 'REPROVADA'}`);
        addLog('info', `Tenant: ${report.tenantName} (${report.tenantId})`);
        addLog('info', `WhatsApp: ${report.whatsappNumber}`);

        for (const step of report.steps) {
          addLog(step.success ? 'success' : 'error',
            `${step.success ? '✓' : '✗'} ${step.step} (${step.durationMs}ms)${step.error ? ' — ' + step.error : ''}`
          );
        }

        for (const msg of report.messageResults) {
          addLog(msg.webhookStatus === 200 ? 'success' : 'error',
            `  [${msg.personaName}] Msg ${msg.messageIndex + 1}: "${msg.messageContent.substring(0, 40)}..." → ${msg.webhookStatus} (${msg.durationMs}ms)`
          );
        }

        addLog('info', `Cleanup: ${report.cleanupResult.success ? '✓ removido' : '✗ falhou'}`);
        addLog('info', `Total: ${report.metrics.totalDurationMs}ms | Custo: $${report.metrics.totalMetaCostUsd.toFixed(4)}`);

        setMetrics(report.metrics);
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      await fetchData();
    }
  };

  const runBattery = async (): Promise<void> => {
    setActionLoading('battery');
    setLogs([]);
    setMetrics(null);
    addLog('info', 'Iniciando bateria completa de testes...');

    try {
      const res = await fetch('/api/zcc/sandbox?action=battery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.success) {
        addLog('success', `✓ Bateria completa: ${data.summary.passed}/${data.summary.total} aprovadas`);
        addLog('info', `Duração total: ${data.summary.totalDurationMs}ms`);
        addLog('info', `Custo Meta total: $${data.summary.totalMetaCostUsd.toFixed(4)}`);

        for (const report of data.reports) {
          addLog(report.passed ? 'success' : 'error',
            `  ${report.passed ? '✓' : '✗'} ${report.personaId} — ${report.metrics.messagesSent} msgs, ${report.metrics.avgResponseMs}ms avg`
          );
        }
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      await fetchData();
    }
  };

  const cleanupAll = async (): Promise<void> => {
    if (!confirm(`Remover TODOS os ${testTenants.length} tenant(s) de teste?`)) return;

    setActionLoading('cleanup');
    addLog('warn', `Removendo ${testTenants.length} tenant(s) de teste...`);

    try {
      const res = await fetch('/api/zcc/sandbox?action=cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.success) {
        addLog('success', `✓ ${data.deleted} tenant(s) removido(s)`);
        if (data.errors.length > 0) {
          addLog('warn', `${data.errors.length} erro(s) durante cleanup`);
        }
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      await fetchData();
    }
  };

  // ── ZERAR TUDO: remove TODOS os dados de TODOS os módulos ──
  const resetAllData = async (): Promise<void> => {
    if (!confirm('⚠️ ZERAR TUDO? Isso remove TODOS os dados de TODOS os módulos (DDC + ZCC + Cérebro). Continuar?')) return;
    setActionLoading('reset');
    setLogs([]);
    addLog('warn', 'ZERANDO TODOS OS MÓDULOS — removendo todos os dados...');

    try {
      const res = await fetch('/api/zcc/sandbox?action=reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        addLog('success', `✓ RESET COMPLETO — ${data.totalDeleted} registros removidos`);
        if (data.breakdown) {
          for (const [table, count] of Object.entries(data.breakdown) as [string, number][]) {
            if (count > 0) addLog('info', `  ${table}: ${count} removidos`);
          }
        }
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      await fetchData();
    }
  };

  // ── POPULAR DADOS: cria dados realistas em todos os painéis ──
  const populateData = async (): Promise<void> => {
    setActionLoading('populate');
    setLogs([]);
    addLog('info', 'POPULANDO DADOS — criando tenants, conversas, reservas, telemetria e ativando Cérebro...');

    try {
      const res = await fetch('/api/zcc/sandbox?action=populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        addLog('success', `✓ POPULATE COMPLETO em ${d.durationMs}ms`);
        addLog('info', `🏨 Pousadas: ${d.pousadas} | 🏠 Airbnbs: ${d.airbnbs}`);
        addLog('info', `📱 Conversas: ${d.conversations} | 💬 Mensagens: ${d.messages}`);
        addLog('info', `🎯 Reservas: ${d.bookings} | 💰 Custo Meta: $${d.metaCostUsd}`);
        addLog('warn', `🧠 Cérebro: ${d.anomalies} anomalias + ${d.analyses} análises + ${d.alerts} alertas + ${d.refactors} refactor`);
        addLog('success', '→ Dados disponíveis em DDC Pousada, DDC Airbnb e ZCC!');
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      await fetchData();
    }
  };

  const cleanupOne = async (tenantId: string, tenantName: string): Promise<void> => {
    try {
      const res = await fetch('/api/zcc/sandbox?action=cleanup-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      const data = await res.json();

      if (data.success) {
        addLog('success', `✓ ${tenantName} removido`);
      } else {
        addLog('error', `Erro: ${data.error}`);
      }
    } catch (err) {
      addLog('error', `Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await fetchData();
    }
  };

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ===== HEADER ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="zcc-panel p-5"
        style={{ borderColor: '#a855f7', borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" style={{ color: '#a855f7' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
              Z-Lab — Simulation & Training Harness
            </h3>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(168,85,247,0.15)',
                color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              ISOLATED SANDBOX
            </span>
          </div>
        </div>

        {/* ── Guia Didático do Sandbox ── */}
        <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-md text-xs space-y-2 mb-4">
          <div className="font-bold text-purple-300 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <span>Como Usar o Sandbox & O que Ele Faz:</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            O **Sandbox Z-Lab** é o laboratório de testes em tempo real do Seu Zélla. Ele permite simular conversas de hóspedes sintéticos (hóspede amigável, ansioso, teste de segurança contra hackers ou dúvidas de check-in) e avaliar como a Zélla responde **sem enviar mensagens reais no WhatsApp** e **sem gastar créditos de clientes de verdade**.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-purple-200">
            <div className="p-2 bg-black/40 border border-purple-500/20 rounded">
              <strong>1. Selecione a Persona:</strong> Escolha o comportamento do hóspede sintético.
            </div>
            <div className="p-2 bg-black/40 border border-purple-500/20 rounded">
              <strong>2. Escolha o Nicho:</strong> Pousada (check-in/refeições) ou Airbnb (regras/PINs).
            </div>
            <div className="p-2 bg-black/40 border border-purple-500/20 rounded">
              <strong>3. Clique em Run Single:</strong> Acompanhe o log ao vivo e o tempo de resposta da IA.
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-medium transition-all"
            style={{
              background: 'rgba(168,85,247,0.08)',
              color: '#a855f7',
              border: '1px solid rgba(168,85,247,0.2)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </button>
        </div>

        {/* Metrics summary */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            <MetricCard label="DURAÇÃO" value={`${metrics.totalDurationMs}ms`} icon={<Clock className="w-3 h-3" />} color="#a855f7" />
            <MetricCard label="ENVIADAS" value={metrics.messagesSent.toString()} icon={<Zap className="w-3 h-3" />} color="#3b82f6" />
            <MetricCard label="SUCESSO" value={metrics.messagesSucceeded.toString()} icon={<CheckCircle className="w-3 h-3" />} color="#10b981" />
            <MetricCard label="FALHAS" value={metrics.messagesFailed.toString()} icon={<XCircle className="w-3 h-3" />} color="#ef4444" />
            <MetricCard label="CUSTO META" value={`$${metrics.totalMetaCostUsd.toFixed(4)}`} icon={<DollarSign className="w-3 h-3" />} color="#d4a843" />
            <MetricCard label="LATÊNCIA AVG" value={`${metrics.avgResponseMs}ms`} icon={<Clock className="w-3 h-3" />} color="#6366f1" />
          </div>
        )}

        {/* Config + Actions */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Niche selector */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--zcc-text-muted)' }}>
              Nicho
            </label>
            <select
              value={selectedNiche}
              onChange={e => setSelectedNiche(e.target.value as 'pousada' | 'airbnb')}
              className="bg-transparent text-xs px-3 py-1.5 rounded font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--zcc-text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="pousada">Pousada</option>
              <option value="airbnb">Airbnb</option>
            </select>
          </div>

          {/* Plan selector */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--zcc-text-muted)' }}>
              Plano
            </label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="bg-transparent text-xs px-3 py-1.5 rounded font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--zcc-text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="gratuito">Gratuito</option>
              <option value="lite">LITE</option>
              <option value="pro">PRO</option>
              <option value="max">MAX</option>
              <option value="parceiro">Parceiro</option>
            </select>
          </div>

          {/* Persona selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--zcc-text-muted)' }}>
              Persona
            </label>
            <select
              value={selectedPersona}
              onChange={e => setSelectedPersona(e.target.value)}
              className="bg-transparent text-xs px-3 py-1.5 rounded font-mono w-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--zcc-text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {personaEmoji(p.category)} {p.name} ({p.niche})
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <button
            onClick={runSingle}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: actionLoading === 'run' ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168,85,247,0.4)',
              cursor: actionLoading ? 'wait' : 'pointer',
              opacity: actionLoading && actionLoading !== 'run' ? 0.5 : 1,
            }}
          >
            {actionLoading === 'run' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run Single
          </button>
          <button
            onClick={runBattery}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#6366f1',
              border: '1px solid rgba(99,102,241,0.4)',
              cursor: actionLoading ? 'wait' : 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading === 'battery' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Run Battery
          </button>
          {testTenants.length > 0 && (
            <button
              onClick={cleanupAll}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.4)',
                cursor: actionLoading ? 'wait' : 'pointer',
                opacity: actionLoading ? 0.5 : 1,
              }}
            >
              <Trash2 className="w-3 h-3" />
              Cleanup All ({testTenants.length})
            </button>
          )}

          {/* RESET + POPULATE — zera e popula todos os módulos */}
          <button
            onClick={resetAllData}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: 'rgba(239,68,68,0.2)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.5)',
              cursor: actionLoading ? 'wait' : 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading === 'reset' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            ZERAR TUDO
          </button>
          <button
            onClick={populateData}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: 'rgba(16,185,129,0.2)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.5)',
              cursor: actionLoading ? 'wait' : 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading === 'populate' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            POPULAR DADOS
          </button>
        </div>
      </motion.div>

      {/* ===== MAIN GRID: Personas + Logs ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Personas List ── */}
        <div className="zcc-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
              Personas Sintéticas
            </h4>
          </div>

          <div className="space-y-2">
            {personas.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded p-3"
                style={{
                  background: selectedPersona === p.id ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid ${personaColor(p.category)}`,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPersona(p.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{personaEmoji(p.category)}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                      {p.name}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
                      style={{
                        background: p.niche === 'pousada' ? 'rgba(212,168,67,0.1)' : 'rgba(74,154,154,0.1)',
                        color: p.niche === 'pousada' ? 'var(--zcc-kinpaku)' : 'var(--zcc-patina)',
                      }}
                    >
                      {p.niche}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                    {p.messagesCount} msgs
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--zcc-text-secondary)' }}>
                  {p.description}
                </p>
                <p className="text-[9px] font-mono mt-1" style={{ color: 'var(--zcc-text-muted)' }}>
                  Esperado: {p.expectedBehavior}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Live Logs Terminal ── */}
        <div className="zcc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
                Terminal de Logs
              </h4>
            </div>
            {actionLoading && (
              <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--zcc-kinpaku)' }} />
            )}
          </div>

          <div
            className="rounded p-3 font-mono text-[10px] max-h-[400px] overflow-y-auto"
            style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {logs.length === 0 ? (
              <div style={{ color: 'var(--zcc-text-muted)' }}>
                $ Aguardando simulação... Clique em "Run Single" ou "Run Battery"
              </div>
            ) : (
              <AnimatePresence>
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-0.5"
                  >
                    <span style={{ color: 'var(--zcc-text-muted)' }}>
                      [{new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}]
                    </span>{' '}
                    <span style={{
                      color: log.level === 'success' ? '#10b981'
                        : log.level === 'error' ? '#ef4444'
                        : log.level === 'warn' ? '#f59e0b'
                        : '#3b82f6'
                    }}>
                      {log.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ===== TEST TENANTS LIST ===== */}
      {testTenants.length > 0 && (
        <div className="zcc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
                Tenants de Teste Ativos ({testTenants.length})
              </h4>
            </div>
          </div>

          <div className="space-y-1">
            {testTenants.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span style={{ color: 'var(--zcc-champagne)' }}>{t.name}</span>
                  <span style={{ color: 'var(--zcc-text-muted)' }}>| {t.niche} | {t.plan}</span>
                  <span style={{ color: 'var(--zcc-text-muted)' }}>| {t.whatsappPhoneNumber || 'N/A'}</span>
                  <span style={{ color: 'var(--zcc-text-muted)' }}>
                    | criado: {new Date(t.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <button
                  onClick={() => cleanupOne(t.id, t.name)}
                  className="p-1 rounded transition-colors"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                    cursor: 'pointer',
                  }}
                  title="Remover"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-[9px] font-mono py-2" style={{ color: 'var(--zcc-text-muted)' }}>
        Z-Lab cria tenants com isTestTenant=true · Cleanup remove todos os dados relacionados · Custos Meta são simulados ($0.0068/msg)
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--zcc-text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-sm font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

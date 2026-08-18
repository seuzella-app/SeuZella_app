"use client";

/**
 * NightAuditCard — Card exclusivo para "Sala de Guerra" (ZCC > Visão Geral)
 * ========================================================================
 *
 * Mostra o relatório noturno gerado às 03:00 BRT pelo cron
 * /api/cron/cerebro-night-audit usando GLM 5.2.
 *
 * O operador do ZCC abre o painel pela manhã e vê:
 *   - Status: completed/running/failed
 *   - Severity colorida (info/warning/critical/emergency)
 *   - Resumo executivo (1-3 parágrafos PT-BR gerados pelo LLM)
 *   - Contadores de vulnerabilidades (critical/high/medium/low/info)
 *   - Métricas do dia: leads, convertidos, cliques, dispositivos
 *   - Top 5 recomendações do LLM
 *   - Top 3 riscos detectados
 *   - Custo USD do LLM (transparência)
 *
 * Ações:
 *   - Botão "Atualizar" (re-executa audit agora — usa CEREBRO_LIVE_MODE)
 *   - Botão "Ver detalhes" (abre modal com vulnFindings completo)
 *
 * Quando não há banco (deploy inicial): mostra empty state explicativo.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Moon,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  MapPin,
  Users,
  Smartphone,
  Sparkles,
  ChevronRight,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Tipos (espelham NightAuditResult do service) ──

interface VulnFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  cwe?: string;
}

interface DayMetrics {
  leadsCaptured: number;
  leadsConverted: number;
  conversionRate: number;
  clicks: number;
  regions: Array<{ uf: string; count: number }>;
  cities: Array<{ cidade: string; uf: string; count: number }>;
  pousadasConverted: Array<{ nome: string; cidade: string; uf: string; plano: string }>;
  devicesMobile: number;
  devicesDesktop: number;
  totalActiveTenants: number;
}

interface NightAuditReport {
  auditDate: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  status: "running" | "completed" | "failed" | "partial";
  summary: string;
  severity: "info" | "warning" | "critical" | "emergency";
  confidence: number;
  vulnFindings: VulnFinding[];
  vulnCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  // NOVO: Pentest findings consolidados (do Grande Run #1)
  pentestFindings?: PentestFinding[];
  pentestStats?: {
    total: number;
    newlyDetected: number;
    persisting: number;
    resolvedLast7d: number;
  };
  // NOVO: Atividade suspeita rastreada em 4 superfícies
  activityEvents?: ActivityEvent[];
  activityStats?: {
    landing_page: { anomalies: number; severity: string };
    ddc: { anomalies: number; severity: string };
    linkinbio: { anomalies: number; severity: string };
    zella_parceiros: { anomalies: number; severity: string };
  };
  metrics: DayMetrics;
  llmAnalysis: {
    recommendations: string[];
    risks: string[];
    opportunities: string[];
  };
  llmTokensInput: number;
  llmTokensOutput: number;
  llmCostUsd: number;
  mode: "mock" | "live";
  errorMessage?: string;
}

// NOVO: Tipos para pentest findings (espelham PentestFinding do service)
interface PentestFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  cwe?: string;
  detectionSource: "sast" | "pentest" | "npm_audit" | "pulse_mini_scan";
  httpRequest?: string;
}

// NOVO: Tipos para activity events (4 superfícies)
interface ActivityEvent {
  surface: "landing_page" | "ddc" | "linkinbio" | "zella_parceiros";
  eventType: string;
  severity: "info" | "warning" | "critical";
  details: any;
  affectedCount: number;
  thresholdValue: number;
  observedValue: number;
}

// NOVO: Tipos para pulsos (do NightPulseService)
interface PulseLog {
  pulseType: "heartbeat" | "mini_scan" | "metrics_snapshot";
  startedAt: string;
  durationMs: number;
  status: "ok" | "warning" | "critical" | "failed";
  resultJson: string;
  triggeredAlert: boolean;
  alertMessage?: string;
  mode: "mock" | "live";
}

export function NightAuditCard() {
  const [report, setReport] = React.useState<NightAuditReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/zcc/night-audit", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReport(json.report ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Falha ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRerun = async () => {
    try {
      setRunning(true);
      toast.info("🌙 Executando Night Audit agora...", {
        description: "Pode levar até 2 min (varredura de código + GLM 5.2)",
      });
      const res = await fetch("/api/zcc/night-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok) {
        setReport(json.report);
        toast.success("✅ Night Audit concluído", {
          description: json.report?.severity === "critical"
            ? "Vulnerabilidades críticas encontradas — verifique o card"
            : `${json.report?.vulnFindings.length ?? 0} vulnerabilidades detectadas`,
        });
      } else {
        throw new Error(json.error ?? "Falha desconhecida");
      }
    } catch (err: any) {
      toast.error("❌ Night Audit falhou", {
        description: err?.message ?? "Erro desconhecido",
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Carregando relatório noturno...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error && !report) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-700">
            {error} — execute a migration para criar a tabela.
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    // Empty state — ainda não rodou nenhum audit
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Moon className="size-4 text-primary" />
            Relatório Noturno
            <Badge variant="outline" className="text-[9px] ml-auto">Pendente</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Nenhum relatório noturno executado ainda. O primeiro audit roda
            automaticamente às <strong>03:00 BRT</strong> via cron, ou você pode
            executar manualmente agora:
          </p>
          <button
            onClick={handleRerun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Executar Audit Agora
          </button>
        </CardContent>
      </Card>
    );
  }

  const severityStyle = SEVERITY_STYLES[report.severity] ?? SEVERITY_STYLES.info;
  const totalVulns = report.vulnFindings.length;
  const durationSec = Math.round(report.durationMs / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border-2 ${severityStyle.border} ${severityStyle.bg} overflow-hidden`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Moon className={`size-4 ${severityStyle.text}`} />
              Relatório Noturno — {formatDate(report.auditDate)}
              <Badge className={`ml-2 ${severityStyle.badge}`}>
                {severityStyle.label}
              </Badge>
              {report.mode === "mock" && (
                <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/50">
                  MOCK
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {report.status === "running" && (
                <Loader2 className="size-3 animate-spin text-primary" />
              )}
              {report.status === "completed" && (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              )}
              {report.status === "failed" && (
                <AlertCircle className="size-3.5 text-rose-500" />
              )}
              <button
                onClick={handleRerun}
                disabled={running}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold hover:bg-secondary disabled:opacity-50"
              >
                {running ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                {running ? "Executando..." : "Atualizar"}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* ── RESUMO EXECUTIVO ── */}
          <div className={`rounded-md border ${severityStyle.border} bg-card/60 p-3`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Resumo Executivo (GLM 5.2)
            </p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {report.summary}
            </p>
            {report.confidence > 0 && (
              <p className="mt-2 text-[9px] text-muted-foreground">
                Confidence: {(report.confidence * 100).toFixed(0)}% ·
                Duração: {durationSec}s ·
                Custo LLM: ${report.llmCostUsd.toFixed(4)} ·
                Tokens: {report.llmTokensInput}→{report.llmTokensOutput}
              </p>
            )}
          </div>

          {/* ── VULNERABILIDADES POR SEVERIDADE ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShieldAlert className="size-3" />
              Vulnerabilidades no Código
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              <VulnCounter
                count={report.vulnCounts.critical}
                label="Critical"
                color="bg-rose-500"
                textColor="text-rose-100"
              />
              <VulnCounter
                count={report.vulnCounts.high}
                label="High"
                color="bg-orange-500"
                textColor="text-orange-100"
              />
              <VulnCounter
                count={report.vulnCounts.medium}
                label="Medium"
                color="bg-amber-500"
                textColor="text-amber-100"
              />
              <VulnCounter
                count={report.vulnCounts.low}
                label="Low"
                color="bg-blue-500"
                textColor="text-blue-100"
              />
              <VulnCounter
                count={report.vulnCounts.info}
                label="Info"
                color="bg-slate-500"
                textColor="text-slate-100"
              />
            </div>
            {totalVulns > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="mt-1.5 text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <ChevronRight className={`size-3 transition-transform ${showDetails ? "rotate-90" : ""}`} />
                {showDetails ? "Ocultar" : "Ver"} {totalVulns} vulnerabilidades
              </button>
            )}
          </div>

          {/* ── DETALHES DAS VULNERABILIDADES (expandível) ── */}
          {showDetails && report.vulnFindings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="max-h-48 overflow-y-auto rounded-md border border-border bg-card/40 p-2 space-y-1.5"
            >
              {report.vulnFindings.slice(0, 30).map((v, i) => (
                <div key={i} className="text-[10px] border-l-2 pl-2" style={{
                  borderColor: SEVERITY_STYLES[v.severity as keyof typeof SEVERITY_STYLES]?.text ?? "#94a3b8"
                }}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase text-[9px] text-muted-foreground">
                      {v.severity}
                    </span>
                    <code className="text-[10px] font-mono">{v.file}:{v.line}</code>
                  </div>
                  <p className="text-muted-foreground">{v.description}</p>
                </div>
              ))}
              {report.vulnFindings.length > 30 && (
                <p className="text-[9px] text-muted-foreground italic">
                  + {report.vulnFindings.length - 30} outros...
                </p>
              )}
            </motion.div>
          )}

          {/* ── PENTEST FINDINGS (Grande Run #1 — NOVO) ── */}
          {report.pentestStats && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <ShieldAlert className="size-3 text-rose-500" />
                Pentest Noturno (Grande Run #1)
              </p>
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground">Total</p>
                    <p className="text-base font-bold text-foreground">{report.pentestStats.total}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground">Novas 🔴</p>
                    <p className="text-base font-bold text-rose-500">{report.pentestStats.newlyDetected}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground">Resolvidas ✅</p>
                    <p className="text-base font-bold text-emerald-500">{report.pentestStats.resolvedLast7d}</p>
                  </div>
                </div>
                {report.pentestFindings && report.pentestFindings.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {report.pentestFindings.slice(0, 5).map((f, i) => (
                      <div key={i} className="text-[10px] border-l-2 pl-2" style={{
                        borderColor: SEVERITY_STYLES[f.severity as keyof typeof SEVERITY_STYLES]?.text ?? "#94a3b8"
                      }}>
                        <code className="text-[9px] font-mono">{f.file}:{f.line}</code>
                        <p className="text-muted-foreground">{f.description}</p>
                      </div>
                    ))}
                    {report.pentestFindings.length > 5 && (
                      <p className="text-[9px] text-muted-foreground italic">
                        + {report.pentestFindings.length - 5} outros findings...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ATIVIDADE SUSPEITA (4 superfícies — NOVO) ── */}
          {report.activityStats && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Activity className="size-3 text-amber-500" />
                Atividade Suspeita (24h)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <SurfaceCard
                  name="Landing Page"
                  anomalies={report.activityStats.landing_page.anomalies}
                  severity={report.activityStats.landing_page.severity}
                />
                <SurfaceCard
                  name="DDC"
                  anomalies={report.activityStats.ddc.anomalies}
                  severity={report.activityStats.ddc.severity}
                />
                <SurfaceCard
                  name="Link-in-Bio"
                  anomalies={report.activityStats.linkinbio.anomalies}
                  severity={report.activityStats.linkinbio.severity}
                />
                <SurfaceCard
                  name="Zélla Parceiros"
                  anomalies={report.activityStats.zella_parceiros.anomalies}
                  severity={report.activityStats.zella_parceiros.severity}
                />
              </div>
            </div>
          )}

          {/* ── MÉTRICAS DO DIA ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <TrendingUp className="size-3" />
              Métricas do Dia (BRT 00:00-23:59)
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <MetricChip icon={<Users className="size-3" />} label="Leads" value={report.metrics.leadsCaptured} />
              <MetricChip icon={<CheckCircle2 className="size-3" />} label="Conv." value={report.metrics.leadsConverted} />
              <MetricChip icon={<Sparkles className="size-3" />} label="Cliques" value={report.metrics.clicks} />
              <MetricChip icon={<Smartphone className="size-3" />} label="Mobile" value={report.metrics.devicesMobile} />
            </div>
          </div>

          {/* ── TOP REGIÕES ── */}
          {report.metrics.regions.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="size-3" />
                Top 5 Regiões
              </p>
              <div className="space-y-1">
                {report.metrics.regions.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">{r.uf}</span>
                    <div className="flex items-center gap-2 flex-1 ml-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(r.count / report.metrics.regions[0].count) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground tabular-nums">{r.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RECOMENDAÇÕES DO GLM 5.2 ── */}
          {report.llmAnalysis.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Recomendações Prioritárias
              </p>
              <div className="space-y-1">
                {report.llmAnalysis.recommendations.slice(0, 5).map((rec, i) => (
                  <div key={i} className="text-[11px] flex gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    <span className="text-foreground">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RISCOS DETECTADOS ── */}
          {report.llmAnalysis.risks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <AlertTriangle className="size-3 text-amber-500" />
                Riscos Detectados
              </p>
              <div className="space-y-1">
                {report.llmAnalysis.risks.slice(0, 3).map((risk, i) => (
                  <div key={i} className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                    ⚠ {risk}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── OPORTUNIDADES ── */}
          {report.llmAnalysis.opportunities.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Sparkles className="size-3 text-emerald-500" />
                Oportunidades de Evolução
              </p>
              <div className="space-y-1">
                {report.llmAnalysis.opportunities.slice(0, 3).map((opp, i) => (
                  <div key={i} className="text-[11px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                    💡 {opp}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ERRO (se status=failed) ── */}
          {report.status === "failed" && report.errorMessage && (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 p-2">
              <p className="text-[10px] uppercase tracking-wider text-rose-700 mb-1">
                Erro
              </p>
              <p className="text-[11px] font-mono text-rose-900 break-all">
                {report.errorMessage}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-300",
    label: "Info",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    label: "Atenção",
  },
  critical: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/5",
    text: "text-rose-500",
    badge: "bg-rose-100 text-rose-700 border-rose-300",
    label: "Crítico",
  },
  emergency: {
    border: "border-rose-500/60",
    bg: "bg-rose-500/10",
    text: "text-rose-600",
    badge: "bg-rose-200 text-rose-900 border-rose-400",
    label: "Emergência",
  },
} as const;

function VulnCounter({
  count,
  label,
  color,
  textColor,
}: {
  count: number;
  label: string;
  color: string;
  textColor: string;
}) {
  return (
    <div className={`rounded-md ${color} ${textColor} px-1.5 py-1 text-center`}>
      <p className="text-[9px] uppercase tracking-wider opacity-90">{label}</p>
      <p className="text-base font-bold tabular-nums">{count}</p>
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function SurfaceCard({
  name,
  anomalies,
  severity,
}: {
  name: string;
  anomalies: number;
  severity: string;
}) {
  const palette = {
    info: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-700",
    critical: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  }[severity as 'info' | 'warning' | 'critical'] ?? "border-border bg-card/40 text-muted-foreground";

  const icon = {
    info: <CheckCircle2 className="size-3 text-emerald-500" />,
    warning: <AlertTriangle className="size-3 text-amber-500" />,
    critical: <AlertCircle className="size-3 text-rose-500" />,
  }[severity as 'info' | 'warning' | 'critical'] ?? <Activity className="size-3" />;

  return (
    <div className={`rounded-md border ${palette} p-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium">{name}</span>
        {icon}
      </div>
      <p className="text-base font-bold tabular-nums">
        {anomalies}
        <span className="text-[9px] font-normal opacity-70 ml-1">
          {anomalies === 1 ? "anomalia" : "anomalias"}
        </span>
      </p>
    </div>
  );
}

export default NightAuditCard;

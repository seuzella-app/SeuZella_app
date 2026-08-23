"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Activity,
  Database,
  Brain,
  RefreshCw,
  Link2,
  Search,
  Upload,
  Shield,
  TrendingUp,
  Clock,
  Sparkles,
  Cpu,
  FileText,
  Eye,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * SemanticaPanel — Painel do GraphRAG + Decision Intelligence
 *
 * CONEXÕES:
 *  - GET /api/zcc/semantica/graph      → visualização do grafo
 *  - GET /api/zcc/semantica/decisions  → audit trail de decisões
 *  - GET /api/zcc/semantica/conflicts  → conflitos detectados
 *  - POST /api/zcc/semantica/ingest    → ingestar regulamento
 *
 * SUBSISTEMA:
 *  - Apache AGE (graph DB em PostgreSQL)
 *  - PgVector (vector store)
 *  - Python sidecar (FastAPI em /opt/semantica)
 *  - W3C PROV-O (provenance)
 *  - SHACL (ontology validation)
 */

interface GraphNode {
  id: string;
  label: string;
  type: string;
  content: string;
  confidence?: number;
  forgotten?: boolean;
  createdAt: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  condition?: string;
}

interface Decision {
  id: string;
  category: string;
  scenario: string;
  reasoning: string;
  outcome: string;
  response?: string;
  confidence: number;
  metadata?: any;
  createdAt: string;
}

interface Conflict {
  id: string;
  description: string;
  severity: string;
  status: string;
  suggestedResolution?: {
    type: string;
    winnerNodeId: string;
    loserNodeId: string;
    reasoning: string;
  };
  detectedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  RULE: "#ef4444",
  POLICY: "#f59e0b",
  AMENITY: "#10b981",
  CHECKIN: "#3b82f6",
  CHECKOUT: "#06b6d4",
  PAYMENT: "#8b5cf6",
  CANCEL: "#dc2626",
  SERVICE: "#14b8a6",
  GUEST: "#ec4899",
  RESERVATION: "#a855f7",
  ROOM: "#f97316",
  FAQ: "#6366f1",
  CUSTOM: "#64748b",
};

const RELATION_COLORS: Record<string, string> = {
  SUPERSEDES: "#ef4444",
  FORBIDS: "#dc2626",
  REQUIRES: "#3b82f6",
  OVERLAPS: "#64748b",
  ENABLES: "#10b981",
  CAUSED: "#f59e0b",
  INFLUENCED: "#f97316",
  PRECEDENT_FOR: "#8b5cf6",
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
};

const OUTCOME_COLOR: Record<string, string> = {
  success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  partial_success: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  failure: "text-red-400 bg-red-500/10 border-red-500/30",
  escalated: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  blocked: "text-red-500 bg-red-500/10 border-red-500/30",
  pending: "text-muted-foreground bg-secondary/40 border-border",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  critical: "text-red-500 bg-red-500/10 border-red-500/30",
};

export function SemanticaPanel() {
  const [nodes, setNodes] = React.useState<GraphNode[]>([]);
  const [edges, setEdges] = React.useState<GraphEdge[]>([]);
  const [decisions, setDecisions] = React.useState<Decision[]>([]);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>("fallback");
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [showIngestForm, setShowIngestForm] = React.useState(false);
  const [ingestText, setIngestText] = React.useState("");
  const [ingesting, setIngesting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"graph" | "decisions" | "conflicts">("graph");

  // ── Load graph data ────────────────────────────────────────────
  const loadGraph = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/semantica/graph?tenantId=demo-tenant-001", { cache: "no-store" });
      const json = await res.json();
      if (json?.success && json?.data) {
        setNodes(json.data.nodes || []);
        setEdges(json.data.edges || []);
        setDataSource(json.meta?.source || "fallback");
      }
    } catch {
      setDataSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load decisions ─────────────────────────────────────────────
  const loadDecisions = React.useCallback(async () => {
    try {
      const res = await fetch("/api/zcc/semantica/decisions?tenantId=demo-tenant-001&limit=50", { cache: "no-store" });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setDecisions(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Load conflicts ─────────────────────────────────────────────
  const loadConflicts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/zcc/semantica/conflicts?tenantId=demo-tenant-001", { cache: "no-store" });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setConflicts(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    loadGraph();
    loadDecisions();
    loadConflicts();
  }, [loadGraph, loadDecisions, loadConflicts]);

  const handleIngest = async () => {
    if (!ingestText.trim()) return;
    setIngesting(true);
    try {
      const res = await fetch("/api/zcc/semantica/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "demo-tenant-001",
          text: ingestText,
          sourceType: "manual",
        }),
      });
      const json = await res.json();
      if (json?.success) {
        toast.success("Conteúdo ingestado no grafo", {
          description: `${json.data.nodesCreated} nós criados · ${json.data.edgesCreated} arestas`,
        });
        setIngestText("");
        setShowIngestForm(false);
        loadGraph();
      } else {
        toast.error("Erro ao ingestar");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIngesting(false);
    }
  };

  // ── Export audit trail ──────────────────────────────────────────
  const handleExport = async (format: 'prov-o' | 'csv') => {
    try {
      const res = await fetch(
        `/api/zcc/semantica/export?tenantId=demo-tenant-001&format=${format}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const ext = format === 'prov-o' ? 'ttl' : 'csv';
      const filename = `zella-audit-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Auditoria exportada (${format.toUpperCase()})`, {
        description: filename,
      });
    } catch (err) {
      toast.error('Erro ao exportar auditoria');
    }
  };

  const stats = {
    nodes: nodes.length,
    edges: edges.length,
    decisions: decisions.length,
    conflicts: conflicts.length,
    conflictsPending: conflicts.filter((c) => c.status === "detected").length,
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Semântica"
        description="GraphRAG + Decision Intelligence · Apache AGE + PgVector"
        icon={<Network className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {dataSource}
            </span>
            <button
              type="button"
              onClick={() => {
                loadGraph();
                loadDecisions();
                loadConflicts();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => setShowIngestForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
            >
              <Upload className="size-3" />
              Ingestar
            </button>
            <button
              type="button"
              onClick={() => handleExport('prov-o')}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20"
              title="Exportar trilha de auditoria em RDF Turtle (W3C PROV-O)"
            >
              <FileText className="size-3" />
              PROV-O
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20"
              title="Exportar decisões em CSV (Excel)"
            >
              <FileText className="size-3" />
              CSV
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* ====== KPIs ====== */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Nós no grafo" value={stats.nodes} icon={<Database className="size-4 text-primary" />} />
          <KpiCard label="Arestas" value={stats.edges} icon={<GitBranch className="size-4 text-emerald-400" />} />
          <KpiCard label="Decisões" value={stats.decisions} icon={<Activity className="size-4 text-violet-400" />} />
          <KpiCard label="Conflitos" value={stats.conflicts} icon={<AlertTriangle className="size-4 text-amber-400" />} />
          <KpiCard label="Pendentes" value={stats.conflictsPending} icon={<Clock className="size-4 text-red-400" />} />
        </div>

        {/* ====== TAB SELECTOR ====== */}
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 w-fit">
          {(["graph", "decisions", "conflicts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded px-3 py-1 text-[11px] font-medium capitalize transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "graph" ? "Grafo" : tab === "decisions" ? "Decisões" : "Conflitos"}
            </button>
          ))}
        </div>

        {/* ====== TAB: GRAPH ====== */}
        <AnimatePresence mode="wait">
          {activeTab === "graph" ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {/* Nodes list */}
              <div className="lg:col-span-1 rounded-lg border border-border bg-card p-3">
                <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Database className="size-3.5 text-primary" />
                  Nós do Grafo
                </h3>
                <div className="space-y-1 max-h-96 overflow-y-auto zcc-scroll">
                  {nodes.map((node, idx) => (
                    <motion.button
                      key={node.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => setSelectedNode(node)}
                      className={cn(
                        "w-full text-left rounded-md border p-2 transition-colors",
                        selectedNode?.id === node.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-secondary/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                          style={{
                            backgroundColor: `${TYPE_COLORS[node.type] || "#64748b"}20`,
                            color: TYPE_COLORS[node.type] || "#64748b",
                          }}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[node.type] || "#64748b" }} />
                          {node.type}
                        </span>
                        {node.forgotten ? (
                          <span className="text-[8px] text-amber-400 font-bold uppercase">LGPD</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-foreground">{node.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{node.content}</p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Graph visualization */}
              <div className="lg:col-span-2 rounded-lg border border-border bg-card p-3">
                <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Network className="size-3.5 text-primary" />
                  Visualização do Grafo
                </h3>
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase"
                          style={{
                            backgroundColor: `${TYPE_COLORS[selectedNode.type] || "#64748b"}20`,
                            color: TYPE_COLORS[selectedNode.type] || "#64748b",
                          }}
                        >
                          {selectedNode.type}
                        </span>
                        <p className="text-sm font-bold text-foreground">{selectedNode.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{selectedNode.content}</p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>ID: <code className="font-mono text-foreground">{selectedNode.id}</code></span>
                        {selectedNode.confidence ? (
                          <span>Confiança: <span className="font-bold text-foreground">{Math.round(selectedNode.confidence * 100)}%</span></span>
                        ) : null}
                        <span>{fmtDate(selectedNode.createdAt)}</span>
                      </div>
                    </div>
                    {/* Edges connected to this node */}
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Arestas conectadas ({edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length})
                      </p>
                      <div className="space-y-1">
                        {edges
                          .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                          .map((edge) => {
                            const isSource = edge.source === selectedNode.id;
                            const otherNodeId = isSource ? edge.target : edge.source;
                            const otherNode = nodes.find((n) => n.id === otherNodeId);
                            return (
                              <div key={edge.id} className="flex items-center gap-2 rounded border border-border bg-background/50 px-2 py-1.5">
                                <span
                                  className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                                  style={{
                                    backgroundColor: `${RELATION_COLORS[edge.relation] || "#64748b"}20`,
                                    color: RELATION_COLORS[edge.relation] || "#64748b",
                                  }}
                                >
                                  {edge.relation}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {isSource ? "→" : "←"}
                                </span>
                                <span className="truncate text-xs text-foreground">
                                  {otherNode?.label || otherNodeId}
                                </span>
                                <span className="ml-auto text-[9px] text-muted-foreground">
                                  peso: {edge.weight}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid place-items-center py-12 text-center">
                    <Network className="size-12 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Selecione um nó à esquerda para ver detalhes e conexões
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {/* ====== TAB: DECISIONS ====== */}
          {activeTab === "decisions" ? (
            <motion.div
              key="decisions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              <p className="text-[11px] text-muted-foreground mb-2">
                <strong className="text-foreground">Audit Trail:</strong> Todas as decisões da IA ficam rastreáveis aqui. Cada decisão tem ID, cenário, raciocínio (regra usada) e outcome.
              </p>
              {decisions.map((d, idx) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase",
                          OUTCOME_COLOR[d.outcome] || OUTCOME_COLOR.pending
                        )}>
                          {d.outcome}
                        </span>
                        <span className="rounded border border-border bg-secondary/30 px-1.5 py-0.5 text-[8px] font-medium uppercase text-muted-foreground">
                          {d.category}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {fmtDate(d.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-foreground">
                        <strong className="text-muted-foreground">Cenário:</strong> {d.scenario}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <strong className="text-foreground">Raciocínio:</strong> {d.reasoning}
                      </p>
                      {d.response ? (
                        <p className="mt-1 text-[11px] text-foreground italic">
                          <strong className="text-muted-foreground not-italic">Resposta:</strong> "{d.response.slice(0, 150)}{d.response.length > 150 ? "..." : ""}"
                        </p>
                      ) : null}
                      {d.metadata ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                          {d.metadata.providerId ? (
                            <span className="rounded border border-border bg-background px-1 py-0.5 font-mono">
                              🤖 {d.metadata.providerId}
                            </span>
                          ) : null}
                          {d.metadata.latencyMs ? (
                            <span className="rounded border border-border bg-background px-1 py-0.5 font-mono">
                              ⚡ {d.metadata.latencyMs}ms
                            </span>
                          ) : null}
                          {d.metadata.intent ? (
                            <span className="rounded border border-border bg-background px-1 py-0.5">
                              🎯 {d.metadata.intent}
                            </span>
                          ) : null}
                          {d.metadata.fallbackUsed ? (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-amber-400">
                              ⚠ fallback
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] text-muted-foreground">confiança</p>
                      <p className={cn(
                        "font-mono text-sm font-bold",
                        d.confidence >= 0.8 ? "text-emerald-400" :
                        d.confidence >= 0.5 ? "text-amber-400" :
                        "text-red-400"
                      )}>
                        {Math.round(d.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}

          {/* ====== TAB: CONFLICTS ====== */}
          {activeTab === "conflicts" ? (
            <motion.div
              key="conflicts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              <p className="text-[11px] text-muted-foreground mb-2">
                <strong className="text-foreground">Conflitos detectados:</strong> Quando duas regras entram em conflito (ex: check-in 14h vs 11h), o Semantica detecta automaticamente e sugere resolução via SUPERSEDES.
              </p>
              {conflicts.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                  <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">Nenhum conflito detectado</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Grafo do tenant está consistente</p>
                </div>
              ) : (
                conflicts.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "rounded-lg border p-3",
                      SEVERITY_COLOR[c.severity] || SEVERITY_COLOR.medium
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase",
                            SEVERITY_COLOR[c.severity]
                          )}>
                            {c.severity}
                          </span>
                          <span className={cn(
                            "rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase",
                            c.status === "resolved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                            c.status === "detected" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                            "border-border bg-secondary/30 text-muted-foreground"
                          )}>
                            {c.status}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{fmtDate(c.detectedAt)}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-foreground">{c.description}</p>
                        {c.suggestedResolution ? (
                          <div className="mt-2 rounded border border-border bg-background/50 p-2">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Resolução sugerida:</p>
                            <p className="mt-0.5 text-[11px] text-foreground">
                              <span className="font-bold" style={{ color: RELATION_COLORS[c.suggestedResolution.type] || "#64748b" }}>
                                {c.suggestedResolution.type}
                              </span>
                              {" → "}
                              {c.suggestedResolution.reasoning}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ====== RODAPÉ ====== */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[10px] text-muted-foreground">
          <p className="flex items-center gap-2">
            <Shield className="size-3.5 text-primary shrink-0" />
            <span>
              <strong className="text-foreground">Semantica Sidecar:</strong>{" "}
              Apache AGE (graph) + PgVector (vectors) em PostgreSQL ·{" "}
              FastAPI Python em <code className="font-mono text-primary">:7432</code> ·{" "}
              W3C PROV-O (provenance) · SHACL (ontology) ·{" "}
              LGPD esquecimento implementado em{" "}
              <code className="font-mono text-primary">/api/lgpd/forget-guest</code>
            </span>
          </p>
        </div>
      </div>

      {/* ====== INGEST MODAL ====== */}
      <AnimatePresence>
        {showIngestForm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowIngestForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Upload className="size-4 text-primary" />
                  Ingestar conteúdo no grafo
                </h3>
                <button
                  onClick={() => setShowIngestForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Cole o regulamento, FAQ ou políticas da pousada. O Semantica vai extrair entidades, relações e detectar conflitos automaticamente.
              </p>
              <textarea
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
                placeholder="Ex: Check-in oficial às 14h. Check-in antecipado disponível mediante disponibilidade e taxa de R$ 50. Pets permitidos apenas de pequeno porte..."
                className="h-48 w-full resize-none rounded-md border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowIngestForm(false)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleIngest}
                  disabled={ingesting || !ingestText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {ingesting ? (
                    <>
                      <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      Ingestar
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="mt-1 font-mono text-xl font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

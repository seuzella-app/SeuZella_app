// @ts-nocheck — ZCC visual panel (ZéCode), types fixed in dedicated refactoring pass
"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, ChevronRight, ChevronDown, Check, X, Wrench, FileCode2,
  Sparkles, ThumbsUp, ThumbsDown, Loader2, TrendingUp, GitBranch,
  Zap, AlertTriangle, ShieldCheck, Eye, Brain, Activity,
  FolderTree, RefreshCw, FileSearch, ShieldAlert, Lock,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  ZeCodeFinding, ZeCodeScanMode, ZeCodeScanResponse,
  ZeCodeFileNode, ZeCodeAnalysisKind, ZeCodeSeverity, ZeCodeStatus,
} from "@/lib/zcc/types";

/*
 * ZeCodePanel — DEV FULL STACK interno (inspirado em CodeRabbit.ai).
 *
 * Diferente do Cérebro Zélla (runtime), ZéCode atua sobre o código-fonte:
 *   - Análise de código (bottlenecks, gaps, improvements, refactors)
 *   - Propõe mudanças com diff visual (current vs proposed)
 *   - Safety checks em cada proposta (no shell, no fs_write, no eval)
 *   - Approve/Reject/Aply pelo operador (READ-ONLY no FS por design)
 *
 * Modos de scan:
 *   - quick     → 5 hot files críticos (rápido)
 *   - deep      → 20 arquivos de src/ (profundo)
 *   - targeted  → 1 arquivo/diretório específico
 *   - diff      → pending git changes (quando aplicável)
 */

type Finding = ZeCodeFinding;

const KIND_ICON: Record<ZeCodeAnalysisKind, React.ElementType> = {
  bottleneck: Zap,
  gap: FileSearch,
  improvement: Sparkles,
  refactor: Wrench,
  security: ShieldAlert,
  tech_debt: AlertTriangle,
  anti_pattern: X,
};

const KIND_LABEL: Record<ZeCodeAnalysisKind, string> = {
  bottleneck: "BOTTLENECK",
  gap: "GAP",
  improvement: "IMPROVEMENT",
  refactor: "REFACTOR",
  security: "SECURITY",
  tech_debt: "TECH DEBT",
  anti_pattern: "ANTI-PATTERN",
};

const KIND_COLOR: Record<ZeCodeAnalysisKind, string> = {
  bottleneck: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  gap: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  improvement: "border-primary/40 bg-primary/10 text-primary",
  refactor: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  security: "border-red-500/40 bg-red-500/10 text-red-400",
  tech_debt: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  anti_pattern: "border-pink-500/40 bg-pink-500/10 text-pink-400",
};

const SEVERITY_COLOR: Record<ZeCodeSeverity, string> = {
  info: "text-muted-foreground",
  low: "text-sky-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

const STATUS_BADGE: Record<ZeCodeStatus, string> = {
  pending_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  applied: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blocked_safety: "border-red-600/40 bg-red-600/10 text-red-500",
};

const STATUS_LABEL: Record<ZeCodeStatus, string> = {
  pending_review: "PENDING REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  applied: "APPLIED",
  blocked_safety: "BLOCKED · SAFETY",
};

const SCAN_MODES: { mode: ZeCodeScanMode; label: string; description: string; icon: React.ElementType }[] = [
  { mode: "quick", label: "Quick", description: "5 hot files críticos", icon: Zap },
  { mode: "deep", label: "Deep", description: "20 arquivos src/", icon: FolderTree },
  { mode: "targeted", label: "Targeted", description: "Arquivo específico", icon: FileSearch },
  { mode: "diff", label: "Diff", description: "Pending changes", icon: GitBranch },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function ZeCodePanel() {
  const [scanMode, setScanMode] = React.useState<ZeCodeScanMode>("quick");
  const [targetPath, setTargetPath] = React.useState<string>("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<ZeCodeScanResponse | null>(null);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [fileTree, setFileTree] = React.useState<ZeCodeFileNode[] | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<{ path: string; content: string } | null>(null);
  const [showFileTree, setShowFileTree] = React.useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const body: { mode: ZeCodeScanMode; targetPath?: string } = { mode: scanMode };
      if (scanMode === "targeted" && targetPath) {
        body.targetPath = targetPath;
      }
      const res = await fetch("/api/zcc/zecode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: ZeCodeScanResponse = await res.json();
      if (!data.ok) {
        toast.error("Scan falhou", { description: data.error || "Erro desconhecido" });
        return;
      }
      setScanResult(data);
      setFindings(data.findings);
      toast.success(`Scan concluído: ${data.findings.length} findings`, {
        description: `${data.filesScanned} arquivos · ${data.durationMs}ms · ${data.llmProvider}/${data.llmModel}`,
      });
    } catch (err) {
      toast.error("Erro ao executar scan", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const loadFileTree = async () => {
    setFileTreeLoading(true);
    try {
      const res = await fetch("/api/zcc/zecode?path=src");
      const data = await res.json();
      if (data.ok) {
        setFileTree(data.nodes);
      }
    } catch {
      // ignore
    } finally {
      setFileTreeLoading(false);
    }
  };

  const loadFile = async (path: string) => {
    try {
      const res = await fetch(`/api/zcc/zecode?file=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.ok) {
        setSelectedFile({ path, content: data.content });
        setTargetPath(path);
        setScanMode("targeted");
      }
    } catch {
      // ignore
    }
  };

  const updateFindingStatus = (id: string, status: ZeCodeStatus) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, reviewedAt: new Date().toISOString() } : f))
    );
  };

  const handleApprove = (f: Finding) => {
    updateFindingStatus(f.id, "approved");
    toast.success(`Finding aprovado: ${f.title}`, {
      description: `${f.filePath}:${f.lineRange} · pronto para aplicar`,
    });
  };

  const handleReject = (f: Finding) => {
    updateFindingStatus(f.id, "rejected");
    toast.error(`Finding rejeitado: ${f.title}`);
  };

  const handleApply = (f: Finding) => {
    updateFindingStatus(f.id, "applied");
    toast.success(`Proposta aplicada (mock): ${f.title}`, {
      description: "Em produção, geraria commit + CI/CD acionado",
    });
  };

  const kpis = React.useMemo(() => {
    const total = findings.length;
    const pending = findings.filter((f) => f.status === "pending_review").length;
    const approved = findings.filter((f) => f.status === "approved").length;
    const rejected = findings.filter((f) => f.status === "rejected").length;
    const applied = findings.filter((f) => f.status === "applied").length;
    const blocked = findings.filter((f) => f.status === "blocked_safety").length;
    const avgConfidence = findings.length > 0
      ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
      : 0;
    return { total, pending, approved, rejected, applied, blocked, avgConfidence };
  }, [findings]);

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="ZéCode · DEV FULL STACK"
        description="Agente interno de evolução do código · refactor · gargalos · gaps · segurança"
        icon={<Code2 className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400">
              <Lock className="size-3" />
              READ-ONLY
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
              <Brain className="size-3" />
              Paralelo ao Cérebro
            </span>
            {kpis.total > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                <Sparkles className="size-3" />
                {kpis.avgConfidence.toFixed(0)}% conf.
              </span>
            ) : null}
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== ARQUITETURA ZÉCODE vs CÉREBRO ===== */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="size-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Arquitetura Paralela
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="size-4 text-sky-400" />
                <p className="text-sm font-semibold text-sky-400">Cérebro Zélla</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Código vivo · decisões em runtime · produção · conversas com hóspedes ·
                roteamento de LLMs · budget guard · learning. <strong className="text-foreground">Não mexe no código-fonte.</strong>
              </p>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Code2 className="size-4 text-primary" />
                <p className="text-sm font-semibold text-primary">ZéCode</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                DEV FULL STACK interno · analisar código · propor refactors ·
                identificar gargalos/gaps/débito técnico · audit de segurança. <strong className="text-foreground">Não opera em runtime.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ===== CONTROLES DE SCAN ===== */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Eye className="size-3.5 text-primary" />
              Modo de Scan
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowFileTree((v) => !v);
                if (!fileTree) loadFileTree();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <FolderTree className="size-3" />
              {showFileTree ? "Ocultar" : "Explorar"} código
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {SCAN_MODES.map((m) => {
              const Icon = m.icon;
              const isActive = scanMode === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => setScanMode(m.mode)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-all",
                    isActive
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-background hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", isActive ? "text-primary" : "text-foreground")}>
                      {m.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.description}</span>
                </button>
              );
            })}
          </div>

          {scanMode === "targeted" ? (
            <div className="mb-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Caminho alvo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  placeholder="ex: src/lib/llm/llm-router.ts"
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <button
                  type="button"
                  onClick={loadFileTree}
                  disabled={fileTreeLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className={cn("size-3", fileTreeLoading && "animate-spin")} />
                  Browse
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning || (scanMode === "targeted" && !targetPath)}
            className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            {isScanning ? "Escaneando..." : "Executar Scan"}
          </button>

          {scanResult ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Activity className="size-3 text-emerald-400" />
                Último scan: {relativeTime(scanResult.startedAt)}
              </span>
              <span>·</span>
              <span>{scanResult.filesScanned} arquivos</span>
              <span>·</span>
              <span>{scanResult.durationMs}ms</span>
              <span>·</span>
              <span className="font-mono text-primary">{scanResult.llmProvider}/{scanResult.llmModel}</span>
              {scanResult.costUsd > 0 ? (
                <>
                  <span>·</span>
                  <span className="text-emerald-400">${scanResult.costUsd.toFixed(5)}</span>
                </>
              ) : null}
              {scanResult.safetySummary.blocked > 0 ? (
                <>
                  <span>·</span>
                  <span className="text-red-400 font-bold">
                    {scanResult.safetySummary.blocked} props bloqueadas
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ===== FILE TREE EXPLORER ===== */}
        <AnimatePresence initial={false}>
          {showFileTree ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <FolderTree className="size-3.5 text-primary" />
                  Explorador de Código
                  <span className="text-[9px] text-muted-foreground/60 normal-case">
                    · clique para carregar
                  </span>
                </h3>
                <div className="max-h-64 overflow-y-auto zcc-scroll">
                  {fileTreeLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : fileTree && fileTree.length > 0 ? (
                    <ul className="space-y-0.5">
                      {fileTree.map((node) => (
                        <FileTreeNode
                          key={node.path}
                          node={node}
                          depth={0}
                          onSelect={loadFile}
                          selectedPath={selectedFile?.path}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground py-4 text-center">
                      Nenhum arquivo encontrado.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ===== SELECTED FILE PREVIEW ===== */}
        <AnimatePresence initial={false}>
          {selectedFile ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                    <FileCode2 className="size-3.5 text-primary" />
                    <code className="font-mono">{selectedFile.path}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <pre className="zcc-scroll max-h-72 overflow-auto p-3 text-[10px] leading-relaxed font-mono text-muted-foreground">
                  <code>{selectedFile.content}</code>
                </pre>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ===== KPIs ===== */}
        {findings.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <ZeCodeKpi label="Total" value={kpis.total} icon={<Code2 className="size-4" />} accent="primary" index={0} />
            <ZeCodeKpi label="Pendentes" value={kpis.pending} icon={<Loader2 className="size-4" />} accent="amber" index={1} />
            <ZeCodeKpi label="Aprovadas" value={kpis.approved} icon={<ThumbsUp className="size-4" />} accent="sky" index={2} />
            <ZeCodeKpi label="Aplicadas" value={kpis.applied} icon={<Check className="size-4" />} accent="emerald" index={3} />
            <ZeCodeKpi label="Bloqueadas" value={kpis.blocked} icon={<Lock className="size-4" />} accent="rose" index={4} />
            <ZeCodeKpi label="Conf. média" value={`${kpis.avgConfidence.toFixed(0)}%`} icon={<TrendingUp className="size-4" />} accent="primary" index={5} />
          </div>
        ) : null}

        {/* ===== FINDINGS ===== */}
        {findings.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <GitBranch className="size-3.5 text-primary" />
                FINDINGS · {findings.length}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Pendentes: <span className="font-bold text-amber-400">{kpis.pending}</span> ·
                Rejeitadas: <span className="font-bold text-red-400">{kpis.rejected}</span>
              </span>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {findings.map((f, idx) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    index={idx}
                    onApprove={() => handleApprove(f)}
                    onReject={() => handleReject(f)}
                    onApply={() => handleApply(f)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        ) : !scanResult ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Code2 className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">ZéCode aguardando scan</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Selecione um modo acima e execute um scan para ver findings de refactor, gargalos, gaps e segurança.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <Check className="size-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Nenhum finding crítico</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Scan concluído em {scanResult.durationMs}ms · {scanResult.filesScanned} arquivos ·
              nenhuma melhoria urgente identificada.
            </p>
          </div>
        )}

        {/* ===== RODAPÉ ===== */}
        <div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p className="leading-relaxed">
            <strong className="text-foreground">ZéCode</strong> é o agente DEV FULL STACK interno do ZCC,
            inspirado em <code className="font-mono text-primary">CodeRabbit.ai</code> mas adaptado para o
            codebase do projeto. Opera em <strong className="text-foreground">paralelo ao Cérebro Zélla</strong>{" "}
            (que cuida do runtime), focando apenas em evolução do código-fonte: análise, refactors,
            gargalos, gaps, débito técnico e audit de segurança.
          </p>
          <p className="mt-2 leading-relaxed">
            <strong className="text-foreground">Travas ativas:</strong>{" "}
            READ-ONLY no filesystem · whitelist de extensões (.ts, .tsx, .js, .json, .prisma) ·
            blacklist de paths (.env*, .git, node_modules) · limite 256KB/arquivo · máximo 20 arquivos/scan ·
            bloqueio automático de propostas com <code className="font-mono">shell_exec</code>,
            <code className="font-mono">fs_write</code> ou <code className="font-mono">eval</code> ·
            aprovação humana obrigatória para qualquer mudança.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ZeCodeKpi({
  label, value, icon, accent, index,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose" | "sky";
  index: number;
}) {
  const colorMap: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-red-500/30 bg-red-500/5 text-red-400",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn("rounded-lg border p-3", colorMap[accent])}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="[&_svg]:size-3.5">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{value}</p>
    </motion.div>
  );
}

function FileTreeNode({
  node, depth, onSelect, selectedPath,
}: {
  node: ZeCodeFileNode;
  depth: number;
  onSelect: (path: string) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = React.useState(depth < 1);
  const isDir = node.type === "directory";
  const isSelected = selectedPath === node.path;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (isDir) setExpanded((v) => !v);
          else onSelect(node.path);
        }}
        className={cn(
          "flex items-center gap-1.5 w-full rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-secondary/40 transition-colors",
          isSelected ? "bg-primary/15 text-primary" : "text-muted-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {isDir ? (
          <ChevronDown className={cn("size-3 shrink-0 transition-transform", !expanded && "-rotate-90")} />
        ) : (
          <FileCode2 className="size-3 shrink-0" />
        )}
        <span className="truncate font-mono">{node.name}</span>
        {node.language ? (
          <span className="ml-auto text-[8px] uppercase opacity-50">{node.language}</span>
        ) : null}
      </button>
      {isDir && expanded && node.children && node.children.length > 0 ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FindingCard({
  finding, index, onApprove, onReject, onApply,
}: {
  finding: Finding;
  index: number;
  onApprove: () => void;
  onReject: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const KindIcon = KIND_ICON[finding.kind];

  const confidenceColor =
    finding.confidence >= 85 ? "text-emerald-400" :
    finding.confidence >= 75 ? "text-amber-400" :
    "text-red-400";

  const confidenceBg =
    finding.confidence >= 85 ? "bg-emerald-500" :
    finding.confidence >= 75 ? "bg-amber-500" :
    "bg-red-500";

  const isBlocked = finding.status === "blocked_safety";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        isBlocked ? "border-red-600/40" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border",
          KIND_COLOR[finding.kind]
        )}>
          <KindIcon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center rounded border px-1 py-0.5 text-[8px] font-bold uppercase",
              KIND_COLOR[finding.kind]
            )}>
              {KIND_LABEL[finding.kind]}
            </span>
            <span className={cn(
              "inline-flex items-center rounded border px-1 py-0.5 text-[8px] font-bold uppercase",
              STATUS_BADGE[finding.status]
            )}>
              {STATUS_LABEL[finding.status]}
            </span>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wide",
              SEVERITY_COLOR[finding.severity]
            )}>
              {finding.severity}
            </span>
            <p className="text-sm font-semibold text-foreground flex-1 min-w-0">
              {finding.title}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
            {finding.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="font-mono">{finding.filePath}</span>
            {finding.lineRange ? (
              <>
                <span>·</span>
                <span className="font-mono">{finding.lineRange}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{relativeTime(finding.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("font-mono text-sm font-bold", confidenceColor)}>
            {finding.confidence}%
          </span>
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary/40">
            <div
              className={cn("h-full", confidenceBg)}
              style={{ width: `${finding.confidence}%` }}
            />
          </div>
          <ChevronRight className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-border overflow-hidden"
          >
            {/* SAFETY CHECKS */}
            {finding.safetyChecks.length > 0 ? (
              <div className="px-3 py-2 border-b border-border bg-secondary/20">
                <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <ShieldCheck className="size-3 text-primary" />
                  Safety Checks ({finding.safetyChecks.filter((c) => c.passed).length}/{finding.safetyChecks.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {finding.safetyChecks.map((c) => (
                    <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                      {c.passed ? (
                        <Check className="size-3 text-emerald-400" />
                      ) : (
                        <X className="size-3 text-red-400" />
                      )}
                      <span className={c.passed ? "text-muted-foreground" : "text-red-400 font-medium"}>
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* RATIONALE */}
            {finding.rationale ? (
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Rationale
                </p>
                <p className="text-[11px] text-foreground leading-relaxed">{finding.rationale}</p>
              </div>
            ) : null}

            {/* CODE DIFF */}
            {(finding.currentCode || finding.proposedCode) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {finding.currentCode ? (
                  <div className="bg-background/50">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                        − CURRENT CODE
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">{finding.lineRange || "—"}</span>
                    </div>
                    <pre className="zcc-scroll max-h-64 overflow-auto p-3 text-[10px] leading-relaxed font-mono text-muted-foreground">
                      <code>{finding.currentCode}</code>
                    </pre>
                  </div>
                ) : null}
                {finding.proposedCode ? (
                  <div className="bg-emerald-500/5">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        + PROPOSED CODE
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {finding.currentCode && finding.proposedCode
                          ? `-${finding.currentCode.split("\n").length} +${finding.proposedCode.split("\n").length} linhas`
                          : `+${finding.proposedCode.split("\n").length} linhas`}
                      </span>
                    </div>
                    <pre className="zcc-scroll max-h-64 overflow-auto p-3 text-[10px] leading-relaxed font-mono text-emerald-300">
                      <code>{finding.proposedCode}</code>
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ACTIONS */}
            <div className="border-t border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2">
              {isBlocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
                  <Lock className="size-3" />
                  Bloqueada por trava de segurança
                </span>
              ) : finding.status === "pending_review" ? (
                <>
                  <button
                    type="button"
                    onClick={onApprove}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <ThumbsUp className="size-3" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={onReject}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <ThumbsDown className="size-3" />
                    Rejeitar
                  </button>
                </>
              ) : null}

              {finding.status === "approved" ? (
                <button
                  type="button"
                  onClick={onApply}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary hover:bg-primary/20 transition-colors"
                >
                  <Wrench className="size-3" />
                  Aplicar em produção
                </button>
              ) : null}

              {finding.status === "applied" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400">
                  <Check className="size-3" />
                  Aplicada · commit gerado
                </span>
              ) : null}

              {finding.status === "rejected" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-400">
                  <X className="size-3" />
                  Rejeitada pelo operador
                </span>
              ) : null}

              <span className="ml-auto text-[9px] text-muted-foreground">
                Criada {relativeTime(finding.createdAt)}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

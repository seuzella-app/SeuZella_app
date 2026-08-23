"use client";

import * as React from "react";
import {
  KeyRound,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  MessageSquare,
  CreditCard,
  Home as HomeIcon,
  Database,
  Zap,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { integrations, formatLatency, relativeTime } from "@/lib/zcc/mock-data";
import type { Integration } from "@/lib/zcc/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_ICON: Record<Integration["category"], React.ReactNode> = {
  messaging: <MessageSquare className="size-4" />,
  booking: <HomeIcon className="size-4" />,
  payment: <CreditCard className="size-4" />,
  llm: <Cpu className="size-4" />,
  database: <Database className="size-4" />,
};

const CATEGORY_LABEL: Record<Integration["category"], string> = {
  messaging: "Mensageria",
  booking: "Booking",
  payment: "Pagamento",
  llm: "LLM",
  database: "Banco de dados",
};

const STATUS_COLOR: Record<Integration["status"], string> = {
  online: "text-emerald-400 bg-emerald-500/15 border-emerald-700",
  offline: "text-red-400 bg-red-500/15 border-red-700",
  warning: "text-amber-400 bg-amber-500/15 border-amber-700",
  configuring: "text-sky-400 bg-sky-500/15 border-sky-700",
};

export function TokensAIPanel() {
  const [showTokens, setShowTokens] = React.useState<Record<string, boolean>>({});
  const [tokens, setTokens] = React.useState<Record<string, string>>({
    openai: "",
    groq: "",
    "whatsapp-cloud-api": "",
    "airbnb-oauth": "",
    "mercado-pago": "",
    "vercel-postgres": "",
  });

  const toggleShow = (id: string) =>
    setShowTokens((cur) => ({ ...cur, [id]: !cur[id] }));

  const handleSave = () => {
    toast.success("Tokens salvos (mock) · chaves criptografadas em vault");
  };

  const handleTest = (id: string) => {
    toast.info(`Testando conexão com ${id}...`);
    setTimeout(() => {
      toast.success(`${id}: conexão OK (latência mock: 240ms)`);
    }, 800);
  };

  const llmCount = integrations.filter((i) => i.isLLM).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Tokens & IA"
        description={`${integrations.length} integrações · ${llmCount} LLMs ativos`}
        icon={<KeyRound className="size-5" />}
        actions={
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Save className="size-3.5" />
            Salvar
          </button>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Resumo */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Online
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-400">
              {integrations.filter((i) => i.status === "online").length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Offline
            </p>
            <p className="mt-1 text-xl font-bold text-red-400">
              {integrations.filter((i) => i.status === "offline").length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              LLMs
            </p>
            <p className="mt-1 text-xl font-bold text-violet-400">{llmCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Latência média
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {Math.round(
                integrations.reduce((s, i) => s + (i.latencyMs ?? 0), 0) /
                  integrations.length
              )}ms
            </p>
          </div>
        </div>

        {/* Lista de integrações */}
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              showToken={showTokens[integration.id] ?? false}
              onToggleShow={() => toggleShow(integration.id)}
              tokenValue={tokens[integration.id] ?? ""}
              onTokenChange={(value) =>
                setTokens((cur) => ({ ...cur, [integration.id]: value }))
              }
              onTest={() => handleTest(integration.id)}
            />
          ))}
        </div>

        {/* Aviso */}
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">⚠️ Segurança:</strong> Os tokens são
          armazenados criptografados no Vercel Postgres usando AES-256. Nunca
          exponha chaves no client-side. Em produção, todos os requests LLM
          passam pelo backend em <code className="rounded bg-background/60 px-1 py-0.5 font-mono">
            /api/llm/*
          </code>.
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  integration,
  showToken,
  onToggleShow,
  tokenValue,
  onTokenChange,
  onTest,
}: {
  integration: Integration;
  showToken: boolean;
  onToggleShow: () => void;
  tokenValue: string;
  onTokenChange: (value: string) => void;
  onTest: () => void;
}) {
  const placeholder =
    integration.id === "openai" ? "sk-proj-..."
    : integration.id === "groq" ? "gsk_..."
    : integration.id === "whatsapp-cloud-api" ? "EAAZ..."
    : integration.id === "airbnb-oauth" ? "airbnb_oauth_token_..."
    : integration.id === "mercado-pago" ? "APP_USR-..."
    : integration.id === "vercel-postgres" ? "postgres://default@..."
    : "token...";

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-md border",
              integration.isLLM
                ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                : "border-border bg-secondary text-muted-foreground"
            )}
          >
            {CATEGORY_ICON[integration.category]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {integration.name}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {CATEGORY_LABEL[integration.category]}
              {integration.isLLM ? " · LLM Provider" : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase",
            STATUS_COLOR[integration.status]
          )}
        >
          {integration.status === "online" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <XCircle className="size-3" />
          )}
          {integration.status}
        </span>
      </div>

      {/* Propósito */}
      <p className="mt-2 text-[11px] text-muted-foreground">
        {integration.purpose}
      </p>

      {/* Latência */}
      {integration.latencyMs ? (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Zap className="size-3 text-amber-400" />
          <span className="font-mono text-foreground">
            {formatLatency(integration.latencyMs)}
          </span>
          <span>·</span>
          <span>último ping {integration.lastCheck ? relativeTime(integration.lastCheck) : "—"}</span>
        </div>
      ) : null}

      {/* Token input */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showToken ? "text" : "password"}
            value={tokenValue}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder={placeholder}
            className="h-8 w-full rounded-md border border-border bg-background px-2 pr-8 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showToken ? "Ocultar" : "Mostrar"}
          >
            {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onTest}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3" />
          Testar
        </button>
      </div>

      {/* Endpoint */}
      {integration.endpoint ? (
        <div className="mt-2 rounded border border-border bg-secondary/30 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Endpoint
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-foreground">
            {integration.endpoint}
          </p>
        </div>
      ) : null}
    </div>
  );
}

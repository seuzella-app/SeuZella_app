// @ts-nocheck — ZCC visual panel, types fixed in dedicated refactoring pass
"use client";

import * as React from "react";
import { Settings, Save, KeyRound, Webhook, Bell, Database, ShieldCheck } from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { ddcPanels } from "@/lib/zcc/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Toggle({
  defaultOn,
  onChange,
}: {
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = React.useState(defaultOn ?? false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        onChange?.(next);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        on
          ? "border-primary/40 bg-primary/30"
          : "border-border bg-secondary"
      )}
    >
      <span
        className={cn(
          "inline-block size-3.5 rounded-full bg-foreground transition-transform",
          on ? "translate-x-4" : "translate-x-1"
        )}
      />
    </button>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Configurações"
        description="Integradores, webhooks e preferências do ZCC"
        icon={<Settings className="size-5" />}
        actions={
          <button
            type="button"
            onClick={() => toast.success("Configurações salvas (mock)")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Save className="size-3.5" />
            Salvar
          </button>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Caução PIX — REMOVIDA DO SISTEMA                               */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <CaucaoRemovidaInfo />

        {/* Integradores */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <KeyRound className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Integradores</h3>
          </div>
          {ddcPanels.map((p) => (
            <FieldRow
              key={p.id}
              label={p.label}
              hint={`${p.kind} · ${p.device} · ${p.url}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    p.online
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-destructive/15 text-red-300"
                  )}
                >
                  {p.online ? "Ativo" : "Inativo"}
                </span>
                <Toggle
                  defaultOn={p.online}
                  onChange={(on) =>
                    toast.info(`${p.label}: ${on ? "ligado" : "desligado"} (mock)`)
                  }
                />
              </div>
            </FieldRow>
          ))}
        </div>

        {/* Webhooks */}
        <div className="mt-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Webhook className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Webhooks</h3>
          </div>
          <FieldRow label="URL base" hint="Endpoint público para receber eventos">
            <input
              defaultValue="https://api.zehla.app/hooks"
              className="h-8 w-64 rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </FieldRow>
          <FieldRow label="Assinar novos leads" hint="Recebe payload a cada lead">
            <Toggle defaultOn />
          </FieldRow>
          <FieldRow label="Assinar reservas" hint="Recebe payload a cada reserva">
            <Toggle defaultOn />
          </FieldRow>
          <FieldRow label="Reenvio em falha" hint="3 tentativas com backoff exponencial">
            <Toggle defaultOn />
          </FieldRow>
        </div>

        {/* Notificações */}
        <div className="mt-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Bell className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          </div>
          <FieldRow label="E-mail diário" hint="Resumo de leads e reservas às 9h">
            <Toggle defaultOn />
          </FieldRow>
          <FieldRow label="Alerta de painel offline" hint="Dispara quando um DDC cai">
            <Toggle defaultOn />
          </FieldRow>
          <FieldRow label="Lead quente (score ≥ 85)" hint="Push imediato">
            <Toggle defaultOn />
          </FieldRow>
        </div>

        {/* Dados */}
        <div className="mt-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Database className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Dados</h3>
          </div>
          <FieldRow label="Modo mock" hint="Exibe dados fictícios em toda a UI">
            <Toggle defaultOn />
          </FieldRow>
          <FieldRow
            label="Fonte de dados"
            hint="Define de onde o ZCC busca leads e métricas"
          >
            <select className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none">
              <option>Mock (fictício)</option>
              <option>Prisma (banco local)</option>
              <option>API externa</option>
            </select>
          </FieldRow>
        </div>

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">Aviso:</strong> Estas configurações são
          apenas demonstrativas. A persistência real deve ser implementada em{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">
            /api/zcc/settings
          </code>{" "}
          antes de produção.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CaucaoRemovidaInfo — informa que caução foi removida do sistema
// ─────────────────────────────────────────────────────────────────────────────
function CaucaoRemovidaInfo() {
  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 -mx-4 -mt-4 mb-3 sm:px-6">
        <ShieldCheck className="size-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Caução PIX — Removida do Sistema</h3>
      </div>
      <div className="px-2 py-2 text-[12px] leading-relaxed text-muted-foreground">
        <p className="mb-2">
          <strong className="text-foreground">A caução foi removida do Seu Zélla.</strong>
        </p>
        <p className="mb-2">
          A caução é agora <strong className="text-foreground">responsabilidade pessoal do dono da pousada</strong>.
          Se você pratica caução com seus hóspedes, fará isso por conta própria, sem envolvimento do sistema.
        </p>
        <p className="mb-2">
          O Seu Zélla não solicita, processa, armazena ou gerencia caução.
          Esta decisão foi tomada para simplificar o sistema e evitar complicações legais e operacionais.
        </p>
        <p className="text-[11px] text-amber-600">
          Em caso de dúvidas sobre como gerenciar caução manualmente, consulte seu contador ou advogado.
        </p>
      </div>
    </div>
  );
}

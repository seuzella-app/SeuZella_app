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
        {/* Caução PIX — toggle do dono/anfitrião                         */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <CaucaoSection />

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
// CauçãoSection — toggle do dono/anfitrião para exigir caução dos hóspedes
// ─────────────────────────────────────────────────────────────────────────────
function CaucaoSection() {
  const [habilitada, setHabilitada] = React.useState(true);
  const [valorPadrao, setValorPadrao] = React.useState(200);
  const [janelaEstornoH, setJanelaEstornoH] = React.useState(24);
  const [mensagemCustom, setMensagemCustom] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Carrega estado atual da API
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ddc/caution/settings");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setHabilitada(json.data.habilitada ?? true);
            setValorPadrao(json.data.valorPadrao ?? 200);
            setJanelaEstornoH(json.data.janelaEstornoH ?? 24);
            setMensagemCustom(json.data.mensagemCustom ?? "");
          }
        }
      } catch {
        // Fallback mock — sem backend
      }
    })();
  }, []);

  const persist = async (next: {
    habilitada?: boolean;
    valorPadrao?: number;
    janelaEstornoH?: number;
    mensagemCustom?: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ddc/caution/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setHabilitada(json.data.habilitada ?? habilitada);
          setValorPadrao(json.data.valorPadrao ?? valorPadrao);
          setJanelaEstornoH(json.data.janelaEstornoH ?? janelaEstornoH);
          setMensagemCustom(json.data.mensagemCustom ?? "");
          toast.success("Caução atualizada");
        }
      } else {
        // Persistência não disponível (Vercel serverless sem DB) — feedback mock
        toast.info("Caução salva (demo)");
      }
    } catch {
      toast.info("Caução salva (demo)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
        <ShieldCheck className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Caução PIX</h3>
        <span
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            habilitada
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          )}
        >
          {habilitada ? "Ativa" : "Desativada"}
        </span>
      </div>

      {/* Toggle principal */}
      <FieldRow
        label="Exigir caução dos hóspedes"
        hint="Depósito de segurança via PIX. Devolvido automaticamente após o check-out se não houver danos."
      >
        <Toggle
          defaultOn={habilitada}
          onChange={(on) => {
            setHabilitada(on);
            persist({ habilitada: on });
          }}
        />
      </FieldRow>

      {/* Explicação didática para o dono da pousada */}
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          A caução é uma prática comum em pousadas, hotéis e flats no Brasil.
          Ela funciona como um <strong className="text-foreground">depósito de segurança</strong>:
          o hóspede paga um valor via PIX no momento da reserva, e o sistema
          devolve esse valor automaticamente <strong className="text-foreground">{janelaEstornoH}h após o check-out</strong>,
          caso não tenha nenhum dano no quarto.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-muted-foreground">
          <li>Se o hóspede causar dano, você marca no painel e o valor é retido.</li>
          <li>Se a fechar de eletrônica estiver conectada, o PIN do hóspede é revogado automaticamente quando a caução é retida.</li>
          <li>Se preferir não usar caução, desligue o toggle acima — todo o fluxo será pulado.</li>
        </ul>
      </div>

      {/* Campos avançados */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-xs font-medium text-primary hover:bg-secondary/40 sm:px-6"
      >
        <span>Configurações avançadas</span>
        <span className="text-[10px]">{showAdvanced ? "ocultar ▲" : "mostrar ▼"}</span>
      </button>

      {showAdvanced ? (
        <>
          <FieldRow
            label="Valor default (R$)"
            hint="Valor sugerido para cada reserva. Você pode ajustar por reserva."
          >
            <input
              type="number"
              min={0}
              max={10000}
              step={10}
              value={valorPadrao}
              onChange={(e) => setValorPadrao(Number(e.target.value) || 0)}
              onBlur={() => persist({ valorPadrao })}
              className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={loading}
            />
          </FieldRow>

          <FieldRow
            label="Janela de estorno (horas)"
            hint="Tempo após o check-out para devolver a caução automaticamente."
          >
            <input
              type="number"
              min={1}
              max={168}
              step={1}
              value={janelaEstornoH}
              onChange={(e) => setJanelaEstornoH(Number(e.target.value) || 24)}
              onBlur={() => persist({ janelaEstornoH })}
              className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={loading}
            />
          </FieldRow>

          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-0 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Mensagem WhatsApp customizada</p>
              <p className="text-[11px] text-muted-foreground">
                Texto enviado ao hóspede ao solicitar a caução. Use os placeholders
                <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[10px]">{'{valor}'}</code>
                <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[10px]">{'{pixKey}'}</code>
                <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[10px]">{'{janelaEstornoH}'}</code>
                . Deixe vazio para usar o texto padrão.
              </p>
              <textarea
                rows={3}
                value={mensagemCustom}
                onChange={(e) => setMensagemCustom(e.target.value)}
                placeholder={`Oi! Para concluir sua reserva, precisamos de uma caução de R$ {valor}...`}
                className="mt-2 w-full max-w-xl rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={loading}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => persist({ mensagemCustom })}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  Salvar mensagem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMensagemCustom("");
                    persist({ mensagemCustom: "" });
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  Usar texto padrão
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Status resumido */}
      <div className="px-4 py-2.5 text-[11px] text-muted-foreground sm:px-6">
        Estado atual: <strong className={habilitada ? "text-emerald-300" : "text-amber-300"}>{habilitada ? "Caução exigida" : "Caução desativada"}</strong>
        {habilitada ? (
          <>
            {" "}— Valor default: <strong className="text-foreground">R$ {valorPadrao.toFixed(2)}</strong>
            {" "}— Estorno em <strong className="text-foreground">{janelaEstornoH}h</strong> após check-out
          </>
        ) : null}
      </div>
    </div>
  );
}

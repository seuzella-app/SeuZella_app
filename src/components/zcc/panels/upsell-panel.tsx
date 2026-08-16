"use client";

import * as React from "react";
import {
  Sparkles,
  Wallet,
  TrendingUp,
  Info,
  Calendar,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — espelha o backend
// ─────────────────────────────────────────────────────────────────────────────
interface UpsellRecord {
  id: string;
  tenantId: string;
  roomId?: string;
  reservationId?: string;
  guestId?: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  comissionRate: number;
  comissionAmount: number;
  status: "pending" | "confirmed" | "paid" | "cancelled";
  paidAt?: string;
  confirmedAt?: string;
  suggestedByZehla: boolean;
  feriado?: string;
  temporada?: string;
  yieldMultiplier?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface UpsellMetrics {
  total_aceitos: number;
  total_receita_extra: number;
  total_comissao_zehla: number;
  total_comissao_pendente: number;
  total_comissao_paga: number;
  por_tipo: Array<{ type: string; count: number; total_receita: number; comissao: number }>;
  por_status: Record<string, { count: number; comissao: number }>;
  media_por_reserva: number;
}

interface UpsellCatalogItem {
  label: string;
  description: string;
  defaultPrice: number;
  unitLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  paid: { label: "Pago", icon: CheckCircle2, color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-500/15 text-red-300 border-red-500/30" },
} as const;

const TYPE_LABELS: Record<string, string> = {
  late_checkout: "Late checkout",
  cafe_premium: "Café premium",
  massagem: "Massagem",
  passeio_barco: "Passeio de barco",
  transfer_aeroporto: "Transfer aeroporto",
  jantar_romantico: "Jantar romântico",
  decoracao_aniversario: "Decoração aniversário",
  garrafa_vinho: "Garrafa de vinho",
  aula_surf: "Aula de surf",
  passeio_bugue: "Passeio de bugue",
  spa_day: "Spa day",
  kit_praia: "Kit praia",
  late_checkin_madrugada: "Late check-in madrugada",
  limpeza_diaria_extra: "Limpeza extra",
  outros: "Outros",
};

// ─────────────────────────────────────────────────────────────────────────────
// MÉTRICAS CARD
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color = "emerald",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: "emerald" | "blue" | "amber" | "rose";
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    rose: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  };
  return (
    <div className={cn("rounded-lg border p-4", colorClasses[color])}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sublabel ? <p className="mt-1 text-[11px] opacity-70">{sublabel}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULADORA DE UPSELL — simula cenários e mostra comissão Zélla (7%)
// ─────────────────────────────────────────────────────────────────────────────
interface UpsellItemConfig {
  type: string;
  quantity: number;
  unitPrice: number;
}

function UpsellCalculator() {
  const [diariaBase, setDiariaBase] = React.useState(350);
  const [qtdDiarias, setQtdDiarias] = React.useState(3);
  const [qtdPessoas, setQtdPessoas] = React.useState(2);
  const [upsells, setUpsells] = React.useState<UpsellItemConfig[]>([
    { type: "late_checkout", quantity: 4, unitPrice: 50 },
    { type: "cafe_premium", quantity: 3, unitPrice: 35 },
  ]);

  const CATALOG_LABELS: Record<string, { label: string; defaultPrice: number; unitLabel: string }> = {
    late_checkout: { label: "Late checkout (R$ 50/hora)", defaultPrice: 50, unitLabel: "horas" },
    cafe_premium: { label: "Café da manhã premium (R$ 35/diária)", defaultPrice: 35, unitLabel: "diárias" },
    massagem: { label: "Massagem relaxante (R$ 150)", defaultPrice: 150, unitLabel: "sessões" },
    passeio_barco: { label: "Passeio de barco (R$ 120/pessoa)", defaultPrice: 120, unitLabel: "pessoas" },
    transfer_aeroporto: { label: "Transfer aeroporto (R$ 80)", defaultPrice: 80, unitLabel: "trajetos" },
    jantar_romantico: { label: "Jantar romântico (R$ 200)", defaultPrice: 200, unitLabel: "eventos" },
    decoracao_aniversario: { label: "Decoração aniversário (R$ 90)", defaultPrice: 90, unitLabel: "eventos" },
    garrafa_vinho: { label: "Garrafa de vinho (R$ 70)", defaultPrice: 70, unitLabel: "garrafas" },
    kit_praia: { label: "Kit praia (R$ 50/diária)", defaultPrice: 50, unitLabel: "diárias" },
    spa_day: { label: "Spa day (R$ 250/pessoa)", defaultPrice: 250, unitLabel: "pessoas" },
  };

  // Cálculos
  const valorDiarias = diariaBase * qtdDiarias * Math.ceil(qtdPessoas / 2);
  const valorUpsellTotal = upsells.reduce((s, u) => s + u.quantity * u.unitPrice, 0);
  const comissaoZehla = Number((valorUpsellTotal * 0.07).toFixed(2));
  const comissaoSobreDiarias = 0; // ZERO em valores normais
  const totalReceitaPousada = valorDiarias + valorUpsellTotal;
  const totalComissaoZehla = comissaoZehla + comissaoSobreDiarias;

  const addUpsell = () => {
    setUpsells([...upsells, { type: "late_checkout", quantity: 1, unitPrice: 50 }]);
  };
  const removeUpsell = (idx: number) => {
    setUpsells(upsells.filter((_, i) => i !== idx));
  };
  const updateUpsell = (idx: number, field: keyof UpsellItemConfig, value: any) => {
    const next = [...upsells];
    next[idx] = { ...next[idx], [field]: value };
    setUpsells(next);
  };

  return (
    <div className="mt-6 rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-emerald-400" />
        <h3 className="text-base font-bold text-foreground">
          Calculadora de UPSELL — simule seu cenário
        </h3>
      </div>

      <p className="mb-4 text-[12px] text-muted-foreground">
        Use a calculadora para estimar quanto a Zélla ganha em comissão (7% sobre UPSELL) e quanto sua pousada fica com o cenário simulado. <strong className="text-foreground">Diárias normais: 0% taxa. UPSELL: 7% comissão por quarto.</strong>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Configuração da reserva ─── */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            1. Diárias normais (zero taxa)
          </h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Valor da diária base (R$)
              </label>
              <input
                type="number"
                min={0}
                step={10}
                value={diariaBase}
                onChange={(e) => setDiariaBase(Number(e.target.value) || 0)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Qtd. diárias
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={qtdDiarias}
                  onChange={(e) => setQtdDiarias(Number(e.target.value) || 1)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Qtd. pessoas
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={qtdPessoas}
                  onChange={(e) => setQtdPessoas(Number(e.target.value) || 1)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-[11px] text-muted-foreground">
                Subtotal diárias (valor normal):
              </p>
              <p className="text-xl font-bold text-emerald-300">
                {fmtBRL(valorDiarias)}
              </p>
              <p className="mt-1 text-[10px] text-emerald-300/70">
                ✅ ZERO taxa Zélla — você fica com 100%
              </p>
            </div>
          </div>
        </div>

        {/* ─── Configuração dos UPSELLs ─── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              2. UPSELLs (7% comissão Zélla)
            </h4>
            <button
              type="button"
              onClick={addUpsell}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              + Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {upsells.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
                Nenhum UPSELL adicionado. Clique em "+ Adicionar" para simular.
              </div>
            ) : (
              upsells.map((u, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-background p-2">
                  <div className="min-w-[140px] flex-1">
                    <label className="mb-1 block text-[10px] text-muted-foreground">Tipo</label>
                    <select
                      value={u.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        const newPrice = CATALOG_LABELS[newType]?.defaultPrice ?? 50;
                        updateUpsell(idx, "type", newType);
                        updateUpsell(idx, "unitPrice", newPrice);
                      }}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    >
                      {Object.entries(CATALOG_LABELS).map(([t, info]) => (
                        <option key={t} value={t}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-16">
                    <label className="mb-1 block text-[10px] text-muted-foreground">Qtd</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={u.quantity}
                      onChange={(e) => updateUpsell(idx, "quantity", Number(e.target.value) || 1)}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] text-muted-foreground">Preço (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={u.unitPrice}
                      onChange={(e) => updateUpsell(idx, "unitPrice", Number(e.target.value) || 0)}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Subtotal</p>
                    <p className="text-xs font-bold text-foreground">
                      {fmtBRL(u.quantity * u.unitPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUpsell(idx)}
                    className="h-8 w-8 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
            <p className="text-[11px] text-muted-foreground">
              Subtotal UPSELLs (comissão 7%):
            </p>
            <p className="text-xl font-bold text-blue-300">
              {fmtBRL(valorUpsellTotal)}
            </p>
            <p className="mt-1 text-[10px] text-blue-300/70">
              💎 Comissão Zélla: <strong>{fmtBRL(comissaoZehla)}</strong> (7%)
            </p>
          </div>
        </div>
      </div>

      {/* ─── RESULTADO FINAL ─── */}
      <div className="mt-6 rounded-lg border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-4 sm:p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="size-4 text-emerald-400" />
          Resultado final do cenário
        </h4>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Receita pousada
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {fmtBRL(totalReceitaPousada)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Diárias + UPSELLs
            </p>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/70">
              Comissão sobre diárias
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {fmtBRL(0)}
            </p>
            <p className="mt-1 text-[10px] text-emerald-300/70">
              ✅ ZERO taxa
            </p>
          </div>
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-blue-300/70">
              Comissão sobre UPSELL
            </p>
            <p className="mt-1 text-lg font-bold text-blue-300">
              {fmtBRL(comissaoZehla)}
            </p>
            <p className="mt-1 text-[10px] text-blue-300/70">
              7% por quarto
            </p>
          </div>
          <div className="rounded-md border-2 border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-amber-300/70">
              % que vai para a Zélla
            </p>
            <p className="mt-1 text-lg font-bold text-amber-300">
              {totalReceitaPousada > 0
                ? ((totalComissaoZehla / totalReceitaPousada) * 100).toFixed(2)
                : "0.00"}
              %
            </p>
            <p className="mt-1 text-[10px] text-amber-300/70">
              Do total da reserva
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-background/60 p-3 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Resumo:</strong> com{" "}
          {qtdDiarias} diária(s) × R$ {diariaBase.toFixed(2)} ({qtdPessoas} pessoa
          (s)) = <strong className="text-foreground">{fmtBRL(valorDiarias)}</strong> (zero
          taxa) + <strong className="text-foreground">{upsells.length}</strong> UPSELL(s)
          totalizando <strong className="text-foreground">{fmtBRL(valorUpsellTotal)}</strong>{" "}
          (7% = <strong className="text-blue-300">{fmtBRL(comissaoZehla)}</strong> de comissão
          Zélla). <strong className="text-foreground">Você fica com {fmtBRL(totalReceitaPousada - comissaoZehla)}</strong> e a
          seuzella.com recebe <strong className="text-blue-300">{fmtBRL(comissaoZehla)}</strong>.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function UpsellPanel() {
  const [metrics, setMetrics] = React.useState<UpsellMetrics | null>(null);
  const [records, setRecords] = React.useState<UpsellRecord[]>([]);
  const [catalog, setCatalog] = React.useState<Record<string, UpsellCatalogItem>>({});
  const [loading, setLoading] = React.useState(true);
  const [mesSelecionado, setMesSelecionado] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showExplicacao, setShowExplicacao] = React.useState(true);

  // Carrega dados da API
  const carregarDados = React.useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = mesSelecionado.split("-");
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

      const [recordsRes, metricsRes] = await Promise.all([
        fetch(
          `/api/ddc/upsell?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        ),
        fetch(
          `/api/ddc/upsell/metrics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        ),
      ]);

      if (recordsRes.ok) {
        const json = await recordsRes.json();
        if (json.success) {
          setRecords(json.data.records || []);
          setCatalog(json.data.catalog || {});
        }
      }
      if (metricsRes.ok) {
        const json = await metricsRes.json();
        if (json.success) {
          setMetrics(json.data);
        }
      }
    } catch (err) {
      // Em modo demo (Vercel sem DB), mostra dados mock
      setMetrics({
        total_aceitos: 0,
        total_receita_extra: 0,
        total_comissao_zehla: 0,
        total_comissao_pendente: 0,
        total_comissao_paga: 0,
        por_tipo: [],
        por_status: {
          pending: { count: 0, comissao: 0 },
          confirmed: { count: 0, comissao: 0 },
          paid: { count: 0, comissao: 0 },
          cancelled: { count: 0, comissao: 0 },
        },
        media_por_reserva: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado]);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="UPSELL"
        description="Comissão Zélla 7% sobre valores extras · ZERO em diárias normais"
        icon={<Sparkles className="size-5" />}
        actions={
          <>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
            >
              {gerarOpcoesMeses().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={carregarDados}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ─── EXPLICAÇÃO DIDÁTICA (default aberta) ─── */}
        {showExplicacao ? (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Como funciona a comissão Zélla?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExplicacao(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                ocultar ▲
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">UPSELL</strong> é qualquer
                serviço extra que o hóspede aceita além da diária normal: late
                checkout, café da manhã premium, massagem, passeio de barco,
                transfer, etc. A IA Zélla sugere esses serviços automaticamente
                durante a conversa com o hóspede — você não precisa fazer nada.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    Diárias normais
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">0% taxa</p>
                  <p className="mt-1 text-[11px]">
                    Para valores do dia a dia (alta temporada, feriados comuns,
                    finais de semana), a Zélla cobra{" "}
                    <strong className="text-foreground">ZERO taxa</strong>. Você
                    fica com 100% da reserva.
                  </p>
                </div>

                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                    Valores de UPSELL
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">7% comissão</p>
                  <p className="mt-1 text-[11px]">
                    Para serviços extras sugeridos pela IA Zélla, a comissão é{" "}
                    <strong className="text-foreground">7% por quarto</strong>,
                    creditada à seuzella.com.
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-[11px] font-semibold text-foreground">
                  Exemplo prático
                </p>
                <p className="mt-1 text-[11px]">
                  Hóspede reserva 3 diárias × R$ 350 = R$ 1.050 (valor normal →{" "}
                  <strong className="text-emerald-300">0% taxa</strong>). Aceita
                  late checkout +4h: R$ 200 (UPSELL → 7% = R$ 14). Aceita café
                  premium 3×: R$ 105 (UPSELL → 7% = R$ 7,35).{" "}
                  <strong className="text-foreground">
                    Total: R$ 1.355 para a pousada, R$ 21,35 de comissão Zélla.
                  </strong>
                </p>
              </div>

              <p>
                <strong className="text-foreground">Como é descontado:</strong>{" "}
                a comissão é acumulada mensalmente. O DDC mostra em tempo real o
                total acumulado no mês. Você paga à seuzella.com apenas o total
                de UPSELLs confirmados — valores normais das diárias você nunca
                paga taxa nenhuma.
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowExplicacao(true)}
            className="mb-4 text-xs text-emerald-400 hover:text-emerald-300"
          >
            ℹ️ Mostrar explicação de como funciona a comissão Zélla
          </button>
        )}

        {/* ─── KPIs ─── */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Receita extra"
            value={fmtBRL(metrics?.total_receita_extra ?? 0)}
            sublabel={`${metrics?.total_aceitos ?? 0} UPSELLs no mês`}
            icon={TrendingUp}
            color="emerald"
          />
          <MetricCard
            label="Comissão Zélla (7%)"
            value={fmtBRL(metrics?.total_comissao_zehla ?? 0)}
            sublabel="A pagar à seuzella.com"
            icon={Wallet}
            color="blue"
          />
          <MetricCard
            label="Comissão pendente"
            value={fmtBRL(metrics?.total_comissao_pendente ?? 0)}
            sublabel="Aguardando confirmação"
            icon={Clock}
            color="amber"
          />
          <MetricCard
            label="Comissão paga"
            value={fmtBRL(metrics?.total_comissao_paga ?? 0)}
            sublabel="Já quitada no mês"
            icon={CheckCircle2}
            color="rose"
          />
        </div>

        {/* ─── BREAKDOWN POR TIPO ─── */}
        <div className="mb-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Receita extra por tipo de UPSELL
            </h3>
          </div>
          {metrics && metrics.por_tipo.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Qtd
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Receita extra
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Comissão Zélla (7%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.por_tipo.map((row) => (
                    <tr
                      key={row.type}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-foreground sm:px-6">
                        {TYPE_LABELS[row.type] || row.type}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {row.count}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground">
                        {fmtBRL(row.total_receita)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-300">
                        {fmtBRL(row.comissao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
              {loading ? "Carregando..." : "Nenhum UPSELL registrado no período."}
            </div>
          )}
        </div>

        {/* ─── HISTÓRICO DE UPSELLs ─── */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Calendar className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Histórico de UPSELLs no mês
            </h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {records.length} registro(s)
            </span>
          </div>
          {records.length > 0 ? (
            <div className="zcc-scroll max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">
                      Data
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Qtd
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Valor total
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Comissão
                    </th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">
                      Zélla?
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                    const StatusIcon = status.icon;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/50 last:border-0 hover:bg-secondary/20"
                      >
                        <td className="px-4 py-2.5 text-muted-foreground sm:px-6">
                          {fmtDate(r.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {TYPE_LABELS[r.type] || r.type}
                          {r.feriado ? (
                            <span className="ml-1 text-[10px] text-amber-300">
                              ({r.feriado})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {r.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {fmtBRL(r.totalPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-300">
                          {fmtBRL(r.comissionAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                              status.color
                            )}
                          >
                            <StatusIcon className="size-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {r.suggestedByZehla ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              <Sparkles className="size-3" />
                              Sim
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Manual
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground sm:px-6">
              {loading ? (
                "Carregando..."
              ) : (
                <div>
                  <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                  <p className="font-medium">Nenhum UPSELL registrado neste mês</p>
                  <p className="mt-1 text-[11px]">
                    Quando a IA Zélla sugerir um UPSELL (late checkout, café
                    premium, massagem, etc.) e o hóspede aceitar, aparecerá aqui
                    automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── CALCULADORA DE UPSELL ─── */}
        <UpsellCalculator />

        {/* ─── CATÁLOGO DE UPSELLs DISPONÍVEIS ─── */}
        <div className="mt-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Catálogo de UPSELLs que a IA Zélla sugere
            </h3>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            {Object.entries(catalog).length > 0
              ? Object.entries(catalog).map(([type, info]) => (
                  <div
                    key={type}
                    className="rounded-md border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {info.label}
                      </p>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {fmtBRL(info.defaultPrice)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {info.description}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Comissão Zélla: {fmtBRL(info.defaultPrice * 0.07)} (7%)
                    </p>
                  </div>
                ))
              : // Catálogo padrão caso API não responda
                DEFAULT_CATALOG.map((item) => (
                  <div
                    key={item.type}
                    className="rounded-md border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {item.label}
                      </p>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {fmtBRL(item.defaultPrice)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Comissão Zélla: {fmtBRL(item.defaultPrice * 0.07)} (7%)
                    </p>
                  </div>
                ))}
          </div>
        </div>

        {/* ─── RODAPÉ INFORMATIVO ─── */}
        <div className="mt-6 rounded-lg border border-border bg-secondary/20 p-4 text-[11px] text-muted-foreground sm:px-6">
          <p className="font-semibold text-foreground">
            Resumo do modelo de comissão
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong className="text-foreground">Valores normais das diárias:</strong>{" "}
              <span className="text-emerald-300">0% taxa</span> — você fica com
              100% da receita das diárias.
            </li>
            <li>
              <strong className="text-foreground">
                Valores de UPSELL (serviços extras sugeridos pela IA Zélla):
              </strong>{" "}
              <span className="text-blue-300">7% de comissão</span> por quarto,
              creditada à seuzella.com.
            </li>
            <li>
              <strong className="text-foreground">Periodicidade:</strong> a
              comissão é acumulada mensalmente e pode ser paga via PIX ou boleto.
            </li>
            <li>
              <strong className="text-foreground">Transparência:</strong> todos
              os UPSELLs são registrados com timestamp, hóspede e valor — você
              pode auditar qualquer cobrança.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function gerarOpcoesMeses(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  // Últimos 12 meses
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ value, label });
  }
  return opts;
}

const DEFAULT_CATALOG = [
  { type: "late_checkout", label: "Late checkout", description: "Extensão do horário de check-out. R$ 50/hora extra.", defaultPrice: 50 },
  { type: "cafe_premium", label: "Café da manhã premium", description: "Café premium com itens especiais. R$ 35/diária.", defaultPrice: 35 },
  { type: "massagem", label: "Massagem relaxante", description: "Massagem no quarto ou spa. R$ 150/sessão.", defaultPrice: 150 },
  { type: "passeio_barco", label: "Passeio de barco", description: "Passeio de barco pela região. R$ 120/pessoa.", defaultPrice: 120 },
  { type: "transfer_aeroporto", label: "Transfer aeroporto", description: "Transfer ida/volta aeroporto. R$ 80.", defaultPrice: 80 },
  { type: "jantar_romantico", label: "Jantar romântico", description: "Jantar montado no quarto. R$ 200.", defaultPrice: 200 },
  { type: "garrafa_vinho", label: "Garrafa de vinho", description: "Garrafa de vinho no quarto. R$ 70.", defaultPrice: 70 },
  { type: "kit_praia", label: "Kit praia", description: "Guarda-sol + 2 cadeiras. R$ 50/diária.", defaultPrice: 50 },
];

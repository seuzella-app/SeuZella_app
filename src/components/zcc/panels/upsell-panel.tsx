"use client";

import * as React from "react";
import {
  Sparkles,
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  ArrowUpRight,
  Award,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — visão administrativa seuzella.com
// ─────────────────────────────────────────────────────────────────────────────
interface FaturamentoMensal {
  mes: number;
  ano: number;
  total_comissao: number;
  total_receita_gerada: number;
  total_upsells: number;
  total_pousadas_ativas: number;
  media_por_pousada: number;
  projecao_anual: number;
  por_tipo: Array<{ type: string; count: number; total_receita: number; comissao: number }>;
  top_pousadas: Array<{
    tenantId: string;
    tenantName?: string;
    total_upsells: number;
    total_comissao: number;
  }>;
}

interface Cobranca {
  tenantId: string;
  tenantName?: string;
  mes: number;
  ano: number;
  valor: number;
  vencimento: string;
  status: "pendente" | "paga" | "vencida";
  metodo: "pix" | "boleto" | "cartao";
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtInt(v: number): string {
  return v.toLocaleString("pt-BR");
}

function fmtPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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

const STATUS_COBRANCA = {
  pendente: { label: "Pendente", icon: Clock, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  paga: { label: "Pago", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  vencida: { label: "Vencida", icon: AlertCircle, color: "bg-red-500/15 text-red-300 border-red-500/30" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL PRINCIPAL — visão administrativa da seuzella.com
// ─────────────────────────────────────────────────────────────────────────────
export function UpsellPanel() {
  const [faturamento, setFaturamento] = React.useState<FaturamentoMensal | null>(null);
  const [cobrancas, setCobrancas] = React.useState<Cobranca[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mesSelecionado, setMesSelecionado] = React.useState(() => {
    const now = new Date();
    return { mes: now.getMonth() + 1, ano: now.getFullYear() };
  });
  const [showTopPousadas, setShowTopPousadas] = React.useState(true);
  const [showCobrancas, setShowCobrancas] = React.useState(true);

  const carregarDados = React.useCallback(async () => {
    setLoading(true);
    try {
      // Tenta a API admin (apenas ADMIN pode ver todos os tenants)
      const res = await fetch(
        `/api/admin/faturamento-zehla?month=${mesSelecionado.mes}&year=${mesSelecionado.ano}&includeCobrancas=true`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setFaturamento(json.data.faturamento);
          setCobrancas(json.data.cobrancas?.cobrancas || []);
          return;
        }
      }
      // Se 403 (não é ADMIN), usa dados mock para visualização
      if (res.status === 403) {
        setFaturamento(gerarDadosMock(mesSelecionado.mes, mesSelecionado.ano));
        setCobrancas(gerarCobrancasMock(mesSelecionado.mes, mesSelecionado.ano));
        toast.info("Visualizando dados de demonstração (acesso ADMIN necessário para dados reais)");
        return;
      }
      throw new Error("Falha ao carregar");
    } catch (err) {
      // Fallback mock
      setFaturamento(gerarDadosMock(mesSelecionado.mes, mesSelecionado.ano));
      setCobrancas(gerarCobrancasMock(mesSelecionado.mes, mesSelecionado.ano));
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado]);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Métricas derivadas
  const totalComissao = faturamento?.total_comissao ?? 0;
  const projecaoAnual = faturamento?.projecao_anual ?? 0;
  const metaMensal = 5000;
  const progressoMeta = Math.min(100, (totalComissao / metaMensal) * 100);
  const cobrancasPendentes = cobrancas.filter((c) => c.status === "pendente").length;
  const cobrancasVencidas = cobrancas.filter((c) => c.status === "vencida").length;
  const valorPendente = cobrancas
    .filter((c) => c.status === "pendente" || c.status === "vencida")
    .reduce((s, c) => s + c.valor, 0);
  const valorPago = cobrancas
    .filter((c) => c.status === "paga")
    .reduce((s, c) => s + c.valor, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="UPSELL — Métricas & Faturamento"
        description="Visão administrativa seuzella.com · 7% por quarto · ZERO em diárias normais"
        icon={<Sparkles className="size-5" />}
        actions={
          <>
            <select
              value={`${mesSelecionado.ano}-${String(mesSelecionado.mes).padStart(2, "0")}`}
              onChange={(e) => {
                const [ano, mes] = e.target.value.split("-").map(Number);
                setMesSelecionado({ mes, ano });
              }}
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
        {/* ─── KPIs PRINCIPAIS ─── */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Comissão Zélla no mês"
            value={fmtBRL(totalComissao)}
            sublabel={`${fmtInt(faturamento?.total_upsells ?? 0)} UPSELLs · ${fmtInt(faturamento?.total_pousadas_ativas ?? 0)} pousadas`}
            icon={Wallet}
            color="blue"
          />
          <KpiCard
            label="Receita extra p/ pousadas"
            value={fmtBRL(faturamento?.total_receita_gerada ?? 0)}
            sublabel="Gerada por UPSELLs no mês"
            icon={TrendingUp}
            color="emerald"
          />
          <KpiCard
            label="Projeção anual"
            value={fmtBRL(projecaoAnual)}
            sublabel="12× o mês atual"
            icon={TrendingUp}
            color="amber"
          />
          <KpiCard
            label="Média por pousada"
            value={fmtBRL(faturamento?.media_por_pousada ?? 0)}
            sublabel="No mês"
            icon={Building2}
            color="rose"
          />
        </div>

        {/* ─── META MENSAL ─── */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso da meta mensal de comissão</span>
            <span className="font-semibold text-foreground">
              {fmtBRL(totalComissao)} / {fmtBRL(metaMensal)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {progressoMeta >= 100
              ? "🎉 Meta mensal atingida!"
              : `Faltam ${fmtBRL(Math.max(0, metaMensal - totalComissao))} para bater a meta de ${fmtBRL(metaMensal)}/mês.`}
          </p>
        </div>

        {/* ─── STATUS DAS COBRANÇAS (CARTÃO DE CRÉDITO) ─── */}
        <div className="mb-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <CreditCard className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Status das cobranças (cartão de crédito · Mercado Pago)
            </h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {cobrancas.length} cobrança(s)
            </span>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-6">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-amber-300">
                <Clock className="size-3" />
                Pendentes
              </p>
              <p className="mt-1 text-lg font-bold text-amber-300">{cobrancasPendentes}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{fmtBRL(valorPendente)}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-300">
                <CheckCircle2 className="size-3" />
                Pagas
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-300">
                {cobrancas.length - cobrancasPendentes - cobrancasVencidas}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">{fmtBRL(valorPago)}</p>
            </div>
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-red-300">
                <AlertCircle className="size-3" />
                Vencidas
              </p>
              <p className="mt-1 text-lg font-bold text-red-300">{cobrancasVencidas}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Cobrar manualmente</p>
            </div>
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-blue-300">
                <CreditCard className="size-3" />
                Total a receber
              </p>
              <p className="mt-1 text-lg font-bold text-blue-300">{fmtBRL(valorPendente + valorPago)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">No período</p>
            </div>
          </div>

          <div className="border-t border-border bg-background/40 px-4 py-2 sm:px-6">
            <p className="text-[10px] text-muted-foreground">
              💳 Todas as cobranças são automáticas via cartão de crédito (Mercado Pago).
              Não há PIX manual — o dono cadastra o cartão uma vez e a cobrança
              acontece no fim de cada mês.
            </p>
          </div>
        </div>

        {/* ─── TOP POUSADAS (que mais geram UPSELL) ─── */}
        <div className="mb-6 rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowTopPousadas(!showTopPousadas)}
            className="flex w-full items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-left sm:px-6"
          >
            <Award className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Top pousadas — que mais geram UPSELL no mês
            </h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {faturamento?.top_pousadas?.length ?? 0} pousada(s)
            </span>
            {showTopPousadas ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {showTopPousadas && faturamento && faturamento.top_pousadas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">Posição</th>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Pousada</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">UPSELLs</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Receita extra</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Comissão Zélla (7%)</th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {faturamento.top_pousadas.map((p, idx) => {
                    const pct = totalComissao > 0 ? (p.total_comissao / totalComissao) * 100 : 0;
                    return (
                      <tr key={p.tenantId} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-2.5 sm:px-6">
                          <span className={cn(
                            "inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold",
                            idx === 0 ? "bg-amber-500/20 text-amber-300" :
                            idx === 1 ? "bg-slate-400/20 text-slate-300" :
                            idx === 2 ? "bg-orange-700/30 text-orange-400" :
                            "bg-secondary text-muted-foreground"
                          )}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {p.tenantName || `Tenant ${p.tenantId.slice(-8)}`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{p.total_upsells}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-300">
                          {fmtBRL(p.total_upsells * 100)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-300">{fmtBRL(p.total_comissao)}</td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">{fmtPercent(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : showTopPousadas ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
              {loading ? "Carregando..." : "Nenhuma pousada com UPSELL no período."}
            </div>
          ) : null}
        </div>

        {/* ─── BREAKDOWN POR TIPO ─── */}
        <div className="mb-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Receita extra por tipo de UPSELL
            </h3>
          </div>
          {faturamento && faturamento.por_tipo.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">Tipo</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Receita extra</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Comissão (7%)</th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {faturamento.por_tipo.map((row) => {
                    const pct = totalComissao > 0 ? (row.comissao / totalComissao) * 100 : 0;
                    return (
                      <tr key={row.type} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 text-foreground sm:px-6">{TYPE_LABELS[row.type] || row.type}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{row.count}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-300">{fmtBRL(row.total_receita)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-300">{fmtBRL(row.comissao)}</td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">{fmtPercent(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
              {loading ? "Carregando..." : "Nenhum UPSELL no período."}
            </div>
          )}
        </div>

        {/* ─── BEHAVIORAL ANALYTICS — TAXA DE CONVERSÃO POR TIPO ─── */}
        <BehavioralAnalyticsCard
          faturamento={faturamento}
          loading={loading}
        />

        {/* ─── COBRANÇAS DO MÊS (POR POUSADA) ─── */}
        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowCobrancas(!showCobrancas)}
            className="flex w-full items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-left sm:px-6"
          >
            <CreditCard className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Cobranças do mês (cartão de crédito por pousada)
            </h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {cobrancas.length} cobrança(s) · {fmtBRL(valorPendente + valorPago)} total
            </span>
            {showCobrancas ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {showCobrancas && cobrancas.length > 0 ? (
            <div className="zcc-scroll max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">Pousada</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Valor</th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">Vencimento</th>
                    <th className="px-4 py-2 text-center font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map((c, idx) => {
                    const status = STATUS_COBRANCA[c.status as keyof typeof STATUS_COBRANCA] || STATUS_COBRANCA.pendente;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={`${c.tenantId}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-2.5 text-foreground sm:px-6">
                          {c.tenantName || `Tenant ${c.tenantId.slice(-8)}`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-300">{fmtBRL(c.valor)}</td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">
                          {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold", status.color)}>
                            <StatusIcon className="size-3" />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : showCobrancas ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
              {loading ? "Carregando..." : "Nenhuma cobrança no período."}
            </div>
          ) : null}
        </div>

        {/* ─── RODAPÉ INFORMATIVO ─── */}
        <div className="mt-6 rounded-lg border border-border bg-secondary/20 p-4 text-[11px] text-muted-foreground sm:px-6">
          <p className="font-semibold text-foreground">Modelo de comissão Zélla</p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong className="text-foreground">Valores normais das diárias:</strong>{" "}
              <span className="text-emerald-300">0% taxa</span> — pousada fica com 100%.
            </li>
            <li>
              <strong className="text-foreground">Valores de UPSELL (serviços extras sugeridos pela IA Zélla):</strong>{" "}
              <span className="text-blue-300">7% de comissão</span> por quarto, creditada à seuzella.com.
            </li>
            <li>
              <strong className="text-foreground">Pagamento:</strong> cobrança automática via cartão de crédito (Mercado Pago)
              no fim de cada mês. Não há PIX manual.
            </li>
            <li>
              <strong className="text-foreground">Visão administrativa:</strong> este painel mostra todas as pousadas
              cadastradas e suas contribuições. Acesso apenas para ADMIN da seuzella.com.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function ChevronUp({ className }: { className?: string }) {
  return <span className={className}>▲</span>;
}

function ChevronDown({ className }: { className?: string }) {
  return <span className={className}>▼</span>;
}

function gerarOpcoesMeses(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ value, label });
  }
  return opts;
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS MOCK — quando API admin não está disponível (Vercel sem DB ou não-ADMIN)
// ─────────────────────────────────────────────────────────────────────────────
function gerarDadosMock(mes: number, ano: number): FaturamentoMensal {
  const seed = mes * 100 + ano;
  const rng = (() => {
    let s = seed;
    return () => {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const totalUpsells = Math.floor(50 + rng() * 200);
  const totalReceita = Math.floor(totalUpsells * (50 + rng() * 100));
  const totalComissao = Number((totalReceita * 0.07).toFixed(2));
  const totalPousadas = Math.floor(10 + rng() * 40);

  const tipos = Object.keys(TYPE_LABELS);
  const por_tipo = tipos.slice(0, 6).map((type) => {
    const count = Math.floor(5 + rng() * 40);
    const total_receita = Math.floor(count * (40 + rng() * 80));
    return {
      type,
      count,
      total_receita,
      comissao: Number((total_receita * 0.07).toFixed(2)),
    };
  }).sort((a, b) => b.comissao - a.comissao);

  const nomesPousadas = [
    "Recanto Praia", "Pousada Mar Azul", "Vila do Sol", "Casa da Praia",
    "Bangalô da Sereia", "Pousada do Farol", "Recanto dos Ventos", "Maré Cheia",
    "Pé na Areia", "Canto do Mar", "Vila das Conchas", "Pousada Brisas",
  ];
  const top_pousadas = nomesPousadas.slice(0, 8).map((nome, idx) => {
    const upsells = Math.floor(5 + rng() * 30 - idx * 2);
    return {
      tenantId: `mock_tenant_${idx}`,
      tenantName: nome,
      total_upsells: upsells,
      total_comissao: Number((upsells * (40 + rng() * 60) * 0.07).toFixed(2)),
    };
  }).sort((a, b) => b.total_comissao - a.total_comissao);

  return {
    mes,
    ano,
    total_comissao: totalComissao,
    total_receita_gerada: totalReceita,
    total_upsells: totalUpsells,
    total_pousadas_ativas: totalPousadas,
    media_por_pousada: Number((totalComissao / totalPousadas).toFixed(2)),
    projecao_anual: Number((totalComissao * 12).toFixed(2)),
    por_tipo,
    top_pousadas,
  };
}

function gerarCobrancasMock(mes: number, ano: number): Cobranca[] {
  const dados = gerarDadosMock(mes, ano);
  const now = new Date();
  const vencimento = new Date(ano, mes, 10).toISOString();

  return dados.top_pousadas.map((p, idx) => ({
    tenantId: p.tenantId,
    tenantName: p.tenantName,
    mes,
    ano,
    valor: p.total_comissao,
    vencimento,
    status: (idx < 5 ? "paga" : idx < 7 ? "pendente" : "vencida") as any,
    metodo: "cartao" as const,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL ANALYTICS — Inspiração WP Swings Upsell Order Bump
// Mostra taxa de conversão (view → accept → success) por tipo de UPSELL
// ─────────────────────────────────────────────────────────────────────────────
function BehavioralAnalyticsCard({
  faturamento,
  loading,
}: {
  faturamento: FaturamentoMensal | null;
  loading: boolean;
}) {
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Busca behavioral analytics da API admin
        const res = await fetch('/api/admin/upsell-analytics');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) {
            setAnalytics(json.data);
          }
        }
      } catch {
        // Fallback mock
        if (!cancelled) {
          setAnalytics(gerarAnalyticsMock());
        }
      } finally {
        if (!cancelled) setLoadingAnalytics(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
        <TrendingUp className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Behavioral Analytics — conversão por tipo
        </h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          inspirado em WP Swings Upsell Order Bump
        </span>
      </div>

      {analytics && analytics.por_tipo && analytics.por_tipo.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/30">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground sm:px-6">Tipo</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Views</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Aceites</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Removidas</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Sucessos</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Conv. Rate</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {analytics.por_tipo.map((row: any) => {
                const convRate = row.view_count > 0
                  ? (row.success_count / row.view_count) * 100
                  : 0;
                return (
                  <tr key={row.type} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-foreground sm:px-6">
                      {TYPE_LABELS[row.type] || row.type}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{row.view_count}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-300">{row.accept_count}</td>
                    <td className="px-4 py-2.5 text-right text-red-300">{row.remove_count}</td>
                    <td className="px-4 py-2.5 text-right text-blue-300 font-bold">{row.success_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full",
                              convRate >= 30 ? "bg-emerald-500" :
                              convRate >= 15 ? "bg-amber-500" :
                              "bg-red-500"
                            )}
                            style={{ width: `${Math.min(100, convRate)}%` }}
                          />
                        </div>
                        <span className={cn(
                          "font-bold",
                          convRate >= 30 ? "text-emerald-300" :
                          convRate >= 15 ? "text-amber-300" :
                          "text-red-300"
                        )}>
                          {convRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">
                      {fmtBRL(row.average_ticket || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          {loadingAnalytics ? "Carregando analytics..." : "Sem dados comportamentais no período."}
        </div>
      )}

      <div className="border-t border-border bg-background/40 px-4 py-2 sm:px-6">
        <p className="text-[10px] text-muted-foreground">
          📊 <strong className="text-foreground">Behavioral Analytics</strong> rastreia 5 métricas:
          views (oferta exibida), aceites (1 clique), removidas (desistiu), sucessos (virou reserva)
          e ticket médio. <strong className="text-foreground">Conversion Rate</strong> = sucessos ÷ views.
          A IA Zélla prioriza sugerir UPSELLs com maior taxa histórica.
        </p>
      </div>
    </div>
  );
}

function gerarAnalyticsMock() {
  const tipos = ['late_checkout', 'cafe_premium', 'massagem', 'garrafa_vinho', 'kit_praia'];
  const por_tipo = tipos.map((type, idx) => {
    const view_count = Math.floor(50 + Math.random() * 200);
    const accept_count = Math.floor(view_count * (0.2 + Math.random() * 0.3));
    const remove_count = Math.floor(accept_count * 0.2);
    const success_count = Math.floor(accept_count * (0.5 + Math.random() * 0.3));
    const total_sales = success_count * (40 + Math.random() * 100);
    return {
      type,
      view_count,
      accept_count,
      remove_count,
      success_count,
      total_sales_amount: total_sales,
      average_ticket: success_count > 0 ? total_sales / success_count : 0,
    };
  });
  return { por_tipo };
}

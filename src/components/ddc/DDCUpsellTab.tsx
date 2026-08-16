"use client";

import * as React from "react";
import {
  Sparkles,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  Plus,
  Calculator,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface UpsellRecord {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  comissionAmount: number;
  status: "pending" | "confirmed" | "paid" | "cancelled";
  suggestedByZehla: boolean;
  feriado?: string;
  temporada?: string;
  createdAt: string;
}

interface UpsellMetrics {
  total_aceitos: number;
  total_receita_extra: number;
  total_comissao_zehla: number;
  total_comissao_pendente: number;
  total_comissao_paga: number;
  por_tipo: Array<{ type: string; count: number; total_receita: number; comissao: number }>;
  media_por_reserva: number;
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
  late_checkout: "Late checkout (check-out estendido)",
  cafe_premium: "Café da manhã premium",
  massagem: "Massagem relaxante",
  passeio_barco: "Passeio de barco",
  transfer_aeroporto: "Transfer aeroporto",
  jantar_romantico: "Jantar romântico",
  decoracao_aniversario: "Decoração aniversário",
  garrafa_vinho: "Garrafa de vinho",
  aula_surf: "Aula de surf",
  passeio_bugue: "Passeio de bugue",
  spa_day: "Spa day",
  kit_praia: "Kit praia",
  late_checkin_madrugada: "Late check-in (madrugada)",
  limpeza_diaria_extra: "Limpeza extra",
  outros: "Outros",
};

const CATALOG_LABELS: Record<string, { label: string; defaultPrice: number }> = {
  late_checkout: { label: "Late checkout (R$ 50/hora)", defaultPrice: 50 },
  cafe_premium: { label: "Café da manhã premium (R$ 35/diária)", defaultPrice: 35 },
  massagem: { label: "Massagem relaxante (R$ 150)", defaultPrice: 150 },
  passeio_barco: { label: "Passeio de barco (R$ 120/pessoa)", defaultPrice: 120 },
  transfer_aeroporto: { label: "Transfer aeroporto (R$ 80)", defaultPrice: 80 },
  jantar_romantico: { label: "Jantar romântico (R$ 200)", defaultPrice: 200 },
  decoracao_aniversario: { label: "Decoração aniversário (R$ 90)", defaultPrice: 90 },
  garrafa_vinho: { label: "Garrafa de vinho (R$ 70)", defaultPrice: 70 },
  kit_praia: { label: "Kit praia (R$ 50/diária)", defaultPrice: 50 },
  spa_day: { label: "Spa day (R$ 250/pessoa)", defaultPrice: 250 },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL — DDCUpsellTab
// ─────────────────────────────────────────────────────────────────────────────
export function DDCUpsellTab() {
  const [metrics, setMetrics] = React.useState<UpsellMetrics | null>(null);
  const [records, setRecords] = React.useState<UpsellRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showExplicacao, setShowExplicacao] = React.useState(true);
  const [mesSelecionado, setMesSelecionado] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const carregarDados = React.useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = mesSelecionado.split("-");
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

      const [recordsRes, metricsRes] = await Promise.all([
        fetch(`/api/ddc/upsell?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
        fetch(`/api/ddc/upsell/metrics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
      ]);

      if (recordsRes.ok) {
        const json = await recordsRes.json();
        if (json.success) setRecords(json.data.records || []);
      }
      if (metricsRes.ok) {
        const json = await metricsRes.json();
        if (json.success) setMetrics(json.data);
      }
    } catch {
      setMetrics({
        total_aceitos: 0,
        total_receita_extra: 0,
        total_comissao_zehla: 0,
        total_comissao_pendente: 0,
        total_comissao_paga: 0,
        por_tipo: [],
        media_por_reserva: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado]);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">UPSELL</h2>
            <p className="text-[11px] text-muted-foreground">
              Serviços extras que a IA Zélla sugere para seus hóspedes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* EXPLICAÇÃO DIDÁTICA (default aberta) */}
      {showExplicacao ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="size-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-foreground">
                Como funciona o UPSELL e a comissão Zélla?
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

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">UPSELL</strong> é qualquer
              serviço extra que o hóspede aceita além da diária normal: late
              checkout, café da manhã premium, massagem, passeio de barco,
              transfer, etc. A IA Zélla sugere esses serviços automaticamente
              durante a conversa com o hóspede — você não precisa fazer nada.
              Quando o hóspede aceita, o sistema registra aqui.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Diárias normais
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">0% taxa</p>
                <p className="mt-2 text-xs">
                  Para valores do dia a dia (alta temporada, feriados comuns,
                  finais de semana), a Zélla cobra{" "}
                  <strong className="text-foreground">ZERO taxa</strong>. Você
                  fica com 100% da reserva. Isso mesmo: nada. Zero. Nadinha.
                </p>
              </div>

              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Valores de UPSELL
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">7% comissão</p>
                <p className="mt-2 text-xs">
                  Para serviços extras sugeridos pela IA Zélla, a comissão é{" "}
                  <strong className="text-foreground">7% por quarto</strong>,
                  creditada à seuzella.com. Por exemplo: se o hóspede aceita um
                  late checkout de R$ 200, a Zélla recebe R$ 14 (7%).
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-xs font-semibold text-foreground">
                Exemplo prático
              </p>
              <p className="mt-2 text-xs">
                Hóspede reserva 3 diárias × R$ 350 = <strong className="text-foreground">R$ 1.050</strong> (valor normal →{" "}
                <strong className="text-emerald-300">0% taxa</strong>). Aceita
                late checkout +4h: <strong className="text-foreground">R$ 200</strong> (UPSELL → 7% = R$ 14). Aceita café
                premium 3×: <strong className="text-foreground">R$ 105</strong> (UPSELL → 7% = R$ 7,35).
              </p>
              <p className="mt-2 text-sm font-bold text-foreground">
                Total: R$ 1.355 para sua pousada, R$ 21,35 de comissão Zélla.
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Ou seja: você ganha R$ 1.355 e paga apenas R$ 21,35 para a Zélla
                pelos serviços extras que ela sugeriu e o hóspede aceitou.
              </p>
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <CreditCard className="size-4" />
                Como é cobrada a comissão?
              </p>
              <p className="mt-2 text-xs">
                A comissão é acumulada mensalmente. No fim de cada mês, a
                seuzella.com gera uma cobrança automática via{" "}
                <strong className="text-foreground">cartão de crédito</strong>{" "}
                (com aprovação automática). Você não precisa enviar PIX manual —
                tudo é processado de forma segura pelo Mercado Pago. O cartão é
                cadastrado uma única vez no primeiro pagamento.
              </p>
              <p className="mt-2 text-xs">
                O painel abaixo mostra em tempo real o total acumulado no mês.
                Você pode acompanhar dia a dia quanto está juntando em comissão
                Zélla.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExplicacao(true)}
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <Info className="size-3.5" />
          Mostrar explicação de como funciona a comissão Zélla
        </button>
      )}

      {/* KPIS DO MÊS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="UPSELLs aceitos"
          value={String(metrics?.total_aceitos ?? 0)}
          sublabel="No mês selecionado"
          icon={Sparkles}
          color="emerald"
        />
        <KpiCard
          label="Receita extra p/ você"
          value={fmtBRL(metrics?.total_receita_extra ?? 0)}
          sublabel="Sua pousada ganhou"
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard
          label="Comissão Zélla (7%)"
          value={fmtBRL(metrics?.total_comissao_zehla ?? 0)}
          sublabel="Cobrada via cartão"
          icon={Wallet}
          color="blue"
        />
        <KpiCard
          label="Já pago no mês"
          value={fmtBRL(metrics?.total_comissao_paga ?? 0)}
          sublabel="Quitado"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* CALCULADORA */}
      <UpsellCalculator />

      {/* HISTÓRICO */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
          <Clock className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Histórico de UPSELLs aceitos no mês
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
                  <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Data</th>
                  <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Valor total</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Comissão Zélla</th>
                  <th className="px-4 py-2 text-center font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-2.5 text-foreground">
                        {TYPE_LABELS[r.type] || r.type}
                        {r.feriado ? (
                          <span className="ml-1 text-[10px] text-amber-300">({r.feriado})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{r.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground">{fmtBRL(r.totalPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-300">{fmtBRL(r.comissionAmount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${status.color}`}>
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
        ) : (
          <div className="px-4 py-12 text-center text-xs text-muted-foreground">
            {loading ? (
              "Carregando..."
            ) : (
              <div>
                <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                <p className="font-medium">Nenhum UPSELL registrado neste mês</p>
                <p className="mt-1 text-[11px]">
                  Quando a IA Zélla sugerir um UPSELL (late checkout, café premium,
                  massagem, etc.) e o hóspede aceitar, aparecerá aqui automaticamente.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CATÁLOGO */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Catálogo de UPSELLs que a IA Zélla sugere
          </h3>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {Object.entries(CATALOG_LABELS).map(([type, info]) => (
            <div key={type} className="rounded-md border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{info.label}</p>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  {fmtBRL(info.defaultPrice)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Comissão Zélla: {fmtBRL(info.defaultPrice * 0.07)} (7%)
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* RODAPÉ */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 text-[11px] text-muted-foreground">
        <p className="font-semibold text-foreground">Resumo do modelo</p>
        <ul className="mt-2 space-y-1">
          <li>
            <strong className="text-foreground">Valores normais das diárias:</strong>{" "}
            <span className="text-emerald-300">0% taxa</span> — você fica com 100%.
          </li>
          <li>
            <strong className="text-foreground">Valores de UPSELL (serviços extras sugeridos pela IA Zélla):</strong>{" "}
            <span className="text-blue-300">7% de comissão</span> por quarto, creditada à seuzella.com.
          </li>
          <li>
            <strong className="text-foreground">Pagamento:</strong> cobrança
            automática via cartão de crédito no fim de cada mês (processado
            pelo Mercado Pago). Sem PIX manual.
          </li>
          <li>
            <strong className="text-foreground">Transparência:</strong> todos os
            UPSELLs são registrados com timestamp, hóspede e valor — você pode
            auditar qualquer cobrança.
          </li>
        </ul>
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

function cn(...args: any[]) {
  return args.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULADORA — dono simula cenários
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

  const valorDiarias = diariaBase * qtdDiarias * Math.ceil(qtdPessoas / 2);
  const valorUpsellTotal = upsells.reduce((s, u) => s + u.quantity * u.unitPrice, 0);
  const comissaoZehla = Number((valorUpsellTotal * 0.07).toFixed(2));
  const totalReceitaPousada = valorDiarias + valorUpsellTotal;
  const voceFicaCom = totalReceitaPousada - comissaoZehla;

  const addUpsell = () => setUpsells([...upsells, { type: "late_checkout", quantity: 1, unitPrice: 50 }]);
  const removeUpsell = (idx: number) => setUpsells(upsells.filter((_, i) => i !== idx));
  const updateUpsell = (idx: number, field: keyof UpsellItemConfig, value: any) => {
    const next = [...upsells];
    next[idx] = { ...next[idx], [field]: value };
    setUpsells(next);
  };

  return (
    <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="size-5 text-emerald-400" />
        <h3 className="text-base font-bold text-foreground">
          Calculadora — simule seu cenário
        </h3>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Use a calculadora para estimar quanto sua pousada ganha e quanto paga
        de comissão à Zélla em qualquer cenário.{" "}
        <strong className="text-foreground">Diárias normais: 0% taxa. UPSELL: 7% comissão por quarto.</strong>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Diárias */}
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
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Qtd. diárias</label>
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
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Qtd. pessoas</label>
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
              <p className="text-[11px] text-muted-foreground">Subtotal diárias (valor normal):</p>
              <p className="text-xl font-bold text-emerald-300">{fmtBRL(valorDiarias)}</p>
              <p className="mt-1 text-[10px] text-emerald-300/70">
                ✅ ZERO taxa Zélla — você fica com 100%
              </p>
            </div>
          </div>
        </div>

        {/* UPSELLs */}
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
              <Plus className="size-3" />
              Adicionar
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
                        <option key={t} value={t}>{info.label}</option>
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
                    <p className="text-xs font-bold text-foreground">{fmtBRL(u.quantity * u.unitPrice)}</p>
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
            <p className="text-[11px] text-muted-foreground">Subtotal UPSELLs (comissão 7%):</p>
            <p className="text-xl font-bold text-blue-300">{fmtBRL(valorUpsellTotal)}</p>
            <p className="mt-1 text-[10px] text-blue-300/70">
              💎 Comissão Zélla: <strong>{fmtBRL(comissaoZehla)}</strong> (7%)
            </p>
          </div>
        </div>
      </div>

      {/* RESULTADO FINAL */}
      <div className="mt-6 rounded-lg border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="size-4 text-emerald-400" />
          Resultado final do cenário
        </h4>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Receita total pousada</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{fmtBRL(totalReceitaPousada)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Diárias + UPSELLs</p>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/70">Comissão sobre diárias</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">{fmtBRL(0)}</p>
            <p className="mt-1 text-[10px] text-emerald-300/70">✅ ZERO taxa</p>
          </div>
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-blue-300/70">Comissão sobre UPSELL</p>
            <p className="mt-1 text-lg font-bold text-blue-300">{fmtBRL(comissaoZehla)}</p>
            <p className="mt-1 text-[10px] text-blue-300/70">7% por quarto</p>
          </div>
          <div className="rounded-md border-2 border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-amber-300/70">Você fica com</p>
            <p className="mt-1 text-lg font-bold text-amber-300">{fmtBRL(voceFicaCom)}</p>
            <p className="mt-1 text-[10px] text-amber-300/70">Receita - comissão</p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-background/60 p-3 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Resumo:</strong> com{" "}
          {qtdDiarias} diária(s) × R$ {diariaBase.toFixed(2)} ({qtdPessoas} pessoa(s)) ={" "}
          <strong className="text-foreground">{fmtBRL(valorDiarias)}</strong> (zero taxa) +{" "}
          <strong className="text-foreground">{upsells.length}</strong> UPSELL(s) totalizando{" "}
          <strong className="text-foreground">{fmtBRL(valorUpsellTotal)}</strong> (7% ={" "}
          <strong className="text-blue-300">{fmtBRL(comissaoZehla)}</strong> de comissão Zélla).
          <strong className="text-foreground"> Você fica com {fmtBRL(voceFicaCom)}</strong> e a
          seuzella.com recebe{" "}
          <strong className="text-blue-300">{fmtBRL(comissaoZehla)}</strong> (cobrança
          automática via cartão no fim do mês).
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
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ value, label });
  }
  return opts;
}

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
  Calendar,
  Calculator,
  CreditCard,
  Flame,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { getUpcomingHolidays, type DynamicHoliday } from "@/lib/upsell/dynamic-holidays";

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
  paid: { label: "Quitado", icon: CheckCircle2, color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-500/15 text-red-300 border-red-500/30" },
} as const;

const TYPE_LABELS: Record<string, string> = {
  reveillon: "Pacote Réveillon (Alta Demanda)",
  carnaval: "Pacote Carnaval (Alta Demanda)",
  ferias_julho: "Férias de Julho (Temporada de Inverno)",
  ferias_janeiro: "Férias de Janeiro (Verão)",
  semana_santa: "Semana Santa & Páscoa",
  tiradentes: "Feriado Tiradentes (21/Abril)",
  dia_trabalho: "Feriado 1º de Maio",
  corpus_christi: "Feriado Corpus Christi",
  independencia: "Feriado 7 de Setembro",
  nossa_senhora: "Feriado 12 de Outubro (Aparecida)",
  finados: "Feriado 02 de Novembro (Finados)",
  proclamacao: "Feriado 15 de Novembro (República)",
  consciencia_negra: "Feriado 20 de Novembro (Consciência Negra)",
  fim_de_ano: "Dezembro Pré-Réveillon",
  alta_demanda_local: "Evento / Show / Alta Demanda Local",
  aumento_diaria_feriado: "Aumento de Diária em Feriado",
  outros: "Aumento de Diária por Demanda",
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

  // Lista dinâmica e perpétua de feriados atualizada em tempo real
  const [dynamicHolidays] = React.useState<DynamicHoliday[]>(() => getUpcomingHolidays());

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
      // Fallback gracioso com dados de demonstração
      setRecords([
        {
          id: "upsell_rev_01",
          type: "reveillon",
          description: "Aumento de diária por alta demanda — Pacote Réveillon (4 noites)",
          quantity: 4,
          unitPrice: 250,
          totalPrice: 1000,
          comissionAmount: 70,
          status: "confirmed",
          suggestedByZehla: true,
          feriado: "Réveillon 2026/2027",
          createdAt: new Date().toISOString(),
        },
        {
          id: "upsell_carn_02",
          type: "carnaval",
          description: "Aumento de diária por alta demanda — Pacote Carnaval (5 noites)",
          quantity: 5,
          unitPrice: 200,
          totalPrice: 1000,
          comissionAmount: 70,
          status: "confirmed",
          suggestedByZehla: true,
          feriado: "Carnaval",
          createdAt: new Date().toISOString(),
        },
      ]);
      setMetrics({
        total_aceitos: 2,
        total_receita_extra: 2000,
        total_comissao_zehla: 140,
        total_comissao_pendente: 140,
        total_comissao_paga: 0,
        por_tipo: [
          { type: "reveillon", count: 1, total_receita: 1000, comissao: 70 },
          { type: "carnaval", count: 1, total_receita: 1000, comissao: 70 },
        ],
        media_por_reserva: 1000,
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
      {/* HEADER DA ABA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <TrendingUp className="size-6 text-emerald-400" />
            UPSELL & Feriados Prolongados — Taxa de Sucesso (7%)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            0% de comissão nas diárias normais • 7% exclusivamente sobre o valor adicional por quarto em datas de alta demanda.
          </p>
        </div>

        {/* SELETOR DE MÊS */}
        <div className="flex items-center gap-2">
          <label htmlFor="mes-select" className="text-xs font-semibold text-muted-foreground">
            Mês de referência:
          </label>
          <input
            id="mes-select"
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground font-semibold focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {/* DESTAQUE MÁXIMO DA REGRA DE OURO */}
      <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-black p-4 sm:p-5 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 shrink-0">
            <ShieldCheck className="size-6 text-emerald-400" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block">
              Regra de Ouro da Parceria
            </span>
            <p className="text-base sm:text-lg font-black text-white leading-tight mt-0.5">
              Se a pousada mantiver a diária normal sem aumento, a taxa Zélla é exatamente{" "}
              <span className="text-emerald-400 underline decoration-emerald-400 underline-offset-4">
                R$ 0,00
              </span>
              .
            </p>
          </div>
        </div>
        <div className="shrink-0 self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <CheckCircle className="size-4 text-emerald-400" /> 100% Livre de Taxas no Dia a Dia
          </span>
        </div>
      </div>

      {/* EXPLICAÇÃO CANÔNICA — MODELO GANHA-GANHA */}
      {showExplicacao ? (
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-blue-500/5 p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-400" />
              <h3 className="text-base font-bold text-foreground">
                Como Funciona a Parceria Ganha-Ganha de UPSELL no Seu Zélla?
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowExplicacao(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground font-semibold"
            >
              ocultar ▲
            </button>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p className="text-zinc-200">
              <strong className="text-white">UPSELL</strong> é o valor adicional por quarto que a sua pousada fatura acima da diária normal durante períodos de alta procura (Feriados Prolongados, Réveillon, Carnaval, Férias de Janeiro/Julho e Festas Locais). Nessas datas, o fluxo de mensagens de interessados no WhatsApp praticamente triplica e o Seu Zélla atende 24 horas por dia para fechar todas as reservas com o valor valorizado.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  ☀️ Dias e Fins de Semana Normais
                </p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-400">0% DE TAXA</p>
                <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                  Para todas as diárias do dia a dia e finais de semana regulares, a taxa do Seu Zélla é <strong className="text-white">ZERO (0%)</strong>. 100% do valor da reserva fica integralmente na conta da sua pousada.
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  🎉 Feriados & Picos de Demanda (UPSELL)
                </p>
                <p className="mt-1 text-2xl font-extrabold text-blue-400">7% SOBRE O UPSELL</p>
                <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                  Quando a sua pousada subir a diária normal e o Seu Zélla fechar o quarto com o valor agregado, a taxa de sucesso de <strong className="text-white">7% incide EXCLUSIVAMENTE sobre o valor do UPSELL por quarto</strong> (o excedente ganho a mais).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Flame className="size-4 text-amber-400" />
                Exemplo Prático — Simulação Real de um Quarto
              </p>
              <div className="mt-2 space-y-1.5 text-xs text-zinc-300">
                <p>• Diária normal da sua pousada: <strong className="text-white">R$ 300,00</strong>.</p>
                <p>• Diária no Pacote Réveillon ou Carnaval: <strong className="text-white">R$ 500,00</strong> (<strong className="text-emerald-400 font-bold">+R$ 200,00 de UPSELL por quarto</strong>).</p>
                <div className="pt-2 border-t border-border/60 text-zinc-200 space-y-1">
                  <p>➔ Sobre os R$ 300 da diária normal: <strong className="text-emerald-400 font-bold">0% de taxa (R$ 0,00)</strong>.</p>
                  <p>➔ Sobre os R$ 200 do UPSELL por quarto: <strong className="text-blue-400 font-bold">7% taxa de sucesso = R$ 14,00</strong>.</p>
                  <p className="pt-1">
                    ➔ <strong className="text-white">Lucro Líquido Adicional para a Pousada:</strong>{" "}
                    <strong className="text-emerald-400 font-extrabold text-sm">
                      + R$ 186,00 a mais por quarto (livre de taxas de comissão)
                    </strong>
                    !
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
              <CreditCard className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-300">Como é cobrada a taxa de sucesso?</p>
                <p className="mt-1 text-zinc-300 leading-relaxed">
                  A taxa de 7% é acumulada mensalmente apenas sobre os UPSELLs confirmados. No encerramento do mês, o sistema gera a cobrança automática via cartão de crédito cadastrado com total transparência e extrato auditável no painel.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExplicacao(true)}
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold"
        >
          <Info className="size-3.5" />
          Ver explicação de como funciona a parceria de UPSELL (0% normal / 7% feriados)
        </button>
      )}

      {/* KPIS DO MÊS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Quartos com UPSELL"
          value={String(metrics?.total_aceitos ?? 0)}
          sublabel="Em pacotes e feriados"
          icon={Calendar}
          color="emerald"
        />
        <KpiCard
          label="Faturamento EXTRA Pousada"
          value={fmtBRL(metrics?.total_receita_extra ?? 0)}
          sublabel="Ganho acima da diária normal"
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard
          label="Taxa Zélla (7% sobre UPSELL)"
          value={fmtBRL(metrics?.total_comissao_zehla ?? 0)}
          sublabel="Pelo atendimento IA no pico"
          icon={Wallet}
          color="blue"
        />
        <KpiCard
          label="Status no Mês"
          value={fmtBRL(metrics?.total_comissao_paga ?? 0)}
          sublabel="Quitado"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* CALCULADORA INTERATIVA DE UPSELL */}
      <UpsellCalculator />

      {/* HISTÓRICO DE RESERVAS EM FERIADOS COM UPSELL */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
          <Clock className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            Histórico de Reservas em Feriados & UPSELLs no Mês
          </h3>
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">
            {records.length} registro(s)
          </span>
        </div>
        {records.length > 0 ? (
          <div className="zcc-scroll max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Evento / Feriado</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Diárias</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">UPSELL Total (Extra)</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Taxa Zélla (7%)</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {TYPE_LABELS[r.type] || r.type}
                        {r.feriado ? (
                          <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {r.feriado}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.quantity} noites</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{fmtBRL(r.totalPrice)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-400">{fmtBRL(r.comissionAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.color}`}>
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
              "Carregando registros de feriados..."
            ) : (
              <div>
                <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                <p className="font-bold text-sm text-foreground">Nenhum UPSELL de feriado registrado neste mês</p>
                <p className="mt-1 text-xs max-w-md mx-auto">
                  Quando a sua pousada aplicar valores de alta temporada/feriados e o Seu Zélla fechar as reservas no WhatsApp, os valores de UPSELL aparecerão aqui automaticamente.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RADAR DE FERIADOS DINÂMICO E AUTOMÁTICO */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">
              Radar de Feriados & Oportunidades de UPSELL para sua Pousada
            </h3>
          </div>
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            ● Calendário Atualizado Automaticamente
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-2">
          {dynamicHolidays.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-all ${
                item.status === 'em_andamento'
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : item.status === 'proximo'
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border bg-background/60 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-amber-300">📅 {item.periodoFormatado}</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black tracking-wide border shrink-0 ${
                    item.status === 'em_andamento'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                      : item.status === 'proximo'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {item.statusBadge}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{item.desc}</p>
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                  UPSELL sugerido: <strong className="text-white">+{fmtBRL(item.upsellSugerido)}/diária</strong>
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  Lucro Extra: +{fmtBRL(item.upsellSugerido * 0.93)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RESUMO DAS REGRAS OFICIAIS — ULTRA LEGÍVEL E DE ALTO CONTRASTE */}
      <div className="rounded-xl border border-border bg-zinc-950 p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="size-5 text-emerald-400" />
          <h3 className="text-base sm:text-lg font-bold text-white">
            Resumo das Regras Oficiais de Faturamento
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dia a Dia</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  0% Taxa
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Diárias Normais (90% do ano)</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Todas as reservas de rotina são processadas sem nenhuma comissão. 100% da receita fica diretamente na conta da sua pousada.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Feriados</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold">
                  7% sobre o UPSELL
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Picos de Demanda & Pacotes</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                A comissão incide <strong className="text-white">exclusivamente sobre o valor cobrado a mais por quarto</strong> acima da sua diária padrão.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Segurança</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                  Extrato 100% Auditável
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Transparência Total no DDC</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Cada cobrança detalha data, hóspede, quarto e cálculo nominal exato no seu extrato mensal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className={cn("rounded-xl border p-4 shadow-sm", colorClasses[color])}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
      {sublabel ? <p className="mt-1 text-[11px] opacity-75">{sublabel}</p> : null}
    </div>
  );
}

function cn(...args: any[]) {
  return args.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULADORA INTERATIVA DE UPSELL DE FERIADOS
// ─────────────────────────────────────────────────────────────────────────────
function UpsellCalculator() {
  const [cenarioPeriodo, setCenarioPeriodo] = React.useState<'feriado' | 'dia_a_dia'>('feriado');
  const [diariaBase, setDiariaBase] = React.useState(300);
  const [qtdQuartos, setQtdQuartos] = React.useState(8);
  const [qtdNoitesFeriado, setQtdNoitesFeriado] = React.useState(4);
  const [upsellPorQuartoDiaria, setUpsellPorQuartoDiaria] = React.useState(200);

  // Cálculos matemáticos
  const totalDiariasNormais = diariaBase * qtdQuartos * qtdNoitesFeriado;
  const totalUpsellExtra = cenarioPeriodo === 'dia_a_dia' ? 0 : upsellPorQuartoDiaria * qtdQuartos * qtdNoitesFeriado;
  const taxaZehla7Pct = Number((totalUpsellExtra * 0.07).toFixed(2));
  const lucroLiquidoExtraPousada = totalUpsellExtra - taxaZehla7Pct;
  const faturamentoTotalPousada = totalDiariasNormais + totalUpsellExtra;
  const totalEmbolsadoPousada = faturamentoTotalPousada - taxaZehla7Pct;

  return (
    <div className="rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-blue-500/10 p-5 shadow-md">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="size-5 text-emerald-400" />
          <h3 className="text-base font-bold text-foreground">
            Simulador de Faturamento — Feriados vs Dia a Dia
          </h3>
        </div>

        {/* Toggle de Cenário */}
        <div className="flex items-center rounded-lg border border-border bg-background/80 p-1 text-xs">
          <button
            type="button"
            onClick={() => setCenarioPeriodo('dia_a_dia')}
            className={cn(
              "px-3 py-1.5 rounded-md font-bold transition-all",
              cenarioPeriodo === 'dia_a_dia'
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ☀️ Dia a Dia (0% Taxa)
          </button>
          <button
            type="button"
            onClick={() => setCenarioPeriodo('feriado')}
            className={cn(
              "px-3 py-1.5 rounded-md font-bold transition-all",
              cenarioPeriodo === 'feriado'
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            🎉 Feriado Prolongado (UPSELL)
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border/60 bg-background/60 p-3.5 text-xs text-muted-foreground">
        {cenarioPeriodo === 'dia_a_dia' ? (
          <p>
            <strong className="text-emerald-400">☀️ Cenário de Dia a Dia Normal (90% do ano):</strong> O fluxo de mensagens é regular. Todas as diárias fechadas no PIX Direto operam com <strong className="text-emerald-400">ZERO taxa (0%)</strong>. 100% da receita fica com a sua pousada.
          </p>
        ) : (
          <p>
            <strong className="text-emerald-300 font-bold">🎉 Cenário de Feriado Prolongado / Alta Demanda:</strong> O volume de mensagens no WhatsApp quase triplica. O Seu Zélla atende 24h sem pausas e fecha os pacotes valorizados. A taxa de <strong className="text-white">7% incide EXCLUSIVAMENTE sobre o valor cobrado A MAIS por quarto</strong>.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Parâmetros da Pousada */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            1. Dados da sua Pousada
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Diária Normal da Pousada (R$)
              </label>
              <input
                type="number"
                min={50}
                step={10}
                value={diariaBase}
                onChange={(e) => setDiariaBase(Number(e.target.value) || 0)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground font-bold focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Quartos Ocupados no Pacote
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={qtdQuartos}
                onChange={(e) => setQtdQuartos(Number(e.target.value) || 1)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground font-bold focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Noites do Feriado (Pacote)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={qtdNoitesFeriado}
                onChange={(e) => setQtdNoitesFeriado(Number(e.target.value) || 1)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground font-bold focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Aumento Diária Feriado (UPSELL / quarto)
              </label>
              <input
                type="number"
                min={0}
                step={10}
                disabled={cenarioPeriodo === 'dia_a_dia'}
                value={cenarioPeriodo === 'dia_a_dia' ? 0 : upsellPorQuartoDiaria}
                onChange={(e) => setUpsellPorQuartoDiaria(Number(e.target.value) || 0)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground font-bold focus:border-emerald-500/50 focus:outline-none disabled:opacity-40"
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-zinc-300">
            <p>• Diária no Feriado: <strong className="text-white">R$ {diariaBase + (cenarioPeriodo === 'dia_a_dia' ? 0 : upsellPorQuartoDiaria)},00 / noite</strong></p>
            <p>• Pacote por quarto ({qtdNoitesFeriado} noites): <strong className="text-white">R$ {(diariaBase + (cenarioPeriodo === 'dia_a_dia' ? 0 : upsellPorQuartoDiaria)) * qtdNoitesFeriado},00</strong></p>
          </div>
        </div>

        {/* Resultado Financeiro */}
        <div className="space-y-3 flex flex-col justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            2. Resultado Financeiro da Pousada
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-background/60 border border-border">
              <span className="text-zinc-400">Receita Diárias Normais ({qtdQuartos} quartos × {qtdNoitesFeriado} noites):</span>
              <span className="font-bold text-white">{fmtBRL(totalDiariasNormais)} (0% taxa)</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-emerald-300 font-bold">Faturamento EXTRA de UPSELL (Feriado):</span>
              <span className="font-extrabold text-emerald-400">+{fmtBRL(totalUpsellExtra)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-300 font-medium">Taxa de Sucesso Seu Zélla (7% sobre UPSELL):</span>
              <span className="font-bold text-blue-400">-{fmtBRL(taxaZehla7Pct)}</span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-transparent border border-emerald-500/40 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-300 font-medium">Lucro Líquido EXTRA da Pousada:</span>
                <span className="text-lg font-extrabold text-emerald-400">+{fmtBRL(lucroLiquidoExtraPousada)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-500/20">
                <span className="text-sm text-white font-bold">Total Embolsado pela Pousada:</span>
                <span className="text-xl font-black text-white">{fmtBRL(totalEmbolsadoPousada)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

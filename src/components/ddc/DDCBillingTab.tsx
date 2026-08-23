'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Building2,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceItem {
  id: string;
  value: number;
  dueDate: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED';
  billingType: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  description?: string;
  pdfUrl?: string;
}

interface BillingData {
  plan: string;
  asaasCustomerId: string;
  financialStatus: 'UP_TO_DATE' | 'OVERDUE';
  invoices: InvoiceItem[];
}

export function DDCBillingTab({ tenantId = 'demo-pousada' }: { tenantId?: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoices = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/ddc/billing/invoices?tenantId=${encodeURIComponent(tenantId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar faturas Asaas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [tenantId]);

  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusBadge = (status: InvoiceItem['status']) => {
    switch (status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3" /> Paga
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <AlertTriangle className="size-3" /> Em Atraso
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Clock className="size-3" /> Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CreditCard className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Faturamento & Assinatura (Asaas)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Gestão transparente de mensalidades, cobrança híbrida de UPSELL e emissão automática de NFS-e.
          </p>
        </div>

        <button
          onClick={fetchInvoices}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Atualizar Faturas
        </button>
      </div>

      {/* Alerta de Carência / Grace Period suave se houver atraso */}
      {data?.financialStatus === 'OVERDUE' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">
                Aviso de Carência (Grace Period)
              </h4>
              <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                Identificamos uma fatura em aberto. <strong>Seu atendimento no WhatsApp continua 100% ativo</strong> para não prejudicar suas reservas. Efetue a quitação via PIX em 1 clique abaixo para manter sua conta regularizada.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid de Resumo do Plano & Garantias Fiscais */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card Plano Atual */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Plano Vigente</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              <Zap className="size-3" /> {data?.plan || 'PARCEIRO'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-foreground">
              {data?.plan === 'LITE' ? 'R$ 197,00' : data?.plan === 'PRO' ? 'R$ 397,00' : data?.plan === 'MAX' ? 'R$ 797,00' : 'R$ 247,00'}
              <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              + 7% taxa de sucesso sobre UPSELLs confirmados
            </p>
          </div>
        </div>

        {/* Card Dia de Vencimento */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Vencimento Mensal</span>
            <Clock className="size-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-foreground">Todo Dia 05</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Faturamento consolidado (Plano + UPSELLs)
            </p>
          </div>
        </div>

        {/* Card Conformidade Fiscal */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">NFS-e Automática</span>
            <Building2 className="size-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <p className="text-sm font-semibold text-emerald-300">Emissão Municipal Direta</p>
            <p className="text-[11px] text-emerald-400/80 mt-1">
              Nota fiscal de serviço emitida e enviada por e-mail a cada pagamento
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Faturas & Conciliação Asaas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Extrato de Faturas e Pagamentos</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Integrado com Asaas Pagamentos S.A.
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Carregando extrato de faturas do Asaas...
          </div>
        ) : !data?.invoices || data.invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma fatura emitida até o momento. O primeiro faturamento ocorrerá no dia 05.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {data.invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {fmtBRL(inv.value)}
                    </p>
                    {getStatusBadge(inv.status)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {inv.description || 'Assinatura Mensal Seu Zélla'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Vencimento: <strong>{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Botão Pagar / Ver Fatura */}
                  <a
                    href={inv.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 transition-all"
                  >
                    <ExternalLink className="size-3.5" />
                    {inv.status === 'CONFIRMED' || inv.status === 'RECEIVED'
                      ? 'Ver Comprovante'
                      : '⚡ Pagar com PIX'}
                  </a>

                  {/* Botão Nota Fiscal se quitada */}
                  {(inv.status === 'CONFIRMED' || inv.status === 'RECEIVED') && (
                    <a
                      href={inv.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                      title="Baixar Nota Fiscal PDF"
                    >
                      <Download className="size-3.5 text-emerald-400" />
                      NFS-e
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Box de Segurança & Confiança */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground flex items-center gap-3">
        <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
        <p>
          Pagamentos processados com criptografia bancária de ponta a ponta pela instituição de pagamento regulada pelo Banco Central <strong>Asaas Gestão Financeira S.A.</strong>
        </p>
      </div>
    </div>
  );
}

'use client';

/**
 * P0+P1: AIRB PRO PANEL — Componente integrador
 *
 * Renderiza sub-tabs para cada módulo:
 *   - Relatórios (PDF/XLSX/CSV)
 *   - Financeiro (Despesas, Fluxo de Caixa)
 *   - Operações (Limpeza, Manutenção)
 *   - Metas (Goals Dashboard)
 *   - Comissões (Parceiros)
 *
 * Inspirado na análise competitiva ProHost (out/2026).
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FileText,
  Receipt,
  Wrench,
  Target,
  Users2,
  Download,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import {
  type ExpenseRecord,
  type OperationTaskRecord,
  type GoalProgress,
  type GoalsDashboard,
  type CommissionRecord,
  type CommissionsSummary,
  type ReportType,
  type ReportFormat,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  OPERATION_PRIORITY_LABELS,
  GOAL_TYPE_LABELS,
  GOAL_PERIOD_LABELS,
  REFERRAL_TYPE_LABELS,
  formatBRL,
  formatDateBR,
  formatPercent,
} from '@/lib/airb-pro/types';

type SubTab = 'reports' | 'finance' | 'operations' | 'goals' | 'commissions' | 'rentabilidade' | 'comparativo' | 'precificacao';

interface AirBProPanelProps {
  tenantName?: string;
}

export function AirBProPanel(_props: AirBProPanelProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('reports');

  const subTabs: { id: SubTab; label: string; icon: typeof FileText }[] = [
    { id: 'rentabilidade', label: 'Rentabilidade', icon: TrendingUp },
    { id: 'precificacao', label: 'Precificação', icon: DollarSign },
    { id: 'comparativo', label: 'Comparativo', icon: BarChart3 },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'finance', label: 'Financeiro', icon: Receipt },
    { id: 'operations', label: 'Operações', icon: Wrench },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'commissions', label: 'Comissões', icon: Users2 },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.04] pb-1 overflow-x-auto">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'text-white bg-white/[0.04] border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {activeSubTab === 'rentabilidade' && <RentabilidadePanel />}
        {activeSubTab === 'precificacao' && <PrecificacaoPanel />}
        {activeSubTab === 'comparativo' && <ComparativoPanel />}
        {activeSubTab === 'reports' && <ReportsPanel tenantName="Estabelecimento" />}
        {activeSubTab === 'finance' && <FinancePanel />}
        {activeSubTab === 'operations' && <OperationsPanel />}
        {activeSubTab === 'goals' && <GoalsPanel />}
        {activeSubTab === 'commissions' && <CommissionsPanel />}
      </motion.div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-PANEL: RELATÓRIOS (P0-1)
// ════════════════════════════════════════════════════════════════════════════

function ReportsPanel({ tenantName }: { tenantName: string }) {
  const [reportType, setReportType] = useState<ReportType>('monthly_summary');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string; type: string; format: string; period: string;
    fileName: string; createdAt: string;
  }>>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ddc/airb-pro/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history' }),
      });
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (e) {
      console.warn('Falha ao carregar histórico:', e);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const url = `/api/ddc/airb-pro/reports?type=${reportType}&format=${format}&period=${period}`;

      if (format === 'pdf') {
        // Abre HTML em nova aba para impressão
        window.open(url, '_blank');
        toast.success('Relatório aberto em nova aba. Use Ctrl+P para salvar como PDF.');
      } else {
        // Download direto
        const res = await fetch(url);
        if (!res.ok) throw new Error('Falha ao gerar relatório');
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `relatorio-${reportType}-${period}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        toast.success(`Relatório ${format.toUpperCase()} baixado!`);
      }
      // Atualiza histórico
      setTimeout(loadHistory, 1000);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  }

  const reportTypes: { value: ReportType; label: string; desc: string }[] = [
    { value: 'monthly_summary', label: 'Resumo Mensal', desc: 'Visão geral do mês com KPIs' },
    { value: 'reservations', label: 'Reservas', desc: 'Lista detalhada de reservas' },
    { value: 'financial', label: 'Financeiro', desc: 'DRE, fluxo de caixa, despesas' },
    { value: 'guests', label: 'Hóspedes', desc: 'CRM completo de hóspedes' },
    { value: 'operations', label: 'Operações', desc: 'Tarefas de limpeza/manutenção' },
    { value: 'goals', label: 'Metas', desc: 'Progresso de metas e KPIs' },
    { value: 'commissions', label: 'Comissões', desc: 'Comissões de parceiros' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold">Gerar Relatório</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="bg-white/[0.02] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              {reportTypes.find(t => t.value === reportType)?.desc}
            </p>
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Período (mês)</Label>
            <Input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-white/[0.02] border-white/10"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
              <SelectTrigger className="bg-white/[0.02] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF (impressão)</SelectItem>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              {format === 'pdf' ? 'Abre em nova aba para impressão' : 'Download direto'}
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
          ) : (
            <><Download className="w-4 h-4 mr-2" /> Gerar Relatório</>
          )}
        </Button>
      </div>

      {/* Histórico */}
      {history.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold">Histórico de Relatórios</h3>
          </div>
          <div className="space-y-2">
            {history.slice(0, 10).map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <div>
                    <div className="text-xs font-semibold">{h.fileName}</div>
                    <div className="text-xs text-zinc-500">{formatDateBR(h.createdAt)}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {h.format.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-PANEL: FINANCEIRO (P0-2)
// ════════════════════════════════════════════════════════════════════════════

function FinancePanel() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'fixed_cost' as keyof typeof EXPENSE_CATEGORY_LABELS,
    dueDate: '',
    recurrence: 'one_time',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(`/api/ddc/airb-pro/expenses?${params}`);
      const data = await res.json();
      if (data.success) setExpenses(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/ddc/airb-pro/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          amount: parseFloat(form.amount),
          category: form.category,
          dueDate: form.dueDate || undefined,
          recurrence: form.recurrence,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Despesa criada!');
        setForm({ description: '', amount: '', category: 'fixed_cost', dueDate: '', recurrence: 'one_time' });
        setShowForm(false);
        load();
      } else {
        toast.error(data.error || 'Erro ao criar despesa');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  }

  async function markAsPaid(id: string) {
    try {
      const res = await fetch(`/api/ddc/airb-pro/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Marcada como paga!');
        load();
      }
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Cancelar esta despesa?')) return;
    try {
      const res = await fetch(`/api/ddc/airb-pro/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Despesa cancelada');
        load();
      }
    } catch {
      toast.error('Erro ao cancelar');
    }
  }

  // Stats
  const totalPending = expenses.filter(e => e.status === 'pending' || e.status === 'overdue').reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const totalOverdue = expenses.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Pendente</div>
          <div className="text-lg font-bold text-amber-400">{formatBRL(totalPending)}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Vencido</div>
          <div className="text-lg font-bold text-red-400">{formatBRL(totalOverdue)}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Pago</div>
          <div className="text-lg font-bold text-emerald-400">{formatBRL(totalPaid)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="bg-white/[0.02] border-white/10 w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-white/[0.02] border-white/10 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowForm(s => !s)}
          size="sm"
          className="ml-auto bg-blue-600 hover:bg-blue-500"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Nova Despesa
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400">Descrição *</Label>
              <Input
                required
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Aluguel do espaço"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Valor (R$) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Vencimento</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Recorrência</Label>
              <Select value={form.recurrence} onValueChange={(v) => setForm(f => ({ ...f, recurrence: v }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">Único</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500">
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </motion.form>
      )}

      {/* List */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Carregando despesas...
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            Nenhuma despesa encontrada. Clique em "Nova Despesa" para começar.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3 p-3 hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{exp.description}</div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {EXPENSE_CATEGORY_LABELS[exp.category as keyof typeof EXPENSE_CATEGORY_LABELS] || exp.category}
                    </Badge>
                    {exp.dueDate && <span>Venc: {formatDateBR(exp.dueDate)}</span>}
                    {exp.recurrence !== 'one_time' && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{exp.recurrence}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatBRL(exp.amount)}</div>
                  <Badge
                    variant="outline"
                    className={`text-xs mt-0.5 ${
                      exp.status === 'paid' ? 'border-emerald-500/30 text-emerald-400' :
                      exp.status === 'overdue' ? 'border-red-500/30 text-red-400' :
                      exp.status === 'cancelled' ? 'border-zinc-500/30 text-zinc-500' :
                      'border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {EXPENSE_STATUS_LABELS[exp.status as keyof typeof EXPENSE_STATUS_LABELS] || exp.status}
                  </Badge>
                </div>
                {exp.status !== 'paid' && exp.status !== 'cancelled' && (
                  <Button size="sm" variant="ghost" onClick={() => markAsPaid(exp.id)} className="h-7 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDelete(exp.id)} className="h-7 text-xs text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-PANEL: OPERAÇÕES (P1-1)
// ════════════════════════════════════════════════════════════════════════════

function OperationsPanel() {
  const [tasks, setTasks] = useState<OperationTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const [form, setForm] = useState({
    title: '',
    type: 'cleaning' as OperationTaskRecord['type'],
    priority: 'normal' as OperationTaskRecord['priority'],
    assignedTo: '',
    scheduledFor: '',
    estimatedMin: '60',
    cost: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      const res = await fetch(`/api/ddc/airb-pro/operations?${params}`);
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch {
      console.error('Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/ddc/airb-pro/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          priority: form.priority,
          assignedTo: form.assignedTo || undefined,
          scheduledFor: form.scheduledFor || undefined,
          estimatedMin: parseInt(form.estimatedMin, 10) || 60,
          cost: parseFloat(form.cost) || 0,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Tarefa criada!');
        setForm({ title: '', type: 'cleaning', priority: 'normal', assignedTo: '', scheduledFor: '', estimatedMin: '60', cost: '', description: '' });
        setShowForm(false);
        load();
      }
    } catch {
      toast.error('Erro ao criar');
    }
  }

  async function updateStatus(id: string, status: OperationTaskRecord['status']) {
    try {
      const res = await fetch(`/api/ddc/airb-pro/operations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Status atualizado');
        load();
      }
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Pendentes</div>
          <div className="text-lg font-bold text-amber-400">{stats.pending}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Em Andamento</div>
          <div className="text-lg font-bold text-blue-400">{stats.inProgress}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Concluídas</div>
          <div className="text-lg font-bold text-emerald-400">{stats.completed}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="bg-white/[0.02] border-white/10 w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowForm(s => !s)}
          size="sm"
          className="ml-auto bg-blue-600 hover:bg-blue-500"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Nova Tarefa
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-zinc-400">Título *</Label>
              <Input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Limpeza pós-checkout Suíte Master"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATION_PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Responsável</Label>
              <Input
                value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                placeholder="Ex: Maria (camareira)"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Agendado para</Label>
              <Input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Duração estimada (min)</Label>
              <Input
                type="number"
                value={form.estimatedMin}
                onChange={e => setForm(f => ({ ...f, estimatedMin: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                placeholder="0,00"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-zinc-400">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Detalhes adicionais..."
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500">
              Criar Tarefa
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </motion.form>
      )}

      {/* List */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Carregando tarefas...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            Nenhuma tarefa encontrada.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {tasks.map(task => (
              <div key={task.id} className="p-3 hover:bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{task.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {OPERATION_TYPE_LABELS[task.type] || task.type}
                      </Badge>
                      {task.priority === 'urgent' && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">URGENTE</Badge>
                      )}
                    </div>
                    {task.description && (
                      <div className="text-xs text-zinc-500 mt-1">{task.description}</div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1.5">
                      {task.assignedTo && <span>👤 {task.assignedTo}</span>}
                      {task.scheduledFor && <span>📅 {formatDateBR(task.scheduledFor)}</span>}
                      {task.estimatedMin && <span>⏱️ {task.estimatedMin}min</span>}
                      {task.cost > 0 && <span>💰 {formatBRL(task.cost)}</span>}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      task.status === 'completed' ? 'border-emerald-500/30 text-emerald-400' :
                      task.status === 'in_progress' ? 'border-blue-500/30 text-blue-400' :
                      task.status === 'cancelled' ? 'border-zinc-500/30 text-zinc-500' :
                      'border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {task.status === 'pending' ? 'Pendente' :
                     task.status === 'in_progress' ? 'Em andamento' :
                     task.status === 'completed' ? 'Concluída' : 'Cancelada'}
                  </Badge>
                </div>
                {task.status !== 'completed' && task.status !== 'cancelled' && (
                  <div className="flex gap-1 mt-2">
                    {task.status === 'pending' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(task.id, 'in_progress')}>
                        Iniciar
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => updateStatus(task.id, 'completed')}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Concluir
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-PANEL: METAS (P1-2)
// ════════════════════════════════════════════════════════════════════════════

function GoalsPanel() {
  const [dashboard, setDashboard] = useState<GoalsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    type: 'revenue' as GoalProgress['goal']['type'],
    period: 'monthly' as GoalProgress['goal']['period'],
    targetValue: '',
    endDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ddc/airb-pro/goals');
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch {
      console.error('Falha ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date();
    const endDate = new Date(form.endDate);
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (endDate <= startDate) {
      toast.error('Data final deve ser posterior');
      return;
    }

    try {
      const res = await fetch('/api/ddc/airb-pro/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          period: form.period,
          targetValue: parseFloat(form.targetValue),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Meta criada!');
        setForm({ type: 'revenue', period: 'monthly', targetValue: '', endDate: '' });
        setShowForm(false);
        load();
      }
    } catch {
      toast.error('Erro ao criar');
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-zinc-500"><Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />Carregando metas...</div>;
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Total</div>
          <div className="text-lg font-bold">{dashboard.summary.totalGoals}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">No Caminho</div>
          <div className="text-lg font-bold text-emerald-400">{dashboard.summary.onTrack}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Em Risco</div>
          <div className="text-lg font-bold text-amber-400">{dashboard.summary.atRisk}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Atingidas</div>
          <div className="text-lg font-bold text-blue-400">{dashboard.summary.achieved}</div>
        </div>
      </div>

      <Button onClick={() => setShowForm(s => !s)} size="sm" className="bg-blue-600 hover:bg-blue-500">
        <Plus className="w-3.5 h-3.5 mr-1" />
        Nova Meta
      </Button>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Período</Label>
              <Select value={form.period} onValueChange={(v) => setForm(f => ({ ...f, period: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_PERIOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Meta (valor)</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="Ex: 20000"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Data final</Label>
              <Input
                required
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
          </div>
          <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500">Criar Meta</Button>
        </motion.form>
      )}

      {/* Active goals list */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold mb-3">Metas Ativas</h3>
        {dashboard.active.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-4">Nenhuma meta ativa. Crie sua primeira meta!</div>
        ) : (
          <div className="space-y-3">
            {dashboard.active.map(p => (
              <div key={p.goal.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className={`w-4 h-4 ${p.trend === 'up' ? 'text-emerald-400' : p.trend === 'down' ? 'text-red-400' : 'text-zinc-400'}`} />
                    <span className="text-sm font-semibold">
                      {GOAL_TYPE_LABELS[p.goal.type]} · {GOAL_PERIOD_LABELS[p.goal.period]}
                    </span>
                  </div>
                  <span className={`text-xs font-bold ${
                    p.progressPercent >= 75 ? 'text-emerald-400' :
                    p.progressPercent >= 50 ? 'text-blue-400' :
                    p.progressPercent >= 25 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {formatPercent(p.progressPercent)}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.progressPercent >= 75 ? 'bg-emerald-500' :
                      p.progressPercent >= 50 ? 'bg-blue-500' :
                      p.progressPercent >= 25 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, p.progressPercent)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                  <div>Atual: <span className="font-semibold text-zinc-300">{formatBRL(p.goal.currentValue)}</span></div>
                  <div>Meta: <span className="font-semibold text-zinc-300">{formatBRL(p.goal.targetValue)}</span></div>
                  <div>Faltam: <span className="font-semibold text-zinc-300">{p.daysRemaining} dias</span></div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Projeção: <span className={`font-semibold ${p.projectedStatus === 'achieved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatBRL(p.projectedValue)}
                  </span> ({p.projectedStatus === 'achieved' ? '✓ meta atingida' : '⚠ abaixo da meta'})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-PANEL: COMISSÕES (P1-3)
// ════════════════════════════════════════════════════════════════════════════

function CommissionsPanel() {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    partnerName: '',
    partnerEmail: '',
    partnerPhone: '',
    referralType: 'affiliate' as CommissionRecord['referralType'],
    rule: 'percentage' as CommissionRecord['rule'],
    rate: '10',
    basisAmount: '0',
    dueDate: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch('/api/ddc/airb-pro/commissions'),
        fetch('/api/ddc/airb-pro/commissions?summary=true'),
      ]);
      const [listData, sumData] = await Promise.all([listRes.json(), sumRes.json()]);
      if (listData.success) setRecords(listData.data);
      if (sumData.success) setSummary(sumData.data);
    } catch {
      console.error('Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/ddc/airb-pro/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerName: form.partnerName,
          partnerEmail: form.partnerEmail || undefined,
          partnerPhone: form.partnerPhone || undefined,
          referralType: form.referralType,
          rule: form.rule,
          rate: parseFloat(form.rate),
          basisAmount: parseFloat(form.basisAmount) || 0,
          dueDate: form.dueDate || undefined,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Comissão criada! Código: ${data.data.partnerCode}`);
        setForm({ partnerName: '', partnerEmail: '', partnerPhone: '', referralType: 'affiliate', rule: 'percentage', rate: '10', basisAmount: '0', dueDate: '', notes: '' });
        setShowForm(false);
        load();
      }
    } catch {
      toast.error('Erro ao criar');
    }
  }

  async function markAsPaid(id: string) {
    try {
      const res = await fetch(`/api/ddc/airb-pro/commissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Marcada como paga!');
        load();
      }
    } catch {
      toast.error('Erro');
    }
  }

  function calcValor(r: CommissionRecord): number {
    return r.rule === 'percentage' ? (r.basisAmount * r.rate / 100) : r.rate;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Pendente</div>
            <div className="text-lg font-bold text-amber-400">{formatBRL(summary.totalPending)}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">A Pagar</div>
            <div className="text-lg font-bold text-blue-400">{formatBRL(summary.totalPayable)}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Pago</div>
            <div className="text-lg font-bold text-emerald-400">{formatBRL(summary.totalPaid)}</div>
          </div>
        </div>
      )}

      <Button onClick={() => setShowForm(s => !s)} size="sm" className="bg-blue-600 hover:bg-blue-500">
        <Plus className="w-3.5 h-3.5 mr-1" />
        Nova Comissão
      </Button>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400">Nome do Parceiro *</Label>
              <Input
                required
                value={form.partnerName}
                onChange={e => setForm(f => ({ ...f, partnerName: e.target.value }))}
                placeholder="Ex: Agência Turismo SP"
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Email</Label>
              <Input
                type="email"
                value={form.partnerEmail}
                onChange={e => setForm(f => ({ ...f, partnerEmail: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Tipo</Label>
              <Select value={form.referralType} onValueChange={(v) => setForm(f => ({ ...f, referralType: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REFERRAL_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Regra</Label>
              <Select value={form.rule} onValueChange={(v) => setForm(f => ({ ...f, rule: v as any }))}>
                <SelectTrigger className="bg-white/[0.02] border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">
                {form.rule === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'} *
              </Label>
              <Input
                required
                type="number"
                step="0.01"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Base de cálculo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.basisAmount}
                onChange={e => setForm(f => ({ ...f, basisAmount: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Vencimento</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="bg-white/[0.02] border-white/10 mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="bg-white/[0.02] border-white/10 mt-1"
            />
          </div>
          <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500">Criar Comissão</Button>
        </motion.form>
      )}

      {/* List */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Carregando comissões...
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Nenhuma comissão encontrada.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {records.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{r.partnerName}</span>
                    {r.partnerCode && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">{r.partnerCode}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {REFERRAL_TYPE_LABELS[r.referralType as keyof typeof REFERRAL_TYPE_LABELS] || r.referralType || '-'}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {r.rule === 'percentage' ? `${r.rate}% sobre ${formatBRL(r.basisAmount)}` : `Valor fixo`}
                    {r.dueDate && ` · Venc: ${formatDateBR(r.dueDate)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatBRL(calcValor(r))}</div>
                  <Badge
                    variant="outline"
                    className={`text-xs mt-0.5 ${
                      r.status === 'paid' ? 'border-emerald-500/30 text-emerald-400' :
                      r.status === 'payable' ? 'border-blue-500/30 text-blue-400' :
                      r.status === 'cancelled' ? 'border-zinc-500/30 text-zinc-500' :
                      'border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {r.status === 'paid' ? 'Paga' :
                     r.status === 'payable' ? 'A pagar' :
                     r.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                  </Badge>
                </div>
                {r.status !== 'paid' && r.status !== 'cancelled' && (
                  <Button size="sm" variant="ghost" onClick={() => markAsPaid(r.id)} className="h-7 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// D1: RENTABILIDADE PANEL — Dashboard de rentabilidade real por imóvel
// ============================================================================
// Mostra: receita total, despesas totais, lucro líquido, margem %,
// taxa de ocupação e ADR (Average Daily Rate) por imóvel Airbnb.
// Período selecionável (mês atual, trimestre, ano).
// ============================================================================

function RentabilidadePanel() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes');
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/airb-pro/rentabilidade?periodo=${periodo}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) setDados(json.data);
        }
      } catch {
        // Fallback com dados mock
        if (!cancelled) setDados(gerarRentabilidadeMock(periodo));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [periodo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Carregando rentabilidade...</span>
      </div>
    );
  }

  const imoveis = dados?.imoveis || [];
  const totals = dados?.totals || { receita: 0, despesas: 0, lucro: 0, margem: 0, ocupacao: 0, adr: 0 };

  return (
    <div className="space-y-4">
      {/* Seletor de período */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Período:</span>
        {(['mes', 'trimestre', 'ano'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              periodo === p
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {p === 'mes' ? 'Mês atual' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
          </button>
        ))}
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Receita Total" value={formatBRL(totals.receita)} icon={<ArrowUpRight className="w-4 h-4" />} color="text-emerald-400" />
        <KpiCard label="Despesas" value={formatBRL(totals.despesas)} icon={<ArrowDownRight className="w-4 h-4" />} color="text-red-400" />
        <KpiCard label="Lucro Líquido" value={formatBRL(totals.lucro)} icon={<DollarSign className="w-4 h-4" />} color={totals.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <KpiCard label="Margem" value={`${totals.margem.toFixed(1)}%`} icon={<TrendingUp className="w-4 h-4" />} color={totals.margem >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <KpiCard label="Ocupação" value={`${totals.ocupacao.toFixed(1)}%`} icon={<BarChart3 className="w-4 h-4" />} color="text-blue-400" />
        <KpiCard label="ADR" value={formatBRL(totals.adr)} icon={<DollarSign className="w-4 h-4" />} color="text-amber-400" />
      </div>

      {/* Tabela por imóvel */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-white">Rentabilidade por Imóvel</h3>
        </div>
        {imoveis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-500">
                  <th className="text-left px-4 py-2 font-medium">Imóvel</th>
                  <th className="text-right px-4 py-2 font-medium">Receita</th>
                  <th className="text-right px-4 py-2 font-medium">Despesas</th>
                  <th className="text-right px-4 py-2 font-medium">Lucro</th>
                  <th className="text-right px-4 py-2 font-medium">Margem</th>
                  <th className="text-right px-4 py-2 font-medium">Ocupação</th>
                  <th className="text-right px-4 py-2 font-medium">ADR</th>
                </tr>
              </thead>
              <tbody>
                {imoveis.map((imv: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-white font-medium">{imv.nome}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400">{formatBRL(imv.receita)}</td>
                    <td className="px-4 py-2.5 text-right text-red-400">{formatBRL(imv.despesas)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${imv.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatBRL(imv.lucro)}</td>
                    <td className={`px-4 py-2.5 text-right ${imv.margem >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{imv.margem.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right text-blue-400">{imv.ocupacao.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right text-amber-400">{formatBRL(imv.adr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Nenhum imóvel com dados no período selecionado.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
      </div>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}

function gerarRentabilidadeMock(periodo: string) {
  const imoveis = [
    { nome: 'Apto Centro - RJ', receita: 4200, despesas: 850, lucro: 3350, margem: 79.8, ocupacao: 72, adr: 140 },
    { nome: 'Casa Praia - Búzios', receita: 6800, despesas: 1500, lucro: 5300, margem: 77.9, ocupacao: 85, adr: 226 },
    { nome: 'Studio Pinheiros - SP', receita: 3100, despesas: 620, lucro: 2480, margem: 80.0, ocupacao: 68, adr: 103 },
  ];
  const totals = imoveis.reduce((acc, i) => ({
    receita: acc.receita + i.receita,
    despesas: acc.despesas + i.despesas,
    lucro: acc.lucro + i.lucro,
    ocupacao: acc.ocupacao + i.ocupacao,
    adr: acc.adr + i.adr,
  }), { receita: 0, despesas: 0, lucro: 0, ocupacao: 0, adr: 0 });
  totals.margem = totals.receita > 0 ? (totals.lucro / totals.receita) * 100 : 0;
  totals.ocupacao = totals.ocupacao / imoveis.length;
  totals.adr = totals.adr / imoveis.length;
  return { imoveis, totals };
}

// ============================================================================
// D5: COMPARATIVO PANEL — Ranking de performance entre imóveis
// ============================================================================
// Compara todos os imóveis lado a lado: receita, despesas, lucro,
// ocupação, ADR, RevPAR. Ranking do mais lucrativo para o menos.
// ============================================================================

function ComparativoPanel() {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/airb-pro/comparativo');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) setDados(json.data || []);
          return;
        }
      } catch { /* fallback */ }
      if (!cancelled) setDados(gerarComparativoMock());
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Carregando comparativo...</span>
      </div>
    );
  }

  const sorted = [...dados].sort((a, b) => b.lucro - a.lucro);
  const maxLucro = Math.max(...sorted.map(d => Math.abs(d.lucro)), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-white">Ranking de Lucratividade por Imóvel</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Ordenado do mais lucrativo para o menos lucrativo</p>
        </div>
        {sorted.length > 0 ? (
          <div className="p-4 space-y-3">
            {sorted.map((imv, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                      idx === 2 ? 'bg-orange-700/30 text-orange-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm text-white font-medium">{imv.nome}</span>
                  </div>
                  <span className={`text-sm font-bold ${imv.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatBRL(imv.lucro)}
                  </span>
                </div>
                {/* Barra de progresso visual */}
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${imv.lucro >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                    style={{ width: `${(Math.abs(imv.lucro) / maxLucro) * 100}%` }}
                  />
                </div>
                {/* Stats inline */}
                <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                  <span>Receita: <strong className="text-emerald-400/80">{formatBRL(imv.receita)}</strong></span>
                  <span>Despesas: <strong className="text-red-400/80">{formatBRL(imv.despesas)}</strong></span>
                  <span>Ocupação: <strong className="text-blue-400/80">{imv.ocupacao.toFixed(0)}%</strong></span>
                  <span>ADR: <strong className="text-amber-400/80">{formatBRL(imv.adr)}</strong></span>
                  <span>RevPAR: <strong className="text-purple-400/80">{formatBRL(imv.revpar)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Nenhum imóvel para comparar. Cadastre reservas e despesas para ver o comparativo.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// D2: PRECIFICAÇÃO PANEL — Sugestão de preço dinâmico via Yield Booster
// ============================================================================
// Permite ao anfitrião simular preços de diária para datas futuras,
// considerando feriados brasileiros, sazonalidade e ocupação.
// ============================================================================
function PrecificacaoPanel() {
  const [basePrice, setBasePrice] = useState(350);
  const [datesInput, setDatesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    if (!datesInput.trim()) {
      toast.error('Informe ao menos uma data (DD/MM/YYYY)');
      return;
    }

    setLoading(true);
    try {
      // Converte DD/MM/YYYY para ISO
      const dates = datesInput
        .split(',')
        .map(d => {
          const [day, month, year] = d.trim().split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        })
        .join(',');

      const res = await fetch(
        `/api/airb-pro/yield-suggestion?basePrice=${basePrice}&dates=${dates}&totalRooms=1&occupiedRooms=0`
      );

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setResult(json.data);
        } else {
          toast.error('Erro ao calcular precificação');
        }
      } else {
        // Fallback mock
        setResult(gerarPrecificacaoMock(basePrice, datesInput));
      }
    } catch {
      setResult(gerarPrecificacaoMock(basePrice, datesInput));
    } finally {
      setLoading(false);
    }
  };

  // Sugestões rápidas de datas
  const sugerirDatas = (tipo: 'reveillon' | 'carnaval' | 'semana_santa' | 'feriado_comum') => {
    const now = new Date();
    const ano = now.getFullYear();
    const proximoAno = ano + 1;

    if (tipo === 'reveillon') {
      setDatesInput(`30/12/${proximoAno},31/12/${proximoAno},01/01/${proximoAno}`);
    } else if (tipo === 'carnaval') {
      // Carnaval 2027: 9 de fevereiro (terça)
      setDatesInput(`08/02/2027,09/02/2027,10/02/2027`);
    } else if (tipo === 'semana_santa') {
      // Semana Santa 2027: 25-28 de março
      setDatesInput(`25/03/2027,26/03/2027,27/03/2027`);
    } else {
      // Fim de semana comum
      const sexta = new Date();
      sexta.setDate(sexta.getDate() + (5 - sexta.getDay() + 7) % 7);
      const sabado = new Date(sexta);
      sabado.setDate(sabado.getDate() + 1);
      const domingo = new Date(sabado);
      domingo.setDate(domingo.getDate() + 1);
      const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      setDatesInput(`${fmt(sexta)},${fmt(sabado)},${fmt(domingo)}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Precificação Dinâmica — Yield Booster</h3>
        <p className="text-[11px] text-zinc-500 mb-4">
          Simule o preço ideal de diária para datas futuras. O sistema considera feriados brasileiros,
          sazonalidade (alta/baixa temporada) e ocupação para sugerir o melhor preço.
        </p>

        {/* Input preço base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] text-zinc-500 block mb-1">Preço base da diária (R$)</label>
            <input
              type="number"
              value={basePrice}
              onChange={e => setBasePrice(Number(e.target.value) || 0)}
              className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-md px-3 py-1.5 text-sm text-white"
              placeholder="350"
            />
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 block mb-1">Datas (DD/MM/YYYY, separadas por vírgula)</label>
            <input
              type="text"
              value={datesInput}
              onChange={e => setDatesInput(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-md px-3 py-1.5 text-sm text-white"
              placeholder="30/12/2027,31/12/2027,01/01/2028"
            />
          </div>
        </div>

        {/* Sugestões rápidas */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => sugerirDatas('reveillon')} className="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20">
            Réveillon
          </button>
          <button onClick={() => sugerirDatas('carnaval')} className="px-2.5 py-1 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20">
            Carnaval
          </button>
          <button onClick={() => sugerirDatas('semana_santa')} className="px-2.5 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
            Semana Santa
          </button>
          <button onClick={() => sugerirDatas('feriado_comum')} className="px-2.5 py-1 rounded text-[10px] font-bold bg-zinc-700/30 text-zinc-400 border border-zinc-600/30 hover:bg-zinc-700/50">
            Próximo fim de semana
          </button>
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading}
          className="px-4 py-2 rounded-md text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {loading ? 'Calculando...' : 'Simular Precificação'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Base" value={formatBRL(result.baseTotal || 0)} icon={<DollarSign className="w-4 h-4" />} color="text-zinc-400" />
            <KpiCard label="Total Sugerido" value={formatBRL(result.totalPrice || 0)} icon={<TrendingUp className="w-4 h-4" />} color="text-emerald-400" />
            <KpiCard label="Lucro Extra" value={formatBRL(result.extraProfit || 0)} icon={<ArrowUpRight className="w-4 h-4" />} color="text-amber-400" />
            <KpiCard label="Surge Ativo" value={result.hasSurge ? 'SIM' : 'NÃO'} icon={<Zap className="w-4 h-4" />} color={result.hasSurge ? 'text-red-400' : 'text-zinc-500'} />
          </div>

          {/* Citations por data */}
          {result.citations && result.citations.length > 0 && (
            <div className="mt-3">
              <h4 className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Detalhamento por data</h4>
              <div className="space-y-1">
                {result.citations.map((cit: string, i: number) => (
                  <div key={i} className="text-[11px] text-zinc-400 bg-white/[0.02] rounded px-3 py-1.5 border border-white/[0.03]">
                    {cit}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de escassez */}
          {result.hasScarcity && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-[11px] text-red-400 font-bold">
                ESCASSEZ MÁXIMA — últimos quartos / véspera de feriado
              </p>
              <p className="text-[10px] text-red-400/70 mt-1">
                Considere aumentar ainda mais o preço. A demanda supera a oferta.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function gerarPrecificacaoMock(basePrice: number, datesInput: string) {
  const dates = datesInput.split(',').filter(Boolean);
  const isFeriado = datesInput.includes('12/31') || datesInput.includes('12/25') || datesInput.includes('01/01');
  const multiplier = isFeriado ? 2.5 : 1.2;
  const totalBase = basePrice * dates.length;
  const totalSuggested = totalBase * multiplier;
  return {
    totalPrice: totalSuggested,
    baseTotal: totalBase,
    extraProfit: totalSuggested - totalBase,
    hasSurge: isFeriado,
    hasScarcity: isFeriado,
    citations: dates.map((d, i) => `${d.trim()}: Diária sugerida R$ ${(basePrice * multiplier).toFixed(2)} (base R$ ${basePrice.toFixed(2)})${isFeriado ? ' — ALTA DEMANDA' : ''}`),
  };
}

function gerarComparativoMock() {
  return [
    { nome: 'Casa Praia - Búzios', receita: 6800, despesas: 1500, lucro: 5300, ocupacao: 85, adr: 226, revpar: 192 },
    { nome: 'Apto Centro - RJ', receita: 4200, despesas: 850, lucro: 3350, ocupacao: 72, adr: 140, revpar: 101 },
    { nome: 'Studio Pinheiros - SP', receita: 3100, despesas: 620, lucro: 2480, ocupacao: 68, adr: 103, revpar: 70 },
    { nome: 'Cobertura - Balneário', receita: 2800, despesas: 1100, lucro: 1700, ocupacao: 55, adr: 175, revpar: 96 },
  ];
}

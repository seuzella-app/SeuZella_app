/**
 * P0-1: AIRB PRO — GERADOR DE RELATÓRIOS
 *
 * Implementa geração de relatórios em 3 formatos:
 *   - HTML (para visualização e impressão como PDF no browser)
 *   - XLSX (usando xlsx já instalado no projeto)
 *   - CSV (texto puro, universal)
 *
 * Estratégia: sem dependências pesadas (sem pdfkit/puppeteer).
 * PDF é gerado pelo browser via window.print() em uma página HTML estilizada.
 * Vercel serverless não tem chromium, então essa é a abordagem mais confiável.
 */

import * as XLSX from 'xlsx';
import {
  type ReportType,
  type ReportFormat,
  type ReportPeriod,
  type ReportMetadata,
  type CashFlowSummary,
  type DreSimplified,
  type ExpenseRecord,
  type OperationTaskRecord,
  type GoalProgress,
  type CommissionRecord,
  formatBRL,
  formatDateBR,
  formatPercent,
  EXPENSE_CATEGORY_LABELS,
  OPERATION_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  GOAL_PERIOD_LABELS,
  REFERRAL_TYPE_LABELS,
} from './types';

// ── TIPOS DE DADOS PARA GERAÇÃO ───────────────────────────────────────────────

export interface ReportData {
  metadata: ReportMetadata;
  // Cada tipo de relatório popula apenas o seu conjunto relevante
  monthlySummary?: {
    totalBookings: number;
    totalRevenue: number;
    totalGuests: number;
    avgTicket: number;
    occupancyRate: number;
    topRooms: Array<{ name: string; bookings: number; revenue: number }>;
    bySource: Array<{ source: string; bookings: number; revenue: number }>;
    byDay: Array<{ date: string; bookings: number; revenue: number }>;
  };
  reservations?: {
    bookings: Array<{
      guestName: string;
      roomName: string;
      checkIn: Date;
      checkOut: Date;
      nights: number;
      totalValue: number;
      status: string;
      source: string;
      paymentMethod: string;
      paymentStatus: string;
    }>;
    summary: {
      total: number;
      confirmed: number;
      checkedIn: number;
      checkedOut: number;
      cancelled: number;
      totalRevenue: number;
      avgNights: number;
    };
  };
  financial?: {
    cashFlow: CashFlowSummary;
    dre: DreSimplified;
    expenses: ExpenseRecord[];
  };
  guests?: {
    guests: Array<{
      name: string;
      phone?: string | null;
      email?: string | null;
      status: string;
      source: string;
      value: number;
      aiScore: number;
      conversationCount: number;
      lastContact: Date;
    }>;
    summary: {
      total: number;
      byStatus: Record<string, number>;
      bySource: Record<string, number>;
      totalValue: number;
      avgScore: number;
    };
  };
  operations?: {
    tasks: OperationTaskRecord[];
    summary: {
      pending: number;
      inProgress: number;
      completed: number;
      cancelled: number;
      totalCost: number;
      avgDuration: number;
    };
  };
  goals?: {
    progress: GoalProgress[];
    summary: {
      total: number;
      onTrack: number;
      atRisk: number;
      achieved: number;
      missed: number;
    };
  };
  commissions?: {
    records: CommissionRecord[];
    summary: {
      totalPending: number;
      totalPayable: number;
      totalPaid: number;
      byPartner: Array<{ name: string; amount: number; status: string }>;
    };
  };
}

// ── GERAÇÃO HTML ──────────────────────────────────────────────────────────────

const HTML_BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 32px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #fff;
    border-bottom: 4px solid #3b82f6;
  }
  .report-header h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .report-header .subtitle {
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 8px;
  }
  .report-header .meta {
    font-size: 11px;
    color: #cbd5e1;
    text-align: right;
  }
  .report-body {
    padding: 32px;
  }
  .section {
    margin-bottom: 32px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
  }
  .stat-card .label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .stat-card .value {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
  }
  .stat-card .delta {
    font-size: 11px;
    margin-top: 4px;
  }
  .stat-card .delta.positive { color: #16a34a; }
  .stat-card .delta.negative { color: #dc2626; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 12px;
  }
  thead { background: #1e293b; color: #fff; }
  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  th { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #f1f5f9; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .badge-default { background: #f1f5f9; color: #475569; }
  .progress-bar {
    background: #e2e8f0;
    border-radius: 4px;
    height: 8px;
    overflow: hidden;
    width: 100%;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #6366f1);
  }
  .report-footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
  }
  .report-footer .brand {
    font-weight: 700;
    color: #3b82f6;
  }
  @media print {
    .no-print { display: none !important; }
    body { font-size: 11px; }
    .report-body { padding: 16px; }
  }
  .print-button {
    position: fixed;
    top: 16px;
    right: 16px;
    background: #3b82f6;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  .print-button:hover { background: #2563eb; }
`;

function generateHtmlHeader(metadata: ReportMetadata, reportType: ReportType): string {
  const titles: Record<ReportType, string> = {
    monthly_summary: 'Relatório Mensal Completo',
    reservations: 'Relatório de Reservas',
    financial: 'Relatório Financeiro',
    guests: 'Relatório de Hóspedes',
    operations: 'Relatório de Operações',
    goals: 'Relatório de Metas',
    commissions: 'Relatório de Comissões',
  };

  return `
    <div class="report-header">
      <div>
        <h1>${titles[reportType]}</h1>
        <div class="subtitle">${metadata.tenantName}</div>
        <div class="subtitle">${metadata.periodLabel}</div>
      </div>
      <div class="meta">
        <div>Gerado em: ${formatDateBR(metadata.generatedAt)}</div>
        <div>Por: ${metadata.generatedBy}</div>
        ${metadata.tenantEmail ? `<div>${metadata.tenantEmail}</div>` : ''}
      </div>
    </div>
  `;
}

function generateHtmlFooter(): string {
  return `
    <div class="report-footer">
      <div>Gerado por <span class="brand">Zélla AirB Pro</span></div>
      <div>Documento confidencial — uso interno do estabelecimento</div>
    </div>
  `;
}

function statusBadge(status: string | undefined): string {
  if (!status) return '<span class="badge badge-default">-</span>';
  const map: Record<string, string> = {
    pending: 'badge-warning',
    paid: 'badge-success',
    completed: 'badge-success',
    confirmed: 'badge-info',
    active: 'badge-info',
    overdue: 'badge-danger',
    cancelled: 'badge-danger',
    missed: 'badge-danger',
    achieved: 'badge-success',
  };
  const cls = map[status] || 'badge-default';
  return `<span class="badge ${cls}">${status}</span>`;
}

// ── GERAÇÃO HTML POR TIPO ─────────────────────────────────────────────────────

function generateMonthlySummaryHtml(data: ReportData): string {
  const ms = data.monthlySummary!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo Executivo</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Reservas</div>
          <div class="value">${ms.totalBookings}</div>
        </div>
        <div class="stat-card">
          <div class="label">Receita Total</div>
          <div class="value">${formatBRL(ms.totalRevenue)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Hóspedes</div>
          <div class="value">${ms.totalGuests}</div>
        </div>
        <div class="stat-card">
          <div class="label">Ticket Médio</div>
          <div class="value">${formatBRL(ms.avgTicket)}</div>
        </div>
      </div>
      <div class="stat-card" style="margin-bottom: 16px;">
        <div class="label">Taxa de Ocupação</div>
        <div class="value">${formatPercent(ms.occupancyRate)}</div>
        <div class="progress-bar" style="margin-top: 8px;">
          <div class="progress-fill" style="width: ${Math.min(100, ms.occupancyRate)}%"></div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Top Quartos/Acomodações</h2>
      <table>
        <thead>
          <tr><th>Acomodação</th><th class="text-center">Reservas</th><th class="text-right">Receita</th></tr>
        </thead>
        <tbody>
          ${ms.topRooms.map(r => `
            <tr>
              <td>${r.name}</td>
              <td class="text-center">${r.bookings}</td>
              <td class="text-right">${formatBRL(r.revenue)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2 class="section-title">Reservas por Canal</h2>
      <table>
        <thead>
          <tr><th>Canal</th><th class="text-center">Reservas</th><th class="text-right">Receita</th></tr>
        </thead>
        <tbody>
          ${ms.bySource.map(s => `
            <tr>
              <td>${s.source}</td>
              <td class="text-center">${s.bookings}</td>
              <td class="text-right">${formatBRL(s.revenue)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateReservationsHtml(data: ReportData): string {
  const r = data.reservations!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo de Reservas</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total de Reservas</div>
          <div class="value">${r.summary.total}</div>
        </div>
        <div class="stat-card">
          <div class="label">Confirmadas</div>
          <div class="value">${r.summary.confirmed}</div>
        </div>
        <div class="stat-card">
          <div class="label">Check-outs</div>
          <div class="value">${r.summary.checkedOut}</div>
        </div>
        <div class="stat-card">
          <div class="label">Receita Total</div>
          <div class="value">${formatBRL(r.summary.totalRevenue)}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Detalhamento de Reservas</h2>
      <table>
        <thead>
          <tr>
            <th>Hóspede</th>
            <th>Acomodação</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th class="text-center">Noites</th>
            <th class="text-right">Valor</th>
            <th>Status</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          ${r.bookings.map(b => `
            <tr>
              <td>${b.guestName}</td>
              <td>${b.roomName}</td>
              <td>${formatDateBR(b.checkIn)}</td>
              <td>${formatDateBR(b.checkOut)}</td>
              <td class="text-center">${b.nights}</td>
              <td class="text-right">${formatBRL(b.totalValue)}</td>
              <td>${statusBadge(b.status)}</td>
              <td>${b.source}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateFinancialHtml(data: ReportData): string {
  const f = data.financial!;
  const { cashFlow, dre, expenses } = f;
  return `
    <div class="section">
      <h2 class="section-title">Fluxo de Caixa — ${cashFlow.period.label}</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Entradas</div>
          <div class="value" style="color: #16a34a;">${formatBRL(cashFlow.inflow)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Saídas</div>
          <div class="value" style="color: #dc2626;">${formatBRL(cashFlow.outflow)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Saldo Líquido</div>
          <div class="value" style="color: ${cashFlow.net >= 0 ? '#16a34a' : '#dc2626'};">
            ${formatBRL(cashFlow.net)}
          </div>
        </div>
        <div class="stat-card">
          <div class="label">Despesas Vencidas</div>
          <div class="value" style="color: #dc2626;">${formatBRL(cashFlow.overdueExpenses)}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">DRE Simplificado</h2>
      <table>
        <tbody>
          <tr><td>Receita Bruta</td><td class="text-right">${formatBRL(dre.grossRevenue)}</td></tr>
          <tr><td>(-) Comissões OTA</td><td class="text-right" style="color: #dc2626;">-${formatBRL(dre.otaCommissions)}</td></tr>
          <tr style="background: #f1f5f9; font-weight: 600;"><td>Receita Líquida</td><td class="text-right">${formatBRL(dre.netRevenue)}</td></tr>
          <tr><td>(-) Custos Fixos</td><td class="text-right" style="color: #dc2626;">-${formatBRL(dre.fixedCosts)}</td></tr>
          <tr><td>(-) Custos Variáveis</td><td class="text-right" style="color: #dc2626;">-${formatBRL(dre.variableCosts)}</td></tr>
          <tr><td>(-) Marketing</td><td class="text-right" style="color: #dc2626;">-${formatBRL(dre.marketingCosts)}</td></tr>
          <tr><td>(-) Impostos</td><td class="text-right" style="color: #dc2626;">-${formatBRL(dre.taxes)}</td></tr>
          <tr style="background: #f1f5f9; font-weight: 700; font-size: 14px;">
            <td>EBITDA</td>
            <td class="text-right" style="color: ${dre.ebitda >= 0 ? '#16a34a' : '#dc2626'};">${formatBRL(dre.ebitda)}</td>
          </tr>
          <tr><td>Margem</td><td class="text-right">${formatPercent(dre.margin)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2 class="section-title">Despesas por Categoria</h2>
      <table>
        <thead>
          <tr><th>Categoria</th><th class="text-center">Qtd</th><th class="text-right">Total</th></tr>
        </thead>
        <tbody>
          ${Object.entries(cashFlow.byCategory).map(([cat, val]) => `
            <tr>
              <td>${EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] || cat}</td>
              <td class="text-center">${val.count}</td>
              <td class="text-right">${formatBRL(val.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2 class="section-title">Despesas Detalhadas</h2>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Vencimento</th>
            <th class="text-right">Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.slice(0, 50).map(e => `
            <tr>
              <td>${e.description}</td>
              <td>${EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category}</td>
              <td>${e.dueDate ? formatDateBR(e.dueDate) : '-'}</td>
              <td class="text-right">${formatBRL(e.amount)}</td>
              <td>${statusBadge(e.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${expenses.length > 50 ? `<div style="text-align: center; padding: 8px; color: #64748b; font-size: 11px;">Exibindo 50 de ${expenses.length} despesas</div>` : ''}
    </div>
  `;
}

function generateGuestsHtml(data: ReportData): string {
  const g = data.guests!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo de Hóspedes</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total</div>
          <div class="value">${g.summary.total}</div>
        </div>
        <div class="stat-card">
          <div class="label">Valor Total</div>
          <div class="value">${formatBRL(g.summary.totalValue)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Score Médio IA</div>
          <div class="value">${g.summary.avgScore.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Conversas</div>
          <div class="value">${g.guests.reduce((s, x) => s + x.conversationCount, 0)}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Hóspedes por Status</h2>
      <table>
        <thead><tr><th>Status</th><th class="text-center">Quantidade</th></tr></thead>
        <tbody>
          ${Object.entries(g.summary.byStatus).map(([status, count]) => `
            <tr><td>${statusBadge(status)}</td><td class="text-center">${count}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2 class="section-title">Hóspedes por Origem</h2>
      <table>
        <thead><tr><th>Origem</th><th class="text-center">Quantidade</th></tr></thead>
        <tbody>
          ${Object.entries(g.summary.bySource).map(([source, count]) => `
            <tr><td>${source}</td><td class="text-center">${count}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2 class="section-title">Lista de Hóspedes</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>Status</th>
            <th>Origem</th>
            <th class="text-right">Valor</th>
            <th class="text-center">Score IA</th>
          </tr>
        </thead>
        <tbody>
          ${g.guests.slice(0, 100).map(guest => `
            <tr>
              <td>${guest.name}</td>
              <td>${guest.phone || '-'}</td>
              <td>${guest.email || '-'}</td>
              <td>${statusBadge(guest.status)}</td>
              <td>${guest.source}</td>
              <td class="text-right">${formatBRL(guest.value)}</td>
              <td class="text-center">${guest.aiScore}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${g.guests.length > 100 ? `<div style="text-align: center; padding: 8px; color: #64748b; font-size: 11px;">Exibindo 100 de ${g.guests.length} hóspedes</div>` : ''}
    </div>
  `;
}

function generateOperationsHtml(data: ReportData): string {
  const o = data.operations!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo de Operações</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Pendentes</div>
          <div class="value" style="color: #d97706;">${o.summary.pending}</div>
        </div>
        <div class="stat-card">
          <div class="label">Em Andamento</div>
          <div class="value" style="color: #3b82f6;">${o.summary.inProgress}</div>
        </div>
        <div class="stat-card">
          <div class="label">Concluídas</div>
          <div class="value" style="color: #16a34a;">${o.summary.completed}</div>
        </div>
        <div class="stat-card">
          <div class="label">Custo Total</div>
          <div class="value">${formatBRL(o.summary.totalCost)}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Tarefas</h2>
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Tipo</th>
            <th>Prioridade</th>
            <th>Responsável</th>
            <th>Agendada</th>
            <th class="text-right">Custo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${o.tasks.slice(0, 100).map(t => `
            <tr>
              <td>${t.title}</td>
              <td>${OPERATION_TYPE_LABELS[t.type] || t.type}</td>
              <td>${t.priority}</td>
              <td>${t.assignedTo || '-'}</td>
              <td>${t.scheduledFor ? formatDateBR(t.scheduledFor) : '-'}</td>
              <td class="text-right">${formatBRL(t.cost || 0)}</td>
              <td>${statusBadge(t.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateGoalsHtml(data: ReportData): string {
  const gl = data.goals!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo de Metas</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total</div>
          <div class="value">${gl.summary.total}</div>
        </div>
        <div class="stat-card">
          <div class="label">No Caminho</div>
          <div class="value" style="color: #16a34a;">${gl.summary.onTrack}</div>
        </div>
        <div class="stat-card">
          <div class="label">Em Risco</div>
          <div class="value" style="color: #d97706;">${gl.summary.atRisk}</div>
        </div>
        <div class="stat-card">
          <div class="label">Atingidas</div>
          <div class="value" style="color: #16a34a;">${gl.summary.achieved}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Progresso das Metas</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Período</th>
            <th class="text-right">Atual</th>
            <th class="text-right">Meta</th>
            <th>Progresso</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${gl.progress.map(p => `
            <tr>
              <td>${GOAL_TYPE_LABELS[p.goal.type] || p.goal.type}</td>
              <td>${GOAL_PERIOD_LABELS[p.goal.period] || p.goal.period}</td>
              <td class="text-right">${formatBRL(p.goal.currentValue)}</td>
              <td class="text-right">${formatBRL(p.goal.targetValue)}</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(100, p.progressPercent)}%"></div>
                </div>
                <div style="font-size: 11px; margin-top: 4px;">${formatPercent(p.progressPercent)}</div>
              </td>
              <td>${statusBadge(p.goal.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateCommissionsHtml(data: ReportData): string {
  const c = data.commissions!;
  return `
    <div class="section">
      <h2 class="section-title">Resumo de Comissões</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Pendentes</div>
          <div class="value" style="color: #d97706;">${formatBRL(c.summary.totalPending)}</div>
        </div>
        <div class="stat-card">
          <div class="label">A Pagar</div>
          <div class="value" style="color: #3b82f6;">${formatBRL(c.summary.totalPayable)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Pagas</div>
          <div class="value" style="color: #16a34a;">${formatBRL(c.summary.totalPaid)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Parceiros</div>
          <div class="value">${c.summary.byPartner.length}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Comissões Detalhadas</h2>
      <table>
        <thead>
          <tr>
            <th>Parceiro</th>
            <th>Tipo</th>
            <th>Regra</th>
            <th class="text-right">Base</th>
            <th class="text-right">Valor</th>
            <th>Vencimento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${c.records.map(r => `
            <tr>
              <td>${r.partnerName}</td>
              <td>${REFERRAL_TYPE_LABELS[r.referralType as keyof typeof REFERRAL_TYPE_LABELS] || r.referralType || '-'}</td>
              <td>${r.rule === 'percentage' ? `${r.rate}%` : formatBRL(r.rate)}</td>
              <td class="text-right">${formatBRL(r.basisAmount)}</td>
              <td class="text-right">${formatBRL(r.rule === 'percentage' ? (r.basisAmount * r.rate / 100) : r.rate)}</td>
              <td>${r.dueDate ? formatDateBR(r.dueDate) : '-'}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/** Gera o HTML completo do relatório para impressão como PDF */
export function generateReportHtml(data: ReportData): string {
  const { metadata } = data;
  let body = '';

  switch (metadata.filtersApplied[0] || 'monthly_summary') {
    case 'monthly_summary':
      if (data.monthlySummary) body = generateMonthlySummaryHtml(data);
      break;
    case 'reservations':
      if (data.reservations) body = generateReservationsHtml(data);
      break;
    case 'financial':
      if (data.financial) body = generateFinancialHtml(data);
      break;
    case 'guests':
      if (data.guests) body = generateGuestsHtml(data);
      break;
    case 'operations':
      if (data.operations) body = generateOperationsHtml(data);
      break;
    case 'goals':
      if (data.goals) body = generateGoalsHtml(data);
      break;
    case 'commissions':
      if (data.commissions) body = generateCommissionsHtml(data);
      break;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório — ${metadata.tenantName} — ${metadata.periodLabel}</title>
  <style>${HTML_BASE_STYLES}</style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">📥 Imprimir / Salvar PDF</button>
  ${generateHtmlHeader(metadata, metadata.filtersApplied[0] as ReportType)}
  <div class="report-body">
    ${body}
    ${generateHtmlFooter()}
  </div>
  <script>
    // Auto-print após 500ms se vier de um parâmetro ?autoprint=1
    if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
      setTimeout(() => window.print(), 500);
    }
  </script>
</body>
</html>`;
}

// ── GERAÇÃO XLSX ──────────────────────────────────────────────────────────────

export function generateReportXlsx(data: ReportData): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const { metadata } = data;

  // Sheet 1: Resumo
  const reportType = metadata.filtersApplied[0] || 'mensal';
  const tenantNameStr = metadata.tenantName;
  const periodLabelStr = metadata.periodLabel;
  const generatedAtStr = formatDateBR(metadata.generatedAt);
  const generatedByStr = metadata.generatedBy;
  const summaryRows: Record<string, string | number>[] = [
    { Campo: 'Relatório', Valor: reportType },
    { Campo: 'Estabelecimento', Valor: tenantNameStr },
    { Campo: 'Período', Valor: periodLabelStr },
    { Campo: 'Gerado em', Valor: generatedAtStr },
    { Campo: 'Gerado por', Valor: generatedByStr },
  ];

  if (data.monthlySummary) {
    const ms = data.monthlySummary;
    summaryRows.push(
      { Campo: 'Total de Reservas', Valor: ms.totalBookings },
      { Campo: 'Receita Total', Valor: ms.totalRevenue },
      { Campo: 'Hóspedes', Valor: ms.totalGuests },
      { Campo: 'Ticket Médio', Valor: ms.avgTicket },
      { Campo: 'Taxa de Ocupação (%)', Valor: ms.occupancyRate },
    );
  }
  if (data.reservations) {
    summaryRows.push(
      { Campo: 'Total de Reservas', Valor: data.reservations.summary.total },
      { Campo: 'Confirmadas', Valor: data.reservations.summary.confirmed },
      { Campo: 'Receita Total', Valor: data.reservations.summary.totalRevenue },
    );
  }
  if (data.financial) {
    summaryRows.push(
      { Campo: 'Entradas', Valor: data.financial.cashFlow.inflow },
      { Campo: 'Saídas', Valor: data.financial.cashFlow.outflow },
      { Campo: 'Saldo Líquido', Valor: data.financial.cashFlow.net },
      { Campo: 'EBITDA', Valor: data.financial.dre.ebitda },
      { Campo: 'Margem (%)', Valor: data.financial.dre.margin },
    );
  }
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  // Sheet 2: Detalhes (varia por tipo de relatório)
  if (data.reservations) {
    const rows = data.reservations.bookings.map(b => ({
      Hóspede: b.guestName,
      Acomodação: b.roomName,
      'Check-in': formatDateBR(b.checkIn),
      'Check-out': formatDateBR(b.checkOut),
      Noites: b.nights,
      Valor: b.totalValue,
      Status: b.status,
      Origem: b.source,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
  }

  if (data.financial) {
    const rows = data.financial.expenses.map(e => ({
      Descrição: e.description,
      Categoria: EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category,
      Valor: e.amount,
      Vencimento: e.dueDate ? formatDateBR(e.dueDate) : '',
      'Pago em': e.paidAt ? formatDateBR(e.paidAt) : '',
      Status: e.status,
      Recorrência: e.recurrence,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
  }

  if (data.guests) {
    const rows = data.guests.guests.map(g => ({
      Nome: g.name,
      Telefone: g.phone || '',
      Email: g.email || '',
      Status: g.status,
      Origem: g.source,
      Valor: g.value,
      'Score IA': g.aiScore,
      Conversas: g.conversationCount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Hóspedes');
  }

  if (data.operations) {
    const rows = data.operations.tasks.map(t => ({
      Título: t.title,
      Tipo: OPERATION_TYPE_LABELS[t.type as keyof typeof OPERATION_TYPE_LABELS] || t.type,
      Prioridade: t.priority,
      Responsável: t.assignedTo || '',
      Agendada: t.scheduledFor ? formatDateBR(t.scheduledFor) : '',
      Custo: t.cost || 0,
      Status: t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Operações');
  }

  if (data.commissions) {
    const rows = data.commissions.records.map(r => ({
      Parceiro: r.partnerName,
      Tipo: REFERRAL_TYPE_LABELS[r.referralType as keyof typeof REFERRAL_TYPE_LABELS] || r.referralType,
      Regra: r.rule,
      Taxa: r.rate,
      Base: r.basisAmount,
      Valor: r.rule === 'percentage' ? (r.basisAmount * r.rate / 100) : r.rate,
      Vencimento: r.dueDate ? formatDateBR(r.dueDate) : '',
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Comissões');
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

// ── GERAÇÃO CSV ───────────────────────────────────────────────────────────────

export function generateReportCsv(data: ReportData): string {
  const lines: string[] = [];

  lines.push('Zélla AirB Pro — Relatório');
  lines.push(`Estabelecimento,${data.metadata.tenantName}`);
  lines.push(`Período,${data.metadata.periodLabel}`);
  lines.push(`Gerado em,${formatDateBR(data.metadata.generatedAt)}`);
  lines.push('');

  if (data.reservations) {
    lines.push('RESERVAS');
    lines.push('Hóspede,Acomodação,Check-in,Check-out,Noites,Valor,Status,Origem');
    for (const b of data.reservations.bookings) {
      lines.push(`"${b.guestName}","${b.roomName}",${formatDateBR(b.checkIn)},${formatDateBR(b.checkOut)},${b.nights},${b.totalValue.toFixed(2)},${b.status},${b.source}`);
    }
    lines.push('');
  }

  if (data.financial) {
    lines.push('DESPESAS');
    lines.push('Descrição,Categoria,Valor,Vencimento,Status');
    for (const e of data.financial.expenses) {
      lines.push(`"${e.description}",${e.category},${e.amount.toFixed(2)},${e.dueDate ? formatDateBR(e.dueDate) : ''},${e.status}`);
    }
    lines.push('');
  }

  if (data.guests) {
    lines.push('HÓSPEDES');
    lines.push('Nome,Telefone,Email,Status,Origem,Valor,Score IA');
    for (const g of data.guests.guests) {
      lines.push(`"${g.name}","${g.phone || ''}","${g.email || ''}",${g.status},${g.source},${g.value.toFixed(2)},${g.aiScore}`);
    }
    lines.push('');
  }

  if (data.operations) {
    lines.push('OPERAÇÕES');
    lines.push('Título,Tipo,Prioridade,Responsável,Agendada,Custo,Status');
    for (const t of data.operations.tasks) {
      lines.push(`"${t.title}",${t.type},${t.priority},"${t.assignedTo || ''}",${t.scheduledFor ? formatDateBR(t.scheduledFor) : ''},${(t.cost || 0).toFixed(2)},${t.status}`);
    }
    lines.push('');
  }

  if (data.commissions) {
    lines.push('COMISSÕES');
    lines.push('Parceiro,Tipo,Regra,Taxa,Base,Valor,Status');
    for (const r of data.commissions.records) {
      const valor = r.rule === 'percentage' ? (r.basisAmount * r.rate / 100) : r.rate;
      lines.push(`"${r.partnerName}",${r.referralType},${r.rule},${r.rate},${r.basisAmount.toFixed(2)},${valor.toFixed(2)},${r.status}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Função despachante — gera o relatório no formato solicitado */
export function generateReport(
  data: ReportData,
  format: ReportFormat,
): { content: string | ArrayBuffer; mimeType: string; fileExtension: string } {
  switch (format) {
    case 'pdf':
      // PDF é gerado client-side via window.print() — servidor retorna HTML
      return {
        content: generateReportHtml(data),
        mimeType: 'text/html; charset=utf-8',
        fileExtension: 'html',
      };
    case 'xlsx':
      return {
        content: generateReportXlsx(data),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: 'xlsx',
      };
    case 'csv':
      return {
        content: generateReportCsv(data),
        mimeType: 'text/csv; charset=utf-8',
        fileExtension: 'csv',
      };
  }
}

/** Monta dados do relatório mensal a partir de dados brutos do banco */
export function buildMonthlySummaryData(
  metadata: ReportMetadata,
  bookings: Array<{
    guestName: string;
    roomName: string;
    totalValue: number;
    source: string;
    status: string;
    createdAt: Date;
  }>,
  guestsCount: number,
  totalRooms: number,
): ReportData {
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((s, b) => s + b.totalValue, 0);
  const avgTicket = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // Top rooms
  const roomMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    const cur = roomMap.get(b.roomName) || { bookings: 0, revenue: 0 };
    cur.bookings++;
    cur.revenue += b.totalValue;
    roomMap.set(b.roomName, cur);
  }
  const topRooms = Array.from(roomMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // By source
  const sourceMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    const cur = sourceMap.get(b.source) || { bookings: 0, revenue: 0 };
    cur.bookings++;
    cur.revenue += b.totalValue;
    sourceMap.set(b.source, cur);
  }
  const bySource = Array.from(sourceMap.entries()).map(([source, v]) => ({ source, ...v }));

  // By day
  const dayMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    const day = formatDateBR(b.createdAt);
    const cur = dayMap.get(day) || { bookings: 0, revenue: 0 };
    cur.bookings++;
    cur.revenue += b.totalValue;
    dayMap.set(day, cur);
  }
  const byDay = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

  // Occupancy rate (simplified): bookings / (rooms * days in month)
  const daysInPeriod = Math.max(1, Math.ceil(
    (metadata.generatedAt.getTime() - new Date(metadata.periodLabel.split(' ')[0] || metadata.generatedAt).getTime()) / 86400000,
  ));
  const occupancyRate = totalRooms > 0 ? Math.min(100, (totalBookings / (totalRooms * daysInPeriod)) * 100) : 0;

  return {
    metadata,
    monthlySummary: {
      totalBookings,
      totalRevenue,
      totalGuests: guestsCount,
      avgTicket,
      occupancyRate,
      topRooms,
      bySource,
      byDay,
    },
  };
}

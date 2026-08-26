/**
 * P0-1: API — GERAÇÃO DE RELATÓRIOS
 *
 * GET  /api/ddc/airb-pro/reports?type=monthly_summary&format=pdf&period=2026-07
 *   → retorna HTML/XLSX/CSV para download ou visualização
 *
 * POST /api/ddc/airb-pro/reports
 *   → registra um relatório gerado no histórico (AirbReport)
 *
 * GET  /api/ddc/airb-pro/reports/history
 *   → lista relatórios já gerados pelo tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import {
  type ReportType,
  type ReportFormat,
  type ReportMetadata,
  type ExpenseCategory,
  type CashFlowSummary,
  type DreSimplified,
  type ExpenseRecord,
  type OperationTaskRecord,
  type GoalProgress,
  type CommissionRecord,
  getMonthPeriod,
  getLastNDaysPeriod,
  formatBRL,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/airb-pro/types';
import {
  generateReport,
  buildMonthlySummaryData,
  type ReportData,
} from '@/lib/airb-pro/report-generator';

const VALID_REPORT_TYPES: ReportType[] = [
  'monthly_summary',
  'reservations',
  'financial',
  'guests',
  'operations',
  'goals',
  'commissions',
];

const VALID_REPORT_FORMATS: ReportFormat[] = ['pdf', 'xlsx', 'csv'];

interface TenantInfo {
  name: string;
  email: string | null | undefined;
}

async function getTenantInfo(tenantId: string): Promise<TenantInfo> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    return { name: 'Estabelecimento Demo', email: null };
  }
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, email: true },
  });
  return {
    name: tenant?.name || 'Estabelecimento',
    email: tenant?.email ?? null,
  };
}

function parsePeriod(periodStr: string | null): ReturnType<typeof getMonthPeriod> | ReturnType<typeof getLastNDaysPeriod> {
  if (!periodStr) {
    // Default: mês atual
    const now = new Date();
    return getMonthPeriod(now.getFullYear(), now.getMonth());
  }
  // Formato YYYY-MM
  const match = /^(\d{4})-(\d{2})$/.exec(periodStr);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    return getMonthPeriod(year, month);
  }
  // Fallback: últimos 30 dias
  return getLastNDaysPeriod(30);
}

async function collectMonthlySummaryData(
  tenantId: string,
  period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    // Dados demo quando DB indisponível
    return buildMonthlySummaryData(
      {
        tenantName: tenantInfo.name,
        tenantEmail: tenantInfo.email || undefined,
        generatedAt: new Date(),
        generatedBy: 'Sistema',
        periodLabel: period.label,
        filtersApplied: ['monthly_summary'],
      },
      [
        { guestName: 'Mariana Silva', roomName: 'Suíte Master', totalValue: 1200, source: 'whatsapp_ai', status: 'confirmed', createdAt: new Date() },
        { guestName: 'Ricardo Santos', roomName: 'Chalé Jardim', totalValue: 850, source: 'airbnb', status: 'checked_out', createdAt: new Date() },
        { guestName: 'Beatriz Costa', roomName: 'Suíte Vista Mar', totalValue: 1500, source: 'booking', status: 'checked_in', createdAt: new Date() },
        { guestName: 'Thiago Oliveira', roomName: 'Bangalô Premium', totalValue: 2400, source: 'direct', status: 'confirmed', createdAt: new Date() },
      ],
      4,
      8,
    );
  }

  const [bookings, guestsCount, roomsCount] = await Promise.all([
    db.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: period.startDate, lte: period.endDate },
      },
      select: {
        guestName: true,
        roomName: true,
        totalValue: true,
        source: true,
        status: true,
        createdAt: true,
      },
    }),
    db.guest.count({ where: { tenantId } }),
    db.room.count({ where: { tenantId } }),
  ]);

  return buildMonthlySummaryData(
    {
      tenantName: tenantInfo.name,
      tenantEmail: tenantInfo.email || undefined,
      generatedAt: new Date(),
      generatedBy: 'Sistema',
      periodLabel: period.label,
      filtersApplied: ['monthly_summary'],
    },
    bookings.map(b => ({ ...b, createdAt: new Date(b.createdAt) })),
    guestsCount,
    roomsCount,
  );
}

async function collectReservationsData(
  tenantId: string,
  period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: period.label,
    filtersApplied: ['reservations'],
  };

  if (!dbOk) {
    return {
      metadata,
      reservations: {
        bookings: [],
        summary: { total: 0, confirmed: 0, checkedIn: 0, checkedOut: 0, cancelled: 0, totalRevenue: 0, avgNights: 0 },
      },
    };
  }

  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      OR: [
        { checkIn: { gte: period.startDate, lte: period.endDate } },
        { checkOut: { gte: period.startDate, lte: period.endDate } },
        { createdAt: { gte: period.startDate, lte: period.endDate } },
      ],
    },
    orderBy: { checkIn: 'asc' },
  });

  const summary = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
    checkedOut: bookings.filter(b => b.status === 'checked_out').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    totalRevenue: bookings.reduce((s, b) => s + b.totalValue, 0),
    avgNights: bookings.length > 0 ? bookings.reduce((s, b) => s + b.nights, 0) / bookings.length : 0,
  };

  return {
    metadata,
    reservations: {
      bookings: bookings.map(b => ({
        guestName: b.guestName,
        roomName: b.roomName,
        checkIn: new Date(b.checkIn),
        checkOut: new Date(b.checkOut),
        nights: b.nights,
        totalValue: b.totalValue,
        status: b.status,
        source: b.source,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
      })),
      summary,
    },
  };
}

async function collectFinancialData(
  tenantId: string,
  period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: period.label,
    filtersApplied: ['financial'],
  };

  if (!dbOk) {
    return {
      metadata,
      financial: {
        cashFlow: {
          period,
          inflow: 5950,
          outflow: 2350,
          net: 3600,
          pendingExpenses: 800,
          overdueExpenses: 0,
          byCategory: {
            fixed_cost: { count: 2, total: 1200 },
            variable: { count: 3, total: 450 },
            maintenance: { count: 1, total: 350 },
            utilities: { count: 2, total: 350 },
            marketing: { count: 0, total: 0 },
            commission: { count: 0, total: 0 },
            tax: { count: 0, total: 0 },
            other: { count: 0, total: 0 },
          },
          byMonth: [],
        },
        dre: {
          period,
          grossRevenue: 5950,
          otaCommissions: 595,
          netRevenue: 5355,
          fixedCosts: 1200,
          variableCosts: 450,
          marketingCosts: 0,
          taxes: 350,
          ebitda: 3355,
          margin: 56.4,
        },
        expenses: [],
      },
    };
  }

  // Busca despesas do período
  const expenses = await db.airbExpense.findMany({
    where: {
      tenantId,
      OR: [
        { paidAt: { gte: period.startDate, lte: period.endDate } },
        { dueDate: { gte: period.startDate, lte: period.endDate } },
        { createdAt: { gte: period.startDate, lte: period.endDate } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Busca reservas pagas no período (inflow)
  const paidBookings = await db.booking.findMany({
    where: {
      tenantId,
      paymentStatus: 'paid',
      createdAt: { gte: period.startDate, lte: period.endDate },
    },
    select: { totalValue: true },
  });

  const inflow = paidBookings.reduce((s, b) => s + b.totalValue, 0);
  const outflow = expenses
    .filter(e => e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = expenses
    .filter(e => e.status === 'pending')
    .reduce((s, e) => s + e.amount, 0);
  const overdueExpenses = expenses
    .filter(e => e.status === 'overdue')
    .reduce((s, e) => s + e.amount, 0);

  // Agrupar por categoria
  const byCategory = {} as CashFlowSummary['byCategory'];
  for (const cat of Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]) {
    byCategory[cat] = { count: 0, total: 0 };
  }
  for (const e of expenses) {
    const cat = e.category as ExpenseCategory;
    if (byCategory[cat]) {
      byCategory[cat].count++;
      byCategory[cat].total += e.amount;
    } else {
      byCategory.other.count++;
      byCategory.other.total += e.amount;
    }
  }

  // DRE simplificado
  const otaCommissions = byCategory.commission.total;
  const grossRevenue = inflow;
  const netRevenue = grossRevenue - otaCommissions;
  const fixedCosts = byCategory.fixed_cost.total;
  const variableCosts = byCategory.variable.total + byCategory.maintenance.total + byCategory.utilities.total;
  const marketingCosts = byCategory.marketing.total;
  const taxes = byCategory.tax.total;
  const ebitda = netRevenue - fixedCosts - variableCosts - marketingCosts - taxes;
  const margin = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;

  const expenseRecords: ExpenseRecord[] = expenses.map(e => ({
    id: e.id,
    tenantId: e.tenantId,
    category: e.category as ExpenseCategory,
    description: e.description,
    amount: e.amount,
    dueDate: e.dueDate || undefined,
    paidAt: e.paidAt || undefined,
    status: e.status as ExpenseRecord['status'],
    recurrence: e.recurrence as ExpenseRecord['recurrence'],
    document: e.document || undefined,
    metadata: e.metadata ? JSON.parse(e.metadata) : {},
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  }));

  return {
    metadata,
    financial: {
      cashFlow: {
        period,
        inflow,
        outflow,
        net: inflow - outflow,
        pendingExpenses,
        overdueExpenses,
        byCategory,
        byMonth: [],
      },
      dre: {
        period,
        grossRevenue,
        otaCommissions,
        netRevenue,
        fixedCosts,
        variableCosts,
        marketingCosts,
        taxes,
        ebitda,
        margin,
      },
      expenses: expenseRecords,
    },
  };
}

async function collectGuestsData(
  tenantId: string,
  _period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: _period.label,
    filtersApplied: ['guests'],
  };

  if (!dbOk) {
    return { metadata, guests: { guests: [], summary: { total: 0, byStatus: {}, bySource: {}, totalValue: 0, avgScore: 0 } } };
  }

  const guests = await db.guest.findMany({
    where: { tenantId },
    select: {
      name: true,
      phone: true,
      email: true,
      status: true,
      source: true,
      value: true,
      aiScore: true,
      conversationCount: true,
      lastContact: true,
    },
    orderBy: { lastContact: 'desc' },
    take: 500,
  });

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalValue = 0;
  let totalScore = 0;
  for (const g of guests) {
    byStatus[g.status] = (byStatus[g.status] || 0) + 1;
    bySource[g.source] = (bySource[g.source] || 0) + 1;
    totalValue += g.value;
    totalScore += g.aiScore;
  }

  return {
    metadata,
    guests: {
      guests: guests.map(g => ({ ...g, lastContact: new Date(g.lastContact) })),
      summary: {
        total: guests.length,
        byStatus,
        bySource,
        totalValue,
        avgScore: guests.length > 0 ? totalScore / guests.length : 0,
      },
    },
  };
}

async function collectOperationsData(
  tenantId: string,
  _period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: _period.label,
    filtersApplied: ['operations'],
  };

  if (!dbOk) {
    return { metadata, operations: { tasks: [], summary: { pending: 0, inProgress: 0, completed: 0, cancelled: 0, totalCost: 0, avgDuration: 0 } } };
  }

  const tasks = await db.airbOperationTask.findMany({
    where: {
      tenantId,
      OR: [
        { scheduledFor: { gte: _period.startDate, lte: _period.endDate } },
        { completedAt: { gte: _period.startDate, lte: _period.endDate } },
        { createdAt: { gte: _period.startDate, lte: _period.endDate } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const totalCost = tasks.reduce((s, t) => s + (t.cost || 0), 0);
  const completedTasks = tasks.filter(t => t.actualMin);
  const avgDuration = completedTasks.length > 0
    ? completedTasks.reduce((s, t) => s + (t.actualMin || 0), 0) / completedTasks.length
    : 0;

  return {
    metadata,
    operations: {
      tasks: tasks.map(t => ({
        id: t.id,
        tenantId: t.tenantId,
        propertyId: t.propertyId || undefined,
        type: t.type as any,
        status: t.status as any,
        priority: t.priority as any,
        title: t.title,
        description: t.description,
        assignedTo: t.assignedTo || undefined,
        scheduledFor: t.scheduledFor || undefined,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        estimatedMin: t.estimatedMin,
        actualMin: t.actualMin,
        checklist: t.checklist ? JSON.parse(t.checklist) : [],
        cost: t.cost,
        metadata: t.metadata ? JSON.parse(t.metadata) : {},
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      })) as OperationTaskRecord[],
      summary: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
        totalCost,
        avgDuration,
      },
    },
  };
}

async function collectGoalsData(
  tenantId: string,
  _period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: _period.label,
    filtersApplied: ['goals'],
  };

  if (!dbOk) {
    return { metadata, goals: { progress: [], summary: { total: 0, onTrack: 0, atRisk: 0, achieved: 0, missed: 0 } } };
  }

  const goals = await db.airbGoal.findMany({
    where: { tenantId, status: { in: ['active', 'achieved', 'missed'] } },
    orderBy: { endDate: 'asc' },
  });

  const now = new Date();
  const progress = goals.map(g => {
    const {targetValue} = g;
    const {currentValue} = g;
    const progressPercent = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
    const remaining = Math.max(0, targetValue - currentValue);
    const daysRemaining = Math.max(0, Math.ceil((new Date(g.endDate).getTime() - now.getTime()) / 86400000));
    const totalDays = Math.max(1, Math.ceil((new Date(g.endDate).getTime() - new Date(g.startDate).getTime()) / 86400000));
    const elapsedDays = totalDays - daysRemaining;
    const projectedValue = elapsedDays > 0 ? (currentValue / elapsedDays) * totalDays : currentValue;
    const projectedStatus = projectedValue >= targetValue ? 'achieved' : 'missed';
    const trend: 'up' | 'down' | 'flat' = progressPercent > 50 ? 'up' : progressPercent < 25 ? 'down' : 'flat';
    return {
      goal: {
        ...g,
        type: g.type as any,
        period: g.period as any,
        unit: g.unit as any,
        status: g.status as any,
        startDate: new Date(g.startDate),
        endDate: new Date(g.endDate),
        createdAt: new Date(g.createdAt),
        updatedAt: new Date(g.updatedAt),
      },
      progressPercent,
      remaining,
      daysRemaining,
      projectedValue,
      projectedStatus: projectedStatus as any,
      trend,
    };
  });

  const onTrack = progress.filter(p => p.progressPercent >= 50).length;
  const atRisk = progress.filter(p => p.progressPercent < 50 && p.goal.status === 'active').length;
  const achieved = progress.filter(p => p.goal.status === 'achieved').length;
  const missed = progress.filter(p => p.goal.status === 'missed').length;

  return {
    metadata,
    goals: {
      progress,
      summary: {
        total: goals.length,
        onTrack,
        atRisk,
        achieved,
        missed,
      },
    },
  };
}

async function collectCommissionsData(
  tenantId: string,
  _period: ReturnType<typeof getMonthPeriod>,
  tenantInfo: TenantInfo,
): Promise<ReportData> {
  const dbOk = await isDatabaseAvailable();
  const metadata: ReportMetadata = {
    tenantName: tenantInfo.name,
    tenantEmail: tenantInfo.email || undefined,
    generatedAt: new Date(),
    generatedBy: 'Sistema',
    periodLabel: _period.label,
    filtersApplied: ['commissions'],
  };

  if (!dbOk) {
    return {
      metadata,
      commissions: {
        records: [],
        summary: { totalPending: 0, totalPayable: 0, totalPaid: 0, byPartner: [] },
      },
    };
  }

  const records = await db.airbCommission.findMany({
    where: {
      tenantId,
      OR: [
        { paidAt: { gte: _period.startDate, lte: _period.endDate } },
        { dueDate: { gte: _period.startDate, lte: _period.endDate } },
        { createdAt: { gte: _period.startDate, lte: _period.endDate } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const mapped = records.map(r => {
    const valor = r.rule === 'percentage' ? (r.basisAmount * r.rate / 100) : r.rate;
    return {
      id: r.id,
      tenantId: r.tenantId,
      partnerName: r.partnerName,
      partnerEmail: r.partnerEmail,
      partnerPhone: r.partnerPhone,
      partnerCode: r.partnerCode,
      referralType: r.referralType as any,
      rule: r.rule as any,
      rate: r.rate,
      basisAmount: r.basisAmount,
      status: r.status as any,
      dueDate: r.dueDate,
      paidAt: r.paidAt,
      notes: r.notes,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      _valor: valor,
    };
  });

  const totalPending = mapped.filter(r => r.status === 'pending').reduce((s, r) => s + r._valor, 0);
  const totalPayable = mapped.filter(r => r.status === 'payable').reduce((s, r) => s + r._valor, 0);
  const totalPaid = mapped.filter(r => r.status === 'paid').reduce((s, r) => s + r._valor, 0);

  // By partner
  const partnerMap = new Map<string, { amount: number; status: string }>();
  for (const r of mapped) {
    const cur = partnerMap.get(r.partnerName) || { amount: 0, status: r.status };
    cur.amount += r._valor;
    partnerMap.set(r.partnerName, cur);
  }
  const byPartner = Array.from(partnerMap.entries()).map(([name, v]) => ({ name, amount: v.amount, status: v.status }));

  return {
    metadata,
    commissions: {
      records: mapped.map(({ _valor, ...r }) => r),
      summary: { totalPending, totalPayable, totalPaid, byPartner },
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'monthly_summary') as ReportType;
    const format = (searchParams.get('format') || 'pdf') as ReportFormat;
    const periodStr = searchParams.get('period');

    if (!VALID_REPORT_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Tipo de relatório inválido: ${type}` },
        { status: 400 },
      );
    }
    if (!VALID_REPORT_FORMATS.includes(format)) {
      return NextResponse.json(
        { success: false, error: `Formato inválido: ${format}` },
        { status: 400 },
      );
    }

    const period = parsePeriod(periodStr);
    const tenantInfo = await getTenantInfo(tenantId);

    let reportData: ReportData;
    switch (type) {
      case 'monthly_summary':
        reportData = await collectMonthlySummaryData(tenantId, period, tenantInfo);
        break;
      case 'reservations':
        reportData = await collectReservationsData(tenantId, period, tenantInfo);
        break;
      case 'financial':
        reportData = await collectFinancialData(tenantId, period, tenantInfo);
        break;
      case 'guests':
        reportData = await collectGuestsData(tenantId, period, tenantInfo);
        break;
      case 'operations':
        reportData = await collectOperationsData(tenantId, period, tenantInfo);
        break;
      case 'goals':
        reportData = await collectGoalsData(tenantId, period, tenantInfo);
        break;
      case 'commissions':
        reportData = await collectCommissionsData(tenantId, period, tenantInfo);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Tipo não implementado' }, { status: 501 });
    }

    const { content, mimeType, fileExtension } = generateReport(reportData, format);

    // Registra no histórico (best-effort, não bloqueia resposta)
    const dbOk = await isDatabaseAvailable();
    if (dbOk) {
      try {
        const fileName = `relatorio-${type}-${periodStr || 'atual'}.${fileExtension}`;
        const fileSizeKb = typeof content === 'string'
          ? Math.round(content.length / 1024)
          : Math.round((content as ArrayBuffer).byteLength / 1024);
        await db.airbReport.create({
          data: {
            tenantId,
            type,
            format,
            period: periodStr || period.label,
            status: 'generated',
            fileName,
            fileSizeKb,
            generatedBy: 'user',
            metadata: JSON.stringify({ periodLabel: period.label }),
          },
        });
      } catch (e) {
        console.warn('[airb-pro/reports] Falha ao registrar histórico:', e);
      }
    }

    // Para PDF, retornamos HTML que o browser vai imprimir
    if (format === 'pdf') {
      return new NextResponse(content as string, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Para XLSX e CSV, retornamos como download
    const fileName = `relatorio-${type}-${periodStr || 'atual'}.${fileExtension}`;
    return new NextResponse(content as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[airb-pro/reports] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao gerar relatório' },
      { status: 500 },
    );
  }
}

/** GET /api/ddc/airb-pro/reports/history — lista histórico de relatórios */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'history') {
      const dbOk = await isDatabaseAvailable();
      if (!dbOk) {
        return NextResponse.json({ success: true, data: [], meta: { source: 'demo' } });
      }
      const history = await db.airbReport.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({
        success: true,
        data: history.map(h => ({
          id: h.id,
          type: h.type,
          format: h.format,
          period: h.period,
          status: h.status,
          fileName: h.fileName,
          fileSizeKb: h.fileSizeKb,
          generatedBy: h.generatedBy,
          createdAt: h.createdAt,
        })),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Ação inválida. Use action=history.' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[airb-pro/reports/history] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar histórico' },
      { status: 500 },
    );
  }
}

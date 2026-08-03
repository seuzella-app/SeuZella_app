/**
 * AIRB PRO — Testes unitários para os módulos P0/P1
 *
 * Cobre:
 *   - types.ts: formatadores e helpers
 *   - report-generator.ts: geração de HTML/XLSX/CSV
 *   - Validações de input (serialização/deserialização)
 */

import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  formatPercent,
  formatDateBR,
  getMonthPeriod,
  getLastNDaysPeriod,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  REFERRAL_TYPE_LABELS,
  DEFAULT_CLEANING_CHECKLIST,
  DEFAULT_MAINTENANCE_CHECKLIST,
  type ExpenseCategory,
  type OperationTaskType,
  type GoalType,
  type ReferralType,
} from '@/lib/airb-pro/types';
import {
  generateReport,
  generateReportHtml,
  generateReportXlsx,
  generateReportCsv,
  buildMonthlySummaryData,
  type ReportData,
} from '@/lib/airb-pro/report-generator';

// ── HELPERS ──────────────────────────────────────────────────────────────────

describe('airb-pro/types — formatadores', () => {
  it('formatBRL formata números em BRL', () => {
    expect(formatBRL(1234.5)).toMatch(/R\$\s*1\.234,50/);
    expect(formatBRL(0)).toMatch(/R\$\s*0,00/);
    expect(formatBRL(-100)).toMatch(/-/);
  });

  it('formatPercent formata números como percentual', () => {
    expect(formatPercent(67.555)).toBe('67.6%');
    expect(formatPercent(50, 0)).toBe('50%');
    expect(formatPercent(0.5, 2)).toBe('0.50%');
  });

  it('formatDateBR formata datas em pt-BR', () => {
    const d = new Date('2026-07-15T12:00:00Z');
    const formatted = formatDateBR(d);
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('formatDateBR aceita strings ISO', () => {
    const formatted = formatDateBR('2026-07-15T12:00:00Z');
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('airb-pro/types — períodos', () => {
  it('getMonthPeriod retorna período mensal correto', () => {
    const period = getMonthPeriod(2026, 6); // Julho 2026 (0-indexed: 6 = July)
    expect(period.startDate.getMonth()).toBe(6);
    expect(period.startDate.getFullYear()).toBe(2026);
    expect(period.startDate.getDate()).toBe(1);
    expect(period.endDate.getMonth()).toBe(6);
    expect(period.endDate.getDate()).toBe(31);
    expect(period.label).toMatch(/julho|july/i);
  });

  it('getLastNDaysPeriod retorna período dos últimos N dias', () => {
    const period = getLastNDaysPeriod(30);
    const diffMs = period.endDate.getTime() - period.startDate.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    expect(diffDays).toBe(30);
    expect(period.label).toContain('30');
  });

  it('getMonthPeriod de fevereiro em ano não bissexto tem 28 dias', () => {
    const period = getMonthPeriod(2027, 1); // Fev 2027
    expect(period.endDate.getDate()).toBe(28);
  });

  it('getMonthPeriod de fevereiro em ano bissexto tem 29 dias', () => {
    const period = getMonthPeriod(2028, 1); // Fev 2028 (bissexto)
    expect(period.endDate.getDate()).toBe(29);
  });
});

describe('airb-pro/types — labels', () => {
  it('EXPENSE_CATEGORY_LABELS cobre todas as categorias', () => {
    const categories: ExpenseCategory[] = [
      'fixed_cost', 'variable', 'maintenance', 'utilities',
      'marketing', 'commission', 'tax', 'other',
    ];
    for (const c of categories) {
      expect(EXPENSE_CATEGORY_LABELS[c]).toBeTruthy();
      expect(typeof EXPENSE_CATEGORY_LABELS[c]).toBe('string');
    }
  });

  it('EXPENSE_STATUS_LABELS cobre todos os status', () => {
    expect(EXPENSE_STATUS_LABELS.pending).toBe('Pendente');
    expect(EXPENSE_STATUS_LABELS.paid).toBe('Pago');
    expect(EXPENSE_STATUS_LABELS.overdue).toBe('Vencido');
    expect(EXPENSE_STATUS_LABELS.cancelled).toBe('Cancelado');
  });

  it('OPERATION_TYPE_LABELS cobre todos os tipos', () => {
    const types: OperationTaskType[] = ['cleaning', 'maintenance', 'inspection', 'restock', 'other'];
    for (const t of types) {
      expect(OPERATION_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  it('GOAL_TYPE_LABELS cobre todos os tipos', () => {
    const types: GoalType[] = ['revenue', 'occupancy', 'bookings', 'adr', 'revpar', 'guests', 'reviews'];
    for (const t of types) {
      expect(GOAL_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  it('REFERRAL_TYPE_LABELS cobre todos os tipos', () => {
    const types: ReferralType[] = ['affiliate', 'agent', 'partner', 'influencer'];
    for (const t of types) {
      expect(REFERRAL_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe('airb-pro/types — checklists padrão', () => {
  it('DEFAULT_CLEANING_CHECKLIST tem 10 itens não-concluídos', () => {
    expect(DEFAULT_CLEANING_CHECKLIST).toHaveLength(10);
    for (const item of DEFAULT_CLEANING_CHECKLIST) {
      expect(item.done).toBe(false);
      expect(item.item).toBeTruthy();
      expect(typeof item.item).toBe('string');
    }
  });

  it('DEFAULT_MAINTENANCE_CHECKLIST tem 8 itens não-concluídos', () => {
    expect(DEFAULT_MAINTENANCE_CHECKLIST).toHaveLength(8);
    for (const item of DEFAULT_MAINTENANCE_CHECKLIST) {
      expect(item.done).toBe(false);
    }
  });

  it('Checklists não compartilham referência (cópia segura)', () => {
    const copy = [...DEFAULT_CLEANING_CHECKLIST.map(c => ({ ...c }))];
    copy[0].done = true;
    expect(DEFAULT_CLEANING_CHECKLIST[0].done).toBe(false);
  });
});

// ── REPORT GENERATOR ─────────────────────────────────────────────────────────

describe('airb-pro/report-generator — geração HTML', () => {
  const baseMetadata = {
    tenantName: 'Pousada Teste',
    tenantEmail: 'teste@pousada.com',
    generatedAt: new Date('2026-07-31'),
    generatedBy: 'Sistema',
    periodLabel: 'Julho 2026',
    filtersApplied: ['monthly_summary'] as const,
  };

  it('generateReportHtml retorna HTML válido para monthly_summary', () => {
    const data: ReportData = buildMonthlySummaryData(
      baseMetadata,
      [
        { guestName: 'João', roomName: 'Suíte 1', totalValue: 500, source: 'direct', status: 'confirmed', createdAt: new Date() },
        { guestName: 'Maria', roomName: 'Suíte 2', totalValue: 800, source: 'airbnb', status: 'checked_out', createdAt: new Date() },
      ],
      2,
      3,
    );
    const html = generateReportHtml(data);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Pousada Teste');
    expect(html).toContain('Julho 2026');
    expect(html).toContain('Suíte 1'); // top room aparece
    expect(html).toContain('Suíte 2');
    expect(html).toContain('R$');
    expect(html).toContain('window.print');
  });

  it('generateReportHtml inclui botão de impressão', () => {
    const data: ReportData = buildMonthlySummaryData(
      baseMetadata,
      [],
      0,
      1,
    );
    const html = generateReportHtml(data);
    expect(html).toContain('print-button');
    expect(html).toContain('Imprimir');
  });
});

describe('airb-pro/report-generator — geração XLSX', () => {
  const baseMetadata = {
    tenantName: 'Pousada XLSX',
    tenantEmail: undefined,
    generatedAt: new Date('2026-07-31'),
    generatedBy: 'Teste',
    periodLabel: 'Julho 2026',
    filtersApplied: ['monthly_summary'] as const,
  };

  it('generateReportXlsx retorna ArrayBuffer não-vazio', () => {
    const data: ReportData = buildMonthlySummaryData(
      baseMetadata,
      [
        { guestName: 'Hóspede 1', roomName: 'Quarto A', totalValue: 300, source: 'direct', status: 'confirmed', createdAt: new Date() },
      ],
      1,
      1,
    );
    const buf = generateReportXlsx(data);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000); // XLSX mínimo é ~2-4KB
  });

  it('generateReportXlsx com dados de reservas', () => {
    const data: ReportData = {
      metadata: { ...baseMetadata, filtersApplied: ['reservations'] },
      reservations: {
        bookings: [
          {
            guestName: 'Carlos', roomName: 'Suíte Luxo',
            checkIn: new Date('2026-07-01'), checkOut: new Date('2026-07-03'),
            nights: 2, totalValue: 600, status: 'confirmed', source: 'direct',
            paymentMethod: 'pix', paymentStatus: 'paid',
          },
        ],
        summary: { total: 1, confirmed: 1, checkedIn: 0, checkedOut: 0, cancelled: 0, totalRevenue: 600, avgNights: 2 },
      },
    };
    const buf = generateReportXlsx(data);
    expect(buf.byteLength).toBeGreaterThan(2000);
  });
});

describe('airb-pro/report-generator — geração CSV', () => {
  const baseMetadata = {
    tenantName: 'Pousada CSV',
    tenantEmail: undefined,
    generatedAt: new Date('2026-07-31'),
    generatedBy: 'Teste',
    periodLabel: 'Julho 2026',
    filtersApplied: ['guests'] as const,
  };

  it('generateReportCsv retorna string com cabeçalho', () => {
    const data: ReportData = {
      metadata: baseMetadata,
      guests: {
        guests: [
          { name: 'Ana', phone: '11999999999', email: 'ana@x.com', status: 'new', source: 'whatsapp', value: 0, aiScore: 75, conversationCount: 1, lastContact: new Date() },
        ],
        summary: { total: 1, byStatus: { new: 1 }, bySource: { whatsapp: 1 }, totalValue: 0, avgScore: 75 },
      },
    };
    const csv = generateReportCsv(data);
    expect(csv).toContain('Zélla AirB Pro');
    expect(csv).toContain('Pousada CSV');
    expect(csv).toContain('Ana');
    expect(csv).toContain('HÓSPEDES');
  });
});

describe('airb-pro/report-generator — dispatcher', () => {
  const baseMetadata = {
    tenantName: 'Dispatcher Test',
    generatedAt: new Date(),
    generatedBy: 'test',
    periodLabel: 'Teste',
    filtersApplied: ['monthly_summary'] as const,
  };

  it('generateReport retorna HTML para format=pdf', () => {
    const data: ReportData = buildMonthlySummaryData(baseMetadata, [], 0, 1);
    const result = generateReport(data, 'pdf');
    expect(result.mimeType).toContain('text/html');
    expect(result.fileExtension).toBe('html');
    expect(typeof result.content).toBe('string');
  });

  it('generateReport retorna XLSX para format=xlsx', () => {
    const data: ReportData = buildMonthlySummaryData(baseMetadata, [], 0, 1);
    const result = generateReport(data, 'xlsx');
    expect(result.mimeType).toContain('spreadsheet');
    expect(result.fileExtension).toBe('xlsx');
    expect(result.content).toBeInstanceOf(ArrayBuffer);
  });

  it('generateReport retorna CSV para format=csv', () => {
    const data: ReportData = buildMonthlySummaryData(baseMetadata, [], 0, 1);
    const result = generateReport(data, 'csv');
    expect(result.mimeType).toContain('text/csv');
    expect(result.fileExtension).toBe('csv');
    expect(typeof result.content).toBe('string');
  });
});

describe('airb-pro/report-generator — buildMonthlySummaryData', () => {
  it('agrupa reservas por acomodação corretamente', () => {
    const metadata = {
      tenantName: 'Test',
      generatedAt: new Date(),
      generatedBy: 'test',
      periodLabel: 'Mês',
      filtersApplied: ['monthly_summary'] as const,
    };
    const bookings = [
      { guestName: 'A', roomName: 'Suíte 1', totalValue: 500, source: 'direct', status: 'confirmed', createdAt: new Date() },
      { guestName: 'B', roomName: 'Suíte 1', totalValue: 500, source: 'direct', status: 'confirmed', createdAt: new Date() },
      { guestName: 'C', roomName: 'Suíte 2', totalValue: 800, source: 'airbnb', status: 'checked_out', createdAt: new Date() },
    ];
    const data = buildMonthlySummaryData(metadata, bookings, 3, 2);
    expect(data.monthlySummary?.totalBookings).toBe(3);
    expect(data.monthlySummary?.totalRevenue).toBe(1800);
    expect(data.monthlySummary?.avgTicket).toBeCloseTo(600, 2);
    expect(data.monthlySummary?.topRooms).toHaveLength(2);
    expect(data.monthlySummary?.topRooms[0].name).toBe('Suíte 1'); // 1000 > 800
    expect(data.monthlySummary?.topRooms[0].bookings).toBe(2);
  });

  it('agrupa reservas por origem corretamente', () => {
    const metadata = {
      tenantName: 'Test',
      generatedAt: new Date(),
      generatedBy: 'test',
      periodLabel: 'Mês',
      filtersApplied: ['monthly_summary'] as const,
    };
    const bookings = [
      { guestName: 'A', roomName: 'S1', totalValue: 500, source: 'direct', status: 'confirmed', createdAt: new Date() },
      { guestName: 'B', roomName: 'S2', totalValue: 600, source: 'airbnb', status: 'confirmed', createdAt: new Date() },
      { guestName: 'C', roomName: 'S3', totalValue: 700, source: 'airbnb', status: 'confirmed', createdAt: new Date() },
    ];
    const data = buildMonthlySummaryData(metadata, bookings, 3, 5);
    const airbnbSource = data.monthlySummary?.bySource.find(s => s.source === 'airbnb');
    expect(airbnbSource?.bookings).toBe(2);
    expect(airbnbSource?.revenue).toBe(1300);
  });

  it('calcula ticket médio corretamente', () => {
    const metadata = {
      tenantName: 'Test',
      generatedAt: new Date(),
      generatedBy: 'test',
      periodLabel: 'Mês',
      filtersApplied: ['monthly_summary'] as const,
    };
    const bookings = [
      { guestName: 'A', roomName: 'S1', totalValue: 100, source: 'd', status: 'ok', createdAt: new Date() },
      { guestName: 'B', roomName: 'S2', totalValue: 200, source: 'd', status: 'ok', createdAt: new Date() },
      { guestName: 'C', roomName: 'S3', totalValue: 300, source: 'd', status: 'ok', createdAt: new Date() },
    ];
    const data = buildMonthlySummaryData(metadata, bookings, 3, 5);
    expect(data.monthlySummary?.avgTicket).toBeCloseTo(200, 2);
  });

  it('lida com lista vazia de reservas', () => {
    const metadata = {
      tenantName: 'Test',
      generatedAt: new Date(),
      generatedBy: 'test',
      periodLabel: 'Mês',
      filtersApplied: ['monthly_summary'] as const,
    };
    const data = buildMonthlySummaryData(metadata, [], 0, 5);
    expect(data.monthlySummary?.totalBookings).toBe(0);
    expect(data.monthlySummary?.totalRevenue).toBe(0);
    expect(data.monthlySummary?.avgTicket).toBe(0);
    expect(data.monthlySummary?.topRooms).toHaveLength(0);
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// ═══════════════════════════════════════════════════════════════
// ZCC EXPORT — Geração de PDF e XLSX do Breakdown
//
// Body: {
//   format: 'pdf' | 'xlsx',
//   period: 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year',
//   sections: ['kpis', 'planBreakdown', 'nicheBreakdown', 'churn', 'insights', 'funnel']
// }
//
// Para PDF: gera HTML minimalista com inline CSS que pode ser impresso/salvo como PDF
// Para XLSX: gera CSV (compatível com Excel) com separador ;
// ═══════════════════════════════════════════════════════════════

interface ExportBody {
  format: 'pdf' | 'xlsx';
  period: string;
  sections: string[];
  data?: any;
}

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  let body: ExportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_BODY', message: 'JSON inválido' },
      { status: 400 }
    );
  }

  const { format, period, sections, data } = body;

  if (format !== 'pdf' && format !== 'xlsx') {
    return NextResponse.json(
      { success: false, error: 'INVALID_FORMAT', message: 'format deve ser "pdf" ou "xlsx"' },
      { status: 400 }
    );
  }

  const periodLabels: Record<string, string> = {
    day: 'Dia', week: 'Semana', month: 'Mês',
    quarter: 'Trimestre', semester: 'Semestre', year: 'Ano',
  };
  const periodLabel = periodLabels[period] ?? 'Mês';
  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // ── Se formato XLSX → CSV ──────────────────────────────────────
  if (format === 'xlsx') {
    const csv = generateCSV(data, sections, periodLabel, generatedAt);
    const filename = `zcc-breakdown-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── Se formato PDF → HTML imprimível ───────────────────────────
  const html = generatePDFHTML(data, sections, periodLabel, generatedAt);
  const filename = `zcc-breakdown-${period}-${new Date().toISOString().slice(0, 10)}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ── CSV Generator ────────────────────────────────────────────────

function generateCSV(data: any, sections: string[], periodLabel: string, generatedAt: string): string {
  const rows: string[][] = [];
  const sep = ';';

  rows.push(['ZCC BREAKDOWN - RELATORIO']);
  rows.push(['Periodo', periodLabel]);
  rows.push(['Gerado em', generatedAt]);
  rows.push([]);

  if (!data) {
    rows.push(['ERRO', 'Dados nao recebidos']);
    return '\ufeff' + rows.map((r) => r.join(sep)).join('\n');
  }

  const curr = data.current || {};
  const prev = data.previous || {};

  // KPIs
  if (sections.includes('kpis')) {
    rows.push(['=== KPIS ===']);
    rows.push(['Metrica', 'Atual', 'Anterior', 'Variacao %']);
    rows.push(['MRR Total (R$)', curr.totalMRR ?? 0, prev.totalMRR ?? 0, calcChange(curr.totalMRR, prev.totalMRR)]);
    rows.push(['Novo MRR (R$)', curr.newMRR ?? 0, prev.newMRR ?? 0, calcChange(curr.newMRR, prev.newMRR)]);
    rows.push(['MRR Perdido (R$)', curr.lostMRR ?? 0, prev.lostMRR ?? 0, calcChange(curr.lostMRR, prev.lostMRR)]);
    rows.push(['Clientes Ativos', curr.activeClients ?? 0, prev.activeClients ?? 0, calcChange(curr.activeClients, prev.activeClients)]);
    rows.push(['Novos Clientes', curr.newClients ?? 0, prev.newClients ?? 0, calcChange(curr.newClients, prev.newClients)]);
    rows.push(['Churned', curr.churnedClients ?? 0, prev.churnedClients ?? 0, calcChange(curr.churnedClients, prev.churnedClients)]);
    rows.push(['Leads Totais', curr.totalLeads ?? 0, prev.totalLeads ?? 0, calcChange(curr.totalLeads, prev.totalLeads)]);
    rows.push(['Leads Convertidos', curr.convertedLeads ?? 0, prev.convertedLeads ?? 0, calcChange(curr.convertedLeads, prev.convertedLeads)]);
    rows.push(['Taxa de Conversao (%)', curr.conversionRate ?? 0, prev.conversionRate ?? 0, calcChange(curr.conversionRate, prev.conversionRate)]);
    rows.push(['Receita (R$)', curr.revenue ?? 0, prev.revenue ?? 0, calcChange(curr.revenue, prev.revenue)]);
    rows.push(['ARPU (R$)', curr.arpu ?? 0, prev.arpu ?? 0, calcChange(curr.arpu, prev.arpu)]);
    rows.push(['Burn (R$)', curr.burn ?? 0, prev.burn ?? 0, calcChange(curr.burn, prev.burn)]);
    rows.push(['Lucro Liquido (R$)', curr.netProfit ?? 0, prev.netProfit ?? 0, calcChange(curr.netProfit, prev.netProfit)]);
    rows.push([]);
  }

  // Plan breakdown
  if (sections.includes('planBreakdown') && data.planBreakdown) {
    rows.push(['=== PLAN BREAKDOWN ===']);
    rows.push(['Plano', 'Preco (R$)', 'Assinantes', 'MRR (R$)', 'Proporcao (%)']);
    for (const p of data.planBreakdown) {
      rows.push([p.label, p.price, p.count, p.mrr, p.ratio]);
    }
    rows.push([]);
  }

  // Niche breakdown
  if (sections.includes('nicheBreakdown') && data.nicheBreakdown) {
    rows.push(['=== NICHE BREAKDOWN ===']);
    rows.push(['Nicho', 'Clientes', 'MRR (R$)', 'Proporcao (%)']);
    for (const n of data.nicheBreakdown) {
      rows.push([n.label, n.clients, n.mrr, n.ratio]);
    }
    rows.push([]);
  }

  // Churn
  if (sections.includes('churn')) {
    rows.push(['=== CHURN SUMMARY ===']);
    rows.push(['Metrica', 'Valor']);
    rows.push(['Churn Rate (%)', String(curr.churnedClients && curr.activeClients ? Math.round((curr.churnedClients / (curr.activeClients + curr.churnedClients)) * 1000) / 10 : 0)]);
    rows.push(['Active Clients', String(curr.activeClients ?? 0)]);
    rows.push(['Churned Clients', String(curr.churnedClients ?? 0)]);
    rows.push(['MRR Lost (R$)', String(curr.lostMRR ?? 0)]);
    rows.push([]);
  }

  // Insights
  if (sections.includes('insights') && data.insights) {
    rows.push(['=== INSIGHTS & RECOMENDACOES ===']);
    rows.push(['Tipo', 'Severidade', 'Metrica', 'Mensagem', 'Setor', 'Recomendacao', 'Meta']);
    for (const i of data.insights) {
      rows.push([
        i.type,
        i.severity,
        i.metric,
        i.message,
        i.actionArea,
        i.recommendation,
        i.futureGoal ?? '',
      ]);
    }
    rows.push([]);
  }

  // Sales funnel
  if (sections.includes('funnel') && data.funnel) {
    rows.push(['=== FUNIL DE VENDAS (GOOGLE ADS) ===']);
    rows.push(['Etapa', 'Quantidade', 'Conversao (%)', 'Custo Medio (R$)', 'Tempo Medio (dias)', 'Dropoff (%)']);
    for (const f of data.funnel) {
      rows.push([
        f.label,
        f.count,
        f.conversionRate,
        f.avgCost,
        f.avgTimeDays,
        Math.round(f.dropoff * 10) / 10,
      ]);
    }
    rows.push([]);
  }

  return '\ufeff' + rows.map((r) => r.map((c) => String(c ?? '')).join(sep)).join('\n');
}

function calcChange(curr: number, prev: number): string {
  if (!prev || prev === 0) return curr > 0 ? '+100%' : '0%';
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${Math.round(change * 10) / 10}%`;
}

// ── PDF (HTML imprimível) Generator ─────────────────────────────

function generatePDFHTML(data: any, sections: string[], periodLabel: string, generatedAt: string): string {
  const curr = data?.current || {};
  const prev = data?.previous || {};
  const insights = data?.insights || [];

  const fmtBRL = (n: number) =>
    (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${Math.round((n ?? 0) * 10) / 10}%`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZCC Breakdown — ${periodLabel} — ${generatedAt}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #fff;
      padding: 32px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 22px; color: #0f172a; }
    .header .meta { font-size: 11px; color: #64748b; text-align: right; }
    .header .badge {
      display: inline-block;
      padding: 4px 10px;
      background: #0f172a;
      color: #fff;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    h2 {
      font-size: 14px;
      color: #0f172a;
      margin: 24px 0 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .positive { color: #059669; font-weight: 600; }
    .negative { color: #dc2626; font-weight: 600; }
    .critical { color: #dc2626; }
    .success { color: #059669; }
    .warning { color: #d97706; }
    .info { color: #2563eb; }
    .insight-card {
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .insight-card.critical { border-left: 4px solid #dc2626; background: #fef2f2; }
    .insight-card.warning { border-left: 4px solid #d97706; background: #fffbeb; }
    .insight-card.success { border-left: 4px solid #059669; background: #ecfdf5; }
    .insight-card.info { border-left: 4px solid #2563eb; background: #eff6ff; }
    .insight-card h3 { font-size: 12px; margin-bottom: 6px; }
    .insight-card p { font-size: 11px; color: #475569; margin-bottom: 4px; }
    .insight-card .action { font-size: 11px; }
    .insight-card .action strong { color: #0f172a; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
    }
    .kpi-card .label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-card .value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-card .change {
      font-size: 10px;
      margin-top: 4px;
    }
    @media print {
      body { padding: 16px; }
      .header { page-break-after: avoid; }
      h2 { page-break-after: avoid; }
      .insight-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>ZCC Financial Breakdown</h1>
      <p style="font-size:11px; color:#64748b;">Seu Zélla · Central Control</p>
    </div>
    <div class="meta">
      <div class="badge">${periodLabel}</div>
      <div style="margin-top:4px;">Gerado: ${generatedAt}</div>
      <div style="margin-top:2px;">Período atual: ${curr.range?.label ?? '—'}</div>
      <div>Período anterior: ${prev.range?.label ?? '—'}</div>
    </div>
  </div>

  ${
    sections.includes('kpis')
      ? `<h2>KPIs Principais</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">MRR Total</div>
      <div class="value">${fmtBRL(curr.totalMRR)}</div>
      <div class="change ${changeClass(curr.totalMRR, prev.totalMRR)}">${calcChange(curr.totalMRR, prev.totalMRR)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Clientes Ativos</div>
      <div class="value">${curr.activeClients ?? 0}</div>
      <div class="change ${changeClass(curr.activeClients, prev.activeClients)}">${calcChange(curr.activeClients, prev.activeClients)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Novos Clientes</div>
      <div class="value">${curr.newClients ?? 0}</div>
      <div class="change ${changeClass(curr.newClients, prev.newClients)}">${calcChange(curr.newClients, prev.newClients)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Churned</div>
      <div class="value">${curr.churnedClients ?? 0}</div>
      <div class="change ${changeClass(curr.churnedClients, prev.churnedClients, true)}">${calcChange(curr.churnedClients, prev.churnedClients)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Leads Convertidos</div>
      <div class="value">${curr.convertedLeads ?? 0}</div>
      <div class="change ${changeClass(curr.convertedLeads, prev.convertedLeads)}">${calcChange(curr.convertedLeads, prev.convertedLeads)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Conversão</div>
      <div class="value">${fmtPct(curr.conversionRate ?? 0)}</div>
      <div class="change ${changeClass(curr.conversionRate, prev.conversionRate)}">${calcChange(curr.conversionRate, prev.conversionRate)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">ARPU</div>
      <div class="value">${fmtBRL(curr.arpu)}</div>
      <div class="change ${changeClass(curr.arpu, prev.arpu)}">${calcChange(curr.arpu, prev.arpu)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Lucro Líquido</div>
      <div class="value">${fmtBRL(curr.netProfit)}</div>
      <div class="change ${changeClass(curr.netProfit, prev.netProfit)}">${calcChange(curr.netProfit, prev.netProfit)}</div>
    </div>
  </div>`
      : ''
  }

  ${
    sections.includes('planBreakdown') && data?.planBreakdown?.length
      ? `<h2>Plan Breakdown</h2>
  <table>
    <thead>
      <tr><th>Plano</th><th>Preço</th><th>Assinantes</th><th>MRR</th><th>%</th></tr>
    </thead>
    <tbody>
      ${data.planBreakdown.map((p: any) => `
        <tr>
          <td><strong>${p.label}</strong></td>
          <td>${fmtBRL(p.price)}</td>
          <td>${p.count}</td>
          <td>${fmtBRL(p.mrr)}</td>
          <td>${fmtPct(p.ratio)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`
      : ''
  }

  ${
    sections.includes('nicheBreakdown') && data?.nicheBreakdown?.length
      ? `<h2>Niche Breakdown</h2>
  <table>
    <thead>
      <tr><th>Nicho</th><th>Clientes</th><th>MRR</th><th>%</th></tr>
    </thead>
    <tbody>
      ${data.nicheBreakdown.map((n: any) => `
        <tr>
          <td><strong>${n.label}</strong></td>
          <td>${n.clients}</td>
          <td>${fmtBRL(n.mrr)}</td>
          <td>${fmtPct(n.ratio)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`
      : ''
  }

  ${
    sections.includes('churn')
      ? `<h2>Churn Summary</h2>
  <table>
    <tr><th>Churn Rate</th><td>${fmtPct(curr.churnedClients && curr.activeClients ? (curr.churnedClients / (curr.activeClients + curr.churnedClients)) * 100 : 0)}</td></tr>
    <tr><th>Active Clients</th><td>${curr.activeClients ?? 0}</td></tr>
    <tr><th>Churned</th><td>${curr.churnedClients ?? 0}</td></tr>
    <tr><th>MRR Lost</th><td>${fmtBRL(curr.lostMRR)}</td></tr>
  </table>`
      : ''
  }

  ${
    sections.includes('insights') && insights.length
      ? `<h2>Insights & Recomendações</h2>
      ${insights.map((i: any) => `
        <div class="insight-card ${i.severity}">
          <h3 class="${i.severity}">${i.message}</h3>
          <p><strong>Métrica:</strong> ${i.metric} · <strong>Atual:</strong> ${typeof i.current === 'number' ? i.current.toLocaleString('pt-BR') : i.current} · <strong>Anterior:</strong> ${typeof i.previous === 'number' ? i.previous.toLocaleString('pt-BR') : i.previous} · <strong>Variação:</strong> ${i.changePct > 0 ? '+' : ''}${i.changePct}%</p>
          <p class="action"><strong>Setor onde atuar:</strong> ${i.actionArea}</p>
          <p class="action"><strong>Como reverter/melhorar:</strong> ${i.recommendation}</p>
          ${i.futureGoal ? `<p class="action"><strong>Meta futura:</strong> ${i.futureGoal}</p>` : ''}
        </div>
      `).join('')}`
      : ''
  }

  ${
    sections.includes('funnel') && data?.funnel?.length
      ? `<h2>Funil de Vendas (Google Ads)</h2>
  <table>
    <thead>
      <tr><th>Etapa</th><th>Qtd</th><th>Conv. %</th><th>Custo (R$)</th><th>Tempo (dias)</th></tr>
    </thead>
    <tbody>
      ${data.funnel.map((f: any) => `
        <tr>
          <td>${f.label}</td>
          <td>${f.count}</td>
          <td>${f.conversionRate}%</td>
          <td>${fmtBRL(f.avgCost)}</td>
          <td>${f.avgTimeDays}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`
      : ''
  }

  <div class="footer">
    Documento gerado automaticamente pelo ZCC · Seu Zélla · Central Control<br/>
    Em conformidade com LGPD · Não contém dados pessoais sensíveis · Para uso interno
  </div>

  <script>
    // Auto-print quando aberto
    window.onload = function() {
      if (window.location.search.indexOf('autoPrint=1') > -1) {
        window.print();
      }
    };
  </script>
</body>
</html>`;
}

function changeClass(curr: number, prev: number, inverse = false): string {
  if (!prev || prev === 0) return '';
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  if (change > 1) return inverse ? 'negative' : 'positive';
  if (change < -1) return inverse ? 'positive' : 'negative';
  return '';
}

/**
 * GET /api/admin/faturamento-zehla
 *
 * Visão administrativa da seuzella.com — agrega comissões UPSELL (7%) de
 * TODAS as pousadas cadastradas. Retorna faturamento mensal, top pousadas,
 * projeção anual e detalhamento por tipo de UPSELL.
 *
 * Query params:
 *   - month (1-12) — default mês atual
 *   - year (YYYY) — default ano atual
 *   - includeCobrancas=true — inclui lista de cobranças mensais por tenant
 *
 * RBAC: somente ADMIN global pode acessar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import {
  calcularFaturamentoMensalZehla,
  gerarCobrancasMensais,
  formatarPeriodo,
} from '@/lib/upsell/faturamento-zehla';

async function getHandler(req: NextRequest) {
  // RUN 6B (R6B-05a): antes comparava role a 'ADMIN' (uppercase) — string que
  // NUNCA ocorre na sessão (roles reais: owner/admin/staff/client/system_admin,
  // lowercase). Resultado: rota NEGADA para todos, inclusive admins legítimos
  // (fail-closed, mas função morta + role string morta). Gate canônico do
  // plano ZCC agora autoriza de fato o admin da plataforma.
  const zcc = await verifyZCCAccessOrReject(req);
  if (!zcc.allowed) return zcc.response!;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const mes = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
  const ano = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
  const includeCobrancas = searchParams.get('includeCobrancas') === 'true';

  if (mes < 1 || mes > 12 || ano < 2020 || ano > 2100) {
    return NextResponse.json({ error: 'INVALID_PERIOD' }, { status: 400 });
  }

  const [faturamento, cobrancas] = await Promise.all([
    calcularFaturamentoMensalZehla(mes, ano),
    includeCobrancas ? gerarCobrancasMensais(mes, ano) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      periodo: formatarPeriodo(mes, ano),
      mes,
      ano,
      faturamento,
      cobrancas,
    },
  });
}

export const GET = getHandler;

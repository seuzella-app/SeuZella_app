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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  calcularFaturamentoMensalZehla,
  gerarCobrancasMensais,
  formatarPeriodo,
} from '@/lib/upsell/faturamento-zehla';

async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // RBAC: somente ADMIN global pode ver faturamento de todas as pousadas
  const userRole = (session.user as any).role;
  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Acesso restrito a administradores da seuzella.com.' },
      { status: 403 },
    );
  }

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

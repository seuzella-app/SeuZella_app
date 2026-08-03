/**
 * P1-3: API — COMISSIONAMENTO (PARCEIROS/AFILIADOS)
 *
 * GET    /api/ddc/airb-pro/commissions          → lista comissões
 * POST   /api/ddc/airb-pro/commissions          → cria comissão
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import {
  type CommissionInput,
  type CommissionStatus,
  type ReferralType,
  type CommissionRule,
  type CommissionsSummary,
  getMonthPeriod,
  REFERRAL_TYPE_LABELS,
  formatBRL,
} from '@/lib/airb-pro/types';

const VALID_STATUSES: CommissionStatus[] = ['pending', 'payable', 'paid', 'cancelled'];
const VALID_REFERRAL_TYPES: ReferralType[] = ['affiliate', 'agent', 'partner', 'influencer'];
const VALID_RULES: CommissionRule[] = ['percentage', 'fixed'];

function validateInput(body: unknown): { input?: CommissionInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Body inválido' };
  const b = body as Record<string, unknown>;
  if (typeof b.partnerName !== 'string' || b.partnerName.trim().length === 0) {
    return { error: 'partnerName é obrigatório' };
  }
  if (typeof b.rate !== 'number' || b.rate < 0) {
    return { error: 'rate deve ser um número positivo' };
  }
  if (b.referralType && !VALID_REFERRAL_TYPES.includes(b.referralType as ReferralType)) {
    return { error: `referralType deve ser um de: ${VALID_REFERRAL_TYPES.join(', ')}` };
  }
  if (b.rule && !VALID_RULES.includes(b.rule as CommissionRule)) {
    return { error: `rule deve ser um de: ${VALID_RULES.join(', ')}` };
  }
  if (b.rule === 'percentage' && b.rate > 100) {
    return { error: 'rate deve ser ≤ 100 quando rule=percentage' };
  }

  const input: CommissionInput = {
    partnerName: b.partnerName as string,
    partnerEmail: b.partnerEmail as string | undefined,
    partnerPhone: b.partnerPhone as string | undefined,
    partnerCode: b.partnerCode as string | undefined,
    referralType: (b.referralType as ReferralType) || 'affiliate',
    rule: (b.rule as CommissionRule) || 'percentage',
    rate: b.rate as number,
    basisAmount: typeof b.basisAmount === 'number' ? b.basisAmount : 0,
    dueDate: b.dueDate ? new Date(b.dueDate as string) : undefined,
    notes: (b.notes as string) || '',
    metadata: b.metadata as Record<string, unknown> | undefined,
  };
  return { input };
}

function calcCommissionValue(rule: string, rate: number, basisAmount: number): number {
  return rule === 'percentage' ? (basisAmount * rate / 100) : rate;
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
    const status = searchParams.get('status');
    const referralType = searchParams.get('referralType');
    const partnerCode = searchParams.get('partnerCode');
    const summaryMode = searchParams.get('summary') === 'true';
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '100', 10));

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      const demoCommissions = [
        { id: 'demo-1', tenantId, partnerName: 'Agência Turismo SP', partnerEmail: 'contato@turismosp.com', partnerPhone: '+5511999990001', partnerCode: 'TURSP20', referralType: 'agent', rule: 'percentage', rate: 10, basisAmount: 500, status: 'pending', dueDate: new Date(Date.now() + 86400000 * 15), paidAt: null, notes: '', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-2', tenantId, partnerName: 'Influencer Maria', partnerEmail: 'maria@insta.com', partnerPhone: null, partnerCode: 'MARIA15', referralType: 'influencer', rule: 'percentage', rate: 15, basisAmount: 800, status: 'payable', dueDate: new Date(Date.now() + 86400000 * 3), paidAt: null, notes: 'Indicação Suíte Master', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-3', tenantId, partnerName: 'Parceiro Booking', partnerEmail: null, partnerPhone: null, partnerCode: 'BK-DEFAULT', referralType: 'partner', rule: 'percentage', rate: 12, basisAmount: 1200, status: 'paid', dueDate: null, paidAt: new Date(Date.now() - 86400000 * 5), notes: '', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      if (summaryMode) {
        const now = new Date();
        const period = getMonthPeriod(now.getFullYear(), now.getMonth());
        const summary: CommissionsSummary = {
          period,
          totalPending: 50,
          totalPayable: 120,
          totalPaid: 144,
          totalCancelled: 0,
          byPartner: [
            { partnerName: 'Agência Turismo SP', partnerCode: 'TURSP20', referralType: 'agent', count: 1, totalAmount: 50, paid: 0, pending: 50 },
            { partnerName: 'Influencer Maria', partnerCode: 'MARIA15', referralType: 'influencer', count: 1, totalAmount: 120, paid: 0, pending: 120 },
            { partnerName: 'Parceiro Booking', partnerCode: 'BK-DEFAULT', referralType: 'partner', count: 1, totalAmount: 144, paid: 144, pending: 0 },
          ],
          byReferralType: {
            affiliate: { count: 0, total: 0 },
            agent: { count: 1, total: 50 },
            partner: { count: 1, total: 144 },
            influencer: { count: 1, total: 120 },
          },
        };
        return NextResponse.json({ success: true, data: summary, meta: { source: 'demo' } });
      }

      return NextResponse.json({ success: true, data: demoCommissions, meta: { source: 'demo' } });
    }

    const where: Record<string, unknown> = { tenantId };
    if (status && VALID_STATUSES.includes(status as CommissionStatus)) where.status = status;
    if (referralType && VALID_REFERRAL_TYPES.includes(referralType as ReferralType)) where.referralType = referralType;
    if (partnerCode) where.partnerCode = partnerCode;

    if (summaryMode) {
      const records = await db.airbCommission.findMany({ where: where as any, take: 1000 });
      const now = new Date();
      const period = getMonthPeriod(now.getFullYear(), now.getMonth());

      const mapped = records.map(r => ({
        ...r,
        _valor: calcCommissionValue(r.rule, r.rate, r.basisAmount),
      }));

      const totalPending = mapped.filter(r => r.status === 'pending').reduce((s, r) => s + r._valor, 0);
      const totalPayable = mapped.filter(r => r.status === 'payable').reduce((s, r) => s + r._valor, 0);
      const totalPaid = mapped.filter(r => r.status === 'paid').reduce((s, r) => s + r._valor, 0);
      const totalCancelled = mapped.filter(r => r.status === 'cancelled').reduce((s, r) => s + r._valor, 0);

      // Group by partner
      const partnerMap = new Map<string, { partnerCode: string | null; referralType: ReferralType; count: number; totalAmount: number; paid: number; pending: number }>();
      for (const r of mapped) {
        const key = r.partnerName;
        const cur = partnerMap.get(key) || { partnerCode: r.partnerCode, referralType: r.referralType as ReferralType, count: 0, totalAmount: 0, paid: 0, pending: 0 };
        cur.count++;
        cur.totalAmount += r._valor;
        if (r.status === 'paid') cur.paid += r._valor;
        else if (r.status === 'pending' || r.status === 'payable') cur.pending += r._valor;
        partnerMap.set(key, cur);
      }
      const byPartner = Array.from(partnerMap.entries()).map(([partnerName, v]) => ({ partnerName, ...v }));

      // Group by referralType
      const byReferralTypeMap: Record<ReferralType, { count: number; total: number }> = {
        affiliate: { count: 0, total: 0 },
        agent: { count: 0, total: 0 },
        partner: { count: 0, total: 0 },
        influencer: { count: 0, total: 0 },
      };
      for (const r of mapped) {
        const t = r.referralType as ReferralType;
        if (byReferralTypeMap[t]) {
          byReferralTypeMap[t].count++;
          byReferralTypeMap[t].total += r._valor;
        }
      }

      const summary: CommissionsSummary = {
        period,
        totalPending,
        totalPayable,
        totalPaid,
        totalCancelled,
        byPartner,
        byReferralType: byReferralTypeMap,
      };

      return NextResponse.json({ success: true, data: summary, meta: { source: 'db' } });
    }

    const records = await db.airbCommission.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: records.map(r => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata) : {},
      })),
      meta: { total: records.length, source: 'db' },
    });
  } catch (error) {
    console.error('[airb-pro/commissions GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao listar comissões' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { input, error } = validateInput(body);
    if (error || !input) {
      return NextResponse.json({ success: false, error: error || 'Input inválido' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({
        success: true,
        data: {
          id: `demo-${Date.now()}`,
          tenantId,
          ...input,
          status: 'pending',
          paidAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        meta: { source: 'demo' },
      });
    }

    // Gera partnerCode único se não fornecido
    let partnerCode = input.partnerCode;
    if (!partnerCode) {
      const slug = input.partnerName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      partnerCode = `${slug}${random}`;
    }

    const created = await db.airbCommission.create({
      data: {
        tenantId,
        partnerName: input.partnerName,
        partnerEmail: input.partnerEmail || null,
        partnerPhone: input.partnerPhone || null,
        partnerCode,
        referralType: input.referralType || 'affiliate',
        rule: input.rule || 'percentage',
        rate: input.rate,
        basisAmount: input.basisAmount || 0,
        status: 'pending',
        dueDate: input.dueDate || null,
        notes: input.notes || '',
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[airb-pro/commissions POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar comissão' }, { status: 500 });
  }
}

/**
 * ZCC — Converted Pousadas API
 * =================================
 *
 * GET /api/leads/converted-pousadas
 *
 * Retorna todos os Tenants ativos (plan != 'free', status = 'active')
 * que têm Property cadastrada com latitude/longitude. Esses são plotados
 * como BOLINHAS VERDES no LiveLeadsMap (ZCC > Live Leads > Mapa).
 *
 * Fluxo de conversão:
 *   1. Dono de pousada visita seuzella.com
 *   2. Compra um plano (LITE/PRO/MAX/PARCEIRO)
 *   3. Faz cadastro completo da pousada (endereço → lat/lng via geocoding)
 *   4. Tenant é criado com status='active' e Property com latitude/longitude
 *   5. Esta API retorna o Tenant → bolinha VERDE no mapa
 *
 * LGPD: dados empresariais (CNPJ, endereço comercial) — não pessoais.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // ZCC admin only
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json({
      pousadas: [],
      total: 0,
      databaseAvailable: false,
    });
  }

  try {
    // Busca Tenants ativos com qualquer plano (lite, pro, max, parceiro)
    // Sem filtro de Property no WHERE para evitar tipagem complexa — filtramos
    // manualmente após o fetch (apenas aqueles com Property + lat/lng viram bolinha verde)
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
        plan: { in: ['lite', 'pro', 'max', 'parceiro'] },
      },
      include: {
        property: true,
      },
      orderBy: { subscriptionAt: 'desc' },
    });

    // Filtra apenas aqueles com Property + lat/lng válidos (no client-side do mapa)
    const pousadas = tenants
      .filter(t => t.property && t.property.latitude != null && t.property.longitude != null)
      .map(t => ({
        id: t.id,
        tenantId: t.id,
        nome: t.property?.name || t.name,
        plano: t.plan,
        status: t.status,
        subscriptionAt: t.subscriptionAt?.toISOString?.() ?? null,
        // Endereço completo montado
        enderecoCompleto: t.property
          ? `${t.property.street}, ${t.property.number} - ${t.property.neighborhood}, ${t.property.city}/${t.property.state} - CEP ${t.property.zipCode}`
          : '',
        // Coordenadas geográficas (do Property)
        lat: t.property?.latitude ?? null,
        lng: t.property?.longitude ?? null,
        // Dados de contato
        whatsapp: t.whatsappPhoneNumber ?? null,
        email: t.email ?? null,
        phone: t.phone ?? null,
        // Metadados para o popup
        niche: t.niche,
        cidade: t.property?.city ?? '',
        uf: t.property?.state ?? '',
        rua: t.property?.street ?? '',
        numero: t.property?.number ?? '',
        bairro: t.property?.neighborhood ?? '',
        tipo: t.property?.type ?? 'pousada',
      }));

    return NextResponse.json({
      pousadas,
      total: pousadas.length,
      databaseAvailable: true,
    });
  } catch (error) {
    console.error('[CONVERTED_POUSADAS] Erro:', error);
    return NextResponse.json({
      pousadas: [],
      total: 0,
      databaseAvailable: false,
      error: 'Failed to fetch converted pousadas',
    }, { status: 500 });
  }
}

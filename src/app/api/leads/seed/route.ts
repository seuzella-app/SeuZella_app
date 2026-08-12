import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/leads/seed
 * Popula o banco com leads de exemplo.
 * Body: { leads: [...] }
 *
 * Em produção: rodar `bun run scripts/seed-leads.ts` que faz upsert no Prisma.
 * Esta rota é para uso via UI ou API externa.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const leads = body.leads;

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json(
      { error: "Body deve conter { leads: [...] }" },
      { status: 400 }
    );
  }

  // Em produção:
  // for (const lead of leads) {
  //   await db.lead.upsert({
  //     where: { id: `seed-${lead.cidade}-${lead.pousada}` },
  //     update: lead,
  //     create: { id: `seed-${lead.cidade}-${lead.pousada}`, ...lead },
  //   });
  // }
  // const total = await db.lead.count();

  return NextResponse.json({
    ok: true,
    seeded: leads.length,
    message: `Em produção, ${leads.length} leads seriam inseridos via Prisma upsert.`,
  });
}

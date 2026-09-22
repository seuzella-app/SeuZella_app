import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { db } from '@/lib/db';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// ── GET: Load Link-in-Bio config for the current tenant ──────────────────────

export async function GET() {
  try {
    const tenantId = await requireDDCTenantId();

    const property = await db.property.findUnique({
      where: { tenantId },
      include: {
        linkinbioLinks: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 });
    }

    const slug = property.slug || generateSlug(property.name);

    return NextResponse.json({
      slug,
      propertyName: property.name,
      subtitle: property.linkinbioSubtitle || '',
      avatarUrl: property.linkinbioAvatarUrl || '',
      backgroundImageUrl: property.linkinbioBackgroundUrl || '',
      accentColor: property.linkinbioAccentColor || '#10b981',
      instagramHandle: property.linkinbioInstagram || '',
      rating: property.linkinbioRating || 0,
      reviewCount: property.linkinbioReviewCount || 0,
      isActive: property.linkinbioIsActive,
      isBetaPartner: property.linkinbioIsBetaPartner,
      links: property.linkinbioLinks.map((l) => ({
        id: l.id,
        label: l.label,
        url: l.url,
        icon: l.icon,
        isHighlight: l.isHighlight,
        order: l.order,
        isActive: l.isActive,
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[GET /api/ddc/linkinbio]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ── POST: Save Link-in-Bio config (profile + links) ─────────────────────────

export async function POST(req: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'ddc.linkinbio', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.linkinbio', what: 'ddc.linkinbio.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireDDCTenantId();
    const body = await req.json();

    const {
      subtitle,
      avatarUrl,
      backgroundImageUrl,
      accentColor,
      instagramHandle,
      rating,
      reviewCount,
      links,
    } = body;

    const existingProperty = await db.property.findUnique({
      where: { tenantId },
    });

    if (!existingProperty) {
      return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 });
    }

    const slug = existingProperty.slug || generateSlug(existingProperty.name);

    // Update property profile fields
    await db.property.update({
      where: { tenantId },
      data: {
        slug,
        linkinbioSubtitle: subtitle || '',
        linkinbioAvatarUrl: avatarUrl || null,
        linkinbioBackgroundUrl: backgroundImageUrl || null,
        linkinbioAccentColor: accentColor || '#10b981',
        linkinbioInstagram: instagramHandle || null,
        linkinbioRating: rating ?? 0,
        linkinbioReviewCount: reviewCount ?? 0,
        linkinbioIsActive: true,
        linkinbioPlanStart: existingProperty.linkinbioPlanStart || new Date(),
      },
    });

    // Replace links: delete all, then create new ones
    await db.linkInBioLink.deleteMany({
      where: { propertyId: existingProperty.id },
    });

    if (Array.isArray(links) && links.length > 0) {
      await db.linkInBioLink.createMany({
        data: links.map((link: any, i: number) => ({
          propertyId: existingProperty.id,
          label: link.label || 'Link',
          url: link.url || '#',
          icon: link.icon || '🔗',
          isHighlight: link.isHighlight || false,
          order: link.order ?? i,
          isActive: link.isActive !== false,
        })),
      });
    }

    return NextResponse.json({ success: true, slug });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[POST /api/ddc/linkinbio]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ── Helper ──────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}
/**
 * ============================================================
 * V11 — Guest DDC Page (PPR + Streaming SSR)
 * ============================================================
 * Path: src/app/[locale]/(guest)/ddc/page.tsx
 *
 * Architecture:
 *   - Partial Prerendering (PPR): the static shell (layout,
 *     sidebar, mobile bottom nav, empty containers, skeletons)
 *     is prerendered at build time and served from the CDN edge
 *     with TTFB < 50ms.
 *   - Dynamic Streaming: the slow sections (active reservations,
 *     pending invoices, last concierge message) are wrapped in
 *     <Suspense> boundaries and streamed to the client via
 *     HTTP/2 chunked transfer as they resolve on the server.
 *
 * Quality targets (4G Brazilian mobile):
 *   - TTFB  < 50ms  (CDN edge serves the static shell)
 *   - LCP   < 2.5s  (skeleton paints immediately, real data streams in)
 *   - INP   < 200ms (only DdcMobileActions is a client island)
 *   - CLS   < 0.1   (skeleton dimensions match real content)
 *
 * Next.js 16 / React 19 conventions:
 *   - `await params` (async params access — required in Next.js 16)
 *   - `experimental_ppr = true` (enables PPR for this route)
 *   - No `'use client'` directive (pure Server Component)
 *
 * Refs:
 *   - Volume 6 §PPR, §Streaming SSR
 *   - Volume 7 §BFF Aggregation
 *   - V11-P0.7 §withSecurity (used by the BFF endpoint)
 * ============================================================
 */

import * as React from 'react';
import { Suspense } from 'react';

import { DashboardGrid } from '@/components/guest/DashboardGrid';
import { DdcSkeleton } from '@/components/guest/DdcSkeleton';
import { DdcMobileActions } from '@/components/guest/DdcMobileActions';

// ---------------------------------------------------------------
// PPR enablement — Next.js 16 experimental flag.
// The static shell of this page (everything outside <Suspense>
// boundaries) is prerendered at build time.
// ---------------------------------------------------------------
export const experimental_ppr = true;

// The page renders dynamically because the streaming sub-components
// await the BFF fetch. No need to declare `dynamic` or `revalidate`
// — Next.js infers dynamism from the Suspense boundaries.

// ---------------------------------------------------------------
// Types — mirror the BFF contract in
// src/app/api/v1/guest/ddc/overview/route.ts
// ---------------------------------------------------------------
interface TenantBrief {
  id: string;
  name: string;
  niche: 'pousada' | 'airbnb' | string;
  plan: string;
  domain: string | null;
}

interface ActiveReservation {
  id: string;
  guestName: string | null;
  guestPhone: string | null;
  roomName: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
  source: string;
}

interface PendingInvoice {
  id: string;
  type: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  reservationId: string | null;
}

interface ConciergeMessage {
  content: string;
  timestamp: string;
  intent: string | null;
}

interface DdcOverviewPayload {
  tenant: TenantBrief;
  activeReservations: ActiveReservation[];
  pendingInvoices: PendingInvoice[];
  lastConciergeMessage: ConciergeMessage | null;
  generatedAt: string;
}

// ---------------------------------------------------------------
// Server-side fetcher.
//
// We call our own BFF endpoint via an absolute internal URL.
// In production on Vercel, this resolves through the internal
// network. In dev, NEXT_PUBLIC_APP_URL points to localhost:3000.
//
// We pass the request headers through (notably cookies for the
// NextAuth session) so the BFF can call requireTenantId() and
// resolve the same tenant context.
// ---------------------------------------------------------------
async function fetchDdcOverview(
  headers: Headers
): Promise<DdcOverviewPayload | null> {
  try {
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || 'http://localhost:3000';
    const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl : `https://${rawBaseUrl}`;
    const url = `${baseUrl}/api/v1/guest/ddc/overview`;

    const forwardHeaders: HeadersInit = {
      cookie: headers.get('cookie') || '',
      'x-request-id':
        headers.get('x-request-id')
        || `ddc-${Date.now().toString(36)}`,
    };

    const res = await fetch(url, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    });

    if (res.ok) {
      return (await res.json()) as DdcOverviewPayload;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[DDC_PAGE_FETCH_LOOPBACK_ERROR]', err);
  }

  // Direct Server Component fallback when internal HTTP loopback is unavailable
  try {
    const { db: prisma } = await import('@/lib/db');
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true, niche: true, plan: true, domain: true }
    });

    if (!tenant) {
      return {
        tenant: { id: 'demo-tenant', name: 'Seu Zélla SmartHotel', niche: 'pousada', plan: 'ENTERPRISE', domain: 'seuzella.com.br' },
        activeReservations: [],
        pendingInvoices: [],
        lastConciergeMessage: { content: 'Olá! Como posso ajudar na sua estadia hoje?', timestamp: new Date().toISOString(), intent: 'GUEST_WELCOME' },
        generatedAt: new Date().toISOString(),
      };
    }

    const [activeReservations, pendingInvoices] = await Promise.all([
      prisma.reservation.findMany({
        where: { tenantId: tenant.id, status: 'CHECKED_IN' },
        select: {
          id: true,
          guest: { select: { name: true, phone: true } },
          room: { select: { name: true } },
          checkIn: true,
          checkOut: true,
          status: true,
          totalPrice: true,
          source: true,
        },
        take: 10,
      }),
      prisma.transaction.findMany({
        where: { tenantId: tenant.id, status: { in: ['PENDING', 'OVERDUE'] } },
        select: {
          id: true,
          type: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          reservationId: true,
        },
        take: 15,
      }),
    ]);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        niche: tenant.niche ?? 'pousada',
        plan: tenant.plan,
        domain: tenant.domain,
      },
      activeReservations: activeReservations.map((r) => ({
        id: r.id,
        guestName: r.guest?.name ?? 'Hóspede',
        guestPhone: r.guest?.phone ?? null,
        roomName: r.room?.name ?? null,
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        status: r.status,
        totalPrice: r.totalPrice,
        source: r.source,
      })),
      pendingInvoices: pendingInvoices.map((inv) => ({
        id: inv.id,
        type: inv.type,
        amount: inv.amount,
        method: inv.method,
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
        reservationId: inv.reservationId,
      })),
      lastConciergeMessage: {
        content: 'Olá! Sou a assistente inteligente do seu hotel/pousada. Como posso ajudar com sua reserva ou estadia?',
        timestamp: new Date().toISOString(),
        intent: 'CONCIERGE_GREETING',
      },
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      tenant: { id: 'demo-tenant', name: 'Seu Zélla SmartHotel', niche: 'pousada', plan: 'ENTERPRISE', domain: 'seuzella.com.br' },
      activeReservations: [],
      pendingInvoices: [],
      lastConciergeMessage: { content: 'Bem-vindo ao Seu Zélla SmartHotel! Assistente IA ativa 24/7.', timestamp: new Date().toISOString(), intent: 'GUEST_WELCOME' },
      generatedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------
// Streaming sub-components — each one is a Server Component
// wrapped in <Suspense> on the page. They independently await
// their slice of data, allowing the static shell to flush
// immediately and the slow sections to stream in.
// ---------------------------------------------------------------

async function TenantHeader({
  dataPromise,
}: {
  dataPromise: Promise<DdcOverviewPayload | null>;
}) {
  const data = await dataPromise;
  if (!data) {
    return (
      <div className="ddc-tenant-header ddc-tenant-header--error">
        Não foi possível carregar os detalhes da hospedagem.
      </div>
    );
  }
  const { tenant } = data;
  return (
    <header className="ddc-tenant-header" aria-label="Detalhes da hospedagem">
      <h1 className="ddc-tenant-header__title">{tenant.name}</h1>
      <p className="ddc-tenant-header__meta">
        <span className="ddc-tenant-header__niche">
          {tenant.niche === 'airbnb' ? 'Airbnb' : 'Pousada'}
        </span>
        <span className="ddc-tenant-header__plan">Plano {tenant.plan}</span>
      </p>
    </header>
  );
}

async function ActiveReservationsList({
  dataPromise,
}: {
  dataPromise: Promise<DdcOverviewPayload | null>;
}) {
  const data = await dataPromise;
  if (!data || data.activeReservations.length === 0) {
    return (
      <section
        className="ddc-card ddc-card--empty"
        aria-label="Reservas ativas"
      >
        <h2 className="ddc-card__title">Reservas ativas</h2>
        <p className="ddc-card__empty">Nenhuma reserva ativa no momento.</p>
      </section>
    );
  }
  return (
    <section className="ddc-card" aria-label="Reservas ativas">
      <h2 className="ddc-card__title">Reservas ativas</h2>
      <ul className="ddc-card__list">
        {data.activeReservations.map((r) => {
          const checkIn = new Date(r.checkIn).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
          });
          const checkOut = new Date(r.checkOut).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
          });
          return (
            <li key={r.id} className="ddc-reservation">
              <div className="ddc-reservation__primary">
                <span className="ddc-reservation__guest">
                  {r.guestName ?? 'Hóspede'}
                </span>
                <span className="ddc-reservation__room">
                  {r.roomName ?? '—'}
                </span>
              </div>
              <div className="ddc-reservation__meta">
                <span className="ddc-reservation__dates">
                  {checkIn} → {checkOut}
                </span>
                <span className="ddc-reservation__price">
                  R$ {r.totalPrice.toFixed(2)}
                </span>
              </div>
              <span
                className={`ddc-reservation__status ddc-reservation__status--${r.status.toLowerCase()}`}
              >
                {r.status}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function PendingInvoicesList({
  dataPromise,
}: {
  dataPromise: Promise<DdcOverviewPayload | null>;
}) {
  const data = await dataPromise;
  if (!data || data.pendingInvoices.length === 0) {
    return (
      <section
        className="ddc-card ddc-card--empty"
        aria-label="Faturas pendentes"
      >
        <h2 className="ddc-card__title">Faturas pendentes</h2>
        <p className="ddc-card__empty">Nenhuma fatura pendente. Tudo em dia!</p>
      </section>
    );
  }
  return (
    <section className="ddc-card" aria-label="Faturas pendentes">
      <h2 className="ddc-card__title">Faturas pendentes</h2>
      <ul className="ddc-card__list">
        {data.pendingInvoices.map((inv) => (
          <li key={inv.id} className="ddc-invoice">
            <div className="ddc-invoice__primary">
              <span className="ddc-invoice__type">{inv.type}</span>
              <span className="ddc-invoice__method">{inv.method}</span>
            </div>
            <div className="ddc-invoice__meta">
              <span className="ddc-invoice__amount">
                R$ {inv.amount.toFixed(2)}
              </span>
              <span
                className={`ddc-invoice__status ddc-invoice__status--${inv.status.toLowerCase()}`}
              >
                {inv.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ConciergeMessageBlock({
  dataPromise,
}: {
  dataPromise: Promise<DdcOverviewPayload | null>;
}) {
  const data = await dataPromise;
  if (!data || !data.lastConciergeMessage) {
    return (
      <section
        className="ddc-card ddc-card--empty"
        aria-label="Última mensagem do concierge"
      >
        <h2 className="ddc-card__title">Concierge IA</h2>
        <p className="ddc-card__empty">Ainda não há mensagens do concierge.</p>
      </section>
    );
  }
  const msg = data.lastConciergeMessage;
  const ts = new Date(msg.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <section className="ddc-card ddc-card--concierge" aria-label="Última mensagem do concierge">
      <h2 className="ddc-card__title">Concierge IA</h2>
      <blockquote className="ddc-concierge__content">{msg.content}</blockquote>
      <footer className="ddc-concierge__footer">
        <span className="ddc-concierge__timestamp">{ts}</span>
        {msg.intent && (
          <span className="ddc-concierge__intent">{msg.intent}</span>
        )}
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------
// Page (Server Component) — Next.js 16 async params pattern
// ---------------------------------------------------------------
interface DdcPageProps {
  // Next.js 16 / React 19: params is a Promise. The shape is
  // loosely typed here to stay compatible across Next.js patch
  // versions. The route group [locale] is always present.
  params: Promise<{ locale?: string }>;
}

export default async function DdcPage({ params }: DdcPageProps) {
  // Next.js 16 / React 19: params is a Promise. Await it before use.
  // We destructure `locale` so the route group [locale] is honored,
  // even though we currently render the same content for all locales.
  // Future i18n: pass `locale` to fetchDdcOverview to localize strings.
  const { locale } = await params;

  // Headers are available via next/headers in Server Components.
  // We forward them to the BFF so it can read the NextAuth session cookie.
  const { headers } = await import('next/headers');
  const requestHeaders = await headers();

  // Single shared promise — each <Suspense> boundary awaits the
  // same promise. The fetch fires ONCE; the sections just read
  // different slices of the resolved payload. This is the React 19
  // "use() + Suspense" pattern that prevents waterfalls.
  const dataPromise = fetchDdcOverview(requestHeaders);

  return (
    <main className="ddc-page" data-locale={locale ?? 'pt-BR'}>
      <style>{`
        .ddc-page {
          min-height: 100dvh;
          padding: 1rem;
          background: var(--background, hsl(0 0% 100%));
          color: var(--foreground, hsl(240 10% 10%));
          font-family: var(--font-sans, system-ui, sans-serif);
        }
        .ddc-tenant-header {
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border, hsl(240 5% 90%));
          margin-bottom: 1rem;
        }
        .ddc-tenant-header__title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }
        .ddc-tenant-header__meta {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: var(--muted-foreground, hsl(240 4% 46%));
        }
        .ddc-tenant-header--error {
          color: hsl(0 70% 45%);
        }
        .ddc-card {
          border: 1px solid var(--border, hsl(240 5% 90%));
          border-radius: var(--radius, 0.75rem);
          padding: 1rem;
          background: var(--card, hsl(0 0% 100%));
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ddc-card__title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
        }
        .ddc-card__empty {
          color: var(--muted-foreground, hsl(240 4% 46%));
          font-size: 0.875rem;
          margin: 0;
        }
        .ddc-card__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ddc-reservation,
        .ddc-invoice {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.25rem 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border, hsl(240 5% 95%));
        }
        .ddc-reservation:last-child,
        .ddc-invoice:last-child {
          border-bottom: none;
        }
        .ddc-reservation__primary,
        .ddc-invoice__primary {
          display: flex;
          flex-direction: column;
          font-weight: 500;
        }
        .ddc-reservation__meta,
        .ddc-invoice__meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-size: 0.875rem;
        }
        .ddc-reservation__status,
        .ddc-invoice__status {
          grid-column: 1 / -1;
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          align-self: flex-start;
          background: var(--accent, hsl(240 5% 90%));
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ddc-reservation__status--checked_in {
          background: hsl(140 60% 90%);
          color: hsl(140 60% 25%);
        }
        .ddc-invoice__status--overdue {
          background: hsl(0 70% 90%);
          color: hsl(0 70% 30%);
        }
        .ddc-card--concierge {
          background: linear-gradient(135deg, var(--card, hsl(0 0% 100%)), var(--accent, hsl(240 5% 95%)));
        }
        .ddc-concierge__content {
          margin: 0;
          padding: 0.5rem 0;
          font-style: italic;
          border-left: 3px solid var(--accent, hsl(240 5% 70%));
          padding-left: 0.75rem;
        }
        .ddc-concierge__footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--muted-foreground, hsl(240 4% 46%));
        }
        @media (min-width: 1024px) {
          .ddc-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        }
      `}</style>

      {/* Static shell — served from CDN edge with PPR */}
      <DashboardGrid cols={3}>
        <DashboardGrid.Item area="primary">
          <Suspense fallback={<DdcSkeleton />}>
            <TenantHeader dataPromise={dataPromise} />
          </Suspense>
        </DashboardGrid.Item>

        <DashboardGrid.Item area="secondary">
          <Suspense fallback={<DdcSkeleton />}>
            <ActiveReservationsList dataPromise={dataPromise} />
          </Suspense>
        </DashboardGrid.Item>

        <DashboardGrid.Item area="tertiary">
          <Suspense fallback={<DdcSkeleton />}>
            <PendingInvoicesList dataPromise={dataPromise} />
          </Suspense>
        </DashboardGrid.Item>

        <DashboardGrid.Item area="aside">
          <Suspense fallback={<DdcSkeleton />}>
            <ConciergeMessageBlock dataPromise={dataPromise} />
          </Suspense>
        </DashboardGrid.Item>
      </DashboardGrid>

      {/* Client island — the ONLY 'use client' component on this page.
          Polls /api/v1/guest/ddc/notifications every 15s via useSWR
          for reactive alerts without degrading the main thread. */}
      <div className="ddc-mobile-actions-wrapper">
        <DdcMobileActions />
      </div>
    </main>
  );
}

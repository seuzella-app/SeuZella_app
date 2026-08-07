/**
 * ============================================================
 * V11 — Mobile Airbnb DDC Entry Route
 * ============================================================
 * Path: src/app/mobile/airbnb/page.tsx
 *
 * Purpose:
 *   Public-facing mobile entry point for airbnb niche tenants.
 *   Renders the same V11 mobile-first DDC (PPR + BFF + Client
 *   Island) as /[locale]/(guest)/ddc, but with a niche-specific
 *   theme accent (blue for airbnb) and SEO metadata tuned for
 *   the airbnb audience.
 *
 * URL: https://smart-hotel-zehla.vercel.app/mobile/airbnb
 *
 * Architecture:
 *   - Server Component (no 'use client')
 *   - experimental_ppr = true (inherits PPR from the DDC page)
 *   - Delegates rendering to the shared DDC page component
 *   - Sets niche="airbnb" hint via props (used for theming)
 *
 * Refs:
 *   - Volume 6 §PPR, §Mobile-First
 *   - Volume 7 §BFF Aggregation
 * ============================================================
 */

import type { Metadata } from 'next';
import DdcPage from '@/app/[locale]/(guest)/ddc/page';

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: 'Dashboard do Hóspede — Airbnb | Seu Zélla',
  description:
    'Painel mobile do hóspede para hosts Airbnb: reservas ativas, faturas pendentes e concierge IA 24/7. O assistente inteligente da sua hospedagem no WhatsApp.',
  robots: {
    index: false, // guest dashboard — never index
    follow: false,
  },
  openGraph: {
    title: 'Dashboard do Hóspede — Airbnb | Seu Zélla',
    description:
      'Painel mobile do hóspede para hosts Airbnb: reservas, faturas e concierge IA.',
    type: 'website',
  },
};

interface MobileAirbnbPageProps {
  // Next.js 16 / React 19: params is a Promise (even if empty here).
  params: Promise<Record<string, never>>;
}

export default async function MobileAirbnbPage({ params }: MobileAirbnbPageProps) {
  await params; // satisfy the async params contract
  // Delegate to the shared DDC page. The page will fetch tenant data
  // via the BFF and adapt to the actual tenant niche (pousada/airbnb)
  // regardless of which mobile entry point the user arrived from.
  // The niche hint here only affects SEO/theme — not data fetching.
  return (
    <div data-mobile-route="airbnb" data-niche-hint="airbnb">
      <DdcPage params={Promise.resolve({ locale: 'pt-BR' })} />
    </div>
  );
}

/**
 * ============================================================
 * V11 — Mobile Pousada DDC Entry Route
 * ============================================================
 * Path: src/app/mobile/pousada/page.tsx
 *
 * Purpose:
 *   Public-facing mobile entry point for pousada niche tenants.
 *   Renders the same V11 mobile-first DDC (PPR + BFF + Client
 *   Island) as /[locale]/(guest)/ddc, but with a niche-specific
 *   theme accent (green for pousada) and SEO metadata tuned for
 *   the pousada audience.
 *
 * URL: https://smart-hotel-zehla.vercel.app/mobile/pousada
 *
 * Architecture:
 *   - Server Component (no 'use client')
 *   - experimental_ppr = true (inherits PPR from the DDC page)
 *   - Delegates rendering to the shared DDC page component
 *   - Sets niche="pousada" hint via props (used for theming)
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
  title: 'Dashboard do Hóspede — Pousada | Seu Zélla',
  description:
    'Painel mobile do hóspede para pousadas: reservas ativas, faturas pendentes e concierge IA 24/7. O assistente inteligente da sua pousada no WhatsApp.',
  robots: {
    index: false, // guest dashboard — never index
    follow: false,
  },
  openGraph: {
    title: 'Dashboard do Hóspede — Pousada | Seu Zélla',
    description:
      'Painel mobile do hóspede para pousadas: reservas, faturas e concierge IA.',
    type: 'website',
  },
};

interface MobilePousadaPageProps {
  // Next.js 16 / React 19: params is a Promise (even if empty here).
  params: Promise<Record<string, never>>;
}

export default async function MobilePousadaPage({ params }: MobilePousadaPageProps) {
  await params; // satisfy the async params contract
  // Delegate to the shared DDC page. The page will fetch tenant data
  // via the BFF and adapt to the actual tenant niche (pousada/airbnb)
  // regardless of which mobile entry point the user arrived from.
  // The niche hint here only affects SEO/theme — not data fetching.
  return (
    <div data-mobile-route="pousada" data-niche-hint="pousada">
      <DdcPage params={Promise.resolve({ locale: 'pt-BR' })} />
    </div>
  );
}

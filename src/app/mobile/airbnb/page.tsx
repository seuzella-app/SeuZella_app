/**
 * ============================================================
 * DDC Mobile Airbnb Route — Seu Zélla SmartHotel
 * ============================================================
 * Renders the full, ultra-premium DDC Airbnb Dashboard.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/airbnb
 * ============================================================
 */

import type { Metadata } from 'next';
import { DDCAirbnbClientContent } from '@/app/ddc/airbnb/DDCAirbnbClientContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'DDC Airbnb — Seu Zélla SmartHotel',
  description: 'Dashboard do Cliente e Gestão de Anfitriões Airbnb.',
};

export default function MobileAirbnbPage() {
  return <DDCAirbnbClientContent />;
}

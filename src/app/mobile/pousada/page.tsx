/**
 * ============================================================
 * DDC Mobile Pousada Route — Seu Zélla SmartHotel
 * ============================================================
 * Renders the full, ultra-premium DDC Pousada Dashboard.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/pousada
 * ============================================================
 */

import type { Metadata } from 'next';
import { DDCPousadaClientContent } from '@/app/ddc/pousada/DDCPousadaClientContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'DDC Pousada — Seu Zélla SmartHotel',
  description: 'Dashboard do Cliente e Inteligência Operacional para Pousadas.',
};

export default function MobilePousadaPage() {
  return <DDCPousadaClientContent />;
}

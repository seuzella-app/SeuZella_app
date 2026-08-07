/**
 * ============================================================
 * DDC Mobile Pousada Route — Smartphone Viewport Mode
 * ============================================================
 * Renders the DDC Pousada Dashboard inside a Smartphone Phone Frame.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/pousada
 * ============================================================
 */

import type { Metadata } from 'next';
import { DDCPousadaClientContent } from '@/app/ddc/pousada/DDCPousadaClientContent';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'DDC Pousada Mobile — Seu Zélla SmartHotel',
  description: 'Dashboard do Cliente Pousada em Formato Mobile Smartphone.',
};

export default function MobilePousadaPage() {
  return (
    <MobilePhoneWrapper title="DDC Pousada Mobile" niche="pousada">
      <DDCPousadaClientContent />
    </MobilePhoneWrapper>
  );
}

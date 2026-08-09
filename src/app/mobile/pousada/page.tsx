/**
 * ============================================================
 * DDC Mobile Pousada Route — Smartphone Viewport Mode
 * ============================================================
 * Renders the DDC Pousada Dashboard inside a Smartphone Phone Frame.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/pousada
 * ============================================================
 */

import type { Metadata } from 'next';
import { MobilePousadaSuperApp } from '@/components/mobile/MobilePousadaSuperApp';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'DDC Pousada Mobile — Seu Zélla SmartHotel',
  description: 'Super App Mobile Pousada em Formato Smartphone HUD.',
};

export default function MobilePousadaPage() {
  return (
    <MobilePhoneWrapper title="DDC Pousada Mobile" niche="pousada">
      <MobilePousadaSuperApp />
    </MobilePhoneWrapper>
  );
}

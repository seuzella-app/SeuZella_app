/**
 * ============================================================
 * DDC Mobile Airbnb Route — Smartphone Viewport Mode
 * ============================================================
 * Renders the DDC Airbnb Dashboard inside a Smartphone Phone Frame.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/airbnb
 * ============================================================
 */

import type { Metadata } from 'next';
import { DDCAirbnbClientContent } from '@/app/ddc/airbnb/DDCAirbnbClientContent';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'DDC Airbnb Mobile — Seu Zélla SmartHotel',
  description: 'Dashboard do Cliente Airbnb em Formato Mobile Smartphone.',
};

export default function MobileAirbnbPage() {
  return (
    <MobilePhoneWrapper title="DDC Airbnb Mobile" niche="airbnb">
      <DDCAirbnbClientContent />
    </MobilePhoneWrapper>
  );
}

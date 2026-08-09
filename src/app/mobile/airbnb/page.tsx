/**
 * ============================================================
 * DDC Mobile Airbnb Route — Smartphone Viewport Mode
 * ============================================================
 * Renders the DDC Airbnb Dashboard inside a Smartphone Phone Frame.
 * URL: https://smart-hotel-zehla.vercel.app/mobile/airbnb
 * ============================================================
 */

import type { Metadata } from 'next';
import { MobileAirbnbSuperApp } from '@/components/mobile/MobileAirbnbSuperApp';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'DDC Airbnb Mobile — Seu Zélla SmartHotel',
  description: 'Super App Mobile Airbnb em Formato Smartphone HUD.',
};

export default function MobileAirbnbPage() {
  return (
    <MobilePhoneWrapper title="DDC Airbnb Mobile" niche="airbnb">
      <MobileAirbnbSuperApp />
    </MobilePhoneWrapper>
  );
}

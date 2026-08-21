/**
 * DDC Mobile Anfitrião — runtime route for the shared Seu Zélla PWA.
 */
import type { Metadata } from 'next';
import { MobileAirbnbSuperApp } from '@/components/mobile/MobileAirbnbSuperApp';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'DDC Anfitrião Mobile — Seu Zélla',
  description: 'DDC Mobile do anfitrião para operar propriedades, reservas e fechaduras.',
  applicationName: 'Seu Zélla',
  appleWebApp: {
    capable: true,
    title: 'Seu Zélla',
    statusBarStyle: 'black-translucent',
  },
};

export default function MobileAirbnbPage() {
  return (
    <MobilePhoneWrapper title="DDC Anfitrião Mobile" niche="airbnb">
      <MobileAirbnbSuperApp />
    </MobilePhoneWrapper>
  );
}

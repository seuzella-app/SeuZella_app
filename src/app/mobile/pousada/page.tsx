/**
 * DDC Mobile Pousada — runtime route for the shared Seu Zélla PWA.
 */
import type { Metadata } from 'next';
import { MobilePousadaSuperApp } from '@/components/mobile/MobilePousadaSuperApp';
import { MobilePhoneWrapper } from '@/components/mobile/MobilePhoneWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'DDC Pousada Mobile — Seu Zélla',
  description: 'DDC Mobile da pousada para operar hóspedes, reservas, fechaduras e rotina.',
  applicationName: 'Seu Zélla',
  appleWebApp: {
    capable: true,
    title: 'Seu Zélla',
    statusBarStyle: 'black-translucent',
  },
};

export default function MobilePousadaPage() {
  return (
    <MobilePhoneWrapper title="DDC Pousada Mobile" niche="pousada">
      <MobilePousadaSuperApp />
    </MobilePhoneWrapper>
  );
}

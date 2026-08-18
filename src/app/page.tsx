'use client';

import { NicheProvider } from '@/contexts/NicheContext';
import { Header } from '@/components/landing/Header';
import { HeroSection } from '@/components/landing/HeroSection';
import { PainPointsSection } from '@/components/landing/PainPointsSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { ProHostSection } from '@/components/landing/ProHostSection';
import { DashboardPreviewSection } from '@/components/landing/DashboardPreviewSection';
import { NicheSwitcherSection } from '@/components/landing/NicheSwitcherSection';
import BookingPlatformsMarquee from '@/components/landing/BookingPlatformsMarquee';
import { SavingsCalculator } from '@/components/landing/SavingsCalculator';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { BetaFounderSection } from '@/components/landing/BetaFounderSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { ContactSection } from '@/components/landing/ContactSection';
import { TrustBadgesSection } from '@/components/landing/TrustBadgesSection';
import { Footer } from '@/components/landing/Footer';
import { FloatingCTA } from '@/components/landing/FloatingCTA';
import { ZellaSalesWidget } from '@/components/landing/ZellaSalesWidget';

function SectionDivider() {
  return (
    <div className="relative h-px w-full">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export default function HomePage() {
  return (
    <NicheProvider>
      <div className="min-h-screen flex flex-col bg-[#09090b] text-white scroll-smooth">
        <Header />

        <main className="flex-1">
          <HeroSection />
          <SectionDivider />
          <PainPointsSection />
          <SectionDivider />
          <HowItWorksSection />
          <SectionDivider />
          <FeaturesSection />
          <SectionDivider />
          <ProHostSection />
          <SectionDivider />
          <DashboardPreviewSection />
          <SectionDivider />
          <NicheSwitcherSection />
          <BookingPlatformsMarquee />
          <section id="calculadora">
            <SavingsCalculator />
          </section>
          <section id="precos">
            <PricingSection />
          </section>
          <TestimonialsSection />
          <section id="faq">
            <FAQSection />
          </section>
          <CTASection onNavigate={() => {
            const el = document.querySelector('#precos');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }} />
          {/* Sprint 2, Day 11: Mount BetaFounderSection — previously written but never rendered.
              This was 149 lines of dead code with scarcity copy "100 vagas limitadas". */}
          <BetaFounderSection />
          <FinalCTASection />
          <section id="contato">
            <ContactSection />
          </section>
          <TrustBadgesSection />
        </main>

        <footer className="mt-auto">
          <Footer />
        </footer>

        <FloatingCTA />
        <ZellaSalesWidget />
      </div>
    </NicheProvider>
  );
}

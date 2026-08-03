'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { ZellaLogo } from '@/components/brand/ZellaLogo';
import { useNiche } from '@/contexts/NicheContext';

import { trackLandingClick } from '@/lib/telemetry/landing-telemetry';

// ─── Niche-aware color tokens ────────────────────────────────────────────────
// emerald → pousada | blue → airbnb | amber → parceiro (future)
const NICHE_ACCENT: Record<string, { text: string; bg: string; hoverBg: string; shadow: string; ring: string; dot: string }> = {
  pousada: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    hoverBg: 'hover:bg-emerald-400',
    shadow: 'shadow-emerald-500/20 hover:shadow-emerald-500/30',
    ring: 'focus-visible:ring-emerald-600',
    dot: 'bg-emerald-400',
  },
  airbnb: {
    text: 'text-blue-400',
    bg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-400',
    shadow: 'shadow-blue-500/20 hover:shadow-blue-500/30',
    ring: 'focus-visible:ring-blue-600',
    dot: 'bg-blue-400',
  },
  parceiro: {
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-400',
    shadow: 'shadow-amber-500/20 hover:shadow-amber-500/30',
    ring: 'focus-visible:ring-amber-600',
    dot: 'bg-amber-400',
  },
};

function getAccent(niche: string) {
  return NICHE_ACCENT[niche] ?? NICHE_ACCENT.pousada;
}

// ─── Nav links (must match section IDs on the landing page) ──────────────────
const NAV_LINKS = [
  { name: 'Como Funciona', href: '#como-funciona', lgOnly: false },
  { name: 'Recursos', href: '#funcionalidades', lgOnly: false },
  { name: 'Zélla AirB Pro', href: '#prohost', lgOnly: true },
  { name: 'Integrações', href: '#integracoes', lgOnly: true },
  { name: 'Calculadora', href: '#calculadora', lgOnly: true },
  { name: 'Preços', href: '#precos', lgOnly: false },
  { name: 'FAQ', href: '#faq', lgOnly: true },
] as const;

// ─── Header Component ────────────────────────────────────────────────────────
export function Header() {
  const { niche } = useNiche();
  const accent = getAccent(niche);

  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Scroll state ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── IntersectionObserver for active section tracking ─────────────────────
  // CORREÇÃO v2 — finding 4.4: usa 1 único observer para todos os elementos,
  // em vez de criar 4 observers independentes. Reduz overhead de memory e
  // simplifica a lógica de "qual seção está mais visível".
  useEffect(() => {
    const sectionIds = NAV_LINKS.map((l) => l.href.replace('#', ''));
    const elements: HTMLElement[] = [];

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) elements.push(el);
    }

    if (elements.length === 0) return;

    // 1 único observer que observa todos os elementos
    const observer = new IntersectionObserver(
      (entries) => {
        // Pega a seção mais visível (última intersecting com maior ratio)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75], // múltiplos thresholds para melhor granularidade
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // ── Smooth scroll on nav click ───────────────────────────────────────────
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const id = href.replace('#', '');

      trackLandingClick({
        eventName: `nav_${id}`,
        category: 'nav_click',
        label: href,
      });

      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      setIsOpen(false);
    },
    [],
  );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06] py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 flex items-center justify-between gap-6 md:gap-8 lg:gap-10">
        {/* ── Brand Logo ─────────────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg shrink-0"
        >
          <ZellaLogo size={42} />
        </Link>

        {/* ── Desktop Navigation ─────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const sectionId = link.href.replace('#', '');
            const isActive = activeSection === sectionId;

            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] rounded-[8px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${accent.ring} focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  isActive
                    ? `${accent.text}`
                    : 'text-white/60 hover:text-white/90'
                }${link.lgOnly ? ' hidden lg:inline-flex' : ''}`}
              >
                {/* Active dot indicator */}
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    className={`w-1 h-1 rounded-full ${accent.dot}`}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {link.name}
                {/* Bottom underline indicator */}
                {isActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className={`absolute -bottom-0.5 left-3 right-3 h-[1.5px] rounded-full ${accent.dot} opacity-60`}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── CTA Button ─────────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center">
          <Link
            href="#precos"
            onClick={(e) => handleNavClick(e, '#precos')}
            className={`group relative inline-flex items-center justify-center px-5 py-2 text-[13px] font-semibold text-white ${accent.bg} ${accent.hoverBg} rounded-[8px] shadow-lg ${accent.shadow} transition-all hover:scale-[1.02] active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 ${accent.ring} focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
          >
            <span>Criar meu Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* ── Mobile Hamburger ───────────────────────────────────────────── */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`md:hidden p-2 text-white/80 hover:text-white hover:bg-white/5 rounded-[8px] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${accent.ring} focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Mobile Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 top-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="md:hidden fixed top-[60px] left-4 right-4 z-50 rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden shadow-2xl shadow-black/50"
            >
              <div className="px-5 py-4 flex flex-col gap-1">
                {NAV_LINKS.map((link) => {
                  const sectionId = link.href.replace('#', '');
                  const isActive = activeSection === sectionId;

                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150 ${
                        isActive
                          ? `${accent.text} bg-white/[0.04]`
                          : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Active indicator dot */}
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 ${
                          isActive ? accent.dot : 'bg-white/20'
                        }`}
                      />
                      {link.name}
                    </Link>
                  );
                })}

                {/* Separator */}
                <div className="h-px bg-white/[0.06] my-2 mx-2" />

                {/* CTA */}
                <Link
                  href="#precos"
                  onClick={(e) => handleNavClick(e, '#precos')}
                  className={`w-full text-center text-[14px] font-semibold text-white ${accent.bg} ${accent.hoverBg} py-3 rounded-xl shadow-lg ${accent.shadow} transition-all active:scale-[0.98]`}
                >
                  Criar meu Dashboard
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

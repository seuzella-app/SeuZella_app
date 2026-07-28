'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Instagram, Youtube, Linkedin, Mail, Phone } from 'lucide-react';
import { ZellaLogoStatic } from '@/components/brand/ZellaLogo';
import { useNiche } from '@/contexts/NicheContext';

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const { isPousada, isAirbnb } = useNiche();

  const navigationLinks = [
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Recursos', href: '#funcionalidades' },
    { label: 'Integrações', href: '#integracoes' },
    { label: 'Calculadora', href: '#calculadora' },
    { label: 'Planos', href: '#precos' },
    { label: 'Dúvidas Frequentes', href: '#faq' },
    { label: 'Contato', href: '#contato' },
  ];

  const legalLinks = [
    { label: 'Central Jurídica (Hub)', href: '/legal' },
    { label: 'Central de Privacidade', href: '/legal/privacidade-central' },
    { label: 'Termos de Uso', href: '/legal/termos-uso' },
    { label: 'Política de Privacidade', href: '/legal/politica-privacidade' },
    { label: 'Política de Cobrança', href: '/legal/politica-cobranca' },
    { label: 'Contrato SaaS', href: '/legal/contrato-saas' },
  ];

  const socialLinks = [
    { icon: Instagram, label: 'Instagram', href: 'https://instagram.com/seuzella', color: 'hover:text-pink-400' },
    { icon: Youtube, label: 'YouTube', href: 'https://youtube.com/@seuzella', color: 'hover:text-red-400' },
    { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com/company/seuzella', color: 'hover:text-blue-400' },
    { icon: Mail, label: 'E-mail', href: 'mailto:contato@zehla.com.br', color: 'hover:text-amber-400' },
  ];

  return (
    <footer ref={ref} className="border-t border-white/[0.04] bg-[#080808] pt-20 pb-10 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto"
      >
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <ZellaLogoStatic />
          </div>
            
            <p className="text-neutral-500 text-xs leading-relaxed max-w-sm">
              Plataforma inteligente de automação de reservas e atendimento 24/7 do Seu Zélla, {isPousada ? 'feita especificamente para pousadas e hotéis boutique brasileiros' : 'feita especificamente para anfitriões Airbnb e gestores de imóveis'}. Converta mais hóspedes e impulsione seu negócio sem complicação.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4 pt-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className={`w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-neutral-500 ${social.color} hover:bg-white/[0.06] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-3 pt-2">
              <a href="mailto:contato@zehla.com.br" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 text-xs transition-colors">
                <Mail className="w-3.5 h-3.5" />
                contato@zehla.com.br
              </a>
              <a href="https://wa.me/5548999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-500 hover:text-emerald-400 text-xs transition-colors">
                <Phone className="w-3.5 h-3.5" />
                WhatsApp Comercial
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-5">
              Produto
            </h3>
            <ul className="space-y-3">
              {navigationLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-neutral-500 hover:text-emerald-400 text-xs transition-colors duration-200 block py-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-5">
              Jurídico
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-neutral-500 hover:text-emerald-400 text-xs transition-colors duration-200 block py-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust Column */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-5">
              Confiança
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Ativação em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Sem fidelidade — cancele quando quiser</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>7 dias grátis sem cartão</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Suporte PT-BR via WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Dados criptografados (LGPD)</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>SLA 99.9% no plano MAX</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.04] pt-8 mt-12" />

        {/* Footer Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-neutral-600 text-[11px]">
            &copy; {new Date().getFullYear()} Seu Zélla. Todos os direitos reservados. CNPJ: XX.XXX.XXX/0001-XX
          </span>
          <div className="flex items-center gap-4 text-neutral-600 text-[11px]">
            <div className="flex items-center gap-1">
              <span>Pagamentos via</span>
              <span className="text-neutral-400 font-semibold">Mercado Pago</span>
            </div>
            <span className="text-neutral-800">|</span>
            <span>Feito com orgulho no Brasil</span>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}

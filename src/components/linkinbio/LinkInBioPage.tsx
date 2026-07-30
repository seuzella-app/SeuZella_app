'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { LinkInBioProfile } from '@/types/linkinbio';
import { getDaysUntilExpiry } from '@/types/linkinbio';
import { ShieldCheck, Star, ExternalLink, MessageCircle, Bot } from 'lucide-react';

function buildWhatsAppUrl(number?: string, message?: string): string {
  if (!number) return '#';
  const clean = number.replace(/\D/g, '');
  const base = `https://wa.me/${clean}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}

export function LinkInBioPage({ profile, isPreview = false }: { profile: LinkInBioProfile; isPreview?: boolean }) {
  const daysLeft = getDaysUntilExpiry(profile.planExpiresAt);
  const activeLinks = profile.links
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order);

  const accentColor = profile.accentColor || '#10b981';
  const whatsappUrl = buildWhatsAppUrl(profile.whatsappNumber);
  const whatsappNumber = profile.whatsappNumber;

  // Whether this is an empty/fresh profile
  const isEmpty = !profile.propertyName && activeLinks.length === 0;

  return (
    <div className={`flex items-center justify-center bg-black text-white relative overflow-hidden ${isPreview ? 'h-full' : 'min-h-screen'}`}>
      {/* Background Image at 12% opacity (suave e discreto) */}
      {profile.backgroundImageUrl && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-300"
          style={{
            backgroundImage: `url(${profile.backgroundImageUrl})`,
            opacity: 0.12,
            filter: 'blur(1px)',
          }}
        />
      )}

      {/* Dark overlay gradient */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.97) 100%)',
        }}
      />

      {/* Content Container com Respiro e Margens Seguras (Mobile Safe Area) */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6 py-8 flex flex-col items-center min-h-screen justify-between">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col items-center"
        >
          {/* Avatar com Anel Gradiente e Sombra Sutil */}
          <div
            className="w-24 h-24 rounded-full p-[3px] mb-4 shadow-2xl transition-transform duration-300 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}66)`,
            }}
          >
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.propertyName || 'Avatar'}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span className="text-3xl font-bold" style={{ color: accentColor }}>
                  {profile.propertyName ? profile.propertyName.charAt(0).toUpperCase() : 'P'}
                </span>
              )}
            </div>
          </div>

          {/* Property Name */}
          <h1 className="text-xl font-extrabold text-white text-center tracking-tight px-2">
            {profile.propertyName || 'Nome da Pousada'}
          </h1>

          {/* Subtitle */}
          <p className="text-zinc-400 text-xs mt-1.5 text-center max-w-xs leading-relaxed px-3">
            {profile.subtitle || 'Sua descrição aqui'}
          </p>

          {/* Rating Badge */}
          {profile.rating && profile.rating > 0 && (
            <div className="flex items-center gap-1.5 mt-3 px-3.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] shadow-sm backdrop-blur-sm">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-amber-400 text-xs font-bold">{profile.rating}</span>
              <span className="text-zinc-500 text-xs">| {profile.reviewCount || 0} avaliações</span>
            </div>
          )}

          {/* BETA PARTNER SEAL */}
          {profile.isBetaPartner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-4 flex flex-col items-center"
            >
              <div className="relative px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80">
                    Selo de Parceiro Especial
                  </div>
                  <div className="text-[11px] font-extrabold text-amber-300">
                    seuzella.com
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Links list com espaçamento perfeito (Respiro UX) */}
          <div className="w-full mt-6 space-y-3 px-1">
            {activeLinks.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-xs border border-dashed border-white/10 rounded-2xl p-4">
                Nenhum link ativo adicionado
              </div>
            ) : (
              activeLinks.map((link, i) => {
                const isWa = link.url.includes('wa.me') || link.url.includes('whatsapp');
                const href = isWa && whatsappNumber ? whatsappUrl : link.url;

                return (
                  <motion.a
                    key={link.id}
                    href={isPreview ? undefined : href}
                    target={!isPreview ? '_blank' : undefined}
                    rel={!isPreview ? 'noopener noreferrer' : undefined}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i, duration: 0.3 }}
                    className={`w-full py-3.5 px-5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                      link.isHighlight
                        ? 'text-white shadow-lg font-bold'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-100 hover:border-white/20'
                    }`}
                    style={
                      link.isHighlight
                        ? {
                            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                            boxShadow: `0 8px 24px ${accentColor}33`,
                          }
                        : undefined
                    }
                  >
                    <span className="text-base">{link.icon || '🔗'}</span>
                    <span className="flex-1 text-center px-2">{link.label || 'Link'}</span>
                    {link.isHighlight && <MessageCircle className="w-4 h-4" />}
                    {!link.isHighlight && <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />}
                  </motion.a>
                );
              })
            )}
          </div>

          {/* Atendimento Indicator */}
          {(profile.plan === 'lite' || profile.plan === 'pro' || profile.plan === 'max' || profile.plan === 'parceiro') && (
            <div className="w-full mt-5 flex items-center justify-center gap-2 text-[11px] text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-full py-1.5 px-4 backdrop-blur-sm">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span><span className="text-emerald-400 font-semibold">Seu Zélla nos Atendimentos</span></span>
            </div>
          )}

          {/* Instagram handle */}
          {profile.instagramHandle && (
            <div className="mt-6 text-center">
              <span className="text-zinc-500 text-xs">@{profile.instagramHandle}</span>
            </div>
          )}
        </motion.div>

        {/* FOOTER — Logo + "O zelador da sua pousada" */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-auto pt-8 pb-4 text-center flex flex-col items-center gap-2"
        >
          <Image
            src="/logo-zella-b01.png"
            alt="Zélla"
            width={80}
            height={11}
            className="opacity-60 hover:opacity-90 transition-opacity"
            priority={false}
          />
          <p className="text-zinc-600 text-[11px]">
            O zelador da sua pousada{' '}
            <Link
              href="/"
              className="text-emerald-500/70 hover:text-emerald-400 transition-colors font-semibold underline underline-offset-2"
            >
              seuzella.com
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
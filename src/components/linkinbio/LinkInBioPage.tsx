import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { LinkInBioProfile, LinkInBioReview } from '@/types/linkinbio';
import { getDaysUntilExpiry } from '@/types/linkinbio';
import { ShieldCheck, Star, ExternalLink, MessageCircle, Bot, X, Send, ChevronRight, MessageSquareHeart } from 'lucide-react';

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

  // Interactive reviews state
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [reviewsList, setReviewsList] = useState<LinkInBioReview[]>(() => profile.reviews || [
    {
      id: 'rev-1',
      authorName: 'Mariana & Lucas',
      rating: 5,
      comment: 'Atendimento impecável! O Seu Zélla respondeu super rápido de madrugada e tirou todas as dúvidas. Voltaremos com certeza!',
      createdAt: 'Há 2 dias',
    },
    {
      id: 'rev-2',
      authorName: 'Carlos Eduardo',
      rating: 5,
      comment: 'Lugar maravilhoso, fotos e instruções super organizadas no WhatsApp.',
      createdAt: 'Há 1 semana',
    },
  ]);

  const [newReview, setNewReview] = useState({
    authorName: '',
    rating: 5,
    comment: '',
  });
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Compute live average rating and count
  const showReviews = profile.showReviews !== false;
  const reviewCount = reviewsList.length;
  const calculatedRating = reviewCount > 0
    ? Number((reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1))
    : profile.rating || 5.0;

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.authorName.trim() || !newReview.comment.trim()) return;

    const created: LinkInBioReview = {
      id: `rev-${Date.now()}`,
      authorName: newReview.authorName.trim(),
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      createdAt: 'Agora mesmo',
    };

    setReviewsList((prev) => [created, ...prev]);
    setNewReview({ authorName: '', rating: 5, comment: '' });
    setSubmittedSuccess(true);
    setTimeout(() => setSubmittedSuccess(false), 3000);
  };

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

          {/* Rating Badge Clicável se Ativo */}
          {showReviews && (
            <button
              type="button"
              onClick={() => setIsReviewsModalOpen(true)}
              className="group flex items-center gap-1.5 mt-3 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] hover:border-amber-400/50 shadow-sm backdrop-blur-sm transition-all duration-200 cursor-pointer active:scale-95"
              title="Clique para ler ou deixar uma avaliação"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-amber-400 text-xs font-bold">{calculatedRating > 0 ? calculatedRating.toFixed(1) : '5.0'}</span>
              <span className="text-zinc-400 text-xs">| {reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'}</span>
              <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors ml-0.5" />
            </button>
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

      {/* ── MODAL INTERATIVO DE AVALIAÇÕES ── */}
      <AnimatePresence>
        {isReviewsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col relative"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Avaliações de Hóspedes
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="text-amber-400 font-bold text-sm">{calculatedRating.toFixed(1)} ★</span>
                      <span>• {reviewCount} {reviewCount === 1 ? 'opinião' : 'opiniões cadastradas'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReviewsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body: Form + List */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">

                {/* Success Alert */}
                {submittedSuccess && (
                  <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <MessageSquareHeart className="w-4 h-4 shrink-0" />
                    Muito obrigado! Sua avaliação foi cadastrada com sucesso!
                  </div>
                )}

                {/* Form: Deixar Nova Avaliação */}
                <form onSubmit={handleAddReview} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3.5">
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    Deixar sua Avaliação ou Comentário
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Seu Nome / Casal</label>
                      <input
                        type="text"
                        required
                        value={newReview.authorName}
                        onChange={(e) => setNewReview({ ...newReview, authorName: e.target.value })}
                        placeholder="Ex: Fernanda S."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Sua Nota (1 a 5 Estrelas)</label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewReview({ ...newReview, rating: star })}
                            className="p-1 hover:scale-125 transition-transform"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= newReview.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="text-xs font-bold text-amber-400 ml-2">{newReview.rating} de 5</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Sua Mensagem ou Depoimento</label>
                      <textarea
                        required
                        rows={3}
                        value={newReview.comment}
                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                        placeholder="Conte como foi sua experiência, o atendimento e o que achou..."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>

                    <button
                      type="submit"
                      style={{ backgroundColor: accentColor }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar Avaliação
                    </button>
                  </div>
                </form>

                {/* List of Reviews */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Depoimentos dos Hóspedes ({reviewsList.length})
                  </h4>

                  {reviewsList.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-xs border border-dashed border-white/10 rounded-2xl">
                      Nenhuma avaliação enviada ainda. Seja o primeiro!
                    </div>
                  ) : (
                    reviewsList.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{rev.authorName}</span>
                          <span className="text-[10px] text-zinc-500">{rev.createdAt}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed pt-0.5">
                          "{rev.comment}"
                        </p>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
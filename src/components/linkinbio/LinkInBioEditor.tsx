'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkInBioPage } from './LinkInBioPage';
import type { LinkInBioProfile, LinkInBioLink } from '@/types/linkinbio';
import {
  Plus, Trash2, GripVertical, Copy, Check, Eye, Pencil,
  MessageCircle, Star, Instagram, Palette, Link2, ChevronDown, ChevronUp,
  Smartphone, ExternalLink, X, Save, Sparkles,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function formatPhoneDisplay(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
}

const ACCENT_PRESETS = [
  { label: 'Esmeralda', color: '#10b981' },
  { label: 'Azul Oceano', color: '#0ea5e9' },
  { label: 'Roxo Místico', color: '#a855f7' },
  { label: 'Rosa Pousada', color: '#ec4899' },
  { label: 'Laranja Sol', color: '#f97316' },
  { label: 'Vermelho Paixão', color: '#ef4444' },
  { label: 'Dourado Premium', color: '#eab308' },
  { label: 'Branco Clean', color: '#e4e4e7' },
];

const LINK_ICONS = ['🏡', '📸', '⭐', '📍', '💬', '📞', '💳', '📅', '🌐', '🍔', '🏊', '🌅', '🎫', '🎁', '📖', '📞', '❤️', '🎵'];

// ── Empty Profile ──────────────────────────────────────────────────────────────

const EMPTY_LINK: Omit<LinkInBioLink, 'id'> = {
  label: '',
  url: '',
  icon: '🔗',
  isHighlight: false,
  order: 0,
  isActive: true,
};

function createEmptyProfile(defaultName: string = '', defaultNiche: string = 'pousada'): LinkInBioProfile {
  const isAirbnb = defaultNiche === 'airbnb';
  const name = defaultName || (isAirbnb ? 'Apartamento Copacabana' : 'Pousada Serenity Paraty');
  const slug = generateSlug(name);
  return {
    id: 'profile-ddc',
    slug: slug,
    propertyName: name,
    subtitle: isAirbnb ? 'Hospedagem de Alto Padrão no Rio de Janeiro' : 'Sua pousada no centro histórico com vista para o mar',
    avatarUrl: isAirbnb ? '/pousada-vista.jpg' : '/avatar-serenity.jpg',
    backgroundImageUrl: '/pousada-chale.jpg',
    accentColor: isAirbnb ? '#3b82f6' : '#10b981',
    rating: 4.9,
    reviewCount: 148,
    whatsappNumber: '5511999998888',
    instagramHandle: isAirbnb ? '@flat.copacabana' : '@pousada.serenity',
    links: [
      { id: '1', label: 'Reservar Direto pelo WhatsApp (0% Taxas)', url: 'https://wa.me/5511999998888', icon: '💬', isHighlight: true, order: 0, isActive: true },
      { id: '2', label: 'Guia Digital & Regras do Imóvel', url: '#guia', icon: '📖', isHighlight: false, order: 1, isActive: true },
      { id: '3', label: 'Fotos & Comodidades no Instagram', url: 'https://instagram.com', icon: '📸', isHighlight: false, order: 2, isActive: true },
      { id: '4', label: 'Chave PIX & Pagamento Direto', url: '#pix', icon: '💳', isHighlight: false, order: 3, isActive: true },
    ],
    isActive: true,
    plan: 'pro',
    isBetaPartner: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface LinkInBioEditorProps {
  initialPropertyName?: string;
  niche?: 'pousada' | 'airbnb';
  initialProfile?: Partial<LinkInBioProfile>;
}

// ── Main Editor Component ─────────────────────────────────────────────────────

export function LinkInBioEditor({ initialPropertyName, niche = 'pousada', initialProfile }: LinkInBioEditorProps = {}) {
  const [profile, setProfile] = useState<LinkInBioProfile>(() => ({
    ...createEmptyProfile(initialPropertyName, niche),
    ...initialProfile,
  }));
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null);

  // ── Derived state ──

  const liveProfile: LinkInBioProfile = useMemo(() => ({
    ...profile,
    slug: profile.slug || generateSlug(profile.propertyName) || 'sua-pousada',
  }), [profile]);

  const publicLink = useMemo(() => {
    const slug = profile.slug || generateSlug(profile.propertyName) || 'sua-pousada';
    return `seuzella.com/${slug}`;
  }, [profile.slug, profile.propertyName]);

  // ── Handlers ──

  const updateField = useCallback(<K extends keyof LinkInBioProfile>(key: K, value: LinkInBioProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value, updatedAt: new Date() }));
  }, []);

  const updateLink = useCallback((linkId: string, field: keyof LinkInBioLink, value: any) => {
    setProfile((prev) => ({
      ...prev,
      links: prev.links.map((l) => (l.id === linkId ? { ...l, [field]: value } : l)),
      updatedAt: new Date(),
    }));
  }, []);

  const addLink = useCallback(() => {
    const newLink: LinkInBioLink = {
      ...EMPTY_LINK,
      id: `link-${Date.now()}`,
      order: profile.links.length,
    };
    setProfile((prev) => ({
      ...prev,
      links: [...prev.links, newLink],
      updatedAt: new Date(),
    }));
    setEditingLinkId(newLink.id);
  }, [profile.links.length]);

  const removeLink = useCallback((linkId: string) => {
    setProfile((prev) => ({
      ...prev,
      links: prev.links
        .filter((l) => l.id !== linkId)
        .map((l, i) => ({ ...l, order: i })),
      updatedAt: new Date(),
    }));
    if (editingLinkId === linkId) setEditingLinkId(null);
  }, [editingLinkId]);

  const moveLink = useCallback((linkId: string, direction: 'up' | 'down') => {
    setProfile((prev) => {
      const links = [...prev.links].sort((a, b) => a.order - b.order);
      const idx = links.findIndex((l) => l.id === linkId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= links.length) return prev;
      const temp = links[idx].order;
      links[idx] = { ...links[idx], order: links[swapIdx].order };
      links[swapIdx] = { ...links[swapIdx], order: temp };
      return { ...prev, links, updatedAt: new Date() };
    });
  }, []);

  const copyPublicLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = `https://${publicLink}`;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicLink]);

  const handleSave = useCallback(() => {
    // In production, this would POST to /api/ddc/linkinbio
    // For the standalone demo, we save to localStorage
    try {
      localStorage.setItem('zella-lib-profile', JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
  }, [profile]);

  // ── Render ──

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-zella-b01.png" alt="Zélla" className="h-5 opacity-80" />
            <span className="text-sm font-bold text-zinc-300 hidden sm:inline">Link-in-Bio Profissional</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Public Link Display */}
            <div className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-zinc-400 font-mono">{publicLink}</span>
              <button
                onClick={copyPublicLink}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Copiar link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Mobile copy */}
            <button
              onClick={copyPublicLink}
              className="sm:hidden flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 text-emerald-400 text-xs font-bold"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>

            {/* Toggle preview */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                showPreview
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                saved
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-white text-zinc-950 hover:bg-zinc-200'
              }`}
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{saved ? 'Salvo!' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main layout: Editor + Preview side-by-side on desktop */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">

          {/* ── LEFT: EDITOR PANEL ── */}
          <div className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto ${showPreview ? 'hidden lg:block' : ''}`}>
            <div className="max-w-xl mx-auto space-y-6">

              {/* Section: Informações Básicas */}
              <section>
                <h2 className="text-base font-extrabold text-zinc-200 mb-4 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-emerald-400" />
                  Informações Básicas
                </h2>

                <div className="space-y-4">
                  {/* Nome da Pousada */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Nome da Pousada *
                    </label>
                    <input
                      type="text"
                      value={profile.propertyName}
                      onChange={(e) => updateField('propertyName', e.target.value)}
                      placeholder="Ex: Pousada Serenity"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                  </div>

                  {/* Slug + Copy */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Seu link personalizado
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500 shrink-0">seuzella.com/</span>
                      <input
                        type="text"
                        value={profile.slug}
                        onChange={(e) => updateField('slug', generateSlug(e.target.value))}
                        placeholder="nome-da-pousada"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      />
                      {!profile.slug && profile.propertyName && (
                        <button
                          onClick={() => updateField('slug', generateSlug(profile.propertyName))}
                          className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                          title="Usar nome gerado"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      {profile.slug
                        ? `Seu link: https://${publicLink}`
                        : 'Preencha o nome da pousada para gerar automaticamente'}
                    </p>
                  </div>

                  {/* Subtítulo */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Subtítulo
                    </label>
                    <input
                      type="text"
                      value={profile.subtitle}
                      onChange={(e) => updateField('subtitle', e.target.value)}
                      placeholder="Ex: Seu refúgio paradisíaco em Paraty, RJ"
                      maxLength={80}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                    <p className="text-[11px] text-zinc-600 mt-1 text-right">{profile.subtitle.length}/80</p>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Section: Contato */}
              <section>
                <h2 className="text-base font-extrabold text-zinc-200 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Contato
                </h2>

                <div className="space-y-4">
                  {/* WhatsApp */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      <MessageCircle className="w-3 h-3 inline mr-1" />
                      Número do WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={profile.whatsappNumber || ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        updateField('whatsappNumber', raw);
                      }}
                      placeholder="5524999999999"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                    {profile.whatsappNumber && (
                      <p className="text-[11px] text-emerald-500/70 mt-1">
                        wa.me/{profile.whatsappNumber} — {formatPhoneDisplay(profile.whatsappNumber)}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Com DDD + número. Ex: 5524999999999
                    </p>
                  </div>

                  {/* Instagram */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      <Instagram className="w-3 h-3 inline mr-1" />
                      @ do Instagram
                    </label>
                    <div className="flex items-center">
                      <span className="text-sm text-zinc-500">@</span>
                      <input
                        type="text"
                        value={profile.instagramHandle || ''}
                        onChange={(e) => updateField('instagramHandle', e.target.value.replace('@', '').replace(/\s/g, ''))}
                        placeholder="pousadaserenity"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all ml-1"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Section: Aparência & Fotos */}
              <section>
                <h2 className="text-base font-extrabold text-zinc-200 mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  Aparência & Fotos
                </h2>

                <div className="space-y-5">
                  {/* Foto de Perfil / Avatar */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Foto de Perfil (Avatar da Pousada)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0">
                        {profile.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-bold">Sem Foto</div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={profile.avatarUrl || ''}
                        onChange={(e) => updateField('avatarUrl', e.target.value)}
                        placeholder="URL da foto (ex: https://... ou /avatar-serenity.jpg)"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                      />
                    </div>
                    {/* Presets rápidos de Avatar */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-zinc-500">Opções rápidas:</span>
                      {[
                        { label: 'Serenity', url: '/avatar-serenity.jpg' },
                        { label: 'Vista Mar', url: '/pousada-vista.jpg' },
                        { label: 'Chalé', url: '/pousada-chale.jpg' },
                      ].map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => updateField('avatarUrl', preset.url)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:border-emerald-500/40 transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Foto de Fundo / Background */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Foto de Fundo (Background Suave)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 rounded-lg bg-zinc-800 border border-white/10 overflow-hidden shrink-0">
                        {profile.backgroundImageUrl ? (
                          <img src={profile.backgroundImageUrl} alt="Background" className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[10px]">Padrão</div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={profile.backgroundImageUrl || ''}
                        onChange={(e) => updateField('backgroundImageUrl', e.target.value)}
                        placeholder="URL da imagem de fundo"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                      />
                    </div>
                    {/* Presets rápidos de Background */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-zinc-500">Opções rápidas:</span>
                      {[
                        { label: 'Chalé Paraty', url: '/pousada-chale.jpg' },
                        { label: 'Vista Suíte', url: '/pousada-vista.jpg' },
                        { label: 'Piscina', url: '/pousada-piscina.jpg' },
                      ].map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => updateField('backgroundImageUrl', preset.url)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:border-emerald-500/40 transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cor de destaque */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Cor de destaque dos botões
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => updateField('accentColor', preset.color)}
                          title={preset.label}
                          className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                            profile.accentColor === preset.color
                              ? 'border-white scale-110 shadow-lg'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: preset.color }}
                        />
                      ))}
                      <label className="w-8 h-8 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors relative overflow-hidden">
                        <span className="text-[10px] text-zinc-500">+</span>
                        <input
                          type="color"
                          value={profile.accentColor}
                          onChange={(e) => updateField('accentColor', e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Avaliação */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      <Star className="w-3 h-3 inline mr-1 text-amber-400" />
                      Avaliação (Google/Booking)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={profile.rating || ''}
                        onChange={(e) => updateField('rating', parseFloat(e.target.value) || 0)}
                        placeholder="4.9"
                        className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                      />
                      <input
                        type="number"
                        min="0"
                        value={profile.reviewCount || ''}
                        onChange={(e) => updateField('reviewCount', parseInt(e.target.value) || 0)}
                        placeholder="128"
                        className="w-24 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                      />
                      <span className="text-xs text-zinc-500">avaliações ativas</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Section: Links */}
              <section>
                <h2 className="text-base font-extrabold text-zinc-200 mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  Seus Links
                </h2>

                {/* Link list */}
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {profile.links
                      .sort((a, b) => a.order - b.order)
                      .map((link, idx) => (
                        <motion.div
                          key={link.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
                        >
                          {/* Collapsed view */}
                          {editingLinkId !== link.id && (
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <GripVertical className="w-4 h-4 text-zinc-700 shrink-0" />

                              <button onClick={() => moveLink(link.id, 'up')} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => moveLink(link.id, 'down')} disabled={idx === profile.links.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>

                              <span className="text-base">{link.icon || '🔗'}</span>
                              <span className={`flex-1 text-sm truncate ${link.isHighlight ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}>
                                {link.label || 'Link sem nome'}
                              </span>

                              {link.isHighlight && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  Destaque
                                </span>
                              )}

                              <button onClick={() => setEditingLinkId(link.id)} className="text-zinc-500 hover:text-white transition-colors p-1">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeLink(link.id)} className="text-zinc-500 hover:text-red-400 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Expanded editing view */}
                          {editingLinkId === link.id && (
                            <div className="p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-400">Editando Link</span>
                                <button onClick={() => setEditingLinkId(null)} className="text-zinc-500 hover:text-white transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Icon picker */}
                              <div>
                                <label className="block text-[11px] text-zinc-500 mb-1">Ícone</label>
                                <div className="flex flex-wrap gap-1.5 relative">
                                  <button
                                    onClick={() => setShowIconPicker(showIconPicker === link.id ? null : link.id)}
                                    className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg hover:bg-white/[0.1] transition-colors"
                                  >
                                    {link.icon || '🔗'}
                                  </button>
                                  {showIconPicker === link.id && (
                                    <div className="absolute z-20 top-10 left-0 bg-zinc-900 border border-white/10 rounded-xl p-2 grid grid-cols-6 gap-1 shadow-2xl">
                                      {LINK_ICONS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => {
                                            updateLink(link.id, 'icon', emoji);
                                            setShowIconPicker(null);
                                          }}
                                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base transition-colors"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Label */}
                              <div>
                                <label className="block text-[11px] text-zinc-500 mb-1">Texto do botão</label>
                                <input
                                  type="text"
                                  value={link.label}
                                  onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                                  placeholder="Ex: Reservar Agora"
                                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                              </div>

                              {/* URL */}
                              <div>
                                <label className="block text-[11px] text-zinc-500 mb-1">URL de destino</label>
                                <input
                                  type="url"
                                  value={link.url}
                                  onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                                  placeholder="https://wa.me/5524999999999?text=Olá"
                                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                              </div>

                              {/* Toggle highlight + WhatsApp auto-fill */}
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => updateLink(link.id, 'isHighlight', !link.isHighlight)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    link.isHighlight
                                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                      : 'bg-white/[0.04] border border-white/[0.08] text-zinc-500'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Botão de destaque
                                </button>

                                {profile.whatsappNumber && (
                                  <button
                                    onClick={() => {
                                      const msg = encodeURIComponent('Olá! Gostaria de fazer uma reserva.');
                                      updateLink(link.id, 'url', `https://wa.me/${profile.whatsappNumber}?text=${msg}`);
                                    }}
                                    className="flex items-center gap-1 text-[11px] text-emerald-500/60 hover:text-emerald-400 transition-colors"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    Auto-preencher WhatsApp
                                  </button>
                                )}
                              </div>

                              {/* Done editing */}
                              <button
                                onClick={() => setEditingLinkId(null)}
                                className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 transition-all"
                              >
                                Concluir edição
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>

                {/* Add link button */}
                <button
                  onClick={addLink}
                  className="mt-3 w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-zinc-500 text-sm font-bold hover:border-emerald-500/30 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Link
                </button>

                {/* Quick-start templates */}
                {profile.links.length === 0 && (
                  <div className="mt-4 p-4 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl">
                    <p className="text-xs font-bold text-zinc-400 mb-2">Templates rápidos</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Reservar', icon: '🏡', highlight: true },
                        { label: 'Fotos', icon: '📸', highlight: false },
                        { label: 'Avaliações', icon: '⭐', highlight: false },
                        { label: 'Localização', icon: '📍', highlight: false },
                        { label: 'WhatsApp', icon: '💬', highlight: false },
                      ].map((tpl) => (
                        <button
                          key={tpl.label}
                          onClick={() => {
                            const newLink: LinkInBioLink = {
                              id: `link-${Date.now()}-${tpl.label}`,
                              label: tpl.label,
                              url: tpl.label === 'WhatsApp' && profile.whatsappNumber
                                ? `https://wa.me/${profile.whatsappNumber}`
                                : '#',
                              icon: tpl.icon,
                              isHighlight: tpl.highlight,
                              order: profile.links.length,
                              isActive: true,
                            };
                            setProfile((prev) => ({
                              ...prev,
                              links: [...prev.links, newLink],
                              updatedAt: new Date(),
                            }));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                        >
                          <span>{tpl.icon}</span>
                          {tpl.label}
                          {tpl.highlight && <Sparkles className="w-3 h-3 text-emerald-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Section: Como usar */}
              <section className="pb-8">
                <h2 className="text-base font-extrabold text-zinc-200 mb-4 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Como usar
                </h2>
                <div className="space-y-3 text-sm text-zinc-500">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">1</span>
                    <p>Preencha as informações da sua pousada e adicione seus links.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">2</span>
                    <p>Clique em <strong className="text-zinc-300">Salvar</strong> e depois <strong className="text-zinc-300">Copiar Link</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">3</span>
                    <p>Cole o link no perfil do Instagram da sua pousada. Pronto! 🎉</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">4</span>
                    <p className="text-zinc-300 font-semibold">Mande para seus contatos, divulgue seu link!</p>
                  </div>
                </div>

                {/* Public link copy (mobile) */}
                <div className="mt-6 sm:hidden p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <p className="text-xs text-zinc-500 mb-2">Seu link público:</p>
                  <button
                    onClick={copyPublicLink}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors active:scale-[0.98]"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Link Copiado!' : `Copiar ${publicLink}`}
                  </button>
                </div>
              </section>

            </div>
          </div>

          {/* ── RIGHT: LIVE PREVIEW (Desktop always, Mobile toggle) ── */}
          <div className={`lg:w-[420px] lg:shrink-0 lg:border-l border-white/[0.06] bg-black ${!showPreview ? 'hidden lg:block' : 'block'}`}>
            <div className="lg:sticky lg:top-14">
              {/* Preview header */}
              <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Preview ao Vivo</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-zinc-600">Atualizando</span>
                </div>
              </div>

              {/* Phone frame on desktop (com safe-area e respiro refinado) */}
              <div className="lg:py-6 lg:px-6 flex justify-center">
                <div className="w-full max-w-[380px] rounded-[3rem] border-[8px] border-zinc-800 bg-black overflow-hidden shadow-2xl shadow-emerald-950/20 p-1">
                  <LinkInBioPage profile={liveProfile} isPreview={true} />
                </div>
              </div>

              {/* Mobile: close preview button */}
              {showPreview && (
                <div className="lg:hidden sticky bottom-0 p-4 bg-zinc-950/90 backdrop-blur-md border-t border-white/10">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="w-full py-3 bg-white text-zinc-950 rounded-xl text-sm font-bold"
                  >
                    <Pencil className="w-4 h-4 inline mr-2" />
                    Voltar para Editar
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Globe icon (inline to avoid import issues)
function Globe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, MapPin, MessageSquare, ChevronRight } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

// ── Types 
type DemoPhase =
  | 'instagram' // Instagram profile with pulsing link
  | 'linkinbio' // LIB page, no button highlighted yet
  | 'reservar' // Button 1 highlighted + reservation preview
  | 'galeria' // Button 2 highlighted + gallery preview
  | 'avaliacoes' // Button 3 highlighted + reviews preview
  | 'mapa' // Button 4 highlighted + map preview
  | 'whatsapp'; // Button 5 → full WhatsApp conversation

// ── Niche-specific profile data 
interface ProfileData {
  igHandle: string;
  profileName: string;
  profileLabel: string; // "Pousada" | "Airbnb" | "Parceiro Zélla"
  bioLine1: string;
  bioLine2: string;
  bioLine3: string;
  linkUrl: string;
  libSubtitle: string;
  libLocation: string;
  libMapLabel: string;
  libMapAddress: string;
  roomLabel: string; // "Chalé Vista Mar" | "Apartamento Vista Mar" etc.
  roomDetails: string; // "Cama king · Varanda · Hidromassagem"
  roomPrice: string; // "R$ 490"
  roomPriceTotal: string; // "R$ 980"
  roomPriceBreakdown: string; // "R$ 490/noite × 2 noites"
  highlights: { icon: string; label: string }[];
  galleryPhotos: { src: string; label: string }[];
  chatMessages: ChatMsg[];
  showPartnerBadge: boolean;
}

interface ChatMsg {
  from: 'guest' | 'zella';
  text: string;
  pix?: boolean;
  confirmation?: boolean;
  time: string;
}

const pousadaProfile: ProfileData = {
  igHandle: 'pousadaserenity',
  profileName: 'Pousada Serenity Paraty',
  profileLabel: 'Pousada',
  bioLine1: '✨ Seu refúgio paradisíaco em Paraty, RJ',
  bioLine2: '🏝️ Chalés com vista mar & piscina infinita',
  bioLine3: '👇 Garanta sua vaga direto sem taxas:',
  linkUrl: 'seuzella.com/l/pousadaserenity',
  libSubtitle: '✨ Seu refúgio em meio à natureza',
  libLocation: 'Paraty, RJ',
  libMapLabel: 'Paraty, RJ',
  libMapAddress: 'Rua das Flores, 123 — Praia do Pontal',
  roomLabel: '🏡 Chalé Vista Mar',
  roomDetails: 'Cama king · Varanda · Hidromassagem',
  roomPrice: 'R$ 490',
  roomPriceTotal: 'R$ 980',
  roomPriceBreakdown: 'R$ 490/noite × 2 noites',
  highlights: [
    { icon: '🏡', label: 'Chalés' },
    { icon: '🏊', label: 'Piscina' },
    { icon: '⭐', label: 'Reviews' },
    { icon: '🍳', label: 'Café' },
  ],
  galleryPhotos: [
    { src: '/pousada-quarto.jpg', label: 'Suíte Master' },
    { src: '/pousada-piscina.jpg', label: 'Piscina Infinita' },
    { src: '/pousada-cafe.jpg', label: 'Café da Manhã' },
    { src: '/pousada-jardim.jpg', label: 'Jardim Tropical' },
    { src: '/pousada-vista.jpg', label: 'Vista do Mar' },
    { src: '/pousada-chale.jpg', label: 'Chalé Externo' },
  ],
  chatMessages: [
    {
      from: 'guest',
      text: 'Olá! Vi o perfil de vocês no Instagram. Têm disponibilidade para o final de semana que vem? Queríamos 2 noites pra casal.',
      time: '14:22',
    },
    {
      from: 'zella',
      text: 'Olá, Bernardo! Que bom que nos encontrou pelo Instagram! 🌸 Seja bem-vindo à Pousada Serenity.\n\nSim, temos disponibilidade para o próximo final de semana (19 e 20 de julho). Nosso Chalé Vista Mar está livre — é o mais pedido pelos casais!\n\nCama king, varanda com vista pro mar e banheira de hidromassagem.\n\n💰 Valor: R$ 490/noite = R$ 980 total (2 noites) no PIX.\n\nQuer que eu segure essa vaga pra você?',
      time: '14:22',
    },
    {
      from: 'guest',
      text: 'Perfeito! Quero sim, qual o procedimento?',
      time: '14:24',
    },
    {
      from: 'zella',
      text: 'Vou gerar a reserva agora mesmo! Aqui está sua chave PIX:\n\n📅 Check-in: 19/07 (sáb)\n📅 Check-out: 21/07 (seg)\n Chalé Vista Mar — 2 hóspedes\n Valor: R$ 980,00',
      pix: true,
      time: '14:24',
    },
    {
      from: 'guest',
      text: 'Boa! Acabei de fazer o PIX de R$ 980',
      time: '14:28',
    },
    {
      from: 'zella',
      text: '✅ Pagamento confirmado! R$ 980,00 recebido.\n\n📋 Reserva #ZR-4821\n Chalé Vista Mar | 19 a 21/07\n 2 hóspedes\n\nVou te enviar as instruções de acesso na sexta! Qualquer dúvida é só chamar. Nos vemos em Paraty! ',
      confirmation: true,
      time: '14:28',
    },
  ],
  showPartnerBadge: false,
};

const anfitriaoProfile: ProfileData = {
  igHandle: 'flatcopacabana',
  profileName: 'Apartamento Copacabana',
  profileLabel: 'Airbnb',
  bioLine1: '✨ Apartamento premium em Copacabana, RJ',
  bioLine2: '🏖️ Vista mar · 2 dormitórios · Wi-Fi rápido',
  bioLine3: '👇 Reserve direto sem taxa de plataforma:',
  linkUrl: 'seuzella.com/l/flatcopacabana',
  libSubtitle: '✨ Sua estadia perfeita no Rio',
  libLocation: 'Rio de Janeiro, RJ',
  libMapLabel: 'Copacabana, RJ',
  libMapAddress: 'Av. Atlântica, 456 — Copacabana',
  roomLabel: '🏖️ Apartamento Vista Mar',
  roomDetails: '2 dormitórios · Vista mar · Wi-Fi',
  roomPrice: 'R$ 350',
  roomPriceTotal: 'R$ 700',
  roomPriceBreakdown: 'R$ 350/noite × 2 noites',
  highlights: [
    { icon: '🏖️', label: 'Praia' },
    { icon: '🏙️', label: 'Vista' },
    { icon: '⭐', label: 'Reviews' },
    { icon: '🔑', label: 'Check-in' },
  ],
  galleryPhotos: [
    { src: '/pousada-quarto.jpg', label: 'Quarto Master' },
    { src: '/pousada-piscina.jpg', label: 'Vista do Mar' },
    { src: '/pousada-cafe.jpg', label: 'Cozinha' },
    { src: '/pousada-jardim.jpg', label: 'Sala de Estar' },
    { src: '/pousada-vista.jpg', label: 'Varanda' },
    { src: '/pousada-chale.jpg', label: 'Banheiro' },
  ],
  chatMessages: [
    {
      from: 'guest',
      text: 'Olá! Vi o anúncio de vocês no Instagram. Tem disponibilidade para o final de semana que vem? Seriam 2 noites pra casal.',
      time: '14:22',
    },
    {
      from: 'zella',
      text: 'Olá, Bernardo! Que bom que nos encontrou pelo Instagram! 🌊 Seja bem-vindo ao Apartamento Copacabana.\n\nSim, temos disponibilidade para o próximo final de semana (19 e 20 de julho). O apartamento está livre!\n\n2 dormitórios, vista pro mar e Wi-Fi rápido.\n\n💰 Valor: R$ 350/noite = R$ 700 total (2 noites) no PIX.\n\nQuer que eu reserve pra você?',
      time: '14:22',
    },
    {
      from: 'guest',
      text: 'Perfeito! Quero sim, como faço?',
      time: '14:24',
    },
    {
      from: 'zella',
      text: 'Vou gerar a reserva agora mesmo! Aqui está sua chave PIX:\n\n📅 Check-in: 19/07 (sáb)\n📅 Check-out: 21/07 (seg)\n Apartamento Vista Mar — 2 hóspedes\n Valor: R$ 700,00',
      pix: true,
      time: '14:24',
    },
    {
      from: 'guest',
      text: 'Boa! Acabei de fazer o PIX de R$ 700',
      time: '14:28',
    },
    {
      from: 'zella',
      text: '✅ Pagamento confirmado! R$ 700,00 recebido.\n\n📋 Reserva #ZR-4821\n Apartamento Vista Mar | 19 a 21/07\n 2 hóspedes\n\nVou te enviar as instruções de check-in virtual na sexta! Qualquer dúvida é só chamar. Nos vemos no Rio! ',
      confirmation: true,
      time: '14:28',
    },
  ],
  showPartnerBadge: false,
};

const parceiroProfile: ProfileData = {
  igHandle: 'parceirozella',
  profileName: 'Parceiro Zélla',
  profileLabel: 'Parceiro Zélla',
  bioLine1: '✨ Programa de Parceria Zélla',
  bioLine2: '🏷️ Plano PRO congelado por 24 meses + Selo exclusivo',
  bioLine3: '👇 Confira a página do nosso parceiro:',
  linkUrl: 'seuzella.com/l/parceirozella',
  libSubtitle: '✨ Seu negócio no Zélla',
  libLocation: 'Brasil',
  libMapLabel: 'Brasil',
  libMapAddress: 'Parceiro Zélla — Programa Oficial',
  roomLabel: '🏷️ Plano Parceiro Zélla',
  roomDetails: 'R$247/mês · Congelado 24 meses · Selo no Link-in-Bio',
  roomPrice: 'R$ 247',
  roomPriceTotal: 'R$ 247',
  roomPriceBreakdown: 'R$247/mês · R$150 de desconto vs. PRO',
  highlights: [
    { icon: '🏷️', label: 'Preço' },
    { icon: '🏅', label: 'Selo' },
    { icon: '⭐', label: 'PRO' },
    { icon: '🔒', label: '24 meses' },
  ],
  galleryPhotos: [
    { src: '/pousada-quarto.jpg', label: 'Atendimento IA' },
    { src: '/pousada-piscina.jpg', label: 'Dashboard' },
    { src: '/pousada-cafe.jpg', label: 'Reservas' },
    { src: '/pousada-jardim.jpg', label: 'Campanhas' },
    { src: '/pousada-vista.jpg', label: 'Link-in-Bio' },
    { src: '/pousada-chale.jpg', label: 'Relatórios' },
  ],
  chatMessages: [
    {
      from: 'guest',
      text: 'Olá! Vi que vocês são parceiros do Zélla. Como funciona o atendimento?',
      time: '14:22',
    },
    {
      from: 'zella',
      text: 'Olá, Bernardo! Bem-vindo! 🏅 Como Parceiro Zélla, seu negócio tem atendimento 24/7 pela IA.\n\nAqui está como funciona:\n\n✅ Respostas automáticas no seu tom de voz\n Fechamento de reservas pelo WhatsApp\n Check-in virtual automático\n Dashboard completo com métricas\n\nTudo isso pelo plano PRO a R$247/mês — preço congelado por 24 meses! Ainda ganha o selo no Link-in-Bio para fixar no Instagram.',
      time: '14:22',
    },
    {
      from: 'guest',
      text: 'Interessante! Quero saber mais sobre o programa.',
      time: '14:24',
    },
    {
      from: 'zella',
      text: 'Ótimo! Como parceiro, você tem:\n\n🏅 Selo exclusivo de Parceiro Zélla no Link-in-Bio\n💰 R$150/mês de desconto vs. PRO regular\n Preço congelado por 24 meses\n Atendimentos e mensagens ilimitados\n Suporte prioritário VIP\n Link para fixar no Instagram\n\nVagas limitadas — apenas 100 parceiros!',
      pix: true,
      time: '14:24',
    },
    {
      from: 'guest',
      text: 'Perfeito, quero garantir minha vaga!',
      time: '14:28',
    },
    {
      from: 'zella',
      text: '✅ Vaga reservada com sucesso!\n\n📋 Programa Parceiro Zélla\n Selo de Parceiro no Link-in-Bio\n R$247/mês congelado por 24 meses\n Economia de R$3.600 vs. PRO regular\n Link para fixar no Instagram\n\nBem-vindo ao time! Vamos transformar seu negócio juntos. ',
      confirmation: true,
      time: '14:28',
    },
  ],
  showPartnerBadge: true,
};

// ── LIB Buttons Data 
const pousadaButtons = [
  { id: 'reservar', label: 'Reservar Agora (PIX Automático)', highlight: true, icon: '🏡', phase: 'reservar' as DemoPhase },
  { id: 'galeria', label: 'Galeria de Fotos do Chalé', highlight: false, icon: '📸', phase: 'galeria' as DemoPhase },
  { id: 'avaliacoes', label: 'Nossas Avaliações', highlight: false, icon: '⭐', phase: 'avaliacoes' as DemoPhase },
  { id: 'mapa', label: 'Como Chegar (Mapa)', highlight: false, icon: '📍', phase: 'mapa' as DemoPhase },
  { id: 'whatsapp-btn', label: 'Conversar no WhatsApp', highlight: false, icon: '💬', phase: 'whatsapp' as DemoPhase },
];

const anfitriaoButtons = [
  { id: 'reservar', label: 'Reservar Agora (PIX Automático)', highlight: true, icon: '🏖️', phase: 'reservar' as DemoPhase },
  { id: 'galeria', label: 'Galeria de Fotos', highlight: false, icon: '📸', phase: 'galeria' as DemoPhase },
  { id: 'avaliacoes', label: 'Avaliações dos Hóspedes', highlight: false, icon: '⭐', phase: 'avaliacoes' as DemoPhase },
  { id: 'mapa', label: 'Como Chegar (Mapa)', highlight: false, icon: '📍', phase: 'mapa' as DemoPhase },
  { id: 'whatsapp-btn', label: 'Conversar no WhatsApp', highlight: false, icon: '💬', phase: 'whatsapp' as DemoPhase },
];

const parceiroButtons = [
  { id: 'reservar', label: 'Ver Plano Parceiro PRO', highlight: true, icon: '🏷️', phase: 'reservar' as DemoPhase },
  { id: 'galeria', label: 'Funcionalidades do Zélla', highlight: false, icon: '📸', phase: 'galeria' as DemoPhase },
  { id: 'avaliacoes', label: 'Depoimentos de Parceiros', highlight: false, icon: '⭐', phase: 'avaliacoes' as DemoPhase },
  { id: 'mapa', label: 'Como Funciona', highlight: false, icon: '📍', phase: 'mapa' as DemoPhase },
  { id: 'whatsapp-btn', label: 'Conversar no WhatsApp', highlight: false, icon: '💬', phase: 'whatsapp' as DemoPhase },
];

// ── Timing Constants (ms) 
const INSTAGRAM_DURATION = 2500;
const BUTTON_CYCLE_INTERVAL = 3000; // 3 seconds per button
const CHAT_MSG_INTERVAL = 2200; // time between chat messages appearing
const CHAT_PAUSE_AFTER_COMPLETE = 3000; // pause after full conversation before looping

// ── Main Component 
export function LinkInBioDemo() {
  const { isAirbnb, isPousada } = useNiche();

  const profile = isAirbnb ? anfitriaoProfile : pousadaProfile;
  const libButtons = isAirbnb ? anfitriaoButtons : pousadaButtons;
  const {chatMessages} = profile;

  const TOTAL_CHAT_DURATION = chatMessages.length * CHAT_MSG_INTERVAL + CHAT_PAUSE_AFTER_COMPLETE;
  const TOTAL_LOOP = INSTAGRAM_DURATION + 1000 + (5 * BUTTON_CYCLE_INTERVAL) + TOTAL_CHAT_DURATION;

  const [phase, setPhase] = useState<DemoPhase>('instagram');
  const [chatStep, setChatStep] = useState(-1);
  const [showTyping, setShowTyping] = useState(false);
  const [tapPulse, setTapPulse] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    chatTimersRef.current.forEach(t => clearTimeout(t));
    chatTimersRef.current = [];
  }, []);

  const startLoop = useCallback(() => {
    clearAllTimers();

    // Phase 1: Instagram (0 → 2.5s)
    setPhase('instagram');
    setChatStep(-1);
    setShowTyping(false);
    setTapPulse(false);

    // Tap animation on link at 1.2s
    timerRef.current = setTimeout(() => setTapPulse(true), 1200);

    // Phase 2: Transition to Link-in-Bio (2.5s)
    timerRef.current = setTimeout(() => {
      setPhase('linkinbio');
      setTapPulse(false);

      // Phase 3-7: Cycle through each button every 3s
      const buttonPhases: DemoPhase[] = ['reservar', 'galeria', 'avaliacoes', 'mapa', 'whatsapp'];
      buttonPhases.forEach((bp, idx) => {
        const t = setTimeout(() => {
          setPhase(bp);
          // If this is whatsapp, start chat sequence
          if (bp === 'whatsapp') {
            startChatSequence();
          }
        }, 1000 + (idx * BUTTON_CYCLE_INTERVAL));
        chatTimersRef.current.push(t);
      });

      // Loop back to Instagram after everything finishes
      const loopTimer = setTimeout(() => {
        startLoop();
      }, TOTAL_LOOP - INSTAGRAM_DURATION - 1000);
      chatTimersRef.current.push(loopTimer);

    }, INSTAGRAM_DURATION);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAllTimers, TOTAL_LOOP]);

  const startChatSequence = useCallback(() => {
    chatMessages.forEach((msg, idx) => {
      // Show typing for zella messages
      if (msg.from === 'zella') {
        const typingTimer = setTimeout(() => {
          setShowTyping(true);
        }, idx * CHAT_MSG_INTERVAL);
        chatTimersRef.current.push(typingTimer);

        const msgTimer = setTimeout(() => {
          setShowTyping(false);
          setChatStep(idx);
        }, idx * CHAT_MSG_INTERVAL + 800);
        chatTimersRef.current.push(msgTimer);
      } else {
        const msgTimer = setTimeout(() => {
          setChatStep(idx);
        }, idx * CHAT_MSG_INTERVAL);
        chatTimersRef.current.push(msgTimer);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  useEffect(() => {
    startLoop();
    return () => clearAllTimers();
  }, [startLoop, clearAllTimers]);

  // Which button is currently active
  const activeButtonIdx = phase === 'instagram' || phase === 'linkinbio'
    ? -1
    : libButtons.findIndex(b => b.phase === phase);

  return (
    <div className="relative">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-emerald-400/[0.18] blur-[95px] pointer-events-none z-0" />

      {/* iPhone 16 Frame */}
      <div className="relative w-[280px] mx-auto h-[560px] rounded-[42px] border-[6px] border-neutral-800 bg-[#070709] shadow-2xl p-0 overflow-hidden flex flex-col select-none z-10">
        {/* Side Buttons */}
        <div className="absolute -left-[8px] top-[90px] w-[2.5px] h-[16px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -left-[8px] top-[120px] w-[2.5px] h-[30px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -left-[8px] top-[160px] w-[2.5px] h-[30px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -right-[8px] top-[130px] w-[2.5px] h-[42px] bg-neutral-800 rounded-r-md border-l border-neutral-700" />
        <div className="absolute -right-[8px] top-[200px] w-[2.5px] h-[26px] bg-neutral-900 rounded-r-sm border-l border-neutral-700 opacity-90" />

        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-[18px] bg-black rounded-full z-30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1c1c1e] absolute right-4" />
        </div>

        {/* Glass glare */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none rounded-[36px] z-20" />

        {/* Screen Content */}
        <div className="w-full h-full rounded-[36px] bg-black overflow-hidden relative flex flex-col">

          {/* ── STATUS BAR (shared)  */}
          <div className="w-full pt-2.5 px-5 flex items-center justify-between text-[9px] font-bold text-white/90 z-20 shrink-0 select-none absolute top-0">
            <span>14:22</span>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-[1px] items-end h-[7px] w-3">
                <div className="w-[1.5px] h-[2px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[3.5px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[5px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[6.5px] bg-white rounded-[0.5px]" />
              </div>
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="w-4 h-2 border border-white/60 rounded-[3px] p-[0.5px] flex items-center shrink-0">
                <div className="w-full h-full bg-white rounded-[1px]" />
                <div className="w-[1px] h-[2.5px] bg-white/60 -mr-[2px]" />
              </div>
            </div>
          </div>

          {/* ── PHASE: INSTAGRAM  */}
          <AnimatePresence mode="wait">
            {phase === 'instagram' && (
              <motion.div
                key="instagram"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col text-white overflow-y-auto no-scrollbar"
                style={{ background: '#000' }}
              >
                <style dangerouslySetInnerHTML={{ __html: `.lib-demo-no-scroll::-webkit-scrollbar{display:none!important;width:0!important}.lib-demo-no-scroll{-ms-overflow-style:none!important;scrollbar-width:none!important}` }} />

                <div className="pt-8 px-3 pb-3 flex flex-col min-h-full">
                  {/* IG Top Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-900 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold">{profile.igHandle}</span>
                      <span className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0">✓</span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-lg leading-none font-bold">+</span>
                      <div className="w-4 h-3 flex flex-col justify-between">
                        <div className="h-[2px] bg-white rounded" />
                        <div className="h-[2px] bg-white rounded" />
                        <div className="h-[2px] bg-white rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 p-[2px] shrink-0">
                      <div className="w-full h-full rounded-full bg-black p-[1.5px]">
                        <img src="/avatar-serenity.jpg" className="w-full h-full object-cover rounded-full" alt="" />
                      </div>
                    </div>
                    <div className="flex-1 flex justify-around text-center">
                      {[
                        { num: '42', label: 'posts' },
                        { num: '15.8k', label: 'seguidores' },
                        { num: '380', label: 'seguindo' },
                      ].map(s => (
                        <div key={s.label}>
                          <div className="text-[11px] font-bold leading-tight">{s.num}</div>
                          <div className="text-[6.5px] text-neutral-400 tracking-wide uppercase">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="mt-3 text-[8.5px] leading-snug">
                    <p className="font-bold">{profile.profileName}</p>
                    <p className="text-neutral-400">{profile.profileLabel}</p>
                    <p className="mt-1">{profile.bioLine1}</p>
                    <p>{profile.bioLine2}</p>
                    <p className="mt-1">{profile.bioLine3}</p>
                    {/* LINK with tap pulse */}
                    <div className="relative mt-1">
                      {tapPulse && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0.8 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="absolute top-1/2 left-4 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 pointer-events-none z-10"
                        />
                      )}
                      <span className="text-sky-400 font-semibold block text-left">
                        {profile.linkUrl}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {['Seguir', 'Mensagem', 'Contato'].map(btn => (
                      <div key={btn} className="bg-neutral-800 text-[7.5px] font-bold py-1.5 rounded-lg text-center">
                        {btn}
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div className="flex justify-between gap-2 mt-3 pb-3 border-b border-neutral-900">
                    {profile.highlights.map(h => (
                      <div key={h.label} className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-sm">
                          {h.icon}
                        </div>
                        <span className="text-[6.5px] text-neutral-400">{h.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Feed Grid */}
                  <div className="grid grid-cols-3 gap-0.5 mt-2">
                    {[
                      '/pousada-quarto.jpg',
                      '/pousada-piscina.jpg',
                      '/pousada-cafe.jpg',
                      '/pousada-jardim.jpg',
                      '/pousada-vista.jpg',
                      '/pousada-chale.jpg',
                    ].map((img, idx) => (
                      <div key={idx} className="aspect-square bg-neutral-900 overflow-hidden">
                        <img src={img} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PHASE: LINK-IN-BIO + BUTTON PREVIEWS  */}
            {(phase === 'linkinbio' || phase === 'reservar' || phase === 'galeria' || phase === 'avaliacoes' || phase === 'mapa') && (
              <motion.div
                key="linkinbio"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 flex flex-col"
              >
                {/* In-app browser top bar */}
                <div className="w-full bg-[#1b1b1f] pt-8 pb-2 px-3 flex items-center justify-between border-b border-white/[0.04] z-20 shrink-0">
                  <span className="text-neutral-500 text-[10px]">✕</span>
                  <span className="text-neutral-400 text-[7px] font-medium tracking-tight">{profile.linkUrl}</span>
                  <span className="text-[10px] text-neutral-400 rotate-90 leading-none">⋯</span>
                </div>

                {/* LIB Content */}
                <div
                  className="flex-1 w-full p-3 flex flex-col overflow-hidden relative"
                  style={{
                    backgroundImage: 'linear-gradient(to bottom, rgba(6,78,59,0.4), rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(/pousada-vista.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Profile header */}
                  <div className="flex flex-col items-center text-center pb-2 border-b border-white/[0.04] mt-1 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 p-[2px] mb-1.5 shadow-lg shadow-emerald-500/20">
                      <div className="w-full h-full rounded-full bg-[#111] overflow-hidden">
                        <img src="/avatar-serenity.jpg" className="w-full h-full object-cover" alt="" />
                      </div>
                    </div>
                    <h4 className="text-white text-[11px] font-bold tracking-tight">{profile.profileName}</h4>
                    <p className="text-neutral-400 text-[7.5px] mt-0.5">{profile.libSubtitle}</p>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[6.5px] font-semibold mt-1">
                      <span>⭐ 4.9</span>
                      <span className="text-neutral-500 font-normal">| 128 avaliações</span>
                    </div>
                    {profile.showPartnerBadge && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[6px] font-bold mt-1">
                        🏅 Parceiro Zélla Oficial
                      </div>
                    )}
                  </div>

                  {/* Buttons + Preview Area */}
                  <div className="flex-1 flex flex-col min-h-0 mt-2">
                    {/* LIB Buttons */}
                    <div className="space-y-1.5 shrink-0">
                      {libButtons.map((link, idx) => (
                        <motion.div
                          key={link.id}
                          animate={
                            idx === activeButtonIdx
                              ? { scale: [1, 1.03, 1], borderColor: link.highlight ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.4)' }
                              : {}
                          }
                          transition={idx === activeButtonIdx ? { duration: 0.5, repeat: 1 } : {}}
                          className={`relative p-2 rounded-xl text-[8.5px] text-white font-semibold text-center flex items-center justify-center gap-1.5 transition-all duration-300 overflow-hidden ${
                            link.highlight
                              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 border border-emerald-400/20 shadow-lg shadow-emerald-500/20'
                              : idx === activeButtonIdx
                                ? 'bg-emerald-500/15 border border-emerald-500/40 ring-1 ring-emerald-500/20'
                                : 'bg-white/[0.03] border border-white/[0.05]'
                          }`}
                        >
                          {/* Active indicator glow */}
                          {idx === activeButtonIdx && (
                            <motion.div
                              layoutId="btn-glow"
                              className="absolute inset-0 bg-emerald-400/10 rounded-xl pointer-events-none"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 0.3, 0.1, 0.3, 0] }}
                              transition={{ duration: 1.5, repeat: 1 }}
                            />
                          )}
                          <span className="relative z-10">{link.icon}</span>
                          <span className="relative z-10 flex-1 text-left">{link.label}</span>
                          {link.highlight && <Check className="w-2.5 h-2.5 relative z-10 text-white" />}
                          {idx === activeButtonIdx && !link.highlight && (
                            <motion.div
                              initial={{ x: -4, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              className="relative z-10"
                            >
                              <ChevronRight className="w-3 h-3 text-emerald-400" />
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* ── FUNCTION PREVIEW PANELS  */}
                    <div className="flex-1 min-h-0 mt-2">
                      <AnimatePresence mode="wait">
                        {/* RESERVAR PREVIEW */}
                        {phase === 'reservar' && (
                          <motion.div
                            key="preview-reservar"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-xl overflow-hidden bg-[#111]/90 backdrop-blur-sm border border-white/[0.06] flex flex-col"
                          >
                            {/* Room Image */}
                            <div className="relative h-[45%] overflow-hidden">
                              <img src="/pousada-quarto.jpg" className="w-full h-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2">
                                <p className="text-white text-[9px] font-bold">{profile.roomLabel}</p>
                                <p className="text-neutral-300 text-[7px]">{profile.roomDetails}</p>
                              </div>
                            </div>
                            {/* Booking details */}
                            <div className="p-2.5 flex-1 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                                  <div className="text-center">
                                    <p className="text-[6px] text-neutral-500 uppercase">Check-in</p>
                                    <p className="text-[9px] font-bold text-white">19 Jul</p>
                                  </div>
                                  <div className="text-emerald-400 text-[7px]">→</div>
                                  <div className="text-center">
                                    <p className="text-[6px] text-neutral-500 uppercase">Check-out</p>
                                    <p className="text-[9px] font-bold text-white">21 Jul</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[6px] text-neutral-500 uppercase">Hóspedes</p>
                                    <p className="text-[9px] font-bold text-white">2 👥</p>
                                  </div>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                                  <p className="text-[6px] text-emerald-400/70 uppercase font-medium">Total PIX</p>
                                  <p className="text-emerald-400 text-base font-black">{profile.roomPriceTotal}</p>
                                  <p className="text-[6.5px] text-neutral-400">{profile.roomPriceBreakdown}</p>
                                </div>
                              </div>
                              <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[8px] font-bold text-center py-1.5 rounded-lg mt-1.5 flex items-center justify-center gap-1">
                                <span>Reservar via WhatsApp</span>
                                <MessageSquare className="w-3 h-3" />
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* GALERIA PREVIEW */}
                        {phase === 'galeria' && (
                          <motion.div
                            key="preview-galeria"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-xl overflow-hidden bg-[#111]/90 backdrop-blur-sm border border-white/[0.06] p-2"
                          >
                            <p className="text-[7px] text-neutral-500 font-semibold uppercase tracking-wider mb-1.5">📸 Galeria Completa</p>
                            <div className="grid grid-cols-2 gap-1 h-[calc(100%-16px)]">
                              {profile.galleryPhotos.map((photo, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.08, duration: 0.3 }}
                                  className="relative rounded-lg overflow-hidden group/photo"
                                >
                                  <img src={photo.src} className="w-full h-full object-cover" alt="" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-end p-1">
                                    <span className="text-white text-[7px] font-semibold">{photo.label}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* AVALIACOES PREVIEW */}
                        {phase === 'avaliacoes' && (
                          <motion.div
                            key="preview-avaliacoes"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-xl overflow-hidden bg-[#111]/90 backdrop-blur-sm border border-white/[0.06] p-2 overflow-y-auto lib-demo-no-scroll"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[7px] text-neutral-500 font-semibold uppercase tracking-wider">⭐ Avaliações Reais</p>
                              <div className="flex items-center gap-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                ))}
                                <span className="text-[8px] text-white font-bold ml-1">4.9</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { name: 'Ana Clara', date: 'Jun 2026', text: 'Lugar incrível! O atendimento via WhatsApp foi super rápido. Reserva em 2 minutos, sem complicação.', rating: 5 },
                                { name: 'Ricardo M.', date: 'Mai 2026', text: 'Atendimento via WhatsApp foi super rápido. Reserva em 2 minutos, sem complicação.', rating: 5 },
                                { name: 'Juliana P.', date: 'Mai 2026', text: 'Fim de semana perfeito. Tudo organizado e silêncio total. Voltaremos!', rating: 5 },
                              ].map((review, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.15, duration: 0.3 }}
                                  className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2"
                                >
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-[7px] font-bold text-white">
                                        {review.name[0]}
                                      </div>
                                      <span className="text-[8px] font-semibold text-white">{review.name}</span>
                                    </div>
                                    <span className="text-[6px] text-neutral-500">{review.date}</span>
                                  </div>
                                  <div className="flex gap-0.5 mb-1">
                                    {Array.from({ length: review.rating }).map((_, s) => (
                                      <Star key={s} className="w-2 h-2 text-amber-400 fill-amber-400" />
                                    ))}
                                  </div>
                                  <p className="text-[7px] text-neutral-300 leading-relaxed">{review.text}</p>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* MAPA PREVIEW */}
                        {phase === 'mapa' && (
                          <motion.div
                            key="preview-mapa"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-xl overflow-hidden bg-[#111]/90 backdrop-blur-sm border border-white/[0.06] flex flex-col"
                          >
                            {/* Fake Map */}
                            <div className="relative flex-1 overflow-hidden">
                              {/* Map background - CSS-based map illustration */}
                              <div className="absolute inset-0" style={{
                                background: `
                                  linear-gradient(135deg, #1a2332 0%, #0f1923 30%, #162029 60%, #1a2332 100%)
                                `
                              }}>
                                {/* Roads */}
                                <div className="absolute top-[30%] left-0 right-0 h-[2px] bg-neutral-700/40" />
                                <div className="absolute top-[60%] left-0 right-0 h-[1px] bg-neutral-700/30" />
                                <div className="absolute top-0 bottom-0 left-[35%] w-[2px] bg-neutral-700/40" />
                                <div className="absolute top-0 bottom-0 left-[70%] w-[1px] bg-neutral-700/30" />
                                {/* Water */}
                                <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-blue-900/30 to-transparent" />
                                {/* Coast line */}
                                <svg className="absolute bottom-[25%] left-0 w-full h-8 opacity-20" viewBox="0 0 200 30">
                                  <path d="M0,15 Q25,5 50,15 T100,15 T150,15 T200,15" stroke="#4a9eff" fill="none" strokeWidth="1.5"/>
                                </svg>
                                {/* Location Pin */}
                                <motion.div
                                  initial={{ scale: 0, y: -10 }}
                                  animate={{ scale: 1, y: 0 }}
                                  transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                                  className="absolute top-[40%] left-[45%] flex flex-col items-center"
                                >
                                  <div className="w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <MapPin className="w-3 h-3 text-white" />
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full mt-0.5 blur-[1px]" />
                                </motion.div>
                                {/* Location label */}
                                <div className="absolute top-[35%] left-[55%] bg-black/60 px-1.5 py-0.5 rounded text-[7px] text-white font-medium border border-white/10">
                                  {profile.libMapLabel}
                                </div>
                              </div>
                            </div>
                            {/* Directions info */}
                            <div className="p-2 bg-[#111] border-t border-white/[0.04] space-y-1.5">
                              <p className="text-[8px] text-white font-bold flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                {profile.profileName}
                              </p>
                              <p className="text-[7px] text-neutral-400">{profile.libMapAddress}</p>
                              <div className="flex gap-1.5">
                                <div className="flex-1 bg-white/[0.04] rounded-lg px-2 py-1 text-center">
                                  <p className="text-[6px] text-neutral-500">De São Paulo</p>
                                  <p className="text-[8px] text-white font-bold">3h30 de carro</p>
                                </div>
                                <div className="flex-1 bg-white/[0.04] rounded-lg px-2 py-1 text-center">
                                  <p className="text-[6px] text-neutral-500">De Rio</p>
                                  <p className="text-[8px] text-white font-bold">4h de carro</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Empty state (linkinbio phase, no button selected) */}
                        {phase === 'linkinbio' && (
                          <motion.div
                            key="preview-empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex items-center justify-center"
                          >
                            <p className="text-neutral-600 text-[8px] text-center leading-relaxed">
                              Toque em um botão<br />para ver a função
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Footer gallery + stats (shrunk) */}
                  <div className="shrink-0 pt-2 border-t border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { src: '/pousada-quarto.jpg' },
                        { src: '/pousada-piscina.jpg' },
                        { src: '/pousada-cafe.jpg' },
                      ].map((photo, i) => (
                        <div key={i} className="aspect-square rounded-md border border-white/[0.04] overflow-hidden bg-[#111]">
                          <img src={photo.src} className="w-full h-full object-cover" alt="" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1 pb-1">
                      {[
                        { label: '4.9', sub: 'Avaliação' },
                        { label: '500+', sub: 'Hóspedes' },
                        { label: '100%', sub: 'Satisfação' },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center">
                          <div className="text-emerald-400 text-[8px] font-bold">{stat.label}</div>
                          <div className="text-neutral-500 text-[6px]">{stat.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PHASE: WHATSAPP CONVERSATION  */}
            {phase === 'whatsapp' && (
              <motion.div
                key="whatsapp"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 flex flex-col"
                style={{ background: '#0b141a' }}
              >
                <style dangerouslySetInnerHTML={{ __html: `.wa-no-scroll::-webkit-scrollbar{display:none!important;width:0!important}.wa-no-scroll{-ms-overflow-style:none!important;scrollbar-width:none!important}` }} />

                {/* WA Header */}
                <div className="w-full bg-[#1f2c34] pt-8 pb-2 px-3 flex items-center justify-between border-b border-white/[0.03] z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#111] border border-emerald-500/30 overflow-hidden relative">
                      <img src="/avatar-serenity.jpg" className="w-full h-full object-cover" alt="" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-[1.5px] border-[#1f2c34] rounded-full" />
                    </div>
                    <div>
                      <h4 className="text-white text-[10px] font-bold tracking-tight flex items-center gap-1">
                        {profile.profileName}
                        <span className="px-1 py-[1px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[6px] font-bold rounded">IA</span>
                      </h4>
                      <p className="text-emerald-400 text-[7px] font-medium leading-none mt-0.5">ZÉLLA está online</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-2.5 overflow-y-auto wa-no-scroll space-y-2 pb-12">
                  {/* Date divider */}
                  <div className="flex justify-center my-1">
                    <span className="bg-[#1f2c34]/50 text-neutral-400 text-[7px] font-medium px-2 py-0.5 rounded-md">HOJE</span>
                  </div>

                  {/* Chat messages */}
                  {chatMessages.slice(0, chatStep + 1).map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className={`flex ${msg.from === 'guest' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`rounded-2xl px-2.5 py-1.5 text-[8.5px] leading-relaxed max-w-[88%] relative ${
                        msg.from === 'guest'
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                      }`}>
                        {msg.from === 'zella' && (
                          <p className="text-emerald-400 text-[6.5px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Seu Zélla
                          </p>
                        )}
                        <p className="whitespace-pre-line text-[8px]">{msg.text}</p>
                        {msg.pix && (
                          <div className="mt-1.5 bg-[#111b21] p-1.5 rounded-lg border border-white/[0.04] font-mono text-[6px] break-all flex items-center justify-between gap-1">
                            <span className="text-neutral-400">00020101021226300014...</span>
                            <span className="text-emerald-400 text-[6px] font-bold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 shrink-0">PIX</span>
                          </div>
                        )}
                        {msg.confirmation && (
                          <div className="mt-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5">
                            <p className="text-emerald-400 text-[8px] font-bold flex items-center gap-1">
                              <span>✓</span> Reserva Confirmada #ZR-4821
                            </p>
                          </div>
                        )}
                        <span className="text-[6px] text-neutral-400/60 float-right mt-0.5 ml-2 font-medium">{msg.time}</span>
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {showTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="flex gap-1 items-center py-2 px-3 bg-[#202c33] rounded-2xl rounded-tl-none">
                        <motion.span animate={{ y: ['0%', '-50%', '0%'] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' as const, delay: 0 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                        <motion.span animate={{ y: ['0%', '-50%', '0%'] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' as const, delay: 0.15 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                        <motion.span animate={{ y: ['0%', '-50%', '0%'] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' as const, delay: 0.3 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* WA Input */}
                <div className="absolute bottom-0 inset-x-0 bg-[#1f2c34] p-2 flex items-center gap-2 border-t border-white/[0.03] z-10 shrink-0">
                  <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 border border-white/[0.02]">
                    <span className="text-neutral-400 text-[9px]">
                      {chatStep < 1 ? 'Olá! Vocês têm vaga...' : chatStep < 2 ? 'Perfeito! Quero sim...' : chatStep < 4 ? 'Acabei de fazer o PIX...' : '...'}
                    </span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                    <MessageSquare className="w-3 h-3 text-white" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

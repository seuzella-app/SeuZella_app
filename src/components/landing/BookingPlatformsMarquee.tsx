'use client'

import React from 'react'
import { useNiche } from '@/contexts/NicheContext'

// Simplified platforms - only names in text, no icons or colors
const allPlatforms = [
  'Booking.com',
  'Airbnb',
  'Trivago',
  'Decolar',
  'Expedia',
  'TripAdvisor',
  'Google Hotels',
  'Mercado Pago',
]

export default function BookingPlatformsMarquee() {
  const { isPousada, isAirbnb } = useNiche()

  // Parceiro niche: filter out Airbnb from platform list
  const platforms = allPlatforms

  const headlineAccent = 'plataformas de hospedagem do Brasil'

  return (
    <section id="integracoes" className="py-16 bg-gradient-to-b from-transparent via-zinc-950/50 to-transparent border-y border-zinc-800">
      <div className="container mx-auto px-6 mb-12 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <span className="text-emerald-400 text-sm font-medium">Integrações Nativas</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6">
          Integrado com as maiores
          <br />
          <span className="text-blue-500 font-bold">
            {headlineAccent}
          </span>
        </h2>

        {/* Description */}
        <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto mb-8">
          {isPousada ? 'Conecte sua pousada a todas as principais plataformas de reservas e pagamentos em um único painel.' : 'Conecte seus imóveis a todas as principais plataformas de reservas e pagamentos em um único painel.'}
          Sincronização automática de disponibilidade e preços em tempo real.
        </p>

        {/* Features */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm sm:text-base">
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Sincronização automática</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Atualização em tempo real</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Sem conflito de datas</span>
          </div>
        </div>
      </div>

      {/* Marquee Container */}
      <div className="overflow-hidden relative mt-8">
        {/* Gradient fade on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10" />

        {/* Moving content */}
        <div className="flex marquee-content">
          {/* First set */}
          {platforms.map((platform) => (
            <div
              key={platform}
              className="marquee-item mx-12 md:mx-20 text-zinc-600 hover:text-zinc-400 transition-colors duration-300"
            >
              <span className="text-xl md:text-2xl font-semibold">{platform}</span>
            </div>
          ))}
          {/* Second set for seamless loop */}
          {platforms.map((platform) => (
            <div
              key={`${platform}-dup`}
              className="marquee-item mx-12 md:mx-20 text-zinc-600 hover:text-zinc-400 transition-colors duration-300"
            >
              <span className="text-xl md:text-2xl font-semibold">{platform}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

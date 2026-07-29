'use client'

import React from 'react'
import { useNiche } from '@/contexts/NicheContext'

// Logotipos PNG oficiais monocromáticos (Booking.com, Decolar, Expedia, Airbnb)
const otaLogos = [
  { id: 'booking', name: 'Booking.com', src: '/images/ota-logos/booking.png' },
  { id: 'decolar', name: 'Decolar', src: '/images/ota-logos/decolar.png' },
  { id: 'expedia', name: 'Expedia', src: '/images/ota-logos/expedia.png' },
  { id: 'airbnb', name: 'Airbnb', src: '/images/ota-logos/airbnb.png' },
]

export default function BookingPlatformsMarquee() {
  const { isPousada } = useNiche()

  return (
    <section id="integracoes" className="py-16 bg-gradient-to-b from-transparent via-zinc-950/60 to-transparent border-y border-zinc-800/60">
      <div className="container mx-auto px-6 mb-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Sincronização iCal 2-Way</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-5 tracking-tight">
          Integrado com as maiores
          <br />
          <span className="text-emerald-400 font-bold">
            plataformas de hospedagem do Brasil
          </span>
        </h2>

        {/* Description */}
        <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto mb-8 font-normal">
          {isPousada
            ? 'Sincronize sua pousada com as 4 maiores OTAs do mercado em tempo real via iCal Sync 2-Way. Bloqueio automático de calendário sem risco de overbooking.'
            : 'Sincronize seus imóveis com as 4 maiores OTAs do mercado em tempo real via iCal Sync 2-Way. Bloqueio automático de calendário sem risco de overbooking.'
          }
        </p>

        {/* Features */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-neutral-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Sincronização automática iCal 2-Way</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Bloqueio instantâneo pelo WhatsApp</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Zero risco de overbooking</span>
          </div>
        </div>
      </div>

      {/* Marquee Container com Logotipos PNG Fiéis e Sem Distorção */}
      <div className="overflow-hidden relative mt-6 py-6">
        {/* Gradient fade on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-36 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-36 bg-gradient-to-l from-[#09090b] via-[#09090b]/80 to-transparent z-10 pointer-events-none" />

        {/* Moving content — 40s slow duration for relaxed movement */}
        <div className="flex items-center marquee-content">
          {/* First set */}
          {otaLogos.map((ota) => (
            <div
              key={ota.id}
              className="marquee-item mx-14 sm:mx-20 md:mx-28 shrink-0 flex items-center justify-center"
            >
              <img
                src={ota.src}
                alt={ota.name}
                className="h-7 sm:h-8 md:h-9 w-auto object-contain brightness-125 contrast-125 opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          ))}
          {/* Duplicate set 1 for seamless infinite marquee loop */}
          {otaLogos.map((ota) => (
            <div
              key={`${ota.id}-dup1`}
              className="marquee-item mx-14 sm:mx-20 md:mx-28 shrink-0 flex items-center justify-center"
            >
              <img
                src={ota.src}
                alt={ota.name}
                className="h-7 sm:h-8 md:h-9 w-auto object-contain brightness-125 contrast-125 opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          ))}
          {/* Duplicate set 2 for seamless infinite marquee loop on ultra-wide screens */}
          {otaLogos.map((ota) => (
            <div
              key={`${ota.id}-dup2`}
              className="marquee-item mx-14 sm:mx-20 md:mx-28 shrink-0 flex items-center justify-center"
            >
              <img
                src={ota.src}
                alt={ota.name}
                className="h-7 sm:h-8 md:h-9 w-auto object-contain brightness-125 contrast-125 opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

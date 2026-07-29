'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

// Apenas as 4 OTAs adotadas com arquivos PNG originais e alturas ópticas equilibradas (estáticos e compactos)
const staticOtaLogos = [
  { id: 'booking', name: 'Booking.com', src: '/images/ota-logos/booking.png', heightClass: 'h-3.5 sm:h-4 md:h-4.5' },
  { id: 'decolar', name: 'Decolar', src: '/images/ota-logos/decolar.png', heightClass: 'h-5 sm:h-5.5 md:h-6' },
  { id: 'expedia', name: 'Expedia', src: '/images/ota-logos/expedia.png', heightClass: 'h-8 sm:h-9 md:h-10' },
  { id: 'airbnb', name: 'Airbnb', src: '/images/ota-logos/airbnb.png', heightClass: 'h-5 sm:h-5.5 md:h-6' },
];

export function TrustBadgesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const subtitle = 'Integrado com as maiores plataformas de hospedagem do Brasil';

  return (
    <section ref={ref} className="py-12 bg-[#09090b] border-t border-white/[0.06]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto px-6 text-center"
      >
        <p className="text-center text-neutral-400 text-xs sm:text-sm font-medium mb-8 tracking-wide">
          {subtitle}
        </p>
        
        {/* Grade Estática das 4 OTAs com Tamanho Compacto e Elegante */}
        <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 md:gap-20">
          {staticOtaLogos.map((ota, i) => (
            <motion.div
              key={ota.id}
              initial={{ opacity: 0, y: 8 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex items-center justify-center h-12"
            >
              <img
                src={ota.src}
                alt={ota.name}
                className={`${ota.heightClass} w-auto object-contain brightness-125 contrast-125 opacity-70 hover:opacity-100 transition-opacity duration-300`}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
